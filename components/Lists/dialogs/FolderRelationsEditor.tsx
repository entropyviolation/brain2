/**
 * Folder Settings — parent + children (folders and lists).
 * Parent edits the open draft (`parentFolderId`). Child list filing writes the store
 * immediately (same as In folders). Faint “auto” on auto-created rows.
 */
"use client"

import { useMemo, useState } from "react"
import { Folder as FolderIcon, List as ListIcon, Search, X } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import type { Folder, List } from "@/lib/types"
import { getFolderChildren } from "@/lib/folder-tree"
import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import { isAutoCreatedFolder, isAutoCreatedList, parentFolderChoices } from "@/lib/lists-duplicate"
import { folderFor } from "@/components/Icons/Icon"
import { iconFor } from "@/components/Lists/lib/icon-utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function AutoMark({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <span className="fm-auto-label" title="Created automatically">
      {" "}
      auto
    </span>
  )
}

export function FolderRelationsEditor({
  folder,
  onFolderPatch,
}: {
  folder: Folder
  onFolderPatch: (patch: Partial<Folder>) => void
}) {
  const folders = useTaskStore((s) => s.folders)
  const lists = useTaskStore((s) => s.lists)
  const updateFolder = useTaskStore((s) => s.updateFolder)
  const addListToFolder = useTaskStore((s) => s.addListToFolder)
  const removeListFromFolder = useTaskStore((s) => s.removeListFromFolder)

  const [listQuery, setListQuery] = useState("")
  const folderId = folder.id

  const liveFolder = folders.find((f) => f.id === folderId) ?? folder
  const parent = folder.parentFolderId
    ? folders.find((f) => f.id === folder.parentFolderId) ?? null
    : null
  const parentChoices = useMemo(() => parentFolderChoices(folders, folderId), [folders, folderId])
  const childFolders = useMemo(() => getFolderChildren(folders, folderId), [folders, folderId])
  const childLists = useMemo(() => {
    return liveFolder.listIds
      .map((id) => lists.find((l) => l.id === id))
      .filter((l): l is List => !!l && !isFolderAllItemsCategoryId(l.id))
  }, [liveFolder.listIds, lists])

  const addableLists = useMemo(() => {
    const inFolder = new Set(liveFolder.listIds)
    const q = listQuery.trim().toLowerCase()
    return lists.filter((l) => {
      if (inFolder.has(l.id) || isFolderAllItemsCategoryId(l.id)) return false
      if (!q) return true
      return l.name.toLowerCase().includes(q)
    })
  }, [liveFolder.listIds, lists, listQuery])

  return (
    <section className="space-y-3 rounded-lg border p-3" aria-labelledby="folder-relations-heading">
      <div className="space-y-0.5">
        <Label id="folder-relations-heading" className="flex items-center gap-2">
          <FolderIcon className="h-4 w-4" />
          Parent and children
        </Label>
        <p className="text-xs text-muted-foreground">
          A folder has one parent in the tree. Lists can also live in other folders.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Parent folder</Label>
        <select
          className="w-full border rounded-md h-9 px-2 bg-background text-sm"
          aria-label="Parent folder"
          value={folder.parentFolderId || ""}
          onChange={(e) => {
            const next = e.target.value || undefined
            onFolderPatch({ parentFolderId: next })
          }}
        >
          <option value="">None (top level)</option>
          {parentChoices.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
              {isAutoCreatedFolder(f) ? " (auto)" : ""}
            </option>
          ))}
        </select>
        {parent && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            Current: {parent.name}
            <AutoMark show={isAutoCreatedFolder(parent)} />
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Child folders ({childFolders.length})</Label>
        {childFolders.length === 0 ? (
          <p className="text-xs text-muted-foreground">No subfolders.</p>
        ) : (
          <ul className="space-y-1 max-h-36 overflow-y-auto border rounded-md p-1">
            {childFolders.map((child) => (
              <li key={child.id} className="flex items-center gap-2 px-2 py-1 text-sm">
                <img
                  src={child.icon || folderFor(child.id)}
                  alt=""
                  width={16}
                  height={16}
                  draggable={false}
                  style={{ width: 16, height: 16, objectFit: "contain" }}
                />
                <span className="truncate flex-1">
                  {child.name}
                  <AutoMark show={isAutoCreatedFolder(child)} />
                </span>
                <button
                  type="button"
                  className="rounded p-0.5 hover:bg-black/10"
                  aria-label={`Remove ${child.name} from this folder`}
                  title="Move to top level"
                  onClick={() => updateFolder({ ...child, parentFolderId: undefined })}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1">
          <ListIcon className="h-3.5 w-3.5" />
          Lists in this folder ({childLists.length})
        </Label>
        {childLists.length === 0 ? (
          <p className="text-xs text-muted-foreground">No lists filed here yet.</p>
        ) : (
          <ul className="space-y-1 max-h-36 overflow-y-auto border rounded-md p-1">
            {childLists.map((child) => (
              <li key={child.id} className="flex items-center gap-2 px-2 py-1 text-sm">
                <img
                  src={iconFor(child.id, child.icon)}
                  alt=""
                  width={16}
                  height={16}
                  draggable={false}
                  style={{ width: 16, height: 16, objectFit: "contain" }}
                />
                <span className="truncate flex-1">
                  {child.name}
                  <AutoMark show={isAutoCreatedList(child)} />
                </span>
                <button
                  type="button"
                  className="rounded p-0.5 hover:bg-black/10"
                  aria-label={`Remove ${child.name} from this folder`}
                  onClick={() => removeListFromFolder(folderId, child.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="border rounded-md">
          <div className="flex items-center gap-2 p-2 border-b bg-muted/30">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={listQuery}
                onChange={(e) => setListQuery(e.target.value)}
                placeholder="Add a list…"
                aria-label="Search lists to add"
                className="h-8 pl-8"
              />
            </div>
          </div>
          <div className="overflow-y-auto p-1 max-h-32">
            {addableLists.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2">
                {listQuery.trim() ? "No lists match." : "Every list is already here, or none exist."}
              </p>
            ) : (
              addableLists.slice(0, 40).map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm rounded hover:bg-muted/60"
                  onClick={() => addListToFolder(folderId, l.id)}
                >
                  <img
                    src={iconFor(l.id, l.icon)}
                    alt=""
                    width={16}
                    height={16}
                    draggable={false}
                    style={{ width: 16, height: 16, objectFit: "contain", flexShrink: 0 }}
                  />
                  <span className="truncate flex-1">
                    {l.name}
                    <AutoMark show={isAutoCreatedList(l)} />
                  </span>
                  <span className="text-[10px] text-muted-foreground">Add</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
