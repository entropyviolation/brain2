/**
 * components/Lists/list-content/ListContentSpreadsheet.tsx — Spreadsheet display
 *
 * The Lists "Spreadsheet" display mode: a Google-Sheets-style editable grid of a
 * list's items × their attribute columns (see `components/spreadsheet/SheetGrid`).
 * Inline cell editing, column totals, add-row, and add-column. A thin wrapper that
 * binds the opened category + visible tasks to the reusable grid.
 */
"use client"

import { SheetGrid } from "@/components/spreadsheet/SheetGrid"
import type { SheetViewConfig } from "@/lib/spreadsheet-contract"
import type { ListContentDetailsProps } from "./types"

export type { ListContentDetailsProps } from "./types"

export function ListContentSpreadsheet({
  tasks,
  openCategory,
  itemLabel,
  onTaskSelect,
  viewConfig,
  onViewConfigChange,
}: ListContentDetailsProps & {
  itemLabel?: string
  /** Optional sort/filter/freeze/width state; omit for default v1 behavior. */
  viewConfig?: SheetViewConfig
  onViewConfigChange?: (config: SheetViewConfig) => void
}) {
  return (
    <SheetGrid
      categoryId={openCategory?.id}
      tasks={tasks}
      onOpenItem={onTaskSelect}
      newItemLabel={itemLabel || "item"}
      enableAddRow={!!openCategory}
      className="p-1"
      viewConfig={viewConfig}
      onViewConfigChange={onViewConfigChange}
    />
  )
}
