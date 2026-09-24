/**
 * components/Analytics/ScreenTimeView.tsx — ActivityWatch-painted Screen Time
 *
 * Active vs untracked occupancy, top apps / categories from the same pens as
 * Tracking, last-sync from prefs, and a simple alignment strip against human
 * Activity occupancy. Does not dual-write. Circadian Activity default stays put.
 */
"use client"

import { useMemo } from "react"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { formatDuration } from "@/lib/time-entries"
import { entriesInRange, penTotalsAtDepth, totalsFor, uniqueMinutes } from "@/lib/tracking-summary"
import { loadScreenTimePrefs } from "@/lib/screentime/prefs"
import { ChartFrame } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { SliceMosaic, StudioReadout } from "./studio-kit"

function overlapMinutes(a: ReturnType<typeof entriesInRange>, b: ReturnType<typeof entriesInRange>, days: string[]): number {
  const ua = uniqueMinutes(a, days)
  const ub = uniqueMinutes(b, days)
  const union = uniqueMinutes([...a, ...b], days)
  return Math.max(0, ua + ub - union)
}

export function ScreenTimeView() {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const entries = useTimeTrackingStore((s) => s.entries)
  const { dateKeys, label } = useAnalyticsRange()
  const screen = scopes.find((s) => s.id === "screentime" || s.name.trim().toLowerCase() === "screen time")
  const activity = scopes.find((s) => s.name === "Activity") ?? scopes[0]
  const prefs = loadScreenTimePrefs()

  const scoped = useMemo(
    () => (screen ? entriesInRange(entries, dateKeys, screen.id) : []),
    [screen, entries, dateKeys],
  )
  const totals = useMemo(() => totalsFor(scoped, dateKeys), [scoped, dateKeys])
  const apps = useMemo(
    () => (screen ? penTotalsAtDepth(scoped, screen, dateKeys, null) : []),
    [screen, scoped, dateKeys],
  )
  const categories = useMemo(
    () => (screen ? penTotalsAtDepth(scoped, screen, dateKeys, 0) : []),
    [screen, scoped, dateKeys],
  )
  const activityEntries = useMemo(
    () => (activity ? entriesInRange(entries, dateKeys, activity.id) : []),
    [activity, entries, dateKeys],
  )
  const activityMin = uniqueMinutes(activityEntries, dateKeys)
  const screenMin = uniqueMinutes(scoped, dateKeys)
  const overlap = overlapMinutes(activityEntries, scoped, dateKeys)
  const overlapPct = activityMin > 0 ? Math.round((overlap / activityMin) * 100) : 0

  return (
    <div className="an-canvas an-stack" data-testid="screentime-view">
      <header className="an-canvas-head">
        <div>
          <p className="an-canvas-title">Screen Time</p>
          <p className="an-canvas-kicker">
            {label} · ActivityWatch-painted Screen Time scope. AFK is untracked. Alignment is occupancy vs Activity, not a second write.
          </p>
        </div>
      </header>
      {!screen || totals.tracked === 0 ? (
        <ChartFrame empty emptySentence={`Nothing painted in Screen Time in the ${label}. ActivityWatch only records from when its watchers run. Sync from Settings → Screen Time after using the Mac.`} />
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <StudioReadout label="Active" value={formatDuration(totals.tracked)} note={`${totals.coverage.toFixed(0)}% of the window`} />
            <StudioReadout label="Untracked" value={formatDuration(totals.untracked)} note="AFK and idle sit here" />
            <StudioReadout
              label="Last sync"
              value={prefs.lastSuccessAt ? new Date(prefs.lastSuccessAt).toLocaleString() : "never"}
            />
          </div>
          <ChartFrame>
            <p className="text-xs text-muted-foreground">Alignment vs Activity occupancy</p>
            <p className="text-sm">
              Activity {formatDuration(activityMin)} · Screen Time {formatDuration(screenMin)} · overlap{" "}
              {formatDuration(overlap)} ({overlapPct}% of Activity)
            </p>
            <div className="mt-2 flex h-3 overflow-hidden rounded border">
              <span className="bg-sky-600" style={{ width: `${Math.min(100, (screenMin / Math.max(activityMin, screenMin, 1)) * 100)}%` }} title="Screen Time" />
              <span className="bg-emerald-600/80" style={{ width: `${Math.min(100, (activityMin / Math.max(activityMin, screenMin, 1)) * 100)}%` }} title="Activity" />
            </div>
          </ChartFrame>
          {apps.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground">Top apps (exact pens)</p>
              <SliceMosaic
                slices={apps.slice(0, 12).map((s) => ({
                  id: s.id,
                  name: s.name,
                  color: s.color,
                  minutes: s.minutes,
                  label: formatDuration(s.minutes),
                }))}
                max={Math.max(...apps.map((s) => s.minutes), 1)}
              />
            </>
          )}
          {categories.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground">Top categories (depth 0)</p>
              <SliceMosaic
                slices={categories.slice(0, 12).map((s) => ({
                  id: s.id,
                  name: s.name,
                  color: s.color,
                  minutes: s.minutes,
                  label: formatDuration(s.minutes),
                }))}
                max={Math.max(...categories.map((s) => s.minutes), 1)}
              />
            </>
          )}
        </>
      )}
    </div>
  )
}
