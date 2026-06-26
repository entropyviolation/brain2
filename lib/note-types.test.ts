import { describe, it, expect } from "vitest"
import {
  NOTE_TYPE_ID,
  NOTE_ATTR,
  getNoteTypeDefinition,
  withNoteType,
} from "@/lib/note-types"
import type { ItemTypeDefinition } from "@/lib/types"

describe("Note type definition", () => {
  it("is a built-in, non-completable document type", () => {
    const def = getNoteTypeDefinition()
    expect(def.id).toBe(NOTE_TYPE_ID)
    expect(def.builtin).toBe(true)
    expect(def.capabilities?.completable).toBe(false)
  })

  it("surfaces the 'body' detail panel for the rich-text editor", () => {
    const def = getNoteTypeDefinition()
    expect(def.detailPanels).toContain("body")
    expect(def.detailPanels).toContain("details")
  })

  it("carries its schema attributes + sensible defaults", () => {
    const def = getNoteTypeDefinition()
    const ids = (def.attributes ?? []).map((a) => a.id)
    for (const id of Object.values(NOTE_ATTR)) expect(ids).toContain(id)

    const status = def.attributes?.find((a) => a.id === NOTE_ATTR.status)
    expect(status?.type).toBe("selection")
    expect(status?.options).toEqual(["draft", "evergreen", "archived"])
    expect(def.defaultAttributeValues?.[NOTE_ATTR.status]).toBe("draft")
  })
})

describe("withNoteType (seed helper)", () => {
  const existing: ItemTypeDefinition[] = [
    { id: "task", name: "Task", builtin: true },
    { id: "book", name: "Book" },
  ]

  it("appends the Note type, preserving existing types", () => {
    const next = withNoteType(existing)
    expect(next.map((t) => t.id)).toEqual(["task", "book", NOTE_TYPE_ID])
    expect(next).not.toBe(existing)
  })

  it("is idempotent (same reference when already seeded)", () => {
    const once = withNoteType(existing)
    const twice = withNoteType(once)
    expect(twice).toBe(once)
  })

  it("does not duplicate an existing note type", () => {
    const seeded = withNoteType(existing)
    expect(seeded.filter((t) => t.id === NOTE_TYPE_ID)).toHaveLength(1)
  })
})
