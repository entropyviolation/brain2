/**
 * components/Home/Tracking/now-objectives-list.tsx — Objectives for right now
 *
 * Popup checklist for free-form objectives on a live timer or a painted block.
 * Opens as a floating panel so the header / strip layout does not grow. Not
 * Home Goals, not the Tracking Objective pen. The text field stays local;
 * `onEditText` runs after a short pause, on blur, and when the field unmounts.
 */
"use client"

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { NowObjective, NowObjectiveLane } from "@/lib/now-objective"
import { activeNowObjectives, formatObjectiveWhen, objectiveCompletesTarget, objectiveLane } from "@/lib/now-objective"
import "@/components/Home/Tracking/tracking-chrome.css"

export interface NowObjectivesHandlers {
  /** Now starts a stint. Next waits, and its clock does not run. */
  onAdd: (text: string, lane: NowObjectiveLane) => void
  /** Log an objective already finished during this sitting. Start is unknown. */
  onAddCompleted?: (text: string) => void
  /**
   * Edit an objective's text. Debounced in this list (400 ms): the field
   * updates immediately, and this callback runs after a pause in typing,
   * immediately on blur, and on unmount so the last characters are kept.
   * Pen, Operations, and the block editor all share that schedule.
   */
  onEditText: (id: string, text: string) => void
  onToggleComplete: (id: string) => void
  /** Next's square. Starts a Now stint. Does not complete the row. */
  onMoveToNow?: (id: string) => void
  /** Now's Next button. Banks the open stint and waits. */
  onMoveToNext?: (id: string) => void
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
  /**
   * The add field. The block editor turns this off unless the block is the
   * one Working on right now is painting.
   */
  allowAdd?: boolean
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
        {value ? `↳ ${current?.label ?? "step (done)"}` : "↳ tie to step"}
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

/** Pause before an objective edit mirrors onto the painted block and the time grid. */
const OBJECTIVE_TEXT_COMMIT_MS = 400

/**
 * A textarea that grows with its text. Letters stay in local state so the
 * field feels instant. `onChange` is the store mirror: it waits out a pause,
 * then also runs on blur and on unmount.
 */
function GrowText({ value, onChange, onBlur }: { value: string; onChange: (v: string) => void; onBlur: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? value
  const timer = useRef<number | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const valueRef = useRef(value)
  valueRef.current = value
  const pendingRef = useRef<string | null>(null)

  const clearTimer = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }

  const flush = (text: string) => {
    clearTimer()
    pendingRef.current = null
    if (text !== valueRef.current) onChangeRef.current(text)
  }

  const schedule = (text: string) => {
    clearTimer()
    if (text === valueRef.current) {
      pendingRef.current = null
      return
    }
    pendingRef.current = text
    timer.current = window.setTimeout(() => {
      timer.current = null
      pendingRef.current = null
      if (text !== valueRef.current) onChangeRef.current(text)
    }, OBJECTIVE_TEXT_COMMIT_MS)
  }

  useEffect(() => {
    return () => {
      clearTimer()
      const pending = pendingRef.current
      pendingRef.current = null
      if (pending !== null && pending !== valueRef.current) onChangeRef.current(pending)
    }
  }, [])

  useEffect(() => {
    if (draft !== null && value === draft) setDraft(null)
  }, [value, draft])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [shown])

