import { describe, expect, it } from "vitest"
import { debtAt, isFreeNight, nightsAfter, sleepRegularityIndex, socialJetlag } from "./sleep-rhythm"
import { rhythmStats, filterDays } from "./circadian-rhythm"
import { anchorsFor, hourProfile, overlapSplit, rankWithAnchors } from "./screen-time-stats"
import { cycleLengths, splitCycles } from "./cycle-wheel"
import type { DatedPhase } from "./cycle-phase-stats"

const night = (date: string, sleptMin: number, wokeMin: number) => ({ date, sleptMin, wokeMin, minutes: wokeMin - sleptMin })

describe("sleep-rhythm", () => {
  it("measures social jetlag from weekend vs weekday mid-sleep", () => {
    // 2026-10-17 is a Saturday, 10-18 a Sunday.
    const nights = [
      night("2026-10-14", 0, 420),
      night("2026-10-15", 0, 420),
      night("2026-10-17", 120, 600),
      night("2026-10-18", 120, 600),
    ]
    expect(isFreeNight("2026-10-17")).toBe(true)
    const j = socialJetlag(nights)!
    expect(j.jetlag).toBe(150)
    expect(j.nFree).toBe(2)
    expect(j.msfsc).toBeLessThan(j.msf)
    expect(socialJetlag(nights.slice(0, 3))).toBeNull()
  })

  it("scores an identical schedule as SRI 100", () => {
    const nights = ["2026-10-01", "2026-10-02", "2026-10-03"].map((d) => night(d, -60, 420))
    expect(sleepRegularityIndex(nights)).toEqual({ sri: 100, pairs: 2 })
    expect(sleepRegularityIndex(nights.slice(0, 2))).toBeNull()
  })

  it("counts late nights and what-if debt", () => {
    const nights = [night("2026-10-01", 30, 450), night("2026-10-02", 90, 450)]
    expect(nightsAfter(nights, 60)).toHaveLength(1)
    expect(debtAt(nights, 420)).toEqual({ debt: 60, atTarget: 1 })
  })
})

describe("circadian-rhythm", () => {
  it("gives IS 1 for identical days and null under the floor", () => {
    const day = Array.from({ length: 24 }, (_, h) => (h >= 9 && h < 19 ? 60 : 0))
    const stats = rhythmStats({ minutes: [day, day, day] })!
    expect(stats.is).toBeCloseTo(1)
    expect(stats.m10Start).toBe(9)
    expect(stats.l5).toBe(0)
    expect(stats.ra).toBe(1)
    expect(rhythmStats({ minutes: [day, day] })).toBeNull()
  })

  it("filters weekend days", () => {
    expect(filterDays(["2026-10-16", "2026-10-17", "2026-10-18"], "weekend")).toEqual(["2026-10-17", "2026-10-18"])
  })
})

describe("screen-time-stats", () => {
  it("adds anchors that fit the scale", () => {
    expect(anchorsFor(60).map((a) => a.minutes)).toEqual([120])
    expect(anchorsFor(600).length).toBe(2)
    const ranked = rankWithAnchors([{ id: "a", name: "Mail", minutes: 300 }], anchorsFor(300))
    expect(ranked[0]!.name).toBe("Mail")
    expect(ranked[1]!.anchor).toBe(true)
  })

  it("finds the peak hour over painted days only", () => {
    const blank = Array.from({ length: 24 }, () => 0)
    const busy = blank.map((_, h) => (h === 21 ? 50 : 10))
    const p = hourProfile({ dates: [], minutes: [busy, blank], max: 50, observedDays: 1, instants: [], secondaryMinutes: 0 })
    expect(p.days).toBe(1)
    expect(p.peakHour).toBe(21)
  })

  it("splits overlap into three shares of the union", () => {
    const s = overlapSplit(100, 300, 50)
    expect(s.screenOnly).toBe(50)
    expect(s.activityOnly).toBe(250)
    expect(s.shares.reduce((a, b) => a + b, 0)).toBeCloseTo(1)
  })
})

describe("cycle-wheel", () => {
  const day = (date: string, phase: DatedPhase["phase"]): DatedPhase => ({ date, phase, markedPhase: phase, basis: "marked" })
  it("splits at marked bleed onsets and measures complete cycles", () => {
    const dated: DatedPhase[] = []
    for (let i = 1; i <= 30; i++) {
      const date = `2026-09-${String(i).padStart(2, "0")}`
      dated.push(day(date, i === 2 || i === 3 || i === 30 ? "menstrual" : "follicular"))
    }
    const runs = splitCycles(dated)
    expect(runs.map((r) => r.hasOnset)).toEqual([false, true, true])
    expect(runs[1]!.days).toHaveLength(28)
    expect(cycleLengths(runs)).toEqual({ n: 1, median: 28, min: 28, max: 28 })
  })
})
