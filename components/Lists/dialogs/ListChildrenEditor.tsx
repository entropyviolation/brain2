/**
 * List Settings — nested child lists (`List.parentListId`). Faint “auto” when auto-created.
 */
"use client"

import { useMemo, useState } from "react"
import { Layers, Search, X } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import type { List } from "@/lib/types"
import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import { isAutoCreatedList } from "@/lib/lists-duplicate"
import { iconFor } from "@/components/Lists/lib/icon-utils"
import { AutoMark } from "@/components/Lists/dialogs/FolderRelationsEditor"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ListChildrenEditor({ listId }: { listId: string }) {
  const lists = useTaskStore((s) => s.lists)
  const updateList = useTaskStore((s) => s.updateList)
  const [query, setQuery] = useState("")

  const children = useMemo(
    () => lists.filter((l) => l.parentListId === listId && !isFolderAllItemsCategoryId(l.id)),
    [lists, listId],
  )

  const addable = useMemo(() => {
    const q = query.trim().toLowerCase()
    return lists.filter((l) => {
      if (l.id === listId || isFolderAllItemsCategoryId(l.id)) return false
      if (l.parentListId === listId) return false
      // Avoid cycles: skip ancestors of this list.
      let walk: string | undefined = listId
      const seen = new Set<string>()
      while (walk && !seen.has(walk)) {
        seen.add(walk)
        if (walk === l.id) return false
        walk = lists.find((x) => x.id === walk)?.parentListId
      }
      if (!q) return true
      return l.name.toLowerCase().includes(q)
    })
  }, [lists, listId, query])

  const adopt = (child: List) => {
    updateList({ ...child, parentListId: listId })
  }

  const detach = (child: List) => {
    const next = { ...child }
    delete next.parentListId
    updateList(next)
  }

  return (
    <section className="space-y-3 rounded-lg border p-3" aria-labelledby="list-children-heading">
      <div className="space-y-0.5">
        <Label id="list-children-heading" className="flex items-center gap-2">
          <Layers className="h-4 w-4" />
          Child lists
        </Label>
        <p className="text-xs text-muted-foreground">
          Nested sublists under this list (`parentListId`). Separate from folder membership and
          connected lists.
        </p>
      </div>

      {children.length === 0 ? (
        <p className="text-xs text-muted-foreground">No child lists.</p>
      ) : (
        <ul className="space-y-1 max-h-36 overflow-y-auto border rounded-md p-1">
          {children.map((child) => (
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
                aria-label={`Detach ${child.name}`}
                title="Remove nesting"
                onClick={() => detach(child)}
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
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nest a list under this one…"
              aria-label="Search lists to nest"
              className="h-8 pl-8"
            />
          </div>
        </div>
        <div className="overflow-y-auto p-1 max-h-32">
          {addable.length === 0 ? (
            <p className="text-xs text-muted-foreground p-2">
              {query.trim() ? "No lists match." : "No other lists available to nest."}
            </p>
          ) : (
            addable.slice(0, 40).map((l) => (
              <button
                key={l.id}
                type="button"
                className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm rounded hover:bg-muted/60"
                onClick={() => adopt(l)}
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
                <span className="text-[10px] text-muted-foreground">Nest</span>
              </button>
            ))
          )}
        </div>
      </div>
    </section>
  )
}
