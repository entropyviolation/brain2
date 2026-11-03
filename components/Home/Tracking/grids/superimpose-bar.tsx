/**
 * components/Home/Tracking/grids/superimpose-bar.tsx — faint second view
 *
 * One milled row under the view-mode bar and above the time plot. It edits
 * the overlay for the view you are standing on (`superimposeByScope`). Off
 * clears only that view. The active view is not in the list. Activity Log
 * and Day Log do not mount this row.
 *
 * Right after the ghost keys, two checkboxes: **multi** lets this view carry several ghosts (each key toggles
 * itself in and out of `superimposeMultiByScope`), and **advanced** shows one
 * opacity slider per active ghost (`superimposeOpacity`, by ghost view).
 * At the far right a subtle HIDE silk sits over two keys (pressed = hidden):
 * **Log flags** (`hideLogFlags`, discrete log flags) and the sun/moon key
 * (`hideSunLines`, sunrise / sunset lines; the now line stays).
 */
"use client"

import { useMemo } from "react"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import {
  clearScopeSuperimposeMulti,
  DEFAULT_SUPERIMPOSE_OPACITY,
  resolveSuperimposeLayers,
  setScopeSuperimpose,
  setSuperimposeMulti,
  setSuperimposeOpacity,
  setTrackingViewPrefs,
  toggleScopeSuperimposeMulti,
  useTrackingViewPrefs,
} from "@/components/Home/Tracking/tracking-view-prefs"
import "../tracking-chrome.css"

/** Half sun, half crescent: the sunrise / sunset lines key. */
function SunMoonGlyph() {
  return (
    <svg className="trk-super-glyph" width="18" height="11" viewBox="0 0 18 11" aria-hidden focusable="false">
      <circle cx="5" cy="5.5" r="2.2" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="1" strokeLinecap="round">
        <line x1="5" y1="0.6" x2="5" y2="1.8" />
        <line x1="5" y1="9.2" x2="5" y2="10.4" />
        <line x1="0.2" y1="5.5" x2="1.4" y2="5.5" />
        <line x1="8.6" y1="5.5" x2="9.8" y2="5.5" />
        <line x1="1.6" y1="2.1" x2="2.4" y2="2.9" />
        <line x1="7.6" y1="8.1" x2="8.4" y2="8.9" />
        <line x1="1.6" y1="8.9" x2="2.4" y2="8.1" />
        <line x1="7.6" y1="2.9" x2="8.4" y2="2.1" />
      </g>
      <path d="M15.6 1.4a4.1 4.1 0 1 0 1.6 7.6 3.3 3.3 0 0 1-1.6-7.6z" fill="currentColor" />
    </svg>
  )
}

export function SuperimposeBar() {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const activeScopeId = useTimeTrackingStore((s) => s.activeScopeId)
  const prefs = useTrackingViewPrefs()
  const scope = scopes.find((s) => s.id === activeScopeId) || scopes[0]
  const scopeIds = useMemo(() => scopes.map((s) => s.id), [scopes])
  if (!scope) return null

  const others = scopes.filter((s) => s.id !== scope.id)
  const layers = resolveSuperimposeLayers(scope.id, scopeIds, prefs)
  const activeIds = new Set(layers.map((layer) => layer.scopeId))
  const multi = prefs.superimposeMulti

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
        <button
          type="button"
          aria-pressed={activeIds.size === 0}
          onClick={() => (multi ? clearScopeSuperimposeMulti(scope.id) : setScopeSuperimpose(scope.id, null))}
        >
          Off
        </button>
        {others.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={activeIds.has(s.id)}
            onClick={() => (multi ? toggleScopeSuperimposeMulti(scope.id, s.id) : setScopeSuperimpose(scope.id, s.id))}
          >
            {s.name}
          </button>
        ))}
      </div>
      <label className="trk-super-check" title="Turn on several ghost views at once">
        <input type="checkbox" checked={multi} onChange={(event) => setSuperimposeMulti(event.target.checked)} />
        multi
      </label>
      <label className="trk-super-check" title="Set each ghost view's opacity">
        <input
          type="checkbox"
          checked={prefs.superimposeAdvanced}
          onChange={(event) => setTrackingViewPrefs({ superimposeAdvanced: event.target.checked })}
        />
        advanced
      </label>
      <div className="trk-super-hide" role="group" aria-label="Hide on the grid">
        <span className="trk-super-hide-silk" aria-hidden>
          Hide
        </span>
        <button
          type="button"
          className="trk-super-logflags"
          aria-pressed={prefs.hideLogFlags}
          title={prefs.hideLogFlags ? "Log flags hidden — click to show" : "Hide log flags on the grid (entries stay)"}
          onClick={() => setTrackingViewPrefs({ hideLogFlags: !prefs.hideLogFlags })}
        >
          Log flags
        </button>
        <button
          type="button"
          className="trk-super-sun"
          aria-pressed={prefs.hideSunLines}
          aria-label="Sunrise and sunset lines"
          title={prefs.hideSunLines ? "Sunrise / sunset hidden — click to show" : "Hide sunrise / sunset lines"}
          onClick={() => setTrackingViewPrefs({ hideSunLines: !prefs.hideSunLines })}
        >
          <SunMoonGlyph />
        </button>
      </div>
      {prefs.superimposeAdvanced && layers.length > 0 ? (
        <div className="trk-super-opacity" role="group" aria-label="Ghost opacity">
          {layers.map((layer) => {
            const ghost = scopes.find((s) => s.id === layer.scopeId)
            if (!ghost) return null
            const value = Math.round((layer.opacity ?? DEFAULT_SUPERIMPOSE_OPACITY) * 100)
            return (
              <label key={ghost.id} className="trk-super-opacity-row">
                <span className="trk-super-opacity-name">{ghost.name}</span>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={1}
                  value={value}
                  aria-label={`${ghost.name} ghost opacity`}
                  onChange={(event) => setSuperimposeOpacity(ghost.id, Number(event.target.value) / 100)}
                />
                <span className="trk-super-opacity-value">{value}%</span>
              </label>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
