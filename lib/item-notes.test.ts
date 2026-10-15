import { describe, expect, it } from "vitest"
import { groupNotesByDay, makeNoteEntry, noteClockLabel, noteDayLabel, notesNewestFirst } from "./item-notes"
import { resourceKind, formatBytes } from "./item-resources"

describe("item notes", () => {
  const now = new Date(2026, 9, 13, 9, 5)

  it("stamps a new entry with today and the clock, or a chosen day without a clock", () => {
    expect(makeNoteEntry("  hi  ", { now })).toMatchObject({ date: "2026-10-13", time: "09:05", text: "hi" })
    const undated = makeNoteEntry("later", { date: "2026-10-01", time: null, now })
    expect(undated).toMatchObject({ date: "2026-10-01", text: "later" })
    expect(undated?.time).toBeUndefined()
    expect(makeNoteEntry("   ", { now })).toBeNull()
  })

  it("sorts newest first and groups by day", () => {
    const sorted = notesNewestFirst([
      { id: "a", date: "2026-10-01", text: "a" },
      { id: "b", date: "2026-10-13", time: "08:00", text: "b" },
      { id: "c", date: "2026-10-13", time: "21:00", text: "c" },
    ])
    expect(sorted.map((e) => e.id)).toEqual(["c", "b", "a"])
    expect(groupNotesByDay(sorted).map((g) => [g.date, g.entries.length])).toEqual([
      ["2026-10-13", 2],
      ["2026-10-01", 1],
    ])
  })

  it("labels days and clocks for reading", () => {
    expect(noteDayLabel("2026-10-13", now)).toBe("Today")
    expect(noteDayLabel("2026-10-12", now)).toBe("Yesterday")
    expect(noteDayLabel("2025-01-02", now)).toBe("Thu Jan 2, 2025")
    expect(noteClockLabel("21:42")).toBe("9:42 PM")
  })
})

describe("item resources", () => {
  it("reads a kind from mime or name", () => {
    expect(resourceKind({ mime: "application/pdf", name: "x" })).toBe("pdf")
    expect(resourceKind({ mime: "", name: "a.PNG" })).toBe("image")
    expect(resourceKind({ mime: "text/csv", name: "a.csv" })).toBe("sheet")
    expect(resourceKind({ mime: "application/octet-stream", name: "a.bin" })).toBe("other")
    expect(formatBytes(1536)).toBe("1.5 KB")
  })
})
