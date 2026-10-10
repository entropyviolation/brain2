import { describe, expect, it } from "vitest"
import { calculatePeriodGrade, calculateWeekToDateGrade, calculateWeekToDateOutputGrade } from "./calculations"
import { formatLocalDateKey, getWeekDates, getWeekString } from "./date-utils"
import { effectiveHabitCount } from "./habit-completion-pipeline"
import {
  DEFAULT_HABIT_STAT_GRADE_SCALE,
  duplicateHabitStatPipeline,
  evaluateHabitStatBinding,
  HABIT_STAT_CATALOG,
  loggedAmountForColumn,
  loggedAmountValueLabel,
  migrateHabitStatsSource,
  statBackedGoalShown,
  type HabitStatBindingContext,
  type HabitStatPipeline,
} from "./habit-stat-pipeline"
import { TaskType, type WeeklyTask } from "./types"

const weekStart = new Date(2026, 9, 5)
const today = new Date(2026, 9, 11)

function filledWeek(): HabitStatBindingContext {
  const days = getWeekDates(weekStart)
  const weeklyData: HabitStatBindingContext["weeklyData"] = {}
  for (const date of days) {
    weeklyData[formatLocalDateKey(date)] = { read: { completed: true } }
  }
  const daily: WeeklyTask = { id: "read", name: "Read", type: TaskType.BOOLEAN, frequency: "daily" }
  return {
    today,
    weekStart,
    monthStart: new Date(2026, 9, 1),
    periodDays: days,
    set: "daily",
    dailyTasks: [daily],
    weeklyTasks: [],
    monthlyTasks: [],
    weeklyData,
    weeklyHabitData: {},
    monthlyHabitData: {},
    gradeTolerance: 100,
    outputGradeTolerance: 100,
    accomplishmentThreshold: 80,
  }
}

function pipeline(partial: Partial<HabitStatPipeline> & Pick<HabitStatPipeline, "id" | "outputName" | "outputId">): HabitStatPipeline {
  return {
    name: partial.outputName,
    sourceId: "daily",
    periodId: "thisWeek",
    ...partial,
  }
}

describe("habit stat catalog", () => {
  it("lists the existing outputs and nests a specific habit", () => {
    const daily = HABIT_STAT_CATALOG.sources.find((source) => source.id === "daily")
    const weekly = HABIT_STAT_CATALOG.sources.find((source) => source.id === "weekly")
    const monthly = HABIT_STAT_CATALOG.sources.find((source) => source.id === "monthly")
    expect(daily?.periods.map((period) => period.id)).toEqual(["thisWeek", "lastWeek"])
    expect(monthly?.periods.map((period) => period.id)).toEqual(["thisMonth", "lastMonth"])
    expect(daily?.outputs.map((output) => output.id)).toEqual([
      "weekGrade",
      "perfectOutput",
      "goodDays",
      "dayPercent",
      "dayPercents",
      "specificHabit",
      "habitWeekPercents",
      "dailyFloor",
      "habitValue",
      "dailyCompletionAverage",
    ])
    expect(weekly?.outputs.map((output) => output.id)).toEqual([
      "periodGrade",
      "periodOutput",
      "specificHabit",
      "habitCompletions",
    ])
    const specific = HABIT_STAT_CATALOG.sources.flatMap((source) => source.outputs).filter((output) => output.specificHabit)
    expect(specific.map((output) => output.id)).toEqual(["specificHabit", "specificHabit", "specificHabit"])
    expect(daily?.habitValues.map((value) => value.id)).toEqual(["weekPercent", "loggedAmount"])
    expect(weekly?.habitValues.map((value) => value.id)).toEqual(["completion", "loggedAmount"])
    expect(monthly?.habitValues.map((value) => value.id)).toEqual(["completion", "loggedAmount"])
    expect(daily?.outputs.filter((output) => output.id === "weekPercent" || output.id === "completion")).toEqual([])
  })
})

