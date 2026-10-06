/**
 * components/Lists/dialogs/SpreadsheetViewSettings.tsx — Spreadsheet column picker
 *
 * Nested under List Settings → View mode settings. Offers every attribute in
 * the vault, starting with those found on this list (search + "On this list"
 * filter). Chosen columns persist on `List.sheetConfig.columnIds` for this list
 * only. Unchecking hides the column; it does not destroy the attribute.
 */
"use client"

import { useMemo } from "react"
import type { List } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { useItemTypeStore } from "@/lib/item-type-store"
import {
  buildSpreadsheetCatalog,
  hideColumnId,
  insertColumnId,
  resolveColumnIds,
  type SheetColumnCandidate,
} from "@/lib/spreadsheet-catalog"
import { ColumnPickerPanel } from "./ColumnPickerPanel"

export function SpreadsheetViewSettings({
  list,
  onChange,
}: {
  list: List
  onChange: (list: List) => void
}) {
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
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

  const visibleIds = resolveColumnIds(list.sheetConfig, catalog, list, types)

  const patchColumns = (columnIds: string[]) => {
    onChange({
      ...list,
      sheetConfig: { ...list.sheetConfig, columnIds },
    })
  }

  const toggle = (candidate: SheetColumnCandidate, on: boolean) => {
    const current = resolveColumnIds(list.sheetConfig, catalog, list, types)
    patchColumns(on ? insertColumnId(current, candidate.id) : hideColumnId(current, candidate.id))
  }

  return (
    <ColumnPickerPanel
      title="Spreadsheet view mode settings"
      description="Columns for this list only. Uncheck to hide — the attribute stays in the vault."
      searchAriaLabel="Search spreadsheet columns"
      onThisListAriaLabel="On this list"
      catalog={catalog}
      visibleIds={visibleIds}
      onToggle={toggle}
    />
  )
}
