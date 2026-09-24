/**
 * spreadsheet-catalog — attribute → column map, on-this-list ordering,
 * per-list column ids, assign-to-all (schema membership).
 */
import { describe, expect, it } from "vitest"
import type { AttributeDefinition, List, Task } from "@/lib/types"
import {
  assignAttributeToList,
  attributeSettingsForColumn,
  buildSpreadsheetCatalog,
  builtinColumnId,
  BUILTIN_COLUMN_SETTINGS_REASON,
  columnsFromIds,
  defaultColumnIds,
  filterCatalog,
  hideColumnId,
  insertColumnId,
  NAME_COLUMN_SETTINGS_REASON,
  parseBuiltinColumnId,
  patchAttributeOnList,
  readBuiltinField,
  resolveColumnIds,
  writeBuiltinField,
} from "./spreadsheet-catalog"
import { columnFromDef, nameColumn } from "./spreadsheet-contract"

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
})

const vault = list({
  id: "films",
  name: "Films",
  itemAttributes: [{ id: "year", name: "Year", type: "number" }],
})

describe("builtin column ids", () => {
  it("round-trips field keys", () => {
    expect(parseBuiltinColumnId(builtinColumnId("importance"))).toBe("importance")
    expect(parseBuiltinColumnId("author")).toBeUndefined()
  })
})

describe("buildSpreadsheetCatalog", () => {
  const listItems = [
    item({
      id: "b1",
      description: "Dune",
      attributes: { author: "Herbert", rating: 5 },
      itemAttributeDefinitions: [{ id: "rating", name: "Rating", type: "number" }],
      importance: 4,
      tags: ["sf"],
    }),
    item({ id: "b2", description: "Emma", attributes: { author: "Austen", pages: 400 } }),
  ]

  it("puts attributes found on this list first and still offers vault attrs", () => {
    const catalog = buildSpreadsheetCatalog({
      list: books,
      lists: [books, vault],
      types: [],
      listItems,
      vaultItems: [
        ...listItems,
        item({
          id: "f1",
          description: "Heat",
          lists: ["films"],
          attributes: { year: 1995 },
        }),
      ],
    })
    const ids = catalog.map((c) => c.id)
    const author = catalog.find((c) => c.id === "author")!
    const rating = catalog.find((c) => c.id === "rating")!
    const year = catalog.find((c) => c.id === "year")!
    const pages = catalog.find((c) => c.id === "pages")!

    expect(author.onThisList).toBe(true)
    expect(rating.onThisList).toBe(true)
    expect(pages.onThisList).toBe(true)
    expect(year.onThisList).toBe(false)

    expect(ids.indexOf("author")).toBeLessThan(ids.indexOf("year"))
    expect(ids.indexOf("rating")).toBeLessThan(ids.indexOf("year"))
  })

  it("maps built-in fields to column types", () => {
    const catalog = buildSpreadsheetCatalog({
      list: books,
      lists: [books],
      types: [],
      listItems,
      vaultItems: listItems,
    })
    const importance = catalog.find((c) => c.builtin === "importance")!
    const tags = catalog.find((c) => c.builtin === "tags")!
    const completed = catalog.find((c) => c.builtin === "completed")!
    expect(importance.type).toBe("number")
    expect(importance.onThisList).toBe(true)
    expect(tags.type).toBe("multistring")
    expect(completed.type).toBe("boolean")
  })

  it("defaults visible columns to list schema only — held attrs and builtins stay opt-in", () => {
    const catalog = buildSpreadsheetCatalog({
      list: books,
      lists: [books, vault],
      types: [],
      listItems,
      vaultItems: [
        ...listItems,
        item({ id: "f1", description: "Heat", lists: ["films"], attributes: { year: 1995 } }),
      ],
    })
    const defaults = defaultColumnIds(catalog, books, [])
    expect(defaults).toEqual(["author", "pages"])
    expect(defaults).not.toContain("rating")
    expect(defaults).not.toContain("year")
    expect(defaults).not.toContain(builtinColumnId("importance"))
    expect(defaults).not.toContain(builtinColumnId("tags"))
  })

  it("defaults to no extras when the list has an empty schema (All Items calm path)", () => {
    const allItems = list({ id: "__all-items__root", name: "All Items" })
    const many = [
      item({
        id: "1",
        description: "A",
        lists: ["books"],
        attributes: { author: "H", rating: 5 },
        importance: 4,
        tags: ["sf"],
      }),
      item({
        id: "2",
        description: "B",
        lists: ["films"],
        attributes: { year: 1995 },
        urgency: 3,
      }),
    ]
    const catalog = buildSpreadsheetCatalog({
      list: allItems,
      lists: [allItems, books, vault],
      types: [],
      listItems: many,
      vaultItems: many,
    })
    expect(defaultColumnIds(catalog, allItems, [])).toEqual([])
    expect(resolveColumnIds(undefined, catalog, allItems, [])).toEqual([])
  })
})

