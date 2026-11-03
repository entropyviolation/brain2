/**
 * lib/skills/learn.ts — Record a reaction and credit the skills that were in the prompt
 *
 * The one impure seam between an agent's surface and the bank: append the experience, then add a use (and a win on an
 * accept) to every skill that rode in the prompt. Per device, never throws.
 */

import { recordUse, loadBank, saveBank } from "./bank"
import { appendExperience, loadExperiences, makeExperience, saveExperiences, type Reaction } from "./experience"
import type { Experience, Skill } from "./types"

export function recordReaction(r: Reaction, seeds: Skill[] = [], storage?: Storage): Experience {
  const e = makeExperience(r)
  try {
    saveExperiences(r.agentId, appendExperience(loadExperiences(r.agentId, storage), e), storage)
    if (r.skillsUsed.length) saveBank(recordUse(loadBank(r.agentId, seeds, storage), r.skillsUsed, e.outcome === "success"), storage)
  } catch {
    // The reaction still happened; it just will not be remembered.
  }
  return e
}
