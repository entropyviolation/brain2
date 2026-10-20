import { describe, expect, it } from "vitest"
import { calendarDayDiff, countdownFace, nextOccurrence, workdaysBetween } from "@/lib/countdown"
import { DEFAULT_HOME_DAYS_UNTIL_ITEM, type HomeDaysUntilItem } from "@/lib/home-days-until-store"

const NOW = new Date(2026, 9, 20, 9, 0) // Tue Oct 20 2026, 09:00

function mark(patch: Partial<HomeDaysUntilItem>): HomeDaysUntilItem {
  return { ...DEFAULT_HOME_DAYS_UNTIL_ITEM, id: "m", label: "Launch", mode: "countdown", ...patch }
}

describe("countdownFace", () => {
  it("asks for a date when none is set", () => {
    expect(countdownFace(mark({ date: "" }), NOW)).toMatchObject({ crt: "—", footer: "Set a date" })
  })

  it("keeps the old unit face", () => {
    const face = countdownFace(mark({ date: "2026-10-22", format: "unit" }), NOW)
    expect(face.crt).toBe("01 day 15 hours")
    expect(face.footer).toBe("Until Launch")
    expect(face.caption).toBe("Countdown")
  })

  it("counts whole days, weeks, sleeps, and working days", () => {
    expect(countdownFace(mark({ date: "2026-10-30", format: "days" }), NOW)).toMatchObject({ crt: "10", footer: "days until Launch" })
    expect(countdownFace(mark({ date: "2026-11-03", format: "weeks" }), NOW)).toMatchObject({ crt: "2", footer: "weeks until Launch" })
    expect(countdownFace(mark({ date: "2026-10-21", format: "sleeps" }), NOW)).toMatchObject({ crt: "1", footer: "sleep until Launch" })
    // Wed 21 .. Mon 26: Wed Thu Fri Mon = 4
    expect(countdownFace(mark({ date: "2026-10-26", format: "workdays" }), NOW)).toMatchObject({ crt: "4", footer: "working days until Launch" })
  })

  it("rolls a yearly mark to the next occurrence", () => {
    const face = countdownFace(mark({ label: "Birthday", date: "1990-03-14", format: "days", repeat: "yearly" }), NOW)
    expect(face.date).toBe("2027-03-14")
    expect(face.footer).toBe("days until Birthday")
    expect(nextOccurrence("2000-02-29", "yearly", NOW)).toBe("2027-02-28")
    expect(nextOccurrence("2026-01-31", "monthly", NOW)).toBe("2026-10-31")
    expect(nextOccurrence("2026-01-05", "monthly", NOW)).toBe("2026-11-05")
  })

  it("draws progress from a start date", () => {
    const face = countdownFace(mark({ date: "2026-10-30", start: "2026-10-10", format: "days" }), NOW)
    expect(face.progress).toBeGreaterThan(0.45)
    expect(face.progress).toBeLessThan(0.55)
  })

  it("does what it was told once a countdown passes", () => {
    const past = { date: "2026-10-01", format: "days" as const }
    expect(countdownFace(mark({ ...past, whenPassed: "stay" }), NOW)).toMatchObject({ crt: "0", footer: "Launch passed", passed: true })
    expect(countdownFace(mark({ ...past, whenPassed: "countup" }), NOW)).toMatchObject({ crt: "19", footer: "days since Launch", caption: "Count up" })
    expect(countdownFace(mark({ ...past, whenPassed: "hide" }), NOW).hidden).toBe(true)
  })

  it("lights a milestone on a count-up's round number", () => {
    const hundred = countdownFace(mark({ mode: "countup", date: "2026-07-12", format: "days", milestones: true }), NOW)
    expect(hundred.milestone).toBe("100 days")
    expect(hundred.footer).toBe("100 days · days since Launch")
    const year = countdownFace(mark({ mode: "countup", date: "2024-10-20", format: "days", milestones: true }), NOW)
    expect(year.milestone).toBe("2 years")
    expect(countdownFace(mark({ mode: "countup", date: "2026-07-12", format: "days" }), NOW).milestone).toBeNull()
  })

  it("says today on the day of a date-only mark", () => {
    expect(countdownFace(mark({ date: "2026-10-20", format: "days" }), NOW)).toMatchObject({ crt: "0", footer: "Launch is today" })
  })
})

describe("day math", () => {
  it("counts calendar days and weekdays", () => {
    expect(calendarDayDiff(new Date(2026, 2, 7, 23), new Date(2026, 2, 9, 1))).toBe(2)
    expect(workdaysBetween(new Date(2026, 9, 23), new Date(2026, 9, 26))).toBe(1) // Fri -> Mon
  })
})
