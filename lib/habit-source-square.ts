/**
 * lib/habit-source-square.ts — Read-only account of one habit cell
 *
 * Used when the pipeline has no By hand source. Names the habit and the
 * period, each source that was asked, the numbers it pulled, and the result.
 * A previous-period compare adds the pairs, which side won, and how many
 * were higher. Nothing here writes a completion.
 *
 * Tracking-tag and tagged-task lines resolve catalog names from a catalog
 * passed in (or omitted → ids only). Pure helpers stay free of the Tracking
 * store so habits-store never cycles through this file.
 */
import type { HabitExemptFn } from "./calculations"
import { formatLocalDateKey, getWeekStartDate } from "./date-utils"
import { datesForCompletionAverage } from "./habit-daily-completion-average"
import { effectiveCompletionSources } from "./habit-completion-source"
import { listSentTrustGoal } from "./habit-completion-pipeline"
import { isAmountSlot } from "./habit-keyword-source"
import { COMPLETION_SOURCE_LABELS, readingsFromCell, trustedOutcome } from "./habit-completion-trust"
import { periodWindowsForFrequency } from "./habit-period-windows"
import { compareHigherThanPrevious, type PeriodComparePair } from "./habit-period-compare"
import { currentExemptionContext, isHabitPeriodExempt } from "./habit-exemption"
import { useHabitsStore } from "./habits-store"
import { bindingForStatsRow, evaluateHabitStatBinding, formatStatDisplay } from "./habit-stat-pipeline"
import {
  previousPoint,
  previousStatContext,
  readStatPoint,
  type HabitStatContext,
  type StatReading,
} from "./habit-stat-points"
import { trackingUnitLabel } from "./habit-tracking"
import type {
  HabitCompletionSourceId,
  HabitFrequency,
  HabitStatSet,
  HabitStatsConfig,
  HabitTrackingMode,
  TaskCompletion,
  WeeklyData,
  WeeklyTask,
} from "./types"

/** Catalog slice needed to turn `trackingLink.tagIds` into display names. */
export type CatalogTagName = { id: string; name: string }

/** Resolve minute-link ids to catalog names (id fallback when the tag is gone). */
export function resolveTrackingTagNames(
  tagIds: readonly string[] | undefined,
  catalog: readonly CatalogTagName[],
): string[] {
  if (!tagIds?.length) return []
  const byId = new Map(catalog.map((tag) => [tag.id, tag.name]))
  return tagIds.map((id) => {
    const name = byId.get(id)?.trim()
    return name || id
  })
}

/** Same labels as Auto-fill's Combine with manual entries control. */
export function trackingCombineModeLabel(mode: HabitTrackingMode | undefined): string {
  if (mode === "max") return "Higher of the two"
  if (mode === "replace") return "Tracking only"
  return "Add"
}

/**
 * Display-only wiring: Counts is the done-count name; Minutes is the
 * auto-fill catalog names. Null when that side is not wired.
 */
export function habitTagWiringSummary(
  task: Pick<WeeklyTask, "taggedTaskTag" | "trackingLink">,
  catalog: readonly CatalogTagName[],
): { counts: string | null; minutes: string | null } {
  const counts = task.taggedTaskTag?.trim() || null
  const names = resolveTrackingTagNames(task.trackingLink?.tagIds, catalog)
  return { counts, minutes: names.length ? names.join(", ") : null }
}

function tagsSourceLines(
  task: WeeklyTask,
  completion: TaskCompletion | undefined,
  catalog: readonly CatalogTagName[],
): SourceSquareLine[] {
  const link = task.trackingLink
  const names = resolveTrackingTagNames(link?.tagIds, catalog)
  return [
    { name: "Tags", value: names.length ? names.join(", ") : "—" },
    { name: "Unit", value: trackingUnitLabel(link?.unit) },
    { name: "Combine", value: trackingCombineModeLabel(link?.mode) },
    { name: "Auto-fill", value: link && link.enabled !== false ? "On" : "Off" },
    { name: "Minutes", value: completion?.trackedValue != null ? String(completion.trackedValue) : "—" },
  ]
}

