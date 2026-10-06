/**
 * components/Home/Tracking/superimpose-bar.tsx — faint second view
 *
 * One milled row under the view-mode bar and above the time plot. It edits
 * the overlay for the view you are standing on (`superimposeByScope`). Off
 * clears only that view. The active view is not in the list. Activity Log
 * and Day Log do not mount this row.
 */
"use client"

import { useMemo } from "react"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import {
  resolveSuperimposeScopeId,
  setScopeSuperimpose,
  useTrackingViewPrefs,
} from "@/components/Home/Tracking/tracking-view-prefs"
import "./tracking-chrome.css"

export function SuperimposeBar() {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const activeScopeId = useTimeTrackingStore((s) => s.activeScopeId)
  const prefs = useTrackingViewPrefs()
  const scope = scopes.find((s) => s.id === activeScopeId) || scopes[0]
  const scopeIds = useMemo(() => scopes.map((s) => s.id), [scopes])
  if (!scope) return null

  const others = scopes.filter((s) => s.id !== scope.id)
  const overlayId = resolveSuperimposeScopeId(scope.id, scopeIds, prefs)

  return (
    <div
      className="trk-super-bar"
      role="toolbar"
      aria-label="Superimpose"
      data-ui-name="Superimpose"
      data-ui-docs="components/Home/Tracking/README.md"
    >
      <span className="trk-silk">Ghost</span>
      <div className="trk-super-keys" role="group" aria-label="Superimposed view">
        <button type="button" aria-pressed={!overlayId} onClick={() => setScopeSuperimpose(scope.id, null)}>
          Off
        </button>
        {others.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={overlayId === s.id}
            onClick={() => setScopeSuperimpose(scope.id, s.id)}
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  )
}
