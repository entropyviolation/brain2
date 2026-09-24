/**
 * Cross-section density math — missing stays missing, n is observed days.
 */
import { describe, expect, it } from "vitest"
import {
  buildCrossSection,
  intensity,
  observedDomainMax,
  observedN,
  presenceOf,
  readoutFor,
} from "./cross-section"

const DAYS = ["2026-09-18", "2026-09-19", "2026-09-20"]

describe("cross-section honesty", () => {
  it("does not treat a missing sleep night as zero", () => {
    const series = buildCrossSection({
      dateKeys: DAYS,
      habits: { "2026-09-18": 80, "2026-09-19": 0, "2026-09-20": 40 },
      tracking: { "2026-09-18": 60, "2026-09-19": 0, "2026-09-20": 120 },
      sleep: { "2026-09-18": 420, "2026-09-19": null, "2026-09-20": 480 },
      completions: {},
      points: {},
      operations: {},
      regret: {},
    })
    const sleep = series.find((s) => s.id === "sleep")!
    expect(sleep.points.map((p) => p.value)).toEqual([420, null, 480])
    expect(sleep.n).toBe(2)
    expect(presenceOf(null)).toBe("missing")
    expect(presenceOf(0)).toBe("zero")
    expect(intensity(null, 480)).toBe(0)
  })

  it("scales to the observed max, not a fake full-day domain", () => {
    const points = [
      { date: "a", value: 12 },
      { date: "b", value: null },
      { date: "c", value: 8 },
    ]
    expect(observedN(points)).toBe(2)
    expect(observedDomainMax(points, 60)).toBe(60)
    expect(observedDomainMax(points, 1)).toBe(12)
  })

  it("readout leaves missing series as a dash", () => {
    const series = buildCrossSection({
      dateKeys: ["2026-09-20"],
      habits: { "2026-09-20": null },
      tracking: { "2026-09-20": 30 },
      sleep: { "2026-09-20": null },
      completions: { "2026-09-20": 1 },
      points: { "2026-09-20": 5 },
      operations: { "2026-09-20": 0 },
      regret: { "2026-09-20": 0 },
    })
    expect(readoutFor(series, "2026-09-20")).toContain("Habits —")
    expect(readoutFor(series, "2026-09-20")).toContain("Tracking 30m")
    expect(readoutFor(series, "2026-09-20")).toContain("Sleep —")
  })

  it("treats Screen Time 0 as empty occupancy, not missing", () => {
    const series = buildCrossSection({
      dateKeys: DAYS,
      habits: {},
      tracking: {},
      sleep: {},
      completions: {},
      points: {},
      operations: {},
      regret: {},
      screentime: { "2026-09-18": 0, "2026-09-19": 45, "2026-09-20": 0 },
    })
    const st = series.find((s) => s.id === "screentime")!
    expect(st.points.map((p) => p.value)).toEqual([0, 45, 0])
    expect(st.n).toBe(1)
  })
})
