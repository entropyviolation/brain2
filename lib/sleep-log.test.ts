import { describe, expect, it } from "vitest"
import {
  describeShift,
  isNightEstimated,
  nightProblem,
  offsetToClock,
  offsetToLabel,
  parseBedtime,
  parseWakeTime,
  placeAsleepOnDay,
  placeAwakeOnDay,
  sleepIntervals,
  sleepMinutes,
  sleepRowsForDay,
  sleepStats,
  sleepTrend,
  type SleepNight,
} from "./sleep-log"

const night = (over: Partial<SleepNight> & { date: string }): SleepNight => ({
  sleptPrecision: "definite",
  wokePrecision: "definite",
  ...over,
})

describe("reading a clock into a night", () => {
  it("puts an evening bedtime before midnight", () => {
    expect(parseBedtime("23:30")).toBe(-30)
    expect(parseBedtime("22:00")).toBe(-120)
  })

  it("puts a small-hours bedtime after midnight", () => {
    expect(parseBedtime("00:45")).toBe(45)
    expect(parseBedtime("01:15")).toBe(75)
  })

  it("treats noon as the pivot between the two", () => {
    expect(parseBedtime("12:00")).toBe(-720)
    expect(parseBedtime("11:59")).toBe(719)
  })

  it("keeps wake times on the morning itself", () => {
    expect(parseWakeTime("07:00")).toBe(420)
    expect(parseWakeTime("00:00")).toBe(0)
  })

  it("rejects nonsense rather than guessing", () => {
    expect(parseBedtime("")).toBeUndefined()
    expect(parseBedtime("25:00")).toBeUndefined()
    expect(parseWakeTime("7pm")).toBeUndefined()
  })

  it("round-trips an offset back to a clock", () => {
    expect(offsetToClock(-30)).toBe("23:30")
    expect(offsetToClock(420)).toBe("07:00")
    expect(offsetToLabel(-30)).toBe("11:30 PM")
    expect(offsetToLabel(420)).toBe("7:00 AM")
  })
})

describe("how long the night was", () => {
  it("spans midnight without a special case", () => {
    expect(sleepMinutes(night({ date: "2026-09-17", sleptMin: -30, wokeMin: 420 }))).toBe(450)
  })

  it("handles a night that started after midnight", () => {
    expect(sleepMinutes(night({ date: "2026-09-17", sleptMin: 45, wokeMin: 465 }))).toBe(420)
  })

  it("has no duration until both ends are known", () => {
    expect(sleepMinutes(night({ date: "2026-09-17", sleptMin: -30 }))).toBeNull()
    expect(sleepMinutes(night({ date: "2026-09-17", wokeMin: 420 }))).toBeNull()
  })

  it("refuses to launder contradictory ends into a number", () => {
    const backwards = night({ date: "2026-09-17", sleptMin: 480, wokeMin: 420 })
    expect(sleepMinutes(backwards)).toBeNull()
    expect(nightProblem(backwards)).toMatch(/before falling asleep/)

    const absurd = night({ date: "2026-09-17", sleptMin: -700, wokeMin: 700 })
    expect(sleepMinutes(absurd)).toBeNull()
    expect(nightProblem(absurd)).toMatch(/over 20 hours/)
  })

  it("counts a night as estimated when either end was only remembered", () => {
    expect(isNightEstimated(night({ date: "d", sleptMin: -30, wokeMin: 420 }))).toBe(false)
    expect(
      isNightEstimated({ date: "d", sleptMin: -30, wokeMin: 420, sleptPrecision: "estimated", wokePrecision: "definite" }),
    ).toBe(true)
    // Unset precision is a guess, not a certainty.
    expect(isNightEstimated({ date: "d", sleptMin: -30, wokeMin: 420 })).toBe(true)
  })
})

describe("splitting a night into calendar days", () => {
  it("gives the evening tail to the day before", () => {
    expect(sleepIntervals(night({ date: "2026-09-17", sleptMin: -30, wokeMin: 420 }))).toEqual([
      { date: "2026-09-16", startMin: 1410, endMin: 1440 },
      { date: "2026-09-17", startMin: 0, endMin: 420 },
    ])
  })

  it("stays on one day when sleep started after midnight", () => {
    expect(sleepIntervals(night({ date: "2026-09-17", sleptMin: 45, wokeMin: 465 }))).toEqual([
      { date: "2026-09-17", startMin: 45, endMin: 465 },
    ])
  })

  it("omits an empty morning half when waking exactly at midnight", () => {
    expect(sleepIntervals(night({ date: "2026-09-17", sleptMin: -120, wokeMin: 0 }))).toEqual([
      { date: "2026-09-16", startMin: 1320, endMin: 1440 },
    ])
  })

  it("crosses a month boundary", () => {
    expect(sleepIntervals(night({ date: "2026-10-01", sleptMin: -60, wokeMin: 360 }))[0].date).toBe("2026-09-30")
  })

  it("produces nothing for an incomplete night", () => {
    expect(sleepIntervals(night({ date: "2026-09-17", sleptMin: -30 }))).toEqual([])
  })
})

