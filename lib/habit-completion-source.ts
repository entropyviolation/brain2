/**
 * lib/habit-completion-source.ts — Linked habit completion (coverage / daily floor)
 *
 * Extends sleep / list / tag tracking with two period links the habit form
 * can edit:
 * - **Tracking Activity Occupancy** — autofills the habit's value with the same
 *   Activity-scope Occupancy % Tracking shows for that habit's period
 *   (day / week / month / season). Any Activity minutes are a reading, including
 *   under the threshold (`coverageCompleted: false`). The habit is met when the
 *   percent reaches an editable threshold (default 75). No Activity minutes
 *   leaves the reading empty.
 * - **Daily habits floor** — weekly boolean: complete when every daily habit
 *   has some week completion (>% floor, default 0 = any attempt).
 *
 * `undefined` on the habit means "use the name preset". `null` means the user
 * turned that link off. Manual ticks still win the same way as sleep / list.
 */
import { TaskType, type HabitCompletionSourceId, type HabitCoverageLink, type HabitDailyFloorLink, type TaskCompletion, type WeeklyData, type WeeklyTask } from "./types"
import { effectiveListLink, effectiveSleepLink } from "./habit-connections"
import { triggersForHabit } from "./ingest/text-triggers"
import { readingsFromCell, sanitizeCompletionSources, trustedOutcome } from "./habit-completion-trust"
import { applyHabitAutoFlag } from "./habit-auto-flag"
import { isHabitGoalMet, isGoalType } from "./habit-utils"
import { calculateTaskPercentage } from "./calculations"
import { getWeekDates, getWeekStartDate, parseLocalDate } from "./date-utils"

export const DEFAULT_COVERAGE_THRESHOLD = 75

export function clampCoverageThreshold(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_COVERAGE_THRESHOLD
  return Math.min(100, Math.max(1, Math.round(n)))
}

export function sanitizeCoverageLink(value: unknown): HabitCoverageLink | null | undefined {
  if (value === null) return null
  if (value === undefined) return undefined
  if (!value || typeof value !== "object") return undefined
  const row = value as HabitCoverageLink
  return {
    threshold: clampCoverageThreshold(row.threshold),
    enabled: row.enabled !== false,
  }
}

export function sanitizeDailyFloorLink(value: unknown): HabitDailyFloorLink | null | undefined {
  if (value === null) return null
  if (value === undefined) return undefined
  if (!value || typeof value !== "object") return undefined
  const row = value as HabitDailyFloorLink
  const floor = typeof row.floorPercent === "number" && Number.isFinite(row.floorPercent)
    ? Math.min(100, Math.max(0, Math.round(row.floorPercent)))
    : 0
  return { floorPercent: floor, enabled: row.enabled !== false }
}

/** Name presets for "log 75% of the …" habits. */
export function presetCoverageLink(
  task: Pick<WeeklyTask, "name" | "frequency" | "type">,
): HabitCoverageLink | null {
  if (task.type && task.type !== TaskType.GOAL && task.type !== TaskType.BOOLEAN) return null
  const name = (task.name || "").toLowerCase()
  if (!/log\s+\d+\s*%/.test(name) && !/(\d+)\s*%\s+of\s+(the\s+)?(day|week|month|season)/.test(name)) {
    return null
  }
  const match = name.match(/(\d+)\s*%/)
  const threshold = clampCoverageThreshold(match ? Number(match[1]) : DEFAULT_COVERAGE_THRESHOLD)
  const freq = task.frequency || "daily"
  if (/of\s+(the\s+)?day/.test(name) && freq !== "daily") return null
  if (/of\s+(the\s+)?week/.test(name) && freq !== "weekly") return null
  if (/of\s+(the\s+)?month/.test(name) && freq !== "monthly") return null
  if (/of\s+(the\s+)?season/.test(name) && freq !== "quarterly") return null
  return { threshold, enabled: true }
}

/** Weekly "no daily habit at 0%" preset. */
export function presetDailyFloorLink(
  task: Pick<WeeklyTask, "name" | "frequency" | "type">,
): HabitDailyFloorLink | null {
  if (task.frequency !== "weekly") return null
  if (task.type && task.type !== TaskType.BOOLEAN) return null
  const name = (task.name || "").toLowerCase()
  if (!/0\s*%/.test(name)) return null
  if (!/(no|none|zero)/.test(name)) return null
  if (!/(daily|day)/.test(name)) return null
  return { floorPercent: 0, enabled: true }
}

export function effectiveCoverageLink(
  task: Pick<WeeklyTask, "name" | "frequency" | "type" | "coverageLink">,
): HabitCoverageLink | null {
  if (task.coverageLink === null) return null
  if (task.coverageLink) {
    const cleaned = sanitizeCoverageLink(task.coverageLink)
    return cleaned && cleaned.enabled !== false ? cleaned : null
  }
  return presetCoverageLink(task)
}