function taggedTasksSourceLines(
  task: WeeklyTask,
  completion: TaskCompletion | undefined,
): SourceSquareLine[] {
  const tag = task.taggedTaskTag?.trim() || "—"
  const goal = task.goal
  const rule =
    goal != null && Number.isFinite(goal)
      ? `each Done counts as 1 toward the goal (${goal})`
      : "each Done counts as 1 toward the goal"
  return [
    { name: "Tag", value: tag },
    { name: "Rule", value: rule },
    { name: "Count", value: completion?.taggedTaskCount != null ? String(completion.taggedTaskCount) : "—" },
  ]
}

export function cellOpensSourceDetail(task: WeeklyTask): boolean {
  return !effectiveCompletionSources(task).includes("manual")
}

export interface SourceSquareLine {
  name: string
  value: string
}

export interface SourceSquareSource {
  id: string
  label: string
  lines: SourceSquareLine[]
}

export interface SourceSquarePair {
  label: string
  thisSide: string
  previousSide: string
  winner: string
}

export interface SourceSquare {
  habitName: string
  periodLabel: string
  sources: SourceSquareSource[]
  result: string
  compare: {
    pairs: SourceSquarePair[]
    summary: string
    complete: boolean
  } | null
}

export interface SourceSquareInput {
  task: WeeklyTask
  periodLabel: string
  date: Date
  completion: TaskCompletion | undefined
  tasks: WeeklyTask[]
  weeklyData: WeeklyData
  weeklyHabitData: WeeklyData
  monthlyHabitData: WeeklyData
  gradeTolerance: number
  outputGradeTolerance: number
  isExempt?: HabitExemptFn
  today?: Date
  /** Tracking catalog for resolving `trackingLink.tagIds` to names. */
  trackingTags?: readonly CatalogTagName[]
}

function sideNames(frequency: HabitFrequency | undefined): { this: string; previous: string } {
  if (frequency === "monthly") return { this: "This month", previous: "Last month" }
  if (frequency === "daily") return { this: "This day", previous: "Previous day" }
  return { this: "This week", previous: "Last week" }
}

function winnerLabel(pair: PeriodComparePair, sides: { this: string; previous: string }): string {
  if (pair.winner === "this") return sides.this
  if (pair.winner === "previous") return sides.previous
  return "Tie"
}

function fmt(value: number): string {
  return `${Math.round(value)}%`
}

function linesFromReading(reading: StatReading): SourceSquareLine[] {
  if (reading.members?.length) {
    return reading.members.map((member) => ({ name: member.name, value: `${Math.round(member.pct)}%` }))
  }
  return [{ name: reading.label, value: reading.valueText }]
}

function flagText(flag: boolean | undefined): string {
  if (flag === true) return "Met"
  if (flag === false) return "Unmet"
  return "—"
}

export function statContextForSquare(input: SourceSquareInput, set: HabitStatSet): HabitStatContext {
  const today = input.today ?? new Date()
  const todayKey = formatLocalDateKey(today)
  const window = periodWindowsForFrequency(input.task.frequency, [formatLocalDateKey(input.date)])[0]
  const periodDays = window ? datesForCompletionAverage(input.task.frequency, window, todayKey) : []
  const monthStart = new Date(input.date.getFullYear(), input.date.getMonth(), 1)
  monthStart.setHours(0, 0, 0, 0)
  const of = (frequency: HabitFrequency) =>
    input.tasks.filter((habit) => (habit.frequency || "daily") === frequency && habit.id !== input.task.id)
  return {
    today,
    weekStart: getWeekStartDate(input.date),
    monthStart,
    periodDays,
    set,
    subject: input.task,
    dailyTasks: input.tasks.filter((habit) => (habit.frequency || "daily") === "daily"),
    weeklyTasks: of("weekly"),
    monthlyTasks: of("monthly"),
    weeklyData: input.weeklyData,
    weeklyHabitData: input.weeklyHabitData,
    monthlyHabitData: input.monthlyHabitData,
    gradeTolerance: input.gradeTolerance,
    outputGradeTolerance: input.outputGradeTolerance,
    isExempt: input.isExempt,
  }
}

