/**
 * Shared searchable column checklist for Details + Spreadsheet view settings.
 * Catalog build and persistence stay in the callers.
 */
"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Input } from "@/components/ui/input"
import { filterCatalog, type SheetColumnCandidate } from "@/lib/spreadsheet-catalog"

export interface ColumnPickerPanelProps {
  title: string
  description: string
  searchAriaLabel: string
  onThisListAriaLabel: string
  catalog: SheetColumnCandidate[]
  /** Resolved visible column ids (order matters when allowReorder). */
  visibleIds: string[]
  onToggle: (candidate: SheetColumnCandidate, on: boolean) => void
  /** Details-only: show up/down chevrons for checked columns. */
  allowReorder?: boolean
  onMove?: (id: string, dir: -1 | 1) => void
}

export function ColumnPickerPanel({
  title,
  description,
  searchAriaLabel,
  onThisListAriaLabel,
  catalog,
  visibleIds,
  onToggle,
  allowReorder = false,
  onMove,
}: ColumnPickerPanelProps) {
  const [query, setQuery] = useState("")
  const [onThisListOnly, setOnThisListOnly] = useState(false)

  const visible = new Set(visibleIds)
  const shown = filterCatalog(catalog, { query, onThisListOnly })
  const onListCount = catalog.filter((c) => c.onThisList).length

  return (
    <div className="space-y-2 rounded-md border p-2">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search attributes…"
        aria-label={searchAriaLabel}
        className="h-8"
      />
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={onThisListOnly}
          onChange={(e) => setOnThisListOnly(e.target.checked)}
          aria-label={onThisListAriaLabel}
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
                  onChange={() => onToggle(c, !on)}
                  aria-label={`${c.name} column`}
                />
                <span className="truncate flex-1">{c.name}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {c.onThisList ? "On this list" : "Vault"} · {c.type}
                </span>
                {allowReorder && on && onMove && (
                  <span className="flex shrink-0">
                    <button
                      type="button"
                      className="p-0.5 disabled:opacity-30"
                      aria-label={`Move ${c.name} up`}
                      disabled={order <= 0}
                      onClick={(e) => {
                        e.preventDefault()
                        onMove(c.id, -1)
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
                        onMove(c.id, 1)
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
