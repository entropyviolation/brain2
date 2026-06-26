import { describe, it, expect } from "vitest"
import {
  parsePlanIntentions,
  computePlanVsReality,
  recentPeriodKeys,
  type PointsLedgerEntry,
} from "@/lib/plan-vs-reality"
import { formatLocalDateKey } from "@/lib/date-utils"
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

describe("parsePlanIntentions", () => {
  it("splits lines and strips bullets/numbering", () => {
    const text = "- Write report\n* Email team\n1. Review PR\n\n   \n• Stretch"
    expect(parsePlanIntentions(text)).toEqual(["Write report", "Email team", "Review PR", "Stretch"])
  })

  it("returns [] for empty/nullish input", () => {
    expect(parsePlanIntentions("")).toEqual([])
    expect(parsePlanIntentions(null)).toEqual([])
    expect(parsePlanIntentions(undefined)).toEqual([])
  })
})

describe("computePlanVsReality", () => {
  const day = "2026-06-23"
  const dayDate = new Date(2026, 5, 23)

  it("scores perfect alignment when everything planned was done", () => {
    const tasks = [
      task({ id: "a", scheduledDate: dayDate, completed: true, estimatedDuration: 60, actualDuration: 60, rewardValue: 50 }),
    ]
    const points: PointsLedgerEntry[] = [{ date: day, points: 50 }]
    const r = computePlanVsReality("day", day, tasks, points, "- Do the thing")
    expect(r.alignmentScore).toBe(100)
    expect(r.varianceScore).toBe(0)
    expect(r.completedTaskCount).toBe(1)
    expect(r.plannedTaskCount).toBe(1)
    expect(r.hasPlan).toBe(true)
  })

  it("scores high variance when nothing planned was accomplished", () => {
    const tasks = [
      task({ id: "a", scheduledDate: dayDate, completed: false, estimatedDuration: 60, rewardValue: 50 }),
    ]
    const r = computePlanVsReality("day", day, tasks, [], "- Do the thing")
    // tasks attainment 0, time attainment 0, points attainment 0 → variance 100
    expect(r.varianceScore).toBe(100)
    expect(r.alignmentScore).toBe(0)
  })

  it("penalizes both over- and under-running time equally via min/max", () => {
    const over = computePlanVsReality(
      "day",
      day,
      [task({ id: "a", scheduledDate: dayDate, completed: true, estimatedDuration: 60, actualDuration: 120 })],
      [],
      null,
    )
    const under = computePlanVsReality(
      "day",
      day,
      [task({ id: "b", scheduledDate: dayDate, completed: true, estimatedDuration: 120, actualDuration: 60 })],
      [],
      null,
    )
    const timeOver = over.metrics.find((m) => m.key === "time")!
    const timeUnder = under.metrics.find((m) => m.key === "time")!
    expect(timeOver.attainment).toBeCloseTo(0.5)
    expect(timeUnder.attainment).toBeCloseTo(0.5)
  })

  it("counts logged time from completedChunks within the period", () => {
    const tasks = [
      task({
        id: "a",
        scheduledDate: dayDate,
        completed: false,
        estimatedDuration: 60,
        completedChunks: [
          { date: dayDate, duration: 30 },
          { date: new Date(2026, 4, 1), duration: 99 }, // outside period — ignored
        ],
      }),
    ]
    const r = computePlanVsReality("day", day, tasks, [], null)
    expect(r.actualMinutes).toBe(30)
  })

  it("sums actual points only from entries inside the period", () => {
    const tasks = [task({ id: "a", scheduledDate: dayDate, completed: true, rewardValue: 40 })]
    const points: PointsLedgerEntry[] = [
      { date: day, points: 40 },
      { date: "2026-06-01", points: 999 },
    ]
    const r = computePlanVsReality("day", day, tasks, points, null)
    expect(r.actualPoints).toBe(40)
    expect(r.plannedPoints).toBe(40)
  })

  it("marks hasPlan false and zero score when nothing was planned", () => {
    const r = computePlanVsReality("day", day, [], [], "")
    expect(r.hasPlan).toBe(false)
    expect(r.varianceScore).toBe(0)
    expect(r.alignmentScore).toBe(0)
    expect(r.metrics.every((m) => !m.applicable)).toBe(true)
  })

  it("ignores tasks scheduled outside the period", () => {
    const tasks = [
      task({ id: "a", scheduledDate: dayDate, completed: true }),
      task({ id: "b", scheduledDate: new Date(2026, 0, 1), completed: true }),
    ]
    const r = computePlanVsReality("day", day, tasks, [], null)
    expect(r.plannedTaskCount).toBe(1)
  })

  it("captures the user's intentions from plan text", () => {
    const r = computePlanVsReality("day", day, [], [], "Ship feature\nWrite tests")
    expect(r.intentionCount).toBe(2)
    expect(r.intentions).toEqual(["Ship feature", "Write tests"])
  })
})

describe("recentPeriodKeys", () => {
  it("returns the requested number of day keys ending today", () => {
    const today = new Date(2026, 5, 23)
    const keys = recentPeriodKeys("day", 3, today)
    expect(keys).toEqual(["2026-06-21", "2026-06-22", "2026-06-23"])
    expect(keys[keys.length - 1]).toBe(formatLocalDateKey(today))
  })

  it("returns month keys", () => {
    const today = new Date(2026, 5, 23)
    expect(recentPeriodKeys("month", 3, today)).toEqual(["2026-04", "2026-05", "2026-06"])
  })
})
