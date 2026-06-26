/**
 * lib/spreadsheet-utils.ts — Pure helpers for the spreadsheet grid + rollups
 *
 * Side-effect-free math/formatting used by the Google-Sheets-style grid
 * (`components/spreadsheet/SheetGrid.tsx`) and by Module "summary" views: numeric
 * column detection, column aggregation (sum/avg/min/max/filled/count),
 * currency-aware value formatting, and grouping/rollups over an attribute.
 *
 * Kept pure so it is unit-testable and reusable on a server (spec §5 unified
 * Item model — attributes are the column values being aggregated).
 */
import type { AttributeDefinition, AttributeValue, GoalValue, Task } from "@/lib/types"
import { normalizeAttributeType } from "@/lib/attribute-utils"
import { computeFormulaValue, isFormulaDef, type DefLookup } from "@/lib/formula"

/** Numeric column types we can total/average in a footer or summary. */
export function isNumericAttribute(def: AttributeDefinition): boolean {
  const type = normalizeAttributeType(def.type)
  return type === "number" || type === "goal" || type === "formula"
}

/** A currency column is a number whose unit reads like a currency symbol. */
export function isCurrencyAttribute(def: AttributeDefinition): boolean {
  const type = normalizeAttributeType(def.type)
  if (type === "formula") return def.formatAs === "currency"
  if (type !== "number") return false
  const unit = (def.unit || "").trim()
  return unit.length > 0 && /[$€£¥₹]/.test(unit)
}

/**
 * Resolve one cell to a number, computing formula attributes when a definition
 * lookup is supplied. Non-formula cells fall back to `toNumber` of the stored
 * value. Returns `null` for blank/non-numeric cells.
 */
export function numericCellValue(task: Task, def: AttributeDefinition, defsById?: DefLookup): number | null {
  if (isFormulaDef(def)) {
    if (!defsById) return null
    return computeFormulaValue(def, task.attributes ?? {}, defsById).value
  }
  return toNumber(task.attributes?.[def.id])
}

/** Coerce any stored attribute value to a finite number (or null). */
export function toNumber(value: AttributeValue): number | null {
  if (value === undefined || value === null || value === "") return null
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "object" && !Array.isArray(value)) {
    const g = value as GoalValue
    return typeof g.current === "number" ? g.current : null
  }
  const n = Number(String(value).replace(/[$,€£¥₹\s]/g, ""))
  return Number.isFinite(n) ? n : null
}

export interface ColumnAggregate {
  /** Count of non-empty cells in this column. */
  filled: number
  /** Count of numeric cells. */
  numeric: number
  sum: number
  avg: number
  min: number | null
  max: number | null
}

/**
 * Aggregate one attribute column over a set of items. Pass `defsById` to make
 * the rollup formula-aware (computed cells are evaluated per row).
 */
export function aggregateColumn(tasks: Task[], def: AttributeDefinition, defsById?: DefLookup): ColumnAggregate {
  let filled = 0
  let numeric = 0
  let sum = 0
  let min: number | null = null
  let max: number | null = null

  for (const t of tasks) {
    let n: number | null
    if (isFormulaDef(def)) {
      n = numericCellValue(t, def, defsById)
      if (n === null) continue
      filled += 1
    } else {
      const raw = t.attributes?.[def.id]
      if (raw === undefined || raw === null || raw === "") continue
      filled += 1
      n = toNumber(raw)
      if (n === null) continue
    }
    numeric += 1
    sum += n
    min = min === null ? n : Math.min(min, n)
    max = max === null ? n : Math.max(max, n)
  }

  return { filled, numeric, sum, avg: numeric ? sum / numeric : 0, min, max }
}

/** Sum a numeric attribute across items (0 when none). */
export function sumBy(tasks: Task[], def: AttributeDefinition, defsById?: DefLookup): number {
  return aggregateColumn(tasks, def, defsById).sum
}

/**
 * Whether a row's "include in calculation" flag is truthy. A blank/missing flag
 * is treated as excluded. When `includeColumnId` is undefined every row counts
 * (no inclusion gate). Accepts booleans, "true"/"yes"/"1" strings, and non-zero
 * numbers so it works regardless of how the include column stores its value.
 */
