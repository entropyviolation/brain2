import { describe, expect, it } from "vitest"
import type { HealthDay } from "@/lib/phone-sync/health"
import { metricLink, metricTrend, shareAtOrAbove, summarize, weekdayMeans, workoutRows } from "./health-report"

const day = (date: string, steps?: number, extra: Partial<HealthDay> = {}): HealthDay => ({ date, steps, ...extra })
const keys = (n: number) => Array.from({ length: n }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`)

describe("health report", () => {
  it("leaves blank days out of the mean", () => {
    const days = { "2026-10-01": day("2026-10-01", 4000), "2026-10-03": day("2026-10-03", 8000) }
    const s = summarize(days, keys(3), "steps")
    expect(s.n).toBe(2)
    expect(s.mean).toBe(6000)
    expect(s.best?.date).toBe("2026-10-03")
  })

  it("reports distance in km", () => {
    const days = { "2026-10-01": { date: "2026-10-01", distanceM: 5200 } }
    expect(summarize(days, keys(1), "distanceM").mean).toBeCloseTo(5.2)
  })

  it("holds a trend back below the floor and reports it above", () => {
    const k = keys(20)
    const days = Object.fromEntries(k.map((d, i) => [d, day(d, i < 10 ? 4000 : 6000)]))
    expect(metricTrend(days, k.slice(0, 6), "steps")).toBeNull()
    expect(metricTrend(days, k, "steps")?.change).toBeCloseTo(0.5)
  })

  it("buckets weekdays", () => {
    const days = { "2026-10-04": day("2026-10-04", 3000), "2026-10-11": day("2026-10-11", 5000) }
    const w = weekdayMeans(days, ["2026-10-04", "2026-10-11"], "steps", (key) => new Date(`${key}T12:00:00`).getDay())
    expect(w[0]).toEqual({ mean: 4000, n: 2 })
    expect(w[1].mean).toBeNull()
  })

  it("links only on days both series have, above the floor", () => {
    const k = keys(10)
    const days = Object.fromEntries(k.map((d, i) => [d, day(d, 1000 * (i + 1))]))
    const other = Object.fromEntries(k.map((d, i) => [d, 400 + i * 10]))
    expect(metricLink(days, k, "steps", other)?.r).toBeCloseTo(1)
    expect(metricLink(days, k.slice(0, 4), "steps", other)).toBeNull()
  })

  it("counts goal days among days with steps", () => {
    const days = { a: day("a", 9000), b: day("b", 2000), c: day("c") }
    expect(shareAtOrAbove(days, ["a", "b", "c"], 8000)).toEqual({ hit: 1, n: 2 })
  })

  it("rolls workout spans up by activity", () => {
    const g = { id: "health:w1" }
    const rows = workoutRows(
      [
        { date: "2026-10-01", startMin: 1380, endMin: 1440, title: "Running", spanId: "s1", generatedBy: g },
        { date: "2026-10-02", startMin: 0, endMin: 20, title: "Running", spanId: "s1", generatedBy: g },
        { date: "2026-10-02", startMin: 600, endMin: 630, title: "Yoga", spanId: "s2", generatedBy: { id: "health:w2" } },
        { date: "2026-10-02", startMin: 600, endMin: 630, title: "Texts", spanId: "s3", generatedBy: { id: "messages:x" } },
      ],
      new Set(["2026-10-01", "2026-10-02"]),
    )
    expect(rows).toEqual([
      { activity: "Running", count: 1, minutes: 80 },
      { activity: "Yoga", count: 1, minutes: 30 },
    ])
  })
})
