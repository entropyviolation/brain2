import { describe, expect, it } from "vitest"
import { pinMatchingListsToTop, isMultiSelectableEntry, selectableEntryIds } from "@/lib/lists-folder-search"
import type { GridEntry } from "@/components/Lists/types"

const entry = (kind: GridEntry["kind"], id: string, name: string): GridEntry => ({
  kind,
  id,
  name,
  count: 0,
})

describe("pinMatchingListsToTop", () => {
  const entries = [
    entry("folder", "f1", "Projects"),
    entry("folder-all", "all", "All Items"),
    entry("list", "l1", "Groceries"),
    entry("list", "l2", "Work tasks"),
    entry("list", "l3", "Reading"),
  ]

  it("returns entries unchanged when the query is empty", () => {
    expect(pinMatchingListsToTop(entries, "  ")).toEqual(entries)
  })

  it("pins matching lists to the top and keeps other entries below", () => {
    expect(pinMatchingListsToTop(entries, "work").map((e) => e.id)).toEqual(["l2", "f1", "all", "l1", "l3"])
  })

  it("is case-insensitive and matches partial names", () => {
    expect(pinMatchingListsToTop(entries, "READ").map((e) => e.id)).toEqual(["l3", "f1", "all", "l1", "l2"])
  })

  it("does not treat folder names as list matches", () => {
    expect(pinMatchingListsToTop(entries, "projects").map((e) => e.id)).toEqual(entries.map((e) => e.id))
  })
})

describe("selectableEntryIds", () => {
  it("collects lists and folders and skips All Items", () => {
    expect(
      selectableEntryIds([
        entry("folder", "f1", "Projects"),
        entry("folder-all", "all", "All Items"),
        entry("list", "l1", "Groceries"),
        entry("smart", "daily", "Daily"),
      ]),
    ).toEqual({ listIds: ["l1"], folderIds: ["f1"] })
  })
})

describe("isMultiSelectableEntry", () => {
  it("allows lists and folders only", () => {
    expect(isMultiSelectableEntry(entry("list", "l", "L"))).toBe(true)
    expect(isMultiSelectableEntry(entry("folder", "f", "F"))).toBe(true)
    expect(isMultiSelectableEntry(entry("folder-all", "a", "All"))).toBe(false)
    expect(isMultiSelectableEntry(entry("smart", "s", "Daily"))).toBe(false)
  })
})
