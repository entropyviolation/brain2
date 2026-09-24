/**
 * components/Home/Tracking/pen-settings-dialog.tsx — Per-pen settings
 *
 * Opened from the pen palette in the TimeGrid. Renames and recolors the pen, and
 * manages the things layered on top of it:
 *
 * - **Counts as** — nest this pen under another in the same view. Painting still
 *   writes this pen; the grid and Analytics can roll it up to the parent.
 *   Searchable control + Create new pen. One parent (multiselect / parallel
 *   chains are planned, not implemented). Color chain for navigation.
 * - **Tags** — cross-scope, and how a pen feeds the Habits tab.
 * - **Default action format** — Done-today templates, separate from habit links.
 * - **Variants** — a finer cut inside this pen.
 */
"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { ColorSwatch } from "@/components/ui/color-swatch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Check, Plus, Trash2 } from "lucide-react"
import { useTimeTrackingStore, type PenActionFormat, type TrackPen } from "@/lib/time-tracking-store"
import { validParents } from "@/lib/pen-tree"
import { useHabitsStore } from "@/lib/habits-store"
import { activeTrackingLink } from "@/lib/habit-tracking"
import { PenParentPicker } from "@/components/Home/Tracking/pen-parent-picker"
import { PenChainVisual } from "@/components/Home/Tracking/pen-chain-visual"
import { PenActionFormatEditor } from "@/components/Home/Tracking/pen-action-format-editor"
import { usePenActionSync } from "@/lib/pen-action-sync"
import { OrbPickerDialog } from "@/components/Icons/OrbPicker"
import { snapshotsEqual } from "@/lib/unsaved-changes"
import { UnsavedChangesDialog, unsavedDismissProps, useUnsavedGuard } from "@/components/ui/unsaved-changes-guard"
import "./tracking-chrome.css"

interface PenSettingsDialogProps {
  scopeId: string
  pen: TrackPen
  onClose: () => void
  onDeleted?: () => void
}

export function PenSettingsDialog({ scopeId, pen: openedPen, onClose, onDeleted }: PenSettingsDialogProps) {
  usePenActionSync()
  const tags = useTimeTrackingStore((s) => s.tags)
  const updatePen = useTimeTrackingStore((s) => s.updatePen)
  const removePen = useTimeTrackingStore((s) => s.removePen)
  const addPen = useTimeTrackingStore((s) => s.addPen)
  const addTag = useTimeTrackingStore((s) => s.addTag)
  const setPenParent = useTimeTrackingStore((s) => s.setPenParent)
  const habits = useHabitsStore((s) => s.tasks)

  const [editingId, setEditingId] = useState(openedPen.id)
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
  const [pickingImage, setPickingImage] = useState(false)

  const addVariant = useTimeTrackingStore((s) => s.addVariant)
  const updateVariant = useTimeTrackingStore((s) => s.updateVariant)
  const removeVariant = useTimeTrackingStore((s) => s.removeVariant)
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
    // Intentionally reset the form when navigating to another pen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, livePen?.id])

  const flush = (target = livePen ?? pen) => {
    updatePen(scopeId, {
      ...target,
      name: name.trim() || target.name,
      color,
      tags: tagIds,
      variantLabel: variantLabel.trim() || undefined,
      image: image || undefined,
      actionFormats: actionFormats.filter((f) => f.template.trim()).length
        ? actionFormats.filter((f) => f.template.trim())
        : undefined,
    })
  }

  const openPen = (id: string) => {
    if (id === editingId) return
    flush()
    setEditingId(id)
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
    { name, color, tagIds, variantLabel, actionFormats, image },
    {
      name: pen.name,
      color: pen.color,
      tagIds: pen.tags ?? [],
      variantLabel: pen.variantLabel ?? "",
      actionFormats: pen.actionFormats ?? [],
      image: pen.image ?? "",
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
      <DialogContent className="trk95 trk-dialog sm:max-w-md max-h-[85vh] overflow-y-auto" data-ui-name="Pen settings" data-ui-docs="components/Home/Tracking/README.md" {...unsavedDismissProps(guard.requestClose)}>
        <DialogHeader>
          <DialogTitle style={{ color }}>Pen settings · {pen.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
            <div>
              <Label htmlFor="pen-name">Name</Label>
              <Input id="pen-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="pen-color">Color</Label>
              <ColorSwatch id="pen-color" value={color} onChange={setColor} aria-label="Pen color" size="lg" />
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
                  style={{ backgroundImage: `url("${image}")`, background: color }}
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
              Nest this pen under a broader one in <strong>this view</strong>. Painting still writes{" "}
              <strong>{name || pen.name}</strong> — the grid and Analytics can roll those minutes up to the
              parent (Ocean Beach can roll up to San Diego; San Diego does not become Ocean Beach). Already-logged
              time follows the assignment. One parent only; several parallel chains are planned, not built yet.
            </p>
            <PenParentPicker
              pens={parents}
              treePens={scopePens}
              parentId={livePen?.parentId}
              currentName={name || pen.name}
              onSelect={(id) => setPenParent(scopeId, pen.id, id)}
              onCreate={(parentName, parentColor) => {
                const id = addPen(scopeId, { name: parentName, color: parentColor })
                if (id) setPenParent(scopeId, pen.id, id)
              }}
            />
            <PenChainVisual pens={scopePens} penId={pen.id} onOpenPen={openPen} />
          </div>

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
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    aria-pressed={on}
                    className="trk-tag"
                    style={on ? { background: tag.color, borderColor: tag.color, color: "#fff" } : undefined}
                  >
                    {on ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <span className="inline-block w-2.5 h-2.5" style={{ background: tag.color }} />
                    )}
                    {tag.name}
                  </button>
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

          <PenActionFormatEditor
            key={pen.id}
            penName={name || pen.name}
            formats={actionFormats}
            onChange={setActionFormats}
          />

          <div className="trk-section space-y-2">
            <Label htmlFor="pen-variant-label" className="trk-section-title">
              Break this pen down by…
            </Label>
            <p className="trk-help">
              Optional finer detail inside {name || pen.name}. More than one can apply to the same minutes, and
              Analytics shows the pen&apos;s total before splitting it by these.
            </p>
            <Input
              id="pen-variant-label"
              value={variantLabel}
              onChange={(e) => setVariantLabel(e.target.value)}
              placeholder="What the options answer, e.g. Who with?"
              className="h-8"
            />
            <div className="space-y-1">
              {variants.map((variant) => (
                <div key={variant.id} className="flex items-center gap-2">
                  <ColorSwatch
                    value={variant.color || color}
                    onChange={(next) => updateVariant(scopeId, pen.id, { ...variant, color: next })}
                    aria-label={`Color for ${variant.name}`}
                    size="sm"
                  />
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
                    title={`Remove ${variant.name} — tracked time is kept, it just loses this label`}
                    onClick={() => removeVariant(scopeId, pen.id, variant.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="sr-only">Remove {variant.name}</span>
                  </Button>
                </div>
              ))}
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
          </div>

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
