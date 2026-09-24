/**
 * components/Lists/list-content/ListContentSpreadsheet.tsx — Spreadsheet display
 *
 * The Lists "Spreadsheet" display mode: a Google-Sheets-style editable grid of a
 * list's items × their attribute columns (see `components/spreadsheet/SheetGrid`).
 * Column choice, sort, filter, freeze, and widths persist per list on
 * `List.sheetConfig`. Widths live at `sheetConfig.columnWidths` (columnId → px)
 * and survive reload, leaving the sheet, and switching lists.
 *
 * Optional **Fullscreen** (□ above the formula bar) lifts this same `SheetGrid`
 * instance into a near-viewport Win95 child window. See `SPREADSHEET.md`.
 */
"use client"

import { useCallback, useRef } from "react"
import { SheetGrid } from "@/components/spreadsheet/SheetGrid"
import { persistSheetViewConfig, type SheetViewConfig } from "@/lib/spreadsheet-contract"
import { useTaskStore } from "@/lib/task-store"
import { SheetFullscreenShell } from "./SheetFullscreen"
import type { ListContentDetailsProps } from "./types"

export type { ListContentDetailsProps } from "./types"

export function ListContentSpreadsheet({
  tasks,
  openCategory,
  itemLabel,
  onTaskSelect,
  selectMode,
  selectedTaskIds,
  onToggleTaskSelect,
  viewConfig,
  onViewConfigChange,
}: ListContentDetailsProps & {
  itemLabel?: string
  /** Optional sort/filter/freeze/width state; omit to use this list's `sheetConfig`. */
  viewConfig?: SheetViewConfig
  onViewConfigChange?: (config: SheetViewConfig) => void
}) {
  const updateList = useTaskStore((s) => s.updateList)
  const listRef = useRef(openCategory)
  listRef.current = openCategory

  const persist = useCallback(
    (config: SheetViewConfig) => {
      onViewConfigChange?.(config)
      const list = listRef.current
      if (!list) return
      const current = useTaskStore.getState().lists.find((l) => l.id === list.id) ?? list
      const sheetConfig = persistSheetViewConfig(current.sheetConfig, config)
      if (current.sheetConfig === sheetConfig) return
      updateList({ ...current, sheetConfig })
    },
    [onViewConfigChange, updateList],
  )

  const title = `${openCategory?.name ?? "List"} — Spreadsheet`
  return (
    <SheetFullscreenShell title={title}>
      <SheetGrid
        key={openCategory?.id ?? "sheet"}
        categoryId={openCategory?.id}
        tasks={tasks}
        onOpenItem={onTaskSelect}
        newItemLabel={itemLabel || "item"}
        enableAddRow={!!openCategory && !selectMode}
        className="p-1"
        viewConfig={viewConfig ?? openCategory?.sheetConfig}
        onViewConfigChange={persist}
        selectMode={selectMode}
        selectedTaskIds={selectedTaskIds}
        onToggleTaskSelect={onToggleTaskSelect}
      />
    </SheetFullscreenShell>
  )
}
