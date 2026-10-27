/**
 * components/ItemDetail/attributes/ItemAttributesSection.tsx — Attributes panel for item detail
 *
 * The shared "Attributes" instrument used by both ItemDetail variants. It sits
 * at the top of Details, not under every other section:
 *  - a header plate with the attribute count and an **Add attribute** key that
 *    opens `AttributeCreator` right there (type palette + settings + value),
 *  - when the type has `detailLayout`, a picture-in-glass hero beside the
 *    featured readouts,
 *  - one grid of typed cells (type glyph, name, where the attribute comes from:
 *    the item type, a list, or this item only),
 *  - item-only cells carry a remove key; legacy values with no definition stay
 *    editable as "Other attributes".
 *
 * A text list can join a Brain2 list on the item (`textListIds`, `onBindTextList`).
 * Add attribute is the `.id-keycap` key.
 * _Last mapped: 2026-10-24_
 */
"use client"

import { useMemo, useState } from "react"
import { IsolatedInput } from "@/components/ui/isolated-text-field"
import { Plus, Trash2 } from "lucide-react"
import type { AttributeDefinition, AttributeValue, ItemDetailLayout, ItemType, List } from "@/lib/types"
import { mergeItemAttributes } from "@/components/Lists/attribute-editor"
import { AttributeValueField } from "@/components/Lists/attributes/AttributeValueField"
import { CompletionTiersPanel } from "@/components/Lists/attributes/CompletionTiersPanel"
import { effectiveDef } from "@/components/Lists/attributes/helpers"
import { hasCompletionTiers } from "@/lib/completion-tiers"
import { normalizeAttributeType } from "@/lib/attribute-utils"
import { attributeIsWide, attributeTypeInfo } from "@/lib/attribute-type-catalog"
import { useItemTypeStore } from "@/lib/item-type-store"
import { useAttachmentSrc } from "@/hooks/use-attachment-src"
import { AttributeCreator } from "@/components/ItemDetail/attributes/AttributeCreator"

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
  /** Type-owned layout: hero cover + featured attributes. */
  layout?: ItemDetailLayout
  /** Ids edited on another panel of this same view. They stay on the item and stay out of this one. */
  omitAttributeIds?: readonly string[]
  onChangeValues: (values: Record<string, AttributeValue>) => void
  /**
   * One attribute's text on every keystroke (no render). Hosts map it to
   * `touchDraft` merged with the latest draft attributes, so Cmd+S keeps
   * text that has not blurred yet. `onChangeValues` still fires on blur.
   */
  onLiveValue?: (id: string, value: AttributeValue) => void
  onChangeItemAttributeDefinitions?: (defs: AttributeDefinition[]) => void
  onCreateAttribute: (def: AttributeDefinition, value: AttributeValue, listId: string | null) => void
  /** Open the creator on mount (an item with no attributes yet). */
  defaultCreating?: boolean
  /** Opens another item in this same view; enables the "every type" demo key in the creator. */
  onOpenItem?: (id: string) => void
  /** Text-list attribute id → Brain2 list id. The join lives on the item, not the definition. */
  textListIds?: Record<string, string>
  /** Display names for attributes on this item only. */
  attributeLabels?: Record<string, string>
  /** Attribute ids hidden on this item's Details tab. */
  hiddenAttributeIds?: string[]
  /** Called after Make Brain2 List creates a list for this attribute. */
  onBindTextList?: (attributeId: string, listId: string) => void
  /** Open the list joined to a text list or a list reference. */
  onOpenTextList?: (listId: string) => void
}

