/**
 * lib/habit-stat-pipeline.ts — Named readings from Habits stats
 *
 * A pipeline names one live number the stats sheet already computes
 * (week grade, perfect output, good days in that week, a day’s percent,
 * one habit’s own percent, and the floor / total / average engines).
 * A binding is one pipeline, or a statement over several.
 * Old `HabitStatsConfig` rows migrate to one simple binding and keep
 * every field they already stored.
 */
import {
  calculatePeriodGrade,
  calculatePeriodOutputGrade,
  calculateWeekToDateGrade,
  calculateWeekToDateOutputGrade,
} from "./calculations"
import { formatLocalDateKey, formatLocalMonthKey, getMonthDates, getWeekDates, getWeekStartDate, getWeekString } from "./date-utils"
import { DEFAULT_ACCOMPLISHMENT_THRESHOLD, isAccomplishedDay, rawDayCompletionPercent } from "./habit-accomplishment"
import { readStatPoint, type HabitStatContext } from "./habit-stat-points"
import { TaskType, type HabitStatPoint, type HabitStatPointKind, type HabitStatSet, type HabitStatsConfig, type TaskCompletion, type WeeklyTask } from "./types"

export interface HabitStatPeriod {
  id: string
  label: string
}

export interface HabitStatOutput {
  id: string
  label: string
  /** One output. Habit id and value id live on the pipeline, not as sibling outputs. */
  specificHabit: boolean
}

export interface HabitStatHabitValue {
  id: string
  label: string
}

export interface HabitStatSource {
  id: HabitStatSet
  label: string
  periods: HabitStatPeriod[]
  outputs: HabitStatOutput[]
  /** Nested choices when the output is specific-habit. */
  habitValues: HabitStatHabitValue[]
}

const WEEK_PERIODS: HabitStatPeriod[] = [
  { id: "thisWeek", label: "This week" },
  { id: "lastWeek", label: "Last week" },
]

const MONTH_PERIODS: HabitStatPeriod[] = [
  { id: "thisMonth", label: "This month" },
  { id: "lastMonth", label: "Last month" },
]

const SPECIFIC_HABIT: HabitStatOutput = { id: "specificHabit", label: "Specific habit", specificHabit: true }

/** Sum of the numbers typed into that habit’s cells. The menu label comes from the habit’s unit. */
export const LOGGED_AMOUNT_VALUE_ID = "loggedAmount"

const LOGGED_AMOUNT: HabitStatHabitValue = { id: LOGGED_AMOUNT_VALUE_ID, label: "Logged amount" }

/**
 * Value-menu name for the logged-amount reading.
 * Pages is “Page total”. Another unit follows the same shape (“Minute total”).
 * No unit is “Logged amount”.
 */
export function loggedAmountValueLabel(unit: string | null | undefined): string {
  const letters = (unit ?? "").trim().replace(/[^A-Za-z]/g, "")
  if (!letters) return "Logged amount"
  let word = letters.toLowerCase()
  if (word.length > 2 && word.endsWith("s") && !word.endsWith("ss")) word = word.slice(0, -1)
  return `${word.charAt(0).toUpperCase()}${word.slice(1)} total`
}

/** Yes/no and text habits have no numeric cell log, so they keep week percent or completion. */
export function habitLogsAmount(habit: { type?: string } | null | undefined): boolean {
  if (!habit?.type) return true
  return habit.type !== TaskType.BOOLEAN && habit.type !== TaskType.TEXT
}

/** Week percent and completion stay. Logged amount is renamed from the habit’s unit, and hidden for yes/no and text. */
export function specificHabitValueOptions(
  source: HabitStatSource,
  habit: { unit?: string; type?: string } | undefined,
): HabitStatHabitValue[] {
  return source.habitValues.flatMap((item) => {
    if (item.id !== LOGGED_AMOUNT_VALUE_ID) return [item]
    if (habit && !habitLogsAmount(habit)) return []
    return [{ id: item.id, label: loggedAmountValueLabel(habit?.unit) }]
  })
}

function out(id: string, label: string): HabitStatOutput {
  return { id, label, specificHabit: false }
}

