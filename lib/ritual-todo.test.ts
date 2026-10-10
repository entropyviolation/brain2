/**
 * lib/ritual-todo.test.ts — Ritual schedule → calendar day
 */
import { describe, expect, it } from "vitest"
import type { PeriodReview } from "@/lib/types"
import { getWeekString } from "@/lib/date-utils"
import { lunarOccasion } from "@/lib/lunar"
import { ritualDayBoard, ritualTodoPhase, ritualsOnCalendarDay } from "@/lib/ritual-todo"

function titles(date: Date, birthday?: string | null): string[] {
  return ritualsOnCalendarDay(date, birthday).map((rite) => rite.title)
}

function rite(date: Date, title: string) {
  return ritualsOnCalendarDay(date).find((row) => row.title === title)
}

describe("ritualsOnCalendarDay", () => {
  const sunday = new Date(2026, 9, 11, 15, 30, 0)
  const monday = new Date(2026, 9, 12, 8, 0, 0)
  const saturday = new Date(2026, 9, 10, 9, 0, 0)

  it("puts end of week on Sunday and start of week on Monday", () => {
    expect(sunday.getDay()).toBe(0)
    expect(monday.getDay()).toBe(1)
    expect(titles(sunday)).toContain("End of week ritual")
    expect(titles(sunday)).not.toContain("Start of week ritual")
    expect(titles(monday)).toContain("Start of week ritual")
    expect(titles(monday)).not.toContain("End of week ritual")

    const week = getWeekString(sunday)
    expect(rite(sunday, "End of week ritual")?.walk).toEqual({ type: "end", period: "week", periodKey: week })
    expect(rite(monday, "Start of week ritual")?.walk).toEqual({
      type: "start",
      period: "week",
      periodKey: getWeekString(monday),
    })
    expect(week).toBe("2026-10-05_2026-10-11")
    expect(getWeekString(monday)).toBe("2026-10-12_2026-10-18")
  })

  it("keeps morning and night on every day, and only on that day", () => {
    for (const date of [sunday, monday, saturday]) {
      const names = titles(date)
      expect(names.filter((name) => name === "Morning ritual")).toEqual(["Morning ritual"])
      expect(names.filter((name) => name === "Night ritual")).toEqual(["Night ritual"])
    }
    expect(rite(sunday, "Morning ritual")?.dateKey).toBe("2026-10-11")
    expect(rite(monday, "Night ritual")?.dateKey).toBe("2026-10-12")
    expect(rite(sunday, "Night ritual")?.walk).toEqual({
      type: "end",
      period: "day",
      periodKey: "2026-10-11",
    })
  })

  it("puts start of month on the 1st and end of month on the last day, including leap day", () => {
    const oct1 = new Date(2026, 9, 1, 12)
    const oct31 = new Date(2026, 9, 31, 12)
    expect(titles(oct1)).toEqual(
      expect.arrayContaining(["Start of month ritual", "Start of season ritual"]),
    )
    expect(titles(oct1)).not.toContain("End of month ritual")
    expect(titles(oct1)).not.toContain("Start of year ritual")
    expect(rite(oct1, "Start of month ritual")?.walk).toMatchObject({
      type: "start",
      period: "month",
      periodKey: "2026-10",
    })
    expect(rite(oct1, "Start of season ritual")?.walk).toMatchObject({
      type: "start",
      period: "quarter",
      periodKey: "2026-Q4",
    })

    expect(titles(oct31)).toContain("End of month ritual")
    expect(titles(oct31)).not.toContain("Start of month ritual")
    expect(titles(oct31)).not.toContain("End of season ritual")
    expect(rite(oct31, "End of month ritual")?.walk).toMatchObject({
      type: "end",
      period: "month",
      periodKey: "2026-10",
    })

    const feb28Common = new Date(2026, 1, 28, 12)
    const mar1Common = new Date(2026, 2, 1, 12)
    expect(titles(feb28Common)).toContain("End of month ritual")
    expect(titles(mar1Common)).not.toContain("End of month ritual")

    const feb28Leap = new Date(2024, 1, 28, 12)
    const feb29Leap = new Date(2024, 1, 29, 12)
    expect(titles(feb28Leap)).not.toContain("End of month ritual")
    expect(titles(feb29Leap)).toContain("End of month ritual")
    expect(titles(feb29Leap)).not.toContain("End of season ritual")

    const mar31 = new Date(2026, 2, 31, 12)
    expect(titles(mar31)).toContain("End of month ritual")
    expect(titles(mar31)).toContain("End of season ritual")
    expect(rite(mar31, "End of season ritual")?.walk).toMatchObject({
      type: "end",
      period: "quarter",
      periodKey: "2026-Q1",
    })
  })

  it("stacks year and season anchors on the first and last civil days", () => {
    const jan1 = new Date(2026, 0, 1, 12)
    const dec31 = new Date(2026, 11, 31, 12)
    expect(titles(jan1)).toEqual(
      expect.arrayContaining([
        "Morning ritual",
        "Night ritual",
        "Start of month ritual",
        "Start of season ritual",
        "Start of year ritual",
      ]),
    )
    expect(titles(jan1)).not.toContain("End of year ritual")
    expect(titles(dec31)).toEqual(
      expect.arrayContaining([
        "End of month ritual",
        "End of season ritual",
        "End of year ritual",
      ]),
    )
    expect(rite(dec31, "End of year ritual")?.walk).toMatchObject({
      type: "end",
      period: "year",
      periodKey: "2026",
    })
    expect(rite(jan1, "Start of year ritual")?.walk).toMatchObject({
      type: "start",
      period: "year",
      periodKey: "2026",
    })
  })

  it("schedules the Star Lord ritual on the moon day and the birthday", () => {
    expect(lunarOccasion(saturday)).toBe("new")
    expect(titles(saturday)).toContain("Star Lord ritual · New moon")
    expect(titles(saturday)).not.toContain("Star Lord ritual · Full moon")
    expect(titles(sunday)).not.toContain("Star Lord ritual · Birthday")
    expect(rite(saturday, "Star Lord ritual · New moon")?.walk).toEqual({
      type: "star-lord",
      occasion: "new",
      dateKey: "2026-10-10",
    })

    const birthday = new Date(2026, 4, 5, 12)
    expect(titles(birthday, "1990-05-05")).toContain("Star Lord ritual · Birthday")
    expect(titles(birthday)).not.toContain("Star Lord ritual · Birthday")

    const commonBirthday = new Date(2026, 2, 1, 12)
    expect(titles(commonBirthday, "1992-02-29")).toContain("Star Lord ritual · Birthday")
    expect(titles(new Date(2026, 1, 28, 12), "1992-02-29")).not.toContain("Star Lord ritual · Birthday")
    const leapBirthday = new Date(2024, 1, 29, 12)
    expect(titles(leapBirthday, "1992-02-29")).toContain("Star Lord ritual · Birthday")
  })

  it("marks a submitted morning done and leaves an empty night open", () => {
    const board = ritualDayBoard(saturday, [
      {
        id: "day:2026-10-10",
        period: "day",
        periodKey: "2026-10-10",
        completedAt: saturday,
        summary: "",
        gratitude: [],
        nextPlans: "",
        reflections: {},
        resolvedTaskIds: [],
        pushedTaskIds: [],
        morning: { completed: true, wakeTime: "07:00" },
      } satisfies PeriodReview,
    ])
    const morning = board.tasks.find((task) => task.title === "Morning ritual")
    const night = board.tasks.find((task) => task.title === "Night ritual")
    expect(morning?.completed).toBe(true)
    expect(morning?.scheduledDate && (morning.scheduledDate as Date).getDate()).toBe(10)
    expect(night?.completed).toBe(false)
    expect(night?.status).toBe("active")
    const star = board.placements.find((row) => row.title === "Star Lord ritual · New moon")
    expect(star && ritualTodoPhase(star, [], [])).toBe("none")
  })
})
