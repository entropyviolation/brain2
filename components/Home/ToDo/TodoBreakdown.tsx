/**
 * components/Home/ToDo/TodoBreakdown.tsx — Minutes and nested steps on a To Do row
 *
 * Lives inside the open clamshell lid. Time is one segmented control; the
 * "counts" and progress readouts sit beside it, not inside it. Steps are their
 * own fold. Each step is a rounded card; a step with children folds them
 * (and its nested stylus) with a chevron. The next empty stylus line is
 * always waiting while that card is open. Minutes that count are the greater of the typed estimate and
 * the nested sum. Checking a step does not check its parent.
 */
"use client"

import { useEffect, useRef, useState } from "react"
import type { ClipboardEvent, KeyboardEvent, ReactNode } from "react"
import type { Subtask } from "@/lib/types"
import {
  getTodoPrefs,
  setTodoPrefs,
  useTodoPrefs,
  type TodoLidSection as LidSectionId,
} from "./todo-prefs"
import {
  addNestedStep,
  effectiveDurationMinutes,
  formatInternalProgress,
  removeNestedStep,
  updateNestedStep,
} from "@/lib/todo-steps"

const JOG_PRESETS = [5, 15, 30, 60] as const

export function TodoLidSection({
  id,
  label,
  layout = "stack",
  children,
}: {
  id: LidSectionId
  label: string
  layout?: "stack" | "flags"
  children: ReactNode
}) {
  const collapsed = useTodoPrefs().lidCollapsed[id]
  const toggle = () => {
    const current = getTodoPrefs().lidCollapsed
    setTodoPrefs({ lidCollapsed: { ...current, [id]: !current[id] } })
  }
  return (
    <section
      className={`todo-lid-section${layout === "flags" ? " is-flags" : ""}${collapsed ? " is-collapsed" : ""}`}
    >
      <button
        type="button"
        className="todo-lid-section-label"
        data-no95
        aria-expanded={!collapsed}
        onClick={toggle}
      >
        {label}
      </button>
      {collapsed ? null : layout === "flags" ? (
        <div className="todo-flag-row" role="group" aria-label={label}>
          {children}
        </div>
      ) : (
        <div className="todo-lid-section-body">{children}</div>
      )}
    </section>
  )
}

function TrashMark() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="M2.2 3.2h7.6M4.5 3.1V2.1h3v1M3.1 3.2l.45 7h5l.45-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function parseMinutes(raw: string): number | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n <= 0) return undefined
  return n
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function ViaPad({
  kind,
  checked,
}: {
  kind: "bare" | "leaf" | "parent"
  checked?: boolean
}) {
  return (
    <span
      className={`todo-via is-${kind}${checked ? " is-checked" : ""}`}
      aria-hidden
    />
  )
}

function MinutesBox({
  minutes,
  label,
  onCommit,
}: {
  minutes?: number
  label: string
  onCommit: (minutes: number | undefined) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? (minutes && minutes > 0 ? String(minutes) : "")
  return (
    <input
      className="todo-min"
      type="number"
      min={0}
      step={1}
      inputMode="numeric"
      placeholder="min"
      aria-label={label}
      value={shown}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft == null) return
        onCommit(parseMinutes(draft))
        setDraft(null)
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur()
      }}
    />
  )
}

function StylusLine({
  autoFocus,
  depth,
  onCommit,
  onEmptyEnter,
  ariaLabel,
}: {
  autoFocus?: boolean
  depth: number
  onCommit: (description: string, minutes: number | undefined, staySibling: boolean) => void
  onEmptyEnter: () => void
  ariaLabel: string
}) {
  const nameRef = useRef<HTMLInputElement>(null)
  const minRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState("")
  const [mins, setMins] = useState("")

  useEffect(() => {
    if (autoFocus) nameRef.current?.focus()
  }, [autoFocus])

  const commit = (staySibling: boolean) => {
    const description = name.trim()
    if (!description) {
      onEmptyEnter()
      return
    }
    onCommit(description, parseMinutes(mins), staySibling)
    setName("")
    setMins("")
  }

  const onNameKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      commit(e.shiftKey)
      return
    }
    if (e.key === "Escape") {
      e.preventDefault()
      setName("")
      setMins("")
      onEmptyEnter()
    }
  }

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text")
    if (!text.includes("\n")) return
    e.preventDefault()
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    if (lines.length === 0) return
    lines.forEach((line, i) => {
      onCommit(line, undefined, i < lines.length - 1)
    })
    setName("")
    setMins("")
  }

  return (
    <div className="todo-stylus-line" style={{ ["--todo-depth" as string]: depth }}>
      <ViaPad kind="bare" />
      <input
        ref={nameRef}
        className="todo-stylus-name"
        type="text"
        value={name}
        placeholder="Next step…"
        aria-label={ariaLabel}
        autoComplete="off"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={onNameKey}
        onPaste={onPaste}
      />
      <input
        ref={minRef}
        className="todo-min"
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        placeholder="min"
        aria-label="Minutes for the new step"
        value={mins}
        onChange={(e) => setMins(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            commit(e.shiftKey)
          }
        }}
      />
    </div>
  )
}

