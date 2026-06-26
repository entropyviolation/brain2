/**
 * lib/completion-tiers.ts — Tiered completion & reward levels (points ladder)
 *
 * Lets a task-type item define three levels of "done" instead of a single goal:
 *   - **bare minimum** — did *something* at all (small reward)
 *   - **goal** — the intended target (normal reward)
 *   - **exceptional** — well beyond target (large reward, + per-unit bonus)
 *
 * Rather than invent a parallel data structure, a tier set is just a handful of
 * ordinary schema attributes plus one **formula** attribute that computes the
 * earned points. This keeps everything inside the existing attribute + formula +
 * points engine, and — because the formula and its rule ladder are shown in the
 * UI — doubles as a worked example that teaches users to author their own
 * formulas/rules (spec §5 formulas, §14 points/rewards).
 *
 * Example (a daily "read" habit, units = pages):
 *   bare minimum = 1, goal = 5, exceptional = 20
 *   points = IF(current ≥ 20, 50 + (current − 20),  ← exceptional + 1/extra page
 *               IF(current ≥ 5, 10,                  ← goal
 *                  IF(current ≥ 1, 1, 0)))           ← bare minimum / none
 *
 * Everything here is pure + serializable so the same logic works in the browser,
 * a server, or another app, and is easy to unit test.
 */
import type { AttributeDefinition, AttributeValue } from "@/lib/types"
import { computeFormulaValue } from "@/lib/formula"

/** Stable attribute ids that make up a completion-tier set. */
export const TIER_ATTR_IDS = {
  bareMin: "tier_bare_min",
  goal: "tier_goal",
  exceptional: "tier_exceptional",
  units: "tier_units",
  current: "tier_current",
  /** The computed points attribute (formula). */
  points: "points",
} as const

/**
 * Reward values baked into the generated points formula. Kept here (rather than
 * inline in the expression string) so the formula text and the plain-language
 * rule explainer always agree, and so the constants are easy to tweak.
 */
export const TIER_POINTS = {
  /** Points for clearing the bare-minimum threshold. */
  bareMin: 1,
  /** Points for clearing the goal threshold. */
  goal: 10,
  /** Points for clearing the exceptional threshold. */
  exceptional: 50,
  /** Extra points per unit beyond the exceptional threshold. */
  bonusPerUnit: 1,
} as const

/** Default thresholds for a freshly added tier set (the "read 5 pages" example). */
export const DEFAULT_TIER_THRESHOLDS = {
  bareMin: 1,
  goal: 5,
  exceptional: 20,
} as const

/**
 * Build the points formula expression from the tier threshold attribute ids and
 * the {@link TIER_POINTS} constants. Written generically (references the
 * thresholds rather than literal page counts) so editing a threshold attribute
 * keeps the ladder correct — e.g. with `exceptional = 20` this reduces to the
 * "30 + current" form, but it stays self-consistent if the user retunes it.
 */
export function buildPointsFormula(): string {
  const { bareMin, goal, exceptional, current } = TIER_ATTR_IDS
  const p = TIER_POINTS
  const bonus =
    p.bonusPerUnit === 1
      ? `(${current} - ${exceptional})`
      : `(${current} - ${exceptional}) * ${p.bonusPerUnit}`
  return (
    `=IF(${current} >= ${exceptional}, ${p.exceptional} + ${bonus}, ` +
    `IF(${current} >= ${goal}, ${p.goal}, ` +
    `IF(${current} >= ${bareMin}, ${p.bareMin}, 0)))`
  )
}

/**
 * The attribute schema for a completion-tier set: three numeric thresholds, a
 * free-text unit, the current progress (default 0), and the computed points
 * formula. Append these to a list/type schema to opt an item into tiered
 * completion. Ids are stable so the set can be detected/removed later.
 */
export function buildCompletionTierAttributes(unit = "pages"): AttributeDefinition[] {
  return [
    { id: TIER_ATTR_IDS.bareMin, name: "Bare minimum", type: "number", unit, allowFloat: false },
    { id: TIER_ATTR_IDS.goal, name: "Goal", type: "number", unit, allowFloat: false },
    { id: TIER_ATTR_IDS.exceptional, name: "Exceptional", type: "number", unit, allowFloat: false },
    { id: TIER_ATTR_IDS.units, name: "Units", type: "string" },
    { id: TIER_ATTR_IDS.current, name: "Current", type: "number", unit, allowFloat: false },
    { id: TIER_ATTR_IDS.points, name: "Points", type: "formula", formula: buildPointsFormula(), formatAs: "number" },
  ]
}

/** Default attribute values seeded alongside {@link buildCompletionTierAttributes}. */
export function defaultCompletionTierValues(unit = "pages"): Record<string, AttributeValue> {
  return {
    [TIER_ATTR_IDS.bareMin]: DEFAULT_TIER_THRESHOLDS.bareMin,
    [TIER_ATTR_IDS.goal]: DEFAULT_TIER_THRESHOLDS.goal,
    [TIER_ATTR_IDS.exceptional]: DEFAULT_TIER_THRESHOLDS.exceptional,
    [TIER_ATTR_IDS.units]: unit,
    [TIER_ATTR_IDS.current]: 0,
  }
}