/** Sources, periods, and outputs the Habits stats row already offers, plus Good days counted with the same accomplishment line. */
export const HABIT_STAT_CATALOG: { sources: HabitStatSource[] } = {
  sources: [
    {
      id: "daily",
      label: "Daily habits",
      periods: WEEK_PERIODS,
      habitValues: [{ id: "weekPercent", label: "Week percent" }, LOGGED_AMOUNT],
      outputs: [
        out("weekGrade", "Week grade"),
        out("perfectOutput", "Perfect output"),
        out("goodDays", "Good days"),
        out("dayPercent", "Day percent"),
        out("dayPercents", "All days"),
        SPECIFIC_HABIT,
        out("habitWeekPercents", "All daily habits"),
        out("dailyFloor", "Daily habits floor"),
        out("habitValue", "Daily habit total"),
        out("dailyCompletionAverage", "Daily completion average"),
      ],
    },
    {
      id: "weekly",
      label: "Weekly habits",
      periods: WEEK_PERIODS,
      habitValues: [{ id: "completion", label: "Completion" }, LOGGED_AMOUNT],
      outputs: [
        out("periodGrade", "Week grade"),
        out("periodOutput", "Perfect output"),
        SPECIFIC_HABIT,
        out("habitCompletions", "All habits"),
      ],
    },
    {
      id: "monthly",
      label: "Monthly habits",
      periods: MONTH_PERIODS,
      habitValues: [{ id: "completion", label: "Completion" }, LOGGED_AMOUNT],
      outputs: [
        out("periodGrade", "Month grade"),
        out("periodOutput", "Perfect output"),
        SPECIFIC_HABIT,
        out("habitCompletions", "All habits"),
      ],
    },
  ],
}

export const SPECIFIC_HABIT_OUTPUT_ID = "specificHabit"

/**
 * Week grade, month grade, and perfect output already return both numbers
 * from `curveDayPercentage` (`rawGrade` and `grade`). The control panel tube
 * shows the curved grade. A saved pipeline with no flag keeps that curved
 * number, so an old module does not change meaning.
 */
export const DEFAULT_HABIT_STAT_GRADE_SCALE = "curved" as const

export type HabitStatGradeScale = "raw" | "curved"

const GRADE_SCALE_OUTPUTS = new Set(["weekGrade", "perfectOutput", "periodGrade", "periodOutput"])

/** True for week / month grade and perfect output, the outputs that already have a raw and a curved number. */
export function outputHasGradeScale(outputId: string): boolean {
  return GRADE_SCALE_OUTPUTS.has(outputId)
}

export interface HabitStatPipeline {
  id: string
  /** The pipeline’s own name. */
  name: string
  /** Variable this pipeline produces. A safe identifier. */
  outputName: string
  sourceId: string
  periodId: string
  outputId: string
  /** Set when `outputId` is specific-habit. */
  habitId?: string
  /** Which value of that habit (`weekPercent`, `completion`, or `loggedAmount`). */
  valueId?: string
  /** `YYYY-MM-DD` when the output is one day’s percent. */
  dayKey?: string
  /**
   * Raw or curved, for week / month grade and perfect output.
   * Absent means {@link DEFAULT_HABIT_STAT_GRADE_SCALE} (curved).
   */
  scale?: HabitStatGradeScale
}

export type HabitStatBinding = {
  mode: "simple" | "statement"
  /** Used when mode is simple. */
  pipelineId?: string
  /** Used when mode is statement. */
  expression?: string
  pipelines: HabitStatPipeline[]
} & Record<string, unknown>

export interface HabitStatBindingContext extends HabitStatContext {
  accomplishmentThreshold?: number
}

export interface HabitStatEvaluation {
  variables: Record<string, number | null>
  value: number | null
  label: string
  error?: string
}

const OUTPUT_NAMES: Record<string, string> = {
  weekGrade: "weekGrade",
  perfectOutput: "perfectOutput",
  goodDays: "goodDays",
  dayPercent: "dayPercent",
  dayPercents: "dayPercents",
  specificHabit: "specificHabit",
  habitWeekPercents: "habitWeekPercents",
  dailyFloor: "dailyFloor",
  habitValue: "habitValue",
  dailyCompletionAverage: "dailyCompletionAverage",
  periodGrade: "periodGrade",
  periodOutput: "periodOutput",
  habitCompletions: "habitCompletions",
}

const POINT_OUTPUT: Partial<Record<HabitStatPointKind, { outputId: string; valueId?: string }>> = {
  weekGrade: { outputId: "weekGrade" },
  perfectOutput: { outputId: "perfectOutput" },
  dayPercent: { outputId: "dayPercent" },
  dayPercents: { outputId: "dayPercents" },
  habitWeekPercent: { outputId: "specificHabit", valueId: "weekPercent" },
  habitWeekPercents: { outputId: "habitWeekPercents" },
  dailyFloor: { outputId: "dailyFloor" },
  habitValue: { outputId: "habitValue" },
  dailyCompletionAverage: { outputId: "dailyCompletionAverage" },
  periodGrade: { outputId: "periodGrade" },
  periodOutput: { outputId: "periodOutput" },
  habitCompletion: { outputId: "specificHabit", valueId: "completion" },
  habitCompletions: { outputId: "habitCompletions" },
}

