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

import { useMemo, useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Input } from "@/components/ui/input"
import type { List } from "@/lib/types"
import { listIsNextActions } from "@/lib/item-utils"
import { useTaskStore } from "@/lib/task-store"
import { useItemTypeStore } from "@/lib/item-type-store"
import { buildSpreadsheetCatalog, type SheetColumnCandidate } from "@/lib/spreadsheet-catalog"
import {
  filterCatalog,
  hideColumnId,
  insertColumnId,
  moveColumnId,
  resolveDetailsColumnIds,
} from "@/lib/details-columns"

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

  const nextActions = listIsNextActions(list.id, folders)
  const visibleIds = resolveDetailsColumnIds(list.detailsColumns, catalog, list, types, { nextActions })
  const visible = new Set(visibleIds)
  const shown = filterCatalog(catalog, { query, onThisListOnly })

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

  const onListCount = catalog.filter((c) => c.onThisList).length

  return (
    <div className="space-y-2 rounded-md border p-2">
      <p className="text-sm font-medium">Details view mode settings</p>
      <p className="text-xs text-muted-foreground">
        Columns for this list&apos;s Details table only. Name stays first. Uncheck to
        hide — the attribute stays, and Spreadsheet columns do not change.
      </p>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search attributes…"
        aria-label="Search details columns"
        className="h-8"
      />
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={onThisListOnly}
          onChange={(e) => setOnThisListOnly(e.target.checked)}
          aria-label="Details on this list"
        />
        On this list first ({onListCount})
      </label>
      <div className="max-h-48 overflow-auto space-y-1 rounded border p-1">
        {shown.length === 0 ? (
          <p className="text-xs text-muted-foreground px-1 py-2">No attributes match.</p>
        ) : (
          shown.map((c) => {
            const on = visible.has(c.id)
            const order = visibleIds.indexOf(c.id)
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
                {on && (
                  <span className="flex shrink-0">
                    <button
                      type="button"
                      className="p-0.5 disabled:opacity-30"
                      aria-label={`Move ${c.name} up`}
                      disabled={order <= 0}
                      onClick={(e) => {
                        e.preventDefault()
                        move(c.id, -1)
                      }}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="p-0.5 disabled:opacity-30"
                      aria-label={`Move ${c.name} down`}
                      disabled={order < 0 || order >= visibleIds.length - 1}
                      onClick={(e) => {
                        e.preventDefault()
                        move(c.id, 1)
                      }}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </span>
                )}
              </label>
            )
          })
        )}
      </div>
    </div>
  )
}
