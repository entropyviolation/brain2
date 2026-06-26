/**
 * components/spreadsheet/SheetGrid.tsx — Google-Sheets-style editable grid
 *
 * A reusable, inline-editable grid over COGS items (`Task[]`) where columns are
 * the effective attribute schema (spec §5). Used by:
 *   - the Lists "Spreadsheet" display (`ListContentSpreadsheet`)
 *   - Module workspace "spreadsheet" views (`ModuleWorkspace`)
 *
 * v2 features (all driven by `lib/spreadsheet-contract`):
 *   - click-to-sort headers (asc → desc → none; shift-click for multi-sort)
 *   - a free-text filter row across all columns
 *   - drag-to-resize columns
 *   - config-driven frozen leading columns (`frozenColCount`, name counts as 1)
 *   - a formula bar showing/editing the selected cell's raw value
 *
 * v3 — Google-Sheets parity:
 *   - A1 column-letter headers + a row-number gutter; the formula bar shows the
 *     active cell's A1 address (e.g. `B2`)
 *   - drag + shift-click rectangular range selection, with a selection summary
 *     (Sum / Avg / Min / Max / Count) like the Sheets status bar
 *   - per-cell `=A1` formulas (`=B2+C2`) typed into any ordinary cell: stored
 *     verbatim, displayed as the computed value (see `lib/sheet-eval`)
 *   - a fill handle that copies the selection down/across, shifting relative
 *     references (`=B2` → `=B3` …) via `shiftFormula`
 *   - drag-to-resize rows; Delete/Backspace clears the selected range
 * Plus the v1 basics: sticky header, inline cell editing, a currency-aware
 * numeric footer, add-row, and add-column.
 *
 * Sort/filter/freeze/width/row-height state lives in a `SheetViewConfig`; it is
 * seeded from the optional `viewConfig` prop and surfaced via `onViewConfigChange`
 * so module views can persist it. With no config the grid behaves exactly as v1.
 *
 * Reads/writes the task + lists stores directly so callers only pass data, not
 * mutators.
 */
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowDown, ArrowUp, Plus } from "lucide-react"
import type { AttributeDefinition, AttributeValue, ItemTypeDefinition, Task, List } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { useItemTypeStore } from "@/lib/item-type-store"
import { normalizeAttributeType } from "@/lib/attribute-utils"
import { mergeListAttributes, formatAttributeValue } from "@/components/Lists/attribute-editor"
import { composeListAttributes } from "@/lib/item-types"
import { createListItem, withListMembership } from "@/lib/item-utils"
import { effectiveDef, slugId } from "@/components/Lists/attributes/helpers"
import { computeFormulaValue, formatFormulaValue, isFormulaDef, type DefLookup, type FormulaResult } from "@/lib/formula"
import { formatNumber, isNumericAttribute } from "@/lib/spreadsheet-utils"
import { columnToLetters, isCellFormula, shiftFormula } from "@/lib/sheet-a1"
import { evaluateCellAt, formatCellResult, type RawCellAccessor } from "@/lib/sheet-eval"
import {
  isWithinRange,
  normalizeRange,
  rangeArea,
  selectionStats,
  type GridCell,
  type GridRange,
} from "@/lib/spreadsheet-keys"
import {
  NAME_COLUMN_ID,
  buildSheetColumns,
  canWriteCell,
  cycleColumnSort,
  filterRows,
  sortDirFor,
  sortRows,
  type SheetColumn,
  type SheetViewConfig,
} from "@/lib/spreadsheet-contract"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

/** Types that get a true inline editor in a cell. Others open the item. */
const INLINE_TYPES = new Set(["string", "number", "boolean", "selection", "datetime", "color", "link"])

const CHECKBOX_W = 60
const DEFAULT_NAME_W = 200
const DEFAULT_COL_W = 160
const MIN_COL_W = 60
const DEFAULT_ROW_H = 28
const MIN_ROW_H = 22

interface SheetGridProps {
  /** Schema source + new-row/new-column target. */
  categoryId?: string
  /** Rows to render (already filtered/sorted by the caller; the grid may re-sort/filter). */
  tasks: Task[]
  /** Open the full item detail (used for complex cell types + the open arrow). */
  onOpenItem?: (id: string) => void
  enableAddRow?: boolean
  enableAddColumn?: boolean
  newItemLabel?: string
  className?: string
  /** Initial sort / filter / freeze / width state. */
  viewConfig?: SheetViewConfig
  /** Notified whenever the user changes sort / filter / freeze / widths. */
  onViewConfigChange?: (config: SheetViewConfig) => void
}

