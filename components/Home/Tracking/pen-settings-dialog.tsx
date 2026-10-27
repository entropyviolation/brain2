/**
 * components/Home/Tracking/pen-settings-dialog.tsx — Per-pen settings
 *
 * Opened from the pen palette in the TimeGrid. Renames and recolors the pen, and
 * manages the things layered on top of it:
 *
 * - **Counts as** — nest this pen under another in the same view. Painting still
 *   writes this pen; the grid and Data can roll it up to the parent.
 *   Searchable control + Create new pen. Several parents can be ticked; the
 *   first is the display parent. Color chain for navigation.
 * - **Detail** — the same relationship, seen from the parent. Adding Walk under
 *   Exercise creates a Walk pen that counts as Exercise. Nesting Walk under
 *   Exercise adds Walk to Exercise's detail list. Several can apply at once.
 *   **From another view** adds a pen from a different view as a detail
 *   (Company people under Activity "Hanging out"). Those rows show the view
 *   name and follow that pen's name and color; double-click opens it there.
 * - **Tags** — cross-scope, and how a pen feeds the Habits tab.
 * - **Default action format** — Done-today templates, separate from habit links.
 * - **People** — Company pens only. People I Know pipelines for this pen.
 * - **Recent blocks** — a scrollable list of the latest blocks painted with this
 *   pen; a row opens the block editor (`pen-recent-blocks.tsx`).
 */
"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { ColorSwatch } from "@/components/ui/color-swatch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Plus, Trash2 } from "lucide-react"
import { useTimeTrackingStore, type PenActionFormat, type TrackPen } from "@/lib/time-tracking-store"
import { validParents } from "@/lib/pen-tree"
import { useHabitsStore } from "@/lib/habits-store"
import { activeTrackingLink } from "@/lib/habit-tracking"
import { PenParentPicker } from "@/components/Home/Tracking/pen-parent-picker"
import { PenChainVisual } from "@/components/Home/Tracking/pen-chain-visual"
import { PenActionFormatEditor } from "@/components/Home/Tracking/pen-action-format-editor"
import { PersonPipelinesEditor } from "@/components/People/person-pipelines"
import { COMPANY_SCOPE_ID } from "@/lib/people-i-know"
import { usePenActionSync } from "@/lib/pen-action-sync"
import { OrbPickerDialog } from "@/components/Icons/OrbPicker"
import { snapshotsEqual } from "@/lib/unsaved-changes"
import { UnsavedChangesDialog, unsavedDismissProps, useUnsavedGuard } from "@/components/ui/unsaved-changes-guard"
import { CrossViewDetailPicker } from "@/components/Home/Tracking/cross-view-detail-picker"
import { openPenSettings } from "@/components/Home/Tracking/open-pen-settings"
import { PenRecentBlocks } from "@/components/Home/Tracking/pen-recent-blocks"
import { PenLinkedItems } from "@/components/Home/Tracking/pen-linked-items"
import { CatalogTagChip } from "@/components/Home/Tracking/catalog-tag-chip"
import { PenLevelPicker } from "@/components/Home/Tracking/pen-level-picker"
import { PenPlaceEditor } from "@/components/Home/Tracking/pen-place-editor"
import { PenPersonLink } from "@/components/Home/Tracking/pen-person-link"
import { PHONE_PEN_SCOPE_IDS } from "@/lib/phone-sync/person-links"
import { PenFieldsEditor } from "@/components/Home/Tracking/pen-fields-editor"
import { fieldsForBlock, type PenField } from "@/lib/pen-fields"
import "./tracking-settings.css"

/** Nameless fields are dropped; an empty list is stored as none. */
function cleanFields(fields: PenField[]): PenField[] | undefined {
  const kept = fields.map((f) => ({ ...f, name: f.name.trim() })).filter((f) => f.name)
  return kept.length ? kept : undefined
}
import { TAG_OPEN_TITLE } from "@/components/Home/Tracking/open-tag-settings"
import type { PenSettingsNav } from "@/components/Home/Tracking/pen-settings-host"
import "./tracking-chrome.css"

