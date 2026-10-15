/**
 * components/Home/Tracking/pen-mode-bar.tsx — Activity / Location / Mood / …
 *
 * The view-mode trough (scopes + add / delete) sits under the pen tray and
 * immediately above TIME/DIV + the Time Grid. Switching Activity vs Location
 * is a paint choice next to the plot — not a second toolbar above the beads.
 * Home Tracking renders this from the parent so Activity Log and Day Log share
 * it; the compact header Time Grid mounts it next to its own palette.
 */
"use client"

import { useMemo, useState, type ReactNode } from "react"
import { Plus, Trash2 } from "lucide-react"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import {
  clearScopeSuperimposeMulti,
  resolveSuperimposeLayers,
  setScopeSuperimpose,
  toggleScopeSuperimposeMulti,
  useTrackingViewPrefs,
} from "@/components/Home/Tracking/tracking-view-prefs"
import "./tracking-chrome.css"
import "./tracking-scope.css"

export function PenModeBar() {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const activeScopeId = useTimeTrackingStore((s) => s.activeScopeId)
  const setActiveScope = useTimeTrackingStore((s) => s.setActiveScope)
  const addScope = useTimeTrackingStore((s) => s.addScope)
  const removeScope = useTimeTrackingStore((s) => s.removeScope)
  const [addingView, setAddingView] = useState(false)
  const [newViewName, setNewViewName] = useState("")

  const scope = scopes.find((s) => s.id === activeScopeId) || scopes[0]
  if (!scope) return null

  const createView = () => {
    const name = newViewName.trim()
    if (!name) return
    addScope(name)
    setNewViewName("")
    setAddingView(false)
  }

  return (
    <div
      className="trk-mode-bar"
      role="toolbar"
      aria-label="Tracking view modes"
      data-ui-name="Tracking view modes"
      data-ui-docs="components/Home/Tracking/README.md"
    >
      <div className="trk-module trk-module-views" role="group" aria-label="Views">
        {scopes.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveScope(s.id)}
            aria-pressed={s.id === scope.id}
          >
            {s.name}
          </button>
        ))}
      </div>
      {addingView ? (
        <span className="trk-add-view">
          <input
            autoFocus
            value={newViewName}
            onChange={(e) => setNewViewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                createView()
              }
              if (e.key === "Escape") setAddingView(false)
            }}
            placeholder="View name…"
            aria-label="New view name"
          />
          <button type="button" onClick={createView} disabled={!newViewName.trim()}>
            Add
          </button>
          <button type="button" onClick={() => setAddingView(false)}>
            Cancel
          </button>
        </span>
      ) : (
        <div className="trk-module">
          <div className="trk-module-keys">
            <button type="button" className="trk-micro" onClick={() => setAddingView(true)} title="Add view">
              <Plus />
            </button>
            {scopes.length > 1 && (
              <button
                type="button"
                className="trk-micro trk-micro-danger"
                onClick={() => {
                  if (confirm(`Remove view "${scope.name}"? Its tracked time goes with it.`)) removeScope(scope.id)
                }}
                title={`Remove ${scope.name}`}
              >
                <Trash2 />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Home Tracking desk: the same views as a cassette deck. Each view is a chunky
 * key; the latched-down key is the view you paint. With `ghostLeds`, a small
 * LED under every other key toggles that view as a ghost under the screen
 * (ice blue when lit). The active key sits over its own LED — a view cannot
 * ghost itself. GHOST clears every ghost for this view (Off). + adds a view;
 * ⌫ removes the active one after a confirm. `action` sits at the deck's end.
 */
export function PenModeDeck({ ghostLeds = false, action }: { ghostLeds?: boolean; action?: ReactNode }) {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const activeScopeId = useTimeTrackingStore((s) => s.activeScopeId)
  const setActiveScope = useTimeTrackingStore((s) => s.setActiveScope)
  const addScope = useTimeTrackingStore((s) => s.addScope)
  const removeScope = useTimeTrackingStore((s) => s.removeScope)
  const prefs = useTrackingViewPrefs()
  const [addingView, setAddingView] = useState(false)
  const [newViewName, setNewViewName] = useState("")
  const scopeIds = useMemo(() => scopes.map((s) => s.id), [scopes])

  const scope = scopes.find((s) => s.id === activeScopeId) || scopes[0]
  if (!scope) return null
  const ghostIds = new Set(resolveSuperimposeLayers(scope.id, scopeIds, prefs).map((layer) => layer.scopeId))

  const createView = () => {
    const name = newViewName.trim()
    if (!name) return
    addScope(name)
    setNewViewName("")
    setAddingView(false)
  }

  const toggleGhost = (id: string) => {
    if (id === scope.id) return
    if (prefs.superimposeMulti) toggleScopeSuperimposeMulti(scope.id, id)
    else setScopeSuperimpose(scope.id, ghostIds.has(id) ? null : id)
  }

  const clearGhosts = () => {
    if (prefs.superimposeMulti) clearScopeSuperimposeMulti(scope.id)
    else setScopeSuperimpose(scope.id, null)
  }

  return (
    <div
      className="trk-deck"
      role="toolbar"
      aria-label="Tracking view modes"
      data-ui-name="Tracking view modes"
      data-ui-docs="components/Home/Tracking/README.md"
    >
      <div className="trk-deck-slot is-legend" aria-hidden={!ghostLeds}>
        <span className="trk-deck-caption is-view">VIEW</span>
        {ghostLeds ? (
          <button
            type="button"
            className="trk-deck-caption is-ghost"
            data-no95=""
            aria-label="Clear ghosts"
            title="Ghost: light the LED under a view to see it faintly under the screen. Click here to clear them."
            onClick={clearGhosts}
          >
            GHOST
          </button>
        ) : null}
      </div>
      {scopes.map((s) => {
        const down = s.id === scope.id
        return (
          <div key={s.id} className="trk-deck-slot">
            <button
              type="button"
              className="trk-ckey"
              data-no95=""
              aria-pressed={down}
              title={down ? `${s.name} — the view you paint` : `Paint ${s.name}`}
              onClick={() => setActiveScope(s.id)}
            >
              <span className="trk-ckey-glyph" aria-hidden />
              <span className="trk-ckey-label">{s.name}</span>
            </button>
            {ghostLeds ? (
              <button
                type="button"
                className="trk-cled"
                data-no95=""
                aria-label={`Ghost ${s.name}`}
                aria-pressed={!down && ghostIds.has(s.id)}
                disabled={down}
                title={down ? undefined : `Ghost ${s.name} under the screen`}
                onClick={() => toggleGhost(s.id)}
              />
            ) : null}
          </div>
        )
      })}
      {addingView ? (
        <div className="trk-deck-slot is-adding">
          <span className="trk-deck-add">
            <input
              autoFocus
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  createView()
                }
                if (e.key === "Escape") setAddingView(false)
              }}
              placeholder="View name…"
              aria-label="New view name"
            />
            <button type="button" onClick={createView} disabled={!newViewName.trim()}>
              Add
            </button>
            <button type="button" onClick={() => setAddingView(false)}>
              Cancel
            </button>
          </span>
        </div>
      ) : (
        <>
          <div className="trk-deck-slot is-narrow">
            <button
              type="button"
              className="trk-ckey is-icon"
              data-no95=""
              title="Add view"
              aria-label="Add view"
              onClick={() => setAddingView(true)}
            >
              <span className="trk-ckey-label">+</span>
            </button>
          </div>
          {scopes.length > 1 ? (
            <div className="trk-deck-slot is-narrow">
              <button
                type="button"
                className="trk-ckey is-icon"
                data-no95=""
                title={`Remove ${scope.name}`}
                aria-label={`Remove ${scope.name}`}
                onClick={() => {
                  if (confirm(`Remove view "${scope.name}"? Its tracked time goes with it.`)) removeScope(scope.id)
                }}
              >
                <span className="trk-ckey-label">⌫</span>
              </button>
            </div>
          ) : null}
        </>
      )}
      {action ? <div className="trk-deck-action">{action}</div> : null}
    </div>
  )
}
