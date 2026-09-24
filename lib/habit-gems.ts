/**
 * lib/habit-gems.ts — Daily Habits jewels (photographed, like orbs)
 *
 * Furniture slots (Yes/No, Goal, Edit, …) still have catalog defaults for
 * Settings chrome. Per-habit row jewels do **not** follow type or category:
 * a stored `WeeklyTask.gem` wins; otherwise assign a random catalog stone
 * once and persist it (`ensureTaskGem` / `stampMissingTaskGems`).
 */
import { TaskType, type WeeklyTask } from "@/lib/types"
import { GEM_PATHS } from "@/lib/gems-manifest"

export const HABIT_GEM_SLOTS = [
  "boolean",
  "goal",
  "text",
  "incremental",
  "edit",
  "delete",
  "issue",
] as const

export type HabitGemSlot = (typeof HABIT_GEM_SLOTS)[number]
export type HabitGemMap = Partial<Record<HabitGemSlot, string>>

export const HABIT_GEM_SLOT_LABELS: Record<HabitGemSlot, string> = {
  boolean: "Yes/No",
  goal: "Goal",
  text: "Text",
  incremental: "Climb",
  edit: "Edit",
  delete: "Delete",
  issue: "Needs Attention",
}

const NAMED_DEFAULTS: Record<HabitGemSlot, string> = {
  boolean: "/gems-removebackground/gem5.png",
  goal: "/gems-removebackground/gem6.png",
  text: "/gems-removebackground/gem3.png",
  incremental: "/gems-removebackground/gem.png",
  edit: "/gems-removebackground/gems2-03.png",
  delete: "/gems-removebackground/gem8.png",
  issue: "/gems-removebackground/gems1-05.png",
}

const CATALOG_FALLBACK = GEM_PATHS[0] ?? "/gems-removebackground/gem.png"

/** Deterministic 0–1 stream so seed habits paint the same jewels on SSR and client. */
export function seedRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0
    return a / 4294967296
  }
}

export function defaultHabitGem(slot: HabitGemSlot): string {
  const named = NAMED_DEFAULTS[slot]
  if (GEM_PATHS.includes(named)) return named
  const i = HABIT_GEM_SLOTS.indexOf(slot)
  return GEM_PATHS[i % Math.max(GEM_PATHS.length, 1)] || named
}

export function resolveHabitGem(slot: HabitGemSlot, stored?: string | null): string {
  if (stored && stored.length > 0) return stored
  return defaultHabitGem(slot)
}

export function sanitizeHabitGems(value: unknown): HabitGemMap {
  if (!value || typeof value !== "object") return {}
  const out: HabitGemMap = {}
  for (const slot of HABIT_GEM_SLOTS) {
    const raw = (value as HabitGemMap)[slot]
    if (typeof raw === "string" && raw) out[slot] = raw
  }
  return out
}

export function habitGemSlotForType(type: TaskType): HabitGemSlot {
  switch (type) {
    case TaskType.BOOLEAN:
      return "boolean"
    case TaskType.TEXT:
      return "text"
    case TaskType.INCREMENTAL:
      return "incremental"
    default:
      return "goal"
  }
}

/** One catalog path, optionally avoiding stones already in use. */
export function pickRandomCatalogGem(rng: () => number = Math.random, avoid?: ReadonlySet<string>): string {
  const pool =
    avoid && avoid.size > 0 && avoid.size < GEM_PATHS.length
      ? GEM_PATHS.filter((path) => !avoid.has(path))
      : GEM_PATHS
  if (pool.length === 0) return CATALOG_FALLBACK
  const i = Math.floor(rng() * pool.length)
  return pool[Math.min(Math.max(i, 0), pool.length - 1)] ?? CATALOG_FALLBACK
}

/** Persist a random catalog jewel when the habit has no stored gem. */
export function ensureTaskGem<T extends Pick<WeeklyTask, "gem">>(task: T, rng: () => number = Math.random): T {
  if (typeof task.gem === "string" && task.gem.length > 0) return task
  return { ...task, gem: pickRandomCatalogGem(rng) }
}

/** One-time assign missing gems. Leaves user-picked / uploaded stones alone. */
export function stampMissingTaskGems(tasks: WeeklyTask[], rng: () => number = Math.random): WeeklyTask[] {
  const used = new Set(
    tasks.flatMap((task) => (typeof task.gem === "string" && task.gem.length > 0 ? [task.gem] : [])),
  )
  let changed = false
  const next = tasks.map((task) => {
    if (typeof task.gem === "string" && task.gem.length > 0) return task
    changed = true
    const gem = pickRandomCatalogGem(rng, used)
    used.add(gem)
    return { ...task, gem }
  })
  return changed ? next : tasks
}

/** Stored habit gem, else a catalog stone — never a type or category slot. */
export function resolveTaskGem(task: Pick<WeeklyTask, "gem">): string {
  if (typeof task.gem === "string" && task.gem.length > 0) return task.gem
  return CATALOG_FALLBACK
}