describe("sleep statistics", () => {
  const keys = ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17"]
  const nights: Record<string, SleepNight> = {
    "2026-09-14": night({ date: "2026-09-14", sleptMin: -30, wokeMin: 420 }), // 7h30
    "2026-09-15": night({ date: "2026-09-15", sleptMin: 0, wokeMin: 420 }), // 7h
    "2026-09-16": night({ date: "2026-09-16", sleptMin: -60, wokeMin: 420 }), // 8h
    // 2026-09-17 deliberately missing
  }

  it("averages bedtimes across midnight with plain arithmetic", () => {
    // -30, 0 and -60 average to -30: half past eleven. A mean of the wall-clock
    // times (23:30, 00:00, 23:00) would land near noon.
    const stats = sleepStats(nights, keys)
    expect(stats.averageBedtime).toBe(-30)
    expect(stats.averageWake).toBe(420)
  })

  it("reports duration, spread and missing nights", () => {
    const stats = sleepStats(nights, keys)
    expect(stats.nights).toHaveLength(3)
    expect(stats.missing).toBe(1)
    expect(stats.averageMinutes).toBe(450)
    expect(stats.medianMinutes).toBe(450)
    expect(stats.shortest?.minutes).toBe(420)
    expect(stats.longest?.minutes).toBe(480)
    expect(stats.bedtimeVariation).toBeCloseTo(24.494, 2)
  })

  it("measures debt against a target", () => {
    const stats = sleepStats(nights, keys, 8 * 60)
    // 30 short + 60 short + 0 short
    expect(stats.debtMinutes).toBe(90)
    expect(stats.nightsAtTarget).toBe(1)
  })

  it("reports how much of the data was remembered rather than observed", () => {
    const mixed = { ...nights, "2026-09-15": { ...nights["2026-09-15"], wokePrecision: "estimated" as const } }
    expect(sleepStats(mixed, keys).estimatedShare).toBeCloseTo(1 / 3)
  })

  it("skips contradictory nights instead of counting them", () => {
    // The 17th was already blank; filling it with contradictory times must not
    // turn it into a counted night.
    const withBad = { ...nights, "2026-09-17": night({ date: "2026-09-17", sleptMin: 600, wokeMin: 300 }) }
    const stats = sleepStats(withBad, keys)
    expect(stats.nights).toHaveLength(3)
    expect(stats.missing).toBe(1)
    expect(stats.averageMinutes).toBe(450)
  })
})

describe("sleep trend", () => {
  const keys = ["2026-09-13", "2026-09-14", "2026-09-15", "2026-09-16"]

  it("compares the later half with the earlier half", () => {
    const nights: Record<string, SleepNight> = {
      "2026-09-13": night({ date: "2026-09-13", sleptMin: -60, wokeMin: 420 }), // 8h
      "2026-09-14": night({ date: "2026-09-14", sleptMin: -60, wokeMin: 420 }), // 8h
      "2026-09-15": night({ date: "2026-09-15", sleptMin: 0, wokeMin: 420 }), // 7h
      "2026-09-16": night({ date: "2026-09-16", sleptMin: 0, wokeMin: 420 }), // 7h
    }
    const trend = sleepTrend(nights, keys)
    expect(trend.comparable).toBe(true)
    expect(trend.durationDelta).toBe(-60)
    expect(trend.bedtimeDelta).toBe(60) // going to bed an hour later
    expect(trend.wakeDelta).toBe(0)
  })

  it("declines to call two data points a trend", () => {
    const nights = { "2026-09-16": night({ date: "2026-09-16", sleptMin: 0, wokeMin: 420 }) }
    expect(sleepTrend(nights, keys).comparable).toBe(false)
  })
})

describe("describing a shift", () => {
  it("reads a signed delta in plain words", () => {
    expect(describeShift(60)).toBe("1h later")
    expect(describeShift(-25)).toBe("25m earlier")
    expect(describeShift(2)).toBe("about the same")
    expect(describeShift(-90, "less")).toBe("1h 30m less")
  })
})

describe("clock times on the day you typed them", () => {
  it("puts a small-hours bedtime on this morning's night", () => {
    expect(placeAsleepOnDay("2026-09-17", 60)).toEqual({ date: "2026-09-17", sleptMin: 60 })
  })

  it("puts an evening bedtime on the next morning's night", () => {
    expect(placeAsleepOnDay("2026-09-17", 1320)).toEqual({ date: "2026-09-18", sleptMin: -120 })
  })

  it("puts a wake time on this morning", () => {
    expect(placeAwakeOnDay("2026-09-17", 300)).toEqual({ date: "2026-09-17", wokeMin: 300 })
  })

  it("shows Thursday 1am–9am and Thursday 10pm as two rows", () => {
    const nights: Record<string, SleepNight> = {
      "2026-09-17": night({ date: "2026-09-17", sleptMin: 60, wokeMin: 540 }),
      "2026-09-18": night({ date: "2026-09-18", sleptMin: -120, wokeMin: 300 }),
    }
    const thursday = sleepRowsForDay(nights, "2026-09-17")
    expect(thursday).toMatchObject([
      { nightDate: "2026-09-17", side: "ended-this-morning", asleepClock: 60, awakeClock: 540 },
      { nightDate: "2026-09-18", side: "starts-this-evening", asleepClock: 1320, awakeElsewhere: { date: "2026-09-18", clock: 300 } },
    ])
    expect(sleepMinutes(nights["2026-09-17"])).toBe(480)
    expect(sleepMinutes(nights["2026-09-18"])).toBe(420)

    const friday = sleepRowsForDay(nights, "2026-09-18")
    expect(friday).toMatchObject([
      { nightDate: "2026-09-18", side: "ended-this-morning", awakeClock: 300, asleepElsewhere: { date: "2026-09-17", clock: 1320 } },
    ])
  })
})