function StepBranch({
  step,
  depth,
  flockId,
  setFlockId,
  onChange,
  steps,
}: {
  step: Subtask
  depth: number
  flockId: string | null
  setFlockId: (id: string | null) => void
  onChange: (steps: Subtask[]) => void
  steps: Subtask[]
}) {
  const [editing, setEditing] = useState(false)
  const [folded, setFolded] = useState(false)
  const progress = formatInternalProgress(step.subtasks)
  const effective = effectiveDurationMinutes(step.estimatedDuration, step.subtasks)
  const own = step.estimatedDuration && step.estimatedDuration > 0 ? step.estimatedDuration : 0
  const kidCount = step.subtasks?.length ?? 0
  const hasKids = kidCount > 0
  const remove = () => {
    const inside = step.subtasks?.length ?? 0
    if (inside > 0 && !window.confirm(`Delete "${step.description}" and its ${inside} steps?`)) return
    if (!prefersReducedMotion()) {
      setFlockId(step.id)
      window.setTimeout(() => {
        onChange(removeNestedStep(steps, step.id))
        setFlockId(null)
      }, 280)
      return
    }
    onChange(removeNestedStep(steps, step.id))
  }

  return (
    <li
      className={`todo-step${flockId === step.id ? " is-flock-out" : ""}`}
      style={{ ["--todo-depth" as string]: depth }}
    >
      <div className="todo-step-row">
        <ViaPad kind={hasKids ? "parent" : "leaf"} checked={step.completed} />
        {hasKids ? (
          <button
            type="button"
            className="todo-step-fold"
            data-no95
            aria-expanded={!folded}
            aria-label={folded ? `Show steps under ${step.description}` : `Hide steps under ${step.description}`}
            onClick={() => setFolded((open) => !open)}
          >
            {folded ? "▸" : "▾"}
            <span className="todo-step-fold-count">{kidCount}</span>
          </button>
        ) : null}
        <input
          type="checkbox"
          aria-label={`Done: ${step.description}`}
          checked={step.completed}
          onChange={() => onChange(updateNestedStep(steps, step.id, { completed: !step.completed }))}
        />
        {editing ? (
          <input
            className="todo-stylus-name"
            type="text"
            defaultValue={step.description}
            autoFocus
            aria-label="Step name"
            onBlur={(e) => {
              onChange(updateNestedStep(steps, step.id, { description: e.target.value }))
              setEditing(false)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur()
              if (e.key === "Escape") setEditing(false)
            }}
          />
        ) : (
          <button
            type="button"
            className={`todo-step-name${step.completed ? " is-done" : ""}`}
            data-no95
            onClick={() => setEditing(true)}
          >
            {step.description}
          </button>
        )}
        <MinutesBox
          minutes={step.estimatedDuration}
          label={`Estimated minutes for ${step.description}`}
          onCommit={(minutes) => onChange(updateNestedStep(steps, step.id, { estimatedDuration: minutes }))}
        />
        {effective > own ? (
          <span className="todo-est-used" title="The steps inside add up to more, so this is the time that counts">
            counts {effective}m
          </span>
        ) : null}
        {progress ? <span className="todo-step-progress">{progress}</span> : null}
        <button
          type="button"
          className="todo-btn todo-btn-icon"
          title="Delete step"
          aria-label={`Delete ${step.description}`}
          onClick={remove}
        >
          <TrashMark />
        </button>
      </div>
      {hasKids && !folded ? (
        <ul className="todo-steps">
          {step.subtasks!.map((child) => (
            <StepBranch
              key={child.id}
              step={child}
              depth={depth + 1}
              flockId={flockId}
              setFlockId={setFlockId}
              onChange={onChange}
              steps={steps}
            />
          ))}
        </ul>
      ) : null}
      {!hasKids || !folded ? (
        <StylusLine
          depth={depth + 1}
          ariaLabel={`Add step under ${step.description}`}
          onCommit={(description, minutes) => {
            const next = addNestedStep(steps, step.id, { description, estimatedDuration: minutes })
            onChange(next)
            if (!prefersReducedMotion()) {
              setFlockId(step.id)
              window.setTimeout(() => setFlockId(null), 420)
            }
          }}
          onEmptyEnter={() => {
            /* empty Enter steps back — caret naturally stays; parent stylus handles sibling */
          }}
        />
      ) : null}
    </li>
  )
}