export function effectiveDailyFloorLink(
  task: Pick<WeeklyTask, "name" | "frequency" | "type" | "dailyFloorLink">,
): HabitDailyFloorLink | null {
  if (task.dailyFloorLink === null) return null
  if (task.dailyFloorLink) {
    const cleaned = sanitizeDailyFloorLink(task.dailyFloorLink)
    return cleaned && cleaned.enabled !== false ? cleaned : null
  }
  return presetDailyFloorLink(task)
}

export function coverageMeetsThreshold(coveragePercent: number, threshold: number): boolean {
  return coveragePercent + 1e-9 >= clampCoverageThreshold(threshold)
}

/**
 * Cell readout for coverage-linked goals: show progress against the bar, not
 * raw Tracking %. Overshoot still stores the real percent for grades; the
 * label caps at threshold so 100% tracked against 75 reads 75/75, not 100/75.
 */
export function coverageDisplayAmount(
  actualPercent: number | undefined,
  threshold: number,
): number | undefined {
  if (actualPercent === undefined) return undefined
  const t = clampCoverageThreshold(threshold)
  const n = Number.isFinite(actualPercent) ? actualPercent : 0
  return Math.min(n, t)
}

/**
 * Every daily habit's week completion is above `floorPercent` (default 0).
 * Exempt days are left to the caller via `isExempt`. Habits with a vacant
 * week (null %) are treated as not attempted.
 */
export function dailyHabitsClearFloor(
  dailyTasks: WeeklyTask[],
  weeklyData: WeeklyData,
  weekDates: Date[],
  floorPercent = 0,
  isExempt?: (task: WeeklyTask, dateKey: string) => boolean,
): boolean {
  if (dailyTasks.length === 0) return false
  const floor = Math.min(100, Math.max(0, floorPercent))
  for (const task of dailyTasks) {
    const pct = calculateTaskPercentage(task.id, dailyTasks, weeklyData, weekDates, isExempt)
    if (pct === null || !(pct > floor)) return false
  }
  return true
}

/** Merge coverage / floor auto flags. Thin wrapper over `applyHabitAutoFlag`. */
export function applyLinkedFlag(
  completion: TaskCompletion | undefined,
  flag: "coverageCompleted" | "dailyFloorCompleted",
  met: boolean,
  extras?: { value?: number; goal?: number },
): TaskCompletion | null {
  return applyHabitAutoFlag(completion, flag, met, extras)
}

/**
 * Activity occupancy saw minutes. `met` false is stored as explicit
 * `coverageCompleted: false` so trust treats it as a reading. Deleting the
 * flag would look like silence, and the store merge cannot see a deleted key.
 * Returns null when the cell already records this observation.
 */
export function applyCoverageObservation(
  completion: TaskCompletion | undefined,
  met: boolean,
  extras?: { value?: number; goal?: number },
): TaskCompletion | null {
  const nextValue = extras?.value !== undefined ? extras.value : completion?.value
  const nextGoal = extras?.goal !== undefined ? extras.goal : completion?.goal
  if (
    completion?.coverageCompleted === met &&
    completion?.value === nextValue &&
    completion?.goal === nextGoal
  ) {
    return null
  }
  const next: TaskCompletion = { ...(completion ?? {}), coverageCompleted: met }
  if (nextValue !== undefined) next.value = nextValue
  if (nextGoal !== undefined) next.goal = nextGoal
  return next
}

function coverageOwnsValue(completion: TaskCompletion): boolean {
  if (typeof completion.handCompleted === "boolean") return false
  if (completion.manualValue !== undefined || completion.trackedValue !== undefined) return false
  if (completion.keywordLogged || completion.keywordValue !== undefined) return false
  if (completion.text?.trim()) return false
  return true
}

/**
 * No Activity minutes remain. Drop the occupancy reading so a stale percent
 * or a stuck check cannot keep winning. Explicit `undefined` survives the
 * store's patch merge. A hand, tag, or keyword number stays put.
 * `completed: false` stops the leftover check from being read as a hand tick
 * once the coverage flag is gone; trust recomputes it from whatever is left.
 */
export function clearCoverageObservation(completion: TaskCompletion | undefined): TaskCompletion | null {
  if (!completion || completion.coverageCompleted === undefined) return null
  const next: TaskCompletion = { ...completion, coverageCompleted: undefined, completed: false }
  if (coverageOwnsValue(completion)) next.value = undefined
  return next
}

/**
 * Hide-completed: a row leaves when it is exempt or fully met for the focus
 * period. Auto flags (sleep / list / tracked / coverage / floor) count the
 * same as a hand tick — including threshold clocks like wake-before-9.
 */
