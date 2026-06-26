/**
 * lib/spreadsheet-contract.ts — Shared read/write contract for the spreadsheet grid
 *
 * A single, framework-free contract so every consumer of the Google-Sheets-style
 * grid (Lists "Spreadsheet" display, Module "spreadsheet" views) builds columns,
 * reads cells, sorts, filters, and guards writes *identically*. This keeps the
 * grid's UI dumb and the semantics testable.
 *
 * Hard rules:
 *   - **No React** and **no store imports** here. Pure types + functions only.
 *   - Reuses the existing formula compute path (`lib/formula`) for computed
 *     columns so formulas behave the same everywhere.
 *
 * `SheetViewConfig` is the persisted, serializable view state (sort / filter /
 * frozen columns / widths). Module views can store it on their view config
 * later — the type is exported here as the single source of truth.
 */
import type { AttributeDefinition, AttributeType, AttributeValue, GoalValue, Task } from "@/lib/types"
import { normalizeAttributeType } from "@/lib/attribute-utils"
import { computeFormulaValue, formatFormulaValue, isFormulaDef, type DefLookup } from "@/lib/formula"

/** Synthetic column id for the built-in name/title column. */
export const NAME_COLUMN_ID = "__name__"

/** Sort direction for a single column. */
export type SheetSortDir = "asc" | "desc"

export interface SheetSort {
  columnId: string
  dir: SheetSortDir
}

/**
 * Serializable view state for a sheet. Safe to persist on a module view config
 * or a list's UI prefs. All fields optional so an empty `{}` is a valid default.
 */
export interface SheetViewConfig {
  /** Ordered multi-sort; first entry is primary. */
  sort?: SheetSort[]
  /** Free-text filter applied across all columns (case-insensitive). */
  filterText?: string
  /** Number of leading columns to freeze (the name column counts as 1). */
  frozenColCount?: number
  /** Per-column pixel widths, keyed by column id (`NAME_COLUMN_ID` for name). */
  columnWidths?: Record<string, number>
  /** Per-row pixel heights, keyed by row id (the item/task id). */
  rowHeights?: Record<string, number>
}

/**
 * A single grid column. Derived from an `AttributeDefinition` (attribute
 * columns) or synthesized for the built-in name/title column (`isName`).
 */
export interface SheetColumn {
  id: string
  name: string
  /** Canonical attribute type, or `"name"` for the built-in name column. */
  type: AttributeType | "name"
  /** Underlying definition for attribute columns; undefined for the name column. */
  def?: AttributeDefinition
  unit?: string
  isName: boolean
  isFormula: boolean
  /** True when this column must not be written to (formula columns). */
  readOnly: boolean
}

/** The built-in name/title column descriptor. */
export function nameColumn(label = "Name"): SheetColumn {
  return {
    id: NAME_COLUMN_ID,
    name: label,
    type: "name",
    isName: true,
    isFormula: false,
    readOnly: false,
  }
}

/** Build a column descriptor from an attribute definition. */
export function columnFromDef(def: AttributeDefinition): SheetColumn {
  const type = normalizeAttributeType(def.type)
  const formula = isFormulaDef(def)
  return {
    id: def.id,
    name: def.name,
    type,
    def,
    unit: def.unit,
    isName: false,
    isFormula: formula,
    readOnly: formula,
  }
}

interface BuildColumnsOptions {
  /** Prepend the built-in name column (default true). */
  includeName?: boolean
  /** Label for the name column when included. */
  nameLabel?: string
}

/**
 * Build the ordered column list from a schema. Attribute order follows
 * `displayedAttributes` when provided & non-empty (spec §5 displayed columns),
 * otherwise all definitions in declaration order. Unknown ids in
 * `displayedAttributes` are skipped. The name column is prepended by default.
 */
export function buildSheetColumns(
  defs: AttributeDefinition[],
  displayedAttributes?: string[],
  options?: BuildColumnsOptions,
): SheetColumn[] {
  const { includeName = true, nameLabel = "Name" } = options ?? {}
  const byId = new Map(defs.map((d) => [d.id, d]))
  const ordered =
    displayedAttributes && displayedAttributes.length > 0
      ? displayedAttributes.map((id) => byId.get(id)).filter((d): d is AttributeDefinition => !!d)
      : defs
  const cols = ordered.map(columnFromDef)
  return includeName ? [nameColumn(nameLabel), ...cols] : cols
}

/** True when a column accepts writes (everything except formula columns). */
export function isWritableColumn(column: SheetColumn): boolean {
  return !column.readOnly
}

/**
 * Guard a pending write. Returns `true` when the write is allowed; `false` when
 * the column is read-only (formula). Callers should no-op on `false`.
 */
export function canWriteCell(column: SheetColumn): boolean {
  return isWritableColumn(column)
}

/**
 * Read a cell's logical value for a row. Formula columns are computed via the
 * shared formula path; the name column returns the row's description; all other
 * columns read straight from `attributes[id]`.
 */
export function readCellValue(task: Task, column: SheetColumn, defsById?: DefLookup): AttributeValue {
  if (column.isName) return task.description
  if (column.isFormula && column.def) {
    return computeFormulaValue(column.def, task.attributes ?? {}, defsById ?? new Map()).value
  }
  return task.attributes?.[column.id]
}

/**
 * Comparable scalar for sorting. Numbers for numeric/formula/boolean/goal
 * columns; lowercased strings otherwise. `null` means "empty" (sorted last).
 */
