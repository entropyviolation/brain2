import { describe, expect, it } from "vitest"
import type { TimeEntry } from "@/lib/time-entries"
import { runGapQuestions, pastDates } from "./gaps"

const e = (p: Partial<TimeEntry>): TimeEntry => ({ id: Math.random().toString(36), date: "2026-11-03", scopeId: "activity", penId: "p", startMin: 0, endMin: 1, ...p }) as TimeEntry
const NOW = new Date(2026, 10, 5, 22, 0) // Thursday 22:00

describe("gap questions", () => {
  it("covers the past 7 days ending today, not the days since Monday", () => {
    expect(pastDates(NOW)).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"])
    expect(runGapQuestions([], NOW).dates).toHaveLength(7)
    expect(runGapQuestions([], new Date(2026, 10, 2, 10, 0)).windows.filter((w) => w.awakeMin > 0)).toHaveLength(7)
  })

  it("asks about a big Activity hole, with a seed for the timeblock pipeline", () => {
    const run = runGapQuestions([e({ startMin: 7 * 60, endMin: 12 * 60 }), e({ startMin: 16 * 60, endMin: 23 * 60 })], NOW, ["2026-11-03"])
    const q = run.questions.find((x) => x.lane === "activity")!
    expect(q.startMin).toBe(12 * 60)
    expect(q.endMin).toBe(16 * 60)
    expect(q.text).toContain("Tuesday")
    expect(q.seed).toMatch(/^On Tuesday from .* to .* I $/)
  })

  it("asks for Location where Activity is tracked but Location is blank", () => {
    const run = runGapQuestions([e({ startMin: 7 * 60, endMin: 23 * 60 })], NOW, ["2026-11-03"])
    expect(run.questions.some((q) => q.lane === "location")).toBe(true)
    expect(run.summary.activity).toBe(100)
    expect(run.summary.location).toBe(0)
  })

  it("asks about food when a tracked day has none, and not when it has", () => {
    const act = e({ startMin: 7 * 60, endMin: 23 * 60 })
    expect(runGapQuestions([act], NOW, ["2026-11-03"]).questions.some((q) => q.lane === "food")).toBe(true)
    const meals = [11, 15, 19].map((h) => e({ kind: "instant", intakeClass: "food", startMin: h * 60, endMin: h * 60 }))
    expect(runGapQuestions([act, ...meals], NOW, ["2026-11-03"]).questions.some((q) => q.lane === "food")).toBe(false)
  })

  it("leaves out sleep, the future, and the rest of today", () => {
    const sleep = e({ startMin: 0, endMin: 8 * 60, generatedBy: { kind: "sleep" } as TimeEntry["generatedBy"] })
    const run = runGapQuestions([sleep], NOW, ["2026-11-03", "2026-11-07", "2026-11-05"])
    expect(run.windows[0]!.runs).toEqual([[8 * 60, 1440]])
    expect(run.windows[1]!.awakeMin).toBe(0)
    expect(run.windows[2]!.runs).toEqual([[7 * 60, 22 * 60]])
  })

  it("keeps only the largest questions", () => {
    const run = runGapQuestions([], NOW, pastDates(NOW), { maxQuestions: 3 })
    expect(run.questions).toHaveLength(3)
    expect(run.trace.map((s) => s.stage)).toEqual(["window", "measure", "find", "ask"])
  })
})
