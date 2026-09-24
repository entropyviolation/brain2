/**
 * components/spreadsheet/SheetGrid.tsx — Google-Sheets-style editable grid
 *
 * A reusable, inline-editable grid over Brain2 items (`Task[]`) where columns are
 * the effective attribute schema (spec §5). Used by:
 *   - the Lists "Spreadsheet" display (`ListContentSpreadsheet`)
 *   - Module workspace "spreadsheet" views (`ModuleWorkspace`)
 *
 * v2 features (all driven by `lib/spreadsheet-contract`):
 *   - click-to-sort headers (asc → desc → none; shift-click for multi-sort)
 *   - header ⋮: Sort, Attribute settings (existing schema editor), hide / insert / move
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
 *   - Google-Sheets clipboard: copy/paste TSV across the selection; double-click
 *     (or F2) enters edit mode so paste goes into that one cell only
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
import { ArrowDown, ArrowUp, MoreVertical, Plus } from "lucide-react"
import type { AttributeDefinition, AttributeValue, Task, List } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { useItemTypeStore } from "@/lib/item-type-store"
import { normalizeAttributeType } from "@/lib/attribute-utils"
import { mergeListAttributes, formatAttributeValue } from "@/components/Lists/attribute-editor"
import { composeListAttributes } from "@/lib/item-types"
import { createListItem, withListMembership } from "@/lib/item-utils"
import { withCompleted } from "@/lib/completion-status"
import { effectiveDef } from "@/components/Lists/attributes/helpers"
import { computeFormulaValue, formatFormulaValue, isFormulaDef, type DefLookup, type FormulaResult } from "@/lib/formula"
import { formatNumber, isNumericAttribute } from "@/lib/spreadsheet-utils"
import { columnToLetters, isCellFormula, shiftFormula } from "@/lib/sheet-a1"
import { evaluateCellAt, formatCellResult, type RawCellAccessor } from "@/lib/sheet-eval"
import {
  NAV_KEYS,
  enterTarget,
  isWithinRange,
  moveActive,
  normalizeRange,
  parseClipboardGrid,
  rangeArea,
  rangeToTSV,
  selectionStats,
  tabTarget,
  type GridCell,
  type GridRange,
} from "@/lib/spreadsheet-keys"
import { expandPasteWrites } from "@/lib/spreadsheet-paste"
import {
  NAME_COLUMN_ID,
  MIN_SHEET_COL_WIDTH,
  applyColumnWidth,
  persistSheetViewConfig,
  canWriteCell,
  coerceCellInput,
  cycleColumnSort,
  filterRows,
  nameColumn,
  sortDirFor,
  sortRows,
  type SheetColumn,
  type SheetViewConfig,
} from "@/lib/spreadsheet-contract"
import {
  assignAttributeToList,
  attributeSettingsForColumn,
  buildSpreadsheetCatalog,
  columnsFromIds,
  hideColumnId,
  insertColumnId,
  isTypeToReplaceKey,
  moveColumnId,
  patchAttributeOnList,
  readBuiltinField,
  resolveColumnIds,
  writeBuiltinField,
  type BuiltinFieldKey,
  type SheetColumnCandidate,
} from "@/lib/spreadsheet-catalog"
import { AttributeSettingsDialog } from "@/components/Lists/attributes/AttributeSettingsDialog"
import { AddColumnDialog } from "./AddColumnDialog"
import "./sheet-chrome.css"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/** Types that get a true inline editor in a cell. Others open the item. */
const INLINE_TYPES = new Set(["string", "number", "boolean", "selection", "datetime", "color", "link"])