let pipelineSeq = 0

function nextPipelineId(): string {
  pipelineSeq += 1
  return `habit-stat-${pipelineSeq}`
}

export function findHabitStatSource(sourceId: string): HabitStatSource | undefined {
  return HABIT_STAT_CATALOG.sources.find((source) => source.id === sourceId)
}

export function findHabitStatOutput(sourceId: string, outputId: string): HabitStatOutput | undefined {
  return findHabitStatSource(sourceId)?.outputs.find((output) => output.id === outputId)
}

function sourceAllows(sourceId: string, periodId: string, outputId: string): boolean {
  const source = findHabitStatSource(sourceId)
  if (!source) return false
  if (!source.periods.some((period) => period.id === periodId)) return false
  return source.outputs.some((output) => output.id === outputId)
}

function periodStarted(ctx: HabitStatContext): boolean {
  const todayKey = formatLocalDateKey(ctx.today)
  return ctx.periodDays.some((date) => formatLocalDateKey(date) <= todayKey)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  next.setHours(0, 0, 0, 0)
  return next
}

function contextFor(base: HabitStatBindingContext, pipeline: HabitStatPipeline): HabitStatContext | null {
  if (!sourceAllows(pipeline.sourceId, pipeline.periodId, pipeline.outputId)) return null
  const sourceId = pipeline.sourceId as HabitStatSet
  if (pipeline.periodId === "thisWeek" || pipeline.periodId === "lastWeek") {
    const start =
      pipeline.periodId === "lastWeek" ? addDays(getWeekStartDate(base.weekStart), -7) : getWeekStartDate(base.weekStart)
    return { ...base, set: sourceId, weekStart: start, periodDays: getWeekDates(start) }
  }
  const start = new Date(base.monthStart.getFullYear(), base.monthStart.getMonth(), 1)
  start.setHours(0, 0, 0, 0)
  const monthStart = pipeline.periodId === "lastMonth" ? new Date(start.getFullYear(), start.getMonth() - 1, 1) : start
  monthStart.setHours(0, 0, 0, 0)
  return { ...base, set: sourceId, monthStart, periodDays: getMonthDates(monthStart) }
}

function sheetHasHabits(ctx: HabitStatContext): boolean {
  if (ctx.set === "weekly") return ctx.weeklyTasks.length > 0
  if (ctx.set === "monthly") return ctx.monthlyTasks.length > 0
  return ctx.dailyTasks.length > 0
}

function goodDaysIn(ctx: HabitStatContext, threshold: number): number | null {
  if (!periodStarted(ctx) || ctx.dailyTasks.length === 0) return null
  const todayKey = formatLocalDateKey(ctx.today)
  let count = 0
  for (const date of ctx.periodDays) {
    const key = formatLocalDateKey(date)
    if (key > todayKey) continue
    const raw = rawDayCompletionPercent(ctx.dailyTasks, ctx.weeklyData, date, ctx.isExempt)
    if (isAccomplishedDay(raw, threshold)) count += 1
  }
  return count
}

function loggedNumber(cell: { value?: number } | undefined): number | null {
  if (!cell) return null
  if (typeof cell.value === "number" && Number.isFinite(cell.value)) return cell.value
  return null
}

function tasksOnSheet(ctx: HabitStatContext): WeeklyTask[] {
  if (ctx.set === "weekly") return ctx.weeklyTasks
  if (ctx.set === "monthly") return ctx.monthlyTasks
  return ctx.dailyTasks
}

/**
 * Sum of the numbers typed into that habit’s cells in the period.
 * A day with no number is skipped. An explicit 0 is added. A bare check is not a page count.
 * A yes/no or text habit with no numeric log is null.
 */
