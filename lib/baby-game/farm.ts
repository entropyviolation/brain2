/**
 * lib/baby-game/farm.ts — The calendar, the crops, and the four skills of Valdivia
 *
 * Plain data and small pure helpers; the actions that spend energy and change the bag live in `engine.ts`.
 * A cycle is seven days; four cycles make a year. A crop grows one step each night it was watered (rain waters
 * everything). Crops can only be planted in their own cycles, but they never wilt: nothing here punishes you.
 */

export const CYCLE_LEN = 7
export const CYCLES = ["Lotus Bloom", "High Yang", "Anicca", "Deep Yin"] as const

export const cycleOf = (day: number) => Math.floor((day - 1) / CYCLE_LEN) % CYCLES.length
export const dayOfCycle = (day: number) => ((day - 1) % CYCLE_LEN) + 1
export const cycleName = (day: number) => CYCLES[cycleOf(day)]!

const FESTIVALS = [
  { name: "Petal Parade", blurb: "Everyone throws petals that float instead of fall." },
  { name: "Lantern Float", blurb: "Glowing paper boats drift across the lagoon." },
  { name: "Moss Dance", blurb: "The mushrooms hum and nobody can stand still." },
  { name: "Snowglobe Night", blurb: "The whole sky is a very large, very gentle snow globe." },
] as const

/** The seventh day of each cycle is a festival. */
export function festivalOn(day: number): (typeof FESTIVALS)[number] | null {
  return dayOfCycle(day) === CYCLE_LEN ? FESTIVALS[cycleOf(day)]! : null
}

export type CropDef = {
  id: string
  seed: string
  days: number
  /** Indices into `CYCLES`. */
  cycles: readonly number[]
  /** Extra yield for a little farming skill is added in the engine; this is the base. */
  yield: number
}

export const CROPS: Record<string, CropDef> = {
  glowbean: { id: "glowbean", seed: "glowbean-seed", days: 3, cycles: [0, 1], yield: 2 },
  puffroot: { id: "puffroot", seed: "puffroot-seed", days: 4, cycles: [0, 2], yield: 1 },
  moonmelon: { id: "moonmelon", seed: "moonmelon-seed", days: 6, cycles: [1, 2], yield: 1 },
  spiralkale: { id: "spiralkale", seed: "spiralkale-seed", days: 4, cycles: [2, 3], yield: 2 },
  twinklegourd: { id: "twinklegourd", seed: "twinklegourd-seed", days: 5, cycles: [3, 0], yield: 1 },
  snowpearl: { id: "snowpearl", seed: "snowpearl-seed", days: 5, cycles: [3], yield: 1 },
  // Surreal crops, two per cycle. Each is single-season, so the Stump only stocks it then.
  shadowradish: { id: "shadowradish", seed: "shadowradish-seed", days: 3, cycles: [0], yield: 2 },
  mandalichoke: { id: "mandalichoke", seed: "mandalichoke-seed", days: 5, cycles: [0], yield: 1 },
  schrodinberry: { id: "schrodinberry", seed: "schrodinberry-seed", days: 4, cycles: [1], yield: 2 },
  parallaxpepper: { id: "parallaxpepper", seed: "parallaxpepper-seed", days: 3, cycles: [1], yield: 2 },
  fadeleek: { id: "fadeleek", seed: "fadeleek-seed", days: 4, cycles: [2], yield: 2 },
  quincidence: { id: "quincidence", seed: "quincidence-seed", days: 6, cycles: [2], yield: 1 },
  hypnagogicpea: { id: "hypnagogicpea", seed: "hypnagogicpea-seed", days: 3, cycles: [3], yield: 2 },
  aurorasprout: { id: "aurorasprout", seed: "aurorasprout-seed", days: 5, cycles: [3], yield: 1 },
}

export const CROP_BY_SEED: Record<string, CropDef> = Object.fromEntries(Object.values(CROPS).map((c) => [c.seed, c]))

export const inSeason = (crop: CropDef, day: number) => crop.cycles.includes(cycleOf(day))

export type Plot = { tilled: boolean; crop?: string; grown: number; watered: boolean }
export const blankPlot = (): Plot => ({ tilled: false, grown: 0, watered: false })
export const isRipe = (p: Plot | undefined) => !!p?.crop && p.grown >= (CROPS[p.crop]?.days ?? 99)

// ─── skills ───────────────────────────────────────────────────────────────

export type SkillId = "farming" | "foraging" | "fishing" | "crafting"
export const SKILL_IDS: readonly SkillId[] = ["farming", "foraging", "fishing", "crafting"]

/** XP needed for levels 2…5. */
export const SKILL_STEPS = [12, 30, 60, 100] as const

export const SKILLS: Record<SkillId, { name: string; blurb: string; perks: readonly string[] }> = {
  farming: {
    name: "Farming",
    blurb: "Soil, seeds, and patience.",
    perks: ["Watering costs no energy", "A quarter of harvests give one extra", "Tilling and planting cost no energy", "Half of harvests give one extra"],
  },
  foraging: {
    name: "Foraging",
    blurb: "Knowing where things hide.",
    perks: ["Gathering costs 2 energy", "A quarter of pickings give one extra", "Gathering costs 1 energy", "Half of pickings give one extra"],
  },
  fishing: {
    name: "Fishing",
    blurb: "Quiet hands, bright marker.",
    perks: ["Fishing costs 5 energy", "A third of catches bring a second fish", "Fishing costs 4 energy", "Perfect catches often bring a shell"],
  },
  crafting: {
    name: "Crafting",
    blurb: "Small things, well made.",
    perks: ["One craft in five makes two", "One craft in three makes two", "Crafting uses one less of the first ingredient", "Half of crafts make two"],
  },
}

export const levelOf = (xp: number) => 1 + SKILL_STEPS.filter((step) => xp >= step).length

/** XP into the current level and the size of that level, for a bar. `null` size means max. */
export function levelProgress(xp: number): { level: number; into: number; size: number | null } {
  const level = levelOf(xp)
  if (level > SKILL_STEPS.length) return { level, into: 0, size: null }
  const from = level === 1 ? 0 : SKILL_STEPS[level - 2]!
  return { level, into: xp - from, size: SKILL_STEPS[level - 1]! - from }
}
