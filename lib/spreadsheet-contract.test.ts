import { describe, it, expect } from "vitest"
import {
  NAME_COLUMN_ID,
  BLANK_CELLS_SORT,
  MIN_SHEET_COL_WIDTH,
  applyColumnWidth,
  buildSheetColumns,
  canWriteCell,
  cellSortValue,
  cellText,
  coerceCellInput,
  columnFromDef,
  columnWidthsByList,
  cycleColumnSort,
  filterRows,
  isBlankSortValue,
  isWritableColumn,
  nameColumn,
  persistSheetViewConfig,
  readCellValue,
  sortDirFor,
  sortRows,
  type SheetColumn,
} from "./spreadsheet-contract"
import type { AttributeDefinition, Task } from "@/lib/types"

const def = (overrides: Partial<AttributeDefinition>): AttributeDefinition => ({
  id: "a",
  name: "A",
  type: "number",
  ...overrides,
})

const task = (id: string, description: string, attributes: Record<string, unknown> = {}): Task => ({
  id,
  description,
  stage: "list",
  createdAt: new Date(),
  completed: false,
  lists: [],
  attributes: attributes as Task["attributes"],
})

describe("buildSheetColumns", () => {
  const defs = [
    def({ id: "price", name: "Price", type: "number", unit: "$" }),
    def({ id: "qty", name: "Qty", type: "number" }),
    def({ id: "total", name: "Total", type: "formula", formula: "=price*qty" }),
  ]

  it("prepends the name column and maps definitions in order", () => {
    const cols = buildSheetColumns(defs)
    expect(cols[0]).toMatchObject({ id: NAME_COLUMN_ID, isName: true, type: "name" })
    expect(cols.map((c) => c.id)).toEqual([NAME_COLUMN_ID, "price", "qty", "total"])
  })

  it("respects displayedAttributes order and skips unknown ids", () => {
    const cols = buildSheetColumns(defs, ["qty", "missing", "price"], { includeName: false })
    expect(cols.map((c) => c.id)).toEqual(["qty", "price"])
  })

  it("falls back to all defs when displayedAttributes is empty", () => {
    const cols = buildSheetColumns(defs, [], { includeName: false })
    expect(cols.map((c) => c.id)).toEqual(["price", "qty", "total"])
  })

  it("marks formula columns as read-only", () => {
    const cols = buildSheetColumns(defs, undefined, { includeName: false })
    const total = cols.find((c) => c.id === "total")!
    expect(total.isFormula).toBe(true)
    expect(total.readOnly).toBe(true)
    expect(isWritableColumn(total)).toBe(false)
    expect(canWriteCell(total)).toBe(false)
  })

  it("normalizes legacy types", () => {
    const col = columnFromDef(def({ id: "due", name: "Due", type: "date" as AttributeDefinition["type"] }))
    expect(col.type).toBe("datetime")
  })
})

describe("write guard", () => {
  it("allows non-formula columns including name", () => {
    expect(canWriteCell(nameColumn())).toBe(true)
    expect(canWriteCell(columnFromDef(def({ type: "number" })))).toBe(true)
    expect(canWriteCell(columnFromDef(def({ type: "formula", formula: "=1" })))).toBe(false)
  })
})

describe("readCellValue", () => {
  const defs = [def({ id: "price", type: "number" }), def({ id: "qty", type: "number" }), def({ id: "total", type: "formula", formula: "=price*qty" })]
  const cols = buildSheetColumns(defs, undefined, { includeName: false })
  const defsById = new Map(defs.map((d) => [d.id, d]))
  const row = task("t1", "Widget", { price: 4, qty: 3 })

  it("reads the description for the name column", () => {
    expect(readCellValue(row, nameColumn(), defsById)).toBe("Widget")
  })

  it("reads stored attribute values directly", () => {
    const price = cols.find((c) => c.id === "price")!
    expect(readCellValue(row, price, defsById)).toBe(4)
  })

  it("computes formula columns via the shared compute path", () => {
    const total = cols.find((c) => c.id === "total")!
    expect(readCellValue(row, total, defsById)).toBe(12)
  })
})

