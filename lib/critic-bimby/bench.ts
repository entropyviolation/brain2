/**
 * lib/critic-bimby/bench.ts — How well does a critic catch known faults, and how often does it cry wolf (pure)
 *
 * Runs a critic over the gold plans (should raise nothing) and over each injected fault (should raise the expected
 * kind). Reports catch rate per fault kind and the false-alarm rate on unbroken plans. `docs/CRITIC_BIMBY_PLAN.md` §5.
 */

import { PLAN_EXAMPLE, cleanPlan } from "@/lib/plan-bimby/parse"
import type { PlanDraft } from "@/lib/plan-bimby/types"
import { faultsFor, gold, type FaultKind, type Gold } from "./inject"
import { critiquePlan } from "./verdict"
import type { Critique, Finding } from "./types"

export type CriticFn = (draft: PlanDraft) => Critique

const sample = cleanPlan(JSON.parse(PLAN_EXAMPLE.json))

export const GOLD: Gold[] = [
  { name: "the sample plan", line: PLAN_EXAMPLE.text, draft: { items: sample.items, remarks: sample.remarks, source: PLAN_EXAMPLE.text, by: "model" } },
  gold("errands", "Plan for rn: do laundry, call mom, then pick up the dry cleaning for 20 min, and write the invoice.", [
    { title: "do laundry" },
    { title: "call mom" },
    { title: "pick up the dry cleaning", minutes: 20 },
    { title: "write the invoice" },
  ]),
  gold("morning", "rn - brew tea, take my vitamins, stretch for 10 minutes, then answer email by noon", [
    { title: "brew tea" },
    { title: "take my vitamins" },
    { title: "stretch", minutes: 10 },
    { title: "answer email", subtasks: [{ title: "answer email", due: "by noon" }] },
  ]),
  gold("work block", "Today: outline the talk, then record the demo (an hour), then upload the video, finally rest", [
    { title: "outline the talk" },
    { title: "record the demo", minutes: 60 },
    { title: "upload the video" },
    { title: "rest" },
  ]),
  gold("with a feeling", "plan: clean the kitchen for 15 minutes, sort the mail, book flights to boston asap. I'm so tired.", [
    { title: "clean the kitchen", minutes: 15 },
    { title: "sort the mail" },
    { title: "book flights to boston", pace: "urgent", paceNote: "asap" },
  ], ["so tired"]),
]

export interface BenchReport {
  /** Gold plans the critic raised anything on, over all gold plans. */
  falseAlarms: { raised: number; of: number; names: string[] }
  /** Gold plans the critic failed (certain), a harsher count. */
  falseFails: number
  byFault: Record<string, { caught: number; of: number }>
  caught: number
  of: number
}

interface BenchCase {
  /** "clean" for an unbroken gold plan, else the fault. */
  fault: FaultKind | "clean"
  name: string
  draft: PlanDraft
  expect?: { kind: Finding["kind"]; where?: string }
}

export function benchCases(set: Gold[] = GOLD): BenchCase[] {
  return set.flatMap((g) => [
    { fault: "clean" as const, name: g.name, draft: g.draft },
    ...faultsFor(g).map((f) => ({ fault: f.fault, name: g.name, draft: f.draft, expect: f.expect })),
  ])
}

export function scoreBench(cases: BenchCase[], critiques: Critique[]): BenchReport {
  const names: string[] = []
  let falseFails = 0
  let clean = 0
  const byFault: BenchReport["byFault"] = {}
  let caught = 0
  let of = 0
  cases.forEach((c, i) => {
    const cr = critiques[i]!
    if (c.fault === "clean") {
      clean++
      if (cr.findings.length) names.push(c.name)
      if (cr.verdict === "fail") falseFails++
      return
    }
    const hit = cr.findings.some((x) => x.kind === c.expect!.kind && (!c.expect!.where || x.where === c.expect!.where || x.where === "plan"))
    const row = (byFault[c.fault] ??= { caught: 0, of: 0 })
    row.of++
    of++
    if (hit) {
      row.caught++
      caught++
    }
  })
  return { falseAlarms: { raised: names.length, of: clean, names }, falseFails, byFault, caught, of }
}

export function runBench(critic: CriticFn = critiquePlan, set: Gold[] = GOLD): BenchReport {
  const cases = benchCases(set)
  return scoreBench(cases, cases.map((c) => critic(c.draft)))
}

/** The same bench for a critic that calls a model. One case at a time, so a local model is not swamped. */
export async function runBenchAsync(critic: (draft: PlanDraft) => Promise<Critique>, set: Gold[] = GOLD, onProgress?: (done: number, total: number) => void): Promise<BenchReport> {
  const cases = benchCases(set)
  const out: Critique[] = []
  for (const c of cases) {
    out.push(await critic(c.draft))
    onProgress?.(out.length, cases.length)
  }
  return scoreBench(cases, out)
}

export function formatBench(r: BenchReport): string {
  const rows = Object.entries(r.byFault).map(([k, v]) => `  ${k.padEnd(16)} ${v.caught}/${v.of}`)
  return [`false alarms on clean plans: ${r.falseAlarms.raised}/${r.falseAlarms.of}${r.falseAlarms.names.length ? ` (${r.falseAlarms.names.join(", ")})` : ""}`, `false fails: ${r.falseFails}`, `caught ${r.caught}/${r.of}`, ...rows].join("\n")
}
