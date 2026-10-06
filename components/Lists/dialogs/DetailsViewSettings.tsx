/**
 * components/Lists/dialogs/DetailsViewSettings.tsx — Details column picker
 *
 * Nested under List Settings → View mode settings. Same catalog as Spreadsheet
 * (on-this-list first, searchable, vault attrs + built-ins). Chosen columns
 * persist on `List.detailsColumns` for this list only — never
 * `sheetConfig.columnIds`. Unchecking hides the column; it does not destroy
 * the attribute or change Spreadsheet.
 */
"use client"

import { useMemo } from "react"
import type { List } from "@/lib/types"
import { listIsNextActions } from "@/lib/item-utils"
import { useTaskStore } from "@/lib/task-store"
import { useItemTypeStore } from "@/lib/item-type-store"
import { buildSpreadsheetCatalog, type SheetColumnCandidate } from "@/lib/spreadsheet-catalog"
import {
  hideColumnId,
  insertColumnId,
  moveColumnId,
  resolveDetailsColumnIds,
} from "@/lib/details-columns"
import { ColumnPickerPanel } from "./ColumnPickerPanel"

export function DetailsViewSettings({
  list,
  onChange,
}: {
  list: List
  onChange: (list: List) => void
}) {
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const folders = useTaskStore((s) => s.folders)
  const types = useItemTypeStore((s) => s.types)

  const listItems = useMemo(
    () => tasks.filter((t) => t.lists?.includes(list.id)),
    [tasks, list.id],
  )

  const catalog = useMemo(
    () =>
      buildSpreadsheetCatalog({
        list,
        lists,
        types,
        listItems,
        vaultItems: tasks,
      }),
    [list, lists, types, listItems, tasks],
  )

  const nextActions = listIsNextActions(list.id, folders)
  const visibleIds = resolveDetailsColumnIds(list.detailsColumns, catalog, list, types, { nextActions })

  const patchColumns = (detailsColumns: string[]) => {
    onChange({
      ...list,
      detailsColumns,
    })
  }

  const toggle = (candidate: SheetColumnCandidate, on: boolean) => {
    const current = resolveDetailsColumnIds(list.detailsColumns, catalog, list, types, { nextActions })
    patchColumns(on ? insertColumnId(current, candidate.id) : hideColumnId(current, candidate.id))
  }

  const move = (id: string, dir: -1 | 1) => {
    const current = resolveDetailsColumnIds(list.detailsColumns, catalog, list, types, { nextActions })
    const from = current.indexOf(id)
    if (from < 0) return
    patchColumns(moveColumnId(current, id, from + dir))
  }

  return (
    <ColumnPickerPanel
      title="Details view mode settings"
      description="Columns for this list's Details table only. Name stays first. Uncheck to hide — the attribute stays, and Spreadsheet columns do not change."
      searchAriaLabel="Search details columns"
      onThisListAriaLabel="Details on this list"
      catalog={catalog}
      visibleIds={visibleIds}
      onToggle={toggle}
      allowReorder
      onMove={move}
    />
  )
}
