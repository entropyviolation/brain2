/**
 * components/Home/Tracking/confirm-planned-dialog.tsx — Plan became real
 *
 * Day Log ghosts are the plan. Confirming one paints the same window onto the
 * active Tracking pen (optionally retimed, named, noted) and, when the plan
 * was a task, marks it complete through `completeTask` so dependents unlock
 * the same way To Do does.
 */
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { completeTask } from "@/lib/services/completion-service"
import { minutesToTimeString, timeStringToMinutes } from "@/lib/time-entries"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { PenSwatches } from "@/components/Home/Tracking/pen-swatches"
import type { CalendarEvent, Task } from "@/lib/types"
import { snapshotsEqual } from "@/lib/unsaved-changes"
import { UnsavedChangesDialog, unsavedDismissProps, useUnsavedGuard } from "@/components/ui/unsaved-changes-guard"
import "./tracking-chrome.css"

export function ConfirmPlannedDialog({
  dateKey,
  scopeId,
  task,
  event,
  startMin,
  endMin,
  onClose,
}: {
  dateKey: string
  scopeId: string
  task?: Task
  event?: CalendarEvent
  startMin: number
  endMin: number
  onClose: () => void
}) {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const tags = useTimeTrackingStore((s) => s.tags)
  const selectedPenId = useTimeTrackingStore((s) => s.selectedPenId)
  const paintMinutes = useTimeTrackingStore((s) => s.paintMinutes)
  const addPen = useTimeTrackingStore((s) => s.addPen)
  const confirmEventId = useTimeTrackingStore((s) => s.confirmEventId)
  const penSort = useTimeTrackingStore((s) => s.penSort)
  const selectedVariantIds = useTimeTrackingStore((s) => s.selectedVariantIds)

  const scope = scopes.find((s) => s.id === scopeId)
  const initialPen =
    selectedPenId && selectedPenId !== "ERASE" && selectedPenId !== "SCISSORS" && scope?.pens.some((p) => p.id === selectedPenId)
      ? selectedPenId
      : (scope?.pens[0]?.id ?? "")

  const label = task?.description || event?.title || "Planned"
  const [penId, setPenId] = useState(initialPen)
  const [from, setFrom] = useState(minutesToTimeString(startMin))
  const [to, setTo] = useState(minutesToTimeString(endMin % 1440 === 0 ? 0 : endMin))
  const [title, setTitle] = useState(label)
  const [notes, setNotes] = useState("")

  const save = () => {
    const start = timeStringToMinutes(from)
    const parsedEnd = timeStringToMinutes(to)
    if (start === null || parsedEnd === null || !scope || !penId) return
    const end = parsedEnd === 0 ? 1440 : parsedEnd
    const duration = end > start ? end - start : 1440 - start + end
    paintMinutes(dateKey, scope.id, start, end, penId, selectedVariantIds, undefined, undefined, {
      title: title.trim() || undefined,
      notes: notes.trim() || undefined,
    })
    if (task && !task.completed) {
      completeTask(task.id, { actualDuration: duration })
    }
    if (event) confirmEventId(event.id)
    onClose()
  }

  const draft = { penId, from, to, title, notes }
  const [baseline] = useState(draft)
  const isDirty = !snapshotsEqual(draft, baseline)
  const guard = useUnsavedGuard({
    open: true,
    onOpenChange: (next) => {
      if (!next) onClose()
    },
    isDirty,
    onSave: () => {
      save()
    },
  })

  if (!scope) return null

  return (
    <>
    <Dialog open onOpenChange={guard.handleOpenChange}>
      <DialogContent className="trk95 trk-dialog sm:max-w-md" {...unsavedDismissProps(guard.requestClose)}>
        <DialogHeader>
          <DialogTitle>Confirm {label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="trk-help">
            {task
              ? "Paint this onto Tracking and mark the task done for the day. Anything waiting on it unlocks."
              : "Paint this onto Tracking so it is logged time, not only a plan."}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="confirm-from">When</Label>
              <Input id="confirm-from" type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="confirm-to">Until</Label>
              <Input id="confirm-to" type="time" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="confirm-title">Name</Label>
            <Input id="confirm-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Pen</Label>
            <PenSwatches
              pens={scope.pens}
              tags={tags}
              selectedId={penId}
              onSelect={setPenId}
              onCreate={(name, color) => {
                const id = addPen(scope.id, { name, color })
                if (id) setPenId(id)
              }}
              sortMode={penSort}
              compact
            />
          </div>
          <div>
            <Label htmlFor="confirm-notes">Notes</Label>
            <Textarea id="confirm-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={save} disabled={!penId}>
              Confirm
            </Button>
            <Button variant="outline" onClick={guard.requestClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <UnsavedChangesDialog {...guard.prompt} />
    </>
  )
}
