/**
 * lib/habit-helper/run.ts — One message through the Daily Habit Helper's flow
 *
 * ROUTE (code) → TAG (code) → MATCH (one model call) → COMPUTE + PROPOSE (code). Routes other than `log`
 * need no model: `answer` records the reply to an open why-question word for word, `shorthand` suggests
 * names, `reasons` and `nudge` read the person's own cells, `question` gets a fixed line. Every stage is
 * timed into `trace` for the lab. Writes nothing.
 */

import type { ModelCall } from "@/lib/bim-flow/ollama"
import { dateKey } from "@/lib/tracking-helper/clock"
import { computeAll } from "./compute"
import type { HabitHelperFlow } from "./flow"
import { dayWords, nudges, reasonsOf } from "./history"
import { headOf, match } from "./match"
import { scoreClause } from "./lexicon"
import { suggestShorthands } from "./shorthand"
import { tagText } from "./tags"
import type { Ask, HabitRoute, HelperContext, Proposal, Tag, TraceStage } from "./types"
import { displayName } from "./words"

export interface PendingWhy {
  habitId: string
  day: string
}

export interface HabitRun {
  route: HabitRoute
  reply: string
  proposals: Proposal[]
  asks: Ask[]
  notes: string[]
  tags: Tag[]
  marked: string
  trace: TraceStage[]
  model?: string
  fallback?: string
  /** For `reasons`: the habit asked about. */
  reasonsFor?: string
}

export const QUESTION_REPLY =
  "I read what you did and didn't do today, and propose the cells for you to approve. Try “drank water, read 10 pages, stretched”, " +
  "“I didn't go outside because it was dark”, “what's left today?”, “show my reasons for go outside”, or “give my habits shorthand names”."

function safeRe(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, "i")
  } catch {
    return null
  }
}

/**
 * Code-only route. `pending` is the why-question still open, if any. With one open, a message is its answer
 * unless it reads as a log: two clauses that name habits, or one with an amount and no negation. Then the
 * question stays open for the next message.
 */
export function routeOf(text: string, flow: HabitHelperFlow, pending: PendingWhy | null, ctx?: HelperContext): HabitRoute {
  const is = (p: string) => !!safeRe(p)?.test(text)
  if (is(flow.route.shorthand)) return "shorthand"
  if (is(flow.route.reasons)) return "reasons"
  if (is(flow.route.nudge)) return "nudge"
  if (is(flow.route.question)) return "question"
  if (pending && !(ctx && looksLikeLog(text, ctx))) return "answer"
  return "log"
}

export function looksLikeLog(text: string, ctx: HelperContext): boolean {
  const t = tagText(text, ctx.now)
  const named = t.clauses.filter((c) => scoreClause(headOf(c, t.tags), ctx.habits).length)
  return named.length >= 2 || named.some((c) => !c.negated && c.tags.some((id) => id.startsWith("N")))
}

export interface RunInput {
  text: string
  flow: HabitHelperFlow
  ctx: HelperContext
  call: ModelCall | null
  ladder: string[]
  pending?: PendingWhy | null
}

