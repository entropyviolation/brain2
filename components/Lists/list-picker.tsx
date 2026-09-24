/**
 * components/Lists/list-picker.tsx — Folder-aware list selector
 *
 * Used in Inbox clarification, item detail, Connected lists, and list
 * select-mode placement. Nested folder navigation, search, optional
 * multi-select, selected chips, optional Recent `suggestedIds`, and
 * creating a new list inline.
 */
"use client"

import { useMemo, useState, useCallback } from "react"
import { useTaskStore } from "@/lib/task-store"
import { FolderGlyph } from "@/components/Lists/lib/icon-utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ChevronLeft, Plus, Search, X } from "lucide-react"
import type { List } from "@/lib/types"
import "./list-picker.css"

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
  /** Selected lists as chips with remove, above search (item “in lists” pattern). */
  showSelectedChips?: boolean
  /** Pin these list ids at the top as a Recent strip (Inbox walk). */
  suggestedIds?: string[]
}

function SelectedChips({
  selected,
  lists,
  onRemove,
}: {
  selected: string[]
  lists: List[]
  onRemove: (id: string) => void
}) {
  if (selected.length === 0) return null
  return (
    <div className="list-picker-chips" aria-label="Selected lists">
      {selected.map((id) => {
        const cat = lists.find((c) => c.id === id)
        if (!cat) return null
        return (
          <span
            key={id}
            className="list-picker-chip"
            style={{ outline: `2px solid ${cat.color}` }}
          >
            <FolderGlyph size={14} color={cat.color} />
            <span className="truncate">{cat.name}</span>
            <button
              type="button"
              className="list-picker-chip-remove"
              aria-label={`Remove ${cat.name}`}
              onClick={() => onRemove(id)}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        )
      })}
    </div>
  )
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
  showSelectedChips = false,
  suggestedIds,
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

  const suggestedLists = useMemo(() => {
    if (!suggestedIds?.length) return [] as List[]
    return suggestedIds
      .map((id) => visibleLists.find((c) => c.id === id))
      .filter((c): c is List => !!c)
  }, [suggestedIds, visibleLists])
  const suggestedIdSet = useMemo(() => new Set(suggestedLists.map((c) => c.id)), [suggestedLists])

  const childFolders = useMemo(
    () => folders.filter((f) => (browseFolderId ? f.parentFolderId === browseFolderId : !f.parentFolderId)),
    [folders, browseFolderId],
  )

  const listsInFolder = useMemo(() => {
    if (!browseFolderId) return []
    const folder = folders.find((f) => f.id === browseFolderId)
    if (!folder) return []
    return folder.listIds
      .map((id) => visibleLists.find((c) => c.id === id))
      .filter((c): c is List => !!c && !suggestedIdSet.has(c.id))
  }, [browseFolderId, folders, visibleLists, suggestedIdSet])

  const looseLists = useMemo(() => {
    const inAnyFolder = new Set<string>()
    folders.forEach((f) => f.listIds.forEach((id) => inAnyFolder.add(id)))
    return visibleLists.filter((c) => !inAnyFolder.has(c.id) && !suggestedIdSet.has(c.id))
  }, [visibleLists, folders, suggestedIdSet])

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

  const beginCreate = () => {
    const typed = search.trim()
    const exact = typed
      ? visibleLists.some((list) => list.name.trim().toLowerCase() === typed.toLowerCase())
      : false
    setNewListName(typed && !exact ? typed : "")
    setCreating(true)
  }

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

  const pickFirstSearchHit = () => {
    const first = searchResults[0]
    if (first) toggle(first.id)
  }

  const renderListRow = (cat: List) => {
    const on = selected.includes(cat.id)
    const glyph = <FolderGlyph size={fm ? 14 : 18} color={cat.color} />
    const name = <span className="truncate">{cat.name}</span>
    // Multi: label + checkbox (never a button wrapping Checkbox — invalid HTML / hydration error).
    // Single: plain button. Whole-row click still toggles via the label association.
    if (effectiveMulti) {
      const rowClass = fm
        ? `fm-picker-row${on ? " selected" : ""}`
        : `list-picker-row w-full px-2 py-1.5 text-sm rounded hover:bg-muted/60${on ? " bg-muted" : ""}`
      return (
        <label key={cat.id} className={rowClass}>
          {fm ? (
            <input
              type="checkbox"
              checked={on}
              onChange={() => toggle(cat.id)}
              aria-label={`Add to ${cat.name}`}
            />
          ) : (
            <Checkbox checked={on} onCheckedChange={() => toggle(cat.id)} aria-label={`Add to ${cat.name}`} />
          )}
          {glyph}
          {name}
        </label>
      )
    }
    if (fm) {
      return (
        <button
          key={cat.id}
          type="button"
          className={`fm-picker-row${on ? " selected" : ""}`}
          onClick={() => toggle(cat.id)}
        >
          {glyph}
          {name}
        </button>
      )
    }
    return (
      <button
        key={cat.id}
        type="button"
        className={`list-picker-row w-full px-2 py-1.5 text-sm rounded hover:bg-muted/60${on ? " bg-muted" : ""}`}
        onClick={() => toggle(cat.id)}
      >
        {glyph}
        {name}
      </button>
    )
  }

  const renderFolderRow = (f: (typeof folders)[number]) =>
    fm ? (
      <button key={f.id} type="button" className="fm-picker-row" onClick={() => setBrowseFolderId(f.id)}>
        <FolderGlyph size={14} color={f.color || "#808080"} />
        <span className="truncate">{f.name}</span>
      </button>
    ) : (
      <button
        key={f.id}
        type="button"
        className="list-picker-row w-full px-2 py-1.5 text-left text-sm rounded hover:bg-muted/60"
        onClick={() => setBrowseFolderId(f.id)}
      >
        <FolderGlyph size={18} color={f.color || "#808080"} />
        <span className="truncate">{f.name}</span>
      </button>
    )

  const recentStrip =
    !searchActive && suggestedLists.length > 0 ? (
      <div className={fm ? undefined : "list-picker-recent"} aria-label="Recent lists">
        <p className={fm ? "fm-picker-section" : "text-xs font-medium px-2 py-1 text-muted-foreground"}>Recent</p>
        {suggestedLists.map(renderListRow)}
      </div>
    ) : null

  const body = searchActive ? (
    searchResults.length === 0 ? (
      <p className={fm ? "fm-picker-empty" : "text-xs text-muted-foreground p-2"}>No lists match.</p>
    ) : (
      searchResults.map(renderListRow)
    )
  ) : browseFolderId && inFolder ? (
    <>
      {recentStrip}
      <p className={fm ? "fm-picker-section" : "text-xs font-medium px-2 py-1 text-muted-foreground"}>{inFolder.name}</p>
      {childFolders.map(renderFolderRow)}
      {listsInFolder.map(renderListRow)}
      {childFolders.length === 0 && listsInFolder.length === 0 && (
        <p className={fm ? "fm-picker-empty" : "text-xs text-muted-foreground p-2"}>Empty folder.</p>
      )}
    </>
  ) : (
    <>
      {recentStrip}
      {childFolders.map(renderFolderRow)}
      {looseLists.map(renderListRow)}
    </>
  )

  const chips = showSelectedChips ? (
    <SelectedChips selected={selected} lists={categories} onRemove={toggle} />
  ) : null

  if (fm) {
    return (
      <div className="fm-list-picker">
        {chips}
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
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchActive) {
                e.preventDefault()
                pickFirstSearchHit()
              }
            }}
            placeholder="Search lists…"
            aria-label="Search lists"
            style={{ flex: 1, minWidth: 0, width: "100%" }}
          />
        </div>
        <div className="fm-list-picker-body list-picker-body">{body}</div>
        {showCreate && (
          <div className="fm-list-picker-foot">
            {creating ? (
              <div style={{ display: "flex", gap: 4 }}>
                <input
                  className="fm-input"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="New list name"
                  aria-label="New list name"
                  autoFocus
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
              <button type="button" className="fm-btn fm-btn-sm" onClick={beginCreate}>
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
      {chips}
      <div className="flex items-center gap-2 p-2 border-b bg-muted/30">
        {browseFolderId && !searchActive && (
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setBrowseFolderId(null)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchActive) {
                e.preventDefault()
                pickFirstSearchHit()
              }
            }}
            placeholder="Search lists…"
            aria-label="Search lists"
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

      <div className={`list-picker-body p-1 ${compact ? "max-h-40" : "max-h-64"}`}>{body}</div>

      {showCreate && (
        <div className="p-2 border-t">
          {creating ? (
            <div className="flex gap-1">
              <Input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="New list name"
                aria-label="New list name"
                className="h-8"
                autoFocus
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
            <Button variant="outline" size="sm" className="w-full h-8" onClick={beginCreate}>
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
