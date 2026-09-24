/**
 * components/Home/Tracking/log-activity-dialog.tsx — Type a block without filling a gap
 *
 * Available from Time Grid, Activity Log and Day Log. An optional name, a when,
 * optional notes. Start and End are times on the selected calendar day; a small
 * **Date** latch reveals an optional date so a block can start 11 PM one day and
 * end 1 AM the next without forcing a date pick every time. Focusing a time
 * field reveals **right now** beside that picker (`now-time-button.tsx`) — it
 * stamps hours and minutes, and leaves the dialog's date alone. Toggle
 * **Discrete event** for a single clock time — smoked weed, fell asleep, sunrise
 * — which can also start or end a state block ("being high") of another pen.
 */
"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useCurrentDate } from "@/lib/use-current-date"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { minutesToTimeString, timeStringToMinutes } from "@/lib/time-entries"
import { useTrackingViewPrefs } from "@/components/Home/Tracking/tracking-view-prefs"
import { snapshotsEqual } from "@/lib/unsaved-changes"
import { UnsavedChangesDialog, unsavedDismissProps, useUnsavedGuard } from "@/components/ui/unsaved-changes-guard"
import { PenSwatches } from "@/components/Home/Tracking/pen-swatches"
import { VariantChips } from "@/components/Home/Tracking/variant-chips"
import { ClockTime } from "@/components/Home/Tracking/now-time-button"
import "./tracking-chrome.css"

function OptionalClock({
  id,
  label,
  time,
  date,
  showDate,
  onTime,
  onDate,
  onToggleDate,
}: {
  id: string
  label: string
  time: string
  date: string
  showDate: boolean
  onTime: (value: string) => void
  onDate: (value: string) => void
  onToggleDate: () => void
}) {
  return (
    <div className="trk-clock-field">
      <div className="trk-clock-head">
        <Label htmlFor={id}>{label}</Label>
        <button type="button" className="trk-date-toggle" aria-pressed={showDate} onClick={onToggleDate}>
          {showDate ? "Hide date" : "Date"}
        </button>
      </div>
      {showDate && (
        <Input
          id={`${id}-date`}
          className="trk-clock-date"
          type="date"
          value={date}
          onChange={(e) => onDate(e.target.value)}
          aria-label={`${label} date`}
        />
      )}
      <ClockTime id={id} label={label} time={time} onTime={onTime} />
    </div>
  )
}

export { OptionalClock }

