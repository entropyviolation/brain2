/**
 * components/ItemDetail/AttributeCreator.tsx — Create attributes from item detail
 *
 * Inline control for defining a brand-new typed attribute while looking at an
 * item. The new attribute can be added to one of the item's lists (so it becomes
 * a real, reusable, typed attribute shared by every item in that list) or kept
 * on just this item. An initial value can be entered at creation time.
 *
 * Used by both ItemDetail variants (popup + full page) via their shared
 * Attributes section.
 */
"use client"

import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus } from "lucide-react"
import type { AttributeDefinition, AttributeType, AttributeValue, List } from "@/lib/types"
import { ATTRIBUTE_TYPE_LABELS, SCHEMA_ATTRIBUTE_TYPES } from "@/lib/attribute-utils"
import { slugId } from "@/components/Lists/attributes/helpers"
import { AttributeValueField } from "@/components/Lists/attributes/AttributeValueField"

/** Sentinel target meaning "store on just this item" (no list schema change). */
export const ITEM_ONLY_TARGET = "__item__"

export interface AttributeCreatorProps {
  /** All known lists, used to label the target picker. */
  categories: List[]
  /** The lists this item belongs to (creation targets). */
  itemCategoryIds: string[]
  /** Existing attribute ids (schema + values) to avoid id collisions. */
  existingIds: string[]
  /**
   * Persist a newly created attribute. `listId` is the id of the list to add the
   * definition to, or `null` to keep it on just this item.
   */
  onCreate: (def: AttributeDefinition, value: AttributeValue, listId: string | null) => void
}

export function AttributeCreator({ categories, itemCategoryIds, existingIds, onCreate }: AttributeCreatorProps) {
  const targets = useMemo(
    () =>
      itemCategoryIds
        .map((id) => categories.find((c) => c.id === id))
        .filter((c): c is List => !!c),
    [itemCategoryIds, categories],
  )

  const [name, setName] = useState("")
  const [type, setType] = useState<AttributeType>("string")
  const [target, setTarget] = useState<string>(ITEM_ONLY_TARGET)
  const [value, setValue] = useState<AttributeValue>("")

  // Keep the default target in sync if the item's lists change underneath us.
  const targetIsValid = target === ITEM_ONLY_TARGET || targets.some((t) => t.id === target)
  const effectiveTarget = targetIsValid ? target : (targets[0]?.id ?? ITEM_ONLY_TARGET)

  const draftDef: AttributeDefinition = useMemo(
    () => ({ id: "__draft__", name: name.trim() || "New attribute", type }),
    [name, type],
  )

  const handleCreate = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const base = slugId(trimmed)
    const existing = new Set(existingIds)
    const id = existing.has(base) ? `${base}_${Date.now().toString(36)}` : base
    const def: AttributeDefinition = { id, name: trimmed, type }
    const listId = effectiveTarget === ITEM_ONLY_TARGET ? null : effectiveTarget
    onCreate(def, value, listId)
    // Keep type/target for rapid entry; clear the name and value.
    setName("")
    setValue("")
  }

  return (
    <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
      <Label className="text-sm font-medium">Create attribute</Label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px]">Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. ISBN"
            className="h-8"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate()
            }}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as AttributeType)}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCHEMA_ATTRIBUTE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {ATTRIBUTE_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Add to</Label>
          <Select value={effectiveTarget} onValueChange={setTarget}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {targets.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} (list)
                </SelectItem>
              ))}
              <SelectItem value={ITEM_ONLY_TARGET}>This item only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Initial value</Label>
          <AttributeValueField def={draftDef} value={value} onChange={setValue} />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          {effectiveTarget === ITEM_ONLY_TARGET
            ? "Stored on just this item."
            : "Added to the list — every item in it gets this attribute."}
        </p>
        <Button size="sm" variant="outline" disabled={!name.trim()} onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Create
        </Button>
      </div>
    </div>
  )
}
