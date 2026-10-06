/**
 * lib/habit-completion-trust.ts — Which completion source to believe
 *
 * A habit may listen to several places (a hand tick, Tracking tags, a count of
 * tagged Done tasks, occupancy, a sleep clock, a list, the daily-habit floor,
 * a summed daily habit, a phone keyword). They are an
 * ordered list. The first source that actually has something to say wins.
 * A source with no observation is skipped. Logged flags and numbers stay on
 * the cell either way — trust only decides whether the habit is met.
 */
import type { HabitCompletionSourceId, TaskCompletion, WeeklyTask } from "./types"

export const HABIT_COMPLETION_SOURCE_ORDER: readonly HabitCompletionSourceId[] = [
  "manual",
  "tags",
  "taggedTasks",
  "coverage",
  "sleep",
  "list",
  "dailyFloor",
  "habitValue",
  "keywords",
]

export const COMPLETION_SOURCE_LABELS: Record<HabitCompletionSourceId, string> = {
  manual: "By hand",
  tags: "Tracking tags",
  taggedTasks: "Tagged tasks",
  coverage: "Activity occupancy",
  sleep: "Sleep clock",
  list: "Next actions",
  dailyFloor: "Daily habits floor",
  habitValue: "Daily habit total",
  keywords: "Phone keywords",
}

export const COMPLETION_SOURCE_HINTS: Record<HabitCompletionSourceId, string> = {
  manual: "Ticks and numbers you type into the cell.",
  tags: "Minutes painted with the tags chosen below.",
  taggedTasks: "Done tasks and tracked activities with this tag each count as 1.",
  coverage: "Percent of this period painted in Tracking.",
  sleep: "Bedtime or wake at or before a clock time.",
  list: "Done next actions on a named list.",
  dailyFloor: "Every daily habit cleared the week.",
  habitValue: "Adds up one daily habit across the days of this week, month, or season.",
  keywords: "A whole-message line from your phone.",
}

export type SourceState = "met" | "unmet" | "empty"

export interface SourceReading {
  state: SourceState
  value?: number
}

export interface TrustOutcome {
  /** The source whose reading decided the habit. Null when every source was empty. */
  winner: HabitCompletionSourceId | null
  met: boolean
  value?: number
}

const SOURCE_SET = new Set<string>(HABIT_COMPLETION_SOURCE_ORDER)

export function sanitizeCompletionSources(value: unknown): HabitCompletionSourceId[] | undefined {
  if (!Array.isArray(value)) return undefined
  const out: HabitCompletionSourceId[] = []
  for (const id of value) {
    if (typeof id !== "string" || !SOURCE_SET.has(id)) continue
    const source = id as HabitCompletionSourceId
    if (!out.includes(source)) out.push(source)
  }
  return out
}

/**
 * Walk trust order. Empty readings are skipped. The first met or unmet wins.
 * No sources, or sources that all have nothing to say, leaves the habit unmet.
 */
export function trustedOutcome(
  order: readonly HabitCompletionSourceId[],
  readings: Partial<Record<HabitCompletionSourceId, SourceReading>>,
): TrustOutcome {
  for (const id of order) {
    const reading = readings[id]
    if (!reading || reading.state === "empty") continue
    return {
      winner: id,
      met: reading.state === "met",
      value: reading.value,
    }
  }
  return { winner: null, met: false }
}

function meets(value: number | undefined, goal: number): SourceState {
  if (value === undefined || !Number.isFinite(value)) return "empty"
  if (!goal) return value > 0 ? "met" : "unmet"
  return value + 1e-9 >= goal ? "met" : "unmet"
}