export function SheetGrid({
  categoryId,
  tasks,
  onOpenItem,
  enableAddRow = true,
  enableAddColumn = true,
  newItemLabel = "item",
  className,
  viewConfig,
  onViewConfigChange,
}: SheetGridProps) {
  const lists = useTaskStore((s) => s.lists)
  const updateTask = useTaskStore((s) => s.updateTask)
  const addTask = useTaskStore((s) => s.addTask)
  const updateList = useTaskStore((s) => s.updateList)
  const types = useItemTypeStore((s) => s.types)

  const category = lists.find((c) => c.id === categoryId)
  const nameLabel = capitalize(newItemLabel)

  const attrColumns = useColumns(category, lists, tasks, nameLabel, types)
  const allColumns = useMemo<SheetColumn[]>(
    () => buildSheetColumns(columnDefs(attrColumns), undefined, { includeName: true, nameLabel }),
    [attrColumns, nameLabel],
  )

  // Full schema (not just displayed columns) so formulas can reference hidden
  // attributes; keyed by id for the evaluator.
  const defsById = useMemo<DefLookup>(() => {
    const all = category
      ? composeListAttributes(category, types)
      : mergeListAttributes(lists, Array.from(new Set(tasks.flatMap((t) => t.lists ?? []))), types)
    const map = new Map<string, AttributeDefinition>()
    all.forEach((d) => map.set(d.id, effectiveDef(d)))
    attrColumns.forEach((c) => {
      if (c.def) map.set(c.id, effectiveDef(c.def))
    })
    return map
  }, [category, lists, tasks, attrColumns, types])

  // ---- View state (sort / filter / freeze / widths) -------------------------
  const [config, setConfig] = useState<SheetViewConfig>(viewConfig ?? {})
  useEffect(() => {
    if (viewConfig) setConfig(viewConfig)
    // Intentionally only resync when the caller hands us a new config object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewConfig])

  const patchConfig = (patch: Partial<SheetViewConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch }
      onViewConfigChange?.(next)
      return next
    })
  }

  const sort = config.sort
  const filterText = config.filterText ?? ""
  const frozenColCount = Math.max(1, config.frozenColCount ?? 1)
  const widths = config.columnWidths ?? {}

  const widthOf = (columnId: string): number =>
    widths[columnId] ?? (columnId === NAME_COLUMN_ID ? DEFAULT_NAME_W : DEFAULT_COL_W)

  // Sticky-left offset for the i-th attribute column (only when frozen).
  const frozenLeftFor = (attrIndex: number): number => {
    let left = CHECKBOX_W + widthOf(NAME_COLUMN_ID)
    for (let i = 0; i < attrIndex; i++) left += widthOf(attrColumns[i].id)
    return left
  }
  const isAttrFrozen = (attrIndex: number): boolean => attrIndex < frozenColCount - 1

  const displayTasks = useMemo(() => {
    const filtered = filterRows(tasks, filterText, allColumns, defsById)
    return sortRows(filtered, sort, allColumns, defsById)
  }, [tasks, filterText, allColumns, defsById, sort])

  const onSortColumn = (columnId: string, additive: boolean) => {
    patchConfig({ sort: cycleColumnSort(sort, columnId, additive) })
  }
  const onResizeColumn = (columnId: string, width: number) => {
    patchConfig({ columnWidths: { ...widths, [columnId]: Math.max(MIN_COL_W, Math.round(width)) } })
  }

  const rowHeights = config.rowHeights ?? {}
  const rowHeightOf = (rowId: string): number => rowHeights[rowId] ?? DEFAULT_ROW_H
  const onResizeRow = (rowId: string, height: number) => {
    patchConfig({ rowHeights: { ...rowHeights, [rowId]: Math.max(MIN_ROW_H, Math.round(height)) } })
  }

  // ---- Selection (range) + formula bar -------------------------------------
  // A cell is addressed by indices into `allColumns` (0 = name) × `displayTasks`.
  const [sel, setSel] = useState<{ anchor: GridCell; focus: GridCell } | null>(null)
  const selRange: GridRange | null = sel ? normalizeRange(sel.anchor, sel.focus) : null
  const active = sel?.focus ?? null
  const selectedColumn = active ? allColumns[active.col] ?? null : null
  const selectedTask = active ? displayTasks[active.row] ?? null : null

  // Raw value accessor over the grid (column-formula cells resolve to numbers so
  // A1 references can read their computed value).
  const getRawCell = useCallback<RawCellAccessor>(
    (col, row) => {
      const t = displayTasks[row]
      if (!t) return undefined
      const c = allColumns[col]
      if (!c) return undefined
      if (c.isName) return t.description
      if (c.def && isFormulaDef(c.def)) {
        return computeFormulaValue(c.def, t.attributes ?? {}, defsById).value ?? undefined
      }
      return t.attributes?.[c.id]
    },
    [displayTasks, allColumns, defsById],
  )
  const numericAt = (col: number, row: number): number | null => evaluateCellAt(col, row, getRawCell).value

  // Drag-select + fill-drag share pointer state through refs (latest values
  // read inside the window pointerup handler).
  const draggingRef = useRef(false)
  const fillingRef = useRef(false)
  const fillTargetRef = useRef<GridCell | null>(null)
  const [fillPreview, setFillPreview] = useState<GridRange | null>(null)

  useEffect(() => {
    const stop = () => {
      draggingRef.current = false
    }
    window.addEventListener("mouseup", stop)
    return () => window.removeEventListener("mouseup", stop)
  }, [])

  const selectCell = (col: number, row: number, additive: boolean) => {
    setSel((prev) =>
      additive && prev ? { anchor: prev.anchor, focus: { col, row } } : { anchor: { col, row }, focus: { col, row } },
    )
  }
  const onCellMouseDown = (col: number, row: number, e: React.MouseEvent) => {
    selectCell(col, row, e.shiftKey)
    draggingRef.current = true
  }
  const onCellEnter = (col: number, row: number) => {
    if (draggingRef.current) {
      setSel((prev) => (prev ? { anchor: prev.anchor, focus: { col, row } } : prev))
    } else if (fillingRef.current) {
      fillTargetRef.current = { col, row }
      setFillPreview(selRange ? normalizeRange({ col: selRange.left, row: selRange.top }, { col, row }) : null)
    }
  }

  const [newDesc, setNewDesc] = useState("")
  const [addColOpen, setAddColOpen] = useState(false)

  const setCell = (task: Task, def: AttributeDefinition, value: AttributeValue) => {
    // Guard: never persist a write to a computed/formula column.
    if (isFormulaDef(def)) return
    updateTask({ ...task, attributes: { ...(task.attributes || {}), [def.id]: value } })
  }
  const setName = (task: Task, name: string) => {
    updateTask({ ...task, description: name, title: name })
  }
  const addRow = () => {
    const desc = newDesc.trim()
    if (!desc || !categoryId) return
    const base = withListMembership(createListItem(desc, [categoryId]), category, types)
    addTask(base)
    setNewDesc("")
  }

  // ---- Fill-drag: copy the selection across the dragged-to box --------------
  const applyFill = (src: GridRange, target: GridCell) => {
    const box = normalizeRange({ col: src.left, row: src.top }, target)
    const srcW = src.right - src.left + 1
    const srcH = src.bottom - src.top + 1
    // Accumulate per-task so multiple writes to one row don't clobber each other.
    const working = new Map<string, Task>()
    const workCopy = (t: Task): Task => {
      let w = working.get(t.id)
      if (!w) {
        w = { ...t, attributes: { ...(t.attributes || {}) } }
        working.set(t.id, w)
      }
      return w
    }
    for (let row = box.top; row <= box.bottom; row++) {
      for (let col = box.left; col <= box.right; col++) {
        if (isWithinRange(src, { col, row })) continue // keep the source cells
        const column = allColumns[col]
        if (!column || column.isName || column.readOnly || !column.def) continue
        const target = displayTasks[row]
        if (!target) continue
        const srcCol = src.left + ((col - src.left) % srcW)
        const srcRow = src.top + ((row - src.top) % srcH)
        const srcRaw = getRawCell(srcCol, srcRow)
        const value = isCellFormula(srcRaw) ? shiftFormula(srcRaw, col - srcCol, row - srcRow) : srcRaw
        const w = workCopy(target)
        if (value === undefined) delete w.attributes![column.def.id]
        else w.attributes![column.def.id] = value
      }
    }
    working.forEach((t) => updateTask(t))
    setSel({ anchor: { col: box.left, row: box.top }, focus: { col: box.right, row: box.bottom } })
  }
  const startFill = (e: React.MouseEvent) => {
    if (!selRange) return
    e.preventDefault()
    e.stopPropagation()
    const src = selRange
    draggingRef.current = false // we're filling, not extending the selection
    fillingRef.current = true
    fillTargetRef.current = null
    setFillPreview(src)
    const onUp = () => {
      window.removeEventListener("mouseup", onUp)
      fillingRef.current = false
      const target = fillTargetRef.current
      setFillPreview(null)
      if (target) applyFill(src, target)
    }
    window.addEventListener("mouseup", onUp)
  }

  // Delete / Backspace clears the selected range (unless a field is focused).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return
      if (!selRange) return
      const el = document.activeElement
      const tag = el?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement)?.isContentEditable) return
      e.preventDefault()
      const working = new Map<string, Task>()
      for (let row = selRange.top; row <= selRange.bottom; row++) {
        const t = displayTasks[row]
        if (!t) continue
        for (let col = selRange.left; col <= selRange.right; col++) {
          const column = allColumns[col]
          if (!column || column.isName || column.readOnly || !column.def) continue
          let w = working.get(t.id)
          if (!w) {
            w = { ...t, attributes: { ...(t.attributes || {}) } }
            working.set(t.id, w)
          }
          delete w.attributes![column.def.id]
        }
      }
      working.forEach((t) => updateTask(t))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selRange, displayTasks, allColumns, updateTask])

  const numericAttrCols = attrColumns.filter((c) => c.def && isNumericAttribute(c.def))

  // Selection summary (Google-Sheets status bar) — shown for multi-cell ranges.
  const selStats = useMemo(() => {
    if (!selRange || rangeArea(selRange) <= 1) return null
    const values: Array<number | null> = []
    for (let row = selRange.top; row <= selRange.bottom; row++) {
      for (let col = selRange.left; col <= selRange.right; col++) {
        values.push(numericAt(col, row))
      }
    }
    return selectionStats(values, values.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selRange?.top, selRange?.bottom, selRange?.left, selRange?.right, getRawCell])

  return (
    <div className={className}>
      <SheetToolbar
        filterText={filterText}
        onFilterChange={(v) => patchConfig({ filterText: v })}
        selectedTask={selectedTask}
        selectedColumn={selectedColumn}
        cellAddress={active ? `${columnToLetters(active.col)}${active.row + 1}` : "—"}
        onCommit={(value) => {
          if (!selectedTask || !selectedColumn) return
          if (selectedColumn.isName) {
            setName(selectedTask, value)
          } else if (selectedColumn.def && canWriteCell(selectedColumn)) {
            setCell(selectedTask, selectedColumn.def, coerceCellInput(selectedColumn.def, value))
          }
        }}
      />

      <div className="overflow-auto border rounded-md max-h-[70vh] bg-background">
        <table className="sheet-grid w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted">
              <Th className="text-center" style={{ width: CHECKBOX_W, minWidth: CHECKBOX_W, position: "sticky", left: 0, zIndex: 22 }}>
                #
              </Th>
              <SortableTh
                label={nameLabel}
                letter={columnToLetters(0)}
                width={widthOf(NAME_COLUMN_ID)}
                dir={sortDirFor(sort, NAME_COLUMN_ID)}
                frozen
                left={CHECKBOX_W}
                onSort={(additive) => onSortColumn(NAME_COLUMN_ID, additive)}
                onResize={(w) => onResizeColumn(NAME_COLUMN_ID, w)}
              />
              {attrColumns.map((col, i) => {
                const frozen = isAttrFrozen(i)
                return (
                  <SortableTh
                    key={col.id}
                    label={col.name}
                    letter={columnToLetters(i + 1)}
                    unit={col.unit}
                    width={widthOf(col.id)}
                    dir={sortDirFor(sort, col.id)}
                    frozen={frozen}
                    left={frozen ? frozenLeftFor(i) : undefined}
                    onSort={(additive) => onSortColumn(col.id, additive)}
                    onResize={(w) => onResizeColumn(col.id, w)}
                  />
                )
              })}
              {enableAddColumn && categoryId && (
                <th className="border-b border-l px-1 text-center w-9">
                  <button
                    className="text-muted-foreground hover:text-foreground"
                    title="Add column"
                    onClick={() => setAddColOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {displayTasks.map((task, rowIdx) => {
              return (
              <tr key={task.id} className="hover:bg-muted/40 group" style={{ height: rowHeightOf(task.id) }}>
                <td
                  className="border-b text-center bg-background group-hover:bg-muted/40 relative select-none"
                  style={{ position: "sticky", left: 0, zIndex: 1 }}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-[10px] text-muted-foreground tabular-nums">{rowIdx + 1}</span>
                    <input
                      type="checkbox"
                      checked={!!task.completed}
                      onChange={() => updateTask({ ...task, completed: !task.completed })}
                    />
                  </div>
                  <RowResizeHandle height={rowHeightOf(task.id)} onResize={(h) => onResizeRow(task.id, h)} />
                </td>
                <td
                  className={cellClass(selRange, active, fillPreview, 0, rowIdx, "border-b border-r px-2 py-0.5 bg-background group-hover:bg-muted/40 relative")}
                  style={{ position: "sticky", left: CHECKBOX_W, width: widthOf(NAME_COLUMN_ID), zIndex: 1 }}
                  onMouseDown={(e) => onCellMouseDown(0, rowIdx, e)}
                  onMouseOver={() => onCellEnter(0, rowIdx)}
                >
                  <NameCell value={task.description} onCommit={(v) => setName(task, v)} onOpen={() => onOpenItem?.(task.id)} />
                  {isActiveCorner(selRange, 0, rowIdx) && <FillHandle onStart={startFill} />}
                </td>
                {attrColumns.map((col, i) => {
                  const frozen = isAttrFrozen(i)
                  const def = col.def!
                  const gridCol = i + 1
                  const rawVal = task.attributes?.[col.id]
                  const evaluated = !isFormulaDef(def) && isCellFormula(rawVal) ? evaluateCellAt(gridCol, rowIdx, getRawCell) : undefined
                  return (
                    <td
                      key={col.id}
                      className={cellClass(
                        selRange,
                        active,
                        fillPreview,
                        gridCol,
                        rowIdx,
                        `border-b border-l px-1 py-0.5 align-top relative ${frozen ? "bg-background group-hover:bg-muted/40" : ""}`,
                      )}
                      style={{
                        width: widthOf(col.id),
                        ...(frozen ? { position: "sticky", left: frozenLeftFor(i), zIndex: 1 } : {}),
                      }}
                      onMouseDown={(e) => onCellMouseDown(gridCol, rowIdx, e)}
                      onMouseOver={() => onCellEnter(gridCol, rowIdx)}
                    >
                      <SheetCell
                        def={def}
                        value={rawVal}
                        evaluated={evaluated}
                        attributes={task.attributes}
                        defsById={defsById}
                        onCommit={(v) => setCell(task, def, v)}
                        onOpen={() => onOpenItem?.(task.id)}
                      />
                      {isActiveCorner(selRange, gridCol, rowIdx) && <FillHandle onStart={startFill} />}
                    </td>
                  )
                })}
                {enableAddColumn && categoryId && <td className="border-b border-l" />}
              </tr>
              )
            })}
            {displayTasks.length === 0 && (
              <tr>
                <td colSpan={attrColumns.length + 2} className="px-3 py-6 text-center text-muted-foreground">
                  {tasks.length === 0 ? "No rows yet." : "No rows match the filter."}
                </td>
              </tr>
            )}
          </tbody>
          {numericAttrCols.length > 0 && displayTasks.length > 0 && (
            <tfoot className="sticky bottom-0">
              <tr className="bg-muted/80 font-medium">
                <td className="border-t" style={{ position: "sticky", left: 0 }} />
                <td
                  className="border-t border-r px-2 py-1 bg-muted/80 text-xs text-muted-foreground"
                  style={{ position: "sticky", left: CHECKBOX_W }}
                >
                  Totals ({displayTasks.length})
                </td>
                {attrColumns.map((col, i) => {
                  const def = col.def!
                  if (!isNumericAttribute(def)) return <td key={col.id} className="border-t border-l" />
                  const gridCol = i + 1
                  let sum = 0
                  for (let row = 0; row < displayTasks.length; row++) sum += numericAt(gridCol, row) ?? 0
                  const text = isFormulaDef(def) ? formatFormulaValue({ value: sum }, def) : formatNumber(sum, def)
                  return (
                    <td key={col.id} className="border-t border-l px-1 py-1 text-xs">
                      {text}
                    </td>
                  )
                })}
                {enableAddColumn && categoryId && <td className="border-t border-l" />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {selStats && (
        <div className="flex items-center justify-end gap-3 mt-1 px-1 text-[11px] text-muted-foreground tabular-nums">
          {selStats.numericCount > 0 && (
            <>
              <span>Sum: {round6(selStats.sum).toLocaleString()}</span>
              <span>Avg: {selStats.avg !== null ? round6(selStats.avg).toLocaleString() : "—"}</span>
              <span>Min: {selStats.min !== null ? round6(selStats.min).toLocaleString() : "—"}</span>
              <span>Max: {selStats.max !== null ? round6(selStats.max).toLocaleString() : "—"}</span>
            </>
          )}
          <span>Count: {selStats.count}{selStats.numericCount > 0 ? ` (${selStats.numericCount} numeric)` : ""}</span>
        </div>
      )}

      {enableAddRow && categoryId && (
        <div className="flex gap-2 mt-2">
          <Input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addRow()
            }}
            placeholder={`Add ${newItemLabel}…`}
            className="h-9 max-w-xs"
          />
          <Button size="sm" onClick={addRow} disabled={!newDesc.trim()}>
            <Plus className="h-4 w-4 mr-1" /> Add row
          </Button>
        </div>
      )}

      {addColOpen && category && (
        <AddColumnDialog
          category={category}
          onClose={() => setAddColOpen(false)}
          onAdd={(def) => {
            const displayed = category.displayedAttributes
            const next: List = {
              ...category,
              itemAttributes: [...(category.itemAttributes || []), def],
              // When a list curates which attributes are shown, the new column
              // would otherwise be hidden — append its id so it appears at the
              // end. An empty/undefined `displayedAttributes` already shows all.
              ...(displayed && displayed.length > 0
                ? { displayedAttributes: [...displayed, def.id] }
                : {}),
            }
            updateList(next)
            setAddColOpen(false)
          }}
        />
      )}
    </div>
  )
}

/** Build the displayed attribute columns (excluding the name column). */
function useColumns(
  category: List | undefined,
  lists: List[],
  tasks: Task[],
  nameLabel: string,
  types: ItemTypeDefinition[],
): SheetColumn[] {
  return useMemo(() => {
    if (category) {
      const defs = composeListAttributes(category, types)
      return buildSheetColumns(defs, category.displayedAttributes, { includeName: false, nameLabel })
    }
    const catIds = Array.from(new Set(tasks.flatMap((t) => t.lists ?? [])))
    const merged = mergeListAttributes(lists, catIds, types)
    return buildSheetColumns(merged, undefined, { includeName: false, nameLabel })
  }, [category, lists, tasks, nameLabel, types])
}

function columnDefs(cols: SheetColumn[]): AttributeDefinition[] {
  return cols.map((c) => c.def).filter((d): d is AttributeDefinition => !!d)
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6
}

/** True when (col,row) is the bottom-right corner of the selection (fill anchor). */
function isActiveCorner(range: GridRange | null, col: number, row: number): boolean {
  return !!range && range.right === col && range.bottom === row
}

/** Tailwind classes for a cell given the selection range, active cell, and fill preview. */
function cellClass(
  range: GridRange | null,
  active: GridCell | null,
  fill: GridRange | null,
  col: number,
  row: number,
  base: string,
): string {
  const here: GridCell = { col, row }
  const inSel = range ? isWithinRange(range, here) : false
  const isActive = active ? active.col === col && active.row === row : false
  const inFill = fill && !inSel ? isWithinRange(fill, here) : false
  let cls = base
  if (inSel) cls += " bg-primary/10"
  if (inFill) cls += " ring-1 ring-inset ring-primary/40"
  if (isActive) cls += " ring-2 ring-inset ring-primary z-[2]"
  return cls
}

/**
 * Coerce a raw string (from the formula bar or an inline editor) into the stored
 * value for an attribute. A leading "=" marks a Google-Sheets-style cell formula
 * and is stored verbatim (trimmed) regardless of the column type.
 */
function coerceCellInput(def: AttributeDefinition, raw: string): AttributeValue {
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

/** Small drag handle on a row's bottom edge for resizing the row height. */
function RowResizeHandle({ height, onResize }: { height: number; onResize: (height: number) => void }) {
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startY = e.clientY
    const startH = height
    const move = (ev: PointerEvent) => onResize(startH + (ev.clientY - startY))
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }
  return (
    <span
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize row"
      onPointerDown={onPointerDown}
      className="absolute bottom-0 left-0 w-full h-1.5 cursor-row-resize hover:bg-primary/40"
    />
  )
}

/** The Google-Sheets fill handle: a small square at the selection's corner. */
function FillHandle({ onStart }: { onStart: (e: React.MouseEvent) => void }) {
  return (
    <span
      role="button"
      aria-label="Fill handle"
      onMouseDown={onStart}
      className="absolute -bottom-[3px] -right-[3px] h-2 w-2 bg-primary border border-background cursor-crosshair z-[3]"
    />
  )
}

function SheetToolbar({
  filterText,
  onFilterChange,
  selectedTask,
  selectedColumn,
  cellAddress,
  onCommit,
}: {
  filterText: string
  onFilterChange: (value: string) => void
  selectedTask: Task | null
  selectedColumn: SheetColumn | null
  cellAddress: string
  onCommit: (value: string) => void
}) {
  const rawValue = useMemo(() => {
    if (!selectedTask || !selectedColumn) return ""
    if (selectedColumn.isName) return selectedTask.description ?? ""
    if (selectedColumn.isFormula) return selectedColumn.def?.formula ?? ""
    const v = selectedTask.attributes?.[selectedColumn.id]
    return v === undefined || v === null ? "" : String(v)
  }, [selectedTask, selectedColumn])

  const [draft, setDraft] = useState(rawValue)
  useEffect(() => setDraft(rawValue), [rawValue])

  const readOnly = !selectedColumn || !canWriteCell(selectedColumn)

  return (
    <div className="flex items-center gap-2 mb-2">
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <span className="text-[11px] font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-muted shrink-0 w-12 text-center tabular-nums" title="Active cell">
          {cellAddress}
        </span>
        <span className="text-xs font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-muted shrink-0" title="Formula bar">
          fx
        </span>
        <Input
          aria-label="Formula bar"
          value={draft}
          disabled={readOnly}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (!readOnly && draft !== rawValue) onCommit(draft)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (!readOnly && draft !== rawValue) onCommit(draft)
              ;(e.target as HTMLInputElement).blur()
            }
            if (e.key === "Escape") setDraft(rawValue)
          }}
          className="h-8 font-mono text-xs"
          placeholder={selectedColumn ? "" : "Select a cell"}
        />
      </div>
      <Input
        aria-label="Filter rows"
        value={filterText}
        onChange={(e) => onFilterChange(e.target.value)}
        placeholder="Filter…"
        className="h-8 max-w-[180px]"
      />
    </div>
  )
}

function Th({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <th
      className={`border-b px-2 py-1.5 text-left font-semibold text-xs uppercase tracking-wide bg-muted ${className}`}
      style={style}
    >
      {children}
    </th>
  )
}

function SortableTh({
  label,
  letter,
  unit,
  width,
  dir,
  frozen,
  left,
  onSort,
  onResize,
}: {
  label: string
  letter?: string
  unit?: string
  width: number
  dir?: "asc" | "desc"
  frozen?: boolean
  left?: number
  onSort: (additive: boolean) => void
  onResize: (width: number) => void
}) {
  const style: React.CSSProperties = {
    width,
    minWidth: width,
    position: frozen ? "sticky" : "relative",
    left: frozen ? left : undefined,
    zIndex: frozen ? 21 : undefined,
  }
  return (
    <th
      className="border-b border-l px-2 py-1 text-left font-semibold text-xs uppercase tracking-wide bg-muted select-none"
      style={style}
    >
      {letter ? <div className="text-center text-[10px] font-normal text-muted-foreground leading-none mb-0.5">{letter}</div> : null}
      <div className="flex items-center justify-between gap-1">
        <button
          type="button"
          className="flex items-center gap-1 hover:text-primary min-w-0"
          onClick={(e) => onSort(e.shiftKey)}
          title="Sort (shift-click to add)"
        >
          <span className="truncate">{label}</span>
          {unit ? <span className="text-muted-foreground font-normal normal-case">({unit})</span> : null}
          {dir === "asc" && <ArrowUp className="h-3 w-3 shrink-0" />}
          {dir === "desc" && <ArrowDown className="h-3 w-3 shrink-0" />}
        </button>
      </div>
      <ResizeHandle width={width} onResize={onResize} />
    </th>
  )
}

function ResizeHandle({ width, onResize }: { width: number; onResize: (width: number) => void }) {
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = width
    const move = (ev: PointerEvent) => onResize(startW + (ev.clientX - startX))
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize column"
      onPointerDown={onPointerDown}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40"
    />
  )
}

