/**
 * lib/habit-feeds.ts — Which habits a module's output may land in
 *
 * A habit declares what it can take in through two plain facts: the `unit` it counts
 * ("pages" → measure `pages`) and its `moduleFeeds` rows (`{ moduleId, measure }`). A
 * `ModuleOutput` (`lib/module-output.ts`) lands in every habit where an enabled row matches
 * both its module and its measure, and where the unit agrees. That is the whole routing rule.
 * No model, no name guessing at run time.
 *
 * `connectFeed` / `disconnectFeed` are the only edits to those rows, so a BIM plan, a settings
 * screen, and a test all write the same shape. Both return a new task patch and never touch the
 * store. Pure.
 */
import { measureFromUnit, type ModuleOutput } from "@/lib/module-output"
import type { HabitModuleFeed, WeeklyTask } from "@/lib/types"

/** The measure a habit counts, from its unit. Undefined when the unit is not one we know. */
export function habitMeasure(task: Pick<WeeklyTask, "unit" | "incrementalData">): string | undefined {
  const climbUnit = task.incrementalData && "unit" in task.incrementalData ? (task.incrementalData as { unit?: string }).unit : undefined
  return measureFromUnit(task.unit) ?? measureFromUnit(climbUnit)
}

/** Feed rows that are on. */
export function activeFeeds(task: Pick<WeeklyTask, "moduleFeeds">): HabitModuleFeed[] {
  return (task.moduleFeeds ?? []).filter((feed) => feed && feed.enabled !== false && feed.moduleId && feed.measure)
}

/** Does this one habit take this output? */
export function habitTakesOutput(task: WeeklyTask, output: Pick<ModuleOutput, "moduleId" | "measure">): boolean {
  if ((task.frequency ?? "daily") !== "daily") return false
  const feeds = activeFeeds(task)
  if (!feeds.some((f) => f.moduleId === output.moduleId && f.measure === output.measure)) return false
  const own = habitMeasure(task)
  return own === undefined || own === output.measure
}

/** Every habit the output lands in, in the habit list's order. */
export function habitsForOutput(tasks: WeeklyTask[], output: Pick<ModuleOutput, "moduleId" | "measure">): WeeklyTask[] {
  return tasks.filter((task) => habitTakesOutput(task, output))
}

export type FeedCheck = { ok: true } | { ok: false; reason: string }

/**
 * Can this habit be wired to this module and measure? Refuses a non-daily habit (a weekly
 * habit listens to a daily one through `habitValueLink`, so the pages still reach it), and a
 * habit that counts something else.
 */
export function checkConnectFeed(task: WeeklyTask | undefined, moduleId: string, measure: string): FeedCheck {
  if (!task) return { ok: false, reason: "that habit does not exist" }
  if ((task.frequency ?? "daily") !== "daily")
    return { ok: false, reason: `“${task.name}” is ${task.frequency}; wire a daily habit and let this one sum it` }
  const own = habitMeasure(task)
  if (own && own !== measure) return { ok: false, reason: `“${task.name}” counts ${task.unit?.trim() || own}, not ${measure}` }
  return { ok: true }
}

/** The task's feed rows with one module and measure turned on. Idempotent. */
export function connectFeed(task: WeeklyTask, moduleId: string, measure: string): HabitModuleFeed[] {
  const rest = (task.moduleFeeds ?? []).filter((f) => !(f.moduleId === moduleId && f.measure === measure))
  return [...rest, { moduleId, measure }]
}

/** The task's feed rows with one module and measure removed. */
export function disconnectFeed(task: WeeklyTask, moduleId: string, measure: string): HabitModuleFeed[] {
  return (task.moduleFeeds ?? []).filter((f) => !(f.moduleId === moduleId && f.measure === measure))
}
