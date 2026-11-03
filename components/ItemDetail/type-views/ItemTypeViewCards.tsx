/**
 * components/ItemDetail/type-views/ItemTypeViewCards.tsx — Type cards on item detail
 *
 * One type stays a nameplate. Two or more are a switch: click a card and the
 * detail view uses that type's panels, capabilities, and layout. The item
 * itself does not change type. Double-click still opens the type editor.
 */
"use client"

import type { ItemTypeDefinition } from "@/lib/types"

export function ItemTypeViewCards({
  types,
  activeId,
  primaryId,
  onSelect,
  onEdit,
}: {
  types: ItemTypeDefinition[]
  activeId: string
  primaryId: string
  onSelect: (typeId: string) => void
  onEdit: (type: ItemTypeDefinition) => void
}) {
  const switching = types.length > 1
  return (
    <>
      {types.map((type) => {
        const id = String(type.id)
        const viewing = switching && id === activeId
        return (
          <button
            key={id}
            type="button"
            className={`id-type-plate${switching ? " is-switch" : ""}${viewing ? " is-view" : ""}`}
            style={{ ["--id-type-color" as string]: type.color ?? "#cbd5e1" }}
            aria-pressed={switching ? viewing : undefined}
            title={
              switching
                ? "Show this type's detail view. Double-click to edit the type."
                : "Double-click to view or edit this type"
            }
            onClick={() => {
              if (switching) onSelect(id)
            }}
            onDoubleClick={() => onEdit(type)}
          >
            <span className="id-type-lamp" aria-hidden />
            {type.name}
            {id === primaryId && switching && <span className="id-type-primary">primary</span>}
          </button>
        )
      })}
    </>
  )
}
