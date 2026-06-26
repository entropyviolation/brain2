/**
 * components/ItemDetail/ItemAttributesSection.tsx — Attributes panel for item detail
 *
 * The shared "Attributes" surface used by both ItemDetail variants. It composes:
 *  - the schema-driven value editor (attributes defined by the item's lists),
 *  - a typed editor for item-only attribute definitions + values, and
 *  - the AttributeCreator for defining brand-new typed attributes on the fly.
 */
"use client"

import { useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import type { AttributeDefinition, AttributeValue, ItemType, List } from "@/lib/types"
import { AttributeValuesEditor, mergeItemAttributes } from "@/components/Lists/attribute-editor"
import { useItemTypeStore } from "@/lib/item-type-store"
import { AttributeCreator } from "@/components/ItemDetail/AttributeCreator"

function humanizeId(id: string): string {
  return id
    .replace(/^custom_/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

export interface ItemAttributesSectionProps {
  attributes: Record<string, AttributeValue>
  itemCategoryIds: string[]
  categories: List[]
  /** Schema for attributes that exist only on this item. */
  itemAttributeDefinitions?: AttributeDefinition[]
  /** The item's type, so type-level attributes are shown alongside list ones. */
  itemType?: ItemType
  onChangeValues: (values: Record<string, AttributeValue>) => void
  onChangeItemAttributeDefinitions?: (defs: AttributeDefinition[]) => void
  onCreateAttribute: (def: AttributeDefinition, value: AttributeValue, listId: string | null) => void
}

export function ItemAttributesSection({
  attributes,
  itemCategoryIds,
  categories,
  itemAttributeDefinitions = [],
  itemType,
  onChangeValues,
  onChangeItemAttributeDefinitions,
  onCreateAttribute,
}: ItemAttributesSectionProps) {
  const types = useItemTypeStore((s) => s.types)
  const schemaDefs = useMemo(
    () => mergeItemAttributes({ type: itemType, lists: itemCategoryIds }, categories, types),
    [itemType, categories, itemCategoryIds, types],
  )

  const itemOnlyDefs = itemAttributeDefinitions ?? []

  // Legacy values with no definition anywhere (e.g. pre-migration item-only attrs).
  const orphanIds = useMemo(() => {
    const known = new Set([...schemaDefs.map((d) => d.id), ...itemOnlyDefs.map((d) => d.id)])
    return Object.keys(attributes || {}).filter((id) => !known.has(id))
  }, [attributes, schemaDefs, itemOnlyDefs])

  const existingIds = useMemo(
    () => [...schemaDefs.map((d) => d.id), ...itemOnlyDefs.map((d) => d.id), ...Object.keys(attributes || {})],
    [schemaDefs, itemOnlyDefs, attributes],
  )

  const setOrphan = (id: string, v: string) => onChangeValues({ ...attributes, [id]: v })
  const removeOrphan = (id: string) => {
    const next = { ...attributes }
    delete next[id]
    onChangeValues(next)
  }

  const removeItemOnly = (id: string) => {
    onChangeItemAttributeDefinitions?.(itemOnlyDefs.filter((d) => d.id !== id))
    const next = { ...attributes }
    delete next[id]
    onChangeValues(next)
  }

  return (
    <div className="space-y-3">
      <AttributeValuesEditor definitions={schemaDefs} values={attributes || {}} onChange={onChangeValues} />

      {itemOnlyDefs.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">This item only</Label>
          <AttributeValuesEditor
            definitions={itemOnlyDefs}
            values={attributes || {}}
            onChange={onChangeValues}
          />
          <div className="flex flex-wrap gap-1">
            {itemOnlyDefs.map((def) => (
              <Button
                key={def.id}
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => removeItemOnly(def.id)}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Remove {def.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {orphanIds.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Other attributes</Label>
          <div className="space-y-2">
            {orphanIds.map((id) => (
              <div key={id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                <span className="text-sm font-medium truncate" title={humanizeId(id)}>
                  {humanizeId(id)}
                </span>
                <Input
                  value={typeof attributes[id] === "string" ? (attributes[id] as string) : String(attributes[id] ?? "")}
                  onChange={(e) => setOrphan(id, e.target.value)}
                  className="h-8"
                />
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeOrphan(id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <AttributeCreator
        categories={categories}
        itemCategoryIds={itemCategoryIds}
        existingIds={existingIds}
        onCreate={onCreateAttribute}
      />
    </div>
  )
}