interface PenSettingsDialogProps {
  scopeId: string
  pen: TrackPen
  onClose: () => void
  onDeleted?: () => void
  nav?: PenSettingsNav
}

export function PenSettingsDialog({ scopeId, pen: openedPen, onClose, onDeleted, nav }: PenSettingsDialogProps) {
  usePenActionSync()
  const tags = useTimeTrackingStore((s) => s.tags)
  const updatePen = useTimeTrackingStore((s) => s.updatePen)
  const removePen = useTimeTrackingStore((s) => s.removePen)
  const addPen = useTimeTrackingStore((s) => s.addPen)
  const addTag = useTimeTrackingStore((s) => s.addTag)
  const setPenParents = useTimeTrackingStore((s) => s.setPenParents)
  const habits = useHabitsStore((s) => s.tasks)

  const [editingId] = useState(openedPen.id)
  const livePen = useTimeTrackingStore(
    (s) => s.scopes.find((sc) => sc.id === scopeId)?.pens.find((p) => p.id === editingId),
  )
  const pen = livePen ?? openedPen
  const [name, setName] = useState(pen.name)
  const [color, setColor] = useState(pen.color)
  const [tagIds, setTagIds] = useState<string[]>(pen.tags ?? [])
  const [newTag, setNewTag] = useState("")
  const [variantLabel, setVariantLabel] = useState(pen.variantLabel ?? "")
  const [newVariant, setNewVariant] = useState("")
  const [actionFormats, setActionFormats] = useState<PenActionFormat[]>(pen.actionFormats ?? [])
  const [image, setImage] = useState(pen.image ?? "")
  const [fields, setFields] = useState<PenField[]>(pen.fields ?? [])
  const [pickingImage, setPickingImage] = useState(false)

  const addVariant = useTimeTrackingStore((s) => s.addVariant)
  const updateVariant = useTimeTrackingStore((s) => s.updateVariant)
  const removeVariant = useTimeTrackingStore((s) => s.removeVariant)
  const addCrossViewDetail = useTimeTrackingStore((s) => s.addCrossViewDetail)
  const allScopes = useTimeTrackingStore((s) => s.scopes)
  const viewName = (id: string) => allScopes.find((sc) => sc.id === id)?.name ?? id
  const variants = livePen?.variants ?? []
  const scopePens = useTimeTrackingStore((s) => s.scopes.find((sc) => sc.id === scopeId)?.pens ?? [])
  const parents = validParents(scopePens, pen.id) as TrackPen[]

  useEffect(() => {
    const next = livePen ?? openedPen
    setName(next.name)
    setColor(next.color)
    setTagIds(next.tags ?? [])
    setVariantLabel(next.variantLabel ?? "")
    setActionFormats(next.actionFormats ?? [])
    setImage(next.image ?? "")
    setFields(next.fields ?? [])
    // Intentionally reset the form when navigating to another pen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, livePen?.id])

  // Linking a phone pen to a person renames it in the store; show that name.
  useEffect(() => {
    if (livePen?.personId) setName(livePen.name)
  }, [livePen?.personId, livePen?.name])

  const flush = (target = livePen ?? pen) => {
    updatePen(scopeId, {
      ...target,
      name: name.trim() || target.name,
      color,
      tags: tagIds,
      variantLabel: variantLabel.trim() || undefined,
      image: image || undefined,
      fields: cleanFields(fields),
      actionFormats: actionFormats.filter((f) => f.template.trim()).length
        ? actionFormats.filter((f) => f.template.trim())
        : undefined,
    })
  }

  const openPen = (id: string) => {
    if (id === editingId) return
    flush()
    openPenSettings(scopeId, id)
  }

  const step = (go: () => void) => {
    flush()
    go()
  }

  const createVariant = () => {
    if (!newVariant.trim()) return
    addVariant(scopeId, pen.id, newVariant.trim())
    setNewVariant("")
  }

  const toggleTag = (id: string) =>
    setTagIds((current) => (current.includes(id) ? current.filter((t) => t !== id) : [...current, id]))

  const createTag = () => {
    const id = addTag(newTag)
    if (!id) return
    setTagIds((current) => (current.includes(id) ? current : [...current, id]))
    setNewTag("")
  }

  const save = () => {
    flush()
    onClose()
  }

  const isDirty = !snapshotsEqual(
    { name, color, tagIds, variantLabel, actionFormats, image, fields },
    {
      name: pen.name,
      color: pen.color,
      tagIds: pen.tags ?? [],
      variantLabel: pen.variantLabel ?? "",
      actionFormats: pen.actionFormats ?? [],
      image: pen.image ?? "",
      fields: pen.fields ?? [],
    },
  )
  const guard = useUnsavedGuard({
    open: true,
    onOpenChange: (next) => {
      if (!next) onClose()
    },
    isDirty,
    onSave: () => {
      flush()
    },
  })

  const selected = new Set(tagIds)
  const feedingHabits = habits.filter((habit) => {
    const link = activeTrackingLink(habit)
    return link?.tagIds.some((id) => selected.has(id))
  })

  return (
    <>
    <Dialog open onOpenChange={guard.handleOpenChange}>
      <DialogContent className="trk95 trk-dialog trk-pen-settings sm:max-w-lg max-h-[85vh] overflow-y-auto" data-ui-name="Pen settings" data-ui-docs="components/Home/Tracking/README.md" {...unsavedDismissProps(guard.requestClose)}>
        <DialogHeader className="trk-dialog-head">
          <DialogTitle>
            {nav ? (
              <span className="mr-2 inline-flex gap-1 align-middle">
                <button type="button" data-no95="" aria-label="Previous pen" disabled={!nav.canBack} onClick={() => step(nav.back)}>
                  ‹
                </button>
                <button type="button" data-no95="" aria-label="Next pen" disabled={!nav.canForward} onClick={() => step(nav.forward)}>
                  ›
                </button>
              </span>
            ) : null}
            Pen · {name || pen.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="trk-pen-mast">
            <ColorSwatch id="pen-color" value={color} onChange={setColor} aria-label="Pen color" size="lg" />
            <div className="min-w-0">
              <Label htmlFor="pen-name">Name</Label>
              <Input id="pen-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>

          <div className="trk-section space-y-1.5">
            <Label className="trk-section-title">Image</Label>
            <p className="trk-help">
              Optional. Used in place of the solid color on the grid, tiling into a mosaic.
              Color stays the fallback on the well and in totals.
            </p>
            <div className="flex items-center gap-2">
              {image ? (
                <span
                  className="trk-selected-swatch"
                  style={{ background: `center / cover url("${image}"), ${color}` }}
                  aria-hidden
                />
              ) : null}
              <Button type="button" size="sm" variant="outline" onClick={() => setPickingImage(true)}>
                {image ? "Change image" : "Choose image"}
              </Button>
              {image ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => setImage("")}>
                  Clear
                </Button>
              ) : null}
            </div>
          </div>

          <div className="trk-section space-y-1.5">
            <Label className="trk-section-title">Counts as</Label>
            <p className="trk-help">
              Nest <strong>{name || pen.name}</strong> under broader pens in this view. Tick several.
              The first is the display parent — Show as follows that chain, and the grid keeps one color.
              Other parents share the minutes so those rows sum to the block, not past it. Painting still
              writes this pen. A pen that counts as this one also appears in Detail below.
            </p>
            <PenParentPicker
              pens={parents}
              treePens={scopePens}
              parentIds={livePen ? (livePen.parentIds ?? (livePen.parentId ? [livePen.parentId] : [])) : []}
              currentName={name || pen.name}
              onSelect={(ids) => setPenParents(scopeId, pen.id, ids)}
              onCreate={(parentName, parentColor) => {
                const id = addPen(scopeId, { name: parentName, color: parentColor })
                const current = livePen?.parentIds ?? (livePen?.parentId ? [livePen.parentId] : [])
                if (id) setPenParents(scopeId, pen.id, [...current, id])
              }}
            />
            <PenChainVisual pens={scopePens} penId={pen.id} onOpenPen={openPen} />
            <Label className="trk-section-title trk-level-title">Level category</Label>
            <PenLevelPicker scopeId={scopeId} penId={pen.id} penName={name || pen.name} />
          </div>

          {scopeId === "location" ? (
            <div className="trk-section space-y-2">
              <Label className="trk-section-title">Place</Label>
              <p className="trk-help">
                Where <strong>{name || pen.name}</strong> is. An address files it under its neighborhood, city, state, and
                country pens (made if missing). Coordinates and a zip are other names for this same place — a GPS fix
                inside one is {name || pen.name}, not something it counts as.
              </p>
              <PenPlaceEditor scopeId={scopeId} penId={pen.id} />
            </div>
          ) : null}

          {PHONE_PEN_SCOPE_IDS.includes(scopeId) ? (
            <div className="trk-section space-y-2">
              <Label className="trk-section-title">Person</Label>
              <p className="trk-help">
                Who this is in People I Know. Linking saves the number on them, and their texts and calls show their
                name.
              </p>
              <PenPersonLink scopeId={scopeId} penId={pen.id} />
            </div>
          ) : null}

          <div className="trk-section space-y-2">
            <Label className="trk-section-title">Tags</Label>
            <p className="trk-help">
              All time painted with this pen counts as these tags. Habits link tags to pull the time in automatically.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {tags.length === 0 && <span className="text-xs">No tags yet — add one below.</span>}
              {tags.map((tag) => {
                const on = selected.has(tag.id)
                return (
                  <CatalogTagChip
                    key={tag.id}
                    tag={tag}
                    pressed={on}
                    aria-label={tag.name}
                    title={TAG_OPEN_TITLE}
                    onClick={() => toggleTag(tag.id)}
                  />
                )
              })}
            </div>
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    createTag()
                  }
                }}
                placeholder="New tag (e.g. Cleaning)"
                className="h-8"
              />
              <Button size="sm" variant="outline" onClick={createTag} disabled={!newTag.trim()}>
                <Plus className="h-3.5 w-3.5" /> Add tag
              </Button>
            </div>
          </div>

          {scopeId === COMPANY_SCOPE_ID ? <PersonPipelinesEditor mode="pen" penId={pen.id} /> : null}

          <div className="trk-section space-y-2">
            <Label className="trk-section-title">Detail fields</Label>
            <p className="trk-help">
              What a block on <strong>{name || pen.name}</strong> asks for, beyond title and notes — Book(s) as text,
              Pages read as a number. A number field can fill a habit (Habits → the habit → Auto-fill from Tracking),
              and every field is a variable for the Done-today title below.
            </p>
            <PenFieldsEditor
              key={pen.id}
              ownerName={name || pen.name}
              fields={fields}
              onChange={setFields}
              inherited={fieldsForBlock([{ id: pen.id, name: pen.name, tags: tagIds }], tags).filter((row) => row.source === "tag")}
            />
          </div>

          <PenActionFormatEditor
            key={pen.id}
            penName={name || pen.name}
            formats={actionFormats}
            onChange={setActionFormats}
            fields={fieldsForBlock([{ id: pen.id, name: pen.name, tags: tagIds, fields }], tags).map((row) => row.field)}
          />

          <div className="trk-section space-y-2">
            <Label htmlFor="pen-variant-label" className="trk-section-title">
              Break this pen down by…
            </Label>
            <p className="trk-help">
              A detail of {name || pen.name} is a pen that counts as it. Add Walk here and Walk appears in the well,
              counting as {name || pen.name}. Nest Gym under {name || pen.name} and Gym shows up in this list.
              Several can apply to the same minutes. Double-click a color to open that pen. Data shows the
              total first, then these — including time painted on the detail pen itself.
            </p>
            <Input
              id="pen-variant-label"
              value={variantLabel}
              onChange={(e) => setVariantLabel(e.target.value)}
              placeholder="What the options answer, e.g. Who with?"
              className="h-8"
            />
            <div className="space-y-1">
              {variants.map((variant) =>
                variant.scopeId ? (
                <div key={variant.id} className="trk-detail-row" data-cross-view="true">
                  <span
                    className="trk-detail-bead trk-detail-bead-fixed"
                    style={{ background: variant.color || color }}
                    title={`Double-click to open ${variant.name} in ${viewName(variant.scopeId)}`}
                    onDoubleClick={() => {
                      if (!variant.penId || !variant.scopeId) return
                      flush()
                      openPenSettings(variant.scopeId, variant.penId)
                    }}
                    aria-hidden
                  />
                  <span className="trk-detail-xname">
                    {variant.name}
                    <span className="trk-variant-view">{viewName(variant.scopeId)}</span>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-1.5 text-destructive"
                    title={`Remove ${variant.name} as a detail. The ${viewName(variant.scopeId)} pen and its time stay.`}
                    onClick={() => removeVariant(scopeId, pen.id, variant.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="sr-only">Remove {variant.name}</span>
                  </Button>
                </div>
                ) : (
                <div key={variant.id} className="trk-detail-row">
                  <span
                    className="trk-detail-bead"
                    title={variant.penId ? `Double-click to open ${variant.name}` : variant.name}
                    onDoubleClick={() => {
                      if (variant.penId) openPen(variant.penId)
                    }}
                  >
                    <ColorSwatch
                      value={variant.color || color}
                      onChange={(next) => updateVariant(scopeId, pen.id, { ...variant, color: next })}
                      aria-label={`Color for ${variant.name}`}
                      size="sm"
                    />
                  </span>
                  <Input
                    value={variant.name}
                    onChange={(e) => updateVariant(scopeId, pen.id, { ...variant, name: e.target.value })}
                    className="h-7 text-sm"
                    aria-label={`Name for ${variant.name}`}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-1.5 text-destructive"
                    title={`Remove ${variant.name} — the pen stays in the well and no longer counts as this one. Painted minutes stay.`}
                    onClick={() => removeVariant(scopeId, pen.id, variant.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="sr-only">Remove {variant.name}</span>
                  </Button>
                </div>
                ),
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={newVariant}
                onChange={(e) => setNewVariant(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    createVariant()
                  }
                }}
                placeholder={variantLabel ? `New option (${variantLabel})` : "New option (e.g. Elijah)"}
                className="h-8"
              />
              <Button size="sm" variant="outline" onClick={createVariant} disabled={!newVariant.trim()}>
                <Plus className="h-3.5 w-3.5" /> Add option
              </Button>
            </div>
            {livePen ? (
              <CrossViewDetailPicker
                ownerScopeId={scopeId}
                pen={livePen}
                onAdd={(viewId, otherPenId) => addCrossViewDetail(scopeId, livePen.id, viewId, otherPenId)}
              />
            ) : null}
          </div>

          <PenRecentBlocks scopeId={scopeId} penId={pen.id} penName={name || pen.name} color={color} />

          <PenLinkedItems scopeId={scopeId} penId={pen.id} penName={name || pen.name} />

          <div className="trk-section text-xs">
            {feedingHabits.length > 0 ? (
              <>
                <span>Time with this pen counts toward: </span>
                <span className="font-medium">{feedingHabits.map((h) => h.name).join(", ")}</span>
              </>
            ) : (
              <span>
                No habit links these tags yet. Add one in Habits → edit a habit → Auto-fill from Tracking.
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <Button className="flex-1" onClick={save}>
              Save pen
            </Button>
            <Button
              variant="outline"
              className="text-destructive"
              onClick={() => {
                if (!confirm(`Delete pen "${pen.name}"? Painted time using it as the primary will be cleared.`)) return
                removePen(scopeId, pen.id)
                onDeleted?.()
                onClose()
              }}
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Delete pen</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <UnsavedChangesDialog {...guard.prompt} />
    {pickingImage && (
      <OrbPickerDialog
        open
        photo
        current={image || undefined}
        onClose={() => setPickingImage(false)}
        onSelect={(icon) => {
          setImage(icon ?? "")
          setPickingImage(false)
        }}
      />
    )}
    </>
  )
}
