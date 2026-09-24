/**
 * details-columns — Details defaults, explicit empty, independence from sheet.
 */
import { describe, expect, it } from "vitest"
import type { List, Task } from "@/lib/types"
import { builtinColumnId, buildSpreadsheetCatalog } from "@/lib/spreadsheet-catalog"
import { defaultDetailsColumnIds, resolveDetailsColumnIds } from "./details-columns"

const list = (partial: Partial<List> & Pick<List, "id" | "name">): List => ({
  color: "#3B82F6",
  description: "",
  createdAt: new Date("2026-01-01"),
  order: 0,
  ...partial,
})

const item = (partial: Partial<Task> & Pick<Task, "id" | "description">): Task => ({
  stage: "list",
  createdAt: new Date("2026-01-01"),
  completed: false,
  lists: ["books"],
  ...partial,
})

const books = list({
  id: "books",
  name: "Books",
  itemAttributes: [
    { id: "author", name: "Author", type: "string" },
    { id: "pages", name: "Pages", type: "number" },
  ],
  displayedAttributes: ["pages"],
})

const films = list({
  id: "films",
  name: "Films",
  itemAttributes: [{ id: "year", name: "Year", type: "number" }],
})

function catalogFor(target: List, listItems: Task[], vaultItems: Task[]) {
  return buildSpreadsheetCatalog({
    list: target,
    lists: [books, films],
    types: [],
    listItems,
    vaultItems,
  })
}

describe("defaultDetailsColumnIds", () => {
  it("uses displayedAttributes order, not every held spreadsheet builtin", () => {
    const listItems = [
      item({ id: "b1", description: "Dune", attributes: { author: "Herbert", pages: 884 }, importance: 4, tags: ["sf"] }),
    ]
    const catalog = catalogFor(books, listItems, listItems)
    const defaults = defaultDetailsColumnIds(catalog, books, [])
    expect(defaults).toEqual(["pages"])
    expect(defaults).not.toContain(builtinColumnId("importance"))
    expect(defaults).not.toContain(builtinColumnId("tags"))
  })

  it("falls back to schema order when displayedAttributes is unset", () => {
    const plain = list({
      id: "books",
      name: "Books",
      itemAttributes: [
        { id: "author", name: "Author", type: "string" },
        { id: "pages", name: "Pages", type: "number" },
      ],
    })
    const listItems = [item({ id: "b1", description: "Dune", attributes: { author: "H" } })]
    const catalog = catalogFor(plain, listItems, listItems)
    expect(defaultDetailsColumnIds(catalog, plain, [])).toEqual(["author", "pages"])
  })

  it("appends Next Actions builtins only when asked", () => {
    const plain = list({ id: "na", name: "Today" })
    const catalog = catalogFor(plain, [], [])
    expect(defaultDetailsColumnIds(catalog, plain, [])).toEqual([])
    expect(defaultDetailsColumnIds(catalog, plain, [], { nextActions: true })).toEqual([
      builtinColumnId("urgency"),
      builtinColumnId("importance"),
      builtinColumnId("scheduledDate"),
    ])
  })
})

describe("resolveDetailsColumnIds", () => {
  it("honors persisted order and treats [] as Name-only extras", () => {
    const listItems = [item({ id: "b1", description: "Dune", attributes: { author: "H", pages: 1 } })]
    const catalog = catalogFor(books, listItems, listItems)
    expect(resolveDetailsColumnIds(["author", "pages"], catalog, books, [])).toEqual(["author", "pages"])
    expect(resolveDetailsColumnIds([], catalog, books, [])).toEqual([])
    expect(resolveDetailsColumnIds(undefined, catalog, books, [])).toEqual(["pages"])
  })

  it("does not read spreadsheet columnIds", () => {
    const withSheet = list({
      ...books,
      sheetConfig: { columnIds: ["year", builtinColumnId("tags")] },
    })
    const listItems = [item({ id: "b1", description: "Dune", attributes: { author: "H" } })]
    const catalog = catalogFor(withSheet, listItems, listItems)
    expect(resolveDetailsColumnIds(undefined, catalog, withSheet, [])).toEqual(["pages"])
    expect(resolveDetailsColumnIds(["author"], catalog, withSheet, [])).toEqual(["author"])
  })
})
