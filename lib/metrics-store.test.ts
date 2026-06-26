import { describe, it, expect, beforeEach } from "vitest"
import {
  useMetricsStore,
  METRIC_DEFINITIONS,
  METRIC_KEYS,
  getMetricDefinition,
  clampMetricValue,
  toLocalDateTimeValue,
} from "@/lib/metrics-store"

function resetStore() {
  localStorage.clear()
  useMetricsStore.setState({ datapoints: [] })
}

describe("metrics-store", () => {
  beforeEach(resetStore)

  it("exposes the five core 0–100 metrics", () => {
    expect(METRIC_KEYS).toEqual([
      "joy",
      "suffering",
      "alignment",
      "selfSatisfaction",
      "situationalSatisfaction",
    ])
    for (const def of METRIC_DEFINITIONS) {
      expect(def.min).toBe(0)
      expect(def.max).toBe(100)
      expect(def.color).toBeTruthy()
    }
    expect(getMetricDefinition("joy").name).toBe("Joy")
  })

  it("clamps metric values to 0–100 integers", () => {
    expect(clampMetricValue(150)).toBe(100)
    expect(clampMetricValue(-5)).toBe(0)
    expect(clampMetricValue(42.6)).toBe(43)
    expect(clampMetricValue(Number.NaN)).toBeUndefined()
  })

  it("adds a datapoint with id, createdAt, clamped values, context and details", () => {
    const id = useMetricsStore.getState().addDatapoint({
      at: "2026-06-01T09:30",
      values: { joy: 80, suffering: 120, alignment: -3 },
      context: "  morning walk  ",
      details: " felt good ",
    })
    const dp = useMetricsStore.getState().datapoints.find((d) => d.id === id)
    expect(dp).toBeDefined()
    expect(dp!.at).toBe("2026-06-01T09:30")
    expect(dp!.values).toEqual({ joy: 80, suffering: 100, alignment: 0 })
    expect(dp!.context).toBe("morning walk")
    expect(dp!.details).toBe("felt good")
    expect(dp!.createdAt).toBeInstanceOf(Date)
  })

  it("defaults `at` to now when omitted", () => {
    const id = useMetricsStore.getState().addDatapoint({ values: { joy: 50 } })
    const dp = useMetricsStore.getState().datapoints.find((d) => d.id === id)!
    expect(dp.at).toBe(toLocalDateTimeValue(new Date(dp.at)))
    expect(dp.at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })

  it("supports back-logging multiple datapoints at the same minute", () => {
    useMetricsStore.getState().addDatapoint({ at: "2026-06-01T09:00", values: { joy: 60 } })
    useMetricsStore.getState().addDatapoint({ at: "2026-06-01T09:00", values: { joy: 70 } })
    expect(useMetricsStore.getState().datapoints).toHaveLength(2)
  })

  it("updates and removes a datapoint", () => {
    const id = useMetricsStore.getState().addDatapoint({ at: "2026-06-01T09:00", values: { joy: 40 } })
    useMetricsStore.getState().updateDatapoint(id, { values: { joy: 90 }, context: "edited" })
    const dp = useMetricsStore.getState().datapoints.find((d) => d.id === id)!
    expect(dp.values).toEqual({ joy: 90 })
    expect(dp.context).toBe("edited")

    useMetricsStore.getState().removeDatapoint(id)
    expect(useMetricsStore.getState().datapoints.find((d) => d.id === id)).toBeUndefined()
  })

  it("seriesFor returns chronological {date, value} points for a metric", () => {
    useMetricsStore.getState().addDatapoint({ at: "2026-06-03T08:00", values: { joy: 30 } })
    useMetricsStore.getState().addDatapoint({ at: "2026-06-01T08:00", values: { joy: 50, suffering: 10 } })
    useMetricsStore.getState().addDatapoint({ at: "2026-06-02T08:00", values: { joy: 40 } })
    expect(useMetricsStore.getState().seriesFor("joy")).toEqual([
      { date: "2026-06-01T08:00", value: 50 },
      { date: "2026-06-02T08:00", value: 40 },
      { date: "2026-06-03T08:00", value: 30 },
    ])
    expect(useMetricsStore.getState().seriesFor("suffering")).toEqual([
      { date: "2026-06-01T08:00", value: 10 },
    ])
  })

  it("datapointsChrono sorts most-recent-first by default", () => {
    useMetricsStore.getState().addDatapoint({ at: "2026-06-01T08:00", values: { joy: 1 } })
    useMetricsStore.getState().addDatapoint({ at: "2026-06-03T08:00", values: { joy: 3 } })
    useMetricsStore.getState().addDatapoint({ at: "2026-06-02T08:00", values: { joy: 2 } })
    expect(useMetricsStore.getState().datapointsChrono().map((d) => d.at)).toEqual([
      "2026-06-03T08:00",
      "2026-06-02T08:00",
      "2026-06-01T08:00",
    ])
    expect(useMetricsStore.getState().datapointsChrono(false).map((d) => d.at)).toEqual([
      "2026-06-01T08:00",
      "2026-06-02T08:00",
      "2026-06-03T08:00",
    ])
  })

  it("persists to localStorage under cogs-metrics-store", () => {
    useMetricsStore.getState().addDatapoint({ at: "2026-06-01T09:00", values: { joy: 55 }, context: "ping" })
    expect(localStorage.getItem("cogs-metrics-store")).toContain("ping")
  })
})
