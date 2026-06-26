/**
 * components/ItemTypes/ItemTypesPanel.tsx — Browse and manage item types
 *
 * Shared surface for Settings and Analytics: list types (with subtype nesting),
 * open the detail editor on click, create new types, and delete user types.
 */
"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Shapes, Trash2 } from "lucide-react"
import type { ItemTypeDefinition } from "@/lib/types"
import { useItemTypeStore } from "@/lib/item-type-store"
import { itemsOfType } from "@/lib/item-types"
import { useTaskStore } from "@/lib/task-store"
import { ItemTypeEditor } from "./ItemTypeEditor"

function sortTypes(types: ItemTypeDefinition[]): ItemTypeDefinition[] {
  return [...types].sort((a, b) => a.name.localeCompare(b.name))
}

export function ItemTypesPanel({ compact = false }: { compact?: boolean }) {
  const types = useItemTypeStore((s) => s.types)
  const addType = useItemTypeStore((s) => s.addType)
  const updateType = useItemTypeStore((s) => s.updateType)
  const deleteType = useItemTypeStore((s) => s.deleteType)
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<ItemTypeDefinition | null | undefined>(undefined)

  const roots = useMemo(
    () => sortTypes(types.filter((t) => !t.parentTypeId)),
    [types],
  )

  const childrenByParent = useMemo(() => {
    const map = new Map<string, ItemTypeDefinition[]>()
    for (const t of types) {
      if (!t.parentTypeId) continue
      const key = t.parentTypeId as string
      map.set(key, [...(map.get(key) ?? []), t])
    }
    for (const [key, kids] of map) map.set(key, sortTypes(kids))
    return map
  }, [types])

  const openNew = () => {
    setEditing(null)
    setEditorOpen(true)
  }

  const openType = (type: ItemTypeDefinition) => {
    setEditing(type)
    setEditorOpen(true)
  }

  const handleSave = (def: ItemTypeDefinition) => {
    if (types.some((t) => t.id === def.id)) updateType(def)
    else addType(def)
  }

  const handleDelete = (type: ItemTypeDefinition) => {
    if (type.builtin) return
    const ok =
      typeof window === "undefined" ||
      window.confirm(`Delete the "${type.name}" item type? Items of this type keep their data.`)
    if (!ok) return
    deleteType(type.id as string)
    if (editing?.id === type.id) {
      setEditorOpen(false)
      setEditing(undefined)
    }
  }

  const renderRow = (type: ItemTypeDefinition, depth = 0) => {
    const itemCount = itemsOfType(type.id as string, tasks, lists, types).length
    const children = childrenByParent.get(type.id as string) ?? []

    return (
      <li key={type.id}>
        <div
          className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50"
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            onClick={() => openType(type)}
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full border"
              style={{ backgroundColor: type.color || "#cbd5e1" }}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{type.name}</span>
                {type.builtin && (
                  <Badge variant="secondary" className="text-[10px]">
                    Built-in
                  </Badge>
                )}
                {type.parentTypeId && (
                  <Badge variant="outline" className="text-[10px]">
                    Subtype
                  </Badge>
                )}
              </div>
              {!compact && type.description && (
                <p className="truncate text-xs text-muted-foreground">{type.description}</p>
              )}
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{itemCount} items</span>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={type.builtin}
            onClick={() => handleDelete(type)}
            aria-label={`Delete ${type.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        {children.length > 0 && (
          <ul>{children.map((child) => renderRow(child, depth + 1))}</ul>
        )}
      </li>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shapes className="h-4 w-4" />
          <h3 className="font-semibold">Item Types</h3>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" />
          New type
        </Button>
      </div>

      {!compact && (
        <p className="text-sm text-muted-foreground">
          Click a type to view or edit it. User-defined types can be deleted; built-in system types cannot.
        </p>
      )}

      <ul className="divide-y rounded-lg border">
        {roots.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">No item types yet.</li>
        ) : (
          roots.map((type) => renderRow(type))
        )}
      </ul>

      <ItemTypeEditor
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open)
          if (!open) setEditing(undefined)
        }}
        type={editing === undefined ? undefined : editing}
        existingIds={types.map((t) => t.id as string)}
        onSave={handleSave}
        onDelete={editing && !editing.builtin ? () => handleDelete(editing) : undefined}
        onNavigateType={openType}
        allTypes={types}
      />
    </div>
  )
}
