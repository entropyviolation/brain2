/**
 * lib/habit-pause.test.ts — Pause spans, automatic unpause, exemption, visible lists.
 */
import { describe, expect, it } from "vitest"
import {
  isPausedNow,
  isPausedOn,
  pauseLabel,
  pausedOverlaps,
  visibleHabits,
  withPause,
  withUnpause,
} from "@/lib/habit-pause"
import {
  emptyExemptionBooks,
  exemptionKind,
  isHabitPeriodExempt,
  withExemptionOverride,
} from "@/lib/habit-exemption"
import { dailyHabitsClearFloor } from "@/lib/habit-completion-source"
import { autoPriorityWeight } from "@/lib/habit-priority"
import { TaskType, type WeeklyData, type WeeklyTask } from "@/lib/types"

const ctx = { allNighterMornings: new Set<string>() }

function habit(extra: Partial<WeeklyTask> = {}): WeeklyTask {
  return { id: "water", name: "water plants", type: TaskType.BOOLEAN, frequency: "daily", ...extra }
}

describe("pause spans", () => {
  const residency = habit({ pauses: [{ from: "2026-11-02", to: "2027-01-31" }] })

  it("counts `from` and `to` as paused days", () => {
    expect(isPausedOn(residency, "2026-11-01")).toBe(false)
    expect(isPausedOn(residency, "2026-11-02")).toBe(true)
    expect(isPausedOn(residency, "2027-01-31")).toBe(true)
    expect(isPausedOn(residency, "2027-02-01")).toBe(false)
  })

  it("unpauses on its own the day after `to`", () => {
    expect(isPausedNow(residency, "2027-01-31")).toBe(true)
    expect(isPausedNow(residency, "2027-02-01")).toBe(false)
  })

  it("an open span runs until unpaused", () => {
    const open = habit({ pauses: [{ from: "2026-11-02" }] })
    expect(isPausedNow(open, "2030-01-01")).toBe(true)
    expect(pauseLabel(open, "2026-11-05")).toBe("Paused")
    expect(pauseLabel(residency, "2026-11-05")).toBe("Paused until Jan 31")
  })

  it("overlap counts a single shared day", () => {
    expect(pausedOverlaps(residency, "2026-10-27", "2026-11-02")).toBe(true)
    expect(pausedOverlaps(residency, "2026-10-26", "2026-11-01")).toBe(false)
    expect(pausedOverlaps(residency, "2027-01-31", "2027-02-06")).toBe(true)
  })

  it("ignores malformed spans and a phone-patched null", () => {
    expect(isPausedOn(habit({ pauses: null as never }), "2026-11-02")).toBe(false)
    expect(isPausedOn(habit({ pauses: [{ from: "nope" }] }), "2026-11-02")).toBe(false)
  })

  it("pause appends a span; unpause closes it at yesterday and keeps earlier spans", () => {
    const earlier = habit({ pauses: [{ from: "2026-01-01", to: "2026-01-10" }] })
    const paused = withPause(earlier, "2026-11-02")
    expect(paused.pauses).toEqual([{ from: "2026-01-01", to: "2026-01-10" }, { from: "2026-11-02" }])
    const back = withUnpause(paused, "2026-11-20")
    expect(back.pauses).toEqual([
      { from: "2026-01-01", to: "2026-01-10" },
      { from: "2026-11-02", to: "2026-11-19" },
    ])
    expect(isPausedNow(back, "2026-11-20")).toBe(false)
  })

  it("unpausing a pause that started today drops it", () => {
    const paused = withPause(habit(), "2026-11-02", "2026-12-01")
    const back = withUnpause(paused, "2026-11-02")
    expect(back.pauses).toBeUndefined()
    expect(isPausedNow(back, "2026-11-02")).toBe(false)
  })

  it("an until-date before today pauses indefinitely instead of ending in the past", () => {
    expect(withPause(habit(), "2026-11-02", "2026-11-01").pauses).toEqual([{ from: "2026-11-02" }])
  })
})

