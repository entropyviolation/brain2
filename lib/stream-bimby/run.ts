/**
 * lib/stream-bimby/run.ts — BIM chat's door to the Stream BIMBY
 *
 * `tryStream` is called by `sendToBim` (`lib/ingest/bim-chat.ts`) for a message that is a stream:
 * an "add to …" directive or several timed lines. With LLM on, a local model lists the filings
 * (`llm.ts`) and the rules check them; otherwise, or when no model answers, the rules alone read
 * the stream (`parse.ts`). The plan is kept in `useReportStore` so the Report card draws it, and a
 * short chat line is returned. It writes nothing: each filing waits for an accept on the card.
 */
"use client"

import { useReportStore } from "@/lib/report-bimby/store"
import { readWithModel, withCoverage } from "./llm"
import type { ReportPlan } from "@/lib/report-bimby/types"
import { looksLikeStream, pieces, planFrom, ruleFilings } from "./parse"
import { finishFollow, startFollowRead } from "@/lib/follow-through/run"

export interface StreamReply {
  text: string
  reportId: string
  route: string
  /** One-tap answers for the follow-through question at the end of the reply, when there is one. */
  choices?: { label: string; text: string }[]
}

export async function tryStream(text: string, now = new Date(), opts: { llm?: boolean } = {}): Promise<StreamReply | null> {
  if (!looksLikeStream(text)) return null
  const started = Date.now()
  const { pieces: ps, timed } = pieces(text, now)
  const trace = [`Read ${ps.length} piece${ps.length === 1 ? "" : "s"} of the stream; ${timed} had a time.`]
  let via = "rules"
  let plan: ReportPlan
  const rules = ruleFilings(ps)
  // Plans and feelings are read beside the filings: a second, short model call over those pieces only.
  const followRead = startFollowRead(ps, rules, now, !!opts.llm)
  const reading = opts.llm ? await readWithModel(text, ps).catch(() => null) : null
  let filed = rules
  if (reading) {
    const covered = withCoverage(reading.filed, ps)
    filed = covered.filed
    const backfilled = covered.backfilled
    trace.push(...reading.trace)
    if (backfilled) trace.push(`The rules filed ${backfilled} piece${backfilled === 1 ? "" : "s"} the model did not list.`)
    plan = planFrom(text, now, filed.map((f) => f.filing), trace)
    via = `model ${reading.model}`
  } else {
    if (opts.llm) trace.push("No model answered, so the rules read the stream.")
    plan = planFrom(text, now, rules.map((r) => r.filing), trace)
  }
  if (!plan.effects.length) return null
  const n = plan.effects.length
  // The four linked records: saved as proposed, linked, and each link or feeling put on the card to confirm.
  let follow: ReturnType<typeof finishFollow> | null = null
  try {
    follow = finishFollow(plan.id, ps, filed, now, await followRead)
    plan = { ...plan, trace: [...plan.trace, ...follow.trace], effects: [...plan.effects, ...follow.effects] }
  } catch (error) {
    plan = { ...plan, trace: [...plan.trace, `Follow-through was not read: ${error instanceof Error ? error.message : String(error)}`] }
  }
  useReportStore.getState().put(plan)
  const links = follow?.effects.length ?? 0
  const tail = [links ? `${links} link${links === 1 ? "" : "s"} or feeling${links === 1 ? "" : "s"} to confirm at the end of the card.` : "", ...(follow?.extra ?? []), follow?.question?.text ?? ""].filter(Boolean)
  return {
    text: `I read that as ${n} filing${n === 1 ? "" : "s"}${via === "rules" ? "" : ` with ${via}`}. Nothing is filed yet: open each one, edit the line if it is off, then accept or reject.${tail.length ? `\n\n${tail.join("\n\n")}` : ""}`,
    reportId: plan.id,
    ...(follow?.question ? { choices: follow.question.choices } : {}),
    route: `STREAM · ${via} · ${((Date.now() - started) / 1000).toFixed(1)}s`,
  }
}