function sumLoggedAmount(habitId: string, ctx: HabitStatContext): number | null {
  const habit = tasksOnSheet(ctx).find((item) => item.id === habitId)
  if (!habit) return null
  const numeric = habitLogsAmount(habit)
  if (ctx.set === "weekly" || ctx.set === "monthly") {
    const key = ctx.set === "monthly" ? formatLocalMonthKey(ctx.monthStart) : getWeekString(ctx.weekStart)
    const data = ctx.set === "monthly" ? ctx.monthlyHabitData : ctx.weeklyHabitData
    const amount = loggedNumber(data[key]?.[habitId])
    if (amount == null) return numeric ? 0 : null
    return amount
  }
  const todayKey = formatLocalDateKey(ctx.today)
  let sum = 0
  let seen = false
  for (const date of ctx.periodDays) {
    const key = formatLocalDateKey(date)
    if (key > todayKey) continue
    const amount = loggedNumber(ctx.weeklyData[key]?.[habitId])
    if (amount == null) continue
    seen = true
    sum += amount
  }
  if (!seen) return numeric ? 0 : null
  return sum
}

/** Live number for one pipeline. Null when that period has nothing to read. */
export function habitStatPipelineValue(pipeline: HabitStatPipeline, base: HabitStatBindingContext): number | null {
  const ctx = contextFor(base, pipeline)
  if (!ctx || !periodStarted(ctx)) return null
  if (pipeline.outputId === "goodDays") {
    return goodDaysIn(ctx, base.accomplishmentThreshold ?? DEFAULT_ACCOMPLISHMENT_THRESHOLD)
  }
  if (!sheetHasHabits(ctx) && pipeline.outputId !== "habitValue") return null

  if (pipeline.outputId === "specificHabit") {
    if (!pipeline.habitId) return null
    if (pipeline.valueId === LOGGED_AMOUNT_VALUE_ID) return sumLoggedAmount(pipeline.habitId, ctx)
    const kind: HabitStatPointKind = pipeline.valueId === "completion" ? "habitCompletion" : "habitWeekPercent"
    if (pipeline.valueId === "completion" && ctx.set === "daily") return null
    if (pipeline.valueId === "weekPercent" && ctx.set !== "daily") return null
    const value = readStatPoint({ kind, ref: pipeline.habitId }, ctx).value
    return value == null || !Number.isFinite(value) ? null : value
  }

  if (pipeline.outputId === "dayPercent") {
    if (!pipeline.dayKey) return null
    const value = readStatPoint({ kind: "dayPercent", ref: pipeline.dayKey }, ctx).value
    return value == null || !Number.isFinite(value) ? null : value
  }

  if (outputHasGradeScale(pipeline.outputId)) {
    const pair = gradePair(pipeline, ctx)
    if (!pair) return null
    const value = gradeScale(pipeline) === "raw" ? pair.raw : pair.curved
    return Number.isFinite(value) ? value : null
  }

  const kind = pipeline.outputId as HabitStatPointKind
  if (!POINT_OUTPUT[kind]) return null
  const value = readStatPoint({ kind }, ctx).value
  return value == null || !Number.isFinite(value) ? null : value
}

/** Curved unless the pipeline explicitly asks for raw. */
export function gradeScale(pipeline: Pick<HabitStatPipeline, "scale" | "outputId">): HabitStatGradeScale {
  if (!outputHasGradeScale(pipeline.outputId)) return DEFAULT_HABIT_STAT_GRADE_SCALE
  return pipeline.scale === "raw" ? "raw" : DEFAULT_HABIT_STAT_GRADE_SCALE
}

/** One decimal, the same rounding the settings preview prints. */
export function formatStatDisplay(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—"
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : String(rounded)
}

