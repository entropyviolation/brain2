/**
 * components/ItemTypes/ItemTypeItemsPanel.tsx — Items belonging to a type
 *
 * Read-only list of every item whose primary type or list membership matches the
 * given item type. Used inside `ItemTypeEditor` when viewing/editing a type.
 */
"use client"

import { useMemo } from "react"
import { useTaskStore } from "@/lib/task-store"
import { useItemTypeStore } from "@/lib/item-type-store"
import { itemsOfType } from "@/lib/item-types"
import type { ItemType, ItemTypeDefinition } from "@/lib/types"
import { displayTitle } from "@/lib/search"

export function ItemTypeItemsPanel({
  typeId,
  onOpenItem,
  allTypes = [],
}: {
  typeId: ItemType
  onOpenItem?: (itemId: string) => void
  allTypes?: ItemTypeDefinition[]
}) {
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const storeTypes = useItemTypeStore((s) => s.types)
  const types = allTypes.length ? allTypes : storeTypes

  const items = useMemo(
    () =>
      itemsOfType(typeId as string, tasks, lists, types).sort((a, b) =>
        displayTitle(a).localeCompare(displayTitle(b)),
      ),
    [typeId, tasks, lists, types],
  )

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold">Items of this type</h4>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No items use this type yet.</p>
      ) : (
        <ul className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
          {items.map((item) => (
            <li key={item.id}>
              {onOpenItem ? (
                <button
                  type="button"
                  className="w-full truncate rounded px-2 py-1 text-left text-sm hover:bg-muted"
                  onClick={() => onOpenItem(item.id)}
                >
                  {displayTitle(item)}
                </button>
              ) : (
                <span className="block truncate px-2 py-1 text-sm">{displayTitle(item)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
