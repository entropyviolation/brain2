/**
 * lib/agents/adapters/food-bimby.ts — The Food BIMBY, seen as a Blueprint
 *
 * One built pipeline: read what was eaten, look up each part, file it on the Food book. Code: `lib/food-bimby/`.
 */

import type { Blueprint, NamedPipeline, PipelineStage } from "../blueprint"

export const FOOD_BIMBY_ID = "food-bimby"

export const FOOD_LOG_STAGES: PipelineStage[] = [
  { id: "notice", label: "Notice", cost: "code", does: "Takes a line that asks for food tracking or nutrition, or names eating and two foods." },
  { id: "read", label: "Read", cost: "local-model", does: "Turns the line into meals: day, dish or drink, homemade or bought, each part with grams and a per-100 g guess. Planned food is kept apart. With no model, code splits the line into foods." },
  { id: "research", label: "Look up", cost: "code", does: "Each part: saved foods and the catalog, then USDA FoodData Central, then Open Food Facts. Up to four records that share the part's words, sit near the guessed calories and agree on cooked or raw." },
  { id: "judge", label: "Judge", cost: "local-model", does: "One call picks the record that is the same food for each part, or none. With none, the guess is used and marked estimate." },
  { id: "file", label: "File", cost: "code", does: "One Food book intake per meal, with an accepted plate and its nutrient snapshot. A homemade dish is saved as a recipe card and the plate is the servings eaten. Undo takes the run back for 30 minutes." },
]

export const FOOD_BIMBY_PIPELINES: NamedPipeline[] = [
  { id: "log-food-line", name: "Log what I ate", does: "A loose line about meals and drinks is looked up and filed with full nutrition.", status: "built", stages: FOOD_LOG_STAGES, asTool: "log-food-line" },
  { id: "food-photo", name: "Log a meal photo", does: "A photo of a plate or a label is read into the same meals.", status: "planned", stages: [] },
]

export function foodBimbyBlueprint(): Blueprint {
  return {
    id: FOOD_BIMBY_ID,
    name: "Food BIMBY",
    owner: "house",
    rev: "1",
    purpose: "Turns what you say you ate into Food book entries with researched nutrition, and keeps a homemade dish as a recipe card.",
    senses: ["message"],
    memory: { reads: ["semantic"], writes: ["episodic", "semantic"] },
    tools: [
      { name: "log-food-line", writes: true },
      { name: "food-search", writes: false },
    ],
    skills: [],
    models: { ladders: {}, pinned: {}, localOnly: true },
    limits: { maxCalls: 1 },
    door: { proposes: ["food-intake", "plate", "recipe"], surface: "food-bimby" },
    checks: [],
    mind: { kind: "pipeline", stages: FOOD_LOG_STAGES, pipelines: FOOD_BIMBY_PIPELINES },
  }
}
