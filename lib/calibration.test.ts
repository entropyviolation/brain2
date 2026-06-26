import { describe, it, expect } from "vitest"
import {
  getCalibrationPoints,
  summarizeCalibration,
  ratioDistribution,
  calibrationTrend,
  ACCURATE_BAND_PCT,
} from "@/lib/calibration"
import type { Task } from "@/lib/types"

const task = (overrides: Partial<Task>): Task => ({
  id: "t1",
  description: "Task",
  stage: "list",
  createdAt: new Date(),
  completed: false,
  lists: [],
  ...overrides,
})

describe("calibration", () => {
  it("only includes completed tasks with positive estimate + actual", () => {
    const tasks = [
      task({ id: "a", completed: true, estimatedDuration: 60, actualDuration: 90 }),
      task({ id: "b", completed: false, estimatedDuration: 60, actualDuration: 90 }), // not completed
      task({ id: "c", completed: true, estimatedDuration: 0, actualDuration: 90 }), // no estimate
      task({ id: "d", completed: true, estimatedDuration: 60 }), // no actual
    ]
    const pts = getCalibrationPoints(tasks)
    expect(pts.map((p) => p.taskId)).toEqual(["a"])
  })

  it("computes ratio and signed error %", () => {
    const pts = getCalibrationPoints([
      task({ id: "a", completed: true, estimatedDuration: 60, actualDuration: 90 }),
    ])
    expect(pts[0].ratio).toBe(1.5)
    expect(pts[0].errorPct).toBeCloseTo(50)
  })

  it("summary flags underestimation when tasks run long", () => {
    const pts = getCalibrationPoints([
      task({ id: "a", completed: true, estimatedDuration: 60, actualDuration: 120 }),
      task({ id: "b", completed: true, estimatedDuration: 30, actualDuration: 60 }),
    ])
    const s = summarizeCalibration(pts)
    expect(s.medianBiasPct).toBeCloseTo(100)
    expect(s.underestimateRate).toBe(1)
    expect(s.insight).toMatch(/underestimate by 100%/)
  })

  it("summary flags overestimation when tasks run short", () => {
    const pts = getCalibrationPoints([
      task({ id: "a", completed: true, estimatedDuration: 100, actualDuration: 50 }),
    ])
    const s = summarizeCalibration(pts)
    expect(s.medianBiasPct).toBeCloseTo(-50)
    expect(s.overestimateRate).toBe(1)
    expect(s.insight).toMatch(/overestimate by 50%/)
  })

  it("summary reports well-calibrated within the band", () => {
    const pts = getCalibrationPoints([
      task({ id: "a", completed: true, estimatedDuration: 100, actualDuration: 105 }),
    ])
    const s = summarizeCalibration(pts)
    expect(Math.abs(s.medianBiasPct)).toBeLessThanOrEqual(ACCURATE_BAND_PCT)
    expect(s.accurateRate).toBe(1)
    expect(s.insight).toMatch(/Well calibrated/)
  })

  it("handles empty input", () => {
    const s = summarizeCalibration([])
    expect(s.count).toBe(0)
    expect(s.insight).toMatch(/Complete some tasks/)
  })

  it("buckets ratios into distribution bins", () => {
    const pts = getCalibrationPoints([
      task({ id: "a", completed: true, estimatedDuration: 100, actualDuration: 30 }), // 0.3 ≤0.5
      task({ id: "b", completed: true, estimatedDuration: 100, actualDuration: 100 }), // 1.0 accurate
      task({ id: "c", completed: true, estimatedDuration: 100, actualDuration: 150 }), // 1.5 under
      task({ id: "d", completed: true, estimatedDuration: 100, actualDuration: 300 }), // 3.0 way under
    ])
    const dist = ratioDistribution(pts)
    expect(dist.find((b) => b.label.includes("way over"))?.count).toBe(1)
    expect(dist.find((b) => b.label.includes("accurate"))?.count).toBe(1)
    expect(dist.find((b) => b.label === "1.2–2× (under)")?.count).toBe(1)
    expect(dist.find((b) => b.label.includes("way under"))?.count).toBe(1)
    expect(dist.reduce((s, b) => s + b.count, 0)).toBe(4)
  })

  it("builds a chronological per-period trend", () => {
    const pts = getCalibrationPoints([
      task({
        id: "a",
        completed: true,
        estimatedDuration: 60,
        actualDuration: 120,
        completionReview: {
          taskId: "a",
          completedAt: new Date(2026, 5, 1),
          actualDuration: 120,
          satisfaction: 5,
          resistance: 5,
          focus: 5,
          distraction: 5,
        },
      }),
      task({
        id: "b",
        completed: true,
        estimatedDuration: 60,
        actualDuration: 60,
        completionReview: {
          taskId: "b",
          completedAt: new Date(2026, 5, 20),
          actualDuration: 60,
          satisfaction: 5,
          resistance: 5,
          focus: 5,
          distraction: 5,
        },
      }),
    ])
    const trend = calibrationTrend(pts, "month")
    expect(trend.length).toBe(1)
    expect(trend[0].periodKey).toBe("2026-06")
    expect(trend[0].count).toBe(2)
  })

  it("skips trend points without a completion date", () => {
    const pts = getCalibrationPoints([
      task({ id: "a", completed: true, estimatedDuration: 60, actualDuration: 90 }),
    ])
    expect(calibrationTrend(pts)).toEqual([])
  })
})
