import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useHabitsStore } from "@/lib/habits-store"
import { usePointsStore } from "@/lib/points-store"
import { TaskType } from "@/lib/types"
import { formatLocalDateKey } from "@/lib/date-utils"
import {
  dayGradeLiftTaskId,
  GRADE_BONUS_BOTH,
  gradeBonusTaskId,
  habitDayPointTaskId,
  RAW_DAY_BONUS,
  monthlyAverageBeatTaskId,
  rawDayBonusTaskId,
  weeklyAverageBeatTaskId,
  weeklyGradeLiftTaskId,
} from "@/lib/habit-points"
import { getWeekString } from "@/lib/date-utils"

describe("daily habit points", () => {
  const monday = new Date(2026, 8, 14)

  beforeEach(() => {
    resetAllStores()
    useHabitsStore.getState().setTasks([
      { id: "water", name: "Drink water", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "daily" },
      { id: "pages", name: "Read", type: TaskType.GOAL, goal: 10, rewardValue: 20, frequency: "daily" },
    ])
  })

  it("awards 50 for a checked daily habit and revises a partial goal", () => {
    useHabitsStore.getState().updateCompletion("water", monday, { completed: true })
    const dateKey = formatLocalDateKey(monday)
    expect(
      usePointsStore.getState().pointsHistory.find((e) => e.taskId === habitDayPointTaskId("water", dateKey))?.points,
    ).toBe(50)

    useHabitsStore.getState().updateCompletion("pages", monday, { value: 5 })
    expect(
      usePointsStore.getState().pointsHistory.find((e) => e.taskId === habitDayPointTaskId("pages", dateKey))?.points,
    ).toBe(25)
  })

  it("awards a both-grades bonus when two booleans are fully done", () => {
    useHabitsStore.getState().updateCompletion("water", monday, { completed: true })
    useHabitsStore.getState().updateCompletion("pages", monday, { value: 10 })
    const bonus = usePointsStore
      .getState()
      .pointsHistory.find((e) => e.taskId === gradeBonusTaskId(formatLocalDateKey(monday)))
    expect(bonus?.points).toBe(GRADE_BONUS_BOTH)
    expect(
      usePointsStore.getState().pointsHistory.find((e) => e.taskId === rawDayBonusTaskId(formatLocalDateKey(monday)))
        ?.points,
    ).toBe(RAW_DAY_BONUS)
  })

  it("uses the user accomplishment threshold and bonus instead of the 80/50 defaults", () => {
    useHabitsStore.getState().setAccomplishmentThreshold(100)
    useHabitsStore.getState().setAccomplishmentBonus(12)
    useHabitsStore.getState().updateCompletion("water", monday, { completed: true })
    useHabitsStore.getState().updateCompletion("pages", monday, { value: 10 })
    expect(
      usePointsStore.getState().pointsHistory.find((e) => e.taskId === rawDayBonusTaskId(formatLocalDateKey(monday)))
        ?.points,
    ).toBe(12)

    useHabitsStore.getState().setAccomplishmentThreshold(50)
    useHabitsStore.getState().updateCompletion("pages", monday, { value: 5 })
    expect(
      usePointsStore.getState().pointsHistory.find((e) => e.taskId === rawDayBonusTaskId(formatLocalDateKey(monday)))
        ?.points,
    ).toBe(12)
  })

  it("pays an editable bonus when raw daily completion beats yesterday, and drops it at 0", () => {
    useHabitsStore.getState().setDayGradeLiftBonus(15)
    useHabitsStore.getState().updateCompletion("water", monday, { completed: true })
    useHabitsStore.getState().updateCompletion("pages", monday, { value: 10 })
    const row = usePointsStore
      .getState()
      .pointsHistory.find((e) => e.taskId === dayGradeLiftTaskId(formatLocalDateKey(monday)))
    expect(row?.points).toBe(15)
    expect(row?.taskDescription).toBe("Higher daily completion than yesterday")

    useHabitsStore.getState().setDayGradeLiftBonus(0)
    expect(
      usePointsStore.getState().pointsHistory.find((e) => e.taskId === dayGradeLiftTaskId(formatLocalDateKey(monday))),
    ).toBeUndefined()
  })

  it("pays an editable bonus when this week's rail grades beat last week's full week", () => {
    const lastSunday = new Date(2026, 8, 13)
    const thisMonday = new Date(2026, 8, 14)
    useHabitsStore.getState().setWeeklyGradeLiftBonus(8)
    // Prior week ended empty (0%). This Monday fully done → both Week grade and Perfect output rise.
    useHabitsStore.getState().updateCompletion("water", thisMonday, { completed: true })
    useHabitsStore.getState().updateCompletion("pages", thisMonday, { value: 10 })
    void lastSunday
    const row = usePointsStore
      .getState()
      .pointsHistory.find((e) => e.taskId === weeklyGradeLiftTaskId(getWeekString(thisMonday)))
    expect(row?.points).toBe(16)
    expect(row?.taskDescription).toBe("Higher habit grades than last week")
  })
})

