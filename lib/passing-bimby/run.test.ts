import { beforeEach, describe, expect, it } from "vitest"
import { getDayNote, resetDayNotesPersist } from "@/lib/day-notes-persist"
import { notePassing, passingForDay } from "./run"

const NOW = new Date(2026, 10, 24, 9, 25)

describe("notePassing", () => {
  beforeEach(() => resetDayNotesPersist())
  it("adds the notes to the day's Tracking notes, once", () => {
    const r = notePassing("spent a few hrs building playlists this morning. Elijah gets home 2pm", NOW)!
    expect(r.date).toBe("2026-11-24")
    expect(r.reply).toBe("Noted on today's Tracking: building playlists, about 3 h, this morning · Elijah gets home, 2 PM.")
    const note = getDayNote("2026-11-24")
    expect(note).toContain("Said in passing at 9:25 AM:")
    expect(note).toContain('- activity: building playlists, about 3 h, this morning ("spent a few hrs building playlists this morning.")')
    expect(note).toContain("- event: Elijah gets home, 2 PM")
    expect(notePassing("Elijah gets home 2pm", new Date(2026, 10, 24, 9, 40))).toBeNull()
  })
  it("writes nothing for a line with nothing to track", () => {
    expect(notePassing("add milk to shopping", NOW)).toBeNull()
    expect(getDayNote("2026-11-24")).toBe("")
  })
})

describe("passingForDay", () => {
  it("reads only that day's lines", () => {
    const lines = [
      { text: "been cleaning for 2 hours", at: new Date(2026, 10, 24, 8, 0).toISOString() },
      { text: "feeling tired", at: new Date(2026, 10, 23, 22, 0).toISOString() },
    ]
    expect(passingForDay(lines, "2026-11-24").map((n) => n.what)).toEqual(["cleaning"])
  })
})
