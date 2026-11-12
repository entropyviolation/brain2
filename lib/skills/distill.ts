/**
 * lib/skills/distill.ts — Turn what happened into skills
 *
 * Two ways, same output. `lessonOf` is plain code: one failure the person corrected becomes one failure lesson
 * (the mistake, the better move, how to prevent it) with no model. `distillWithModel` asks a small local model, one
 * rung at a time, to read a handful of experiences (failures and successes) and write general skills. Everything
 * comes back `proposed`; nothing reaches a prompt until a person accepts it.
 */

import { escalate } from "@/lib/bim-flow/crew"
import type { ModelCall } from "@/lib/bim-flow/ollama"
import type { Experience, Skill } from "./types"

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)

/** A stable id from the category and the words, so the same lesson twice is one skill. */
export const skillId = (category: string, name: string) => `${slug(category)}.${slug(name)}`

/** One failure lesson from one correction. Null when the person gave no better move, because then there is nothing to teach. */
export function lessonOf(e: Experience): Skill | null {
  if (e.outcome !== "failure" || !e.should?.trim() || !e.chose.trim()) return null
  const name = `${e.category}: ${clip(e.chose, 28)} → ${clip(e.should, 28)}`
  return {
    id: skillId(e.category, name),
    name,
    principle: `Mistake: "${clip(e.chose, 80)}". Better: "${clip(e.should, 80)}". Check this before answering a line like: "${clip(e.input, 80)}".`,
    whenToApply: clip(e.input, 120),
    kind: "task",
    category: e.category,
    status: "proposed",
    source: "distilled",
    from: [e.id],
    uses: 0,
    wins: 0,
  }
}

/** Deterministic lessons for every correctable failure, one per distinct skill. */
export function lessonsOf(list: Experience[]): Skill[] {
  const seen = new Map<string, Skill>()
  for (const e of list) {
    const s = lessonOf(e)
    if (!s) continue
    const prior = seen.get(s.id)
    seen.set(s.id, prior ? { ...prior, from: [...prior.from, ...s.from] } : s)
  }
  return [...seen.values()]
}

// ── With a model ─────────────────────────────────────────────────────────────────────────────────

export const DISTILL_SYSTEM =
  "You write skills for a small assistant that files what a person tells it. A skill is a short, reusable rule drawn from what happened, never a copy of one case. " +
  "You are given recent cases: each has the CATEGORY, the INPUT, what the assistant DID, what the person did INSTEAD (failures), and the OUTCOME. " +
  "For a failure, write a failure lesson in the principle: the mistake, the better move, and how to prevent it, in at most two sentences. " +
  "For several successes of one kind, write one strategy skill that says what worked. " +
  "Make each skill general enough to help on a different input in the same category. whenToApply says the situation in plain words. " +
  "kind is general when it applies to every input, task when it applies to one category. Do not repeat an existing skill. Write nothing when the cases teach nothing."

export function distillSchema(maxSkills: number): Record<string, unknown> {
  return {
    type: "object",
    required: ["skills"],
    properties: {
      skills: {
        type: "array",
        maxItems: maxSkills,
        items: {
          type: "object",
          required: ["name", "principle", "whenToApply", "kind", "category"],
          properties: {
            name: { type: "string", maxLength: 60 },
            principle: { type: "string", maxLength: 260 },
            whenToApply: { type: "string", maxLength: 140 },
            kind: { type: "string", enum: ["general", "task"] },
            category: { type: "string", maxLength: 40 },
          },
        },
      },
    },
  }
}

export function distillUser(list: Experience[], existing: Skill[]): string {
  const cases = list
    .filter((e) => e.outcome !== "neutral")
    .map((e, i) => `CASE ${i + 1}\nCATEGORY: ${e.category}\nINPUT: ${clip(e.input, 200)}\nDID: ${e.chose}\n${e.should ? `INSTEAD: ${e.should}\n` : ""}OUTCOME: ${e.outcome}`)
    .join("\n\n")
  const have = existing.length ? `\n\nEXISTING SKILLS (do not repeat)\n${existing.map((s) => `- ${s.name}`).join("\n")}` : ""
  return `${cases}${have}`
}

export interface Distilled {
  skills: Skill[]
  model?: string
  hops: { model: string; ms: number; why?: string }[]
}

interface RawSkills {
  skills?: { name?: unknown; principle?: unknown; whenToApply?: unknown; kind?: unknown; category?: unknown }[]
}

/** Keep only well-formed skills, tagged with the experiences they came from. */
export function cleanSkills(out: unknown, list: Experience[]): Skill[] {
  const raw = (out as RawSkills | null)?.skills
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const skills: Skill[] = []
  for (const r of raw) {
    const name = typeof r.name === "string" ? r.name.trim() : ""
    const principle = typeof r.principle === "string" ? r.principle.trim() : ""
    const when = typeof r.whenToApply === "string" ? r.whenToApply.trim() : ""
    if (!name || !principle || !when) continue
    const kind = r.kind === "general" ? "general" : "task"
    const category = typeof r.category === "string" && r.category.trim() ? r.category.trim() : (list[0]?.category ?? "general")
    const id = skillId(category, name)
    if (seen.has(id)) continue
    seen.add(id)
    skills.push({ id, name, principle, whenToApply: when, kind, category, status: "proposed", source: "evolved", from: list.filter((e) => e.category === category).map((e) => e.id), uses: 0, wins: 0 })
  }
  return skills
}

export async function distillWithModel(call: ModelCall, ladder: string[], list: Experience[], existing: Skill[], maxSkills = 4): Promise<Distilled> {
  if (!list.length || !ladder.length) return { skills: [], hops: [] }
  const { out, hops } = await escalate<RawSkills>(
    call,
    ladder,
    { system: DISTILL_SYSTEM, user: distillUser(list, existing), schema: distillSchema(maxSkills), maxTokens: 700 },
    (o) => (cleanSkills(o, list).length ? null : "no skills written"),
  )
  return { skills: cleanSkills(out, list), model: hops[hops.length - 1]?.model, hops }
}
