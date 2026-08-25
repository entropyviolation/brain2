import { describe, expect, it } from "vitest"
import type { AppleNote } from "@/lib/apple-notes"
import { categorizeNote, categorizeNotes, groupAssignments } from "@/lib/apple-notes-categorize"

function note(over: Partial<AppleNote> = {}): AppleNote {
  return {
    id: "n1",
    title: "Milk",
    body: "2 percent",
    folder: "Groceries",
    account: "iCloud",
    createdAt: "2026-08-20T12:00:00.000Z",
    modifiedAt: "2026-08-21T12:00:00.000Z",
    ...over,
  }
}

const lists = [
  { id: "g", name: "Groceries" },
  { id: "w", name: "Work" },
]

describe("categorizeNote", () => {
  it("matches the Apple Notes folder to an existing list", () => {
    const a = categorizeNote(note(), lists)
    expect(a.listId).toBe("g")
    expect(a.create).toBe(false)
    expect(a.score).toBeGreaterThanOrEqual(40)
  })

  it("creates a list from a unique folder name", () => {
    const a = categorizeNote(note({ folder: "Trip ideas" }), lists)
    expect(a.create).toBe(true)
    expect(a.listName).toBe("Trip ideas")
    expect(a.listId).toBeUndefined()
  })

  it("falls back to From Notes for generic iCloud folders", () => {
    const a = categorizeNote(note({ folder: "Notes", title: "asdf qwer", body: "zzzz" }), lists)
    expect(a.create).toBe(true)
    expect(a.listName).toBe("From Notes")
  })

  it("honors a Category: hint in the title", () => {
    const a = categorizeNote(note({ folder: "Notes", title: "Work: ship the patch notes" }), lists)
    expect(a.listId).toBe("w")
    expect(a.create).toBe(false)
  })
})

describe("groupAssignments", () => {
  it("clusters kept notes by destination list", () => {
    const assignments = categorizeNotes(
      [note({ id: "a" }), note({ id: "b", title: "Bread" }), note({ id: "c", folder: "Work", title: "Standup" })],
      lists,
    )
    const groups = groupAssignments(assignments)
    expect(groups).toHaveLength(2)
    const groceries = groups.find((g) => g.listId === "g")
    const work = groups.find((g) => g.listId === "w")
    expect(groceries?.noteIds).toEqual(["a", "b"])
    expect(work?.noteIds).toEqual(["c"])
  })
})
