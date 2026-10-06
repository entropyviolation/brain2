import { describe, expect, it } from "vitest"
import { lunarPhaseInstant } from "./lunar"
import { localDayKey } from "./reviews-store"
import {
  STAR_LORD_RITUALS,
  isBirthday,
  listStarLordSlots,
  parseBirthday,
  starLordAwardPoints,
  starLordOccasion,
  starLordPhase,
} from "./star-lord"

function localNoonFromInstant(instant: Date): Date {
  return new Date(instant.getFullYear(), instant.getMonth(), instant.getDate(), 12, 0, 0)
}

describe("star lord reports", () => {
  const newMoon = localNoonFromInstant(lunarPhaseInstant(-283))
  const newMoonKey = localDayKey(newMoon)

  it("opens a new-moon slot on the phase day and keeps it the next day if undone", () => {
    const today = listStarLordSlots([], newMoon, null)
    expect(today.map((s) => s.kind)).toEqual(["new"])
    expect(today[0]?.status).toBe("none")
    expect(today[0]?.dateKey).toBe(newMoonKey)

    const next = new Date(newMoon)
    next.setDate(next.getDate() + 1)
    const late = listStarLordSlots([], next, null)
    expect(late.map((s) => `${s.kind}:${s.dateKey}`)).toEqual([`new:${newMoonKey}`])

    const done = listStarLordSlots(
      [{ id: `new:${newMoonKey}`, kind: "new", dateKey: newMoonKey, answers: { guarded: "yes" }, completed: true }],
      next,
      null,
    )
    expect(done).toEqual([])
  })

  it("keeps a birthday that lands on a moon as its own rite", () => {
    const month = String(newMoon.getMonth() + 1).padStart(2, "0")
    const day = String(newMoon.getDate()).padStart(2, "0")
    const slots = listStarLordSlots([], newMoon, `${month}-${day}`)
    expect(slots.map((s) => s.kind)).toEqual(["new", "birth"])
  })

  it("moves a Feb 29 birthday to March 1 in a common year", () => {
    expect(isBirthday(new Date(2026, 2, 1, 12), "1996-02-29")).toBe(true)
    expect(isBirthday(new Date(2026, 1, 28, 12), "1996-02-29")).toBe(false)
    expect(isBirthday(new Date(2028, 1, 29, 12), "1996-02-29")).toBe(true)
    expect(parseBirthday("02-29")).toEqual({ month: 2, day: 29 })
    expect(parseBirthday("nope")).toBeNull()
  })

  it("awards a section per answer plus the whole-rite bonus, and nothing for a draft", () => {
    const answers = { guarded: "old pattern", action: "  one walk  ", ignored: "no" }
    expect(starLordAwardPoints("new", answers, { sectionPoints: 10, completionBonus: 30 }, true)).toBe(50)
    expect(starLordAwardPoints("new", answers, { sectionPoints: 10, completionBonus: 30 }, false)).toBe(0)
    expect(starLordPhase({ id: "new:x", kind: "new", dateKey: "x", answers, completed: false })).toBe("partial")
  })

  it("ships six questions on each rite", () => {
    for (const ritual of Object.values(STAR_LORD_RITUALS)) {
      expect(ritual.questions).toHaveLength(6)
      expect(ritual.questions.filter((q) => q.group === "ledger")).toHaveLength(3)
      expect(ritual.questions.filter((q) => q.group === "alchemy")).toHaveLength(3)
    }
    expect(starLordOccasion(newMoon, null)).toBe("new")
  })
})
