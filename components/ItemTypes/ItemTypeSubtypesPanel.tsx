/**
 * components/ItemTypes/ItemTypeSubtypesPanel.tsx — Child types of a parent type
 */
"use client"

import { useMemo } from "react"
import { useItemTypeStore } from "@/lib/item-type-store"
import { subtypesOf } from "@/lib/item-types"
import type { ItemType, ItemTypeDefinition } from "@/lib/types"
import { Badge } from "@/components/ui/badge"

export function ItemTypeSubtypesPanel({
  typeId,
  onOpenType,
}: {
  typeId: ItemType
  onOpenType?: (type: ItemTypeDefinition) => void
}) {
  const types = useItemTypeStore((s) => s.types)
  const children = useMemo(() => subtypesOf(typeId as string, types), [typeId, types])

  if (children.length === 0) return null

  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold">Subtypes</h4>
      <ul className="space-y-1">
        {children.map((child) => (
          <li key={child.id}>
            {onOpenType ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm hover:bg-muted"
                onClick={() => onOpenType(child)}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: child.color ?? "#cbd5e1" }}
                  aria-hidden
                />
                <span className="truncate">{child.name}</span>
                <Badge variant="secondary" className="ml-auto text-[10px]">
                  subtype
                </Badge>
              </button>
            ) : (
              <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: child.color ?? "#cbd5e1" }}
                  aria-hidden
                />
                {child.name}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
