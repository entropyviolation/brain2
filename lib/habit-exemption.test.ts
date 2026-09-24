import { describe, expect, it } from "vitest"
import {
  effectiveLogExemptions,
  emptyExemptionBooks,
  exemptionContext,
  exemptionKind,
  isAutoExempt,
  isHabitPeriodExempt,
  streakSkippingExemptDays,
  withExemptionOverride,
} from "./habit-exemption"
import type { WeeklyTask } from "./types"
import { TaskType } from "./types"

const habit = (createdAt?: string): WeeklyTask => ({
  id: "mail",
  name: "Respond to missed emails",
  type: TaskType.BOOLEAN,
  frequency: "daily",
  createdAt,
})

describe("automatic exemption", () => {
  const task = habit("2026-09-16T15:00:00")

  it("waives daily periods that end before the habit existed", () => {
    expect(isAutoExempt(task, new Date(2026, 8, 15), "daily")).toBe(true)
    expect(isAutoExempt(task, new Date(2026, 8, 16), "daily")).toBe(false)
  })

  it("waives a week only when the whole week ended before creation", () => {
    expect(isAutoExempt(task, new Date(2026, 8, 7), "weekly")).toBe(true)
    expect(isAutoExempt(task, new Date(2026, 8, 14), "weekly")).toBe(false)
  })

  it("waives a month only when the month ended before creation", () => {
    expect(isAutoExempt(task, new Date(2026, 7, 1), "monthly")).toBe(true)
    expect(isAutoExempt(task, new Date(2026, 8, 1), "monthly")).toBe(false)
  })

  it("does not invent a creation date", () => {
    expect(isAutoExempt(habit(), new Date(2026, 8, 1), "daily")).toBe(false)
    expect(isAutoExempt({ ...habit(), id: "task-1" }, new Date(2026, 8, 1), "daily")).toBe(false)
  })

  it("reads the creation day from a task-{unix ms} id when createdAt was never stored", () => {
    const created = new Date(2026, 8, 17, 17, 19, 34)
    const older = { ...habit(), id: `task-${created.getTime()}`, createdAt: undefined }
    expect(isAutoExempt(older, new Date(2026, 8, 16), "daily")).toBe(true)
    expect(isAutoExempt(older, new Date(2026, 8, 17), "daily")).toBe(false)
    expect(exemptionKind(older, "2026-09-16", "daily", emptyExemptionBooks())).toBe("auto")
    expect(exemptionKind(older, "2026-09-17", "daily", emptyExemptionBooks())).toBe("required")
    expect(isAutoExempt(older, new Date(2026, 8, 7), "weekly")).toBe(true)
    expect(isAutoExempt(older, new Date(2026, 8, 14), "weekly")).toBe(false)
  })
})

describe("wand overrides", () => {
  const task = habit("2026-09-16T15:00:00")

  it("starts from the automatic rule", () => {
    const books = emptyExemptionBooks()
    expect(exemptionKind(task, "2026-09-15", "daily", books)).toBe("auto")
    expect(exemptionKind(task, "2026-09-16", "daily", books)).toBe("required")
    expect(isHabitPeriodExempt(task, "2026-09-15", "daily", books)).toBe(true)
  })

  it("stores a waive, and a require that overrides the automatic waiver", () => {
    let books = emptyExemptionBooks()
    books = withExemptionOverride(books, "daily", "2026-09-16", task, true)
    expect(books.daily["2026-09-16"]?.mail).toBe(true)
    expect(exemptionKind(task, "2026-09-16", "daily", books)).toBe("waved")

    books = withExemptionOverride(books, "daily", "2026-09-15", task, false)
    expect(books.daily["2026-09-15"]?.mail).toBe(false)
    expect(isHabitPeriodExempt(task, "2026-09-15", "daily", books)).toBe(false)
  })

  it("drops the override when the click matches the automatic rule", () => {
    let books = withExemptionOverride(emptyExemptionBooks(), "daily", "2026-09-16", task, true)
    books = withExemptionOverride(books, "daily", "2026-09-16", task, false)
    expect(books.daily["2026-09-16"]).toBeUndefined()
    expect(exemptionKind(task, "2026-09-16", "daily", books)).toBe("required")
  })
})

describe("streakSkippingExemptDays", () => {
  it("lets an exempt day sit inside a run without counting or breaking it", () => {
    const met = ["2026-09-14", "2026-09-16"]
    const exempt = new Set(["2026-09-15"])
    const streak = streakSkippingExemptDays(met, (key) => exempt.has(key), new Date(2026, 8, 16))
    expect(streak.current).toBe(2)
    expect(streak.longest).toBe(2)
  })

  it("still breaks on a required day that was missed", () => {
    const streak = streakSkippingExemptDays(["2026-09-14"], () => false, new Date(2026, 8, 16))
    expect(streak.current).toBe(0)
    expect(streak.longest).toBe(1)
  })
})

describe("all-nighter log blocks", () => {
  const nights = exemptionContext({ "2026-09-24": { allNighter: true } })
  const bedtime = habit()
  bedtime.name = "'bedtime' before 11 (with caveats)"
  const wake = habit()
  wake.name = "wake up before 9"
  const dream = habit()
  dream.name = "Document dream"

  it("uses the name preset until the habit stores its own blocks", () => {
    expect(effectiveLogExemptions(bedtime)).toEqual([{ when: "all-nighter", day: "evening-before" }])
    expect(effectiveLogExemptions(wake)).toEqual([{ when: "all-nighter", day: "morning-of" }])
    expect(effectiveLogExemptions(dream)).toEqual([{ when: "all-nighter", day: "morning-of" }])
    expect(effectiveLogExemptions({ ...dream, logExemptions: [] })).toEqual([])
  })

  it("lifts the evening before for bedtime and that morning for wake and dream", () => {
    expect(exemptionKind(bedtime, "2026-09-23", "daily", emptyExemptionBooks(), nights)).toBe("logged")
    expect(exemptionKind(bedtime, "2026-09-24", "daily", emptyExemptionBooks(), nights)).toBe("required")
    expect(exemptionKind(wake, "2026-09-24", "daily", emptyExemptionBooks(), nights)).toBe("logged")
    expect(exemptionKind(wake, "2026-09-23", "daily", emptyExemptionBooks(), nights)).toBe("required")
    expect(exemptionKind(dream, "2026-09-24", "daily", emptyExemptionBooks(), nights)).toBe("logged")
    expect(isHabitPeriodExempt(bedtime, "2026-09-23", "weekly", emptyExemptionBooks(), nights)).toBe(false)
  })

  it("lets a require override beat the log, and clears it when the click matches the log again", () => {
    const required = withExemptionOverride(emptyExemptionBooks(), "daily", "2026-09-23", bedtime, false, nights)
    expect(exemptionKind(bedtime, "2026-09-23", "daily", required, nights)).toBe("required")
    const cleared = withExemptionOverride(required, "daily", "2026-09-23", bedtime, true, nights)
    expect(cleared.daily["2026-09-23"]).toBeUndefined()
    expect(exemptionKind(bedtime, "2026-09-23", "daily", cleared, nights)).toBe("logged")
  })
})