describe("evaluateHabitStatBinding", () => {
  const ctx = filledWeek()

  it("returns the simple pipeline’s live value", () => {
    const row = pipeline({ id: "grade", outputName: "weekGrade", outputId: "weekGrade", name: "Week grade" })
    const result = evaluateHabitStatBinding({ mode: "simple", pipelineId: "grade", pipelines: [row] }, ctx)
    expect(result.error).toBeUndefined()
    expect(result.value).toBe(result.variables.weekGrade)
    expect(result.value).toBeGreaterThan(80)
    expect(result.label).toBe("Week grade")
  })

  it("combines two live variables", () => {
    const pipelines = [
      pipeline({ id: "days", outputName: "goodDays", outputId: "goodDays", name: "Good days" }),
      pipeline({ id: "grade", outputName: "weekGrade", outputId: "weekGrade", name: "Week grade" }),
    ]
    const result = evaluateHabitStatBinding(
      { mode: "statement", expression: "goodDays >= 5 and weekGrade > 80", pipelines },
      ctx,
    )
    expect(result.value).toBe(1)
    expect(result.variables.goodDays).toBeGreaterThanOrEqual(5)
    expect(result.variables.weekGrade).toBeGreaterThan(80)
  })

  it("is null when the week has no daily habits", () => {
    const row = pipeline({ id: "grade", outputName: "weekGrade", outputId: "weekGrade", name: "Week grade" })
    const empty = { ...filledWeek(), dailyTasks: [], weeklyData: {} }
    const result = evaluateHabitStatBinding({ mode: "simple", pipelineId: "grade", pipelines: [row] }, empty)
    expect(result.value).toBeNull()
    expect(result.variables.weekGrade).toBeNull()
  })

  it("returns null for a bad statement without throwing", () => {
    const row = pipeline({ id: "grade", outputName: "weekGrade", outputId: "weekGrade" })
    expect(() =>
      evaluateHabitStatBinding({ mode: "statement", expression: "weekGrade + 1", pipelines: [row] }, ctx),
    ).not.toThrow()
    const result = evaluateHabitStatBinding({ mode: "statement", expression: "weekGrade + 1", pipelines: [row] }, ctx)
    expect(result.value).toBeNull()
    expect(result.error).toBeTruthy()
  })
})

describe("duplicateHabitStatPipeline", () => {
  it("copies the reading and changes identity", () => {
    const original = pipeline({
      id: "one",
      name: "Week grade",
      outputName: "weekGrade",
      outputId: "specificHabit",
      sourceId: "daily",
      periodId: "lastWeek",
      habitId: "read",
      valueId: "weekPercent",
      dayKey: "2026-10-05",
    })
    const copy = duplicateHabitStatPipeline(original)
    expect(copy.id).not.toBe(original.id)
    expect(copy.name).not.toBe(original.name)
    expect(copy.outputName).not.toBe(original.outputName)
    expect(copy.sourceId).toBe("daily")
    expect(copy.periodId).toBe("lastWeek")
    expect(copy.outputId).toBe("specificHabit")
    expect(copy.habitId).toBe("read")
    expect(copy.valueId).toBe("weekPercent")
    expect(copy.dayKey).toBe("2026-10-05")
  })
})

describe("migrateHabitStatsSource", () => {
  it("turns an old stats source into a simple binding that still evaluates", () => {
    const saved = { set: "daily" as const, points: [{ kind: "weekGrade" as const }], note: "keep me" }
    const binding = migrateHabitStatsSource(saved)
    expect(binding?.mode).toBe("simple")
    expect(binding?.note).toBe("keep me")
    expect(binding?.points).toEqual(saved.points)
    const result = evaluateHabitStatBinding(binding!, filledWeek())
    expect(result.value).toBeGreaterThan(80)
    expect(result.value).toBe(result.variables.weekGrade)
  })
})

function curvedWeek(done: boolean): HabitStatBindingContext {
  const days = getWeekDates(weekStart)
  const weeklyData: HabitStatBindingContext["weeklyData"] = {}
  for (const date of days) {
    weeklyData[formatLocalDateKey(date)] = { read: done ? { completed: true } : { completed: false } }
  }
  const daily: WeeklyTask = { id: "read", name: "Read", type: TaskType.BOOLEAN, frequency: "daily" }
  const weekly: WeeklyTask = { id: "lift", name: "Lift", type: TaskType.BOOLEAN, frequency: "weekly" }
  const weekKey = getWeekString(weekStart)
  return {
    today,
    weekStart,
    monthStart: new Date(2026, 9, 1),
    periodDays: days,
    set: "daily",
    dailyTasks: [daily],
    weeklyTasks: [weekly],
    monthlyTasks: [],
    weeklyData,
    weeklyHabitData: { [weekKey]: { lift: { completed: done } } },
    monthlyHabitData: {},
    gradeTolerance: 80,
    outputGradeTolerance: 80,
    accomplishmentThreshold: 80,
  }
}

