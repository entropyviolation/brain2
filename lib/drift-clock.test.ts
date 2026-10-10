import { describe, expect, it } from "vitest"
import {
  DEFAULT_DRIFT_PERIOD_MS,
  DRIFT_MIN_MS,
  DRIFT_PRESET_MS,
  appDriftPosition,
  applyInstant,
  createDriftClock,
  driftPosition,
  matchDriftPreset,
  periodFromAmount,
  positionFromPhase,
  setDriftPaused,
  setDriftPeriod,
  settleDrift,
  startDriftTransition,
} from "./drift-clock"

const PERIOD = 1000 * 60

function clockAt(position: number, now = 0) {
  return applyInstant(createDriftClock({ periodMs: PERIOD, epochMs: now, paused: false }), position, now)
}

describe("drift cycle", () => {
  it("walks pole to opposite pole and back in one period", () => {
    const clock = clockAt(0, 0)
    expect(driftPosition(clock, 0)).toBeCloseTo(0, 5)
    expect(driftPosition(clock, PERIOD / 2)).toBeCloseTo(100, 5)
    expect(driftPosition(clock, PERIOD)).toBeCloseTo(0, 5)
  })

  it("returns to the same position one full cycle later", () => {
    const clock = clockAt(50, 0)
    const start = driftPosition(clock, 0)
    expect(start).toBeCloseTo(50, 5)
    expect(driftPosition(clock, PERIOD)).toBeCloseTo(start, 5)
    expect(driftPosition(clock, PERIOD / 4)).toBeCloseTo(100, 4)
  })

  it("holds still while paused, including across a reload of the same clock", () => {
    const running = clockAt(40, 1_000)
    const paused = setDriftPaused(running, true, 1_000 + PERIOD / 4)
    const held = driftPosition(paused, 1_000 + PERIOD / 4)
    expect(driftPosition(paused, 1_000 + PERIOD * 5)).toBeCloseTo(held, 5)
    const reloaded = { ...paused }
    expect(driftPosition(reloaded, 1_000 + PERIOD * 9)).toBeCloseTo(held, 5)
  })
})

describe("manual shift", () => {
  it("instant apply lands on the target and leaves the drift period alone", () => {
    const clock = clockAt(10, 0)
    const next = applyInstant(clock, 80, 500)
    expect(driftPosition(next, 500)).toBeCloseTo(80, 5)
    expect(next.periodMs).toBe(clock.periodMs)
    expect(next.transition).toBeNull()
    expect(driftPosition(next, 500 + PERIOD / 2)).not.toBeCloseTo(80, 0)
  })

  it("eases from the live position to the target, then drifts from there", () => {
    const clock = clockAt(0, 0)
    const started = startDriftTransition(clock, 100, 1_000, 0, false)
    expect(started.periodMs).toBe(clock.periodMs)
    expect(driftPosition(started, 0)).toBeCloseTo(0, 5)
    expect(driftPosition(started, 500)).toBeCloseTo(50, 5)
    const done = settleDrift(started, 1_000)
    expect(done.transition).toBeNull()
    expect(done.periodMs).toBe(PERIOD)
    expect(driftPosition(done, 1_000)).toBeCloseTo(100, 5)
    expect(driftPosition(done, 1_000 + PERIOD / 2)).toBeCloseTo(0, 4)
  })

  it("reduced motion jumps to the end and still keeps the drift period", () => {
    const clock = clockAt(20, 0)
    const next = startDriftTransition(clock, 70, DRIFT_PRESET_MS["30s"], 250, true)
    expect(next.transition).toBeNull()
    expect(driftPosition(next, 250)).toBeCloseTo(70, 5)
    expect(appDriftPosition(next, 250)).toBeCloseTo(70, 5)
    expect(next.periodMs).toBe(PERIOD)
  })

  it("holds the previous position for the rest of the app while the panel lerps", () => {
    const clock = clockAt(20, 0)
    const started = startDriftTransition(clock, 80, 1_000, 0, false)
    expect(appDriftPosition(started, 500)).toBeCloseTo(20, 5)
    expect(driftPosition(started, 500)).toBeCloseTo(50, 5)
    const done = settleDrift(started, 1_000)
    expect(done.transition).toBeNull()
    expect(appDriftPosition(done, 1_000)).toBeCloseTo(80, 5)
  })

  it("a second start keeps the app hold on the original position", () => {
    const clock = clockAt(20, 0)
    const started = startDriftTransition(clock, 80, 1_000, 0, false)
    const again = startDriftTransition(started, 10, 1_000, 500, false)
    expect(again.transition?.from).toBeCloseTo(20, 5)
    expect(again.transition?.to).toBe(10)
    expect(appDriftPosition(again, 500)).toBeCloseTo(20, 5)
  })
})

describe("reload reconstruction", () => {
  it("rebuilds the phase from epoch, phase, and period", () => {
    const clock = clockAt(50, 10_000)
    const later = 10_000 + PERIOD / 4
    const seen = driftPosition(clock, later)
    const stored = JSON.parse(JSON.stringify(clock)) as typeof clock
    expect(driftPosition(stored, later)).toBeCloseTo(seen, 5)
    expect(seen).toBeCloseTo(100, 4)
  })
})

describe("duration vocabulary", () => {
  it("names the presets and accepts hours plus a custom amount", () => {
    expect(matchDriftPreset(DRIFT_PRESET_MS["1w"])).toBe("1w")
    expect(matchDriftPreset(DRIFT_PRESET_MS["1d"])).toBe("1d")
    expect(matchDriftPreset(DRIFT_PRESET_MS["1m"])).toBe("1m")
    expect(matchDriftPreset(DRIFT_PRESET_MS["30s"])).toBe("30s")
    expect(matchDriftPreset(periodFromAmount(6, "hours"))).toBe("hours")
    expect(matchDriftPreset(periodFromAmount(90, "seconds"))).toBe("custom")
    expect(periodFromAmount(2, "weeks")).toBe(DRIFT_PRESET_MS["1w"] * 2)
    expect(periodFromAmount(0.2, "seconds")).toBe(DRIFT_MIN_MS)
    expect(DEFAULT_DRIFT_PERIOD_MS).toBe(DRIFT_PRESET_MS["1d"])
  })

  it("maps the cosine so 50 is the neutral phase", () => {
    expect(positionFromPhase(0)).toBeCloseTo(0, 5)
    expect(positionFromPhase(0.25)).toBeCloseTo(50, 5)
    expect(positionFromPhase(0.5)).toBeCloseTo(100, 5)
  })
})

describe("setDriftPeriod", () => {
  it("does not jump the displayed position", () => {
    const clock = clockAt(50, 0)
    const at = PERIOD / 8
    const before = driftPosition(clock, at)
    const next = setDriftPeriod(clock, DRIFT_PRESET_MS["30s"], at)
    expect(driftPosition(next, at)).toBeCloseTo(before, 4)
    expect(next.periodMs).toBe(DRIFT_PRESET_MS["30s"])
  })
})