  return (
    <textarea
      ref={ref}
      rows={1}
      className="trk-now-obj-text"
      value={shown}
      aria-label="Objective text"
      onChange={(e) => {
        const next = e.target.value
        setDraft(next)
        schedule(next)
      }}
      onBlur={(e) => {
        const next = e.target.value
        flush(next)
        onBlur(next)
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
    />
  )
}

function ModePair({
  row,
  onSetCompletes,
}: {
  row: NowObjective
  onSetCompletes: (id: string, completes: boolean) => void
}) {
  const onStep = !!row.stepId
  const onTask = !!row.taskId && !onStep
  if (!onStep && !onTask) return null
  const finishes = objectiveCompletesTarget(row)
  const options = onStep
    ? [
        { completes: false, label: "counts toward", title: "Ticking counts the time. The step stays open." },
        { completes: true, label: "finishes step", title: "Ticking finishes the step." },
      ]
    : [
        { completes: false, label: "just a line", title: "Ticking only records the line. The task stays open." },
        { completes: true, label: "finishes task", title: "Ticking finishes the whole task." },
      ]
  return (
    <div className="trk-now-obj-mode-pair" role="group" aria-label={`What ticking does for ${row.text}`}>
      {options.map((option) => {
        const selected = finishes === option.completes
        return (
          <button
            key={option.label}
            type="button"
            className={`todo-cap trk-now-obj-mode${selected ? " is-raised" : " is-sunken"}`}
            aria-pressed={selected}
            title={option.title}
            onClick={() => onSetCompletes(row.id, option.completes)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function ObjectivesEditor({
  objectives,
  onAdd,
  onAddCompleted,
  onEditText,
  onToggleComplete,
  onMoveToNow,
  onMoveToNext,
  onRemove,
  onSaveForLater,
  onAttach,
  attachChoices,
  stepChoices,
  onTieStep,
  onSetCompletes,
  autoFocusAdd,
  allowAdd = true,
}: NowObjectivesHandlers & { objectives: NowObjective[] | undefined; autoFocusAdd?: boolean; allowAdd?: boolean }) {
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

  const submit = (lane: NowObjectiveLane) => {
    const text = draft.trim()
    if (!text) return
    onAdd(text, lane)
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
    <div className="trk-now-obj-editor b2-now" data-ui-name="Objectives for right now">
      <div className="trk-now-obj-hide-row">
        <button
          type="button"
          className="todo-cap is-mod trk-now-obj-hide"
          aria-pressed={hideCompleted}
          onClick={() => setHideCompleted((value) => !value)}
        >
          {hideCompleted ? "Show completed" : "Hide completed"}
        </button>
      </div>
      <div className="trk-now-obj-list" aria-label="Objectives for right now">
        {list.length === 0 ? (
          <p className="trk-now-obj-empty">What are you trying to finish this instant?</p>
        ) : shown.length === 0 ? (
          <p className="trk-now-obj-empty">Completed objectives are hidden.</p>
        ) : (
          (["now", "next", "done"] as const).map((section) => {
            const rows = shown.filter((row) => {
              if (row.completedAt) return section === "done"
              return objectiveLane(row) === section
            })
            if (!rows.length) return null
            const heading = section === "now" ? "Now" : section === "next" ? "Next" : "Done"
            return (
              <section key={section} className="trk-now-obj-section" aria-label={heading}>
                <h3 className="trk-now-obj-heading">{heading}</h3>
                <ul>
                  {rows.map((row) => {
            const done = Boolean(row.completedAt)
            const lane = objectiveLane(row)
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
                  aria-label={
                    done
                      ? `Reopen objective ${row.text}`
                      : lane === "next"
                        ? `Move to now: ${row.text}`
                        : `Mark objective complete: ${row.text}`
                  }
                  onClick={() => (lane === "next" ? onMoveToNow?.(row.id) : onToggleComplete(row.id))}
                />
                <div className="trk-now-obj-body">
                  <div className="trk-now-obj-line">
                    <GrowText
                      value={row.text}
                      onChange={(v) => onEditText(row.id, v)}
                      onBlur={(v) => {
                        if (!v.trim() && onRemove) onRemove(row.id)
                      }}
                    />
                    {lane === "now" && onMoveToNext ? (
                      <button
                        type="button"
                        className="todo-cap trk-now-obj-lane"
                        aria-label={`Move to next: ${row.text}`}
                        onClick={() => onMoveToNext(row.id)}
                      >
                        Next
                      </button>
                    ) : null}
                  </div>
                  <div className="trk-now-obj-meta">{formatObjectiveWhen(row)}</div>
                  {open ? (
                    <div className="trk-now-obj-detail">
                      {onRemove ? (
                        <button type="button" className="todo-cap trk-now-obj-mode" onClick={() => onRemove(row.id)}>
                          Delete
                        </button>
                      ) : null}
                      {!done && onSaveForLater ? (
                        <button type="button" className="todo-cap trk-now-obj-mode" onClick={() => onSaveForLater(row.id)}>
                          Save for later
                        </button>
                      ) : null}
                      {onAttach ? (
                        <button
                          type="button"
                          className="todo-cap trk-now-obj-mode"
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
                            className="todo-cap is-primary trk-now-obj-add-btn"
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
                      {onSetCompletes ? <ModePair row={row} onSetCompletes={onSetCompletes} /> : null}
                    </div>
                  ) : null}
                </div>
              </li>
            )
                  })}
                </ul>
              </section>
            )
          })
        )}
      </div>
      {allowAdd ? (
      <div className="trk-now-obj-add">
        <div className="trk-now-obj-add-label">Add objective</div>
        <input
          ref={addRef}
          className="trk-now-obj-add-field"
          value={draft}
          aria-label="Add objective"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              submit("now")
            }
          }}
        />
        <div className="trk-now-obj-add-actions">
          <button type="button" className="todo-cap is-primary trk-now-obj-add-btn" disabled={!draft.trim()} onClick={() => submit("now")}>
            Now
          </button>
          <button type="button" className="todo-cap trk-now-obj-add-btn" disabled={!draft.trim()} onClick={() => submit("next")}>
            Next
          </button>
          {onAddCompleted ? (
            <button
              type="button"
              className="todo-cap trk-now-obj-add-btn"
              disabled={!draft.trim()}
              onClick={submitCompleted}
            >
              Completed
            </button>
          ) : null}
        </div>
      </div>
      ) : null}
    </div>
  )
}

export function NowObjectivesList({
  objectives,
  onAdd,
  onAddCompleted,
  onEditText,
  onToggleComplete,
  onMoveToNow,
  onMoveToNext,
  onRemove,
  onSaveForLater,
  onAttach,
  attachChoices,
  stepChoices,
  onTieStep,
  onSetCompletes,
  mode = "popup",
  contextName,
  allowAdd = true,
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
        <div className="trk-now-obj-legend trk-section-title">Live tracked from Brain 2, objectives:</div>
        <ObjectivesEditor
          objectives={objectives}
          onAdd={onAdd}
          onAddCompleted={onAddCompleted}
          onEditText={onEditText}
          onToggleComplete={onToggleComplete}
          onMoveToNow={onMoveToNow}
          onMoveToNext={onMoveToNext}
          onRemove={onRemove}
          onSaveForLater={onSaveForLater}
          onAttach={onAttach}
          attachChoices={attachChoices}
          stepChoices={stepChoices}
          onTieStep={onTieStep}
          onSetCompletes={onSetCompletes}
          allowAdd={allowAdd}
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
            className="trk-now-obj-pop b2-now"
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
              onMoveToNow={onMoveToNow}
              onMoveToNext={onMoveToNext}
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
    <div className="trk-now-obj-trigger-wrap b2-now">
      <button
        ref={triggerRef}
        type="button"
        className={`todo-cap trk-now-obj-trigger${open ? " open" : ""}${active > 0 ? " has-active" : ""}`}
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