describe("sortRows", () => {
  const defs = [def({ id: "price", name: "Price", type: "number" })]
  const cols = buildSheetColumns(defs)
  const rows = [
    task("a", "Banana", { price: 30 }),
    task("b", "apple", { price: 10 }),
    task("c", "Cherry", {}),
    task("d", "date", { price: 20 }),
  ]

  it("returns the input untouched with no sort", () => {
    expect(sortRows(rows, [], cols).map((r) => r.id)).toEqual(["a", "b", "c", "d"])
  })

  it("sorts numeric columns ascending with empties last", () => {
    const sorted = sortRows(rows, [{ columnId: "price", dir: "asc" }], cols)
    expect(sorted.map((r) => r.id)).toEqual(["b", "d", "a", "c"])
  })

  it("sorts numeric columns descending with empties still last", () => {
    const sorted = sortRows(rows, [{ columnId: "price", dir: "desc" }], cols)
    expect(sorted.map((r) => r.id)).toEqual(["a", "d", "b", "c"])
  })

  it("keeps placeholder dashes and whitespace with the blanks at the end", () => {
    const dashRows = [
      task("v", "Valued", { price: 5 }),
      task("em", "Em dash", { price: "—" }),
      task("sp", "Spaces", { price: "  " }),
      task("hy", "Hyphen", { price: "-" }),
      task("z", "Zero", { price: 0 }),
      task("mid", "Nullish", {}),
    ]
    expect(BLANK_CELLS_SORT).toBe("end")
    const asc = sortRows(dashRows, [{ columnId: "price", dir: "asc" }], cols)
    expect(asc.map((r) => r.id)).toEqual(["z", "v", "em", "sp", "hy", "mid"])
    const desc = sortRows(dashRows, [{ columnId: "price", dir: "desc" }], cols)
    expect(desc.map((r) => r.id)).toEqual(["v", "z", "em", "sp", "hy", "mid"])
  })

  it("sorts text with blanks last, not in the middle", () => {
    const textDef = [def({ id: "note", name: "Note", type: "string" })]
    const textCols = buildSheetColumns(textDef)
    const textRows = [
      task("b", "B", { note: "banana" }),
      task("empty", "Empty", { note: "" }),
      task("a", "A", { note: "apple" }),
      task("dash", "Dash", { note: "—" }),
      task("c", "C", { note: "cherry" }),
    ]
    const sorted = sortRows(textRows, [{ columnId: "note", dir: "asc" }], textCols)
    expect(sorted.map((r) => r.id)).toEqual(["a", "b", "c", "empty", "dash"])
  })

  it("sorts enum / Priority labels as text with Unclassified kept and true blanks last", () => {
    const priDef = [def({ id: "tidyImportance", name: "Priority", type: "selection" })]
    const priCols = buildSheetColumns(priDef)
    const priRows = [
      task("p", "P", { tidyImportance: "Preferred" }),
      task("u", "U", { tidyImportance: "Unclassified" }),
      task("blank", "Blank", {}),
      task("c", "C", { tidyImportance: "Crucial" }),
      task("dash", "Dash", { tidyImportance: "—" }),
    ]
    const sorted = sortRows(priRows, [{ columnId: "tidyImportance", dir: "asc" }], priCols)
    expect(sorted.map((r) => r.id)).toEqual(["c", "p", "u", "blank", "dash"])
  })

  it("sorts dates chronologically with missing dates last", () => {
    const dateDef = [def({ id: "due", name: "Due", type: "datetime" })]
    const dateCols = buildSheetColumns(dateDef)
    const dateRows = [
      task("late", "Late", { due: "2026-09-21" }),
      task("none", "None", {}),
      task("early", "Early", { due: "2026-01-02" }),
      task("dash", "Dash", { due: "—" }),
    ]
    const sorted = sortRows(dateRows, [{ columnId: "due", dir: "asc" }], dateCols)
    expect(sorted.map((r) => r.id)).toEqual(["early", "late", "none", "dash"])
  })

  it("sorts builtin number fields (Est min) with empties last", () => {
    const estCol: SheetColumn = {
      id: "__field_estimatedDuration__",
      name: "Est",
      type: "number",
      isName: false,
      isFormula: false,
      readOnly: false,
      builtin: "estimatedDuration",
    }
    const estRows = [
      task("b", "B"),
      task("a", "A"),
      task("c", "C"),
    ]
    estRows[0].estimatedDuration = 20
    estRows[2].estimatedDuration = 10
    const sorted = sortRows(estRows, [{ columnId: estCol.id, dir: "asc" }], [nameColumn(), estCol])
    expect(sorted.map((r) => r.id)).toEqual(["c", "b", "a"])
  })

  it("sorts the name column case-insensitively", () => {
    const sorted = sortRows(rows, [{ columnId: NAME_COLUMN_ID, dir: "asc" }], cols)
    expect(sorted.map((r) => r.id)).toEqual(["b", "a", "c", "d"])
  })

  it("supports multi-column sort", () => {
    const tieDefs = [def({ id: "grp", name: "Group", type: "string" }), def({ id: "n", name: "N", type: "number" })]
    const tieCols = buildSheetColumns(tieDefs)
    const tieRows = [
      task("r1", "x", { grp: "b", n: 2 }),
      task("r2", "y", { grp: "a", n: 5 }),
      task("r3", "z", { grp: "a", n: 1 }),
    ]
    const sorted = sortRows(tieRows, [{ columnId: "grp", dir: "asc" }, { columnId: "n", dir: "asc" }], tieCols)
    expect(sorted.map((r) => r.id)).toEqual(["r3", "r2", "r1"])
  })
})