export function habitHiddenWhenComplete(
  task: WeeklyTask,
  completion: TaskCompletion | undefined,
  opts: {
    date?: Date
    weeklyData?: WeeklyData
    exempt?: boolean
  } = {},
): boolean {
  if (opts.exempt) return true
  if (isHabitGoalMet(task, completion, { date: opts.date, weeklyData: opts.weeklyData })) return true
  if (!completion) return false
  if (completion.sleepCompleted || completion.listCompleted || completion.trackedCompleted) return true
  if (completion.coverageCompleted || completion.dailyFloorCompleted) return true
  if (isGoalType(task.type) && task.goal && (completion.value ?? 0) >= task.goal) return true
  return false
}

export function coverageHabitLabel(frequency: WeeklyTask["frequency"] | undefined): string {
  switch (frequency) {
    case "weekly":
      return "week"
    case "monthly":
      return "month"
    case "quarterly":
      return "season"
    default:
      return "day"
  }
}

export function defaultCoverageHabitName(frequency: WeeklyTask["frequency"] | undefined): string {
  return `Log ${DEFAULT_COVERAGE_THRESHOLD}% of the ${coverageHabitLabel(frequency)}`
}

export function defaultDailyFloorHabitName(): string {
  return "No 0% completed daily tasks"
}

/** True when this seed-style coverage habit already exists for the frequency. */
export function hasCoverageHabit(
  tasks: WeeklyTask[],
  frequency: NonNullable<WeeklyTask["frequency"]>,
): boolean {
  return tasks.some((task) => {
    if ((task.frequency || "daily") !== frequency) return false
    if (effectiveCoverageLink(task)) return true
    const name = (task.name || "").toLowerCase()
    return name.includes(`of the ${coverageHabitLabel(frequency)}`) && /%/.test(name)
  })
}

export function hasDailyFloorHabit(tasks: WeeklyTask[]): boolean {
  return tasks.some((task) => {
    if (task.frequency !== "weekly") return false
    if (effectiveDailyFloorLink(task)) return true
    const name = (task.name || "").toLowerCase()
    return /0\s*%/.test(name) && /(daily|day)/.test(name)
  })
}

/**
 * Sources implied by links already on the habit. Manual is always first so a
 * hand tick still wins until the person reorders the list.
 */
export function deriveCompletionSources(
  task: Pick<
    WeeklyTask,
    | "name"
    | "frequency"
    | "type"
    | "coverageLink"
    | "dailyFloorLink"
    | "sleepLink"
    | "listLink"
    | "trackingLink"
    | "textTriggers"
    | "habitValueLink"
    | "taggedTaskTag"
    | "listSentLink"
  >,
): HabitCompletionSourceId[] {
  const linked: HabitCompletionSourceId[] = []
  if (task.trackingLink?.tagIds?.length && task.trackingLink.enabled !== false) linked.push("tags")
  if ((task.taggedTaskTag ?? "").trim()) linked.push("taggedTasks")
  if (effectiveCoverageLink(task)) linked.push("coverage")
  if (effectiveSleepLink(task)) linked.push("sleep")
  if (effectiveListLink(task)) linked.push("list")
  if (effectiveDailyFloorLink(task)) linked.push("dailyFloor")
  if (task.habitValueLink?.enabled !== false && task.habitValueLink?.habitId) linked.push("habitValue")
  if (task.listSentLink?.enabled !== false && task.listSentLink?.listId) linked.push("listSent")
  if (triggersForHabit(task as WeeklyTask).length > 0) linked.push("keywords")
  return ["manual", ...linked]
}

/** Stored order when the person has saved one. Otherwise the derived list. */
export function effectiveCompletionSources(task: WeeklyTask): HabitCompletionSourceId[] {
  if (Array.isArray(task.completionSources)) return sanitizeCompletionSources(task.completionSources) ?? []
  return deriveCompletionSources(task)
}

/**
 * Stamp `completed` from trust order. Stored flags and amounts are kept.
 * Habits with no `completionSources` field keep the previous or-of-flags result
 * already on `cell` (caller ran `completionWithGoalFlag`).
 */
export function applyCompletionTrust(task: WeeklyTask, cell: TaskCompletion): TaskCompletion {
  if (!Array.isArray(task.completionSources)) return cell
  const order = effectiveCompletionSources(task)
  const outcome = trustedOutcome(order, readingsFromCell(order, cell, task.goal))
  if (!!cell.completed === outcome.met) return cell
  return { ...cell, completed: outcome.met }
}

export function weekDatesForKey(weekKey: string): Date[] | null {
  const startStr = weekKey.split("_")[0]
  const monday = parseLocalDate(startStr)
  if (!monday) return null
  return getWeekDates(getWeekStartDate(monday))
}
