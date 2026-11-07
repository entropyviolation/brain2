/**
 * lib/agents/adapters/skills-evolve.ts — The Skills evolver, seen as a Blueprint
 *
 * One built pipeline, "Grow the skill bank where an agent is weak": STATS (code) → SAMPLE (code) → DISTILL (model, or code lessons) → PROPOSE (person accepts).
 * Code: `lib/skills/` (`evolve.ts`, `distill.ts`, `bank.ts`). Its lab is `/lab/skills-evolve`.
 */

import type { Blueprint, NamedPipeline, PipelineStage } from "../blueprint"

export const SKILLS_EVOLVE_HREF = "/lab/skills-evolve"
export const SKILLS_EVOLVE_ID = "skills-evolve"

export const SKILLS_EVOLVE_STAGES: PipelineStage[] = [
  { id: "stats", label: "Stats", cost: "code", does: "Counts the success rate per category of experience. Only a category under the bar gets new skills." },
  { id: "sample", label: "Sample", cost: "code", does: "Takes the failures with variety: grouped by category, worst first, round-robin so one noisy category cannot crowd out the rest." },
  { id: "distill", label: "Distill", cost: "local-model", does: "A small local model reads a handful of experiences and writes general skills, one rung at a time. Without a model, plain code turns each corrected failure into one lesson." },
  { id: "propose", label: "Propose", cost: "code", does: "Everything comes back proposed and known skills are dropped. Nothing reaches a prompt until a person accepts it." },
]

export const SKILLS_EVOLVE_PIPELINES: NamedPipeline[] = [
  { id: "evolve-skill-bank", name: "Grow the bank where weak", does: "Turns what went wrong into proposed skills for the agents that are weak in a category.", status: "built", stages: SKILLS_EVOLVE_STAGES, asTool: "evolve-skill-bank" },
]

export function skillsEvolveBlueprint(): Blueprint {
  return {
    id: SKILLS_EVOLVE_ID,
    name: "Skills evolver",
    owner: "house",
    rev: "1",
    purpose: "Reads what agents got wrong and right, and proposes new skills only where an agent is weak. A person accepts or drops each one.",
    senses: ["event"],
    memory: { reads: ["episodic", "procedural"], writes: [] },
    tools: [{ name: "evolve-skill-bank", writes: false }],
    skills: [],
    models: { ladders: {}, pinned: {}, localOnly: true },
    limits: {},
    door: { proposes: ["skill"], surface: "skills" },
    checks: [],
    mind: { kind: "pipeline", stages: SKILLS_EVOLVE_STAGES, pipelines: SKILLS_EVOLVE_PIPELINES },
  }
}