function NameCell({ value, onCommit, onOpen }: { value: string; onCommit: (v: string) => void; onOpen: () => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  if (editing) {
    return (
      <input
        autoFocus
        className="w-full bg-transparent outline-none border-b border-primary"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false)
          if (draft !== value) onCommit(draft)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur()
          if (e.key === "Escape") {
            setDraft(value)
            setEditing(false)
          }
        }}
      />
    )
  }
  return (
    <div className="flex items-center justify-between gap-1">
      <span
        className="truncate cursor-text flex-1"
        onClick={() => {
          setDraft(value)
          setEditing(true)
        }}
      >
        {value || <span className="text-muted-foreground">Untitled</span>}
      </span>
      <button className="opacity-0 group-hover:opacity-100 text-xs text-primary hover:underline" onClick={onOpen}>
        open
      </button>
    </div>
  )
}

function SheetCell({
  def,
  value,
  evaluated,
  attributes,
  defsById,
  onCommit,
  onOpen,
}: {
  def: AttributeDefinition
  value: AttributeValue
  /** Set when `value` is a per-cell `=` formula: its computed result for display. */
  evaluated?: FormulaResult
  attributes?: Record<string, AttributeValue>
  defsById?: DefLookup
  onCommit: (v: AttributeValue) => void
  onOpen: () => void
}) {
  const type = normalizeAttributeType(def.type)
  const [editing, setEditing] = useState(false)

  if (type === "formula") {
    // Read-only computed cell. useMemo recomputes whenever the row's attributes
    // change, so dependent values stay in sync.
    const result = computeFormulaValue(def, attributes ?? {}, defsById ?? new Map())
    return (
      <span
        className={`block w-full truncate px-1 ${result.error ? "text-destructive" : ""}`}
        title={def.formula || undefined}
      >
        {formatFormulaValue(result, def) || <span className="text-muted-foreground">—</span>}
      </span>
    )
  }

  // Per-cell `=` formula in an ordinary column: show the computed result; editing
  // reveals the raw expression (text editor, so "=" is always typeable).
  if (evaluated && !editing) {
    return (
      <button
        className={`text-left w-full truncate min-h-[24px] hover:bg-muted/60 rounded px-1 ${evaluated.error ? "text-destructive" : ""}`}
        onClick={() => setEditing(true)}
        title={typeof value === "string" ? value : undefined}
      >
        {formatCellResult(evaluated) || <span className="text-muted-foreground">—</span>}
      </button>
    )
  }

  if (type === "boolean") {
    return (
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onCommit(e.target.checked)}
        className="ml-1"
      />
    )
  }

  if (!INLINE_TYPES.has(type)) {
    // Complex type — show formatted value; clicking opens the item to edit.
    return (
      <button className="text-left w-full truncate hover:underline" onClick={onOpen} title="Open to edit">
        {formatAttributeValue(def, value) || <span className="text-muted-foreground">—</span>}
      </button>
    )
  }

  if (editing) {
    return (
      <InlineEditor
        def={def}
        value={value}
        onCommit={(v) => {
          onCommit(v)
          setEditing(false)
        }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <button
      className="text-left w-full truncate min-h-[24px] hover:bg-muted/60 rounded px-1"
      onClick={() => setEditing(true)}
    >
      {formatAttributeValue(def, value) || <span className="text-muted-foreground">—</span>}
    </button>
  )
}

function InlineEditor({
  def,
  value,
  onCommit,
  onCancel,
}: {
  def: AttributeDefinition
  value: AttributeValue
  onCommit: (v: AttributeValue) => void
  onCancel: () => void
}) {
  const type = normalizeAttributeType(def.type)
  const [draft, setDraft] = useState<AttributeValue>(value)

  const commit = () => onCommit(draft)

  if (type === "selection" && !def.allowMultiple) {
    const options = def.options || []
    return (
      <select
        autoFocus
        className="w-full bg-background border rounded h-7 px-1 text-xs"
        value={(draft as string) || ""}
        onChange={(e) => onCommit(e.target.value || undefined)}
        onBlur={onCancel}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    )
  }

  if (type === "color") {
    return (
      <input
        autoFocus
        type="color"
        className="h-7 w-12"
        value={(draft as string) || "#3b82f6"}
        onChange={(e) => onCommit(e.target.value)}
        onBlur={onCancel}
      />
    )
  }

  if (type === "datetime") {
    const dateType = def.datetimeMode === "time" ? "time" : def.datetimeMode === "datetime" ? "datetime-local" : "date"
    return (
      <input
        autoFocus
        type={dateType}
        className="w-full bg-background border border-primary rounded h-7 px-1 text-xs outline-none"
        value={draft === undefined || draft === null ? "" : String(draft)}
        onChange={(e) => setDraft(e.target.value === "" ? undefined : e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur()
          if (e.key === "Escape") onCancel()
        }}
      />
    )
  }

  // Text-based cells (string / number / link). A plain text input — never a
  // numeric spinner — so Google-Sheets-style "=" formulas are typeable in any
  // column; `coerceCellInput` decides formula vs. number vs. string on commit.
  return (
    <input
      autoFocus
      type="text"
      inputMode={type === "number" ? "decimal" : undefined}
      className="w-full bg-background border border-primary rounded h-7 px-1 text-xs outline-none"
      value={draft === undefined || draft === null ? "" : String(draft)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(coerceCellInput(def, String(draft ?? "")))}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur()
        if (e.key === "Escape") onCancel()
      }}
    />
  )
}