export function LogActivityDialog({
  dateKey,
  scopeId,
  defaultStartMin,
  defaultEndMin,
  onClose,
}: {
  dateKey: string
  scopeId: string
  defaultStartMin: number
  defaultEndMin: number
  onClose: () => void
}) {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const tags = useTimeTrackingStore((s) => s.tags)
  const selectedPenId = useTimeTrackingStore((s) => s.selectedPenId)
  const paintMinutes = useTimeTrackingStore((s) => s.paintMinutes)
  const addPen = useTimeTrackingStore((s) => s.addPen)
  const addVariant = useTimeTrackingStore((s) => s.addVariant)
  const setSelectedPen = useTimeTrackingStore((s) => s.setSelectedPen)
  const penSort = useTimeTrackingStore((s) => s.penSort)

  const scope = scopes.find((s) => s.id === scopeId)
  const initialPen =
    selectedPenId &&
    selectedPenId !== "ERASE" &&
    selectedPenId !== "SCISSORS" &&
    scope?.pens.some((p) => p.id === selectedPenId)
      ? selectedPenId
      : (scope?.pens[0]?.id ?? "")

  const [penId, setPenId] = useState(initialPen)
  const [from, setFrom] = useState(minutesToTimeString(defaultStartMin))
  const [to, setTo] = useState(minutesToTimeString(defaultEndMin % 1440 === 0 ? 0 : defaultEndMin))
  const [fromDate, setFromDate] = useState(dateKey)
  const [toDate, setToDate] = useState(dateKey)
  const [showFromDate, setShowFromDate] = useState(false)
  const [showToDate, setShowToDate] = useState(false)
  const [assumed, setAssumed] = useState(false)
  const [variantIds, setVariantIds] = useState<string[]>([])
  const [title, setTitle] = useState("")
  const [notes, setNotes] = useState("")
  const [discrete, setDiscrete] = useState(false)
  const [statePenId, setStatePenId] = useState("")
  const [tie, setTie] = useState<"none" | "start" | "end">("none")

  const draft = { penId, from, to, fromDate, toDate, assumed, variantIds, title, notes, discrete, statePenId, tie }
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

  const pen = scope?.pens.find((p) => p.id === penId)
  const statePens = (scope?.pens ?? []).filter((p) => p.id !== penId)

  const pickPen = (id: string) => {
    setPenId(id)
    setVariantIds([])
    if (statePenId === id) setStatePenId("")
  }

  const save = () => {
    const startMin = timeStringToMinutes(from)
    if (startMin === null || !scope || !penId) return
    setSelectedPen(penId)
    const extras = {
      title: title.trim() || undefined,
      notes: notes.trim() || undefined,
    }
    const precision = assumed ? ("estimated" as const) : undefined

    if (discrete) {
      paintMinutes(fromDate, scope.id, startMin, startMin, penId, variantIds, undefined, precision, {
        ...extras,
        kind: "instant",
      })
      const instant = useTimeTrackingStore
        .getState()
        .entries.filter((e) => e.date === fromDate && e.scopeId === scope.id && e.kind === "instant" && e.startMin === startMin)
        .at(-1)
      if (tie !== "none" && statePenId && instant) {
        const parsedEnd = timeStringToMinutes(to)
        const endMin = parsedEnd === null || parsedEnd === 0 ? 1440 : parsedEnd
        const lo = tie === "start" ? startMin : Math.min(startMin, endMin === startMin ? startMin : endMin)
        const hi = tie === "end" ? startMin : endMin <= startMin ? 1440 : endMin
        if (hi > lo) {
          paintMinutes(fromDate, scope.id, lo, hi, statePenId, undefined, undefined, precision, {
            startEventId: tie === "start" ? instant.id : undefined,
            endEventId: tie === "end" ? instant.id : undefined,
            title: extras.title,
            notes: extras.notes,
            endDate: toDate !== fromDate ? toDate : undefined,
          })
        }
      }
      onClose()
      return
    }

    const parsedEnd = timeStringToMinutes(to)
    if (parsedEnd === null) return
    const sameDay = toDate === fromDate
    const endMin = sameDay && parsedEnd === 0 ? 1440 : parsedEnd
    paintMinutes(fromDate, scope.id, startMin, endMin, penId, variantIds, undefined, precision, {
      ...extras,
      endDate: sameDay ? undefined : toDate,
    })
    onClose()
  }

  if (!scope) return null

  return (
    <>
    <Dialog open onOpenChange={guard.handleOpenChange}>
      <DialogContent className="trk95 trk-dialog sm:max-w-md max-h-[85vh] overflow-y-auto" data-ui-name="Log activity" data-ui-docs="components/Home/Tracking/README.md" {...unsavedDismissProps(guard.requestClose)}>
        <DialogHeader>
          <DialogTitle>Log {scope.name.toLowerCase()}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="log-title">Name</Label>
            <Input
              id="log-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={pen?.name ?? "Optional"}
            />
            <p className="trk-help">Optional. Defaults to the pen name.</p>
          </div>

          <div className="flex items-center justify-between rounded border px-2 py-1.5">
            <div>
              <Label htmlFor="log-discrete" className="cursor-pointer text-sm">
                Discrete event
              </Label>
              <p className="trk-help">One clock time — smoked weed, fell asleep, sunrise. Not a span.</p>
            </div>
            <Switch id="log-discrete" checked={discrete} onCheckedChange={setDiscrete} />
          </div>

          <div className={`grid gap-2 ${discrete ? "grid-cols-1" : "grid-cols-2"}`}>
            <OptionalClock
              id="log-from"
              label={discrete ? "When" : "Start"}
              time={from}
              date={fromDate}
              showDate={showFromDate}
              onTime={setFrom}
              onDate={setFromDate}
              onToggleDate={() => setShowFromDate((open) => !open)}
            />
            {!discrete && (
              <OptionalClock
                id="log-to"
                label="End"
                time={to}
                date={toDate}
                showDate={showToDate}
                onTime={setTo}
                onDate={setToDate}
                onToggleDate={() => setShowToDate((open) => !open)}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Pen</Label>
            <PenSwatches
              pens={scope.pens}
              tags={tags}
              selectedId={penId}
              onSelect={pickPen}
              onCreate={(name, color) => {
                const id = addPen(scope.id, { name, color })
                if (id) pickPen(id)
              }}
              sortMode={penSort}
              compact
            />
          </div>

          {pen && (pen.variants?.length || pen.variantLabel) && (
            <div className="space-y-1.5">
              <Label>{pen.variantLabel || "Detail"}</Label>
              <VariantChips
                pen={pen}
                selected={variantIds}
                size="sm"
                onToggle={(id) =>
                  setVariantIds((current) =>
                    current.includes(id) ? current.filter((v) => v !== id) : [...current, id],
                  )
                }
                onCreate={(name) => {
                  const id = addVariant(scope.id, pen.id, name)
                  if (id) setVariantIds((current) => [...current, id])
                }}
              />
            </div>
          )}

          {discrete && statePens.length > 0 && (
            <div className="trk-section space-y-1.5">
              <Label className="trk-section-title">Tie to a state</Label>
              <p className="trk-help">
                Optional. Use this event as the start or end of a different kind of
                block — smoked weed starting &ldquo;being high&rdquo;.
              </p>
              <div className="flex gap-1">
                {(["none", "start", "end"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={tie === option}
                    onClick={() => setTie(option)}
                  >
                    {option === "none" ? "Just the event" : option === "start" ? "Starts a block" : "Ends a block"}
                  </button>
                ))}
              </div>
              {tie !== "none" && (
                <>
                  <PenSwatches
                    pens={statePens}
                    tags={tags}
                    selectedId={statePenId}
                    onSelect={setStatePenId}
                    sortMode={penSort}
                    compact
                  />
                  {tie === "start" && (
                    <div>
                      <Label htmlFor="log-state-to">Block until</Label>
                      <ClockTime id="log-state-to" label="Block until" time={to} onTime={setTo} />
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="log-notes">Notes</Label>
            <Textarea id="log-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex items-center justify-between rounded border px-2 py-1.5">
            <Label htmlFor="log-assumed" className="cursor-pointer text-sm">
              Mark as assumed
            </Label>
            <Switch id="log-assumed" checked={assumed} onCheckedChange={setAssumed} />
          </div>
          <p className="trk-help">
            New blocks are certain unless you say otherwise. Assumed time can be hidden in Analytics.
          </p>

          <Button className="w-full" onClick={save} disabled={!penId}>
            {discrete ? "Log event" : "Log block"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    <UnsavedChangesDialog {...guard.prompt} />
    </>
  )
}

/** Gray latch that opens Log activity. Lives next to the Time Grid, not in the pen tray. */
export function LogActivityLatch({ dateKey }: { dateKey?: string } = {}) {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const activeScopeId = useTimeTrackingStore((s) => s.activeScopeId)
  const { currentDate } = useCurrentDate()
  const prefs = useTrackingViewPrefs()
  const [logging, setLogging] = useState(false)
  const dk = dateKey ?? formatLocalDateKey(currentDate)
  const scope = scopes.find((s) => s.id === activeScopeId) || scopes[0]
  if (!scope) return null

  return (
    <>
      <button
        type="button"
        className="trk-latch trk-latch-log"
        onClick={() => setLogging(true)}
        title="Log activity"
      >
        <span className="trk-led" aria-hidden />
        <Plus /> Log activity
      </button>
      {logging && (
        <LogActivityDialog
          dateKey={dk}
          scopeId={scope.id}
          defaultStartMin={timeStringToMinutes(prefs.fillFrom) ?? 9 * 60}
          defaultEndMin={timeStringToMinutes(prefs.fillTo) ?? 10 * 60}
          onClose={() => setLogging(false)}
        />
      )}
    </>
  )
}
