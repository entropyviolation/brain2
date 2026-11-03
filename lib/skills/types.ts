/**
 * lib/skills/types.ts — A skill, an experience, and a bank of skills
 *
 * From SkillRL (`docs/SKILLRL_RESEARCH.md`): an agent keeps short principles distilled from what happened, not the
 * raw runs. A skill only ever changes a prompt. It never writes, so the accept door and the guards are untouched.
 */

/** General skills ride in every call. Task skills are picked per input. */
export type SkillKind = "general" | "task"

/** `proposed` waits for a person. Only `active` skills reach a prompt. */
export type SkillStatus = "active" | "proposed" | "retired"

export type SkillSource = "hand" | "distilled" | "evolved"

export interface Skill {
  id: string
  name: string
  /** What to do, in one or two plain sentences. For a failure lesson: the mistake, the better move, how to prevent it. */
  principle: string
  /** The situation where it applies. Retrieval reads this. */
  whenToApply: string
  kind: SkillKind
  /** The part of the agent it concerns, such as `wire:vague-edge` or `lists:names`. Task skills are grouped by it. */
  category: string
  status: SkillStatus
  source: SkillSource
  /** Ids of the experiences it was made from. */
  from: string[]
  uses: number
  wins: number
}

/** The person's reaction to a proposal, as a number: 1 tweaked it, 2 rejected it, 3 it was rolled back. */
export type Severity = 1 | 2 | 3

export interface Experience {
  id: string
  agentId: string
  at: number
  /** Same vocabulary as `Skill.category`. */
  category: string
  /** The line the person gave the agent. */
  input: string
  outcome: "success" | "failure"
  severity: Severity
  /** What the agent did, short. */
  chose: string
  /** What the person did instead, short. Empty on a success or when they only rejected it. */
  should?: string
  /** Ids of the skills that were in the prompt. */
  skillsUsed: string[]
}

export interface SkillBank {
  agentId: string
  skills: Skill[]
}

export const MAX_SKILLS = 100