const COLUMN_TYPES: { value: AttributeDefinition["type"]; label: string }[] = [
  { value: "string", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Yes/No" },
  { value: "selection", label: "Selection" },
  { value: "datetime", label: "Date / time" },
  { value: "color", label: "Color" },
  { value: "link", label: "Link" },
  { value: "goal", label: "Goal x / y" },
  { value: "multistring", label: "Text list" },
  { value: "image", label: "Image" },
  { value: "formula", label: "Formula" },
]

function AddColumnDialog({
  category,
  onClose,
  onAdd,
}: {
  category: List
  onClose: () => void
  onAdd: (def: AttributeDefinition) => void
}) {
  const [name, setName] = useState("")
  const [type, setType] = useState<AttributeDefinition["type"]>("string")
  const [unit, setUnit] = useState("")
  const [options, setOptions] = useState("")
  const [formula, setFormula] = useState("")
  const [formatAs, setFormatAs] = useState<"number" | "currency" | "percent">("number")

  const save = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const existing = new Set((category.itemAttributes || []).map((a) => a.id))
    let id = slugId(trimmed)
    while (existing.has(id)) id = `${id}_${Math.random().toString(36).slice(2, 4)}`
    const def: AttributeDefinition = { id, name: trimmed, type }
    if (unit.trim()) def.unit = unit.trim()
    if (type === "selection") {
      def.optionSource = "manual"
      def.options = options.split(",").map((o) => o.trim()).filter(Boolean)
    }
    if (type === "formula") {
      def.formula = formula.trim()
      def.formatAs = formatAs
    }
    onAdd(def)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add column</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cost" autoFocus />
          </div>
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as AttributeDefinition["type"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLUMN_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {type === "number" && (
            <div className="space-y-1">
              <Label>Unit (optional)</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="$, min, kg…" />
            </div>
          )}
          {type === "selection" && (
            <div className="space-y-1">
              <Label>Options (comma-separated)</Label>
              <Input value={options} onChange={(e) => setOptions(e.target.value)} placeholder="Low, Medium, High" />
            </div>
          )}
          {type === "formula" && (
            <>
              <div className="space-y-1">
                <Label>Expression</Label>
                <Input
                  value={formula}
                  onChange={(e) => setFormula(e.target.value)}
                  placeholder="=price * qty"
                  className="font-mono text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  Reference other columns by id. Functions: SUM, AVG, MIN, MAX.
                </p>
              </div>
              <div className="space-y-1">
                <Label>Format</Label>
                <Select value={formatAs} onValueChange={(v) => setFormatAs(v as "number" | "currency" | "percent")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="currency">Currency</SelectItem>
                    <SelectItem value="percent">Percent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!name.trim()}>
            Add column
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