function GlassQuestion({
  onAsk,
}: {
  onAsk: (answer: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState("")
  if (!open) {
    return (
      <button
        type="button"
        className="todo-glass-q"
        title="What would you actually do first?"
        onClick={() => setOpen(true)}
      >
        <ViaPad kind="bare" />
        <span>Ask the glass</span>
      </button>
    )
  }
  return (
    <div className="todo-glass-well">
      <p className="todo-glass-prompt">What would you actually do first?</p>
      <input
        type="text"
        autoFocus
        value={draft}
        aria-label="First step"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false)
            setDraft("")
            return
          }
          if (e.key === "Enter") {
            e.preventDefault()
            const answer = draft.trim()
            if (!answer) return
            onAsk(answer)
            setDraft("")
            setOpen(false)
          }
        }}
      />
    </div>
  )
}

export function TodoBreakdown({
  estimate,
  steps,
  onEstimateChange,
  onStepsChange,
  usualMinutes,
}: {
  estimate?: number
  steps?: Subtask[]
  onEstimateChange: (minutes: number | undefined) => void
  onStepsChange: (steps: Subtask[]) => void
  usualMinutes?: number
}) {
  const [flockId, setFlockId] = useState<string | null>(null)
  const [askDepth, setAskDepth] = useState(0)
  const list = steps ?? []
  const effective = effectiveDurationMinutes(estimate, list)
  const own = estimate && estimate > 0 ? estimate : 0
  const progress = formatInternalProgress(list)
  const bare = list.length === 0 && !(estimate && estimate > 0)

  const jog = (delta: number) => {
    const base = own || 0
    const next = Math.max(0, base + delta)
    onEstimateChange(next > 0 ? next : undefined)
  }

  return (
    <div
      className="todo-breakdown"
      onClick={(event) => event.stopPropagation()}
      data-ui-name="Steps"
      data-ui-help="Estimate and nested steps inside the open lid."
      data-ui-docs="components/Home/ToDo/README.md"
      data-ui-docs-anchor="steps"
    >
      <TodoLidSection id="time" label="Time">
        <div className="todo-time-controls">
          <div className="todo-segment" role="group" aria-label="Estimate">
            <button type="button" className="todo-chiclet" title="Roll up 15 minutes" onClick={() => jog(15)}>
              +15
            </button>
            <button type="button" className="todo-chiclet" title="Roll down 5 minutes" onClick={() => jog(-5)}>
              −5
            </button>
            {JOG_PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                className="todo-chiclet"
                title={`Set ${n} minutes`}
                onClick={() => onEstimateChange(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <MinutesBox minutes={estimate} label="Estimated minutes" onCommit={onEstimateChange} />
        </div>
        <div className="todo-lid-readouts" aria-label="Time readouts">
          {usualMinutes && usualMinutes > 0 ? (
            <button
              type="button"
              className="todo-chiclet is-usual"
              title={`Usually ~${usualMinutes}m — accept as this task's minutes`}
              onClick={() => onEstimateChange(usualMinutes)}
            >
              usually ~{usualMinutes}
            </button>
          ) : null}
          {effective > 0 ? (
            <span className="todo-est-used" title="Minutes that count (greater of typed and step sum)">
              counts {effective}m
            </span>
          ) : null}
          {progress ? <span className="todo-step-progress">{progress}</span> : null}
          {bare ? <span className="todo-lump is-dim" title="No steps and no minutes" aria-label="Unestimated lump" /> : null}
        </div>
      </TodoLidSection>

      <TodoLidSection id="steps" label="Steps">
        {list.length === 0 && askDepth < 3 ? (
          <GlassQuestion
            onAsk={(answer) => {
              onStepsChange(addNestedStep(list, null, { description: answer }))
              setAskDepth((n) => n + 1)
            }}
          />
        ) : null}

        {list.length > 0 ? (
          <ul className="todo-steps">
            {list.map((step) => (
              <StepBranch
                key={step.id}
                step={step}
                depth={0}
                flockId={flockId}
                setFlockId={setFlockId}
                onChange={onStepsChange}
                steps={list}
              />
            ))}
          </ul>
        ) : (
          <div className="todo-trace-bare">
            <ViaPad kind="bare" />
          </div>
        )}

        <StylusLine
          depth={0}
          ariaLabel="Add step"
          onCommit={(description, minutes) => {
            onStepsChange(addNestedStep(list, null, { description, estimatedDuration: minutes }))
            if (!prefersReducedMotion()) {
              setFlockId("root")
              window.setTimeout(() => setFlockId(null), 420)
            }
          }}
          onEmptyEnter={() => {
            /* empty Enter on root does nothing */
          }}
        />
      </TodoLidSection>
    </div>
  )
}

export function TodoDeleteButton({ prompt, onDelete }: { prompt: string; onDelete: () => void }) {
  return (
    <button
      type="button"
      className="todo-btn todo-btn-icon todo-verb is-delete"
      title="Delete"
      aria-label="Delete"
      onClick={() => {
        if (window.confirm(prompt)) onDelete()
      }}
    >
      <TrashMark />
      <span className="todo-verb-word">Delete</span>
    </button>
  )
}
