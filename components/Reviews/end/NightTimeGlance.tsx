/**
 * components/Reviews/NightTimeGlance.tsx — The night ritual's look at the day
 *
 * A short path into the same Time Grid, Day Log, and Activity Log the Tracking
 * tab uses, pinned to this ritual's date. Edits write through those stores.
 * A note stays on the night ritual (`timeReflection`).
 */
"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { TimeGrid } from "@/components/Home/Tracking/time-grid"
import { ActualDayView } from "@/components/Home/Tracking/actual-day-view"
import { TrackingActivityLog } from "@/components/Home/Tracking/tracking-activity-log"
import { dateFromPeriodKey } from "@/lib/reviews-store"

type Surface = "grid" | "daylog" | "activity"

const SURFACES: { id: Surface; label: string }[] = [
  { id: "grid", label: "Time grid" },
  { id: "daylog", label: "Day log" },
  { id: "activity", label: "Activity log" },
]

export function NightTimeGlance({
  periodKey,
  note,
  onNote,
}: {
  periodKey: string
  note: string
  onNote: (value: string) => void
}) {
  const day = dateFromPeriodKey("day", periodKey)
  const [surface, setSurface] = useState<Surface | null>(null)

  return (
    <section className="space-y-2" data-ui-name="Night time glance">
      <Label className="font-semibold text-sm">How the day was spent</Label>
      <p className="text-sm text-muted-foreground">
        Look at this day if you want to — the time grid, the day log, and the activity log — and leave a note about
        how the time went.
      </p>
      <div className="flex flex-wrap gap-2">
        {SURFACES.map((item) => (
          <button
            key={item.id}
            type="button"
            className="todo-btn"
            aria-pressed={surface === item.id}
            onClick={() => setSurface((current) => (current === item.id ? null : item.id))}
          >
            {item.label}
          </button>
        ))}
      </div>
      {surface === "grid" && (
        <TimeGrid compact currentDate={day} setCurrentDate={() => {}} lockDate showPalette />
      )}
      {surface === "daylog" && <ActualDayView currentDate={day} setCurrentDate={() => {}} lockDate />}
      {surface === "activity" && (
        <TrackingActivityLog currentDate={day} setCurrentDate={() => {}} lockDate />
      )}
      <Textarea
        value={note}
        onChange={(e) => onNote(e.target.value)}
        rows={2}
        placeholder="A note on how the time went, if you want one"
        aria-label="Time analysis"
      />
    </section>
  )
}
