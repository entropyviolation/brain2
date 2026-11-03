/**
 * lib/skills/bank.ts — The skill bank: pick skills for an input, show them to a model, keep the bank small
 *
 * General skills are always picked. Task skills are scored against the input and the top few above a floor are
 * kept (the paper uses embedding similarity, δ = 0.4, K = 6; here it is word overlap, behind `Scorer`, so a local
 * embedding model can replace it). A hand-written skill is never pruned. The bank is saved per device and per agent
 * the way the Lists chat history is: reads and writes never throw.
 */

import { MAX_SKILLS, type Skill, type SkillBank } from "./types"

const STOP = new Set("a an and are as at be but by do for from how i in is it its my of on or so that the then this to was were what when which with you your not no if".split(" "))

/** Lowercase words without filler, with a trailing plural "s" dropped. */
export function wordsOf(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? []).filter((w) => w.length > 1 && !STOP.has(w)).map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w))
}

export type Scorer = (query: string, skill: Skill) => number

/** Cosine of two word sets: shared words over the square root of the product of their sizes. 0 to 1. */
export const overlapScore: Scorer = (query, skill) => {
  const q = new Set(wordsOf(query))
  const s = new Set(wordsOf(`${skill.name} ${skill.whenToApply} ${skill.category.replace(/[:_-]/g, " ")}`))
  if (!q.size || !s.size) return 0
  let shared = 0
  for (const w of q) if (s.has(w)) shared++
  return shared / Math.sqrt(q.size * s.size)
}

export interface Picked {
  general: Skill[]
  task: Skill[]
}

export interface PickOptions {
  /** Most task skills to keep. */
  k?: number
  /** Lowest score a task skill may have. */
  floor?: number
  scorer?: Scorer
  /** A task skill in this category is always a candidate, with a small boost. */
  category?: string
}

export const DEFAULT_K = 6
/** Lexical overlap runs lower than embedding similarity, so the floor is lower than the paper's 0.4. */
export const DEFAULT_FLOOR = 0.12

export function pickSkills(bank: SkillBank, query: string, opts: PickOptions = {}): Picked {
  const { k = DEFAULT_K, floor = DEFAULT_FLOOR, scorer = overlapScore, category } = opts
  const live = bank.skills.filter((s) => s.status === "active")
  const task = live
    .filter((s) => s.kind === "task")
    .map((s) => ({ s, score: scorer(query, s) + (category && s.category === category ? 0.2 : 0) }))
    .filter((x) => x.score >= floor)
    .sort((a, b) => b.score - a.score || b.s.wins - a.s.wins)
    .slice(0, k)
    .map((x) => x.s)
  return { general: live.filter((s) => s.kind === "general"), task }
}

export const idsOf = (pick: Picked): string[] => [...pick.general, ...pick.task].map((s) => s.id)

/** The block a model reads. Empty when nothing was picked, so a bank with nothing in it changes no prompt. */
export function renderSkills(pick: Picked): string {
  const line = (s: Skill) => `- ${s.name}: ${s.principle} (when: ${s.whenToApply})`
  const parts: string[] = []
  if (pick.general.length) parts.push(`GENERAL SKILLS\n${pick.general.map(line).join("\n")}`)
  if (pick.task.length) parts.push(`SKILLS FOR THIS INPUT\n${pick.task.map(line).join("\n")}`)
  return parts.join("\n\n")
}

const sameIdea = (a: Skill, b: Skill) => {
  const x = new Set(wordsOf(`${a.name} ${a.principle}`))
  const y = new Set(wordsOf(`${b.name} ${b.principle}`))
  if (!x.size || !y.size) return false
  let shared = 0
  for (const w of x) if (y.has(w)) shared++
  return shared / Math.min(x.size, y.size) >= 0.8
}

/** True when an existing skill (live or waiting) already says this. */
export const isKnown = (bank: SkillBank, skill: Skill): boolean => bank.skills.some((s) => s.id === skill.id || (s.status !== "retired" && sameIdea(s, skill)))

/** Add a skill unless the bank already has it. Past the cap, the weakest non-hand skill goes first. */
export function addSkill(bank: SkillBank, skill: Skill, cap = MAX_SKILLS): SkillBank {
  if (isKnown(bank, skill)) return bank
  let skills = [...bank.skills, skill]
  while (skills.length > cap) {
    const drop = skills
      .filter((s) => s.source !== "hand" && s.id !== skill.id)
      .sort((a, b) => rate(a) - rate(b) || a.uses - b.uses)[0]
    if (!drop) break
    skills = skills.filter((s) => s !== drop)
  }
  return { ...bank, skills }
}

/** Wins over uses; a skill never used counts as 0.5 so it is not dropped before it had a chance. */
export const rate = (s: Skill): number => (s.uses ? s.wins / s.uses : 0.5)

export function setStatus(bank: SkillBank, id: string, status: Skill["status"]): SkillBank {
  return { ...bank, skills: bank.skills.map((s) => (s.id === id ? { ...s, status } : s)) }
}

export function editSkill(bank: SkillBank, id: string, patch: Partial<Pick<Skill, "name" | "principle" | "whenToApply">>): SkillBank {
  return { ...bank, skills: bank.skills.map((s) => (s.id === id ? { ...s, ...patch } : s)) }
}

/** Credit the skills that were in a prompt: every one used, and a win when the person accepted the result. */
export function recordUse(bank: SkillBank, ids: string[], won: boolean): SkillBank {
  if (!ids.length) return bank
  const set = new Set(ids)
  return { ...bank, skills: bank.skills.map((s) => (set.has(s.id) ? { ...s, uses: s.uses + 1, wins: s.wins + (won ? 1 : 0) } : s)) }
}

export const proposedIn = (bank: SkillBank): Skill[] => bank.skills.filter((s) => s.status === "proposed")

// ── Saved bank (this device only) ────────────────────────────────────────────────────────────────

export const bankKey = (agentId: string) => `skillbank:${agentId}`

/**
 * The saved bank, with the agent's shipped seeds merged in: a seed that is missing is added, and a seed the
 * person edited or retired stays as they left it. Learned skills are kept as they were.
 */
export function loadBank(agentId: string, seeds: Skill[], storage: Pick<Storage, "getItem"> | undefined = safeStorage()): SkillBank {
  let saved: Skill[] = []
  try {
    const raw = storage?.getItem(bankKey(agentId))
    const parsed = raw ? (JSON.parse(raw) as Partial<SkillBank>) : null
    if (parsed && Array.isArray(parsed.skills)) saved = parsed.skills.filter((s): s is Skill => !!s && typeof s.id === "string" && typeof s.principle === "string")
  } catch {
    saved = []
  }
  const have = new Set(saved.map((s) => s.id))
  return { agentId, skills: [...seeds.filter((s) => !have.has(s.id)), ...saved] }
}

export function saveBank(bank: SkillBank, storage: Pick<Storage, "setItem"> | undefined = safeStorage()): void {
  try {
    storage?.setItem(bankKey(bank.agentId), JSON.stringify({ agentId: bank.agentId, skills: bank.skills }))
  } catch {
    // Quota or a private window: the bank still works, it just will not be remembered.
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage
  } catch {
    return undefined
  }
}
