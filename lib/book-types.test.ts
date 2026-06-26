import { describe, it, expect } from "vitest"
import {
  BOOK_ATTR,
  BOOK_STATUSES,
  BOOK_TYPE_ID,
  DEFAULT_BOOK_STATUS,
  getBookTypeDefinition,
  withBookType,
} from "@/lib/book-types"
import type { ItemTypeDefinition } from "@/lib/types"

describe("Book type definition", () => {
  it("is a built-in, completable type", () => {
    const def = getBookTypeDefinition()
    expect(def.id).toBe(BOOK_TYPE_ID)
    expect(def.builtin).toBe(true)
    expect(def.capabilities?.completable).toBe(true)
  })

  it("carries author, ISBN, status, and a multifile attachment attribute", () => {
    const def = getBookTypeDefinition()
    const byId = new Map((def.attributes ?? []).map((a) => [a.id, a]))

    expect(byId.get(BOOK_ATTR.author)?.type).toBe("string")
    expect(byId.get(BOOK_ATTR.isbn)?.type).toBe("string")
    expect(byId.get(BOOK_ATTR.status)?.type).toBe("selection")
    expect(byId.get(BOOK_ATTR.status)?.options).toEqual([...BOOK_STATUSES])
    // The headline new primitive: PDFs attach via a multifile attribute.
    expect(byId.get(BOOK_ATTR.files)?.type).toBe("multifile")
  })

  it("defaults the status to 'to-read'", () => {
    const def = getBookTypeDefinition()
    expect(def.defaultAttributeValues?.[BOOK_ATTR.status]).toBe(DEFAULT_BOOK_STATUS)
    expect(DEFAULT_BOOK_STATUS).toBe("to-read")
  })
})

describe("withBookType (registration helper)", () => {
  const existing: ItemTypeDefinition[] = [{ id: "task", name: "Task", builtin: true }]

  it("appends the Book type, preserving existing types", () => {
    const next = withBookType(existing)
    expect(next.map((t) => t.id)).toEqual(["task", BOOK_TYPE_ID])
    expect(next).not.toBe(existing)
  })

  it("is idempotent (same reference when already registered)", () => {
    const once = withBookType(existing)
    expect(withBookType(once)).toBe(once)
    expect(once.filter((t) => t.id === BOOK_TYPE_ID)).toHaveLength(1)
  })
})