function AttributeCell({
  def,
  source,
  value,
  allDefs,
  values,
  onChange,
  onLive,
  onRemove,
  featured = false,
  textListBinding,
  attributeLabels,
  onOpenList,
}: {
  def: AttributeDefinition
  source: string
  value: AttributeValue
  allDefs: AttributeDefinition[]
  values: Record<string, AttributeValue>
  onChange: (v: AttributeValue) => void
  onLive?: (v: AttributeValue) => void
  onRemove?: () => void
  featured?: boolean
  textListBinding?: {
    listId?: string
    onBind: (listId: string) => void
    onOpen?: (listId: string) => void
  }
  attributeLabels?: Record<string, string>
  onOpenList?: (listId: string) => void
}) {
  const type = normalizeAttributeType(def.type)
  const info = attributeTypeInfo(type)
  const wide = attributeIsWide(type)
  const displayName = attributeLabels?.[def.id]?.trim() || def.name
  return (
    <div
      className={`id-attr-cell${wide ? " is-wide" : ""}${featured ? " is-featured" : ""}`}
      data-attr-type={type}
      data-testid={`attr-cell-${def.id}`}
    >
      <div className="id-attr-cell-head">
        <span className="id-attr-glyph" title={`${info.label} — ${info.blurb}`} aria-hidden>
          {info.glyph}
        </span>
        <span className="id-attr-name">{displayName}</span>
        <span className="id-attr-source" title={`From ${source}`}>
          {source}
        </span>
        {onRemove && (
          <button type="button" className="id-attr-icon-key" onClick={onRemove} aria-label={`Remove ${displayName}`}>
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
      <AttributeValueField
        def={{ ...def, name: displayName }}
        value={value}
        onChange={onChange}
        onLive={onLive}
        definitions={allDefs}
        siblingValues={values}
        textListBinding={textListBinding}
        onOpenList={onOpenList}
      />
    </div>
  )
}

export function ItemAttributesSection({
  attributes,
  itemCategoryIds,
  categories,
  itemAttributeDefinitions = [],
  itemType,
  layout,
  omitAttributeIds,
  onChangeValues,
  onLiveValue,
  onChangeItemAttributeDefinitions,
  onCreateAttribute,
  defaultCreating = false,
  onOpenItem,
  textListIds,
  attributeLabels,
  hiddenAttributeIds,
  onBindTextList,
  onOpenTextList,
}: ItemAttributesSectionProps) {
  const types = useItemTypeStore((s) => s.types)
  const [creating, setCreating] = useState(defaultCreating)
  const schemaDefs = useMemo(
    () => mergeItemAttributes({ type: itemType, lists: itemCategoryIds }, categories, types),
    [itemType, categories, itemCategoryIds, types],
  )

  const itemOnlyDefs = useMemo(() => (itemAttributeDefinitions ?? []).map(effectiveDef), [itemAttributeDefinitions])
  const values = attributes || {}

  // Where each schema attribute comes from: the item's type, else the first list that defines it.
  const sourceOf = useMemo(() => {
    const typeDef = types.find((t) => t.id === itemType)
    const typeIds = new Set((typeDef?.attributes ?? []).map((a) => a.id))
    const map = new Map<string, string>()
    for (const def of schemaDefs) {
      if (typeIds.has(def.id)) {
        map.set(def.id, typeDef!.name)
        continue
      }
      const list = itemCategoryIds
        .map((id) => categories.find((c) => c.id === id))
        .find((c) => c?.itemAttributes?.some((a) => a.id === def.id))
      map.set(def.id, list?.name ?? "Type")
    }
    return map
  }, [types, itemType, schemaDefs, itemCategoryIds, categories])

  // Legacy values with no definition anywhere (e.g. pre-migration item-only attrs).
  const orphanIds = useMemo(() => {
    const known = new Set([...schemaDefs.map((d) => d.id), ...itemOnlyDefs.map((d) => d.id)])
    return Object.keys(values).filter((id) => !known.has(id))
  }, [values, schemaDefs, itemOnlyDefs])

  const existingIds = useMemo(
    () => [...schemaDefs.map((d) => d.id), ...itemOnlyDefs.map((d) => d.id), ...Object.keys(values)],
    [schemaDefs, itemOnlyDefs, values],
  )

  const omitted = new Set([...(omitAttributeIds ?? []), ...(hiddenAttributeIds ?? [])])
  const visibleSchema = schemaDefs.filter((d) => !omitted.has(d.id))
  const featuredIds = layout?.featuredAttributeIds ?? []
  const heroId = layout?.heroImageAttrId
  const featuredDefs = visibleSchema.filter((d) => featuredIds.includes(d.id) && d.id !== heroId)
  const restDefs = visibleSchema.filter((d) => d.id !== heroId && !featuredIds.includes(d.id))
  const heroDef = heroId && !omitted.has(heroId) ? visibleSchema.find((d) => d.id === heroId) : undefined
  const visibleItemOnly = itemOnlyDefs.filter((d) => !omitted.has(d.id))
  const visibleOrphans = orphanIds.filter((id) => !omitted.has(id))
  const allDefs = useMemo(() => [...schemaDefs, ...itemOnlyDefs], [schemaDefs, itemOnlyDefs])
  // Formula cells are computed, never stored, so they are not counted as fillable.
  const fillable = [...visibleSchema, ...visibleItemOnly].filter((d) => normalizeAttributeType(d.type) !== "formula")
  const count = fillable.length + visibleOrphans.length
  const filled = fillable.filter((d) => {
    const v = values[d.id]
    return v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)
  }).length
  const heroValue = heroId ? values[heroId] : undefined
  const heroUri =
    typeof heroValue === "string" ? heroValue : Array.isArray(heroValue) ? String(heroValue[0] ?? "") : ""
  const heroUrl = useAttachmentSrc(heroUri)

  const set = (id: string, v: AttributeValue) => onChangeValues({ ...values, [id]: v })
  const removeOrphan = (id: string) => {
    const next = { ...values }
    delete next[id]
    onChangeValues(next)
  }

  const removeItemOnly = (id: string) => {
    onChangeItemAttributeDefinitions?.(itemAttributeDefinitions.filter((d) => d.id !== id))
    const next = { ...values }
    delete next[id]
    onChangeValues(next)
  }

  const cell = (def: AttributeDefinition, source: string, opts: { featured?: boolean; removable?: boolean } = {}) => {
    const d = effectiveDef(def)
    return (
      <AttributeCell
        key={d.id}
        def={d}
        source={source}
        value={values[d.id]}
        allDefs={allDefs}
        values={values}
        onChange={(v) => set(d.id, v)}
        onLive={onLiveValue ? (v) => onLiveValue(d.id, v) : undefined}
        onRemove={opts.removable ? () => removeItemOnly(d.id) : undefined}
        featured={opts.featured}
        attributeLabels={attributeLabels}
        onOpenList={onOpenTextList}
        textListBinding={
          onBindTextList && normalizeAttributeType(d.type) === "multistring"
            ? {
                listId: textListIds?.[d.id],
                onBind: (listId) => onBindTextList(d.id, listId),
                onOpen: onOpenTextList,
              }
            : undefined
        }
      />
    )
  }

  return (
    <section className="id-attrs" aria-label="Attributes">
      <header className="id-attrs-head">
        <span className="id-attrs-plate">Attributes</span>
        <span className="id-attrs-count" title={`${filled} of ${count} filled`}>
          {filled}/{count}
        </span>
        <button
          type="button"
          className="id-keycap id-attrs-add"
          aria-expanded={creating}
          onClick={() => setCreating((v) => !v)}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add attribute
        </button>
      </header>

      {creating && (
        <AttributeCreator
          categories={categories}
          itemCategoryIds={itemCategoryIds}
          existingIds={existingIds}
          onCreate={onCreateAttribute}
          onClose={() => setCreating(false)}
        />
      )}
      {creating && onOpenItem && (
        <button
          type="button"
          className="id-note-pin-key"
          onClick={() => {
            void import("@/lib/attribute-demo").then(({ ensureAttributeDemo }) =>
              ensureAttributeDemo().then((id) => {
                setCreating(false)
                onOpenItem(id)
              }),
            )
          }}
        >
          See every type filled in on the Attribute Demo item →
        </button>
      )}

      {(heroDef || featuredDefs.length > 0) && (
        <div className={`id-attrs-hero${heroDef ? " has-picture" : ""}`}>
          {heroDef && (
            <div className="id-attrs-hero-glass">
              {heroUrl ? (
                <img src={heroUrl} alt={heroDef.name} />
              ) : (
                <div className="id-attrs-hero-empty">No {heroDef.name.toLowerCase()} yet</div>
              )}
              <div className="id-attrs-hero-pick">
                <AttributeValueField def={effectiveDef(heroDef)} value={values[heroDef.id]} onChange={(v) => set(heroDef.id, v)} />
              </div>
            </div>
          )}
          {featuredDefs.length > 0 && (
            <div className="id-attrs-featured" aria-label="Featured">
              {featuredDefs.map((def) => cell(def, sourceOf.get(def.id) ?? "Type", { featured: true }))}
            </div>
          )}
        </div>
      )}

      {hasCompletionTiers(visibleSchema) && <CompletionTiersPanel definitions={visibleSchema} values={values} />}

      {restDefs.length + visibleItemOnly.length > 0 ? (
        <div className="id-attrs-grid">
          {restDefs.map((def) => cell(def, sourceOf.get(def.id) ?? "Type"))}
          {visibleItemOnly.map((def) => cell(def, "This item only", { removable: true }))}
        </div>
      ) : !heroDef && featuredDefs.length === 0 && visibleOrphans.length === 0 ? (
        <p className="id-attrs-empty">
          No attributes yet. Add one to record what this item is: an author, a price, a date, a photo, a link.
        </p>
      ) : null}

      {visibleOrphans.length > 0 && (
        <div className="id-attrs-orphans">
          <span className="id-attrs-subplate">Other attributes</span>
          {visibleOrphans.map((id) => (
            <div key={id} className="id-attrs-orphan">
              <span className="text-sm font-medium truncate" title={humanizeId(id)}>
                {humanizeId(id)}
              </span>
              <IsolatedInput
                value={typeof values[id] === "string" ? (values[id] as string) : String(values[id] ?? "")}
                onCommit={(v) => set(id, v)}
                className="h-8"
              />
              <button type="button" className="id-attr-icon-key" onClick={() => removeOrphan(id)} aria-label={`Remove ${humanizeId(id)}`}>
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
