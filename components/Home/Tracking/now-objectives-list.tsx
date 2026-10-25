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
import { activeNowObjectives, objectiveCompletesTarget, objectiveWorkedMs } from "@/lib/now-objective"
import "@/components/Home/Tracking/tracking-chrome.css"

export interface NowObjectivesHandlers {
  onAdd: (text: string) => void
  /** Log an objective already finished during this sitting. Start is unknown. */
  onAddCompleted?: (text: string) => void
  onEditText: (id: string, text: string) => void
  onToggleComplete: (id: string) => void
  onRemove?: (id: string) => void
  /** Park it for the task or subtask and take it off this sitting. The open stint does not count. */
  onSaveForLater?: (id: string) => void
  /**
   * Attach to a task or subtask of the current activity, or create a task
   * (`createName`) from the search text.
   */
  onAttach?: (id: string, target: { taskId: string; stepId?: string } | { createName: string }) => void
  attachChoices?: { taskId: string; stepId?: string; label: string }[]
  /**
   * With a task on the clock: its open steps, and how to tie an objective to
   * one (`"new"` makes a step from the objective; `undefined` unties it).
   * Omit both and rows stay free-form, as before.
   */
  stepChoices?: { id: string; label: string }[]
  onTieStep?: (id: string, stepId: string | "new" | undefined) => void
  /** Flip a linked objective between "counts toward" and "finishes" its step / task. */
  onSetCompletes?: (id: string, completes: boolean) => void
}

interface NowObjectivesListProps extends NowObjectivesHandlers {
  objectives: NowObjective[] | undefined
  /** Compact trigger for header/strips; inline panel for the entry dialog. */
  mode?: "popup" | "inline"
  /** Optional name fragment for aria (pen or operation title). */
  contextName?: string
}

const clockLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })

/** "3:12 PM → 3:40 PM · 28m" for one objective. Unknown starts name no duration. */
export function objectiveSpanLabel(
  row: Pick<NowObjective, "addedAt" | "completedAt" | "startUnknown" | "workedMs" | "stintStartedAt">,
  now = new Date(),
): string {
  if (!row.completedAt) return `added ${clockLabel(row.addedAt)}`
  if (row.startUnknown) return `completed ${clockLabel(row.completedAt)} · start unknown`
  const ms = objectiveWorkedMs(row, now) ?? Math.max(0, Date.parse(row.completedAt) - Date.parse(row.addedAt))
  const mins = Math.max(0, Math.round(ms / 60_000))
  return `${clockLabel(row.addedAt)} → ${clockLabel(row.completedAt)} · ${mins}m`
}

/**
 * Searchable step picker that opens in the flow of its row (no floating menu,
 * so nothing can land behind the popup). Type to filter; Enter takes the first
 * match; Esc closes.
 */
export function StepSearchPicker({
  value,
  choices,
  allowNew,
  onPick,
  label,
}: {
  value: string | undefined
  choices: { id: string; label: string }[]
  allowNew?: boolean
  onPick: (stepId: string | "new" | undefined) => void
  label: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const current = choices.find((c) => c.id === value)
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const shown = choices.filter((c) => words.every((w) => c.label.toLowerCase().includes(w)))
  const pick = (id: string | "new" | undefined) => {
    onPick(id)
    setOpen(false)
    setQ("")
  }
  if (!open) {
    return (
      <button
        type="button"
        className="trk-now-obj-link"
        aria-label={`Task step for ${label}`}
        title="Tie this objective to a step"
        onClick={() => setOpen(true)}
      >
        {value ? `↳ ${current?.label ?? "step (done)"}` : "↳ not tied to a step"}
      </button>
    )
  }
  return (
    <div className="trk-now-obj-picker" onKeyDown={(e) => e.key === "Escape" && (e.stopPropagation(), setOpen(false))}>
      <input
        autoFocus
        className="trk-now-obj-add-field"
        value={q}
        placeholder="Search steps…"
        aria-label="Search steps"
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            if (shown[0]) pick(shown[0].id)
          }
        }}
      />
      <ul className="trk-now-obj-picker-list" role="listbox" aria-label="Steps">
        <li>
          <button type="button" role="option" aria-selected={!value} onClick={() => pick(undefined)}>
            free (no step)
          </button>
        </li>
        {allowNew && !value ? (
          <li>
            <button type="button" role="option" aria-selected={false} onClick={() => pick("new")}>
              + new step from this objective
            </button>
          </li>
        ) : null}
        {shown.map((c) => (
          <li key={c.id}>
            <button type="button" role="option" aria-selected={c.id === value} onClick={() => pick(c.id)}>
              {c.label}
            </button>
          </li>
        ))}
        {shown.length === 0 ? <li className="trk-now-obj-empty">No step matches.</li> : null}
      </ul>
    </div>
  )
}