/** The hand opinion, ignoring auto flags unless the person actually touched the cell. */
export function manualReading(cell: TaskCompletion | undefined, goal = 0): SourceReading {
  if (!cell) return { state: "empty" }
  if (typeof cell.handCompleted === "boolean") {
    return { state: cell.handCompleted ? "met" : "unmet", value: cell.manualValue ?? cell.value }
  }
  if (typeof cell.text === "string" && cell.text.trim()) return { state: "met" }
  if (cell.trackedValue !== undefined || cell.trackedCompleted !== undefined || cell.coverageCompleted !== undefined) {
    return { state: "empty" }
  }
  if (cell.sleepCompleted || cell.listCompleted || cell.dailyFloorCompleted) {
    if (cell.manualValue !== undefined) return { state: meets(cell.manualValue, goal), value: cell.manualValue }
    return { state: "empty" }
  }
  if (cell.habitSumValue !== undefined && cell.manualValue === undefined) return { state: "empty" }
  if (cell.taggedTaskCount !== undefined && cell.manualValue === undefined) return { state: "empty" }
  if (cell.value !== undefined) return { state: meets(cell.value, goal), value: cell.value }
  if (cell.completed && !cell.keywordLogged) return { state: "met" }
  return { state: "empty" }
}

function flagReading(flag: boolean | undefined, value?: number): SourceReading {
  if (flag === true) return { state: "met", value }
  if (flag === false) return { state: "unmet", value }
  return { state: "empty" }
}

/**
 * What each enabled source can see on the cell. Sources not in `order` are
 * omitted. Flags already stored are left as they are.
 */
export function readingsFromCell(
  order: readonly HabitCompletionSourceId[],
  cell: TaskCompletion | undefined,
  goal = 0,
): Partial<Record<HabitCompletionSourceId, SourceReading>> {
  const enabled = new Set(order)
  const out: Partial<Record<HabitCompletionSourceId, SourceReading>> = {}
  if (enabled.has("manual")) out.manual = manualReading(cell, goal)
  if (enabled.has("tags")) {
    if (!cell || (cell.trackedValue === undefined && cell.trackedCompleted === undefined)) {
      out.tags = { state: "empty" }
    } else if (cell.trackedCompleted === true) {
      out.tags = { state: "met", value: cell.trackedValue }
    } else if (cell.trackedCompleted === false && cell.trackedValue === undefined) {
      out.tags = { state: "unmet" }
    } else {
      out.tags = { state: meets(cell.trackedValue, goal), value: cell.trackedValue }
    }
  }
  if (enabled.has("taggedTasks")) {
    out.taggedTasks =
      cell?.taggedTaskCount === undefined
        ? { state: "empty" }
        : { state: meets(cell.taggedTaskCount, goal), value: cell.taggedTaskCount }
  }
  if (enabled.has("coverage")) out.coverage = flagReading(cell?.coverageCompleted, cell?.value)
  if (enabled.has("sleep")) out.sleep = flagReading(cell?.sleepCompleted)
  if (enabled.has("list")) out.list = flagReading(cell?.listCompleted)
  if (enabled.has("dailyFloor")) out.dailyFloor = flagReading(cell?.dailyFloorCompleted)
  if (enabled.has("habitValue")) {
    out.habitValue =
      cell?.habitSumValue === undefined
        ? { state: "empty" }
        : { state: meets(cell.habitSumValue, goal), value: cell.habitSumValue }
  }
  if (enabled.has("keywords")) {
    if (!cell?.keywordLogged) out.keywords = { state: "empty" }
    else if (goal && (cell.keywordValue !== undefined || cell.value !== undefined)) {
      const amount = cell.value ?? cell.keywordValue
      out.keywords = { state: meets(amount, goal), value: cell.keywordValue }
    } else {
      out.keywords = { state: "met", value: cell.keywordValue }
    }
  }
  return out
}

/** A text edit that does not cross empty ↔ filled does not need grades or coverage. */
export function textEditNeedsHeavySync(
  task: Pick<WeeklyTask, "type">,
  previous: TaskCompletion | undefined,
  nextText: string,
): boolean {
  if (task.type !== "TEXT") return true
  return !!previous?.text?.trim() !== !!nextText.trim()
}

const HAND_PATCH_KEYS = new Set(["completed", "value", "goal", "text", "manualValue"])

/** True when the patch is someone typing or ticking, not an auto-sync write. */
export function patchIsHandEdit(patch: TaskCompletion): boolean {
  const keys = Object.keys(patch)
  if (!keys.length) return false
  if (!keys.every((key) => HAND_PATCH_KEYS.has(key))) return false
  return keys.some((key) => key === "completed" || key === "value" || key === "text")
}