export function roundStatDisplay(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * True when this habit’s stats row should paint a live week grade, month grade,
 * or perfect output. Logged-amount columns stay on their own path.
 */
export function bindingReadsGradeScale(task: Pick<WeeklyTask, "completionPipelines">): boolean {
  const row = task.completionPipelines?.find((item) => item.kind === "habitsStats")
  if (!row || row.stats?.comparePrevious) return false
  const binding = bindingForStatsRow(row)
  if (!binding?.pipelines.length) return false
  if (binding.pipelines.some((item) => item.valueId === LOGGED_AMOUNT_VALUE_ID)) return false
  return binding.pipelines.some((item) => outputHasGradeScale(item.outputId))
}

/** True when the simple pipeline’s value is the logged cell-number sum. */
export function bindingSelectsLoggedAmount(task: Pick<WeeklyTask, "completionPipelines">): boolean {
  const row = task.completionPipelines?.find((item) => item.kind === "habitsStats")
  const binding = bindingForStatsRow(row)
  if (!binding || binding.mode !== "simple") return false
  const pipeline = binding.pipelines.find((item) => item.id === binding.pipelineId) ?? binding.pipelines[0]
  return pipeline?.outputId === SPECIFIC_HABIT_OUTPUT_ID && pipeline.valueId === LOGGED_AMOUNT_VALUE_ID
}

/**
 * The binding’s live result for a goal cell.
 * Null when the cell was typed by hand, the row is a previous-period compare,
 * or the period has nothing to read. A number sitting on the saved pipeline
 * is not consulted.
 */
export function statBackedGoalShown(
  task: Pick<WeeklyTask, "completionPipelines">,
  completion: Pick<TaskCompletion, "manualValue" | "handCompleted"> | undefined,
  context: HabitStatBindingContext,
): number | null {
  if (completion?.manualValue !== undefined || completion?.handCompleted !== undefined) return null
  const row = task.completionPipelines?.find((item) => item.kind === "habitsStats")
  if (!row || row.stats?.comparePrevious) return null
  const binding = bindingForStatsRow(row)
  if (!binding) return null
  const evaluation = evaluateHabitStatBinding(binding, context)
  if (evaluation.error || evaluation.value == null) return null
  return evaluation.value
}

function gradeScaleAsOf(weekStart: Date, today: Date): Date {
  const dates = getWeekDates(getWeekStartDate(weekStart))
  const todayKey = formatLocalDateKey(today)
  const start = dates[0]
  const end = dates[6]
  if (!start || !end) return today
  if (todayKey < formatLocalDateKey(start)) return start
  if (todayKey > formatLocalDateKey(end)) return end
  return today
}

function gradePair(pipeline: HabitStatPipeline, ctx: HabitStatContext): { raw: number; curved: number } | null {
  if (pipeline.outputId === "weekGrade" || pipeline.outputId === "perfectOutput") {
    const weekDates = getWeekDates(getWeekStartDate(ctx.weekStart))
    const asOf = gradeScaleAsOf(ctx.weekStart, ctx.today)
    const result =
      pipeline.outputId === "weekGrade"
        ? calculateWeekToDateGrade(ctx.dailyTasks, ctx.weeklyData, weekDates, asOf, ctx.gradeTolerance, ctx.isExempt)
        : calculateWeekToDateOutputGrade(
            ctx.dailyTasks,
            ctx.weeklyData,
            weekDates,
            asOf,
            ctx.outputGradeTolerance,
            ctx.isExempt,
          )
    return { raw: result.rawGrade, curved: result.grade }
  }
  if (pipeline.outputId === "periodGrade" || pipeline.outputId === "periodOutput") {
    const monthly = ctx.set === "monthly"
    const tasks = monthly ? ctx.monthlyTasks : ctx.weeklyTasks
    const data = monthly ? ctx.monthlyHabitData : ctx.weeklyHabitData
    const period = monthly
      ? { key: formatLocalMonthKey(ctx.monthStart), date: ctx.monthStart }
      : { key: getWeekString(ctx.weekStart), date: getWeekStartDate(ctx.weekStart) }
    const asOf = monthly ? ctx.monthStart : gradeScaleAsOf(ctx.weekStart, ctx.today)
    const result =
      pipeline.outputId === "periodGrade"
        ? calculatePeriodGrade(tasks, data, [period], asOf, ctx.gradeTolerance, ctx.isExempt)
        : calculatePeriodOutputGrade(tasks, data, [period], asOf, ctx.outputGradeTolerance, ctx.isExempt)
    return { raw: result.rawGrade, curved: result.grade }
  }
  return null
}

function outputLabel(pipeline: HabitStatPipeline): string {
  return findHabitStatOutput(pipeline.sourceId, pipeline.outputId)?.label || pipeline.name || pipeline.outputName
}

export function duplicateHabitStatPipeline(pipeline: HabitStatPipeline): HabitStatPipeline {
  const name = disambiguateName(pipeline.name)
  const outputName = disambiguateOutputName(pipeline.outputName)
  return {
    id: nextPipelineId(),
    name,
    outputName,
    sourceId: pipeline.sourceId,
    periodId: pipeline.periodId,
    outputId: pipeline.outputId,
    ...(pipeline.habitId ? { habitId: pipeline.habitId } : {}),
    ...(pipeline.valueId ? { valueId: pipeline.valueId } : {}),
    ...(pipeline.dayKey ? { dayKey: pipeline.dayKey } : {}),
    ...(pipeline.scale === "raw" || pipeline.scale === "curved" ? { scale: pipeline.scale } : {}),
  }
}

function disambiguateName(name: string): string {
  const trimmed = name.trim() || "Pipeline"
  const match = trimmed.match(/^(.*\S) (\d+)$/)
  if (!match) return `${trimmed} 2`
  return `${match[1]} ${Number.parseInt(match[2], 10) + 1}`
}

function disambiguateOutputName(name: string): string {
  const safe = /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : "output"
  const match = safe.match(/^(.*\D)(\d+)$/)
  if (!match) return `${safe}2`
  return `${match[1]}${Number.parseInt(match[2], 10) + 1}`
}

function pipelineFromPoint(set: HabitStatSet, point: HabitStatPoint): HabitStatPipeline | null {
  const mapped = POINT_OUTPUT[point.kind]
  if (!mapped) return null
  const periodId = set === "monthly" ? "thisMonth" : "thisWeek"
  if (!sourceAllows(set, periodId, mapped.outputId)) return null
  const label = findHabitStatOutput(set, mapped.outputId)?.label || mapped.outputId
  const specific = mapped.outputId === SPECIFIC_HABIT_OUTPUT_ID
  return {
    id: nextPipelineId(),
    name: label,
    outputName: OUTPUT_NAMES[mapped.outputId] || "output",
    sourceId: set,
    periodId,
    outputId: mapped.outputId,
    ...(specific && point.ref ? { habitId: point.ref } : {}),
    ...(specific && mapped.valueId ? { valueId: mapped.valueId } : {}),
    ...(mapped.outputId === "dayPercent" && point.ref ? { dayKey: point.ref } : {}),
  }
}

function isBinding(value: object): boolean {
  const mode = (value as { mode?: unknown }).mode
  return mode === "simple" || mode === "statement"
}

function sanitizePipeline(value: unknown): HabitStatPipeline | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<HabitStatPipeline>
  if (typeof raw.id !== "string" || !raw.id) return null
  if (typeof raw.sourceId !== "string" || typeof raw.periodId !== "string" || typeof raw.outputId !== "string") return null
  if (!sourceAllows(raw.sourceId, raw.periodId, raw.outputId)) return null
  const outputName = typeof raw.outputName === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(raw.outputName) ? raw.outputName : OUTPUT_NAMES[raw.outputId] || "output"
  const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : outputLabel({ ...raw, outputName, name: "" } as HabitStatPipeline)
  const habitId = typeof raw.habitId === "string" && raw.habitId ? raw.habitId : undefined
  const valueId = typeof raw.valueId === "string" && raw.valueId ? raw.valueId : undefined
  const dayKey = typeof raw.dayKey === "string" && raw.dayKey ? raw.dayKey : undefined
  const scale =
    outputHasGradeScale(raw.outputId) && (raw.scale === "raw" || raw.scale === "curved") ? raw.scale : undefined
  return {
    id: raw.id,
    name,
    outputName,
    sourceId: raw.sourceId,
    periodId: raw.periodId,
    outputId: raw.outputId,
    ...(habitId ? { habitId } : {}),
    ...(valueId ? { valueId } : {}),
    ...(dayKey ? { dayKey } : {}),
    ...(scale ? { scale } : {}),
  }
}