describe("perfect output and span grade", () => {
  const full = curvedWeek(true)
  const empty = curvedWeek(false)
  const weekDates = getWeekDates(weekStart)

  it("follows the live perfect output instead of a stored 59.9", () => {
    const row = pipeline({ id: "out", outputName: "perfectOutput", outputId: "perfectOutput", name: "Perfect output" })
    const binding = { mode: "simple" as const, pipelineId: "out", pipelines: [row], value: 59.9 }
    const before = evaluateHabitStatBinding(binding, empty)
    const after = evaluateHabitStatBinding(binding, full)
    expect(before.value).not.toBe(59.9)
    expect(after.value).not.toBe(59.9)
    expect(after.value).not.toBe(before.value)
    const task: WeeklyTask = {
      id: "mirror",
      name: "Mirror",
      type: TaskType.GOAL,
      goal: 100,
      frequency: "weekly",
      completionPipelines: [{ id: "pipe", kind: "habitsStats", sources: [], statBinding: binding }],
    }
    expect(statBackedGoalShown(task, { value: 59.9 }, full)).toBe(after.value)
    expect(statBackedGoalShown(task, { value: 59.9, handCompleted: true }, full)).toBeNull()
  })

  it("returns curved or raw for perfect output and week grade", () => {
    const output = calculateWeekToDateOutputGrade(full.dailyTasks, full.weeklyData, weekDates, today, 80)
    const grade = calculateWeekToDateGrade(full.dailyTasks, full.weeklyData, weekDates, today, 80)
    expect(output.rawGrade).not.toBe(output.grade)
    expect(grade.rawGrade).not.toBe(grade.grade)
    const perfect = (scale?: "raw" | "curved") =>
      evaluateHabitStatBinding(
        {
          mode: "simple",
          pipelineId: "out",
          pipelines: [pipeline({ id: "out", outputName: "perfectOutput", outputId: "perfectOutput", ...(scale ? { scale } : {}) })],
        },
        full,
      ).value
    const week = (scale?: "raw" | "curved") =>
      evaluateHabitStatBinding(
        {
          mode: "simple",
          pipelineId: "grade",
          pipelines: [pipeline({ id: "grade", outputName: "weekGrade", outputId: "weekGrade", ...(scale ? { scale } : {}) })],
        },
        full,
      ).value
    expect(perfect("curved")).toBe(output.grade)
    expect(perfect("raw")).toBe(output.rawGrade)
    expect(perfect()).toBe(output.grade)
    expect(DEFAULT_HABIT_STAT_GRADE_SCALE).toBe("curved")
    expect(week("curved")).toBe(grade.grade)
    expect(week("raw")).toBe(grade.rawGrade)
    expect(week()).toBe(grade.grade)
  })

  it("returns curved or raw for the weekly span grade", () => {
    const weekKey = getWeekString(weekStart)
    const period = { key: weekKey, date: weekStart }
    const span = calculatePeriodGrade(full.weeklyTasks, full.weeklyHabitData, [period], today, 80)
    expect(span.rawGrade).not.toBe(span.grade)
    const read = (scale?: "raw" | "curved") =>
      evaluateHabitStatBinding(
        {
          mode: "simple",
          pipelineId: "span",
          pipelines: [
            pipeline({
              id: "span",
              outputName: "periodGrade",
              outputId: "periodGrade",
              sourceId: "weekly",
              ...(scale ? { scale } : {}),
            }),
          ],
        },
        full,
      ).value
    expect(read("curved")).toBe(span.grade)
    expect(read("raw")).toBe(span.rawGrade)
    expect(read()).toBe(span.grade)
  })

  it("lets a statement read the chosen perfect output", () => {
    const row = pipeline({ id: "out", outputName: "perfectOutput", outputId: "perfectOutput", scale: "raw" })
    const result = evaluateHabitStatBinding(
      { mode: "statement", expression: "perfectOutput > 50", pipelines: [row] },
      full,
    )
    expect(result.variables.perfectOutput).toBe(
      calculateWeekToDateOutputGrade(full.dailyTasks, full.weeklyData, weekDates, today, 80).rawGrade,
    )
    expect(result.value).toBe(1)
  })

  it("drops a frozen number and keeps a missing scale on the curved default", () => {
    const binding = migrateHabitStatsSource({
      mode: "simple",
      pipelineId: "out",
      pipelines: [
        {
          id: "out",
          name: "Perfect output",
          outputName: "perfectOutput",
          sourceId: "daily",
          periodId: "thisWeek",
          outputId: "perfectOutput",
          value: 59.9,
        },
      ],
    })
    expect(binding?.pipelines[0]?.scale).toBeUndefined()
    expect(binding?.pipelines[0]).not.toHaveProperty("value")
    const live = calculateWeekToDateOutputGrade(full.dailyTasks, full.weeklyData, weekDates, today, 80)
    expect(evaluateHabitStatBinding(binding!, full).value).toBe(live.grade)
  })
})

