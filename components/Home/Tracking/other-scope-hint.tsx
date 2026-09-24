/**
 * components/Home/Tracking/other-scope-hint.tsx — Empty view, hours elsewhere
 *
 * Each Tracking view is independent. Painting lives on Activity (or Location…)
 * and an unused view — a leftover Add view with one Default pen — reads as
 * 0% on every date.
 *
 * Home Tracking does not mount this banner. Time Grid, week, Activity Log, and
 * Day Log stay quiet when another view holds the hours.
 */
"use client"

import { Button } from "@/components/ui/button"
import { formatDuration } from "@/lib/time-entries"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { otherScopeOccupancy } from "@/lib/tracking-summary"
import { isScreenTimeScope } from "@/components/Home/Tracking/screentime-empty-hint"

export function OtherScopeHint({ date, scopeId }: { date: string; scopeId: string }) {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const entries = useTimeTrackingStore((s) => s.entries)
  const setActiveScope = useTimeTrackingStore((s) => s.setActiveScope)
  const current = scopes.find((s) => s.id === scopeId)
  if (isScreenTimeScope(current)) return null
  const rows = otherScopeOccupancy(entries, scopes, date, scopeId).filter((row) => {
    const scope = scopes.find((s) => s.id === row.id)
    return !isScreenTimeScope(scope)
  })
  if (rows.length === 0) return null
  const scopeName = scopes.find((s) => s.id === scopeId)?.name ?? "this view"
  return (
    <div className="rounded border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-black">
      <p>
        Nothing painted in <span className="font-semibold">{scopeName}</span>. Your hours are still
        in {rows.map((row) => row.name).join(", ")}.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {rows.map((row) => (
          <Button key={row.id} size="sm" onClick={() => setActiveScope(row.id)}>
            Show {row.name} ({formatDuration(row.minutes)})
          </Button>
        ))}
      </div>
    </div>
  )
}
