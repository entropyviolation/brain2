import { describe, expect, it } from "vitest"
import { TaskType, type WeeklyTask } from "@/lib/types"
import { calculateDayPercentageAV, calculateTaskPercentage, calculateWeekToDateGrade, calculateWeekToDateOutputGrade, calculatePeriodColumnPercentage, calculatePeriodGrade, calculatePeriodOutputGrade, calculatePeriodTaskPercentage, gradeAsOfForVisibleWindow, weekToDateDays } from "./calculations"
import { getWeekString } from "./date-utils"

const monday = new Date(2026, 8, 14)
const weekDates = Array.from({ length: 7 }, (_, i) => new Date(2026, 8, 14 + i))

const tasks: WeeklyTask[] = [
  { id: "a", name: "A", type: TaskType.BOOLEAN, frequency: "daily" },
  { id: "b", name: "B", type: TaskType.BOOLEAN, frequency: "daily" },
]

describe("weekToDateDays", () => {
  it("includes Monday only when asOf is Monday", () => {
    expect(weekToDateDays(weekDates, monday)).toHaveLength(1)
  })

  it("includes Mon–Thu when asOf is Thursday", () => {
    expect(weekToDateDays(weekDates, new Date(2026, 8, 17))).toHaveLength(4)
  })

  it("includes the full week when asOf is after Sunday", () => {
    expect(weekToDateDays(weekDates, new Date(2026, 8, 21))).toHaveLength(7)
  })

  it("includes nothing when asOf is before the week", () => {
    expect(weekToDateDays(weekDates, new Date(2026, 8, 13))).toHaveLength(0)
  })
})

describe("gradeAsOfForVisibleWindow", () => {
  const weekStart = weekDates[0]
  const weekEnd = weekDates[6]
  const today = new Date(2026, 8, 17)

  it("keeps the Home date when it falls inside the window", () => {
    expect(gradeAsOfForVisibleWindow(weekStart, weekEnd, new Date(2026, 8, 15), today)).toEqual(
      new Date(2026, 8, 15),
    )
  })

  it("falls back to today when Home date is outside the current week", () => {
    expect(gradeAsOfForVisibleWindow(weekStart, weekEnd, new Date(2026, 7, 5), today)).toEqual(today)
  })

  it("uses the window end for a past week", () => {
    const pastStart = new Date(2026, 8, 7)
    const pastEnd = new Date(2026, 8, 13)
    expect(gradeAsOfForVisibleWindow(pastStart, pastEnd, new Date(2026, 7, 5), today)).toEqual(pastEnd)
  })
})

describe("calculateWeekToDateGrade", () => {
  it("equals Monday's day % on Monday", () => {
    const weeklyData = {
      "2026-09-14": { a: { completed: true }, b: { completed: true } },
    }
    const mondayPct = calculateDayPercentageAV("2026-09-14", tasks, weeklyData, 0)
    const { grade, daysIncluded } = calculateWeekToDateGrade(tasks, weeklyData, weekDates, monday)
    expect(daysIncluded).toBe(1)
    expect(grade).toBe(mondayPct)
    expect(grade).toBe(100)
  })

  it("averages elapsed days so Tuesday is (Mon + Tue) / 2", () => {
    const weeklyData = {
      "2026-09-14": { a: { completed: true }, b: { completed: true } },
      "2026-09-15": { a: { completed: true } },
    }
    const { grade, daysIncluded } = calculateWeekToDateGrade(
      tasks,
      weeklyData,
      weekDates,
      new Date(2026, 8, 15),
    )
    expect(daysIncluded).toBe(2)
    expect(grade).toBe(75)
  })

  it("applies a daily curve so 80% tolerance turns 70/80/90/80 into a 100% grade", () => {
    const many: WeeklyTask[] = Array.from({ length: 10 }, (_, i) => ({
      id: `h${i}`,
      name: `H${i}`,
      type: TaskType.BOOLEAN,
      frequency: "daily",
    }))
    // AV = completed / 10. 7, 8, 9, 8 completions → 70, 80, 90, 80 raw.
    const weeklyData: Record<string, Record<string, { completed: boolean }>> = {
      "2026-09-14": Object.fromEntries(many.slice(0, 7).map((t) => [t.id, { completed: true }])),
      "2026-09-15": Object.fromEntries(many.slice(0, 8).map((t) => [t.id, { completed: true }])),
      "2026-09-16": Object.fromEntries(many.slice(0, 9).map((t) => [t.id, { completed: true }])),
      "2026-09-17": Object.fromEntries(many.slice(0, 8).map((t) => [t.id, { completed: true }])),
    }
    const result = calculateWeekToDateGrade(many, weeklyData, weekDates, new Date(2026, 8, 17), 80)
    expect(result.days.map((d) => d.raw)).toEqual([70, 80, 90, 80])
    expect(result.days.map((d) => d.curved)).toEqual([90, 100, 110, 100])
    expect(result.rawGrade).toBe(80)
    expect(result.grade).toBe(100)
    expect(result.curveBonus).toBe(20)
  })

  it("does not curve a 0% day even when tolerance is 80", () => {
    const weeklyData = {
      "2026-09-14": { a: { completed: true }, b: { completed: true } },
      "2026-09-15": {},
    }
    const result = calculateWeekToDateGrade(tasks, weeklyData, weekDates, new Date(2026, 8, 15), 80)
    expect(result.days.map((d) => d.raw)).toEqual([100, 0])
    expect(result.days.map((d) => d.curved)).toEqual([120, 0])
    expect(result.grade).toBe(60)
  })
})

