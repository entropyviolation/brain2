import { describe, expect, it } from "vitest"
import { foldPersonNoteLog, hasPersonNoteLog, migratePersonNoteLogs } from "@/lib/person-notes-fold"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"

function personWith(extra: Partial<Task>): Task {
  return { id: "ada", title: "Ada", type: "person", ...extra } as Task
}

describe("foldPersonNoteLog", () => {
  it("moves dated notes into noteLog newest first, and drops the old field", () => {
    const task = personWith({
      noteLog: [{ id: "n2", date: "2026-05-01", text: "Item note" }],
      personProfile: {
        fullName: "Ada Lovelace",
        noteLog: [
          { id: "p1", date: "2026-01-10", text: "Met at the lab" },
          { id: "p2", date: "2026-08-02", text: "Moved to Leeds" },
        ],
      },
    })
    const next = foldPersonNoteLog(task)
    expect(next.noteLog?.map((e) => e.id)).toEqual(["p2", "n2", "p1"])
    expect(next.personProfile).toEqual({ fullName: "Ada Lovelace" })
    expect(hasPersonNoteLog(next)).toBe(false)
  })

  it("is idempotent and dedupes by id", () => {
    const task = personWith({
      noteLog: [{ id: "p1", date: "2026-01-10", text: "Met at the lab" }],
      personProfile: { noteLog: [{ id: "p1", date: "2026-01-10", text: "Met at the lab" }] },
    })
    const once = foldPersonNoteLog(task)
    expect(once.noteLog).toHaveLength(1)
    expect("personProfile" in once).toBe(false)
    expect(foldPersonNoteLog(once)).toBe(once)
  })

  it("leaves tasks with nothing to fold untouched", () => {
    const task = personWith({ personProfile: { fullName: "Ada" } })
    expect(foldPersonNoteLog(task)).toBe(task)
  })
})

describe("task-store v18 → v19", () => {
  it("folds person notes in a persisted v18 payload", () => {
    const migrate = useTaskStore.persist.getOptions().migrate!
    const v18 = {
      tasks: [
        personWith({ personProfile: { relation: "friend", noteLog: [{ id: "p1", date: "2026-02-02", text: "Soup" }] } }),
        { id: "t1", title: "Plain task" },
      ],
      lists: [],
      folders: [],
      removedTaskIds: [],
      removedListIds: [],
    }
    const out = migrate(v18, 18) as { tasks: Task[] }
    const ada = out.tasks.find((t) => t.id === "ada")!
    expect(ada.noteLog).toEqual([{ id: "p1", date: "2026-02-02", text: "Soup" }])
    expect(ada.personProfile).toEqual({ relation: "friend" })
    expect(out.tasks.find((t) => t.id === "t1")?.title).toBe("Plain task")
  })

  it("migratePersonNoteLogs returns the same state when nothing folds", () => {
    const state = { tasks: [{ id: "t1" }] }
    expect(migratePersonNoteLogs(state)).toBe(state)
  })
})
