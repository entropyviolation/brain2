import { describe, it, expect } from "vitest"
import {
  NAME_COLUMN_ID,
  buildSheetColumns,
  canWriteCell,
  cellSortValue,
  cellText,
  coerceCellInput,
  columnFromDef,
  cycleColumnSort,
  filterRows,
  isWritableColumn,
  nameColumn,
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
})

describe("type smoke", () => {
  it("name column is a SheetColumn", () => {
    const col: SheetColumn = nameColumn("Item")
    expect(col.name).toBe("Item")
  })
})
