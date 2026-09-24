/**
 * components/Home/Plan/planned-action-dialog.tsx — Create/edit a planned action
 *
 * Title, start, duration, and time-block notes. Not the event dialog.
 * Persist goes through `lib/planned-action-store.ts`. Toolbar **Add Plan**
 * opens this with `action` null and `createDate` set.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { snapshotsEqual } from "@/lib/unsaved-changes"
import { UnsavedChangesDialog, unsavedDismissProps, useUnsavedGuard } from "@/components/ui/unsaved-changes-guard"
import { formatLocalDateKey } from "@/lib/date-utils"
import {
  DEFAULT_PLANNED_MINUTES,
  defaultTitle,
  hhmmToMinutes,
  makePlannedAction,
  plannedDurationMinutes,
  timesFromStartAndDuration,
  type PlannedAction,
} from "@/lib/planned-actions"
import { usePlannedActionStore } from "@/lib/planned-action-store"

interface PlannedActionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  action: PlannedAction | null
  /** Local day for a new free plan when `action` is null. */
  createDate?: Date
}

function draftOf(action: PlannedAction | null) {
  if (!action) {
    return { title: "", startTime: "09:00", duration: DEFAULT_PLANNED_MINUTES, notes: "" }
  }
  return {
    title: action.title,
    startTime: action.startTime,
    duration: plannedDurationMinutes(action),
    notes: action.notes,
  }
}

export function PlannedActionDialog({ open, onOpenChange, action, createDate }: PlannedActionDialogProps) {
  const addAction = usePlannedActionStore((s) => s.addAction)
  const updateAction = usePlannedActionStore((s) => s.updateAction)
  const deleteAction = usePlannedActionStore((s) => s.deleteAction)
  const [draft, setDraft] = useState(() => draftOf(action))
  const [baseline, setBaseline] = useState(() => draftOf(action))

  const isCreate = !action
  const dayLabel = action?.date ?? (createDate ? formatLocalDateKey(createDate) : "")

  useEffect(() => {
    if (!open) return
    const next = draftOf(action)
    setDraft(next)
    setBaseline(next)
  }, [open, action?.id])

  const isDirty = useMemo(() => open && !snapshotsEqual(draft, baseline), [open, draft, baseline])

  const persist = () => {
    const times = timesFromStartAndDuration(hhmmToMinutes(draft.startTime), Number(draft.duration) || DEFAULT_PLANNED_MINUTES)
    if (action) {
      updateAction({
        ...action,
        title: draft.title.trim() || action.title,
        notes: draft.notes,
        startTime: times.startTime,
        endTime: times.endTime,
      })
      return
    }
    if (!createDate) return
    addAction(
      makePlannedAction({
        date: formatLocalDateKey(createDate),
        startTime: times.startTime,
        endTime: times.endTime,
        source: "free",
        title: draft.title.trim() || defaultTitle("free"),
        notes: draft.notes,
      }),
    )
  }

  const guard = useUnsavedGuard({
    open,
    onOpenChange,
    isDirty,
    onSave: persist,
    onDiscard: () => setDraft(baseline),
  })

  const sourceLabel = isCreate
    ? "Add plan"
    : action?.source === "habit"
      ? "Daily habit plan"
      : action?.source === "todo"
        ? "To-do plan"
        : "Planned action"

  return (
    <>
      <Dialog open={open} onOpenChange={guard.handleOpenChange}>
        <DialogContent
          className="plan95-dialog max-h-[90vh]"
          hideClose
          aria-describedby={undefined}
          data-ui-name="Planned action"
          data-ui-help="Timed intention on this day — not a calendar event."
          data-ui-docs="components/Home/Plan/README.md"
          {...unsavedDismissProps(guard.requestClose)}
        >
          <DialogHeader className="plan95-dialog-caption flex-row items-center space-y-0 text-left">
            <DialogTitle>{sourceLabel}</DialogTitle>
            <button type="button" className="plan95-title-btn" aria-label="Close" onClick={guard.requestClose}>
              ×
            </button>
          </DialogHeader>
          <div className="plan95-dialog-body">
            {dayLabel ? (
              <p className="plan95-field" style={{ margin: 0, fontSize: 11, color: "#404040" }}>
                {createDate ? format(createDate, "EEEE, MMMM d, yyyy") : dayLabel}
              </p>
            ) : null}
            <div className="plan95-field">
              <Label htmlFor="planned-title">Title</Label>
              <Input
                id="planned-title"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="What will you do…"
              />
            </div>
            <div className="plan95-times">
              <div className="plan95-field">
                <Label htmlFor="planned-start">Start</Label>
                <Input
                  id="planned-start"
                  type="time"
                  value={draft.startTime}
                  onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
                />
              </div>
              <div className="plan95-field">
                <Label htmlFor="planned-duration">Duration (minutes)</Label>
                <Input
                  id="planned-duration"
                  type="number"
                  min={15}
                  step={15}
                  value={draft.duration}
                  onChange={(e) => setDraft({ ...draft, duration: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="plan95-field">
              <Label htmlFor="planned-notes">Notes</Label>
              <Textarea
                id="planned-notes"
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder="Time-block notes…"
                rows={4}
              />
            </div>
          </div>
          <div className="plan95-dialog-actions">
            {action && (
              <button
                type="button"
                data-danger="true"
                onClick={() => {
                  deleteAction(action.id)
                  guard.forceClose()
                }}
              >
                Remove
              </button>
            )}
            <button type="button" onClick={guard.requestClose}>
              Cancel
            </button>
            <button
              type="button"
              data-default="true"
              onClick={() => {
                persist()
                guard.forceClose()
              }}
            >
              {isCreate ? "Add" : "Save"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <UnsavedChangesDialog {...guard.prompt} />
    </>
  )
}
