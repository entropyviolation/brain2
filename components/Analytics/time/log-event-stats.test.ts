import { describe, expect, it } from "vitest"
import { countLogEventsByDay, countLogEventsByKind, logClockScatter, logPhaseStrip, type LogEventPoint } from "./log-event-stats"

const points: LogEventPoint[] = [
  { id: "a", date: "2026-06-20", startMin: 0, kindKey: "left room", clockCertainty: "exact" },
  { id: "b", date: "2026-06-20", startMin: 0, kindKey: "drink", clockCertainty: "unknown" },
  { id: "c", date: "2026-06-21", startMin: 495, kindKey: "food", clockCertainty: "estimated" },
  { id: "d", date: "2026-06-21", startMin: 600, kindKey: "left room" },
]

describe("log event stats", () => {
  it("counts by day across the window, including empty days", () => {
    expect(countLogEventsByDay(points, ["2026-06-19", "2026-06-20", "2026-06-21"])).toEqual([
      { date: "2026-06-19", count: 0 },
      { date: "2026-06-20", count: 2 },
      { date: "2026-06-21", count: 2 },
    ])
  })

  it("counts by event kind and intake class", () => {
    expect(countLogEventsByKind(points)).toEqual([
      { kind: "left room", count: 2 },
      { kind: "drink", count: 1 },
      { kind: "food", count: 1 },
    ])
  })

  it("plots exact and estimated clocks and keeps unknown off the sentinel minute", () => {
    const scatter = logClockScatter(points)
    expect(scatter.unknownCount).toBe(1)
    expect(scatter.points.map((point) => point.id).sort()).toEqual(["a", "c", "d"])
    expect(scatter.points.find((point) => point.id === "a")?.minute).toBe(0)
    expect(scatter.points.some((point) => point.id === "b")).toBe(false)
  })

  it("builds a phase strip from cycle marks over the date range", () => {
    const marks = {
      "2026-06-20": { date: "2026-06-20", bleeding: true, spotting: true },
      "2026-06-21": { date: "2026-06-21", spotting: true },
    }
    expect(logPhaseStrip(["2026-06-19", "2026-06-20", "2026-06-21"], marks)).toEqual([
      { date: "2026-06-19", phase: "unknown" },
      { date: "2026-06-20", phase: "menstrual" },
      { date: "2026-06-21", phase: "follicular" },
    ])
  })
})
