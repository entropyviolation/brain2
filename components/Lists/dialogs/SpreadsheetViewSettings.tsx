/**
 * components/Lists/dialogs/SpreadsheetViewSettings.tsx — Spreadsheet column picker
 *
 * Nested under List Settings → View mode settings. Offers every attribute in
 * the vault, starting with those found on this list (search + "On this list"
 * filter). Chosen columns persist on `List.sheetConfig.columnIds` for this list
 * only. Unchecking hides the column; it does not destroy the attribute.
 */
"use client"

import { useMemo, useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import type { List } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { useItemTypeStore } from "@/lib/item-type-store"
import {
  buildSpreadsheetCatalog,
  filterCatalog,
  hideColumnId,
  insertColumnId,
  resolveColumnIds,
  type SheetColumnCandidate,
} from "@/lib/spreadsheet-catalog"

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
  const [query, setQuery] = useState("")
  const [onThisListOnly, setOnThisListOnly] = useState(false)

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
  const visible = new Set(visibleIds)
  const shown = filterCatalog(catalog, { query, onThisListOnly })

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

  const onListCount = catalog.filter((c) => c.onThisList).length

  return (
    <div className="space-y-2 rounded-md border p-2">
      <p className="text-sm font-medium">Spreadsheet view mode settings</p>
      <p className="text-xs text-muted-foreground">
        Columns for this list only. Uncheck to hide — the attribute stays in the vault.
      </p>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search attributes…"
        aria-label="Search spreadsheet columns"
        className="h-8"
      />
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={onThisListOnly}
          onChange={(e) => setOnThisListOnly(e.target.checked)}
          aria-label="On this list"
        />
        On this list first ({onListCount})
      </label>
      <div className="max-h-48 overflow-auto space-y-1 rounded border p-1">
        {shown.length === 0 ? (
          <p className="text-xs text-muted-foreground px-1 py-2">No attributes match.</p>
        ) : (
          shown.map((c) => {
            const on = visible.has(c.id)
            return (
              <label
                key={c.id}
                className="flex items-center gap-2 text-sm cursor-pointer rounded px-1 py-0.5 hover:bg-muted/60"
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(c, !on)}
                  aria-label={`${c.name} column`}
                />
                <span className="truncate flex-1">{c.name}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {c.onThisList ? "On this list" : "Vault"} · {c.type}
                </span>
              </label>
            )
          })
        )}
      </div>
    </div>
  )
}
