import { beforeEach, describe, expect, it } from "vitest"
import { parseAppendLog, serializeAppendLog } from "./append-log"
import {
  appendDayNote,
  DAY_NOTES_PERSIST_KEY,
  getDayNote,
  getDayNoteEntries,
  getDayNotesPersist,
  mergeDayNotes,
  resetDayNotesPersist,
  seedDayNotesPersist,
  setDayNotePersist,
} from "./day-notes-persist"

beforeEach(() => {
  resetDayNotesPersist()
})

describe("day-notes-persist", () => {
  it("writes a jot to its own key, not the timegrid blob", () => {
    setDayNotePersist("2026-09-21", "river otter pup notes 2026-09-21 — stayed after refresh")
    expect(getDayNote("2026-09-21")).toBe("river otter pup notes 2026-09-21 — stayed after refresh")
    expect(JSON.parse(localStorage.getItem(DAY_NOTES_PERSIST_KEY) ?? "{}")["2026-09-21"]).toBe(
      "river otter pup notes 2026-09-21 — stayed after refresh",
    )
    expect(localStorage.getItem("cogs-timegrid-store")).toBeNull()
  })

  it("appends a stamped note onto a leftover plaintext jot", () => {
    setDayNotePersist("2026-09-21", "ate at 1")
    const entry = appendDayNote("2026-09-21", "zoo 4-5", new Date(2026, 8, 21, 16, 0, 0))
    expect(entry?.text).toBe("zoo 4-5")
    const entries = getDayNoteEntries("2026-09-21")
    expect(entries.map((e) => e.text)).toEqual(["ate at 1", "zoo 4-5"])
    expect(JSON.parse(getDayNote("2026-09-21")).v).toBe(1)
  })

  it("keeps the dedicated jot when a timegrid blob has empty dayNotes", () => {
    setDayNotePersist("2026-09-21", "river otter pup notes 2026-09-21 — stayed after refresh")
    const merged = mergeDayNotes({}, {}, { "2026-09-21": getDayNote("2026-09-21") })
    expect(merged["2026-09-21"]).toBe("river otter pup notes 2026-09-21 — stayed after refresh")
  })

  it("seeds from an older timegrid map without wiping a newer jot", () => {
    setDayNotePersist("2026-09-21", "typed just now")
    seedDayNotesPersist({ "2026-09-21": "old hub copy", "2026-09-20": "ate at 1" })
    expect(getDayNote("2026-09-21")).toBe("typed just now")
    expect(getDayNote("2026-09-20")).toBe("ate at 1")
  })

  it("drops the key when the jot is cleared", () => {
    setDayNotePersist("2026-09-21", "temporary")
    setDayNotePersist("2026-09-21", "")
    expect(getDayNote("2026-09-21")).toBe("")
    expect(JSON.parse(localStorage.getItem(DAY_NOTES_PERSIST_KEY) ?? "{}")["2026-09-21"]).toBeUndefined()
  })

  it("unions entries when a seed copy of the same day has one this profile lacks", () => {
    appendDayNote("2026-09-21", "zoo 4-5", new Date(2026, 8, 21, 16, 0, 0))
    const mine = getDayNote("2026-09-21")
    const theirs = serializeAppendLog([
      ...parseAppendLog(mine),
      { id: "al_from_chrome", createdAt: "2026-09-21T23:38:48.687Z", text: "stuck in aisle 4" },
    ])
    seedDayNotesPersist({ "2026-09-21": theirs })
    expect(getDayNoteEntries("2026-09-21").map((e) => e.text)).toEqual(["zoo 4-5", "stuck in aisle 4"])
  })

  it("does not resurrect a jot the user cleared this session", () => {
    setDayNotePersist("2026-09-21", "temporary")
    setDayNotePersist("2026-09-21", "")
    seedDayNotesPersist({ "2026-09-21": "old hub copy" })
    expect(getDayNote("2026-09-21")).toBe("")
    expect(mergeDayNotes({ "2026-09-21": "old hub copy" }, {}, getDayNotesPersist())["2026-09-21"]).toBeUndefined()
  })
})
