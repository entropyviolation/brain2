import { describe, expect, it } from "vitest"
import { describeVsSun, sleepSunForNight, sleepSunSummary } from "./sleep-sun"

describe("sleep vs sun", () => {
  it("measures wake after that morning's sunrise, not today's", () => {
    const sun: Record<string, { sunriseMinutes: number; sunsetMinutes: number }> = {
      "2026-09-13": { sunriseMinutes: 6 * 60 + 40, sunsetMinutes: 18 * 60 + 50 },
      "2026-09-14": { sunriseMinutes: 6 * 60 + 36, sunsetMinutes: 18 * 60 + 46 },
      "2026-09-20": { sunriseMinutes: 6 * 60 + 40, sunsetMinutes: 18 * 60 + 40 },
      "2026-09-21": { sunriseMinutes: 6 * 60 + 42, sunsetMinutes: 18 * 60 + 38 },
    }
    const lookup = (date: string) => sun[date]

    // Woke 7:00 on the 14th; sunrise that morning 6:36 → 24m after.
    const fourteenth = sleepSunForNight({ date: "2026-09-14", sleptMin: -30, wokeMin: 7 * 60 }, lookup)
    expect(fourteenth?.wakeAfterSunrise).toBe(24)
    // Asleep 11:30 PM on the 13th; sunset 6:50 PM → 4h 40m after.
    expect(fourteenth?.sleepAfterSunset).toBe(23 * 60 + 30 - (18 * 60 + 50))

    const twentyFirst = sleepSunForNight({ date: "2026-09-21", sleptMin: -30, wokeMin: 7 * 60 }, lookup)
    expect(twentyFirst?.wakeAfterSunrise).toBe(7 * 60 - (6 * 60 + 42))
    expect(twentyFirst?.wakeAfterSunrise).not.toBe(fourteenth?.wakeAfterSunrise)
  })

  it("summarises a typical (median) offset from stored sun", () => {
    const sun = (date: string) => {
      if (date === "2026-09-14" || date === "2026-09-13") {
        return { sunriseMinutes: 6 * 60 + 36, sunsetMinutes: 18 * 60 + 46 }
      }
      if (date === "2026-09-15" || date === "2026-09-16") {
        return { sunriseMinutes: 6 * 60 + 40, sunsetMinutes: 18 * 60 + 40 }
      }
      return null
    }
    const summary = sleepSunSummary(
      [
        { date: "2026-09-14", sleptMin: -30, wokeMin: 7 * 60 },
        { date: "2026-09-15", sleptMin: -90, wokeMin: 6 * 60 + 10 },
        { date: "2026-09-16", sleptMin: 0, wokeMin: 7 * 60 + 10 },
      ],
      sun,
    )
    expect(summary.nights).toHaveLength(3)
    expect(summary.nights[0]?.wakeAfterSunrise).toBe(24)
    expect(summary.medianWakeAfterSunrise).toBe(summary.nights.map((n) => n.wakeAfterSunrise).sort((a, b) => a - b)[1])
    expect(describeVsSun(24, "sunrise")).toBe("24m after sunrise")
    expect(describeVsSun(-12, "sunrise")).toBe("12m before sunrise")
    expect(describeVsSun(0, "sunset")).toBe("at sunset")
  })
})
