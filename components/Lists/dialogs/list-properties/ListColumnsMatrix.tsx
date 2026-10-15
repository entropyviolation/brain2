/**
 * components/Lists/dialogs/list-properties/ListColumnsMatrix.tsx — one column table
 *
 * Details and Spreadsheet share one catalog, so List Settings shows it once
 * with a checkbox column for each view. Persistence is exactly what the two
 * single pickers write: Details → `List.detailsColumns` (with reorder),
 * Spreadsheet → `List.sheetConfig.columnIds`. Unchecking hides a column; the
 * attribute stays. The old `DetailsViewSettings` / `SpreadsheetViewSettings`
 * remain for any caller that wants one view alone.
 */
"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import type { List } from "@/lib/types"
import { listIsNextActions } from "@/lib/item-utils"
import { useTaskStore } from "@/lib/task-store"
import { useItemTypeStore } from "@/lib/item-type-store"
import {
  buildSpreadsheetCatalog,
  filterCatalog,
  hideColumnId,
  insertColumnId,
  moveColumnId,
  resolveColumnIds,
  type SheetColumnCandidate,
} from "@/lib/spreadsheet-catalog"
import { resolveDetailsColumnIds } from "@/lib/details-columns"

export function ListColumnsMatrix({
  list,
  onChange,
  focus,
}: {
  list: List
  onChange: (list: List) => void
  /** Which view opened the table; its column is tinted. */
  focus: "table" | "spreadsheet"
}) {
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const folders = useTaskStore((s) => s.folders)
  const types = useItemTypeStore((s) => s.types)
  const [query, setQuery] = useState("")
  const [vaultOpen, setVaultOpen] = useState(false)

  const listItems = useMemo(() => tasks.filter((t) => t.lists?.includes(list.id)), [tasks, list.id])
  const catalog = useMemo(
    () => buildSpreadsheetCatalog({ list, lists, types, listItems, vaultItems: tasks }),
    [list, lists, types, listItems, tasks],
  )
  const nextActions = listIsNextActions(list.id, folders)
  const detailsIds = resolveDetailsColumnIds(list.detailsColumns, catalog, list, types, { nextActions })
  const sheetIds = resolveColumnIds(list.sheetConfig, catalog, list, types)
  const details = new Set(detailsIds)
  const sheet = new Set(sheetIds)

  const toggleDetails = (c: SheetColumnCandidate, on: boolean) =>
    onChange({ ...list, detailsColumns: on ? insertColumnId(detailsIds, c.id) : hideColumnId(detailsIds, c.id) })
  const toggleSheet = (c: SheetColumnCandidate, on: boolean) =>
    onChange({
      ...list,
      sheetConfig: { ...list.sheetConfig, columnIds: on ? insertColumnId(sheetIds, c.id) : hideColumnId(sheetIds, c.id) },
    })
  const moveDetails = (id: string, dir: -1 | 1) => {
    const from = detailsIds.indexOf(id)
    if (from < 0) return
    onChange({ ...list, detailsColumns: moveColumnId(detailsIds, id, from + dir) })
  }

  const shown = filterCatalog(catalog, { query })
  const onList = shown.filter((c) => c.onThisList)
  const vault = shown.filter((c) => !c.onThisList)
  const vaultVisible = vaultOpen || query.trim().length > 0

  const row = (c: SheetColumnCandidate) => {
    const dOn = details.has(c.id)
    const sOn = sheet.has(c.id)
    const order = detailsIds.indexOf(c.id)
    return (
      <tr key={c.id}>
        <td>
          <span className="lp-col-name">{c.name}</span>{" "}
          <span className="lp-col-meta">
            {c.onThisList ? "On this list" : "Vault"} · {c.type}
          </span>
        </td>
        <td className={`lp-col-check${focus === "table" ? " is-hot" : ""}`}>
          <span className="lp-col-cell">
            <input type="checkbox" checked={dOn} onChange={() => toggleDetails(c, !dOn)} aria-label={`${c.name} in Details`} />
            {dOn ? (
              <span className="lp-col-order">
                <button type="button" aria-label={`Move ${c.name} up`} disabled={order <= 0} onClick={() => moveDetails(c.id, -1)}>
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${c.name} down`}
                  disabled={order < 0 || order >= detailsIds.length - 1}
                  onClick={() => moveDetails(c.id, 1)}
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              </span>
            ) : null}
          </span>
        </td>
        <td className={`lp-col-check${focus === "spreadsheet" ? " is-hot" : ""}`}>
          <input type="checkbox" checked={sOn} onChange={() => toggleSheet(c, !sOn)} aria-label={`${c.name} in Spreadsheet`} />
        </td>
      </tr>
    )
  }

  return (
    <div className="lp-cols">
      <div className="lp-cols-bar">
        <input
          className="lp-field"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${catalog.length} attributes…`}
          aria-label={focus === "table" ? "Search details columns" : "Search spreadsheet columns"}
        />
        <span className="lp-caption">Name stays first. Unchecking hides a column; the attribute stays.</span>
      </div>
      <div className="lp-cols-well">
        <table className="lp-cols-table">
          <thead>
            <tr>
              <th>Attribute</th>
              <th className="lp-col-check">Details</th>
              <th className="lp-col-check">Spreadsheet</th>
            </tr>
          </thead>
          <tbody>
            <tr className="lp-cols-group">
              <td colSpan={3}>On this list · {onList.length}</td>
            </tr>
            {onList.map(row)}
            <tr className="lp-cols-group is-toggle">
              <td colSpan={3}>
                <button type="button" onClick={() => setVaultOpen((v) => !v)} aria-expanded={vaultVisible}>
                  {vaultVisible ? "▾" : "▸"} Vault · {vault.length}
                </button>
              </td>
            </tr>
            {vaultVisible ? vault.map(row) : null}
            {shown.length === 0 ? (
              <tr>
                <td colSpan={3} className="lp-caption">
                  No attributes match.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