describe("average beat bonuses", () => {
  const sep17 = new Date(2026, 8, 17)

  beforeEach(() => {
    resetAllStores()
    useHabitsStore.getState().setTasks([
      { id: "water", name: "Drink water", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "daily" },
      { id: "pages", name: "Read", type: TaskType.GOAL, goal: 10, rewardValue: 20, frequency: "daily" },
    ])
  })

  function datesFrom(start: Date, end: Date): Date[] {
    const out: Date[] = []
    for (
      let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      cursor.getTime() <= end.getTime();
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
    ) {
      out.push(cursor)
    }
    return out
  }

  function fill(rows: { date: Date; water: boolean; pages: number }[]) {
    const weeklyData: Record<string, Record<string, { completed?: boolean; value?: number }>> = {}
    for (const row of rows) {
      weeklyData[formatLocalDateKey(row.date)] = {
        water: { completed: row.water },
        pages: { value: row.pages },
      }
    }
    useHabitsStore.setState({ weeklyData })
  }

  function row(taskId: string) {
    return usePointsStore.getState().pointsHistory.find((entry) => entry.taskId === taskId)
  }

  const prior7 = datesFrom(new Date(2026, 8, 10), new Date(2026, 8, 16))
  const older = datesFrom(new Date(2026, 7, 18), new Date(2026, 8, 9))
  const weekId = weeklyAverageBeatTaskId("2026-09-17")
  const monthId = monthlyAverageBeatTaskId("2026-09-17")

  it("pays the weekly bonus, the monthly bonus, both, or neither", () => {
    fill([
      ...older.map((date) => ({ date, water: true, pages: 10 })),
      ...prior7.map((date) => ({ date, water: true, pages: 0 })),
      { date: sep17, water: true, pages: 5 },
    ])
    useHabitsStore.getState().setWeeklyAverageBeatBonus(5)
    expect(row(weekId)?.points).toBe(5)
    expect(row(monthId)).toBeUndefined()

    fill([
      ...prior7.map((date) => ({ date, water: true, pages: 10 })),
      { date: sep17, water: true, pages: 5 },
    ])
    useHabitsStore.getState().setMonthlyAverageBeatBonus(5)
    expect(row(weekId)).toBeUndefined()
    expect(row(monthId)?.points).toBe(5)

    fill([...prior7.map((date) => ({ date, water: true, pages: 0 })), { date: sep17, water: true, pages: 10 }])
    useHabitsStore.getState().setWeeklyAverageBeatBonus(5)
    expect(row(weekId)?.points).toBe(5)
    expect(row(monthId)?.points).toBe(5)
    expect(row(weekId)?.taskDescription).toBe("Higher daily completion than the prior 7 days")
    expect(row(monthId)?.taskDescription).toBe("Higher daily completion than the last 30 days")
    expect(usePointsStore.getState().pointsHistory.filter((entry) => entry.taskId === weekId)).toHaveLength(1)
  })

  it("awards neither average bonus when today is not above either average", () => {
    useHabitsStore.getState().setWeeklyAverageBeatBonus(5)
    useHabitsStore.getState().setMonthlyAverageBeatBonus(5)
    expect(usePointsStore.getState().pointsHistory.filter((entry) => entry.taskId.includes("avg-beat"))).toEqual([])
  })

  it("replaces the award when the allocated points change, and removes it when today drops back", () => {
    fill([...prior7.map((date) => ({ date, water: true, pages: 0 }))])
    useHabitsStore.getState().updateCompletion("water", sep17, { completed: true })
    useHabitsStore.getState().updateCompletion("pages", sep17, { value: 10 })
    expect(row(weekId)?.points).toBe(5)
    expect(row(monthId)?.points).toBe(5)

    useHabitsStore.getState().setWeeklyAverageBeatBonus(9)
    expect(row(weekId)?.points).toBe(9)
    expect(row(monthId)?.points).toBe(5)
    expect(usePointsStore.getState().pointsHistory.filter((entry) => entry.taskId === weekId)).toHaveLength(1)

    useHabitsStore.getState().setWeeklyAverageBeatBonus(0)
    expect(row(weekId)).toBeUndefined()
    expect(row(monthId)?.points).toBe(5)

    useHabitsStore.getState().setWeeklyAverageBeatBonus(5)
    useHabitsStore.getState().updateCompletion("pages", sep17, { value: 0 })
    expect(row(weekId)).toBeUndefined()
    expect(row(monthId)?.points).toBe(5)

    useHabitsStore.getState().updateCompletion("water", sep17, { completed: false })
    expect(row(weekId)).toBeUndefined()
    expect(row(monthId)).toBeUndefined()
  })
})