export function cellSortValue(task: Task, column: SheetColumn, defsById?: DefLookup): number | string | null {
  if (column.isFormula && column.def) {
    return computeFormulaValue(column.def, task.attributes ?? {}, defsById ?? new Map()).value
  }
  const value = column.isName ? task.description : task.attributes?.[column.id]
  if (value === undefined || value === null || value === "") return null
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "boolean") return value ? 1 : 0
  if (Array.isArray(value)) return value.length ? value.map(arrayItemText).join(", ").toLowerCase() : null
  if (typeof value === "object") {
    const g = value as GoalValue
    return typeof g.current === "number" ? g.current : null
  }
  return String(value).toLowerCase()
}

/** Plain-text rendering of a cell for the free-text filter (store-free). */
export function cellText(task: Task, column: SheetColumn, defsById?: DefLookup): string {
  if (column.isName) return task.description ?? ""
  if (column.isFormula && column.def) {
    return formatFormulaValue(computeFormulaValue(column.def, task.attributes ?? {}, defsById ?? new Map()), column.def)
  }
  const value = task.attributes?.[column.id]
  if (value === undefined || value === null) return ""
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (Array.isArray(value)) return value.map(arrayItemText).join(", ")
  if (typeof value === "object") {
    const g = value as GoalValue
    return `${g.current}/${g.target}`
  }
  return String(value)
}

function arrayItemText(item: unknown): string {
  if (item && typeof item === "object" && "name" in (item as Record<string, unknown>)) {
    return String((item as { name?: unknown }).name ?? "")
  }
  return String(item)
}

function compareScalar(a: number | string | null, b: number | string | null): number {
  // Empty cells always sort to the end, regardless of direction.
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a).localeCompare(String(b))
}

/**
 * Stable multi-column sort. Returns a new array; empty cells sink to the bottom
 * for every direction. With no sort entries the input order is preserved.
 */
export function sortRows(
  tasks: Task[],
  sort: SheetSort[] | undefined,
  columns: SheetColumn[],
  defsById?: DefLookup,
): Task[] {
  if (!sort || sort.length === 0) return tasks
  const colById = new Map(columns.map((c) => [c.id, c]))
  const decorated = tasks.map((task, index) => ({ task, index }))
  decorated.sort((x, y) => {
    for (const { columnId, dir } of sort) {
      const col = colById.get(columnId)
      if (!col) continue
      const av = cellSortValue(x.task, col, defsById)
      const bv = cellSortValue(y.task, col, defsById)
      // Keep empties last irrespective of direction.
      if (av === null || bv === null) {
        const emptyCmp = compareScalar(av, bv)
        if (emptyCmp !== 0) return emptyCmp
        continue
      }
      const cmp = compareScalar(av, bv)
      if (cmp !== 0) return dir === "desc" ? -cmp : cmp
    }
    return x.index - y.index
  })
  return decorated.map((d) => d.task)
}

/** True when any visible column's text contains the (trimmed) query. */
export function rowMatchesFilter(
  task: Task,
  columns: SheetColumn[],
  filterText: string,
  defsById?: DefLookup,
): boolean {
  const q = filterText.trim().toLowerCase()
  if (!q) return true
  return columns.some((col) => cellText(task, col, defsById).toLowerCase().includes(q))
}

/** Filter rows by a free-text query across all provided columns. */
export function filterRows(
  tasks: Task[],
  filterText: string | undefined,
  columns: SheetColumn[],
  defsById?: DefLookup,
): Task[] {
  if (!filterText || !filterText.trim()) return tasks
  return tasks.filter((t) => rowMatchesFilter(t, columns, filterText, defsById))
}

/**
 * Cycle a column's sort state on header interaction. Non-additive (plain click)
 * replaces any existing sort: none → asc → desc → none. Additive (shift-click)
 * toggles just this column within the existing multi-sort list.
 */
export function cycleColumnSort(
  current: SheetSort[] | undefined,
  columnId: string,
  additive = false,
): SheetSort[] {
  const list = current ?? []
  const existing = list.find((s) => s.columnId === columnId)

  if (!additive) {
    if (!existing) return [{ columnId, dir: "asc" }]
    if (existing.dir === "asc") return [{ columnId, dir: "desc" }]
    return []
  }

  // Additive: keep the other columns, cycle only this one.
  const others = list.filter((s) => s.columnId !== columnId)
  if (!existing) return [...others, { columnId, dir: "asc" }]
  if (existing.dir === "asc") return [...others, { columnId, dir: "desc" }]
  return others
}

/** Current sort direction for a column, or `undefined` when unsorted. */
export function sortDirFor(sort: SheetSort[] | undefined, columnId: string): SheetSortDir | undefined {
  return sort?.find((s) => s.columnId === columnId)?.dir
}

/**
 * Coerce a raw string (from the formula bar, an inline editor, or a pasted cell)
 * into the stored value for an attribute. A leading "=" marks a Google-Sheets-
 * style per-cell formula and is stored verbatim (trimmed) regardless of the
 * column type. Empty input clears the cell (`undefined`).
 */
export function coerceCellInput(def: AttributeDefinition, raw: string): AttributeValue {
  if (raw.trimStart().startsWith("=")) return raw.trim()
  const trimmed = raw.trim()
  if (trimmed === "") return undefined
  const type = normalizeAttributeType(def.type)
  if (type === "number") {
    const allowFloat = def.allowFloat !== false
    const n = allowFloat ? Number(trimmed) : parseInt(trimmed, 10)
    return Number.isFinite(n) ? n : undefined
  }
  if (type === "boolean") {
    const s = trimmed.toLowerCase()
    return s === "true" || s === "yes" || s === "1"
  }
  return raw
}
