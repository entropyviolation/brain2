/**
 * components/Home/Tracking/tag-settings-dialog.tsx — Per-tag settings
 *
 * Opened from the habit tag catalog or the Tracking tag library. Renames and
 * recolors through `commitCatalogTagEdit` (same write as either habit row).
 * Wiring sections are read-only: pens that carry the id, habits that minute-fill
 * from it, habits whose done-count name matches, and operations that list it.
 * Create-from-name is for an item tag that is not yet in the Tracking catalog.
 */
"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { ColorSwatch } from "@/components/ui/color-swatch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Trash2 } from "lucide-react"
import { commitCatalogTagEdit } from "@/lib/catalog-tag"
import { activeTrackingLink } from "@/lib/habit-tracking"
import { useHabitsStore } from "@/lib/habits-store"
import { normalizeTag } from "@/lib/links"
import { isOperation } from "@/lib/operations"
import { getOperationTrackingTagIds } from "@/lib/operation-types"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore, type TrackTag } from "@/lib/time-tracking-store"
import { openTagSettings, publishTagCatalogEdit } from "@/components/Home/Tracking/open-tag-settings"
import { snapshotsEqual } from "@/lib/unsaved-changes"
import { UnsavedChangesDialog, unsavedDismissProps, useUnsavedGuard } from "@/components/ui/unsaved-changes-guard"
import "./tracking-chrome.css"

type TagSettingsDialogProps =
  | {
      mode: "edit"
      tag: TrackTag
      onClose: () => void
      onDeleted?: () => void
    }
  | {
      mode: "create"
      name: string
      onClose: () => void
      onDeleted?: never
    }

function WiringList({ label, names }: { label: string; names: string[] }) {
  return (
    <div className="trk-section text-xs space-y-1">
      <Label className="trk-section-title">{label}</Label>
      {names.length > 0 ? (
        <p className="font-medium">{names.join(", ")}</p>
      ) : (
        <p className="trk-help">None</p>
      )}
    </div>
  )
}

export function TagSettingsDialog(props: TagSettingsDialogProps) {
  if (props.mode === "create") {
    return <CreateTagSettings name={props.name} onClose={props.onClose} />
  }
  return <EditTagSettings tag={props.tag} onClose={props.onClose} onDeleted={props.onDeleted} />
}

function CreateTagSettings({ name, onClose }: { name: string; onClose: () => void }) {
  const addTag = useTimeTrackingStore((s) => s.addTag)
  const display = name.trim() || name

  const create = () => {
    const id = addTag(display)
    if (!id) return
    openTagSettings(id)
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent
        className="trk95 trk-dialog sm:max-w-md max-h-[85vh] overflow-y-auto"
        data-ui-name="Tag settings"
        data-ui-docs="components/Home/Tracking/README.md"
      >
        <DialogHeader className="trk-dialog-head">
          <DialogTitle>Tag · {display}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="trk-section space-y-1.5">
            <Label className="trk-section-title">Item tag only</Label>
            <p className="trk-help">
              <strong>{display}</strong> is used on items, but it is not a Tracking
              catalog tag yet. Create one to rename, recolor, and wire pens, habits,
              and operations from here.
            </p>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={create} autoFocus>
              Create Tracking tag
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function EditTagSettings({
  tag: openedTag,
  onClose,
  onDeleted,
}: {
  tag: TrackTag
  onClose: () => void
  onDeleted?: () => void
}) {
  const liveTag = useTimeTrackingStore((s) => s.tags.find((item) => item.id === openedTag.id))
  const tag = liveTag ?? openedTag
  const removeTag = useTimeTrackingStore((s) => s.removeTag)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const habits = useHabitsStore((s) => s.tasks)
  const tasks = useTaskStore((s) => s.tasks)

  const [name, setName] = useState(tag.name)
  const [color, setColor] = useState(tag.color)

  useEffect(() => {
    setName(tag.name)
    setColor(tag.color)
  }, [tag.id, tag.name, tag.color])

  const flush = () => {
    const current = liveTag ?? tag
    const before = { name: current.name, color: current.color }
    const result = commitCatalogTagEdit(current, { name, color })
    if (
      result &&
      (result.replacedId ||
        result.fromName !== result.toName ||
        result.tag.color !== before.color ||
        result.tag.name !== before.name)
    ) {
      publishTagCatalogEdit(result)
    }
    return result
  }

  const save = () => {
    flush()
    onClose()
  }

  const isDirty = !snapshotsEqual(
    { name: name.trim() || tag.name, color },
    { name: tag.name, color: tag.color },
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

  const penNames = scopes.flatMap((scope) =>
    scope.pens
      .filter((pen) => pen.tags?.includes(tag.id))
      .map((pen) => (scope.name ? `${pen.name} (${scope.name})` : pen.name)),
  )

  const minuteHabits = habits
    .filter((habit) => activeTrackingLink(habit)?.tagIds.includes(tag.id))
    .map((habit) => habit.name)

  const wantName = normalizeTag(tag.name)
  const countHabits = habits
    .filter((habit) => habit.taggedTaskTag != null && normalizeTag(habit.taggedTaskTag) === wantName)
    .map((habit) => habit.name)

  const operationNames = tasks
    .filter((task) => isOperation(task) && getOperationTrackingTagIds(task).includes(tag.id))
    .map((task) => task.title || task.description || task.id)

  const deleteTag = () => {
    const warn = minuteHabits.length
      ? `Delete tag "${tag.name}"? ${minuteHabits.length} habit(s) will stop auto-counting this time.`
      : `Delete tag "${tag.name}"?`
    if (!confirm(warn)) return
    removeTag(tag.id)
    onDeleted?.()
    onClose()
  }

  return (
    <>
      <Dialog open onOpenChange={guard.handleOpenChange}>
        <DialogContent
          className="trk95 trk-dialog sm:max-w-md max-h-[85vh] overflow-y-auto"
          data-ui-name="Tag settings"
          data-ui-docs="components/Home/Tracking/README.md"
          {...unsavedDismissProps(guard.requestClose)}
        >
          <DialogHeader className="trk-dialog-head">
            <DialogTitle>Tag · {name || tag.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="trk-pen-mast">
              <ColorSwatch id="tag-color" value={color} onChange={setColor} aria-label="Tag color" size="lg" />
              <div className="min-w-0">
                <Label htmlFor="tag-name">Name</Label>
                <Input
                  id="tag-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-label="Tag name"
                  autoFocus
                />
              </div>
            </div>

            <WiringList label="Pens" names={penNames} />
            <WiringList label="Habits (minutes)" names={minuteHabits} />
            <WiringList label="Habits (done-count)" names={countHabits} />
            <WiringList label="Operations" names={operationNames} />

            <div className="flex gap-2">
              <Button className="flex-1" onClick={save} disabled={!name.trim()}>
                Save
              </Button>
              <Button type="button" variant="outline" onClick={() => guard.requestClose()}>
                Cancel
              </Button>
              <Button type="button" variant="outline" className="text-destructive" onClick={deleteTag}>
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <UnsavedChangesDialog {...guard.prompt} />
    </>
  )
}