const CHECKBOX_W = 60
const DEFAULT_NAME_W = 200
const DEFAULT_COL_W = 160
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
  selectMode?: boolean
  selectedTaskIds?: string[]
  onToggleTaskSelect?: (taskId: string) => void
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
  selectMode,
  selectedTaskIds,
  onToggleTaskSelect,
}: SheetGridProps) {
  const lists = useTaskStore((s) => s.lists)
  const updateTask = useTaskStore((s) => s.updateTask)
  const addTask = useTaskStore((s) => s.addTask)
  const updateList = useTaskStore((s) => s.updateList)
  const types = useItemTypeStore((s) => s.types)

  const category = lists.find((c) => c.id === categoryId)
  const nameLabel = capitalize(newItemLabel)
  const vaultItems = useTaskStore((s) => s.tasks)
  const listNameById = useMemo(() => new Map(lists.map((l) => [l.id, l.name])), [lists])

  // ---- View state (sort / filter / freeze / widths / columns) ---------------
  const [config, setConfig] = useState<SheetViewConfig>(viewConfig ?? {})
  useEffect(() => {
    // Rehydrate when switching lists. Do not reset live widths on task refresh
    // or on the echo of our own persist write.
    setConfig(viewConfig ?? {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId])
  const incomingColumnIds = viewConfig?.columnIds
  useEffect(() => {
    if (!incomingColumnIds) return
    setConfig((prev) => {
      const same =
        prev.columnIds &&
        prev.columnIds.length === incomingColumnIds.length &&
        prev.columnIds.every((id, i) => id === incomingColumnIds[i])
      return same ? prev : { ...prev, columnIds: incomingColumnIds }
    })
  }, [incomingColumnIds])

  const patchConfig = (patch: Partial<SheetViewConfig>) => {
    setConfig((prev) => {
      const next = persistSheetViewConfig(prev, patch)
      onViewConfigChange?.(next)
      return next
    })
  }

  const catalog = useMemo(
    () =>
      buildSpreadsheetCatalog({
        list: category,
        lists,
        types,
        listItems: tasks,
        vaultItems,
      }),
    [category, lists, types, tasks, vaultItems],
  )
  const extraIds = resolveColumnIds(config, catalog, category, types)
  const attrColumns = useMemo(() => columnsFromIds(catalog, extraIds), [catalog, extraIds])
  const allColumns = useMemo<SheetColumn[]>(
    () => [nameColumn(nameLabel), ...attrColumns],
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
    catalog.forEach((c) => {
      if (c.def) map.set(c.id, effectiveDef(c.def))
    })
    return map
  }, [category, lists, tasks, attrColumns, types, catalog])

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
    patchConfig(applyColumnWidth({}, columnId, width, MIN_SHEET_COL_WIDTH))
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
  // Inline edit mode (Sheets: double-click / F2 / type-to-replace). `seed` replaces
  // the cell contents when the user starts typing a printable character.
  const [editingCell, setEditingCell] = useState<(GridCell & { seed?: string }) | null>(null)

  const applyWrite = useCallback(
    (task: Task, column: SheetColumn, value: AttributeValue): Task => {
      if (!canWriteCell(column) || column.isFormula) return task
      if (column.isName) {
        const text = value == null ? "" : String(value)
        return { ...task, description: text, title: text }
      }
      if (column.builtin) {
        return writeBuiltinField(task, column.builtin as BuiltinFieldKey, value, { lists })
      }
      if (column.def) {
        const next = { ...task, attributes: { ...(task.attributes || {}) } }
        if (value === undefined) delete next.attributes![column.def.id]
        else next.attributes![column.def.id] = value
        return next
      }
      return task
    },
    [lists],
  )

  const cellRawValue = useCallback(
    (task: Task, column: SheetColumn): AttributeValue => {
      if (column.isName) return task.description
      if (column.builtin) return readBuiltinField(task, column.builtin as BuiltinFieldKey, listNameById)
      if (column.isFormula && column.def) {
        return computeFormulaValue(column.def, task.attributes ?? {}, defsById).value
      }
      return task.attributes?.[column.id]
    },
    [listNameById, defsById],
  )

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
      if (c.builtin) return readBuiltinField(t, c.builtin as BuiltinFieldKey, listNameById)
      return t.attributes?.[c.id]
    },
    [displayTasks, allColumns, defsById, listNameById],
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
  const beginEdit = (col: number, row: number, seed?: string) => {
    const column = allColumns[col]
    if (!column || column.readOnly || column.isFormula) return
    if (!column.isName && column.def && !INLINE_TYPES.has(normalizeAttributeType(column.def.type))) return
    setEditingCell({ col, row, seed })
  }
  const navigateFromEdit = (key: "Enter" | "Tab", shift: boolean) => {
    if (!active) return
    const next =
      key === "Tab"
        ? tabTarget(active, shift, displayTasks.length, allColumns.length)
        : enterTarget(active, shift, displayTasks.length, allColumns.length)
    setSel({ anchor: next, focus: next })
  }
  const onCellMouseDown = (col: number, row: number, e: React.MouseEvent) => {
    // Selecting a different cell ends edit mode (blur commits via the editor).
    if (!editingCell || editingCell.col !== col || editingCell.row !== row) {
      setEditingCell(null)
    }
    selectCell(col, row, e.shiftKey)
    draggingRef.current = true
  }
  const onCellDoubleClick = (col: number, row: number) => {
    beginEdit(col, row)
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
  const [insertAt, setInsertAt] = useState<number | undefined>(undefined)
  const [settingsDef, setSettingsDef] = useState<AttributeDefinition | null>(null)

  const setCell = (task: Task, def: AttributeDefinition, value: AttributeValue) => {
    if (isFormulaDef(def)) return
    const column = allColumns.find((c) => c.id === def.id)
    if (column) updateTask(applyWrite(task, column, value))
    else updateTask({ ...task, attributes: { ...(task.attributes || {}), [def.id]: value } })
  }
  const setName = (task: Task, name: string) => {
    updateTask(applyWrite(task, nameColumn(nameLabel), name))
  }
  const hideColumn = (columnId: string) => {
    if (columnId === NAME_COLUMN_ID) return
    const ids = hideColumnId(extraIds, columnId)
    if (category) {
      const current = useTaskStore.getState().lists.find((l) => l.id === category.id) ?? category
      updateList({
        ...current,
        sheetConfig: persistSheetViewConfig(current.sheetConfig, { columnIds: ids }),
      })
    }
    patchConfig({ columnIds: ids })
  }
  const openAttributeSettings = (column: SheetColumn) => {
    const target = attributeSettingsForColumn(column)
    if (target.kind === "attribute") setSettingsDef(target.def)
  }
  const applyAttributeSettings = (next: AttributeDefinition) => {
    if (!category) return
    const current = useTaskStore.getState().lists.find((l) => l.id === category.id) ?? category
    updateList(patchAttributeOnList(current, next))
    setSettingsDef(next)
  }
  const openAddColumn = (at?: number) => {
    setInsertAt(at)
    setAddColOpen(true)
  }
  const applyAddedColumn = (
    id: string,
    def: AttributeDefinition | undefined,
    opts: { assignToAll: boolean; isBuiltin: boolean; created: boolean },
  ) => {
    if (!category) return
    let nextList: List = { ...category }
    if (opts.assignToAll && def && !opts.isBuiltin) {
      nextList = assignAttributeToList(nextList, def)
    }
    const ids = insertColumnId(extraIds, id, insertAt)
    nextList = { ...nextList, sheetConfig: { ...config, columnIds: ids } }
    if ((opts.created || opts.assignToAll) && def && !opts.isBuiltin) {
      const displayed = nextList.displayedAttributes
      if (displayed && displayed.length > 0 && !displayed.includes(id)) {
        nextList = { ...nextList, displayedAttributes: [...displayed, id] }
      }
    }
    updateList(nextList)
    patchConfig({ columnIds: ids })
    setAddColOpen(false)
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
        working.set(target.id, applyWrite(w, column, value as AttributeValue))
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

  // Delete / Backspace clears; F2 edits; Copy/Paste use TSV when not editing a cell.
  useEffect(() => {
    const isFieldFocused = () => {
      const el = document.activeElement
      const tag = el?.tagName
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!(el as HTMLElement)?.isContentEditable
    }

    const cellDisplayText = (cell: GridCell): string => {
      const t = displayTasks[cell.row]
      const column = allColumns[cell.col]
      if (!t || !column) return ""
      if (column.isName) return t.description ?? ""
      if (column.isFormula && column.def) {
        return formatFormulaValue(computeFormulaValue(column.def, t.attributes ?? {}, defsById), column.def)
      }
      const raw = cellRawValue(t, column)
      if (isCellFormula(raw)) {
        return formatCellResult(evaluateCellAt(cell.col, cell.row, getRawCell))
      }
      if (column.def) return formatAttributeValue(column.def, raw)
      if (Array.isArray(raw)) return raw.map(String).join(", ")
      return raw === undefined || raw === null ? "" : String(raw)
    }

    const applyPasteText = (text: string) => {
      if (!selRange && !active) return
      const start = selRange ? { row: selRange.top, col: selRange.left } : active!
      const grid = parseClipboardGrid(text)
      const writes = expandPasteWrites(grid, start, selRange)
      if (writes.length === 0) return

      const working = new Map<string, Task>()
      const workCopy = (t: Task): Task => {
        let w = working.get(t.id)
        if (!w) {
          w = { ...t, attributes: { ...(t.attributes || {}) } }
          working.set(t.id, w)
        }
        return w
      }

      // Create rows past the end of the visible grid when the paste overflows.
      const maxRow = Math.max(...writes.map((w) => w.row))
      const created: Task[] = []
      if (categoryId && maxRow >= displayTasks.length) {
        for (let row = displayTasks.length; row <= maxRow; row++) {
          const base = withListMembership(createListItem("", [categoryId]), category, types)
          created.push(base)
          addTask(base)
        }
      }
      const rowTask = (row: number): Task | undefined => {
        if (row < displayTasks.length) return displayTasks[row]
        return created[row - displayTasks.length]
      }

      let maxWriteCol = start.col
      let maxWriteRow = start.row
      for (const { row, col, text: cellText } of writes) {
        const column = allColumns[col]
        if (!column || column.readOnly || column.isFormula) continue
        const task = rowTask(row)
        if (!task) continue
        maxWriteCol = Math.max(maxWriteCol, col)
        maxWriteRow = Math.max(maxWriteRow, row)
        if (column.isName) {
          const w = workCopy(task)
          working.set(task.id, applyWrite(w, column, cellText))
        } else if (column.def || column.builtin) {
          const w = workCopy(task)
          const coerced = column.def ? coerceCellInput(column.def, cellText) : cellText
          working.set(task.id, applyWrite(w, column, coerced))
        }
      }
      working.forEach((t) => updateTask(t))
      setSel({
        anchor: start,
        focus: { col: maxWriteCol, row: maxWriteRow },
      })
      setEditingCell(null)
    }

    const onKey = (e: KeyboardEvent) => {
      const field = isFieldFocused()
      if (editingCell && field) return
      if (field && !editingCell) return
      if (!active) return

      if (e.key === "F2") {
        e.preventDefault()
        beginEdit(active.col, active.row)
        return
      }
      if (e.key === "Enter") {
        e.preventDefault()
        beginEdit(active.col, active.row)
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        setEditingCell(null)
        return
      }
      if (e.key === "Tab") {
        e.preventDefault()
        const next = tabTarget(active, e.shiftKey, displayTasks.length, allColumns.length)
        setSel({ anchor: next, focus: next })
        return
      }
      if (NAV_KEYS.has(e.key)) {
        e.preventDefault()
        const next = moveActive(
          active,
          e.key,
          displayTasks.length,
          allColumns.length,
          e.ctrlKey || e.metaKey,
        )
        setSel((prev) =>
          e.shiftKey && prev ? { anchor: prev.anchor, focus: next } : { anchor: next, focus: next },
        )
        return
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (!selRange) return
        e.preventDefault()
        const working = new Map<string, Task>()
        for (let row = selRange.top; row <= selRange.bottom; row++) {
          const t = displayTasks[row]
          if (!t) continue
          for (let col = selRange.left; col <= selRange.right; col++) {
            const column = allColumns[col]
            if (!column || column.readOnly) continue
            let w = working.get(t.id) ?? t
            w = applyWrite(w, column, undefined)
            working.set(t.id, w)
          }
        }
        working.forEach((t) => updateTask(t))
        return
      }
      if (isTypeToReplaceKey(e)) {
        e.preventDefault()
        beginEdit(active.col, active.row, e.key)
      }
    }

    const onCopy = (e: ClipboardEvent) => {
      if (!selRange || isFieldFocused()) return
      e.preventDefault()
      const tsv = rangeToTSV(selRange, cellDisplayText)
      e.clipboardData?.setData("text/plain", tsv)
    }

    const onPaste = (e: ClipboardEvent) => {
      // While a cell editor (or formula bar / filter) is focused, leave paste alone
      // so the whole clipboard lands in that one field — Sheets double-click behavior.
      if (isFieldFocused() || editingCell) return
      if (!selRange && !active) return
      const text = e.clipboardData?.getData("text/plain")
      if (text == null) return
      e.preventDefault()
      applyPasteText(text)
    }

    window.addEventListener("keydown", onKey)
    window.addEventListener("copy", onCopy)
    window.addEventListener("paste", onPaste)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("copy", onCopy)
      window.removeEventListener("paste", onPaste)
    }
    // beginEdit closes over allColumns; listing it would churn the listener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selRange,
    active,
    editingCell,
    displayTasks,
    allColumns,
    updateTask,
    addTask,
    categoryId,
    category,
    types,
    defsById,
    getRawCell,
    applyWrite,
    cellRawValue,
  ])

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
          } else if (canWriteCell(selectedColumn)) {
            const coerced = selectedColumn.def ? coerceCellInput(selectedColumn.def, value) : value
            updateTask(applyWrite(selectedTask, selectedColumn, coerced))
          }
        }}
      />

      <div className="sheet-grid-host">
        <div className="overflow-auto border rounded-md max-h-[70vh] bg-background">
        <table className="sheet-grid border-collapse text-sm">
          <thead className="sticky top-0 z-20">
            <tr>
              <Th className="sheet-th-gutter" style={{ width: CHECKBOX_W, minWidth: CHECKBOX_W, maxWidth: CHECKBOX_W, position: "sticky", left: 0, zIndex: 22 }}>
                #
              </Th>
              <SortableTh
                label={nameLabel}
                letter={columnToLetters(0)}
                width={widthOf(NAME_COLUMN_ID)}
                dir={sortDirFor(sort, NAME_COLUMN_ID)}
                active={selectedColumn?.id === NAME_COLUMN_ID}
                frozen
                left={CHECKBOX_W}
                onSort={(additive) => onSortColumn(NAME_COLUMN_ID, additive)}
                onResize={(w) => onResizeColumn(NAME_COLUMN_ID, w)}
                onInsertLeft={enableAddColumn ? () => openAddColumn(0) : undefined}
                onInsertRight={enableAddColumn ? () => openAddColumn(0) : undefined}
                attributeSettings={attributeSettingsForColumn(nameColumn(nameLabel))}
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
                    active={selectedColumn?.id === col.id}
                    frozen={frozen}
                    left={frozen ? frozenLeftFor(i) : undefined}
                    onSort={(additive) => onSortColumn(col.id, additive)}
                    onResize={(w) => onResizeColumn(col.id, w)}
                    onHide={() => hideColumn(col.id)}
                    onInsertLeft={enableAddColumn ? () => openAddColumn(i) : undefined}
                    onInsertRight={enableAddColumn ? () => openAddColumn(i + 1) : undefined}
                    onMoveLeft={i > 0 ? () => patchConfig({ columnIds: moveColumnId(extraIds, col.id, i - 1) }) : undefined}
                    onMoveRight={
                      i < attrColumns.length - 1
                        ? () => patchConfig({ columnIds: moveColumnId(extraIds, col.id, i + 1) })
                        : undefined
                    }
                    attributeSettings={attributeSettingsForColumn(col)}
                    onAttributeSettings={() => openAttributeSettings(col)}
                  />
                )
              })}
              {enableAddColumn && categoryId && (
                <th className="sheet-th sheet-th-add-spacer" aria-hidden />
              )}
            </tr>
          </thead>
          <tbody>
            {displayTasks.map((task, rowIdx) => {
              const rowSelected = !!selectMode && !!selectedTaskIds?.includes(task.id)
              return (
              <tr
                key={task.id}
                className={`hover:bg-muted/40 group${rowSelected ? " bg-muted/60" : ""}`}
                style={{ height: rowHeightOf(task.id) }}
              >
                <td
                  className="border-b text-center bg-background group-hover:bg-muted/40 relative select-none"
                  style={{ position: "sticky", left: 0, zIndex: 1 }}
                >
                  <div className="flex items-center justify-center gap-1">
                    {selectMode && (
                      <input
                        type="checkbox"
                        checked={rowSelected}
                        aria-label={`Select ${task.description}`}
                        onChange={() => onToggleTaskSelect?.(task.id)}
                      />
                    )}
                    <span className="text-[10px] text-muted-foreground tabular-nums">{rowIdx + 1}</span>
                    <input
                      type="checkbox"
                      checked={!!task.completed}
                      aria-label={`Complete ${task.description}`}
                      onChange={() => updateTask(withCompleted(task, !task.completed))}
                    />
                  </div>
                  <RowResizeHandle height={rowHeightOf(task.id)} onResize={(h) => onResizeRow(task.id, h)} />
                </td>
                <td
                  className={cellClass(selRange, active, fillPreview, 0, rowIdx, "border-b border-r px-2 py-0.5 bg-background group-hover:bg-muted/40 relative")}
                  style={{ position: "sticky", left: CHECKBOX_W, width: widthOf(NAME_COLUMN_ID), minWidth: widthOf(NAME_COLUMN_ID), maxWidth: widthOf(NAME_COLUMN_ID), zIndex: 1 }}
                  onMouseDown={(e) => onCellMouseDown(0, rowIdx, e)}
                  onMouseOver={() => onCellEnter(0, rowIdx)}
                  onDoubleClick={() => onCellDoubleClick(0, rowIdx)}
                >
                  <NameCell
                    value={task.description}
                    editing={!!editingCell && editingCell.col === 0 && editingCell.row === rowIdx}
                    seed={editingCell?.col === 0 && editingCell.row === rowIdx ? editingCell.seed : undefined}
                    onCommit={(v) => setName(task, v)}
                    onEndEdit={() => setEditingCell(null)}
                    onNavigate={navigateFromEdit}
                    onOpen={() => onOpenItem?.(task.id)}
                  />
                  {isActiveCorner(selRange, 0, rowIdx) && <FillHandle onStart={startFill} />}
                </td>
                {attrColumns.map((col, i) => {
                  const frozen = isAttrFrozen(i)
                  const def = col.def
                  const gridCol = i + 1
                  const rawVal = cellRawValue(task, col)
                  const evaluated =
                    def && !isFormulaDef(def) && isCellFormula(rawVal) ? evaluateCellAt(gridCol, rowIdx, getRawCell) : undefined
                  const numeric = def ? isNumericAttribute(def) : col.type === "number"
                  return (
                    <td
                      key={col.id}
                      className={cellClass(
                        selRange,
                        active,
                        fillPreview,
                        gridCol,
                        rowIdx,
                        `border-b border-l px-1 py-0.5 align-top relative ${frozen ? "bg-background group-hover:bg-muted/40" : ""}${numeric ? " text-right tabular-nums" : ""}`,
                      )}
                      style={{
                        width: widthOf(col.id),
                        minWidth: widthOf(col.id),
                        maxWidth: widthOf(col.id),
                        ...(frozen ? { position: "sticky", left: frozenLeftFor(i), zIndex: 1 } : {}),
                      }}
                      onMouseDown={(e) => onCellMouseDown(gridCol, rowIdx, e)}
                      onMouseOver={() => onCellEnter(gridCol, rowIdx)}
                      onDoubleClick={() => onCellDoubleClick(gridCol, rowIdx)}
                    >
                      {def ? (
                        <SheetCell
                          def={def}
                          value={rawVal}
                          evaluated={evaluated}
                          attributes={task.attributes}
                          defsById={defsById}
                          editing={!!editingCell && editingCell.col === gridCol && editingCell.row === rowIdx}
                          seed={editingCell?.col === gridCol && editingCell.row === rowIdx ? editingCell.seed : undefined}
                          onCommit={(v) => updateTask(applyWrite(task, col, v))}
                          onEndEdit={() => setEditingCell(null)}
                          onNavigate={navigateFromEdit}
                          onOpen={() => onOpenItem?.(task.id)}
                        />
                      ) : (
                        <span className="block truncate px-1 text-muted-foreground">—</span>
                      )}
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
        {enableAddColumn && categoryId && (
          <button
            type="button"
            className="sheet-add-column"
            title="Add column"
            aria-label="Add a column"
            onClick={() => openAddColumn()}
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
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

      <AttributeSettingsDialog
        def={settingsDef}
        onClose={() => setSettingsDef(null)}
        onChange={applyAttributeSettings}
      />

      {addColOpen && category && (
        <AddColumnDialog
          category={category}
          candidates={catalog}
          visibleIds={extraIds}
          onClose={() => setAddColOpen(false)}
          onPickExisting={(candidate, assignToAll) => {
            applyAddedColumn(candidate.id, candidate.def, {
              assignToAll,
              isBuiltin: candidate.source === "builtin",
              created: false,
            })
          }}
          onCreate={(def) => {
            applyAddedColumn(def.id, def, { assignToAll: true, isBuiltin: false, created: true })
          }}
        />
      )}
    </div>
  )
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
 * Coerce is imported from `lib/spreadsheet-contract` (`coerceCellInput`) so paste,
 * the formula bar, and inline editors share one rule.
 */

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
    if (selectedColumn.builtin) {
      const v = readBuiltinField(selectedTask, selectedColumn.builtin as BuiltinFieldKey)
      if (v === undefined || v === null) return ""
      return Array.isArray(v) ? v.join(", ") : String(v)
    }
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
    <th className={`sheet-th ${className}`.trim()} style={style}>
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
  active,
  frozen,
  left,
  onSort,
  onResize,
  onHide,
  onInsertLeft,
  onInsertRight,
  onMoveLeft,
  onMoveRight,
  attributeSettings,
  onAttributeSettings,
}: {
  label: string
  letter?: string
  unit?: string
  width: number
  dir?: "asc" | "desc"
  active?: boolean
  frozen?: boolean
  left?: number
  onSort: (additive: boolean) => void
  onResize: (width: number) => void
  onHide?: () => void
  onInsertLeft?: () => void
  onInsertRight?: () => void
  onMoveLeft?: () => void
  onMoveRight?: () => void
  attributeSettings?: ReturnType<typeof attributeSettingsForColumn>
  onAttributeSettings?: () => void
}) {
  const style: React.CSSProperties = {
    width,
    minWidth: width,
    maxWidth: width,
    position: frozen ? "sticky" : "relative",
    left: frozen ? left : undefined,
    zIndex: frozen ? 21 : undefined,
  }
  const settingsUnavailable = attributeSettings?.kind === "unavailable" ? attributeSettings.reason : undefined
  const canOpenSettings = attributeSettings?.kind === "attribute" && !!onAttributeSettings
  const hasMenu =
    !!onHide ||
    !!onInsertLeft ||
    !!onInsertRight ||
    !!onMoveLeft ||
    !!onMoveRight ||
    !!attributeSettings
  const ariaSort = dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"
  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={`sheet-th${active ? " sheet-th-active" : ""}`}
      style={style}
    >
      {letter ? <div className="sheet-th-letter">{letter}</div> : null}
      <div className="sheet-th-main">
        <div className="sheet-th-slot sheet-th-slot-start">
          {hasMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="p-0.5 text-muted-foreground hover:text-foreground"
                  aria-label={`${label} column menu`}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="text-xs">
                <DropdownMenuItem onClick={() => onSort(false)}>Sort</DropdownMenuItem>
                {attributeSettings && (
                  <DropdownMenuItem
                    disabled={!canOpenSettings}
                    title={settingsUnavailable}
                    onClick={canOpenSettings ? onAttributeSettings : undefined}
                  >
                    Attribute settings
                  </DropdownMenuItem>
                )}
                {onInsertLeft && <DropdownMenuItem onClick={onInsertLeft}>Insert left</DropdownMenuItem>}
                {onInsertRight && <DropdownMenuItem onClick={onInsertRight}>Insert right</DropdownMenuItem>}
                {onMoveLeft && <DropdownMenuItem onClick={onMoveLeft}>Move left</DropdownMenuItem>}
                {onMoveRight && <DropdownMenuItem onClick={onMoveRight}>Move right</DropdownMenuItem>}
                {onHide && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onHide}>Hide column</DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <button
          type="button"
          className="sheet-th-sort"
          onClick={(e) => onSort(e.shiftKey)}
          title="Sort (shift-click to add)"
          aria-label={`Sort ${label}`}
        >
          <span className="sheet-th-label">{label}</span>
          {unit ? <span className="sheet-th-unit">({unit})</span> : null}
        </button>
        <div className="sheet-th-slot sheet-th-slot-end" aria-hidden={!dir}>
          {dir === "asc" && <ArrowUp className="sheet-th-caret" />}
          {dir === "desc" && <ArrowDown className="sheet-th-caret" />}
        </div>
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
      className="sheet-col-resize"
    />
  )
}

function NameCell({
  value,
  editing,
  seed,
  onCommit,
  onEndEdit,
  onNavigate,
  onOpen,
}: {
  value: string
  editing: boolean
  seed?: string
  onCommit: (v: string) => void
  onEndEdit: () => void
  onNavigate?: (key: "Enter" | "Tab", shift: boolean) => void
  onOpen: () => void
}) {
  const [draft, setDraft] = useState(value)
  const cancelled = useRef(false)
  useEffect(() => {
    if (editing) {
      cancelled.current = false
      setDraft(seed ?? value)
    }
  }, [editing, value, seed])

  if (editing) {
    return (
      <input
        autoFocus
        className="w-full bg-transparent outline-none border-b border-primary"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (!cancelled.current && draft !== value) onCommit(draft)
          onEndEdit()
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault()
            const key = e.key === "Tab" ? "Tab" : "Enter"
            const shift = e.shiftKey
            ;(e.target as HTMLInputElement).blur()
            onNavigate?.(key, shift)
          }
          if (e.key === "Escape") {
            cancelled.current = true
            setDraft(value)
            onEndEdit()
          }
        }}
      />
    )
  }
  return (
    <div className="flex items-center justify-between gap-1">
      <span className="truncate cursor-cell flex-1 select-none" title={value || undefined}>
        {value || <span className="text-muted-foreground">Untitled</span>}
      </span>
      <button
        className="opacity-0 group-hover:opacity-100 text-xs text-primary hover:underline"
        onClick={(e) => {
          e.stopPropagation()
          onOpen()
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
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
  editing,
  seed,
  onCommit,
  onEndEdit,
  onNavigate,
  onOpen,
}: {
  def: AttributeDefinition
  value: AttributeValue
  /** Set when `value` is a per-cell `=` formula: its computed result for display. */
  evaluated?: FormulaResult
  attributes?: Record<string, AttributeValue>
  defsById?: DefLookup
  editing: boolean
  seed?: string
  onCommit: (v: AttributeValue) => void
  onEndEdit: () => void
  onNavigate?: (key: "Enter" | "Tab", shift: boolean) => void
  onOpen: () => void
}) {
  const type = normalizeAttributeType(def.type)

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
      <span
        className={`block text-left w-full truncate min-h-[24px] px-1 select-none ${evaluated.error ? "text-destructive" : ""}`}
        title={typeof value === "string" ? value : undefined}
      >
        {formatCellResult(evaluated) || <span className="text-muted-foreground">—</span>}
      </span>
    )
  }

  if (type === "boolean") {
    return (
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onCommit(e.target.checked)}
        onMouseDown={(e) => e.stopPropagation()}
        className="ml-1"
      />
    )
  }

  if (!INLINE_TYPES.has(type)) {
    // Complex type — show formatted value; clicking opens the item to edit.
    return (
      <button
        className="text-left w-full truncate hover:underline"
        onClick={(e) => {
          e.stopPropagation()
          onOpen()
        }}
        onMouseDown={(e) => e.stopPropagation()}
        title="Open to edit"
      >
        {formatAttributeValue(def, value) || <span className="text-muted-foreground">—</span>}
      </button>
    )
  }

  if (editing) {
    return (
      <InlineEditor
        def={def}
        value={value}
        seed={seed}
        onCommit={(v) => {
          onCommit(v)
          onEndEdit()
        }}
        onCancel={onEndEdit}
        onNavigate={onNavigate}
      />
    )
  }

  const shown = formatAttributeValue(def, value)
  return (
    <span
      className="block text-left w-full truncate min-h-[24px] px-1 select-none cursor-cell"
      title={shown || undefined}
    >
      {shown || <span className="text-muted-foreground">—</span>}
    </span>
  )
}

function InlineEditor({
  def,
  value,
  seed,
  onCommit,
  onCancel,
  onNavigate,
}: {
  def: AttributeDefinition
  value: AttributeValue
  seed?: string
  onCommit: (v: AttributeValue) => void
  onCancel: () => void
  onNavigate?: (key: "Enter" | "Tab", shift: boolean) => void
}) {
  const type = normalizeAttributeType(def.type)
  const [draft, setDraft] = useState<AttributeValue>(seed ?? value)
  const cancelled = useRef(false)

  const commit = () => {
    if (!cancelled.current) onCommit(draft)
  }
  const finishKey = (e: React.KeyboardEvent, key: "Enter" | "Tab") => {
    e.preventDefault()
    ;(e.target as HTMLInputElement).blur()
    onNavigate?.(key, e.shiftKey)
  }

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
          if (e.key === "Enter" || e.key === "Tab") finishKey(e, e.key === "Tab" ? "Tab" : "Enter")
          if (e.key === "Escape") {
            cancelled.current = true
            onCancel()
          }
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
      onBlur={() => {
        if (!cancelled.current) onCommit(coerceCellInput(def, String(draft ?? "")))
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "Tab") finishKey(e, e.key === "Tab" ? "Tab" : "Enter")
        if (e.key === "Escape") {
          cancelled.current = true
          onCancel()
        }
      }}
    />
  )
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

