/**
 * components/Lists/dialogs/DefaultViewSettings.tsx — Default reading-row chrome
 *
 * Nested under List Settings → View mode settings. Use default layout keeps
 * the built-in Default row. Custom lets this list hide/show chrome and pick
 * extra attributes as compact meta (search + on-this-list first). Persist on
 * `List.defaultView`. Independent of Details and Spreadsheet columns.
 */
"use client"

import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import type { List } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { useItemTypeStore } from "@/lib/item-type-store"
import {
  DEFAULT_VIEW_CHROME_LABELS,
  buildDefaultViewAttrCatalog,
  filterDefaultViewAttrCatalog,
  isCustomDefaultView,
  resolveDefaultViewDensity,
  resolveDefaultViewExtraAttributeIds,
  resolveDefaultViewShow,
  sanitizeListDefaultView,
  setDefaultViewDensity,
  setDefaultViewLayoutMode,
  toggleDefaultViewChrome,
  toggleDefaultViewExtraAttribute,
} from "@/lib/default-view-prefs"
import { DEFAULT_VIEW_CHROME_KEYS } from "@/lib/types"

export function DefaultViewSettings({
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

  const prefs = sanitizeListDefaultView(list.defaultView)
  const custom = isCustomDefaultView(prefs)
  const show = resolveDefaultViewShow(prefs)
  const density = resolveDefaultViewDensity(prefs)
  const extraIds = new Set(resolveDefaultViewExtraAttributeIds(prefs))

  const listItems = useMemo(
    () => tasks.filter((t) => t.lists?.includes(list.id)),
    [tasks, list.id],
  )
  const catalog = useMemo(
    () => buildDefaultViewAttrCatalog({ list, types, listItems, vaultLists: lists }),
    [list, types, listItems, lists],
  )
  const shown = filterDefaultViewAttrCatalog(catalog, { query, onThisListOnly })
  const onListCount = catalog.filter((c) => c.onThisList).length

  const patch = (defaultView: ReturnType<typeof sanitizeListDefaultView>) => {
    onChange({ ...list, defaultView })
  }

  return (
    <div className="space-y-2 rounded-md border p-2" data-testid="default-view-settings">
      <p className="text-sm font-medium">Default view mode settings</p>
      <p className="text-xs text-muted-foreground">
        What this list shows on Default reading rows. Unset lists keep the built-in
        layout. Independent of Details and Spreadsheet columns.
      </p>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="radio"
          name={`default-layout-${list.id}`}
          checked={!custom}
          onChange={() => patch(setDefaultViewLayoutMode(prefs, false))}
          aria-label="Use default layout"
        />
        Use default layout
      </label>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="radio"
          name={`default-layout-${list.id}`}
          checked={custom}
          onChange={() => patch(setDefaultViewLayoutMode(prefs, true))}
          aria-label="Customize this list"
        />
        Customize this list
      </label>

      {custom ? (
        <>
          <p className="text-xs text-muted-foreground pt-1">Show on each row</p>
          {DEFAULT_VIEW_CHROME_KEYS.map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={show[key]}
                onChange={() => patch(toggleDefaultViewChrome(prefs, key, !show[key]))}
                aria-label={DEFAULT_VIEW_CHROME_LABELS[key]}
              />
              {DEFAULT_VIEW_CHROME_LABELS[key]}
            </label>
          ))}

          <p className="text-xs text-muted-foreground pt-1">Extra attributes (compact meta)</p>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search attributes…"
            aria-label="Search default-view attributes"
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
          <div className="max-h-36 overflow-auto space-y-1 rounded border p-1">
            {shown.length === 0 ? (
              <p className="text-xs text-muted-foreground px-1 py-2">No attributes match.</p>
            ) : (
              shown.map((c) => {
                const on = extraIds.has(c.id)
                return (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 text-sm cursor-pointer rounded px-1 py-0.5 hover:bg-muted/60"
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => patch(toggleDefaultViewExtraAttribute(prefs, c.id, !on))}
                      aria-label={`${c.name} meta`}
                    />
                    <span className="truncate flex-1">{c.name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {c.onThisList ? "On this list" : "Vault"}
                    </span>
                  </label>
                )
              })
            )}
          </div>

          <p className="text-xs text-muted-foreground pt-1">Density</p>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name={`default-density-${list.id}`}
              checked={density === "comfortable"}
              onChange={() => patch(setDefaultViewDensity(prefs, "comfortable"))}
              aria-label="Comfortable"
            />
            Comfortable
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name={`default-density-${list.id}`}
              checked={density === "compact"}
              onChange={() => patch(setDefaultViewDensity(prefs, "compact"))}
              aria-label="Compact"
            />
            Compact
          </label>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Pip, icon, name, type, U·I, date, and attribute chips. Name always stays.
        </p>
      )}
    </div>
  )
}