/** True when a schema already contains the tier set (avoids duplicate inserts). */
export function hasCompletionTiers(defs: AttributeDefinition[] | undefined): boolean {
  if (!defs?.length) return false
  const ids = new Set(defs.map((d) => d.id))
  return ids.has(TIER_ATTR_IDS.bareMin) && ids.has(TIER_ATTR_IDS.points)
}

/** Append a tier set to an existing schema, skipping any ids already present. */
export function withCompletionTiers(
  defs: AttributeDefinition[] = [],
  unit = "pages",
): AttributeDefinition[] {
  const present = new Set(defs.map((d) => d.id))
  const additions = buildCompletionTierAttributes(unit).filter((d) => !present.has(d.id))
  return [...defs, ...additions]
}

/** Read a numeric tier value from an item's stored attributes (NaN-safe). */
function num(values: Record<string, AttributeValue> | undefined, id: string, fallback = 0): number {
  const raw = values?.[id]
  if (raw === undefined || raw === null || raw === "") return fallback
  const n = typeof raw === "number" ? raw : Number(raw)
  return Number.isFinite(n) ? n : fallback
}

/** A resolved snapshot of a tier set for display/rule rendering. */
export interface CompletionTierSnapshot {
  bareMin: number
  goal: number
  exceptional: number
  current: number
  unit: string
  points: number
  /** Which level the current value has reached. */
  level: "none" | "bare-minimum" | "goal" | "exceptional"
}

/** The level a `current` value reaches against the thresholds. */
export function tierLevel(
  current: number,
  thresholds: { bareMin: number; goal: number; exceptional: number },
): CompletionTierSnapshot["level"] {
  if (current >= thresholds.exceptional) return "exceptional"
  if (current >= thresholds.goal) return "goal"
  if (current >= thresholds.bareMin) return "bare-minimum"
  return "none"
}

/**
 * Compute the points a tier set yields for a given `current` value by evaluating
 * the actual points formula (so display and awarded points share one code path).
 */
export function computeTierPoints(
  values: Record<string, AttributeValue> | undefined,
  defs?: AttributeDefinition[],
): number {
  const pointsDef =
    defs?.find((d) => d.id === TIER_ATTR_IDS.points && d.type === "formula") ??
    ({ id: TIER_ATTR_IDS.points, name: "Points", type: "formula", formula: buildPointsFormula() } as AttributeDefinition)
  const defsById = new Map<string, AttributeDefinition>(
    (defs ?? buildCompletionTierAttributes()).map((d) => [d.id, d]),
  )
  const result = computeFormulaValue(pointsDef, values ?? {}, defsById)
  return result.value ?? 0
}

/** Resolve a tier snapshot from stored values + (optional) schema. */
export function resolveTierSnapshot(
  values: Record<string, AttributeValue> | undefined,
  defs?: AttributeDefinition[],
): CompletionTierSnapshot {
  const bareMin = num(values, TIER_ATTR_IDS.bareMin, DEFAULT_TIER_THRESHOLDS.bareMin)
  const goal = num(values, TIER_ATTR_IDS.goal, DEFAULT_TIER_THRESHOLDS.goal)
  const exceptional = num(values, TIER_ATTR_IDS.exceptional, DEFAULT_TIER_THRESHOLDS.exceptional)
  const current = num(values, TIER_ATTR_IDS.current, 0)
  const unit = (values?.[TIER_ATTR_IDS.units] as string) || ""
  return {
    bareMin,
    goal,
    exceptional,
    current,
    unit,
    points: computeTierPoints(values, defs),
    level: tierLevel(current, { bareMin, goal, exceptional }),
  }
}

/** One human-readable line of the points rule ladder. */
export interface CompletionRuleLine {
  /** e.g. "≥ 20 pages". */
  condition: string
  /** e.g. "50 pts + 1 pt per extra page". */
  reward: string
  /** The tier this line corresponds to. */
  level: CompletionTierSnapshot["level"]
}

/**
 * Plain-language rule ladder for a tier set, mirroring the points formula. Shown
 * in the UI so users can read the "rules" the formula encodes (and learn to edit
 * them). Highest threshold first, matching the `IF` evaluation order.
 */
export function describeCompletionRules(
  thresholds: { bareMin: number; goal: number; exceptional: number },
  unit = "",
): CompletionRuleLine[] {
  const u = unit ? ` ${unit}` : ""
  const p = TIER_POINTS
  const bonus =
    p.bonusPerUnit > 0
      ? ` + ${p.bonusPerUnit} pt${p.bonusPerUnit === 1 ? "" : "s"} per extra${unit ? ` ${unit.replace(/s$/, "")}` : " unit"}`
      : ""
  return [
    {
      level: "exceptional",
      condition: `≥ ${thresholds.exceptional}${u}`,
      reward: `${p.exceptional} pts${bonus} (exceptional)`,
    },
    { level: "goal", condition: `≥ ${thresholds.goal}${u}`, reward: `${p.goal} pts (goal)` },
    { level: "bare-minimum", condition: `≥ ${thresholds.bareMin}${u}`, reward: `${p.bareMin} pt (bare minimum)` },
    { level: "none", condition: `otherwise`, reward: `0 pts` },
  ]
}
