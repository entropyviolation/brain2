/**
 * components/Lists/list-picker.tsx — Folder-aware list selector
 *
 * Used in Inbox clarification, item detail, and list select-mode placement.
 * Supports nested folder navigation, search, optional multi-select, and creating
 * a new list inline.
 */
"use client"

import { useMemo, useState, useCallback } from "react"
import { useTaskStore } from "@/lib/task-store"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ChevronLeft, Folder as FolderIcon, List as ListIcon, Plus, Search } from "lucide-react"
import type { List } from "@/lib/types"

export interface ListPickerProps {
  selected: string[]
  onChange: (ids: string[]) => void
  mode?: "single" | "multi"
  /** When true, show a toggle to enable multi-select. */
  allowMultiToggle?: boolean
  /** Compact layout for attribute value fields and toolbars. */
  compact?: boolean
  /** Hide these list ids (current list, All Items, smart lists, …). */
  excludeIds?: string[]
  /** Inline “New list” row. Default true. */
  showCreate?: boolean
  /** `fm` skins the picker for the Lists file-manager chrome. */
  variant?: "default" | "fm"
}

export function ListPicker({
  selected,
  onChange,
  mode = "multi",
  allowMultiToggle = false,
  compact = false,
  excludeIds,
  showCreate = true,
  variant = "default",
}: ListPickerProps) {
  const categories = useTaskStore((s) => s.lists)
  const folders = useTaskStore((s) => s.folders)
  const addList = useTaskStore((s) => s.addList)
  const addListToFolder = useTaskStore((s) => s.addListToFolder)

  const [browseFolderId, setBrowseFolderId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [multiEnabled, setMultiEnabled] = useState(mode === "multi")
  const [creating, setCreating] = useState(false)
  const [newListName, setNewListName] = useState("")

  const effectiveMulti = allowMultiToggle ? multiEnabled : mode === "multi"
  const fm = variant === "fm"
  const excluded = useMemo(() => new Set(excludeIds ?? []), [excludeIds])
  const visibleLists = useMemo(
    () => categories.filter((c) => !excluded.has(c.id)),
    [categories, excluded],
  )

  const inFolder = browseFolderId ? folders.find((f) => f.id === browseFolderId) : null

  const childFolders = useMemo(
    () => folders.filter((f) => (browseFolderId ? f.parentFolderId === browseFolderId : !f.parentFolderId)),
    [folders, browseFolderId],
  )

  const listsInFolder = useMemo(() => {
    if (!browseFolderId) return []
    const folder = folders.find((f) => f.id === browseFolderId)
    if (!folder) return []
    return folder.listIds.map((id) => visibleLists.find((c) => c.id === id)).filter(Boolean) as List[]
  }, [browseFolderId, folders, visibleLists])

  const looseLists = useMemo(() => {
    const inAnyFolder = new Set<string>()
    folders.forEach((f) => f.listIds.forEach((id) => inAnyFolder.add(id)))
    return visibleLists.filter((c) => !inAnyFolder.has(c.id))
  }, [visibleLists, folders])

  const q = search.trim().toLowerCase()
  const searchActive = q.length > 0

  const searchResults = useMemo(() => {
    if (!searchActive) return []
    return visibleLists.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.description || "").toLowerCase().includes(q),
    )
  }, [visibleLists, q, searchActive])

  const toggle = useCallback(
    (id: string) => {
      if (effectiveMulti) {
        onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
      } else {
        onChange(selected.includes(id) ? [] : [id])
      }
    },
    [effectiveMulti, onChange, selected],
  )

  const handleCreateList = () => {
    const name = newListName.trim()
    if (!name) return
    const id = Date.now().toString()
    addList({
      id,
      name,
      color: "#3B82F6",
      description: "",
      createdAt: new Date(),
      order: categories.length,
      scheduleable: true,
    })
    if (browseFolderId) addListToFolder(browseFolderId, id)
    onChange(effectiveMulti ? [...selected, id] : [id])
    setNewListName("")
    setCreating(false)
  }

  const renderListRow = (cat: List) => {
    const on = selected.includes(cat.id)
    if (fm) {
      return (
        <button
          key={cat.id}
          type="button"
          className={`fm-picker-row${on ? " selected" : ""}`}
          onClick={() => toggle(cat.id)}
        >
          {effectiveMulti && (
            <input type="checkbox" checked={on} readOnly aria-label={`Add to ${cat.name}`} tabIndex={-1} />
          )}
          <span className="fm-picker-swatch" style={{ background: cat.color }} />
          <span className="truncate">{cat.name}</span>
        </button>
      )
    }
    return (
      <button
        key={cat.id}
        type="button"
        className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm rounded hover:bg-muted/60${on ? " bg-muted" : ""}`}
        onClick={() => toggle(cat.id)}
      >
        {effectiveMulti && <Checkbox checked={on} className="pointer-events-none" />}
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cat.color }} />
        <ListIcon className="h-3.5 w-3.5 shrink-0 opacity-60" />
        <span className="truncate">{cat.name}</span>
      </button>
    )
  }

  const renderFolderRow = (f: (typeof folders)[number]) =>
    fm ? (
      <button key={f.id} type="button" className="fm-picker-row" onClick={() => setBrowseFolderId(f.id)}>
        <span className="fm-picker-swatch" style={{ background: f.color || "#808080" }} />
        <span className="truncate">{f.name}</span>
      </button>
    ) : (
      <button
        key={f.id}
        type="button"
        className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm rounded hover:bg-muted/60"
        onClick={() => setBrowseFolderId(f.id)}
      >
        <FolderIcon className="h-3.5 w-3.5 shrink-0" style={{ color: f.color }} />
        <span className="truncate">{f.name}</span>
      </button>
    )

  const body = searchActive ? (
    searchResults.length === 0 ? (
      <p className={fm ? "fm-picker-empty" : "text-xs text-muted-foreground p-2"}>No lists match.</p>
    ) : (
      searchResults.map(renderListRow)
    )
  ) : browseFolderId && inFolder ? (
    <>
      <p className={fm ? "fm-picker-section" : "text-xs font-medium px-2 py-1 text-muted-foreground"}>{inFolder.name}</p>
      {childFolders.map(renderFolderRow)}
      {listsInFolder.map(renderListRow)}
      {childFolders.length === 0 && listsInFolder.length === 0 && (
        <p className={fm ? "fm-picker-empty" : "text-xs text-muted-foreground p-2"}>Empty folder.</p>
      )}
    </>
  ) : (
    <>
      {childFolders.map(renderFolderRow)}
      {looseLists.map(renderListRow)}
    </>
  )

  if (fm) {
    return (
      <div className="fm-list-picker">
        <div className="fm-list-picker-head">
          {browseFolderId && !searchActive && (
            <button type="button" className="fm-btn fm-btn-sm" aria-label="Back" onClick={() => setBrowseFolderId(null)}>
              ←
            </button>
          )}
          <input
            className="fm-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search lists…"
            aria-label="Search lists"
            style={{ flex: 1, minWidth: 0, width: "100%" }}
          />
        </div>
        <div className="fm-list-picker-body">{body}</div>
        {showCreate && (
          <div className="fm-list-picker-foot">
            {creating ? (
              <div style={{ display: "flex", gap: 4 }}>
                <input
                  className="fm-input"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="New list name"
                  onKeyDown={(e) => e.key === "Enter" && handleCreateList()}
                  style={{ flex: 1, minWidth: 0 }}
                />
                <button type="button" className="fm-btn fm-btn-sm" onClick={handleCreateList}>
                  Create
                </button>
                <button type="button" className="fm-btn fm-btn-sm" onClick={() => setCreating(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button type="button" className="fm-btn fm-btn-sm" onClick={() => setCreating(true)}>
                New list
              </button>
            )}
          </div>
        )}
        {selected.length > 0 && (
          <div className="fm-picker-section">{selected.length} list{selected.length === 1 ? "" : "s"} checked</div>
        )}
      </div>
    )
  }

  return (
    <div className={`border rounded-md ${compact ? "text-sm" : ""}`}>
      <div className="flex items-center gap-2 p-2 border-b bg-muted/30">
        {browseFolderId && !searchActive && (
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setBrowseFolderId(null)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search lists…"
            className="h-8 pl-8"
          />
        </div>
        {allowMultiToggle && (
          <label className="flex items-center gap-1 text-xs whitespace-nowrap shrink-0">
            <Checkbox checked={multiEnabled} onCheckedChange={(c) => setMultiEnabled(!!c)} />
            Multi
          </label>
        )}
      </div>

      <div className={`overflow-y-auto p-1 ${compact ? "max-h-40" : "max-h-56"}`}>{body}</div>

      {showCreate && (
        <div className="p-2 border-t">
          {creating ? (
            <div className="flex gap-1">
              <Input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="New list name"
                className="h-8"
                onKeyDown={(e) => e.key === "Enter" && handleCreateList()}
              />
              <Button size="sm" className="h-8" onClick={handleCreateList}>
                Create
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="w-full h-8" onClick={() => setCreating(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              New list
            </Button>
          )}
        </div>
      )}

      {selected.length > 0 && !compact && (
        <div className="px-2 pb-2">
          <Label className="text-[10px] text-muted-foreground">Selected ({selected.length})</Label>
        </div>
      )}
    </div>
  )
}