describe("logged amount", () => {
  it("sums 5, 5, and 3 for the named variable and still returns week percent", () => {
    const days = getWeekDates(weekStart)
    const keys = days.map((date) => formatLocalDateKey(date))
    const weeklyData: HabitStatBindingContext["weeklyData"] = {
      [keys[0]]: { read: { value: 5 } },
      [keys[1]]: { read: { value: 5 } },
      [keys[2]]: { read: { value: 3 } },
      [keys[4]]: { read: { value: 0 } },
    }
    const daily: WeeklyTask = {
      id: "read",
      name: "Read at least 5 pages per day",
      type: TaskType.GOAL,
      frequency: "daily",
      unit: "pages",
      goal: 5,
    }
    const ctx: HabitStatBindingContext = { ...filledWeek(), dailyTasks: [daily], weeklyData }
    const row = pipeline({
      id: "pages",
      name: "Weekly pages",
      outputName: "weeklyPages",
      outputId: "specificHabit",
      habitId: "read",
      valueId: "loggedAmount",
    })
    const result = evaluateHabitStatBinding({ mode: "simple", pipelineId: "pages", pipelines: [row] }, ctx)
    expect(result.error).toBeUndefined()
    expect(result.variables.weeklyPages).toBe(13)
    expect(result.value).toBe(13)
    const percent = evaluateHabitStatBinding(
      {
        mode: "simple",
        pipelineId: "pct",
        pipelines: [
          pipeline({
            id: "pct",
            outputName: "weekPercent",
            outputId: "specificHabit",
            habitId: "read",
            valueId: "weekPercent",
          }),
        ],
      },
      ctx,
    )
    expect(percent.value).not.toBe(13)
    expect(typeof percent.value).toBe("number")
    const stated = evaluateHabitStatBinding({ mode: "statement", expression: "weeklyPages > 10", pipelines: [row] }, ctx)
    expect(stated.variables.weeklyPages).toBe(13)
    expect(stated.value).toBe(1)
    const parent: WeeklyTask = {
      id: "week",
      name: "Read 30 pages",
      type: TaskType.GOAL,
      goal: 30,
      frequency: "weekly",
      completionPipelines: [{ id: "pipe", kind: "habitsStats", sources: [], statBinding: { mode: "simple", pipelineId: "pages", pipelines: [row] } }],
    }
    expect(loggedAmountForColumn(parent, { date: weekStart, isCurrent: true }, ctx)).toBe(13)
    expect(loggedAmountForColumn(parent, { date: weekStart, isCurrent: false }, ctx)).toBeNull()
    const yes: WeeklyTask = { id: "water", name: "Water", type: TaskType.BOOLEAN, frequency: "daily" }
    const blank: HabitStatBindingContext = {
      ...ctx,
      dailyTasks: [yes],
      weeklyData: { [keys[0]]: { water: { completed: true } } },
    }
    const none = evaluateHabitStatBinding(
      {
        mode: "simple",
        pipelineId: "pages",
        pipelines: [
          pipeline({
            id: "pages",
            outputName: "weeklyPages",
            outputId: "specificHabit",
            habitId: "water",
            valueId: "loggedAmount",
          }),
        ],
      },
      blank,
    )
    expect(none.variables.weeklyPages).toBeNull()
    expect(loggedAmountValueLabel("pages")).toBe("Page total")
    expect(loggedAmountValueLabel("minutes")).toBe("Minute total")
    expect(loggedAmountValueLabel("")).toBe("Logged amount")
  })
})

describe("list length", () => {
  it("is unchanged by a stats binding", () => {
    const now = new Date(2026, 9, 9, 12, 0, 0)
    const items = [
      { title: "Ruggles", lists: ["texts"], sentAtByList: { texts: now.toISOString() } },
      { title: "Rebecca", lists: ["texts"] },
      { title: "Cammy", lists: ["texts"] },
      { title: "An", lists: ["texts"] },
      { title: "Fifth", lists: ["texts"] },
    ]
    const habit: WeeklyTask = {
      id: "texts",
      name: "respond to all missing texts",
      type: TaskType.GOAL,
      goal: 100,
      frequency: "weekly",
      completionSources: ["manual", "listSent"],
      listSentLink: { listId: "texts", grace: 100, measure: "sent", target: "listLength" },
    }
    expect(migrateHabitStatsSource(habit)).toBeNull()
    expect(effectiveHabitCount(habit, undefined, items, now)).toEqual({ current: 1, target: 5, derived: true })
  })
})