export async function runHabitHelper(input: RunInput): Promise<HabitRun> {
  const { flow, ctx, text } = input
  const trace: TraceStage[] = []
  const today = dateKey(ctx.now)
  const t0 = Date.now()
  const route = routeOf(text, flow, input.pending ?? null, ctx)
  trace.push({ stage: "route", ms: Date.now() - t0, note: route, output: route })
  const base = { route, proposals: [] as Proposal[], asks: [] as Ask[], notes: [] as string[], tags: [] as Tag[], marked: text, trace }

  if (route === "question") return { ...base, reply: QUESTION_REPLY }

  if (route === "answer" && input.pending) {
    const h = ctx.habits.find((x) => x.id === input.pending!.habitId)
    if (!h || safeRe(flow.route.skip)?.test(text)) return { ...base, reply: "Skipped." }
    const cell = h.days[input.pending.day]
    const p: Proposal = {
      id: `p-${h.id}-${input.pending.day}-reason`,
      kind: "reason",
      habitId: h.id,
      habit: displayName(h),
      day: input.pending.day,
      from: cell?.reason ? `“${cell.reason}”` : "no reason",
      to: `“${text}”`,
      write: { missedOpportunity: true, missReason: text },
      words: text,
    }
    trace.push({ stage: "propose", ms: 0, note: "reason, word for word", output: [p] })
    return { ...base, proposals: [p], reply: `Saved word for word as the reason ${displayName(h)} was missed ${dayWords(input.pending.day, today)}, once you approve it.` }
  }

  if (route === "shorthand") {
    const t1 = Date.now()
    const proposals = suggestShorthands(ctx.habits, { redo: /\b(redo|replace|all of them again|even (the )?ones)\b/i.test(text) })
    trace.push({ stage: "propose", ms: Date.now() - t1, note: `${proposals.length} names`, output: proposals })
    return { ...base, proposals, reply: proposals.length ? `Shorthand names for ${proposals.length} habits. Edit any before you accept it.` : "Every daily habit already has a shorthand name." }
  }

  if (route === "reasons") {
    const best = scoreClause(text, ctx.habits)[0]
    const h = ctx.habits.find((x) => x.id === best?.id)
    if (!h) return { ...base, reply: "Which habit? Say its name, like “reasons for go outside”." }
    const r = reasonsOf(h)
    const reply = r.list.length
      ? `${displayName(h)}: ${r.list.length} reasons recorded.${r.themes.length ? ` Most often: ${r.themes.map((t) => `${t.theme} (${t.n})`).join(", ")}.` : ""}`
      : `No reasons recorded for ${displayName(h)} yet.`
    return { ...base, reply, reasonsFor: h.id }
  }

  if (route === "nudge") {
    const list = nudges(ctx)
    return { ...base, reply: list.length ? list.map((n) => `${n.habit}: ${n.text}`).join("\n") : "Every daily habit is done or marked for today." }
  }

  const t1 = Date.now()
  const tagged = tagText(text, ctx.now)
  trace.push({ stage: "tag", ms: Date.now() - t1, note: `${tagged.clauses.length} clauses, ${tagged.tags.length} tags`, output: { clauses: tagged.clauses, tags: tagged.tags } })

  const t2 = Date.now()
  const m = await match(input.call, input.ladder, flow, tagged, ctx).catch((err) => ({
    matching: { items: [] },
    hops: [],
    prompt: "",
    model: undefined,
    fallback: err instanceof Error ? err.message : "model failed",
  }))
  trace.push({ stage: "match", ms: Date.now() - t2, note: m.model ?? m.fallback ?? "rules", prompt: m.prompt, output: m.matching, model: m.model })

  const t3 = Date.now()
  const out = computeAll(m.matching, tagged, ctx)
  trace.push({ stage: "compute", ms: Date.now() - t3, note: `${out.proposals.length} proposals, ${out.asks.length} asks`, output: out })

  const reply = [
    out.proposals.length ? `${out.proposals.length} ${out.proposals.length === 1 ? "change" : "changes"} to approve.` : "",
    ...out.asks.map((a) => `“${a.words}” could be ${a.options.map((o) => o.name).join(" or ")}. Which one?`),
    ...out.notes.filter(Boolean),
    !out.proposals.length && !out.asks.length && !out.notes.filter(Boolean).length ? "I didn't find one of your daily habits in that." : "",
    m.fallback ? `(Rules only: ${m.fallback}.)` : "",
  ]
    .filter(Boolean)
    .join("\n")
  return { ...base, proposals: out.proposals, asks: out.asks, notes: out.notes, tags: tagged.tags, marked: tagged.marked, reply, model: m.model, fallback: m.fallback }
}
