/**
 * components/Home/Tracking/screentime-empty-hint.tsx — Empty Screen Time day
 *
 * Does not steal `activeScopeId`. OtherScopeHint stands down on this scope so
 * this banner can explain ActivityWatch without yanking the view to Activity.
 */
"use client"

import { useTimeTrackingStore } from "@/lib/time-tracking-store"

export function isScreenTimeScope(scope: { id: string; name: string } | undefined): boolean {
  if (!scope) return false
  return scope.id === "screentime" || scope.name.trim().toLowerCase() === "screen time"
}

export function ScreenTimeEmptyHint({ date: _date, scopeId }: { date: string; scopeId: string }) {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const scope = scopes.find((s) => s.id === scopeId)
  if (!isScreenTimeScope(scope)) return null
  return (
    <div className="rounded border border-dashed px-3 py-2 text-sm text-muted-foreground">
      <p>
        Nothing painted in <span className="font-semibold text-foreground">Screen Time</span> today.
        Brain2 reads a running ActivityWatch server — it is not a window watcher, and ActivityWatch
        cannot import Apple Screen Time or anything from before the watchers started. Open{" "}
        <span className="font-semibold text-foreground">Settings → Screen Time</span>, keep
        ActivityWatch running, then Sync now after using the Mac.
      </p>
    </div>
  )
}