function engineLines(
  id: HabitCompletionSourceId,
  task: WeeklyTask,
  completion: TaskCompletion | undefined,
  ctx: HabitStatContext,
  catalog: readonly CatalogTagName[],
): SourceSquareLine[] {
  if (id === "dailyFloor") return linesFromReading(readStatPoint({ kind: "dailyFloor" }, ctx))
  if (id === "habitValue") return linesFromReading(readStatPoint({ kind: "habitValue" }, ctx))
  if (id === "dailyCompletionAverage") return linesFromReading(readStatPoint({ kind: "dailyCompletionAverage" }, ctx))
  if (id === "tags") return tagsSourceLines(task, completion, catalog)
  if (id === "taggedTasks") return taggedTasksSourceLines(task, completion)
  if (id === "coverage") {
    const amount = completion?.value
    const threshold = task.coverageLink?.threshold
    return [
      {
        name: "Occupancy",
        value: amount != null ? `${Math.round(amount)}%${threshold != null ? ` / ${threshold}%` : ""}` : "—",
      },
    ]
  }
  if (id === "sleep") return [{ name: "Sleep clock", value: flagText(completion?.sleepCompleted) }]
  if (id === "list") return [{ name: "Next actions", value: flagText(completion?.listCompleted) }]
  if (id === "listSent") {
    return [{ name: "Sent", value: completion?.listSentPercent != null ? `${Math.round(completion.listSentPercent)}%` : "—" }]
  }
  if (id === "keywords") {
    const amount = completion?.keywordValue ?? (completion?.keywordUse ? undefined : completion?.value)
    const named = Object.entries(completion?.keywordSlots ?? {})
      .filter(([key]) => !isAmountSlot(key))
      .map(([, value]) => value)
      .filter(Boolean)
      .join(", ")
    const shown = [amount != null ? String(amount) : null, named || null].filter(Boolean).join(" · ")
    if (completion?.keywordLogged) {
      return [{ name: "Keyword", value: shown || "Done" }]
    }
    if (completion?.keywordHitCount) return [{ name: "Keyword", value: String(completion.keywordHitCount) }]
    return [{ name: "Keyword", value: "—" }]
  }
  if (id === "manual") {
    const typed = completion?.manualValue ?? completion?.value
    return [{ name: "Typed", value: typed != null ? String(typed) : completion?.text?.trim() || "—" }]
  }
  return [{ name: COMPLETION_SOURCE_LABELS[id], value: "—" }]
}

function statsRow(task: WeeklyTask) {
  return task.completionPipelines?.find((row) => row.kind === "habitsStats")
}

function statsOn(task: WeeklyTask): HabitStatsConfig | undefined {
  return statsRow(task)?.stats
}

function compareBlock(task: WeeklyTask, ctx: HabitStatContext) {
  const stats = statsOn(task)
  if (!stats?.comparePrevious) return null
  const setCtx = { ...ctx, set: stats.set }
  const sides = sideNames(task.frequency)
  const raw: { id: string; label: string; current: number; previous: number }[] = []
  for (const point of stats.points) {
    const current = readStatPoint(point, setCtx)
    const prevCtx = point.kind === "dayPercent" ? setCtx : previousStatContext(setCtx)
    const previous = readStatPoint(previousPoint(point), prevCtx)
    raw.push({
      id: current.key,
      label: current.label,
      current: current.value ?? 0,
      previous: previous.value ?? 0,
    })
  }
  const compared = compareHigherThanPrevious(raw, stats.mustBeHigher ?? 2)
  const pairs = compared.pairs.map((pair) => ({
    label: pair.label,
    thisSide: fmt(pair.current),
    previousSide: fmt(pair.previous),
    winner: winnerLabel(pair, sides),
  }))
  const summary =
    pairs.length === 0
      ? "No numbers to compare"
      : `${compared.higher} of ${pairs.length} — ${compared.complete ? "complete" : "not complete"}`
  return { pairs, summary, complete: compared.complete }
}