describe("filterCatalog", () => {
  const catalog = buildSpreadsheetCatalog({
    list: books,
    lists: [books, vault],
    types: [],
    listItems: [item({ id: "b1", description: "Dune", attributes: { author: "Herbert" } })],
    vaultItems: [
      item({ id: "b1", description: "Dune", attributes: { author: "Herbert" } }),
      item({ id: "f1", description: "Heat", lists: ["films"], attributes: { year: 1995 } }),
    ],
  })

  it("filters to on-this-list and by search", () => {
    const onList = filterCatalog(catalog, { onThisListOnly: true })
    expect(onList.every((c) => c.onThisList)).toBe(true)
    expect(onList.some((c) => c.id === "author")).toBe(true)
    expect(onList.some((c) => c.id === "year")).toBe(false)

    const searched = filterCatalog(catalog, { query: "yea" })
    expect(searched.map((c) => c.id)).toContain("year")
    expect(searched.every((c) => /yea/i.test(c.name) || /yea/i.test(c.id))).toBe(true)
  })
})

describe("per-list column persistence helpers", () => {
  it("resolveColumnIds uses persisted ids when set", () => {
    const catalog = buildSpreadsheetCatalog({
      list: books,
      lists: [books],
      types: [],
      listItems: [item({ id: "b1", description: "Dune", attributes: { author: "H" } })],
      vaultItems: [item({ id: "b1", description: "Dune", attributes: { author: "H" } })],
    })
    const ids = resolveColumnIds({ columnIds: ["pages", "author"] }, catalog, books, [])
    expect(ids).toEqual(["pages", "author"])
  })

  it("hideColumnId removes from the view without touching the attribute def", () => {
    const def: AttributeDefinition = { id: "author", name: "Author", type: "string" }
    const afterHide = hideColumnId(["author", "pages"], "author")
    expect(afterHide).toEqual(["pages"])
    const stillOnList = assignAttributeToList(books, def)
    expect(stillOnList.itemAttributes?.some((d) => d.id === "author")).toBe(true)
  })

  it("insertColumnId appends or inserts at an index", () => {
    expect(insertColumnId(["author"], "pages")).toEqual(["author", "pages"])
    expect(insertColumnId(["author", "pages"], "rating", 0)).toEqual(["rating", "author", "pages"])
  })
})

describe("assignAttributeToList", () => {
  it("adds the def to itemAttributes so every row can hold a value", () => {
    const def: AttributeDefinition = { id: "mood", name: "Mood", type: "string" }
    const next = assignAttributeToList(books, def)
    expect(next.itemAttributes?.some((d) => d.id === "mood")).toBe(true)
    expect(books.itemAttributes?.some((d) => d.id === "mood")).toBe(false)
  })

  it("does not duplicate an existing id", () => {
    const next = assignAttributeToList(books, { id: "author", name: "Author", type: "string" })
    expect(next.itemAttributes?.filter((d) => d.id === "author")).toHaveLength(1)
  })

  it("patchAttributeOnList updates a def in place and keeps siblings", () => {
    const next = patchAttributeOnList(books, { id: "author", name: "Writer", type: "string" })
    expect(next.itemAttributes?.find((d) => d.id === "author")?.name).toBe("Writer")
    expect(next.itemAttributes?.some((d) => d.id === "pages")).toBe(true)
  })
})

describe("attributeSettingsForColumn", () => {
  it("opens real settings when the column has an attribute id", () => {
    const actual = columnFromDef({ id: "actualSec", name: "Actual", type: "number", unit: "s" })
    expect(attributeSettingsForColumn(actual)).toEqual({
      kind: "attribute",
      id: "actualSec",
      def: actual.def,
    })
  })

  it("disables the name column with a documented reason", () => {
    expect(attributeSettingsForColumn(nameColumn("Item"))).toEqual({
      kind: "unavailable",
      reason: NAME_COLUMN_SETTINGS_REASON,
    })
  })

  it("disables built-in item fields", () => {
    const col = {
      ...columnFromDef({
        id: builtinColumnId("importance"),
        name: "Importance",
        type: "number" as const,
      }),
      builtin: "importance",
    }
    expect(attributeSettingsForColumn(col)).toEqual({
      kind: "unavailable",
      reason: BUILTIN_COLUMN_SETTINGS_REASON,
    })
  })
})

describe("columnsFromIds", () => {
  it("maps selected ids to sheet columns with types", () => {
    const catalog = buildSpreadsheetCatalog({
      list: books,
      lists: [books],
      types: [],
      listItems: [item({ id: "b1", description: "Dune", attributes: { pages: 100 }, importance: 3 })],
      vaultItems: [item({ id: "b1", description: "Dune", attributes: { pages: 100 }, importance: 3 })],
    })
    const cols = columnsFromIds(catalog, ["pages", builtinColumnId("importance")])
    expect(cols.map((c) => c.id)).toEqual(["pages", builtinColumnId("importance")])
    expect(cols[0].type).toBe("number")
    expect(cols[1].builtin).toBe("importance")
  })
})

describe("builtin read/write", () => {
  const dune = item({ id: "b1", description: "Dune", importance: 3, tags: ["sf"] })

  it("reads tags and importance", () => {
    expect(readBuiltinField(dune, "importance")).toBe(3)
    expect(readBuiltinField(dune, "tags")).toEqual(["sf"])
  })

  it("writes importance and tags without dropping other fields", () => {
    const next = writeBuiltinField(writeBuiltinField(dune, "importance", 5), "tags", "sf, desert")
    expect(next.importance).toBe(5)
    expect(next.tags).toEqual(["sf", "desert"])
    expect(next.description).toBe("Dune")
  })

  it("does not write Created", () => {
    const created = dune.createdAt
    const next = writeBuiltinField(dune, "createdAt", "1999-01-01")
    expect(next.createdAt).toBe(created)
  })
})
