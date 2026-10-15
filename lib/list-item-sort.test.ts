import { describe, expect, it } from "vitest"
import type { AttributeDefinition, Task } from "@/lib/types"
import {
  filterListItemsBySearch,
  listItemSortOptions,
  sanitizeListItemSort,
  sortListItems,
} from "./list-item-sort"

const task = (id: string, extra: Partial<Task> = {}): Task =>
  ({
    id,
    description: id,
    title: id,
    lists: ["books"],
    stage: "list",
    completed: false,
    createdAt: new Date("2026-01-01"),
    ...extra,
  }) as Task

const ids = (tasks: Task[]) => tasks.map((t) => t.id)

describe("sanitizeListItemSort", () => {
  it("keeps built-in and attribute keys, drops custom and junk", () => {
    expect(sanitizeListItemSort({ key: "title", dir: "desc" })).toEqual({ key: "title", dir: "desc" })
    expect(sanitizeListItemSort({ key: "attr:mood", dir: "sideways" })).toEqual({ key: "attr:mood", dir: "asc" })
    expect(sanitizeListItemSort({ key: "custom", dir: "asc" })).toBeUndefined()
    expect(sanitizeListItemSort({ key: "attr:", dir: "asc" })).toBeUndefined()
    expect(sanitizeListItemSort({ key: "nope" })).toBeUndefined()
    expect(sanitizeListItemSort(null)).toBeUndefined()
  })
})

describe("sortListItems", () => {
  const rows = [
    task("banana", { createdAt: new Date("2026-03-01"), urgency: 2 }),
    task("apple", { createdAt: new Date("2026-01-01") }),
    task("cherry", { createdAt: new Date("2026-02-01"), urgency: 5 }),
  ]

  it("custom / unset returns stored order (same array)", () => {
    expect(sortListItems(rows, undefined)).toBe(rows)
    expect(sortListItems(rows, { key: "custom", dir: "asc" })).toBe(rows)
  })

  it("sorts by name and by created date in both directions", () => {
    expect(ids(sortListItems(rows, { key: "title", dir: "asc" }))).toEqual(["apple", "banana", "cherry"])
    expect(ids(sortListItems(rows, { key: "title", dir: "desc" }))).toEqual(["cherry", "banana", "apple"])
    expect(ids(sortListItems(rows, { key: "created", dir: "desc" }))).toEqual(["banana", "cherry", "apple"])
  })

  it("sinks missing values in both directions", () => {
    expect(ids(sortListItems(rows, { key: "urgency", dir: "desc" }))).toEqual(["cherry", "banana", "apple"])
    expect(ids(sortListItems(rows, { key: "urgency", dir: "asc" }))).toEqual(["banana", "cherry", "apple"])
  })

  it("sorts by date added to this list, falling back to created", () => {
    const joined = [
      task("old-joined-late", { createdAt: new Date("2025-01-01"), listAddedAt: { books: "2026-06-01T00:00:00.000Z" } }),
      task("created-mid", { createdAt: new Date("2026-03-01") }),
    ]
    expect(ids(sortListItems(joined, { key: "added", dir: "desc" }, { listId: "books" }))).toEqual([
      "old-joined-late",
      "created-mid",
    ])
    expect(ids(sortListItems(joined, { key: "created", dir: "desc" }))).toEqual(["created-mid", "old-joined-late"])
  })

  it("sorts by an attribute: numbers numerically, selections by option order", () => {
    const defs: AttributeDefinition[] = [
      { id: "pages", name: "Pages", type: "number" },
      { id: "status", name: "Status", type: "selection", options: ["want", "reading", "done"] },
    ]
    const books = [
      task("a", { attributes: { pages: 300, status: "done" } }),
      task("b", { attributes: { pages: 90, status: "want" } }),
      task("c", { attributes: { pages: "1200", status: "reading" } }),
      task("d"),
    ]
    expect(ids(sortListItems(books, { key: "attr:pages", dir: "asc" }, { defs }))).toEqual(["b", "a", "c", "d"])
    expect(ids(sortListItems(books, { key: "attr:status", dir: "asc" }, { defs }))).toEqual(["b", "c", "a", "d"])
  })
})

describe("listItemSortOptions", () => {
  it("lists built-ins then sortable attributes, skipping files and formulas", () => {
    const opts = listItemSortOptions([
      { id: "mood", name: "Mood", type: "selection" },
      { id: "cover", name: "Cover", type: "image" },
      { id: "total", name: "Total", type: "formula" },
      { id: "mood", name: "Mood again", type: "string" },
    ])
    expect(opts[0]).toMatchObject({ key: "custom", group: "item" })
    expect(opts.filter((o) => o.group === "attribute")).toEqual([{ key: "attr:mood", label: "Mood", group: "attribute" }])
  })
})

describe("filterListItemsBySearch", () => {
  const rows = [
    task("Dune", { notes: "desert planet spice", attributes: { author: "Herbert", owned: true } } as Partial<Task>),
    task("Emma", { tags: ["classic"], body: "Highbury matchmaking" }),
  ]
  const defs: AttributeDefinition[] = [
    { id: "author", name: "Author", type: "string" },
    { id: "owned", name: "Owned", type: "boolean" },
  ]

  it("matches names only by default", () => {
    expect(ids(filterListItemsBySearch(rows, "dune"))).toEqual(["Dune"])
    expect(ids(filterListItemsBySearch(rows, "spice"))).toEqual([])
  })

  it("all fields reads notes, body, tags, attribute values, and true booleans by name", () => {
    expect(ids(filterListItemsBySearch(rows, "spice", { allFields: true, defs }))).toEqual(["Dune"])
    expect(ids(filterListItemsBySearch(rows, "herbert", { allFields: true, defs }))).toEqual(["Dune"])
    expect(ids(filterListItemsBySearch(rows, "owned", { allFields: true, defs }))).toEqual(["Dune"])
    expect(ids(filterListItemsBySearch(rows, "classic highbury", { allFields: true, defs }))).toEqual(["Emma"])
  })

  it("blank query returns the rows unchanged", () => {
    expect(filterListItemsBySearch(rows, "  ")).toBe(rows)
  })
})
