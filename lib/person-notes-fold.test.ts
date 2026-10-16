import { describe, expect, it } from "vitest"
import { foldPersonNoteLog, migratePersonNotesToNoteLog } from "@/lib/person-notes-fold"
import type { Task } from "@/lib/types"

const base = { id: "p1", description: "Elijah" } as Task

describe("foldPersonNoteLog", () => {
  it("moves person dated notes onto the item log, newest first, and drops the old field", () => {
    const task = {
      ...base,
      noteLog: [{ id: "n1", date: "2026-10-01", text: "item note" }],
      personProfile: {
        fullName: "Elijah G",
        noteLog: [
          { id: "pn-a", date: "2026-10-05", text: "newer" },
          { id: "pn-b", date: "2026-09-01", text: "older" },
        ],
      },
    } as Task
    const out = foldPersonNoteLog(task)
    expect(out.noteLog?.map((n) => n.id)).toEqual(["pn-a", "n1", "pn-b"])
    expect(out.personProfile).toEqual({ fullName: "Elijah G" })
  })

  it("is idempotent and skips ids already present", () => {
    const task = {
      ...base,
      noteLog: [{ id: "pn-a", date: "2026-10-05", text: "newer" }],
      personProfile: { noteLog: [{ id: "pn-a", date: "2026-10-05", text: "newer" }] },
    } as Task
    const once = foldPersonNoteLog(task)
    expect(once.noteLog).toHaveLength(1)
    expect(once.personProfile).toBeUndefined()
    expect(foldPersonNoteLog(once)).toBe(once)
  })

  it("leaves a task with no person notes untouched", () => {
    expect(foldPersonNoteLog(base)).toBe(base)
  })

  it("migrates a raw snapshot", () => {
    const state = { tasks: [{ ...base, personProfile: { noteLog: [{ id: "x", date: "2026-01-01", text: "t" }] } }] }
    const out = migratePersonNotesToNoteLog(state)
    expect((out.tasks[0] as Task).noteLog?.[0].text).toBe("t")
  })
})
