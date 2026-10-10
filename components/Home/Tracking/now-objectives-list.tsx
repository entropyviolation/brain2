/**
 * components/Home/Tracking/now-objectives-list.tsx — Objectives for right now
 *
 * Popup checklist for free-form objectives on a live timer or a painted block.
 * Opens as a floating panel so the header / strip layout does not grow. Not
 * Home Goals, not the Tracking Objective pen.
 */
"use client"

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { NowObjective } from "@/lib/now-objective"
import { activeNowObjectives } from "@/lib/now-objective"
import "@/components/Home/Tracking/tracking-chrome.css"

export interface NowObjectivesHandlers {
  onAdd: (text: string) => void
  onEditText: (id: string, text: string) => void
  onToggleComplete: (id: string) => void
  onRemove?: (id: string) => void
}

interface NowObjectivesListProps extends NowObjectivesHandlers {
  objectives: NowObjective[] | undefined
  /** Compact trigger for header/strips; inline panel for the entry dialog. */
  mode?: "popup" | "inline"
  /** Optional name fragment for aria (pen or operation title). */
  contextName?: string
}

function ObjectivesEditor({
  objectives,
  onAdd,
  onEditText,
  onToggleComplete,
  onRemove,
  autoFocusAdd,
}: NowObjectivesHandlers & { objectives: NowObjective[] | undefined; autoFocusAdd?: boolean }) {
  const [draft, setDraft] = useState("")
  const addRef = useRef<HTMLInputElement>(null)
  const list = objectives ?? []

  useEffect(() => {
    if (autoFocusAdd) addRef.current?.focus()
  }, [autoFocusAdd])

  const submit = () => {
    const text = draft.trim()
    if (!text) return
    onAdd(text)
    setDraft("")
  }

  return (
    <div className="trk-now-obj-editor" data-ui-name="Objectives for right now">
      <ul className="trk-now-obj-list" aria-label="Objectives for right now">
        {list.length === 0 ? (
          <li className="trk-now-obj-empty">What are you trying to finish this instant?</li>
        ) : (
          list.map((row) => {
            const done = Boolean(row.completedAt)
            return (
              <li key={row.id} className={done ? "trk-now-obj-row done" : "trk-now-obj-row"}>
                <button
                  type="button"
                  className="trk-now-obj-check"
                  aria-pressed={done}
                  aria-label={done ? `Reopen objective ${row.text}` : `Mark objective complete: ${row.text}`}
                  onClick={() => onToggleComplete(row.id)}
                />
                <input
                  className="trk-now-obj-text"
                  value={row.text}
                  aria-label="Objective text"
                  onChange={(e) => onEditText(row.id, e.target.value)}
                  onBlur={(e) => {
                    if (!e.target.value.trim() && onRemove) onRemove(row.id)
                  }}
                />
              </li>
            )
          })
        )}
      </ul>
      <div className="trk-now-obj-add">
        <input
          ref={addRef}
          className="trk-now-obj-add-field"
          value={draft}
          placeholder="Add objective"
          aria-label="Add objective"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              submit()
            }
          }}
        />
        <button type="button" className="ops-btn trk-now-obj-add-btn" disabled={!draft.trim()} onClick={submit}>
          Add
        </button>
      </div>
    </div>
  )
}

export function NowObjectivesList({
  objectives,
  onAdd,
  onEditText,
  onToggleComplete,
  onRemove,
  mode = "popup",
  contextName,
}: NowObjectivesListProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null)
  const panelId = useId()
  const active = activeNowObjectives(objectives).length
  const total = objectives?.length ?? 0
  const label = contextName
    ? `Objectives for right now · ${contextName}`
    : "Objectives for right now"

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setBox(null)
      return
    }
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      const width = Math.min(320, Math.max(240, rect.width + 120))
      let left = rect.left
      if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8)
      const below = rect.bottom + 6
      const maxTop = window.innerHeight - 280
      setBox({
        top: below > maxTop ? Math.max(8, rect.top - 274) : below,
        left,
        width,
      })
    }
    place()
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    return () => {
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onPointer)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("mousedown", onPointer)
    }
  }, [open])

  if (mode === "inline") {
    return (
      <div className="trk-now-obj-inline" data-testid="now-objectives-inline">
        <div className="trk-now-obj-legend">Objectives for right now</div>
        <ObjectivesEditor
          objectives={objectives}
          onAdd={onAdd}
          onEditText={onEditText}
          onToggleComplete={onToggleComplete}
          onRemove={onRemove}
        />
      </div>
    )
  }

  const summary =
    total === 0 ? "Objectives" : active === 0 ? `${total} done` : `${active} active${total > active ? ` · ${total}` : ""}`

  const panel =
    open && box && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            id={panelId}
            className="trk-now-obj-pop"
            role="dialog"
            aria-label={label}
            data-testid="now-objectives-pop"
            style={{ top: box.top, left: box.left, width: box.width }}
          >
            <div className="trk-now-obj-pop-head">{label}</div>
            <ObjectivesEditor
              objectives={objectives}
              onAdd={onAdd}
              onEditText={onEditText}
              onToggleComplete={onToggleComplete}
              onRemove={onRemove}
              autoFocusAdd
            />
          </div>,
          document.body,
        )
      : null

  return (
    <div className="trk-now-obj-trigger-wrap">
      <button
        ref={triggerRef}
        type="button"
        className={`ops-btn trk-now-obj-trigger${open ? " open" : ""}${active > 0 ? " has-active" : ""}`}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={label}
        data-testid="now-objectives-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        {summary}
      </button>
      {panel}
    </div>
  )
}

export default NowObjectivesList
