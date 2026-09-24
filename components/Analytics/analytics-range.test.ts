import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { recentDateKeys } from "@/lib/tracking-summary"
import {
  ANALYTICS_RANGE_STORAGE_KEY,
  DEFAULT_ANALYTICS_RANGE,
  SAMPLE_FLOORS,
  customRangeLabel,
  dateKeyOf,
  dateKeysInclusive,
  inRange,
  isThinSample,
  namedPeriodWindow,
  periodKeysFromDateKeys,
  rangeLabel,
  rangeWindowCaption,
  readStoredAnalyticsRange,
  thinWindowSentence,
  writeStoredAnalyticsRange,
} from "./analytics-range"
import { useAnalyticsRangeStore } from "./analytics-range-store"

const TODAY = new Date(2026, 8, 20, 12, 0, 0)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(TODAY)
  localStorage.clear()
  useAnalyticsRangeStore.setState({
    days: DEFAULT_ANALYTICS_RANGE,
    mode: "preset",
    fromKey: null,
    toKey: null,
    hydrated: false,
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("analytics range", () => {
  it("labels the shared window as last N days", () => {
    expect(rangeLabel(30)).toBe("last 30 days")
    expect(rangeWindowCaption(7, TODAY)).toBe("last 7 days · 2026-09-14 – 2026-09-20")
  })

  it("remembers the picked range in localStorage", () => {
    expect(readStoredAnalyticsRange()).toEqual({ mode: "preset", days: 30 })
    writeStoredAnalyticsRange(7)
    expect(localStorage.getItem(ANALYTICS_RANGE_STORAGE_KEY)).toBe("7")
    expect(readStoredAnalyticsRange()).toEqual({ mode: "preset", days: 7 })
  })

  it("rejects a stored value that is not a preset", () => {
    localStorage.setItem(ANALYTICS_RANGE_STORAGE_KEY, "12")
    expect(readStoredAnalyticsRange()).toEqual({ mode: "preset", days: 30 })
  })

  it("the store writes the same key the rest of Analytics reads", () => {
    useAnalyticsRangeStore.getState().setDays(90)
    expect(readStoredAnalyticsRange()).toEqual({ mode: "preset", days: 90 })
    expect(useAnalyticsRangeStore.getState().days).toBe(90)
  })
})

describe("custom analytics range", () => {
  it("builds inclusive local date keys and an honest label", () => {
    const keys = dateKeysInclusive("2026-08-01", "2026-09-21")
    expect(keys[0]).toBe("2026-08-01")
    expect(keys[keys.length - 1]).toBe("2026-09-21")
    expect(keys).toHaveLength(52)
    expect(customRangeLabel("2026-08-01", "2026-09-21")).toBe("2026-08-01 – 2026-09-21")
  })

  it("swaps inverted bounds and rejects garbage", () => {
    expect(dateKeysInclusive("2026-09-21", "2026-09-20")).toEqual(["2026-09-20", "2026-09-21"])
    expect(dateKeysInclusive("nope", "2026-09-21")).toEqual([])
  })

  it("named week and month land on local Monday–Sunday and the calendar month", () => {
    const week = namedPeriodWindow("week", TODAY)
    expect(week.from).toBe("2026-09-14")
    expect(week.to).toBe("2026-09-20")
    const month = namedPeriodWindow("month", TODAY)
    expect(month.from).toBe("2026-09-01")
    expect(month.to).toBe("2026-09-30")
  })

  it("persists a custom window as JSON and hydrates it back", () => {
    useAnalyticsRangeStore.getState().setCustomRange("2026-08-01", "2026-09-21")
    const stored = readStoredAnalyticsRange()
    expect(stored).toEqual({ mode: "custom", from: "2026-08-01", to: "2026-09-21" })
    expect(useAnalyticsRangeStore.getState().mode).toBe("custom")
    expect(useAnalyticsRangeStore.getState().days).toBe(52)
    expect(useAnalyticsRangeStore.getState().fromKey).toBe("2026-08-01")
    expect(useAnalyticsRangeStore.getState().toKey).toBe("2026-09-21")
  })

  it("a preset pick still writes the legacy number string", () => {
    useAnalyticsRangeStore.getState().setCustomRange("2026-08-01", "2026-09-21")
    useAnalyticsRangeStore.getState().setDays(14)
    expect(localStorage.getItem(ANALYTICS_RANGE_STORAGE_KEY)).toBe("14")
    expect(readStoredAnalyticsRange()).toEqual({ mode: "preset", days: 14 })
  })

  it("thin-window copy uses the honest custom label", () => {
    expect(thinWindowSentence(2, SAMPLE_FLOORS.calibration, "2026-08-01 – 2026-09-21")).toBe(
      "n = 2 in 2026-08-01 – 2026-09-21 — too thin to treat as a finding (need 8).",
    )
  })
})

describe("sample-size honesty", () => {
  it("treats n below the floor as too thin to be a finding", () => {
    expect(isThinSample(3, SAMPLE_FLOORS.calibration)).toBe(true)
    expect(isThinSample(8, SAMPLE_FLOORS.calibration)).toBe(false)
    expect(isThinSample(6, SAMPLE_FLOORS.correlation)).toBe(true)
    expect(isThinSample(2, SAMPLE_FLOORS.planVsReality)).toBe(true)
    expect(isThinSample(6, SAMPLE_FLOORS.overcommitment)).toBe(true)
    expect(isThinSample(7, SAMPLE_FLOORS.overcommitment)).toBe(false)
    expect(
      thinWindowSentence(2, SAMPLE_FLOORS.calibration, 7),
    ).toBe("n = 2 in the last 7 days — too thin to treat as a finding (need 8).")
  })

  it("does not treat a sparse week of keys as a full 30-day sample", () => {
    const keys = recentDateKeys(7, TODAY)
    expect(keys).toHaveLength(7)
    expect(inRange("2026-09-20", new Set(keys))).toBe(true)
    expect(inRange("2026-08-01", new Set(keys))).toBe(false)
    expect(dateKeyOf(new Date(2026, 8, 18))).toBe("2026-09-18")
  })

  it("rolls the shared day keys into plan-vs-reality period keys", () => {
    const days = recentDateKeys(7, TODAY)
    expect(periodKeysFromDateKeys("day", days)).toEqual(days)
    const weeks = periodKeysFromDateKeys("week", days)
    expect(weeks.length).toBeGreaterThan(0)
    expect(weeks.length).toBeLessThanOrEqual(days.length)
    expect(periodKeysFromDateKeys("month", days)).toEqual(["2026-09"])
  })
})
