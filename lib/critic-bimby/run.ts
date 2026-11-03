/**
 * lib/critic-bimby/run.ts — The second look with a model: the free checks, then at most one model call and one rung
 *
 * Order: code checks first. A certain finding fails the plan and no model runs. Otherwise the model layer runs only when
 * it can help (`modelReason`), only on a model that passed the bench, and on a different model from the planner when
 * one is installed. A critic that shares the planner's model is marked `same-model` and can only warn. The critic never
 * edits and writes nothing; it returns a `Critique`.
 */

import { escalate } from "@/lib/bim-flow/crew"
import type { ModelCall } from "@/lib/bim-flow/ollama"
import type { PlanDraft } from "@/lib/plan-bimby/types"
import { planChecks } from "./checks-plan"
import { isReady } from "./gate"
import { CRITIC_SCHEMA, CRITIC_SYSTEM, criticUser, findingsOf, wasUnsure } from "./prompt"
import type { Critique, Finding } from "./types"
import { keepQuoted, verdictOf } from "./verdict"

export const HOST = "plan"
const MAX_RUNGS = 2
const DEFAULT_MAX_MS = 20_000

type Draft = Pick<PlanDraft, "items" | "remarks" | "source"> & Partial<Pick<PlanDraft, "by" | "model" | "fallback">>

/** Why a model reading could help here, or null when the free checks are enough. */
export function modelReason(draft: Draft, code: Finding[]): string | null {
  if (code.some((x) => x.strength === "certain")) return null
  if (code.length) return "the free checks have a doubt"
  if (draft.by === "rules") return "the plan was read by plain rules"
  if (draft.items.length >= 4 || draft.items.some((i) => i.subtasks.length)) return "a big plan"
  if (draft.items.some((i) => i.link?.kind === "task" && !i.link.confirmed)) return "a task link nobody confirmed"
  return null
}

export interface CriticInput {
  draft: Draft
  call: ModelCall | null
  /** The `critic` crew ladder, smallest first (`lib/bim-flow/crew.ts`). */
  ladder: string[]
  /** Models that passed the bench. Defaults to the stored gate. */
  ready?: (model: string) => boolean
  maxMs?: number
  /** Run the model even when the free checks say it cannot add anything. For the bench only. */
  force?: boolean
}

const codeOnly = (findings: Finding[], t0: number, skipped?: string): Critique => ({
  verdict: verdictOf(findings, "code-only"),
  findings,
  trust: "code-only",
  hops: [],
  ms: Date.now() - t0,
  ...(skipped ? { skipped } : {}),
})

export async function critiqueWithModel(input: CriticInput): Promise<Critique> {
  const t0 = Date.now()
  const { draft } = input
  const code = planChecks(draft)
  const reason = input.force && !code.some((x) => x.strength === "certain") ? "forced" : modelReason(draft, code)
  if (!reason) return codeOnly(code, t0, code.some((x) => x.strength === "certain") ? "the free checks already failed it" : "nothing for a model to add")
  if (!input.call || !input.ladder.length) return codeOnly(code, t0, "no model reachable")

  const ready = input.ready ?? ((m: string) => isReady(HOST, m))
  const able = input.ladder.filter(ready)
  if (!able.length) return codeOnly(code, t0, "no model has passed the bench for the second look yet")
  // Independence: prefer rungs that are not the planner's own model.
  const apart = able.filter((m) => m !== draft.model)
  const rungs = (apart.length ? apart : able).slice(0, MAX_RUNGS)
  const trust: Critique["trust"] = apart.length ? "full" : "same-model"

  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), input.maxMs ?? DEFAULT_MAX_MS)
  })
  const run = escalate<unknown>(
    input.call,
    rungs,
    { system: CRITIC_SYSTEM, user: criticUser(draft), schema: CRITIC_SCHEMA, maxTokens: 500 },
    (out) => {
      if (wasUnsure(out)) return "the critic was unsure"
      const model = keepQuoted(findingsOf(out, draft.items), draft.source)
      return code.length && !model.length ? "the critic found nothing where the free checks had a doubt" : null
    },
  )
  const res = await Promise.race([run, timeout]).finally(() => clearTimeout(timer))
  if (res === "timeout") return codeOnly(code, t0, "the second look took too long")
  if (!res.out) return codeOnly(code, t0, "the model gave no usable answer")

  const seen = new Set(code.map((x) => `${x.kind}:${x.where}`))
  const model = keepQuoted(findingsOf(res.out, draft.items), draft.source).filter((x) => !seen.has(`${x.kind}:${x.where}`))
  const findings = [...code, ...model]
  return {
    verdict: verdictOf(findings, trust),
    findings,
    trust,
    model: res.hops[res.hops.length - 1]?.model,
    hops: res.hops,
    ms: Date.now() - t0,
  }
}

/** The Critique as lines for a Trace or the card's quiet footer. */
export function traceLines(c: Critique): string[] {
  const lines = [c.skipped ? `Second look: free checks only (${c.skipped}).` : `Second look: free checks, then ${c.model ?? "a model"} (${c.trust}).`]
  for (const h of c.hops) lines.push(`  ${h.model}: ${(h.ms / 1000).toFixed(1)}s${h.why ? `, climbed because ${h.why}` : ""}`)
  lines.push(`  ${c.findings.length} finding(s) → ${c.verdict}.`)
  return lines
}
