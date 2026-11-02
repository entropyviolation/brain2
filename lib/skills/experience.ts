/**
 * lib/skills/experience.ts — What happened to an agent's proposals, kept small
 *
 * One row per person reaction: accepted (a success), or tweaked / rejected / rolled back (a failure, with how bad).
 * That is the reward signal. No model judges it. The newest rows stay; reads and writes never throw.
 */

import type { Experience, Severity } from "./types"

export const MAX_EXPERIENCES = 300
export const experienceKey = (agentId: string) => `skillexp:${agentId}`

let seq = 0

export interface Reaction {
  agentId: string
  category: string
  input: string
  chose: string
  skillsUsed: string[]
  /** Set for a failure. */
  severity?: Severity
  should?: string
}

export function makeExperience(r: Reaction, now = Date.now()): Experience {
  return {
    id: `exp-${now.toString(36)}-${(seq++).toString(36)}`,
    agentId: r.agentId,
    at: now,
    category: r.category,
    input: r.input.slice(0, 400),
    outcome: r.severity ? "failure" : "success",
    severity: r.severity ?? 1,
    chose: r.chose.slice(0, 200),
    should: r.should?.slice(0, 200),
    skillsUsed: r.skillsUsed,
  }
}

export function appendExperience(list: Experience[], e: Experience, cap = MAX_EXPERIENCES): Experience[] {
  return [...list, e].slice(-cap)
}

export function loadExperiences(agentId: string, storage: Pick<Storage, "getItem"> | undefined = safeStorage()): Experience[] {
  try {
    const raw = storage?.getItem(experienceKey(agentId))
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    return Array.isArray(parsed) ? parsed.filter((e): e is Experience => !!e && typeof (e as Experience).id === "string" && typeof (e as Experience).category === "string") : []
  } catch {
    return []
  }
}

export function saveExperiences(agentId: string, list: Experience[], storage: Pick<Storage, "setItem"> | undefined = safeStorage()): void {
  try {
    storage?.setItem(experienceKey(agentId), JSON.stringify(list.slice(-MAX_EXPERIENCES)))
  } catch {
    // Quota or a private window.
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage
  } catch {
    return undefined
  }
}