describe("filterRows / cellText", () => {
  const defs = [
    def({ id: "room", name: "Room", type: "string" }),
    def({ id: "booked", name: "Booked", type: "boolean" }),
    def({ id: "total", name: "Total", type: "formula", formula: "=price", formatAs: "currency", unit: "$" }),
  ]
  const cols = buildSheetColumns(defs)
  const defsById = new Map(defs.map((d) => [d.id, d]))
  const rows = [
    task("a", "Sofa", { room: "Living", booked: true, price: 100 }),
    task("b", "Bed", { room: "Bedroom", booked: false, price: 200 }),
  ]

  it("returns all rows for empty filter", () => {
    expect(filterRows(rows, "  ", cols, defsById)).toHaveLength(2)
  })

  it("matches across name and attribute columns case-insensitively", () => {
    expect(filterRows(rows, "sofa", cols, defsById).map((r) => r.id)).toEqual(["a"])
    expect(filterRows(rows, "bedroom", cols, defsById).map((r) => r.id)).toEqual(["b"])
  })

  it("renders booleans and computed formula cells as text", () => {
    const booked = cols.find((c) => c.id === "booked")!
    const total = cols.find((c) => c.id === "total")!
    expect(cellText(rows[0], booked, defsById)).toBe("Yes")
    expect(cellText(rows[0], total, defsById)).toBe("$100.00")
  })

  it("can match against a formatted formula value", () => {
    expect(filterRows(rows, "$200", cols, defsById).map((r) => r.id)).toEqual(["b"])
  })
})

describe("cellSortValue", () => {
  it("treats blanks as null and booleans as 0/1", () => {
    const boolCol = columnFromDef(def({ id: "b", type: "boolean" }))
    expect(cellSortValue(task("x", "X", { b: true }), boolCol)).toBe(1)
    expect(cellSortValue(task("y", "Y", {}), boolCol)).toBeNull()
  })

  it("treats em dash placeholders as blank", () => {
    const note = columnFromDef(def({ id: "note", type: "string" }))
    expect(isBlankSortValue("—")).toBe(true)
    expect(isBlankSortValue("  ")).toBe(true)
    expect(isBlankSortValue(0)).toBe(false)
    expect(isBlankSortValue(false)).toBe(false)
    expect(cellSortValue(task("z", "Z", { note: "—" }), note)).toBeNull()
  })
})

describe("persistSheetViewConfig / column widths", () => {
  it("records listId → columnId → width and keeps untouched columns on defaults", () => {
    expect(MIN_SHEET_COL_WIDTH).toBe(60)
    const living = persistSheetViewConfig(
      { columnIds: ["tidyImportance", "estMin"] },
      applyColumnWidth({}, "estMin", 240),
    )
    const books = persistSheetViewConfig(undefined, applyColumnWidth({}, NAME_COLUMN_ID, 320))
    const byList = columnWidthsByList([
      { id: "living-room", sheetConfig: living },
      { id: "books", sheetConfig: books },
      { id: "empty", sheetConfig: {} },
    ])
    expect(byList).toEqual({
      "living-room": { estMin: 240 },
      books: { [NAME_COLUMN_ID]: 320 },
    })
    expect(living.columnIds).toEqual(["tidyImportance", "estMin"])
  })

  it("merges a resize onto stored widths without dropping sibling columnIds", () => {
    const stored = { columnIds: ["year"], columnWidths: { year: 100 } }
    const next = applyColumnWidth({}, "pages", 180)
    const merged = persistSheetViewConfig(stored, next)
    expect(merged.columnIds).toEqual(["year"])
    expect(merged.columnWidths).toEqual({ year: 100, pages: 180 })
  })

  it("floors drag widths at MIN_SHEET_COL_WIDTH", () => {
    expect(applyColumnWidth({}, "estMin", 12).columnWidths?.estMin).toBe(MIN_SHEET_COL_WIDTH)
  })
})