export function describeSourceSquare(input: SourceSquareInput): SourceSquare {
  const stats = statsOn(input.task)
  const ctx = statContextForSquare(input, stats?.set ?? "daily")
  const order = effectiveCompletionSources(input.task)
  const catalog = input.trackingTags ?? []
  const covered = new Set<string>()
  const sources: SourceSquareSource[] = order.map((id) => {
    if (id === "dailyFloor" || id === "habitValue" || id === "dailyCompletionAverage") covered.add(id)
    return {
      id,
      label: COMPLETION_SOURCE_LABELS[id],
      lines: engineLines(id, input.task, input.completion, ctx, catalog),
    }
  })
  for (const point of stats?.points ?? []) {
    if (
      (point.kind === "dailyFloor" && covered.has("dailyFloor")) ||
      (point.kind === "habitValue" && covered.has("habitValue")) ||
      (point.kind === "dailyCompletionAverage" && covered.has("dailyCompletionAverage"))
    ) {
      continue
    }
    const reading = readStatPoint(point, { ...ctx, set: stats?.set ?? "daily" })
    sources.push({ id: reading.key, label: reading.label, lines: linesFromReading(reading) })
  }
  const compare = compareBlock(input.task, ctx)
  const statsRowOnTask = statsRow(input.task)
  const binding = bindingForStatsRow(statsRowOnTask)
  const evaluation = binding ? evaluateHabitStatBinding(binding, ctx) : null
  const outcome = trustedOutcome(
    order,
    readingsFromCell(order, input.completion, input.task.goal, listSentTrustGoal(input.task)),
  )
  const trust =
    outcome.winner == null
      ? "No reading"
      : `${COMPLETION_SOURCE_LABELS[outcome.winner]} — ${outcome.met ? "complete" : "not complete"}`
  const statResult =
    statsRowOnTask?.statBinding && evaluation && !stats?.comparePrevious
      ? evaluation.error
        ? evaluation.error
        : evaluation.value == null
          ? "No reading"
          : `${evaluation.label} — ${formatStatDisplay(evaluation.value)}`
      : null
  return {
    habitName: input.task.name || "Habit",
    periodLabel: input.periodLabel,
    sources,
    result: compare ? compare.summary : (statResult ?? trust),
    compare,
  }
}

/**
 * Live reading for one habit, as of `now`, from the same evaluator the
 * settings preview uses. Null when this habit has no stats binding, or the
 * row compares to the previous period. Does not read a stored number.
 */
export function liveHabitStatEvaluation(task: WeeklyTask, now: Date = new Date()) {
  const row = statsRow(task)
  if (!row || row.stats?.comparePrevious) return null
  const binding = bindingForStatsRow(row)
  if (!binding?.pipelines.length) return null
  const state = useHabitsStore.getState()
  const set = (row.stats?.set ??
    binding.pipelines.find((item) => item.id === binding.pipelineId)?.sourceId ??
    binding.pipelines[0]?.sourceId ??
    "daily") as HabitStatSet
  const ctx = statContextForSquare(
    {
      task,
      periodLabel: "",
      date: now,
      completion: undefined,
      tasks: state.tasks,
      weeklyData: state.weeklyData,
      weeklyHabitData: state.weeklyHabitData,
      monthlyHabitData: state.monthlyHabitData,
      gradeTolerance: state.gradeTolerance,
      outputGradeTolerance: state.outputGradeTolerance,
      today: now,
      isExempt: (habit, key) =>
        isHabitPeriodExempt(habit, key, habit.frequency || "daily", state.habitExemptions, currentExemptionContext()),
    },
    set,
  )
  return evaluateHabitStatBinding(binding, { ...ctx, accomplishmentThreshold: state.accomplishmentThreshold })
}
