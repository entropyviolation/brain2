import { describe, expect, it } from "vitest"
import {
  formatMajorWhen,
  lunarOccasion,
  lunarPhaseInstant,
  lunarPhaseJde,
  majorPhaseInstant,
  moonGlance,
  moonIlluminationLine,
  moonLitPath,
  moonUntilPhrase,
  neighboringMajorPhases,
} from "./lunar"

describe("lunar phases", () => {
  it("places the February 1977 new moon on Meeus's instant", () => {
    // Astronomical Algorithms, ch. 49: k = -283 → 1977 Feb 18, 3h 37m TD.
    const jde = lunarPhaseJde(-283)
    expect(jde).toBeCloseTo(2443192.65118, 2)
    const instant = lunarPhaseInstant(-283)
    expect(instant.toISOString().slice(0, 13)).toBe("1977-02-18T03")
  })

  it("places the 8 April 2024 new moon on that UTC day", () => {
    // Total solar eclipse: new moon 8 April 2024, about 18:21 UTC.
    const instants = [-1, 0, 1].map((d) => lunarPhaseInstant(Math.round(((2024 + 3 / 12 - 2000) * 12.3685)) + d))
    const hit = instants.find((d) => d.toISOString().startsWith("2024-04-08"))
    expect(hit, instants.map((d) => d.toISOString()).join("\n")).toBeTruthy()
    expect(hit!.getUTCHours()).toBeGreaterThanOrEqual(17)
    expect(hit!.getUTCHours()).toBeLessThanOrEqual(19)
  })

  it("names the local day that contains the phase", () => {
    const instant = lunarPhaseInstant(-283)
    const localNoon = new Date(instant.getFullYear(), instant.getMonth(), instant.getDate(), 12, 0, 0)
    expect(lunarOccasion(localNoon)).toBe("new")
    const nextDay = new Date(localNoon)
    nextDay.setDate(nextDay.getDate() + 1)
    expect(lunarOccasion(nextDay)).not.toBe("new")
  })

  it("names a waxing crescent and counts toward the sooner full moon", () => {
    const base = Math.round((2024 + 3 / 12 - 2000) * 12.3685)
    let newInstant = lunarPhaseInstant(base)
    for (let delta = -4; delta <= 4; delta++) {
      const instant = lunarPhaseInstant(base + delta)
      if (instant.toISOString().startsWith("2024-04-08")) newInstant = instant
    }
    const waxing = new Date(newInstant.getTime() + 4 * 86_400_000)
    const glance = moonGlance(waxing)
    expect(glance.phase).toBe("waxing-crescent")
    expect(glance.label).toBe("Waxing crescent")
    expect(glance.waxing).toBe(true)
    expect(glance.untilKind).toBe("full")
    expect(glance.untilPhrase).toMatch(/days until full moon/)
    expect(glance.daysUntilFull).toBeLessThan(glance.daysUntilNew)
    expect(glance.illumination).toBeGreaterThan(0)
    expect(glance.illumination).toBeLessThan(0.5)
  })

  it("counts toward the new moon once the disk is waning", () => {
    const base = Math.round((2024 + 3 / 12 - 2000) * 12.3685)
    let fullInstant = lunarPhaseInstant(base + 0.5)
    for (let delta = -4; delta <= 4; delta++) {
      const instant = lunarPhaseInstant(base + delta + 0.5)
      if (instant.toISOString().startsWith("2024-04-23")) fullInstant = instant
    }
    const waning = new Date(fullInstant.getTime() + 3 * 86_400_000)
    const glance = moonGlance(waning)
    expect(glance.label).toBe("Waning gibbous")
    expect(glance.waxing).toBe(false)
    expect(glance.untilKind).toBe("new")
    expect(glance.untilPhrase).toMatch(/days until new moon/)
    expect(moonUntilPhrase(0, "full")).toBe("Full moon today")
    expect(moonUntilPhrase(1, "new")).toBe("1 day until new moon")
  })

  it("names the major phase just passed and the next one", () => {
    const base = Math.round((2024 + 3 / 12 - 2000) * 12.3685)
    let newK = base
    for (let delta = -4; delta <= 4; delta++) {
      const instant = lunarPhaseInstant(base + delta)
      if (instant.toISOString().startsWith("2024-04-08")) newK = base + delta
    }
    const first = majorPhaseInstant(newK + 0.25)
    expect(first.toISOString().startsWith("2024-04-15")).toBe(true)
    expect(first.getUTCHours()).toBeGreaterThanOrEqual(16)
    expect(first.getUTCHours()).toBeLessThanOrEqual(22)
    const between = new Date(lunarPhaseInstant(newK).getTime() + 2 * 86_400_000)
    const pair = neighboringMajorPhases(between)
    expect(pair.previous.kind).toBe("new")
    expect(pair.next.kind).toBe("first")
    expect(moonIlluminationLine(0.21, 0.12)).toBe("Illumination: ~21% visible (increasing each night)")
    expect(moonIlluminationLine(0.8, 0.7)).toBe("Illumination: ~80% visible (decreasing each night)")
    expect(formatMajorWhen(new Date(2026, 9, 10, 11, 50))).toBe("October 10, 2026, at 11:50 am")
    const glance = moonGlance(between)
    expect(glance.illuminationLine).toMatch(/^Illumination: ~\d+% visible \(/)
    expect(glance.previousMajor.label).toBe("New Moon")
    expect(glance.nextMajor.label).toBe("First Quarter")
  })

  it("draws a dark new moon, a right-lit quarter, and a full disk", () => {
    expect(moonLitPath(0)).toBe("")
    expect(moonLitPath(0.25).startsWith("M 50 22 A 28 28 0 0 1")).toBe(true)
    expect(moonLitPath(0.5)).toBe("M 50 22 A 28 28 0 0 1 50 78 A 28 28 0 0 1 50 22")
    expect(moonLitPath(0.8).startsWith("M 50 22 A 28 28 0 0 0")).toBe(true)
  })
})