/** A textarea that grows with its text, so a long objective is readable. */
function GrowText({ value, onChange, onBlur }: { value: string; onChange: (v: string) => void; onBlur: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return (
    <textarea
      ref={ref}
      rows={1}
      className="trk-now-obj-text"
      value={value}
      aria-label="Objective text"
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onBlur(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
    />
  )
}

function ObjectivesEditor({
  objectives,
  onAdd,
  onAddCompleted,
  onEditText,
  onToggleComplete,
  onRemove,
  onSaveForLater,
  onAttach,
  attachChoices,
  stepChoices,
  onTieStep,
  onSetCompletes,
  autoFocusAdd,
}: NowObjectivesHandlers & { objectives: NowObjective[] | undefined; autoFocusAdd?: boolean }) {
  const [draft, setDraft] = useState("")
  const [hideCompleted, setHideCompleted] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [attachId, setAttachId] = useState<string | null>(null)
  const [attachQuery, setAttachQuery] = useState("")
  const addRef = useRef<HTMLInputElement>(null)
  const list = objectives ?? []
  const shown = hideCompleted ? list.filter((row) => !row.completedAt) : list
  const attachWords = attachQuery.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const attachShown = (attachChoices ?? []).filter((choice) =>
    attachWords.every((word) => choice.label.toLowerCase().includes(word)),
  )

  useEffect(() => {
    if (autoFocusAdd) addRef.current?.focus()
  }, [autoFocusAdd])

  const submit = () => {
    const text = draft.trim()
    if (!text) return
    onAdd(text)
    setDraft("")
  }

  const submitCompleted = () => {
    const text = draft.trim()
    if (!text || !onAddCompleted) return
    onAddCompleted(text)
    setDraft("")
  }

  const openAttach = (row: NowObjective) => {
    setOpenId(row.id)
    setAttachId(row.id)
    setAttachQuery(row.text)
  }

  return (
    <div className="trk-now-obj-editor" data-ui-name="Objectives for right now">
      <div className="trk-now-obj-hide-row">
        <button
          type="button"
          className="trk-now-obj-hide"
          aria-pressed={hideCompleted}
          onClick={() => setHideCompleted((value) => !value)}
        >
          {hideCompleted ? "Show completed" : "Hide completed"}
        </button>
      </div>
      <ul className="trk-now-obj-list" aria-label="Objectives for right now">
        {list.length === 0 ? (
          <li className="trk-now-obj-empty">What are you trying to finish this instant?</li>
        ) : shown.length === 0 ? (
          <li className="trk-now-obj-empty">Completed objectives are hidden.</li>
        ) : (
          shown.map((row) => {
            const done = Boolean(row.completedAt)
            const open = openId === row.id
            return (
              <li
                key={row.id}
                className={done ? "trk-now-obj-row done" : open ? "trk-now-obj-row is-open" : "trk-now-obj-row"}
                onClick={(event) => {
                  const target = event.target as HTMLElement
                  if (target.closest("textarea, input, button, select, a")) return
                  setOpenId((current) => (current === row.id ? null : row.id))
                }}
              >
                <button
                  type="button"
                  className="trk-now-obj-check"
                  aria-pressed={done}
                  aria-label={done ? `Reopen objective ${row.text}` : `Mark objective complete: ${row.text}`}
                  onClick={() => onToggleComplete(row.id)}
                />
                <div className="trk-now-obj-body">
                  <GrowText
                    value={row.text}
                    onChange={(v) => onEditText(row.id, v)}
                    onBlur={(v) => {
                      if (!v.trim() && onRemove) onRemove(row.id)
                    }}
                  />
                  <div className="trk-now-obj-meta">{objectiveSpanLabel(row)}</div>
                  {open ? (
                    <div className="trk-now-obj-detail">
                      {onRemove ? (
                        <button type="button" className="trk-now-obj-mode" onClick={() => onRemove(row.id)}>
                          Delete
                        </button>
                      ) : null}
                      {!done && onSaveForLater ? (
                        <button type="button" className="trk-now-obj-mode" onClick={() => onSaveForLater(row.id)}>
                          Save for later
                        </button>
                      ) : null}
                      {onAttach ? (
                        <button
                          type="button"
                          className="trk-now-obj-mode"
                          aria-expanded={attachId === row.id}
                          onClick={() => (attachId === row.id ? setAttachId(null) : openAttach(row))}
                        >
                          Attach to task/subtask
                        </button>
                      ) : null}
                      {onAttach && attachId === row.id ? (
                        <div className="trk-now-obj-picker">
                          <input
                            className="trk-now-obj-add-field"
                            value={attachQuery}
                            aria-label={`Find a task for ${row.text}`}
                            placeholder="Search tasks"
                            onChange={(event) => setAttachQuery(event.target.value)}
                          />
                          <ul className="trk-now-obj-picker-list" role="listbox" aria-label="Tasks and subtasks">
                            {attachShown.map((choice) => (
                              <li key={`${choice.taskId}:${choice.stepId ?? ""}`}>
                                <button
                                  type="button"
                                  role="option"
                                  onClick={() => {
                                    onAttach(row.id, { taskId: choice.taskId, stepId: choice.stepId })
                                    setAttachId(null)
                                  }}
                                >
                                  {choice.label}
                                </button>
                              </li>
                            ))}
                            {attachShown.length === 0 ? <li className="trk-now-obj-empty">No task matches.</li> : null}
                          </ul>
                          <button
                            type="button"
                            className="ops-btn trk-now-obj-add-btn"
                            disabled={!attachQuery.trim()}
                            onClick={() => {
                              onAttach(row.id, { createName: attachQuery.trim() })
                              setAttachId(null)
                            }}
                          >
                            {attachQuery.trim() ? `Create “${attachQuery.trim()}”` : "Create task"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {onTieStep ? (
                    <div className="trk-now-obj-tie">
                      <StepSearchPicker
                        value={row.stepId}
                        choices={stepChoices ?? []}
                        allowNew
                        label={row.text}
                        onPick={(id) => onTieStep(row.id, id)}
                      />
                      {onSetCompletes ? (
                        <button
                          type="button"
                          className="trk-now-obj-mode"
                          aria-pressed={objectiveCompletesTarget(row)}
                          title={
                            objectiveCompletesTarget(row)
                              ? row.stepId
                                ? "Ticking this ticks the step. Click to make it only count toward the step."
                                : "Ticking this finishes the whole task. Click to undo."
                              : row.stepId
                                ? "Counts toward the step; the step stays open. Click so ticking finishes it."
                                : "Click so ticking this finishes the whole task."
                          }
                          onClick={() => onSetCompletes(row.id, !objectiveCompletesTarget(row))}
                        >
                          {objectiveCompletesTarget(row) ? (row.stepId ? "finishes step" : "finishes task") : row.stepId ? "counts toward" : "just a line"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
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
        <div className="trk-now-obj-add-actions">
          <button type="button" className="ops-btn trk-now-obj-add-btn" disabled={!draft.trim()} onClick={submit}>
            Add objective
          </button>
          {onAddCompleted ? (
            <button
              type="button"
              className="ops-btn trk-now-obj-add-btn"
              disabled={!draft.trim()}
              onClick={submitCompleted}
            >
              Completed objective
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function NowObjectivesList({
  objectives,
  onAdd,
  onAddCompleted,
  onEditText,
  onToggleComplete,
  onRemove,
  onSaveForLater,
  onAttach,
  attachChoices,
  stepChoices,
  onTieStep,
  onSetCompletes,
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
      const width = Math.min(440, Math.max(320, window.innerWidth - 16))
      let left = rect.left
      if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8)
      const below = rect.bottom + 6
      const maxTop = window.innerHeight - 420
      setBox({
        top: below > maxTop ? Math.max(8, rect.top - 414) : below,
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
        <div className="trk-now-obj-legend">Live tracked from Brain 2, objectives:</div>
        <ObjectivesEditor
          objectives={objectives}
          onAdd={onAdd}
          onAddCompleted={onAddCompleted}
          onEditText={onEditText}
          onToggleComplete={onToggleComplete}
          onRemove={onRemove}
          onSaveForLater={onSaveForLater}
          onAttach={onAttach}
          attachChoices={attachChoices}
          stepChoices={stepChoices}
          onTieStep={onTieStep}
          onSetCompletes={onSetCompletes}
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
              onAddCompleted={onAddCompleted}
              onEditText={onEditText}
              onToggleComplete={onToggleComplete}
              onRemove={onRemove}
              onSaveForLater={onSaveForLater}
              onAttach={onAttach}
              attachChoices={attachChoices}
              stepChoices={stepChoices}
              onTieStep={onTieStep}
              onSetCompletes={onSetCompletes}
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