describe("cycleColumnSort", () => {
  it("cycles none -> asc -> desc -> none for plain clicks", () => {
    let sort = cycleColumnSort(undefined, "price")
    expect(sort).toEqual([{ columnId: "price", dir: "asc" }])
    sort = cycleColumnSort(sort, "price")
    expect(sort).toEqual([{ columnId: "price", dir: "desc" }])
    sort = cycleColumnSort(sort, "price")
    expect(sort).toEqual([])
  })

  it("replaces other columns on plain click", () => {
    const sort = cycleColumnSort([{ columnId: "qty", dir: "asc" }], "price")
    expect(sort).toEqual([{ columnId: "price", dir: "asc" }])
  })

  it("preserves other columns when additive", () => {
    let sort = cycleColumnSort([{ columnId: "qty", dir: "asc" }], "price", true)
    expect(sort).toEqual([{ columnId: "qty", dir: "asc" }, { columnId: "price", dir: "asc" }])
    sort = cycleColumnSort(sort, "price", true)
    expect(sort).toEqual([{ columnId: "qty", dir: "asc" }, { columnId: "price", dir: "desc" }])
    sort = cycleColumnSort(sort, "price", true)
    expect(sort).toEqual([{ columnId: "qty", dir: "asc" }])
  })

  it("reports the current direction", () => {
    const sort = [{ columnId: "price", dir: "desc" as const }]
    expect(sortDirFor(sort, "price")).toBe("desc")
    expect(sortDirFor(sort, "qty")).toBeUndefined()
  })
})

describe("coerceCellInput", () => {
  it("parses numbers and rejects non-numeric text", () => {
    const num = def({ type: "number" })
    expect(coerceCellInput(num, "42")).toBe(42)
    expect(coerceCellInput(num, "3.5")).toBe(3.5)
    expect(coerceCellInput(num, "abc")).toBeUndefined()
  })

  it("rounds to an integer when floats are disallowed", () => {
    const intDef = def({ type: "number", allowFloat: false })
    expect(coerceCellInput(intDef, "3.9")).toBe(3)
  })

  it("coerces truthy strings for booleans", () => {
    const bool = def({ type: "boolean" })
    expect(coerceCellInput(bool, "yes")).toBe(true)
    expect(coerceCellInput(bool, "TRUE")).toBe(true)
    expect(coerceCellInput(bool, "1")).toBe(true)
    expect(coerceCellInput(bool, "no")).toBe(false)
  })

  it("keeps a leading = verbatim as a per-cell formula regardless of type", () => {
    expect(coerceCellInput(def({ type: "number" }), "  =B1+5 ")).toBe("=B1+5")
    expect(coerceCellInput(def({ type: "string" }), "=A1")).toBe("=A1")
  })

  it("treats empty/whitespace input as a cleared cell", () => {
    expect(coerceCellInput(def({ type: "string" }), "   ")).toBeUndefined()
    expect(coerceCellInput(def({ type: "number" }), "")).toBeUndefined()
  })

  it("passes string values through untrimmed", () => {
    expect(coerceCellInput(def({ type: "string" }), "  hi there ")).toBe("  hi there ")
  })

  it("parses ISO dates into YYYY-MM-DD", () => {
    const date = def({ type: "datetime", datetimeMode: "date" })
    expect(coerceCellInput(date, "2026-09-21")).toBe("2026-09-21")
  })
})

describe("type smoke", () => {
  it("name column is a SheetColumn", () => {
    const col: SheetColumn = nameColumn("Item")
    expect(col.name).toBe("Item")
  })
})
