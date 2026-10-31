import { beforeEach, describe, expect, it } from "vitest"
import { undoLastAction } from "@/lib/action-history"
import { getDefaultHabits, useHabitsStore } from "@/lib/habits-store"
import { useTaskStore } from "@/lib/task-store"
import { TaskType } from "@/lib/types"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { resetAllStores } from "@/tests/test-utils"
import { acceptSuggestion, acceptedBlockStamp, dayPieces, llmOverlaps, notesItems, renderNotes } from "./accept"
import type { Suggestion } from "./suggestions"

describe("dayPieces", () => {
  it("keeps a same-day block whole", () => {
    expect(dayPieces(new Date(2026, 9, 29, 10).toISOString(), new Date(2026, 9, 29, 11, 30).toISOString())).toEqual([{ date: "2026-10-29", startMin: 600, endMin: 690 }])
  })
  it("splits a block over midnight", () => {
    expect(dayPieces(new Date(2026, 9, 29, 23).toISOString(), new Date(2026, 9, 30, 1).toISOString())).toEqual([
      { date: "2026-10-29", startMin: 1380, endMin: 1440 },
      { date: "2026-10-30", startMin: 0, endMin: 60 },
    ])
  })
})

const base = (over: Partial<Suggestion>): Suggestion => ({
  id: "s1",
  kind: "timeblock",
  title: "Dishes",
  detail: "",
  at: new Date(2026, 9, 29, 10).toISOString(),
  source: "bim",
  why: "said so",
  evidence: [],
  ...over,
})

const activity = () => useTimeTrackingStore.getState().entries.filter((e) => e.scopeId === "activity")

describe("acceptSuggestion", () => {
  beforeEach(() => {
    resetAllStores()
    useHabitsStore.setState({ tasks: getDefaultHabits(), weeklyData: {} })
  })

  it("paints a block over midnight as two stamped Activity rows, undone in one step", () => {
    const s = base({ at: new Date(2026, 9, 29, 23).toISOString(), end: new Date(2026, 9, 30, 1).toISOString(), estimated: true })
    expect(acceptSuggestion(s).ok).toBe(true)
    const rows = activity()
    expect(rows.map((e) => [e.date, e.startMin, e.endMin])).toEqual([
      ["2026-10-29", 1380, 1440],
      ["2026-10-30", 0, 60],
    ])
    for (const e of rows) {
      expect(e.generatedBy).toEqual(acceptedBlockStamp("s1"))
      expect(e.precision).toBe("estimated")
      expect(e.notes).toContain("Autodetected by the BIM LLM flow.")
    }
    expect(undoLastAction()).toBe(true)
    expect(activity()).toHaveLength(0)
  })

  it("refuses a block over time the person painted", () => {
    useTimeTrackingStore.getState().paintMinutes("2026-10-29", "activity", 630, 660, useTimeTrackingStore.getState().scopes.find((x) => x.id === "activity")!.pens[0]!.id)
    const r = acceptSuggestion(base({ end: new Date(2026, 9, 29, 11).toISOString() }))
    expect(r.ok).toBe(false)
    expect(activity()).toHaveLength(1)
  })

  it("lets two different LLM blocks overlap, and lists the overlap", () => {
    expect(acceptSuggestion(base({ id: "a", title: "Dishes", end: new Date(2026, 9, 29, 11).toISOString() })).ok).toBe(true)
    const r = acceptSuggestion(base({ id: "b", title: "Podcast", at: new Date(2026, 9, 29, 10, 30).toISOString(), end: new Date(2026, 9, 29, 12).toISOString() }))
    expect(r.ok).toBe(true)
    expect(r.message).toContain("OVERLAPS 1 LLM BLOCK")
    expect(activity().map((e) => [e.startMin, e.endMin])).toEqual([[600, 660], [630, 720]])
    expect(llmOverlaps(useTimeTrackingStore.getState().entries)).toMatchObject([{ date: "2026-10-29", startMin: 630, endMin: 660 }])
    // Setting one block's true end trims the other where they met.
    const dishes = activity().find((e) => e.startMin === 600)!
    useTimeTrackingStore.getState().moveEntryTo(dishes.id, 600, 640)
    expect(llmOverlaps(useTimeTrackingStore.getState().entries)).toHaveLength(0)
  })

  it("merges two detections of the same thing at the same time, keeping both in notes", () => {
    acceptSuggestion(base({ id: "a", why: "said starting dishes", evidence: ["10:00 starting dishes"], end: new Date(2026, 9, 29, 11).toISOString() }))
    const r = acceptSuggestion(base({ id: "b", why: "text about dishes", source: "text", evidence: ["10:40 doing dishes lol"], at: new Date(2026, 9, 29, 10, 30).toISOString(), end: new Date(2026, 9, 29, 11, 15).toISOString() }), "it was more like 10:20")
    expect(r.message).toContain("MERGED WITH 1")
    const rows = activity()
    expect(rows).toHaveLength(1)
    expect([rows[0]!.startMin, rows[0]!.endMin]).toEqual([600, 675])
    expect(rows[0]!.generatedBy?.id).toBe("bim-suggest:a+b")
    const notes = rows[0]!.notes!
    expect(notes).toContain("Autodetected by the BIM LLM flow.")
    expect(notes).toContain("Detected 2 times by LLM:")
    expect(notes).toContain("> 10:00 starting dishes")
    expect(notes).toContain("> 10:40 doing dishes lol")
    expect(notes).toContain("Note: it was more like 10:20")
    expect(undoLastAction()).toBe(true)
    expect(activity()).toHaveLength(1)
    expect(activity()[0]!.endMin).toBe(660)
  })

  it("adds an item through Quick Add", () => {
    const before = useTaskStore.getState().tasks.length
    const r = acceptSuggestion(base({ kind: "item", title: "buy lemons" }))
    expect(r.ok).toBe(true)
    const added = useTaskStore.getState().tasks.slice(before)
    expect(added.map((t) => t.title)).toContain("buy lemons")
  })

  it("marks a habit done on the suggestion's day", () => {
    const habit = useHabitsStore.getState().tasks.find((t) => t.type === TaskType.BOOLEAN)
    expect(habit).toBeTruthy()
    const r = acceptSuggestion(base({ kind: "habit", title: habit!.name, habitId: habit!.id }))
    expect(r.ok).toBe(true)
    expect(useHabitsStore.getState().weeklyData["2026-10-29"]?.[habit!.id]?.completed).toBe(true)
  })

  it("refuses a habit that no longer exists", () => {
    expect(acceptSuggestion(base({ kind: "habit", habitId: "gone" })).ok).toBe(false)
  })
})

describe("notes", () => {
  it("reads back the detections it wrote, and treats other notes as one", () => {
    expect(notesItems(renderNotes(["one\n   > a", "two"]))).toEqual(["one\n   > a", "two"])
    expect(notesItems("my own words")).toEqual(["my own words"])
    expect(notesItems("")).toEqual([])
  })
})
