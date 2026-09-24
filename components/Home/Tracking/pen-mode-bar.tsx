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

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import "./tracking-chrome.css"

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
