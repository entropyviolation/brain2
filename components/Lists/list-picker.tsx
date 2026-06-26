/**
 * components/Lists/list-picker.tsx — Folder-aware list selector
 *
 * Used in Inbox clarification and attribute editors. Supports nested folder
 * navigation, search, optional multi-select, and creating a new list inline.
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

interface ListPickerProps {
  selected: string[]
  onChange: (ids: string[]) => void
  mode?: "single" | "multi"
  /** When true, show a toggle to enable multi-select. */
  allowMultiToggle?: boolean
  /** Compact layout for attribute value fields. */
  compact?: boolean
}

export function ListPicker({
  selected,
  onChange,
  mode = "multi",
  allowMultiToggle = false,
  compact = false,
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

  const inFolder = browseFolderId ? folders.find((f) => f.id === browseFolderId) : null

  const childFolders = useMemo(
    () => folders.filter((f) => (browseFolderId ? f.parentFolderId === browseFolderId : !f.parentFolderId)),
    [folders, browseFolderId],
  )

  const listsInFolder = useMemo(() => {
    if (!browseFolderId) return []
    const folder = folders.find((f) => f.id === browseFolderId)
    if (!folder) return []
    return folder.listIds.map((id) => categories.find((c) => c.id === id)).filter(Boolean) as List[]
  }, [browseFolderId, folders, categories])

  const looseLists = useMemo(() => {
    const inAnyFolder = new Set<string>()
    folders.forEach((f) => f.listIds.forEach((id) => inAnyFolder.add(id)))
    return categories.filter((c) => !inAnyFolder.has(c.id))
  }, [categories, folders])

  const q = search.trim().toLowerCase()
  const searchActive = q.length > 0

  const searchResults = useMemo(() => {
    if (!searchActive) return []
    return categories.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.description || "").toLowerCase().includes(q),
    )
  }, [categories, q, searchActive])

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

      <div className={`overflow-y-auto p-1 ${compact ? "max-h-40" : "max-h-56"}`}>
        {searchActive ? (
          searchResults.length === 0 ? (
            <p className="text-xs text-muted-foreground p-2">No lists match.</p>
          ) : (
            searchResults.map(renderListRow)
          )
        ) : browseFolderId && inFolder ? (
          <>
            <p className="text-xs font-medium px-2 py-1 text-muted-foreground">{inFolder.name}</p>
            {childFolders.map((f) => (
              <button
                key={f.id}
                type="button"
                className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm rounded hover:bg-muted/60"
                onClick={() => setBrowseFolderId(f.id)}
              >
                <FolderIcon className="h-3.5 w-3.5 shrink-0" style={{ color: f.color }} />
                <span className="truncate">{f.name}</span>
              </button>
            ))}
            {listsInFolder.map(renderListRow)}
            {childFolders.length === 0 && listsInFolder.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">Empty folder.</p>
            )}
          </>
        ) : (
          <>
            {childFolders.map((f) => (
              <button
                key={f.id}
                type="button"
                className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm rounded hover:bg-muted/60"
                onClick={() => setBrowseFolderId(f.id)}
              >
                <FolderIcon className="h-3.5 w-3.5 shrink-0" style={{ color: f.color }} />
                <span className="truncate">{f.name}</span>
              </button>
            ))}
            {looseLists.map(renderListRow)}
          </>
        )}
      </div>

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

      {selected.length > 0 && !compact && (
        <div className="px-2 pb-2">
          <Label className="text-[10px] text-muted-foreground">Selected ({selected.length})</Label>
        </div>
      )}
    </div>
  )
}