describe("visibleHabits", () => {
  const shown = habit({ id: "a" })
  const paused = habit({ id: "b", pauses: [{ from: "2026-11-01", to: "2026-11-30" }] })
  const over = habit({ id: "c", pauses: [{ from: "2026-10-01", to: "2026-10-31" }] })

  it("hides habits paused today unless showPaused", () => {
    expect(visibleHabits([shown, paused, over], "2026-11-02", false).map((t) => t.id)).toEqual(["a", "c"])
    expect(visibleHabits([shown, paused, over], "2026-11-02", true).map((t) => t.id)).toEqual(["a", "b", "c"])
    expect(visibleHabits([shown, paused], "2026-12-01", false).map((t) => t.id)).toEqual(["a", "b"])
  })

  it("keeps the same array when nothing is hidden", () => {
    const list = [shown, over]
    expect(visibleHabits(list, "2026-11-02", false)).toBe(list)
  })
})

describe("pause exemption", () => {
  const books = emptyExemptionBooks()
  const pauses = [{ from: "2026-11-04", to: "2026-11-04" }]

  it("exempts the day, week, month, and season that overlap", () => {
    expect(exemptionKind(habit({ pauses }), "2026-11-04", "daily", books, ctx)).toBe("paused")
    expect(exemptionKind(habit({ pauses }), "2026-11-05", "daily", books, ctx)).toBe("required")
    const weekly = habit({ pauses, frequency: "weekly" })
    expect(isHabitPeriodExempt(weekly, "2026-11-02_2026-11-08", "weekly", books, ctx)).toBe(true)
    expect(isHabitPeriodExempt(weekly, "2026-11-09_2026-11-15", "weekly", books, ctx)).toBe(false)
    const monthly = habit({ pauses, frequency: "monthly" })
    expect(isHabitPeriodExempt(monthly, "2026-11", "monthly", books, ctx)).toBe(true)
    expect(isHabitPeriodExempt(monthly, "2026-12", "monthly", books, ctx)).toBe(false)
    const season = habit({ pauses, frequency: "quarterly" })
    expect(isHabitPeriodExempt(season, "2026-Q4", "quarterly", books, ctx)).toBe(true)
    expect(isHabitPeriodExempt(season, "2027-Q1", "quarterly", books, ctx)).toBe(false)
  })

  it("beats a stored require, and a wand click on it stores nothing", () => {
    const task = habit({ pauses })
    const required = { ...books, daily: { "2026-11-04": { water: false } } }
    expect(exemptionKind(task, "2026-11-04", "daily", required, ctx)).toBe("paused")
    expect(withExemptionOverride(books, "daily", "2026-11-04", task, false, ctx)).toBe(books)
  })

  it("still exempts after the pause is over", () => {
    const task = habit({ pauses: [{ from: "2026-11-02", to: "2026-11-03" }] })
    expect(isHabitPeriodExempt(task, "2026-11-03", "daily", books, ctx)).toBe(true)
  })

  it("the daily floor skips a habit paused all week", () => {
    const week = Array.from({ length: 7 }, (_, i) => new Date(2026, 10, 2 + i))
    const done = habit({ id: "done" })
    const away = habit({ id: "away", pauses: [{ from: "2026-11-01" }] })
    const data: WeeklyData = { "2026-11-02": { done: { completed: true } } }
    const isExempt = (task: WeeklyTask, key: string) => isHabitPeriodExempt(task, key, "daily", books, ctx)
    expect(dailyHabitsClearFloor([done, away], data, week, 0, isExempt)).toBe(true)
    expect(dailyHabitsClearFloor([done, habit({ id: "away" })], data, week, 0, isExempt)).toBe(false)
  })

  it("neglect does not count back across a paused period", () => {
    const empty: WeeklyData = {}
    const asOf = new Date(2026, 11, 7)
    const plain = habit({ frequency: "weekly" })
    const back = habit({ frequency: "weekly", pauses: [{ from: "2026-09-01", to: "2026-11-29" }] })
    expect(autoPriorityWeight(plain, empty, asOf)).toBeGreaterThan(1)
    expect(autoPriorityWeight(back, empty, asOf)).toBe(1)
  })
})