export function isIncluded(task: Task, includeColumnId?: string): boolean {
  if (!includeColumnId) return true
  const raw = task.attributes?.[includeColumnId]
  if (raw === undefined || raw === null || raw === "") return false
  if (typeof raw === "boolean") return raw
  if (typeof raw === "number") return raw !== 0
  if (Array.isArray(raw)) return raw.length > 0
  const s = String(raw).trim().toLowerCase()
  return s === "true" || s === "yes" || s === "1"
}

/**
 * Aggregate a numeric column over only the rows that satisfy `predicate`.
 * Formula-aware when `defsById` is supplied. The building block behind the
 * Budget module's "optional inclusion in calculation".
 */
export function aggregateWhere(
  tasks: Task[],
  def: AttributeDefinition,
  predicate: (task: Task) => boolean,
  defsById?: DefLookup,
): ColumnAggregate {
  return aggregateColumn(tasks.filter(predicate), def, defsById)
}

/**
 * Aggregate a numeric column, counting only rows whose `includeColumnId` flag is
 * truthy. With no `includeColumnId`, behaves exactly like `aggregateColumn`.
 */
export function aggregateIncluded(
  tasks: Task[],
  def: AttributeDefinition,
  includeColumnId?: string,
  defsById?: DefLookup,
): ColumnAggregate {
  return aggregateWhere(tasks, def, (t) => isIncluded(t, includeColumnId), defsById)
}

/** Sum a numeric column over only the rows flagged for inclusion (0 when none). */
export function sumIncluded(
  tasks: Task[],
  def: AttributeDefinition,
  includeColumnId?: string,
  defsById?: DefLookup,
): number {
  return aggregateIncluded(tasks, def, includeColumnId, defsById).sum
}

/** Format a number for display, honoring the attribute's unit (currency-aware). */
export function formatNumber(value: number, def?: AttributeDefinition): string {
  const unit = (def?.unit || "").trim()
  const allowFloat = def?.allowFloat !== false
  const rounded = allowFloat ? Math.round(value * 100) / 100 : Math.round(value)
  if (def && isCurrencyAttribute(def)) {
    const body = rounded.toLocaleString(undefined, {
      minimumFractionDigits: allowFloat ? 2 : 0,
      maximumFractionDigits: 2,
    })
    return `${unit}${body}`
  }
  const body = rounded.toLocaleString()
  return unit ? `${body} ${unit}` : body
}

/** Stable string key for grouping an item by one attribute's value. */
export function groupKeyFor(value: AttributeValue): string {
  if (value === undefined || value === null || value === "") return "—"
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—"
  if (typeof value === "object") {
    const g = value as GoalValue
    return `${g.current}/${g.target}`
  }
  if (typeof value === "boolean") return value ? "Yes" : "No"
  return String(value)
}

export interface RollupRow {
  key: string
  count: number
  sum: number
}

/**
 * Group items by `groupDef` and (optionally) sum `valueDef` within each group.
 * Returns rows sorted by descending sum, then count. Used by summary views
 * ("cost by booked/unbooked", "spend by category", "items left per room").
 */
export function rollup(
  tasks: Task[],
  groupDef: AttributeDefinition,
  valueDef?: AttributeDefinition,
  defsById?: DefLookup,
): RollupRow[] {
  const map = new Map<string, RollupRow>()
  for (const t of tasks) {
    const key = isFormulaDef(groupDef)
      ? groupKeyFor(numericCellValue(t, groupDef, defsById))
      : groupKeyFor(t.attributes?.[groupDef.id])
    const row = map.get(key) ?? { key, count: 0, sum: 0 }
    row.count += 1
    if (valueDef) {
      const n = numericCellValue(t, valueDef, defsById)
      if (n !== null) row.sum += n
    }
    map.set(key, row)
  }
  return [...map.values()].sort((a, b) => b.sum - a.sum || b.count - a.count)
}
