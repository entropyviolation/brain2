/**
 * lib/critic-bimby/verdict.ts — Findings in, one verdict out (pure)
 *
 * Any certain finding fails. A code hint is a warning. Model hints count only with a quote that is really in the
 * line: one is a warning, two fail. A critic that shares the planner's model can warn but never fail on its own.
 */

import { planChecks } from "./checks-plan"
import type { Critique, Finding, Verdict } from "./types"
import type { PlanDraft } from "@/lib/plan-bimby/types"

/** Drop model findings whose quote is not in the line. A finding with no quote is dropped too. */
export function keepQuoted(findings: Finding[], source: string): Finding[] {
  const hay = source.toLowerCase().replace(/\s+/g, " ")
  return findings.filter((x) => x.by === "code" || (x.quote && hay.includes(x.quote.toLowerCase().replace(/\s+/g, " ").trim())))
}

export function verdictOf(findings: Finding[], trust: Critique["trust"]): Verdict {
  if (!findings.length) return "pass"
  if (findings.some((x) => x.by === "code" && x.strength === "certain")) return "fail"
  const model = findings.filter((x) => x.by === "model")
  if (trust !== "same-model" && model.some((x) => x.strength === "certain")) return "fail"
  if (trust !== "same-model" && model.length >= 2) return "fail"
  return "warn"
}

/** The second look with no model: the free checks, one verdict. */
export function critiquePlan(draft: Pick<PlanDraft, "items" | "remarks" | "source">): Critique {
  const t0 = Date.now()
  const findings = planChecks(draft)
  return { verdict: verdictOf(findings, "code-only"), findings, trust: "code-only", hops: [], ms: Date.now() - t0 }
}