/**
 * Turn a saved Habits stats blob into one simple binding.
 * A blob that is already a binding comes back with unknown fields kept.
 * Anything that is not a stats config and not a binding is null.
 */
export function migrateHabitStatsSource(saved: unknown): HabitStatBinding | null {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return null
  if (isBinding(saved)) {
    const raw = saved as HabitStatBinding
    const pipelines = Array.isArray(raw.pipelines) ? raw.pipelines.map(sanitizePipeline).filter((row): row is HabitStatPipeline => !!row) : []
    const rest = { ...raw }
    if (raw.mode === "statement") {
      const expression = typeof raw.expression === "string" ? raw.expression : ""
      return { ...rest, mode: "statement", expression, pipelines }
    }
    const pipelineId = typeof raw.pipelineId === "string" ? raw.pipelineId : pipelines[0]?.id || ""
    return { ...rest, mode: "simple", pipelineId, pipelines }
  }
  const raw = saved as Partial<HabitStatsConfig> & Record<string, unknown>
  if (typeof raw.set !== "string" || (raw.set !== "daily" && raw.set !== "weekly" && raw.set !== "monthly")) return null
  const set = raw.set
  const points = Array.isArray(raw.points) ? raw.points : []
  let pipeline: HabitStatPipeline | null = null
  for (const point of points) {
    if (!point || typeof point !== "object") continue
    pipeline = pipelineFromPoint(set, point as HabitStatPoint)
    if (pipeline) break
  }
  const pipelines = pipeline ? [pipeline] : []
  return {
    ...raw,
    mode: "simple",
    pipelineId: pipeline?.id ?? "",
    pipelines,
  }
}

