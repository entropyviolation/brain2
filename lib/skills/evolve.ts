/**
 * lib/skills/evolve.ts — Grow the bank only where the agent is weak
 *
 * The paper's loop, kept small. Count the success rate per category. Only a category under the bar gets new skills.
 * Take its failures with variety (group by category, worst first, round-robin so one noisy category cannot crowd out
 * the rest). Distill them: with a local model when one is given, otherwise with the plain-code lessons. The result is
 * a list of `proposed` skills for a person to accept. Nothing here writes to a bank or to storage.
 */

import type { ModelCall } from "@/lib/bim-flow/ollama"
import { isKnown } from "./bank"
import { distillWithModel, lessonsOf } from "./distill"
import type { Experience, Skill, SkillBank } from "./types"

export interface CategoryStat {
  category: string
  n: number
  success: number
  rate: number
}

export function statsByCategory(list: Experience[]): CategoryStat[] {
  const by = new Map<string, CategoryStat>()
  for (const e of list) {
    // A neutral accept is neither right nor wrong; it stays out of the rate.
    if (e.outcome === "neutral") continue
    const s = by.get(e.category) ?? { category: e.category, n: 0, success: 0, rate: 0 }
    s.n++
    if (e.outcome === "success") s.success++
    by.set(e.category, s)
  }
  return [...by.values()].map((s) => ({ ...s, rate: s.success / s.n })).sort((a, b) => a.rate - b.rate || b.n - a.n)
}

export interface WeakOptions {
  /** A category under this success rate needs new skills. */
  below?: number
  /** Fewer cases than this is too little to learn from. */
  minCases?: number
}

export const weakCategories = (list: Experience[], { below = 0.8, minCases = 3 }: WeakOptions = {}): CategoryStat[] => statsByCategory(list).filter((s) => s.n >= minCases && s.rate < below)

/** Failures from the weak categories, worst first within each, taken in turn from each category until `limit`. */
export function sampleFailures(list: Experience[], weak: CategoryStat[], limit = 12): Experience[] {
  const queues = weak.map((w) =>
    list
      .filter((e) => e.category === w.category && e.outcome === "failure")
      .sort((a, b) => b.severity - a.severity || b.at - a.at),
  )
  const out: Experience[] = []
  for (let i = 0; out.length < limit && queues.some((q) => i < q.length); i++) {
    for (const q of queues) if (q[i] && out.length < limit) out.push(q[i]!)
  }
  return out
}

export interface EvolveInput {
  experiences: Experience[]
  bank: SkillBank
  /** A local model. Without one, only the plain-code lessons are written. */
  call?: ModelCall | null
  ladder?: string[]
  weak?: WeakOptions
  limit?: number
}

export interface Evolved {
  weak: CategoryStat[]
  sampled: Experience[]
  proposals: Skill[]
  model?: string
  /** Why the plain lessons answered instead of a model, when they did. */
  fallback?: string
}

export async function evolve(input: EvolveInput): Promise<Evolved> {
  const { experiences, bank, call = null, ladder = [] } = input
  const weak = weakCategories(experiences, input.weak)
  const sampled = sampleFailures(experiences, weak, input.limit)
  if (!sampled.length) return { weak, sampled, proposals: [] }
  const fresh = (skills: Skill[]) => {
    const kept: Skill[] = []
    for (const s of skills) if (!isKnown({ ...bank, skills: [...bank.skills, ...kept] }, s)) kept.push(s)
    return kept
  }
  let fallback: string | undefined
  if (call && ladder.length) {
    const d = await distillWithModel(call, ladder, sampled, bank.skills).catch(() => null)
    const proposals = d ? fresh(d.skills) : []
    if (proposals.length) return { weak, sampled, proposals, model: d?.model }
    fallback = d ? "the model wrote nothing new" : "the model failed"
  } else fallback = call ? "no model installed" : "no model reachable"
  return { weak, sampled, proposals: fresh(lessonsOf(sampled)), fallback }
}

/** Put proposals into a bank (as `proposed`). Known ones are skipped. */
export function withProposals(bank: SkillBank, proposals: Skill[]): SkillBank {
  let skills = bank.skills
  for (const p of proposals) if (!isKnown({ ...bank, skills }, p)) skills = [...skills, { ...p, status: "proposed" }]
  return { ...bank, skills }
}
