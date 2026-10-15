/**
 * components/ItemDetail/AttributeCreator.tsx — Create attributes from item detail
 *
 * Inline control for defining a brand-new typed attribute while looking at an
 * item. The type is picked from a palette of keys grouped by what they hold
 * (Words, Numbers, Choices, Time, Media, References); the chosen key shows a
 * one-line description and a real-shaped example (`lib/attribute-type-catalog`).
 * Type settings (options, unit, labels, formula, scope list) sit right under
 * it, so a Selection is born with its options and a Number with its unit.
 *
 * The attribute can be added to one of the item's lists (so it becomes a real,
 * reusable, typed attribute shared by every item in that list) or kept on just
 * this item. An initial value can be entered at creation time.
 *
 * Used by both ItemDetail variants (popup + full page) via their shared
 * Attributes section, where it opens at the top of the panel.
 */
"use client"

import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, X } from "lucide-react"
import type { AttributeDefinition, AttributeType, AttributeValue, List } from "@/lib/types"
import { attributeTypeInfo, attributeTypesByGroup } from "@/lib/attribute-type-catalog"
import { slugId } from "@/components/Lists/attributes/helpers"
import { AttributeValueField } from "@/components/Lists/attributes/AttributeValueField"
import { TypeSpecificSchemaFields } from "@/components/Lists/attributes/AttributeSchemaEditor"

/** Sentinel target meaning "store on just this item" (no list schema change). */
export const ITEM_ONLY_TARGET = "__item__"

/** Types that need nothing beyond a name; their settings row is omitted. */
const NO_SETTINGS = new Set<AttributeType>(["string", "multistring", "link", "color", "image", "multiimage", "file", "multifile"])

/** Sensible starting settings per type so a new attribute is useful at once. */
function defaultsFor(type: AttributeType): Partial<AttributeDefinition> {
  switch (type) {
    case "boolean":
      return { booleanDisplay: "switch" }
    case "datetime":
      return { datetimeMode: "date" }
    case "selection":
      return { optionSource: "manual", options: [] }
    case "number":
      return { allowFloat: true }
    default:
      return {}
  }
}

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
  /** Shows a close key in the header when the host can fold the creator away. */
  onClose?: () => void
}

export function AttributeCreator({ categories, itemCategoryIds, existingIds, onCreate, onClose }: AttributeCreatorProps) {
  const targets = useMemo(
    () =>
      itemCategoryIds
        .map((id) => categories.find((c) => c.id === id))
        .filter((c): c is List => !!c),
    [itemCategoryIds, categories],
  )

  const [name, setName] = useState("")
  const [type, setType] = useState<AttributeType>("string")
  const [settings, setSettings] = useState<Partial<AttributeDefinition>>({})
  const [target, setTarget] = useState<string>(ITEM_ONLY_TARGET)
  const [value, setValue] = useState<AttributeValue>("")

  // Keep the default target in sync if the item's lists change underneath us.
  const targetIsValid = target === ITEM_ONLY_TARGET || targets.some((t) => t.id === target)
  const effectiveTarget = targetIsValid ? target : (targets[0]?.id ?? ITEM_ONLY_TARGET)

  const draftDef: AttributeDefinition = useMemo(
    () => ({ id: "__draft__", ...settings, name: name.trim() || "New attribute", type }),
    [name, type, settings],
  )
  const info = attributeTypeInfo(type)
  const groups = useMemo(() => attributeTypesByGroup(), [])

  const pickType = (next: AttributeType) => {
    setType(next)
    setSettings(defaultsFor(next))
    setValue("")
  }

  const handleCreate = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const base = slugId(trimmed)
    const existing = new Set(existingIds)
    const id = existing.has(base) ? `${base}_${Date.now().toString(36)}` : base
    const def: AttributeDefinition = { ...settings, id, name: trimmed, type }
    const listId = effectiveTarget === ITEM_ONLY_TARGET ? null : effectiveTarget
    onCreate(def, value, listId)
    // Keep type/target for rapid entry; clear the name and value.
    setName("")
    setValue("")
  }

  return (
    <div className="id-attr-creator" data-testid="attribute-creator">
      <div className="id-attr-creator-head">
        <Label className="text-sm font-medium">Create attribute</Label>
        {onClose && (
          <button type="button" className="id-attr-icon-key" onClick={onClose} aria-label="Hide new attribute">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="id-attr-palette" role="radiogroup" aria-label="Attribute type">
        {groups.map(({ group, types }) => (
          <div key={group} className="id-attr-palette-group">
            <span className="id-attr-palette-plate">{group}</span>
            <div className="id-attr-palette-keys">
              {types.map((t) => (
                <button
                  key={t.type}
                  type="button"
                  role="radio"
                  aria-checked={type === t.type}
                  className="id-attr-type-key"
                  title={`${t.blurb} e.g. ${t.example}`}
                  onClick={() => pickType(t.type)}
                >
                  <span className="id-attr-glyph" aria-hidden>
                    {t.glyph}
                  </span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="id-attr-type-blurb" aria-live="polite">
        <span className="id-attr-glyph" aria-hidden>
          {info.glyph}
        </span>
        <strong>{info.label}.</strong> {info.blurb} <em>e.g. {info.example}</em>
      </p>

      <div className="id-attr-creator-grid">
        <div className="space-y-1">
          <Label className="text-[10px]">Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. ISBN"
            className="h-8"
            autoFocus={Boolean(onClose)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate()
            }}
          />
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
      </div>

      {!NO_SETTINGS.has(type) && (
        <div className="id-attr-settings">
          <span className="id-attr-palette-plate">Settings</span>
          <div className="flex flex-wrap items-end gap-2">
            <TypeSpecificSchemaFields def={draftDef} onPatch={(patch) => setSettings((prev) => ({ ...prev, ...patch }))} />
          </div>
        </div>
      )}

      {type !== "formula" && (
        <div className="space-y-1">
          <Label className="text-[10px]">Initial value</Label>
          <AttributeValueField def={draftDef} value={value} onChange={setValue} />
        </div>
      )}

      <div className="id-attr-creator-foot">
        <p className="text-[11px] text-muted-foreground">
          {effectiveTarget === ITEM_ONLY_TARGET
            ? "Stored on just this item."
            : "Added to the list — every item in it gets this attribute."}
        </p>
        <Button type="button" size="sm" variant="outline" className="id-btn id-btn-primary" disabled={!name.trim()} onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Create
        </Button>
      </div>
    </div>
  )
}
