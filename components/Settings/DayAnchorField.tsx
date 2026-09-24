/**
 * components/Settings/DayAnchorField.tsx — Default time of day for back-filled work
 *
 * When a habit is ticked off for a day that is already over and there is no painted
 * Tracking time to read a real finish time from, the app has to assume one.
 *
 * Since the sleep log landed, this setting is the **last** resort rather than the
 * only one: `lib/completion-window.ts` prefers the half hour before that night's
 * bedtime, taken from the sleep log, from sleep painted on the grid, or from the
 * user's median bedtime over the last month (`lib/sleep-sync.ts`). So the field
 * shows what is actually in force right now — a setting that silently stopped
 * applying would be worse than no setting at all.
 */
"use client"

import { Clock, Moon } from "lucide-react"
import { format } from "date-fns"
import { Label } from "@/components/ui/label"
import { clampAnchorMinutes, formatAnchorMinutes } from "@/lib/completion-window"
import { useUserSettingsStore } from "@/lib/user-settings-store"
import { useSleepStore } from "@/lib/sleep-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { resolveNights } from "@/lib/sleep-inference"
import { formatSleepDuration, offsetToLabel, typicalSleepWindow } from "@/lib/sleep-log"
import { recentDateKeys } from "@/lib/tracking-summary"
import { useMemo } from "react"

function toTimeValue(minutes: number): string {
  const clamped = clampAnchorMinutes(minutes)
  return format(new Date(2000, 0, 1, Math.floor(clamped / 60), clamped % 60), "HH:mm")
}

export function DayAnchorField() {
  const dayAnchorMinutes = useUserSettingsStore((s) => s.dayAnchorMinutes)
  const setDayAnchorMinutes = useUserSettingsStore((s) => s.setDayAnchorMinutes)

  const nights = useSleepStore((s) => s.nights)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const entries = useTimeTrackingStore((s) => s.entries)

  const typical = useMemo(() => {
    const keys = recentDateKeys(30)
    return typicalSleepWindow(resolveNights(nights, { scopes, entries }, keys), keys)
  }, [nights, scopes, entries])

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-4">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4" />
        <h3 className="font-semibold">Default time of day</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Ticking off a habit for a day that has already ended needs a time. Without tracked time to go by, the app
        assumes one and marks it <strong>est.</strong> on the Done row so you can confirm or correct it in your review.
      </p>

      {typical ? (
        <p className="flex items-start gap-2 rounded bg-muted/40 p-2 text-sm">
          <Moon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            Right now your sleep log is answering this: you usually fall asleep around{" "}
            <strong>{offsetToLabel(typical.bedtime)}</strong>, so back-filled work is assumed to have finished by{" "}
            <strong>{offsetToLabel(typical.bedtime - 30)}</strong>. The setting below is the fallback for days with no
            sleep data at all — it currently reads {formatAnchorMinutes(dayAnchorMinutes)}. Based on{" "}
            {typical.nights} tracked night{typical.nights === 1 ? "" : "s"}, averaging{" "}
            {formatSleepDuration(typical.wake - typical.bedtime)}.
          </span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Log a few nights in Home → Tracking and this fills itself in from when you actually go to bed. Until then it
          assumes {formatAnchorMinutes(dayAnchorMinutes)}.
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="day-anchor">Assumed finish time</Label>
        <input
          id="day-anchor"
          type="time"
          value={toTimeValue(dayAnchorMinutes)}
          onChange={(e) => {
            const [hours, mins] = e.target.value.split(":").map((part) => Number.parseInt(part, 10))
            if (Number.isFinite(hours) && Number.isFinite(mins)) setDayAnchorMinutes(hours * 60 + mins)
          }}
          className="h-9 rounded-md border bg-background px-2 text-sm"
        />
      </div>
    </div>
  )
}