describe("calculateWeekToDateOutputGrade", () => {
  it("averages elapsed row % so two booleans match week grade on 0/100 cells", () => {
    const weeklyData = {
      "2026-09-14": { a: { completed: true }, b: { completed: true } },
      "2026-09-15": { a: { completed: true } },
    }
    const asOf = new Date(2026, 8, 15)
    const days = calculateWeekToDateGrade(tasks, weeklyData, weekDates, asOf)
    const output = calculateWeekToDateOutputGrade(tasks, weeklyData, weekDates, asOf)
    expect(output.daysIncluded).toBe(2)
    expect(output.habits.map((h) => h.raw)).toEqual([100, 50])
    expect(output.grade).toBe(75)
    expect(days.grade).toBe(output.grade)
  })

  it("paces a goal habit to elapsed days, not the grid’s /7 week %", () => {
    const goal: WeeklyTask[] = [
      { id: "g", name: "Pages", type: TaskType.GOAL, goal: 10, frequency: "daily" },
    ]
    const weeklyData = {
      "2026-09-14": { g: { value: 10 } },
      "2026-09-15": { g: { value: 10 } },
      "2026-09-16": { g: { value: 10 } },
    }
    const thursday = new Date(2026, 8, 17)
    const output = calculateWeekToDateOutputGrade(goal, weeklyData, weekDates, thursday)
    expect(output.daysIncluded).toBe(4)
    expect(output.habits[0].raw).toBe(75)
    expect(output.grade).toBe(75)
  })

  it("diverges from week grade when per-day caps hide overshoot vs row sums", () => {
    const goals: WeeklyTask[] = [
      { id: "a", name: "A", type: TaskType.GOAL, goal: 10, frequency: "daily" },
      { id: "b", name: "B", type: TaskType.GOAL, goal: 10, frequency: "daily" },
    ]
    const weeklyData = {
      "2026-09-14": { a: { value: 20 }, b: { value: 0 } },
      "2026-09-15": { a: { value: 0 }, b: { value: 10 } },
    }
    const asOf = new Date(2026, 8, 15)
    const days = calculateWeekToDateGrade(goals, weeklyData, weekDates, asOf)
    const output = calculateWeekToDateOutputGrade(goals, weeklyData, weekDates, asOf)
    expect(days.grade).toBe(50)
    expect(output.habits.map((h) => h.raw)).toEqual([100, 50])
    expect(output.grade).toBe(75)
  })

  it("uses its own tolerance curve on elapsed row %", () => {
    const weeklyData = {
      "2026-09-14": { a: { completed: true }, b: { completed: true } },
      "2026-09-15": { a: { completed: true } },
    }
    const output = calculateWeekToDateOutputGrade(
      tasks,
      weeklyData,
      weekDates,
      new Date(2026, 8, 15),
      80,
    )
    expect(output.habits.map((h) => h.raw)).toEqual([100, 50])
    expect(output.habits.map((h) => h.curved)).toEqual([120, 70])
    expect(output.rawGrade).toBe(75)
    expect(output.grade).toBe(95)
    expect(output.curveBonus).toBe(20)
  })
})

