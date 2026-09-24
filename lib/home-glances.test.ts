import { describe, expect, it } from "vitest"
import { harvestFace, inboxMillFace, nightWellFace, pickHomeNight } from "@/lib/home-glances"
import type { SleepNight } from "@/lib/sleep-log"

const night = (patch: Partial<SleepNight>): SleepNight => ({
  date: "2026-09-23",
  sleptMin: -30,
  wokeMin: 420,
  ...patch,
})

describe("home glances", () => {
  it("reads last night as hours, clocks, and sunset", () => {
    expect(nightWellFace(night({}), 23 * 60)).toEqual({
      crt: "7h 30m",
      footer: "asleep 11:30 PM · woke 7:00 AM · 30m after sunset",
    })
    expect(nightWellFace(night({ allNighter: true }))).toEqual({
      crt: "all-nighter",
      footer: "No sleep",
    })
    expect(nightWellFace(undefined)).toEqual({ crt: "—", footer: "No night logged" })
    const morning = new Date(2026, 8, 23, 9, 0)
    expect(pickHomeNight({ "2026-09-22": night({ date: "2026-09-22" }) }, morning)?.date).toBe("2026-09-22")
    expect(pickHomeNight({ "2026-09-23": night({}) }, morning)?.date).toBe("2026-09-23")
  })

  it("shows points still available today", () => {
    expect(harvestFace(48, 42)).toEqual({ crt: "42", footer: "42 left of 90" })
    expect(harvestFace(90, 0)).toEqual({ crt: "0", footer: "Day paid" })
    expect(harvestFace(0, 0)).toEqual({ crt: "—", footer: "Nothing left today" })
  })

  it("counts unclarified captures and names the newest", () => {
    expect(inboxMillFace([])).toEqual({ crt: "0", footer: "Inbox clear" })
    expect(inboxMillFace(["Call mom", "Buy milk"])).toEqual({ crt: "2", footer: "Call mom" })
  })
})