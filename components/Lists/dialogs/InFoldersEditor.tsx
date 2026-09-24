/**
 * components/Lists/dialogs/InFoldersEditor.tsx — List Settings "In folders"
 *
 * Searchable folder membership, same shape as item "In lists": chips, search,
 * colored folder rows, + New folder, Selected (n). Direct vs inherited
 * (Show nested). Writes `Folder.listIds` immediately. See LIST_FOLDERS.md.
 */
"use client"

import { useMemo, useState, useCallback } from "react"
import { Folder as FolderIcon, Plus, Search, X } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import type { Folder } from "@/lib/types"
import {
  canFileListInFolder,
  directFolderIdsForList,
  visibleFolderMemberships,
} from "@/lib/folder-membership"
import { buildFolderTree, flattenFolderTree } from "@/lib/folder-tree"
import { FolderGlyph } from "@/components/Icons/Icon"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

export function InFoldersEditor({ listId }: { listId: string }) {
  const folders = useTaskStore((s) => s.folders)
  const addFolder = useTaskStore((s) => s.addFolder)
  const addListToFolder = useTaskStore((s) => s.addListToFolder)
  const removeListFromFolder = useTaskStore((s) => s.removeListFromFolder)

  const [search, setSearch] = useState("")
  const [showNested, setShowNested] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")

  const directIds = useMemo(() => new Set(directFolderIdsForList(folders, listId)), [folders, listId])
  const memberships = useMemo(
    () => visibleFolderMemberships(folders, listId, showNested),
    [folders, listId, showNested],
  )
  const inheritedIds = useMemo(
    () => new Set(memberships.filter((m) => m.kind === "inherited").map((m) => m.folder.id)),
    [memberships],
  )

  const rows = useMemo(() => {
    const expanded = new Set(folders.map((f) => f.id))
    const flat = flattenFolderTree(buildFolderTree(folders), expanded).filter((n) =>
      canFileListInFolder(folders, listId, n.folder.id),
    )
    const q = search.trim().toLowerCase()
    if (!q) return flat
    return flat.filter(
      (n) =>
        n.folder.name.toLowerCase().includes(q) || (n.folder.description || "").toLowerCase().includes(q),
    )
  }, [folders, listId, search])

  const addTo = useCallback(
    (folderId: string) => {
      if (!canFileListInFolder(folders, listId, folderId)) return
      addListToFolder(folderId, listId)
    },
    [addListToFolder, folders, listId],
  )

  const removeDirect = useCallback(
    (folderId: string) => {
      if (!directIds.has(folderId)) return
      removeListFromFolder(folderId, listId)
    },
    [directIds, listId, removeListFromFolder],
  )

  const toggleRow = (folderId: string) => {
    if (directIds.has(folderId)) removeDirect(folderId)
    else addTo(folderId)
  }

  const handleCreate = () => {
    const name = newName.trim()
    if (!name) return
    const id = `folder-${Date.now()}`
    const folder: Folder = {
      id,
      name,
      color: "#3B82F6",
      createdAt: new Date(),
      listIds: [],
    }
    addFolder(folder)
    addListToFolder(id, listId)
    setNewName("")
    setCreating(false)
  }

  return (
    <section className="space-y-3 rounded-lg border p-3" aria-labelledby="in-folders-heading">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <Label id="in-folders-heading" className="flex items-center gap-2">
            <FolderIcon className="h-4 w-4" />
            In folders
          </Label>
          <p className="text-xs text-muted-foreground">
            This list can live in more than one folder. Nested ancestors are not
            the same as a folder you put it in.
          </p>
        </div>
        <label className="flex items-center gap-2 shrink-0 pt-0.5 text-xs">
          <Switch
            id={`show-nested-${listId}`}
            checked={showNested}
            onCheckedChange={setShowNested}
            aria-label="Show nested folders"
          />
          <span>Show nested</span>
        </label>
      </div>

      {memberships.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Folder membership">
          {memberships.map((m) => {
            const inherited = m.kind === "inherited"
            const via = m.viaFolderIds
              .map((id) => folders.find((f) => f.id === id)?.name ?? id)
              .join(", ")
            return (
              <span
                key={`${m.kind}:${m.folder.id}`}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
                  inherited ? "opacity-60 border-dashed" : ""
                }`}
                style={{
                  borderColor: m.folder.color || "#808080",
                  background: `${m.folder.color || "#808080"}18`,
                }}
                title={
                  inherited
                    ? `Also in ${m.folder.name} because ${via} is inside it. Remove the child folder to leave this tree.`
                    : m.folder.name
                }
              >
                <FolderGlyph size={12} color={m.folder.color || undefined} />
                <span className="max-w-[10rem] truncate">{m.folder.name}</span>
                {inherited ? (
                  <span className="text-[10px] uppercase tracking-wide opacity-70">nested</span>
                ) : (
                  <button
                    type="button"
                    className="ml-0.5 rounded-full p-0.5 hover:bg-black/10"
                    aria-label={`Remove from ${m.folder.name}`}
                    onClick={() => removeDirect(m.folder.id)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            )
          })}
        </div>
      )}

      <div className="border rounded-md">
        <div className="flex items-center gap-2 p-2 border-b bg-muted/30">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search folders…"
              aria-label="Search folders"
              className="h-8 pl-8"
            />
          </div>
        </div>

        <div className="overflow-y-auto p-1 max-h-56">
          {rows.length === 0 ? (
            <p className="text-xs text-muted-foreground p-2">
              {search.trim() ? "No folders match." : "No folders yet. Create one below."}
            </p>
          ) : (
            rows.map((n) => {
              const on = directIds.has(n.folder.id)
              const nestedOnly = !on && inheritedIds.has(n.folder.id)
              return (
                <button
                  key={n.folder.id}
                  type="button"
                  className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm rounded hover:bg-muted/60 ${
                    on ? "bg-muted" : nestedOnly ? "opacity-70" : ""
                  }`}
                  style={{ paddingLeft: 8 + n.depth * 12 }}
                  onClick={() => toggleRow(n.folder.id)}
                  aria-pressed={on}
                  aria-label={n.folder.name}
                  title={
                    nestedOnly
                      ? "Inherited. Click to also file this list here directly."
                      : undefined
                  }
                >
                  <FolderGlyph size={16} color={n.folder.color || undefined} />
                  <span className="truncate flex-1">{n.folder.name}</span>
                </button>
              )
            })
          )}
        </div>

        <div className="p-2 border-t">
          {creating ? (
            <div className="flex gap-1">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New folder name"
                className="h-8"
                aria-label="New folder name"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <Button size="sm" className="h-8" onClick={handleCreate}>
                Create
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="w-full h-8" onClick={() => setCreating(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              New folder
            </Button>
          )}
        </div>

        <div className="px-2 pb-2">
          <Label className="text-[10px] text-muted-foreground">Selected ({directIds.size})</Label>
        </div>
      </div>
    </section>
  )
}