describe("weekly/monthly period scores", () => {
  const weekA = new Date(2026, 8, 7)
  const weekB = new Date(2026, 8, 14)
  const periods = [
    { key: getWeekString(weekA), date: weekA },
    { key: getWeekString(weekB), date: weekB },
  ]
  const weekly: WeeklyTask[] = [
    { id: "w1", name: "Review", type: TaskType.BOOLEAN, frequency: "weekly" },
    { id: "w2", name: "Deep clean", type: TaskType.GOAL, goal: 60, frequency: "weekly" },
  ]

  it("scores a boolean row as hits / window length", () => {
    const data = {
      [periods[0].key]: { w1: { completed: true } },
    }
    expect(calculatePeriodTaskPercentage("w1", weekly, data, periods)).toBe(50)
  })

  it("caps a goal row at 100% of goal × window length", () => {
    const data = {
      [periods[0].key]: { w2: { value: 60 } },
      [periods[1].key]: { w2: { value: 30 } },
    }
    expect(calculatePeriodTaskPercentage("w2", weekly, data, periods)).toBe(75)
  })

  it("averages a period column across all habits", () => {
    const data = {
      [periods[1].key]: { w1: { completed: true }, w2: { value: 30 } },
    }
    expect(calculatePeriodColumnPercentage(periods[1], weekly, data)).toBe(75)
  })

  it("builds a span grade from elapsed week columns", () => {
    const data = {
      [periods[0].key]: { w1: { completed: true }, w2: { value: 60 } },
      [periods[1].key]: { w1: { completed: true } },
    }
    const grade = calculatePeriodGrade(weekly, data, periods, weekB)
    expect(grade.daysIncluded).toBe(2)
    expect(grade.days[0].raw).toBe(100)
    expect(grade.days[1].raw).toBe(50)
    expect(grade.grade).toBe(75)
  })

  it("builds output from elapsed habit rows", () => {
    const data = {
      [periods[0].key]: { w1: { completed: true }, w2: { value: 60 } },
      [periods[1].key]: { w1: { completed: true } },
    }
    const output = calculatePeriodOutputGrade(weekly, data, periods, weekB)
    expect(output.habits.map((h) => h.raw)).toEqual([100, 50])
    expect(output.grade).toBe(75)
  })
})

describe("exemption wand denominators", () => {
  const waiveA = (task: WeeklyTask, key: string) => task.id === "a" && key === "2026-09-14"

  it("drops a waived day from the weekly row, without counting it done", () => {
    const weeklyData = {
      "2026-09-15": { a: { completed: true } },
      "2026-09-16": { a: { completed: true } },
      "2026-09-17": { a: { completed: true } },
      "2026-09-18": { a: { completed: true } },
      "2026-09-19": { a: { completed: true } },
      "2026-09-20": { a: { completed: true } },
    }
    expect(calculateTaskPercentage("a", tasks, weeklyData, weekDates)).toBeCloseTo((6 / 7) * 100)
    expect(calculateTaskPercentage("a", tasks, weeklyData, weekDates, waiveA)).toBe(100)
  })

  it("drops a waived habit from that day's column", () => {
    const weeklyData = {
      "2026-09-14": { b: { completed: true } },
    }
    expect(calculateDayPercentageAV("2026-09-14", tasks, weeklyData, 0)).toBe(50)
    expect(calculateDayPercentageAV("2026-09-14", tasks, weeklyData, 0, waiveA)).toBe(100)
  })

  it("leaves a fully waived day out of the week grade", () => {
    const weeklyData = {
      "2026-09-15": { a: { completed: true }, b: { completed: true } },
    }
    const waiveMonday = (_task: WeeklyTask, key: string) => key === "2026-09-14"
    const grade = calculateWeekToDateGrade(
      tasks,
      weeklyData,
      weekDates,
      new Date(2026, 8, 15),
      100,
      waiveMonday,
    )
    expect(grade.days[0].vacant).toBe(true)
    expect(grade.grade).toBe(100)
  })

  it("drops a waived week from a weekly habit row", () => {
    const weekA = new Date(2026, 8, 7)
    const weekB = new Date(2026, 8, 14)
    const periods = [
      { key: getWeekString(weekA), date: weekA },
      { key: getWeekString(weekB), date: weekB },
    ]
    const weekly: WeeklyTask[] = [{ id: "w1", name: "Review", type: TaskType.BOOLEAN, frequency: "weekly" }]
    const data = { [periods[1].key]: { w1: { completed: true } } }
    const waiveFirst = (_task: WeeklyTask, key: string) => key === periods[0].key
    expect(calculatePeriodTaskPercentage("w1", weekly, data, periods)).toBe(50)
    expect(calculatePeriodTaskPercentage("w1", weekly, data, periods, waiveFirst)).toBe(100)
  })
})