/** Name the settings screen imports. Same function as `migrateHabitStatsSource`. */
export const migrate = migrateHabitStatsSource

const FAIL = "That statement could not be read"

type Expr =
  | { type: "num"; value: number }
  | { type: "name"; name: string }
  | { type: "cmp"; op: string; left: Expr; right: Expr }
  | { type: "and" | "or"; left: Expr; right: Expr }

class ParseError extends Error {}

function parseStatement(input: string): Expr {
  const src = input.trim()
  let i = 0
  const skip = () => {
    while (src[i] === " " || src[i] === "\t" || src[i] === "\n") i += 1
  }
  const parseOr = (): Expr => {
    let left = parseAnd()
    for (;;) {
      skip()
      if (!src.startsWith("or", i) || /[A-Za-z0-9_]/.test(src[i + 2] || "")) break
      i += 2
      left = { type: "or", left, right: parseAnd() }
    }
    return left
  }
  const parseAnd = (): Expr => {
    let left = parseCmp()
    for (;;) {
      skip()
      if (!src.startsWith("and", i) || /[A-Za-z0-9_]/.test(src[i + 3] || "")) break
      i += 3
      left = { type: "and", left, right: parseCmp() }
    }
    return left
  }
  const parseCmp = (): Expr => {
    const left = parsePrimary()
    skip()
    const ops = [">=", "<=", "==", "!=", ">", "<"]
    const op = ops.find((item) => src.startsWith(item, i))
    if (!op) return left
    i += op.length
    return { type: "cmp", op, left, right: parsePrimary() }
  }
  const parsePrimary = (): Expr => {
    skip()
    if (src[i] === "(") {
      i += 1
      const inner = parseOr()
      skip()
      if (src[i] !== ")") throw new ParseError(FAIL)
      i += 1
      return inner
    }
    if (/[0-9.]/.test(src[i] || "")) {
      const start = i
      i += 1
      while (/[0-9.]/.test(src[i] || "")) i += 1
      const text = src.slice(start, i)
      if (!/^\d+(\.\d+)?$/.test(text)) throw new ParseError(FAIL)
      return { type: "num", value: Number(text) }
    }
    if (/[A-Za-z_]/.test(src[i] || "")) {
      const start = i
      i += 1
      while (/[A-Za-z0-9_]/.test(src[i] || "")) i += 1
      const name = src.slice(start, i)
      if (name === "and" || name === "or") throw new ParseError(FAIL)
      return { type: "name", name }
    }
    throw new ParseError(FAIL)
  }
  if (!src) throw new ParseError(FAIL)
  const expr = parseOr()
  skip()
  if (i !== src.length) throw new ParseError(FAIL)
  return expr
}

function namesIn(expr: Expr, into: Set<string>) {
  if (expr.type === "name") into.add(expr.name)
  else if (expr.type === "cmp" || expr.type === "and" || expr.type === "or") {
    namesIn(expr.left, into)
    namesIn(expr.right, into)
  }
}

function evalExpr(expr: Expr, variables: Record<string, number | null>): number | null {
  if (expr.type === "num") return expr.value
  if (expr.type === "name") return variables[expr.name] ?? null
  const left = evalExpr(expr.left, variables)
  const right = evalExpr(expr.right, variables)
  if (left == null || right == null) return null
  if (expr.type === "and") return left !== 0 && right !== 0 ? 1 : 0
  if (expr.type === "or") return left !== 0 || right !== 0 ? 1 : 0
  switch (expr.op) {
    case ">":
      return left > right ? 1 : 0
    case ">=":
      return left >= right ? 1 : 0
    case "<":
      return left < right ? 1 : 0
    case "<=":
      return left <= right ? 1 : 0
    case "==":
      return left === right ? 1 : 0
    case "!=":
      return left !== right ? 1 : 0
    default:
      return null
  }
}

function variableMap(pipelines: readonly HabitStatPipeline[], ctx: HabitStatBindingContext): Record<string, number | null> {
  const variables: Record<string, number | null> = {}
  for (const pipeline of pipelines) {
    if (!pipeline.outputName) continue
    variables[pipeline.outputName] = habitStatPipelineValue(pipeline, ctx)
  }
  return variables
}

/** Live variables, the binding’s result, and a short label. A bad statement is a null result, not a throw. */
export function evaluateHabitStatBinding(binding: HabitStatBinding, context: HabitStatBindingContext): HabitStatEvaluation {
  const pipelines = binding.pipelines ?? []
  const variables = variableMap(pipelines, context)
  if (binding.mode === "simple") {
    const pipeline = pipelines.find((row) => row.id === binding.pipelineId) ?? null
    if (!pipeline) return { variables, value: null, label: "Pipeline", error: "That pipeline is missing" }
    return { variables, value: variables[pipeline.outputName] ?? null, label: pipeline.name || outputLabel(pipeline) }
  }
  const expression = binding.expression?.trim() || ""
  let expr: Expr
  try {
    expr = parseStatement(expression)
  } catch {
    return { variables, value: null, label: "Statement", error: FAIL }
  }
  const used = new Set<string>()
  namesIn(expr, used)
  for (const name of used) {
    if (!Object.prototype.hasOwnProperty.call(variables, name)) {
      variables[name] = null
      return { variables, value: null, label: expression || "Statement", error: FAIL }
    }
  }
  return { variables, value: evalExpr(expr, variables), label: expression || "Statement" }
}

/** In-memory binding for a habits-stats row. Does not invent one when the row has neither shape. */
export function bindingForStatsRow(row: { stats?: unknown; statBinding?: unknown } | null | undefined): HabitStatBinding | null {
  if (!row) return null
  if (row.statBinding != null) return migrateHabitStatsSource(row.statBinding)
  if (row.stats != null) return migrateHabitStatsSource(row.stats)
  return null
}

function columnMatchesPeriod(periodId: string, columnDate: Date, today: Date): boolean {
  if (periodId === "lastWeek") {
    const last = addDays(getWeekStartDate(today), -7)
    return formatLocalDateKey(getWeekStartDate(columnDate)) === formatLocalDateKey(last)
  }
  if (periodId === "lastMonth") {
    const last = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    return columnDate.getFullYear() === last.getFullYear() && columnDate.getMonth() === last.getMonth()
  }
  return false
}

/**
 * The logged-amount sum for one sheet column, read through `evaluateHabitStatBinding`.
 * This week and this month land on the current column. Last week and last month land on that column.
 * A statement still sees the sum as its variable; the column number is the simple pipeline.
 */
export function loggedAmountForColumn(
  task: Pick<WeeklyTask, "completionPipelines">,
  column: { date: Date; isCurrent: boolean },
  context: HabitStatBindingContext,
): number | null {
  const row = task.completionPipelines?.find((item) => item.kind === "habitsStats")
  const binding = bindingForStatsRow(row)
  if (!binding || binding.mode !== "simple") return null
  const pipeline = binding.pipelines.find((item) => item.id === binding.pipelineId) ?? binding.pipelines[0]
  if (!pipeline || pipeline.outputId !== SPECIFIC_HABIT_OUTPUT_ID || pipeline.valueId !== LOGGED_AMOUNT_VALUE_ID) return null
  const currentReading = pipeline.periodId === "thisWeek" || pipeline.periodId === "thisMonth"
  const matches = currentReading ? column.isCurrent : columnMatchesPeriod(pipeline.periodId, column.date, context.today)
  if (!matches) return null
  const value = evaluateHabitStatBinding(binding, context).value
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

/** Sheet context for a live reading. The pipeline’s own period replaces `periodDays`. */
export function habitStatReadingContext(input: {
  today?: Date
  tasks: readonly WeeklyTask[]
  weeklyData: HabitStatContext["weeklyData"]
  weeklyHabitData: HabitStatContext["weeklyHabitData"]
  monthlyHabitData: HabitStatContext["monthlyHabitData"]
  gradeTolerance: number
  outputGradeTolerance: number
  accomplishmentThreshold?: number
  subject?: WeeklyTask
}): HabitStatBindingContext {
  const today = input.today ?? new Date()
  const weekStart = getWeekStartDate(today)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  monthStart.setHours(0, 0, 0, 0)
  return {
    today,
    weekStart,
    monthStart,
    periodDays: getWeekDates(weekStart),
    set: "daily",
    subject: input.subject,
    dailyTasks: input.tasks.filter((task) => (task.frequency || "daily") === "daily"),
    weeklyTasks: input.tasks.filter((task) => task.frequency === "weekly"),
    monthlyTasks: input.tasks.filter((task) => task.frequency === "monthly"),
    weeklyData: input.weeklyData,
    weeklyHabitData: input.weeklyHabitData,
    monthlyHabitData: input.monthlyHabitData,
    gradeTolerance: input.gradeTolerance,
    outputGradeTolerance: input.outputGradeTolerance,
    accomplishmentThreshold: input.accomplishmentThreshold,
  }
}
