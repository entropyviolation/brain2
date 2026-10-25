/**
 * components/Home/ToDo/TaskCardSide.tsx — The task card's right bar: node detail
 *
 * One step selected: `NodeDetail` (path, points by level, needs, unlocks).
 * Several: `SelectionSummary` (aggregate figure). None: the task itself, drawn
 * by `TaskCard` with `NeedsEditor` in task mode. `LogNotes` sits under all three.
 *
 * Needs come in three kinds (`lib/node-needs.ts`): tasks first (steps in this
 * tree or any task), resources (any item or list), awaiting (`event` items that
 * lock until logged). Only kinds in use show; **+ Add need** picks a kind, then
 * searches, and creates when nothing fits. **Make a task wait on this** is
 * `WaitPicker`: a portaled multiselect. The head's `Nm left` tag writes
 * `estimatedDuration`. Points are `PointsDial`s: the node's
 * own value and, optionally, what every step inside pays (`stepPoints`).
 */
"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import type { StepTier, Subtask, Task } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { createListItem, itemTitleOrUntitled } from "@/lib/item-utils"
import { STEP_TIERS, STEP_TIER_LABEL, STEP_TIER_SHORT, stepsForTier } from "@/lib/step-tiers"
import { doneToView, formatPercent } from "@/lib/step-progress"
import { effectiveDurationMinutes, flattenSteps } from "@/lib/todo-steps"
import { stepPrereqChoices, toggleStepPrereq } from "@/lib/prereqs"
import { LIST_REF, eventHappened, patchStep, toggleId } from "@/lib/node-needs"
import { leafTally, splitStats } from "@/lib/tree-math"
import { NOTICE_PROMPT, needsNotice, withNoticeAnswer } from "@/lib/notice-dot"
import { massDone, openSubCard, setEstimate, taskPointsWithSource } from "@/lib/task-card"
import { openStepItem, pushItemLayer } from "@/lib/step-item-stack"
import { Mosaic } from "@/components/steps/TreeMath"
import { ItemPenLinksField, withClockPen } from "@/components/ItemDetail/ItemPenTime"
import { PACE_MIN_SAMPLES, paceFor, paceKey, paceSampleCount, type PaceSample } from "@/lib/estimate-pace"
import { stepPenLinks } from "@/lib/task-clock"
import { placeSteps } from "@/lib/next-step"
import { runWithoutCompletionPopup } from "@/lib/completion-events"
import { partsMinutes } from "@/lib/tracked-time"
import { makeNoteEntry } from "@/lib/item-notes"
import { EstimateCell } from "./EstimateCell"
import { SpentDiary, type SpentBlocksScope } from "./SpentBlocks"
import { formatStatMinutes, useTaskCardTimeUnit } from "./TaskCardStats"
import { SegDigits } from "../dash/dash-primitives"

type Write = (label: string, next: Subtask[]) => void
interface Option {
  id: string
  label: string
  hint?: string
}

// ── Search-or-create ─────────────────────────────────────────────────

function Picker({ placeholder, options, onPick, onCreate, title, onDone }: { placeholder: string; options: Option[]; onPick: (id: string) => void; onCreate?: (name: string) => void; title: string; onDone?: () => void }) {
  const [q, setQ] = useState("")
  const [open, setOpen] = useState(!!onDone)
  const needle = q.trim().toLowerCase()
  const hits = options.filter((o) => !needle || o.label.toLowerCase().includes(needle)).slice(0, 7)
  const exact = hits.some((o) => o.label.toLowerCase() === needle)
  const pick = (fn: () => void) => {
    fn()
    setQ("")
    onDone?.()
  }
  return (
    <span className="tcs-picker">
      <input
        data-draft=""
        value={q}
        placeholder={placeholder}
        title={title}
        aria-label={placeholder}
        autoFocus={!!onDone}
        onChange={(e) => (setQ(e.target.value), setOpen(true))}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => (setOpen(false), q.trim() ? null : onDone?.()), 120)}
        onKeyDown={(e) => {
          if (e.key === "Escape") return (e.stopPropagation(), setOpen(false), onDone?.())
          if (e.key !== "Enter") return
          e.preventDefault()
          if (hits[0] && (exact || !onCreate || !needle)) pick(() => onPick(hits.find((h) => h.label.toLowerCase() === needle)?.id ?? hits[0].id))
          else if (needle && onCreate) pick(() => onCreate(q.trim()))
        }}
      />
      {open && (hits.length || (needle && onCreate)) ? (
        <span className="tcs-picker-menu" role="listbox">
          {hits.map((o) => (
            <button key={o.id} type="button" role="option" aria-selected={false} title={`Add ${o.label}`} onMouseDown={(e) => (e.preventDefault(), pick(() => onPick(o.id)))}>
              {o.label}
              {o.hint ? <small>{o.hint}</small> : null}
            </button>
          ))}
          {needle && onCreate && !exact ? (
            <button type="button" className="is-create" title="Make a new item with this name and add it" onMouseDown={(e) => (e.preventDefault(), pick(() => onCreate(q.trim())))}>
              + New “{q.trim()}”
            </button>
          ) : null}
        </span>
      ) : null}
    </span>
  )
}

function Chip({ label, state, onRemove, onOpen, children }: { label: string; state?: "done" | "open" | "wait" | "ref"; onRemove: () => void; onOpen?: () => void; children?: React.ReactNode }) {
  return (
    <span className={`tcs-chip is-${state ?? "ref"}`}>
      <i aria-hidden />
      {onOpen ? (
        <button type="button" className="tcs-chip-name" title={`Open ${label}`} onClick={onOpen}>
          {label}
        </button>
      ) : (
        <span className="tcs-chip-name">{label}</span>
      )}
      {children}
      <button type="button" className="tcs-chip-x" title={`Remove ${label}`} aria-label={`Remove ${label}`} onClick={onRemove}>
        ×
      </button>
    </span>
  )
}

/**
 * Minutes still believed for undone work. Done steps drop out.
 * The rule is the same as `effectiveDurationMinutes`: the greater of the
 * number typed on this node and the sum of what is still open inside it.
 */
export function openEstimateMinutes(own: number | undefined, steps: readonly Subtask[] | undefined): number {
  const mine = own != null && own > 0 ? own : 0
  const kids = steps ?? []
  if (!kids.length) return mine
  const child = kids.reduce((n, step) => n + (step.completed ? 0 : openEstimateMinutes(step.estimatedDuration, step.subtasks)), 0)
  return Math.max(mine, child)
}

/**
 * A pace the lid ghost would use: a pen with samples or an override, else overall.
 * The bare fallback of 1 (fewer than three samples, no override) is not a pace.
 */
export function knownPace(task: Pick<Task, "penLinks"> | undefined, samples: readonly PaceSample[], overrides: Record<string, number> = {}): number | null {
  for (const { penId } of task?.penLinks ?? []) {
    const scope = { kind: "pen" as const, penId }
    if ((overrides[paceKey(scope)] ?? 0) > 0 || paceSampleCount(samples, scope) >= PACE_MIN_SAMPLES) return paceFor(samples, scope, overrides)
  }
  const overall = { kind: "overall" as const }
  if ((overrides[paceKey(overall)] ?? 0) > 0 || paceSampleCount(samples, overall) >= PACE_MIN_SAMPLES) return paceFor(samples, overall, overrides)
  return null
}

/** The aside's remaining-time tag. Click opens the readings; the field still writes `estimatedDuration`. */
export function RemainingEstTag({
  shown,
  field,
  label,
  onSet,
  steps,
  spent = 0,
  levelMinutes,
  pace,
}: {
  shown: number
  field?: number
  label: string
  onSet: (minutes: number) => void
  steps?: readonly Subtask[]
  spent?: number
  /** `remainingForLevel` for the aimed tier. Omitted when there is nothing to compare. */
  levelMinutes?: number
  /** `knownPace`, or null when no pace exists. Times the still-open minutes. */
  pace?: number | null
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState("")
  const skipBlur = useRef(false)
  const pop = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const unit = useTaskCardTimeUnit()
  const dur = (n: number) => formatStatMinutes(Math.abs(Math.round(n)), unit)
  const start = field && field > 0 ? String(field) : shown > 0 ? String(shown) : ""
  const commit = (raw: string) => {
    const next = raw.trim() === "" ? 0 : Math.max(0, Math.round(Number(raw)) || 0)
    if (next !== (field ?? 0)) onSet(next)
    setOpen(false)
  }
  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (btn.current?.contains(target) || pop.current?.contains(target)) return
      commit(draft)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      event.stopPropagation()
      skipBlur.current = true
      setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey, true)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey, true)
    }
  }, [open, draft, field, onSet])
  const openParts = (steps ?? []).reduce((n, step) => n + (step.completed ? 0 : openEstimateMinutes(step.estimatedDuration, step.subtasks)), 0)
  const fullLeft = effectiveDurationMinutes(field, steps) - spent
  const paceMinutes = pace != null && shown > 0 ? Math.round(pace * shown) : null
  const rows: { name: string; minutes: number; sentence: string }[] = [{ name: "Still open", minutes: shown, sentence: "The greater of the number on this node and what is still undone inside it." }]
  if (field != null && field > 0 && field !== shown) rows.push({ name: "Your number", minutes: field, sentence: "What you typed on this node." })
  if ((steps?.length ?? 0) > 0 && openParts !== shown) rows.push({ name: "Open parts", minutes: openParts, sentence: "The sum of the steps that are not done yet." })
  if ((effectiveDurationMinutes(field, steps) > 0 || spent > 0) && fullLeft !== shown) {
    rows.push({
      name: "Full tree, minus logged",
      minutes: Math.abs(fullLeft),
      sentence: fullLeft >= 0 ? "The whole tree, after the minutes already logged." : "Logged minutes are past the whole tree by this much.",
    })
  }
  if (levelMinutes != null && levelMinutes !== shown) rows.push({ name: "This level", minutes: levelMinutes, sentence: "Open leaves in the aimed level only." })
  if (paceMinutes != null) rows.push({ name: "At your pace", minutes: paceMinutes, sentence: "Still open, times the pace you usually take." })
  if (spent > shown) rows.push({ name: "Already past", minutes: spent - shown, sentence: "Logged time is past the still-open belief by this much." })
  const title = field && field > 0 && field !== shown
    ? `Your estimate is ${field}m. The tag shows ${shown}m left on undone work. Click to read the other figures and set your estimate.`
    : "Your estimate for the time left on undone work. Click to read it and set it."
  return (
    <>
      <button
        ref={btn}
        type="button"
        data-no95=""
        className="tcs-meta-pill"
        aria-expanded={open}
        aria-label={`Estimated time left for ${label}`}
        title={title}
        onClick={() => {
          setDraft(start)
          setOpen((v) => !v)
        }}
      >
        {shown > 0 ? `${shown}m left` : "— left"}
      </button>
      {open ? (
        <div ref={pop} className="tcs-remain" data-task-card-pop="" role="dialog" aria-label={`Time still open for ${label}`}>
          <label className="tcs-remain-set">
            <span>Your estimate</span>
            <input
              data-no95=""
              data-draft=""
              className="tcs-meta-input"
              type="number"
              min={0}
              inputMode="numeric"
              autoFocus
              aria-label={`Estimated time left for ${label}`}
              value={draft}
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                if (skipBlur.current) {
                  skipBlur.current = false
                  return
                }
                commit(draft)
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") return (e.preventDefault(), e.stopPropagation(), (skipBlur.current = true), setOpen(false))
                if (e.key === "Enter") (e.preventDefault(), commit(draft))
              }}
            />
          </label>
          <ul className="tcs-remain-rows">
            {rows.map((row) => (
              <li key={row.name}>
                <span>{row.name}</span>
                <b>{dur(row.minutes)}</b>
                <p>{row.sentence}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  )
}

interface WaitRow {
  id: string
  label: string
  /** Parent path from `placeSteps`, such as `Front › spine`. */
  path?: string
  band: 0 | 1 | 2
  checked: boolean
  onToggle: () => void
}

const WAIT_BAND = ["This level", "Rest of this task", "Other tasks"]

/** Searchable multiselect, portaled beside the button so the card's overflow cannot cover it. */
function WaitPicker({ label, title, rows }: { label: string; title: string; rows: WaitRow[] }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null)

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const rect = btn.current?.getBoundingClientRect()
      if (!rect) return
      const width = Math.min(360, window.innerWidth - 24)
      const chrome = 96
      const want = 320 + chrome
      const spaceBelow = window.innerHeight - rect.bottom - 16
      const spaceAbove = rect.top - 16
      const openUp = spaceBelow < Math.min(want, 220) && spaceAbove > spaceBelow
      const room = Math.max(140, openUp ? spaceAbove : spaceBelow)
      const maxHeight = Math.min(want, room, window.innerHeight - 24)
      let left = rect.right + 8
      if (left + width > window.innerWidth - 12) left = rect.left - width - 8
      if (left < 12) left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
      const top = openUp ? Math.max(12, rect.top - maxHeight - 8) : rect.bottom + 8
      setBox({ top, left, width, maxHeight })
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
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (btn.current?.contains(target) || pop.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey, true)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey, true)
    }
  }, [open])

  const needle = q.trim().toLowerCase()
  const hits = rows.filter((row) => !needle || row.label.toLowerCase().includes(needle) || (row.path ?? "").toLowerCase().includes(needle))
  const byName = (a: WaitRow, b: WaitRow) => a.label.localeCompare(b.label)
  const waiting = hits.filter((row) => row.checked).sort(byName)
  const sections = [
    waiting.length ? { name: "Waiting now", rows: waiting } : null,
    ...([0, 1, 2] as const).map((band) => {
      const bandRows = hits.filter((row) => !row.checked && row.band === band).sort(byName)
      return bandRows.length ? { name: WAIT_BAND[band], rows: bandRows } : null
    }),
  ].filter((section): section is { name: string; rows: WaitRow[] } => section !== null)

  return (
    <>
      <button ref={btn} type="button" className="tcs-add-key" aria-expanded={open} title={title} onClick={() => setOpen((v) => !v)}>
        <b aria-hidden>+</b> {label}
      </button>
      {open && box
        ? createPortal(
            <div ref={pop} className="tcs-wait-pop" data-task-card-pop="" role="dialog" aria-label={title} style={{ position: "fixed", zIndex: 80, pointerEvents: "auto", top: box.top, left: box.left, width: box.width, maxHeight: box.maxHeight }}>
              <p className="tcs-wait-title">{title}</p>
              <input
                className="tcs-wait-search"
                data-draft=""
                data-no95=""
                autoFocus
                value={q}
                placeholder="Search"
                aria-label="Search work that waits"
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") (e.stopPropagation(), e.preventDefault(), setOpen(false))
                }}
              />
              <div className="tcs-wait-list" role="listbox" aria-multiselectable="true" aria-label="Work that waits until this is done">
                {sections.length === 0 ? <p className="tcs-hint">Nothing matches.</p> : null}
                {sections.map((section) => (
                  <section key={section.name} className="tcs-wait-section">
                    <h3 className="tcs-wait-band">{section.name}</h3>
                    {section.rows.map((row) => (
                      <label key={row.id} className="tcs-wait-row">
                        <input type="checkbox" checked={row.checked} aria-label={row.label} onChange={row.onToggle} />
                        <span className="tcs-wait-copy">
                          <span className="tcs-wait-name">{row.label}</span>
                          {row.path ? <span className="tcs-wait-path">{row.path}</span> : null}
                        </span>
                      </label>
                    ))}
                  </section>
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

/** A quiet **+ label** key that opens its editor in place; the editor closes itself. */
function Reveal({ label, title, children }: { label: string; title: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false)
  return open ? (
    <div className="tcs-reveal">{children(() => setOpen(false))}</div>
  ) : (
    <button type="button" className="tcs-add-key" title={title} onClick={() => setOpen(true)}>
      <b aria-hidden>+</b> {label}
    </button>
  )
}

// ── Points dial ──────────────────────────────────────────────────────

const toPoints = (v: string) => (v === "" ? undefined : Math.max(0, Math.round(Number(v) || 0)))

/** One editable points figure: −  N  +, with where it comes from underneath. */
export function PointsDial({ label, title, value, fallback, onChange, caption, size = "lg" }: { label: string; title: string; value?: number; fallback?: number; onChange: (next: number | undefined) => void; caption?: ReactNode; size?: "lg" | "sm" }) {
  const base = value ?? fallback ?? 0
  return (
    <div className={`tcs-dial is-${size}${value == null ? " is-fallback" : ""}`} title={title}>
      <span className="tcs-dial-label">{label}</span>
      <span className="tcs-dial-body">
        <button type="button" tabIndex={-1} aria-label={`${label} minus one`} disabled={base <= 0} onClick={() => onChange(Math.max(0, base - 1))}>
          −
        </button>
        <span className="tcs-dial-tube">
          <SegDigits value={String(value ?? fallback ?? 0)} cells={4} label="" />
          <input type="number" min={0} inputMode="numeric" aria-label={label} value={value ?? ""} placeholder={fallback != null ? String(fallback) : "—"} onChange={(e) => onChange(toPoints(e.target.value))} />
        </span>
        <button type="button" tabIndex={-1} aria-label={`${label} plus one`} onClick={() => onChange(base + 1)}>
          +
        </button>
      </span>
      {caption ? <span className="tcs-dial-cap">{caption}</span> : null}
    </div>
  )
}

const SOURCE_WORDS: Record<string, string> = { "tier formula": "from the list's tier formula", "list rule": "from the list's points", "item value": "from the item's value", default: "the house default" }

/** The whole task: its points on done, and the optional default for every step inside. */
export function TaskPoints({ task }: { task: Task }) {
  const lists = useTaskStore((s) => s.lists)
  const folders = useTaskStore((s) => s.folders)
  const updateTask = useTaskStore((s) => s.updateTask)
  const rule = taskPointsWithSource({ ...task, pointsOverride: undefined }, lists, folders)
  const patch = (field: "pointsOverride" | "stepPoints", v: number | undefined) => {
    const next = { ...task, [field]: v } as Task
    if (v === undefined) delete next[field]
    updateTask(next)
  }
  return (
    <section className="tcs-points tcs-control-card" aria-label="Points">
      <h3>Points</h3>
      <div className="tcs-dials">
        <PointsDial
          label="On done"
          title="Points paid when this task is done. Leave empty to use the rule."
          value={task.pointsOverride}
          fallback={rule.points}
          onChange={(v) => patch("pointsOverride", v)}
          caption={
            task.pointsOverride != null ? (
              <button type="button" className="tcs-reset" title={`Drop this value; the rule gives ${rule.points}`} onClick={() => patch("pointsOverride", undefined)}>
                ↺ Back to the rule
              </button>
            ) : (
              SOURCE_WORDS[rule.source] ?? rule.source
            )
          }
        />
        <PointsDial
          size="sm"
          label="Each step"
          title="Optional. Points paid when any step of this task is done, unless that step (or a step above it) sets its own."
          value={task.stepPoints}
          onChange={(v) => patch("stepPoints", v)}
          caption={task.stepPoints != null ? "per step inside" : "optional"}
        />
      </div>
    </section>
  )
}

// ── Needs (step or task) ─────────────────────────────────────────────

export interface NeedsTarget {
  /** The task, when no step is the node. */
  task: Task
  step?: Subtask
  steps: Subtask[]
  write: Write
}

export function NeedsEditor({ task, step, steps, write }: NeedsTarget) {
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const addTask = useTaskStore((s) => s.addTask)
  const updateTask = useTaskStore((s) => s.updateTask)
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const flat = useMemo(() => flattenSteps(steps), [steps])
  const stepName = (id: string) => flat.find((s) => s.id === id)?.description ?? "?"
  const nameOf = (id: string) =>
    id.startsWith(LIST_REF) ? `☰ ${lists.find((l) => `${LIST_REF}${l.id}` === id)?.name ?? "list"}` : byId.get(id) ? itemTitleOrUntitled(byId.get(id)!) : "(gone)"

  // Fields live on the step, or on the task (tasks first = `dependencies`).
  const taskIds = step ? step.needsTaskIds : task.dependencies
  const resources = step ? step.resourceIds : task.resourceIds
  const awaits = step ? step.awaitIds : task.awaitIds
  const set = (field: "tasks" | "resourceIds" | "awaitIds", next: string[] | undefined, label: string) => {
    if (step) write(label, patchStep(steps, step.id, { [field === "tasks" ? "needsTaskIds" : field]: next }))
    else {
      const t = { ...task, [field === "tasks" ? "dependencies" : field]: next } as Task & Record<string, unknown>
      if (next === undefined) delete t[field === "tasks" ? "dependencies" : field]
      updateTask(t)
    }
  }
  const make = (name: string, type: string) => {
    const item = { ...createListItem(name), type } as Task
    addTask(item)
    return item.id
  }

  const choices = step ? stepPrereqChoices(steps, step.id) : new Set<string>()
  const taskOptions: Option[] = tasks
    .filter((t) => t.id !== task.id && (t.type ?? "task") === "task" && !t.completed && !(taskIds ?? []).includes(t.id))
    .map((t) => ({ id: t.id, label: itemTitleOrUntitled(t) }))
  const stepOptions: Option[] = step ? flat.filter((s) => choices.has(s.id) && !(step.dependsOn ?? []).includes(s.id)).map((s) => ({ id: `step:${s.id}`, label: s.description, hint: "step" })) : []
  const resourceOptions: Option[] = [
    ...lists.map((l) => ({ id: `${LIST_REF}${l.id}`, label: l.name, hint: "list" })),
    ...tasks.filter((t) => t.id !== task.id && t.type !== "event").map((t) => ({ id: t.id, label: itemTitleOrUntitled(t), hint: t.type ?? "item" })),
  ].filter((o) => !(resources ?? []).includes(o.id))
  const eventOptions: Option[] = tasks.filter((t) => t.type === "event" && !(awaits ?? []).includes(t.id)).map((t) => ({ id: t.id, label: itemTitleOrUntitled(t), hint: t.completed ? "logged" : "event" }))

  const stepIds = step?.dependsOn ?? []
  const firstCount = stepIds.length + (taskIds?.length ?? 0)
  const kinds: { id: NeedKind; label: string; title: string }[] = [
    { id: "first", label: "Task first", title: "A step here, or any task, that comes first. Locks until done." },
    { id: "resource", label: "Resource", title: "An item or list holding the supplies, files or info. Never locks." },
    { id: "await", label: "Awaiting", title: "An event outside your hands: a reply, an approval, a delivery. Locks until logged or its date passes." },
  ]
  const pickerFor = (kind: NeedKind, close: () => void) =>
    kind === "first" ? (
      <Picker
        key={kind}
        onDone={close}
        placeholder="Search steps and tasks…"
        title="Pick a step or task that comes first, or type a new task name and press Enter"
        options={[...stepOptions, ...taskOptions]}
        onPick={(id) => (id.startsWith("step:") ? write("Needs", toggleStepPrereq(steps, step!.id, id.slice(5))) : set("tasks", toggleId(taskIds, id), "Needs"))}
        onCreate={(name) => set("tasks", [...(taskIds ?? []), make(name, "task")], "Needs")}
      />
    ) : kind === "resource" ? (
      <Picker
        key={kind}
        onDone={close}
        placeholder="Search items and lists…"
        title="Link an item or list holding what this needs, or type a name to make a new item"
        options={resourceOptions}
        onPick={(id) => set("resourceIds", toggleId(resources, id), "Resources")}
        onCreate={(name) => set("resourceIds", [...(resources ?? []), make(name, "item")], "Resources")}
      />
    ) : (
      <Picker
        key={kind}
        onDone={close}
        placeholder="Search or name an event…"
        title="Pick an event to wait on, or type one (e.g. “Elijah approves”) to make it"
        options={eventOptions}
        onPick={(id) => set("awaitIds", toggleId(awaits, id), "Awaiting")}
        onCreate={(name) => set("awaitIds", [...(awaits ?? []), make(name, "event")], "Awaiting")}
      />
    )

  return (
    <>
      {firstCount ? (
        <div className="tcs-need is-first">
          <h4 title={kinds[0].title}>Tasks first</h4>
          <div className="tcs-chips">
            {stepIds.map((id) => (
              <Chip key={id} label={stepName(id)} state={flat.find((s) => s.id === id)?.completed ? "done" : "open"} onRemove={() => write("Needs", toggleStepPrereq(steps, step!.id, id))} />
            ))}
            {(taskIds ?? []).map((id) => (
              <Chip key={id} label={nameOf(id)} state={byId.get(id)?.completed ? "done" : "open"} onOpen={() => pushItemLayer(id)} onRemove={() => set("tasks", toggleId(taskIds, id), "Needs")} />
            ))}
          </div>
        </div>
      ) : null}

      {resources?.length ? (
        <div className="tcs-need is-resource">
          <h4 title={kinds[1].title}>Resources</h4>
          <div className="tcs-chips">
            {resources.map((id) => (
              <Chip key={id} label={nameOf(id)} onOpen={id.startsWith(LIST_REF) ? undefined : () => pushItemLayer(id)} onRemove={() => set("resourceIds", toggleId(resources, id), "Resources")} />
            ))}
          </div>
        </div>
      ) : null}

      {awaits?.length ? (
        <div className="tcs-need is-await">
          <h4 title={kinds[2].title}>Awaiting</h4>
          <div className="tcs-chips">
            {awaits.map((id) => {
              const ev = byId.get(id)
              return (
                <Chip key={id} label={nameOf(id)} state={eventHappened(ev) ? "done" : "wait"} onOpen={() => pushItemLayer(id)} onRemove={() => set("awaitIds", toggleId(awaits, id), "Awaiting")}>
                  {ev && !ev.completed ? (
                    <button type="button" className="tcs-log" title="Log that this happened now. Unlocks what waits on it." onClick={() => runWithoutCompletionPopup(() => updateTask({ ...ev, completed: true, completedDate: new Date() }))}>
                      log
                    </button>
                  ) : null}
                </Chip>
              )
            })}
          </div>
        </div>
      ) : null}

      {!firstCount && !resources?.length && !awaits?.length ? <p className="is-quiet tcs-empty">Needs nothing yet.</p> : null}

      <div className="tcs-needs-actions">
        <Reveal label="Add need" title="Add something this waits on or uses">
          {(close) => <AddNeed kinds={kinds} pickerFor={pickerFor} close={close} />}
        </Reveal>
      </div>
    </>
  )
}

type NeedKind = "first" | "resource" | "await"

/** Pick a kind, then search inside it. */
function AddNeed({ kinds, pickerFor, close }: { kinds: { id: NeedKind; label: string; title: string }[]; pickerFor: (kind: NeedKind, close: () => void) => ReactNode; close: () => void }) {
  const [kind, setKind] = useState<NeedKind | null>(null)
  return (
    <div className="tcs-add-need">
      <span className="tcs-kinds" role="group" aria-label="Kind of need">
        {kinds.map((k) => (
          <button key={k.id} type="button" className={`is-${k.id}`} aria-pressed={kind === k.id} title={k.title} onClick={() => setKind(k.id)}>
            <i aria-hidden />
            {k.label}
          </button>
        ))}
        <button type="button" className="tcs-kinds-x" title="Cancel" aria-label="Cancel adding a need" onClick={close}>
          ×
        </button>
      </span>
      {kind ? pickerFor(kind, close) : <span className="tcs-hint">Choose a kind.</span>}
    </div>
  )
}

/** Steps that wait on this one; add or drop them here. */
function StepUnlocks({ step, steps, write }: { step: Subtask; steps: Subtask[]; write: Write }) {
  const flat = flattenSteps(steps)
  const placed = placeSteps(steps)
  const mine = placed.find((row) => row.step.id === step.id)
  const parentId = mine ? mine.path[mine.path.length - 1]?.id : undefined
  const waiters = flat.filter((s) => (s.dependsOn ?? []).includes(step.id))
  const rows: WaitRow[] = placed
    .filter((row) => row.step.id !== step.id && !row.step.completed && (stepPrereqChoices(steps, row.step.id).has(step.id) || (row.step.dependsOn ?? []).includes(step.id)))
    .map((row) => ({
      id: row.step.id,
      label: row.step.description,
      path: row.path.map((step) => step.description).join(" › ") || undefined,
      band: (row.path[row.path.length - 1]?.id ?? undefined) === parentId ? 0 : 1,
      checked: (row.step.dependsOn ?? []).includes(step.id),
      onToggle: () => write("Unlocks", toggleStepPrereq(steps, row.step.id, step.id)),
    }))
  return (
    <div className="tcs-need is-unlocks">
      {waiters.length ? (
        <>
          <h4 title="Steps that wait on this one">Unlocks</h4>
          <div className="tcs-chips">
            {waiters.map((s) => (
              <Chip key={s.id} label={s.description} state={s.completed ? "done" : "open"} onRemove={() => write("Unlocks", toggleStepPrereq(steps, s.id, step.id))} />
            ))}
          </div>
        </>
      ) : null}
      {rows.length ? (
        <div className="tcs-needs-actions">
          <WaitPicker label="Make a step wait on this" title="Pick a step that waits until this one is done" rows={rows} />
        </div>
      ) : null}
    </div>
  )
}

/** Tasks that wait on this task; add or drop them here. */
export function TaskUnlocks({ task }: { task: Task }) {
  const tasks = useTaskStore((s) => s.tasks)
  const updateTask = useTaskStore((s) => s.updateTask)
  const placed = placeSteps(task.subtasks)
  const waiters = tasks.filter((t) => (t.dependencies ?? []).includes(task.id))
  const flip = (t: Task) => updateTask({ ...t, dependencies: toggleId(t.dependencies, task.id) ?? [] })
  const toggleStep = (stepId: string) => {
    const latest = useTaskStore.getState().tasks.find((row) => row.id === task.id)
    const step = latest ? flattenSteps(latest.subtasks).find((row) => row.id === stepId) : undefined
    if (!latest || !step) return
    updateTask({ ...latest, subtasks: patchStep(latest.subtasks, stepId, { needsTaskIds: toggleId(step.needsTaskIds, task.id) }) })
  }
  const rows: WaitRow[] = [
    ...placed
      .filter((row) => !row.step.completed)
      .map((row) => ({
        id: `step:${row.step.id}`,
        label: row.step.description,
        path: row.path.map((step) => step.description).join(" › ") || undefined,
        band: (row.path.length === 0 ? 0 : 1) as 0 | 1,
        checked: (row.step.needsTaskIds ?? []).includes(task.id),
        onToggle: () => toggleStep(row.step.id),
      })),
    ...tasks
      .filter((t) => t.id !== task.id && (t.type ?? "task") === "task" && !t.completed && t.stepOf?.taskId !== task.id)
      .map((t) => ({
        id: t.id,
        label: itemTitleOrUntitled(t),
        band: 2 as const,
        checked: (t.dependencies ?? []).includes(task.id),
        onToggle: () => flip(t),
      })),
  ]
  return (
    <div className="tcs-need is-unlocks">
      {waiters.length ? (
        <>
          <h4 title="Tasks that wait on this one">Unlocks</h4>
          <div className="tcs-chips">
            {waiters.map((t) => (
              <Chip key={t.id} label={itemTitleOrUntitled(t)} state={t.completed ? "done" : "open"} onOpen={() => pushItemLayer(t.id)} onRemove={() => flip(t)} />
            ))}
          </div>
        </>
      ) : null}
      <div className="tcs-needs-actions">
        <WaitPicker label="Make a task wait on this" title="Pick a task that waits until this one is done" rows={rows} />
      </div>
    </div>
  )
}

// ── Points ladder ────────────────────────────────────────────────────

function PointsLadder({ task, step, steps, write }: { task: Task; step: Subtask; steps: Subtask[]; write: Write }) {
  const hasKids = !!step.subtasks?.length
  const byLevel = hasKids && !!step.tierPoints
  // Only levels that have a step inside this one can be reached here.
  const inside = new Set(STEP_TIERS.filter((t) => stepsForTier(steps, t).ids.has(step.id) || flattenSteps(step.subtasks).some((s) => stepsForTier(steps, t).ids.has(s.id))))
  const reached = (t: StepTier) => doneToView(step, stepsForTier(steps, t))
  // What it pays with no value of its own: the nearest `stepPoints` above it.
  const inherited = pathTo(steps, step.id).slice(0, -1).reduceRight<number | undefined>((v, s) => v ?? s.stepPoints, undefined) ?? task.stepPoints
  const setTier = (t: StepTier, v: string) => {
    const next = { ...step.tierPoints, [t]: v === "" ? undefined : Math.max(0, Number(v) || 0) }
    write("Step points", patchStep(steps, step.id, { tierPoints: next }))
  }
  const total = byLevel ? STEP_TIERS.reduce((n, t) => n + (step.tierPoints?.[t] ?? 0), 0) : (step.points ?? inherited ?? 0)
  return (
    <section className="tcs-points tcs-control-card" aria-label="Points for this step">
      <h3 title="Points paid when this step is done. With steps inside, you can pay per level reached instead.">
        Points <span className="tcs-total">{total}</span>
      </h3>
      {hasKids ? (
        <span className="tcs-seg" role="group" aria-label="Points mode">
          <button type="button" aria-pressed={!byLevel} title="One value, paid when the whole step is ticked" onClick={() => write("Step points", patchStep(steps, step.id, { tierPoints: undefined }))}>
            On done
          </button>
          <button type="button" aria-pressed={byLevel} title="Pay as each level inside is reached: Bare minimum, then Goal, then Exceptional" onClick={() => write("Step points", patchStep(steps, step.id, { tierPoints: step.tierPoints ?? {} }))}>
            By level
          </button>
        </span>
      ) : null}
      {byLevel ? (
        <div className="tcs-ladder">
          {STEP_TIERS.map((t) => (
            <label key={t} className={`tcs-rung is-${t}${reached(t) ? " is-reached" : ""}${inside.has(t) ? "" : " is-off"}`} title={inside.has(t) ? `${STEP_TIER_LABEL[t]}: paid when every ${STEP_TIER_SHORT[t]} step inside is done${reached(t) ? " (reached)" : ""}` : `No ${STEP_TIER_LABEL[t]} step inside yet`}>
              <span className="tcs-rung-tag">{STEP_TIER_SHORT[t]}</span>
              <input type="number" min={0} disabled={!inside.has(t)} aria-label={`${STEP_TIER_LABEL[t]} points`} value={step.tierPoints?.[t] ?? ""} placeholder="0" onChange={(e) => setTier(t, e.target.value)} />
            </label>
          ))}
        </div>
      ) : null}
      <div className="tcs-dials">
        {byLevel ? null : (
          <PointsDial
            label="On done"
            title="Points paid when this step is ticked"
            value={step.points}
            fallback={inherited}
            onChange={(v) => write("Step points", patchStep(steps, step.id, { points: v }))}
            caption={step.points == null ? (inherited != null ? "inherited from above" : "none yet") : inherited != null ? (
              <button type="button" className="tcs-reset" title={`Drop this value; it inherits ${inherited}`} onClick={() => write("Step points", patchStep(steps, step.id, { points: undefined }))}>
                ↺ Inherit {inherited}
              </button>
            ) : "set here"}
          />
        )}
        {hasKids ? (
          <PointsDial
            size="sm"
            label="Each step"
            title="Optional. Points paid when any step inside this one is done, unless it sets its own."
            value={step.stepPoints}
            fallback={inherited}
            onChange={(v) => write("Step points", patchStep(steps, step.id, { stepPoints: v }))}
            caption={step.stepPoints != null ? "per step inside" : "optional"}
          />
        ) : null}
      </div>
    </section>
  )
}

// ── One step ─────────────────────────────────────────────────────────

/** The one way into the item popup from the detail panel: a ghost window-arrow key. */
export function OpenItemKey({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="tcs-open-item" title="Open item" aria-label="Open item" onClick={onClick}>
      <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6.5 3H3.5A1.5 1.5 0 0 0 2 4.5v8A1.5 1.5 0 0 0 3.5 14h8a1.5 1.5 0 0 0 1.5-1.5V9.5" />
        <path d="M9.5 2H14v4.5M14 2 7.5 8.5" />
      </svg>
    </button>
  )
}

export function NodeDetail({ task, step, steps, write, tier, locked, spent, onSelect, isRoot, onSpent, spentOpen, spentScope, levelMinutes, pace }: { task: Task; step: Subtask; steps: Subtask[]; write: Write; tier: StepTier; locked: boolean; spent?: number; onSelect?: (id: string) => void; isRoot?: boolean; onSpent?: () => void; spentOpen?: boolean; spentScope?: SpentBlocksScope; levelMinutes?: number; pace?: number | null }) {
  const path = pathTo(steps, step.id)
  const { leaves, done } = leafTally(step)
  const state = step.completed ? "done" : locked ? "locked" : "open"
  return (
    <div className="tcs-node" key={step.id}>
      <header className="tcs-node-head">
        <p className="tcs-path" title="Where this step sits">
          {[itemTitleOrUntitled(task), ...path.slice(0, -1).map((s) => s.description)].join(" › ")}
        </p>
        <div className="tcs-name-row">
          <h3 className="tcs-node-name">{step.description}</h3>
          <OpenItemKey onClick={() => openStepItem(task.id, step.id)} />
        </div>
        <label className={`tcs-complete-toggle${step.completed ? " is-done" : ""}`} title={step.completed ? "Completed — click to mark open" : "Click to mark this step complete"}>
          <input
            type="checkbox"
            className="tcs-step-checkbox"
            checked={step.completed}
            aria-label={`Complete ${step.description}`}
            onChange={(e) => write(e.target.checked ? "Done" : "Not done", massDone(steps, new Set([step.id]), e.target.checked))}
          />
          <span className="tcs-complete-label">{step.completed ? "Completed" : "Mark complete"}</span>
        </label>
        <div className="tcs-node-meta">
          <span className={`tcs-lamp is-${state}`}>{state}</span>
          <span className={`tcs-tier is-${tier}`} title={STEP_TIER_LABEL[tier]}>{STEP_TIER_SHORT[tier]}</span>
          <RemainingEstTag
            shown={step.completed ? 0 : openEstimateMinutes(step.estimatedDuration, step.subtasks)}
            field={step.estimatedDuration}
            label={step.description}
            steps={step.subtasks}
            spent={spent ?? 0}
            levelMinutes={levelMinutes}
            pace={pace}
            onSet={(m) => write("Estimate", setEstimate(steps, step.id, m))}
          />
          {spent ? (
            <button type="button" className="tcs-meta-pill" aria-expanded={!!spentOpen} onClick={onSpent}>
              {spent}m spent
            </button>
          ) : null}
          {step.subtasks?.length ? <span className="tcs-meta-pill" title="End nodes done / end nodes">{done}/{leaves} ends</span> : null}
        </div>
      </header>
      {spentOpen && spentScope ? (
        <div className="tcs-spent-quick" aria-label="Spent">
          <SpentDiary scope={spentScope} />
        </div>
      ) : null}
      <EstimatePanel step={step} steps={steps} write={write} />
      <SubstepPreview step={step} steps={steps} write={write} onSelect={onSelect} />
      <PointsLadder task={task} step={step} steps={steps} write={write} />
      <StepPens task={task} step={step} steps={steps} write={write} />
      <section aria-label="Needs" className="tcs-needs tcs-control-card">
        <h3>Needs</h3>
        <NeedsEditor task={task} step={step} steps={steps} write={write} />
        <StepUnlocks step={step} steps={steps} write={write} />
      </section>
      <div className="tcs-openers">
        {isRoot ? null : (
          <button type="button" className="task-card-key tcs-subcard" title="Open a new card with this step as its root: its own tree, totals and detail" onClick={() => openSubCard(task.id, step.id)}>
            ⧉ Open as card
          </button>
        )}
      </div>
    </div>
  )
}

const QUICK_MINUTES = [5, 10, 15, 25, 45, 60, 90]

/** "Oct 20" for a log stamp. */
const stamp = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })

/** The step's estimate: one big figure, quick values, and every value it has had. */
function EstimatePanel({ step, steps, write }: { step: Subtask; steps: Subtask[]; write: Write }) {
  const set = (m: number) => write("Estimate", setEstimate(steps, step.id, m))
  const log = step.estimateLog ?? []
  const parts = partsMinutes(step.subtasks)
  return (
    <section className="tcs-est tcs-control-card" aria-label="Estimate">
      <h3 title="Minutes you think this takes. Every change is kept so you can see how your guesses move.">Estimate</h3>
      <div className="tcs-est-row">
        <EstimateCell className="is-big" minutes={step.estimatedDuration} label={step.description} onSet={set} />
        {parts > 0 ? <span className="tcs-est-parts" title="Sum of the steps inside">= {parts}m in parts</span> : null}
      </div>
      <div className="tcs-quick" role="group" aria-label="Quick estimates">
        {QUICK_MINUTES.map((m) => (
          <button key={m} type="button" aria-pressed={step.estimatedDuration === m} onClick={() => set(m)}>
            {m}
          </button>
        ))}
      </div>
      {log.length > 1 ? (
        <ol className="tcs-hist" aria-label="Estimate history">
          {log.slice(-6).map((e, i, a) => (
            <li key={e.at + i} className={i === a.length - 1 ? "is-now" : undefined} title={new Date(e.at).toLocaleString()}>
              <b>{e.minutes}m</b>
              <time dateTime={e.at}>{stamp(e.at)}</time>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  )
}

/** The first level of steps inside this one, each with its estimate one click away. */
function SubstepPreview({ step, steps, write, onSelect }: { step: Subtask; steps: Subtask[]; write: Write; onSelect?: (id: string) => void }) {
  const kids = step.subtasks ?? []
  if (!kids.length) return null
  const done = kids.filter((k) => k.completed).length
  return (
    <section className="tcs-kids tcs-control-card" aria-label="Steps inside">
      <h3>
        Inside <span className="tcs-total">{done}/{kids.length}</span>
      </h3>
      <ul>
        {kids.map((k) => (
          <li key={k.id} className={k.completed ? "is-done" : undefined}>
            <input
              type="checkbox"
              className="tcs-kid-check"
              checked={k.completed}
              aria-label={`Complete ${k.description}`}
              title={k.completed ? "Completed — click to reopen" : "Mark complete"}
              onChange={(e) => write(e.target.checked ? "Done" : "Not done", massDone(steps, new Set([k.id]), e.target.checked))}
            />
            <button type="button" className="tcs-kid-name" title={`Select ${k.description}`} onClick={() => onSelect?.(k.id)}>
              {k.description}
            </button>
            {k.subtasks?.length ? <small title="Steps inside it">+{k.subtasks.length}</small> : null}
            <EstimateCell minutes={k.estimatedDuration} label={k.description} onSet={(m) => write("Estimate", setEstimate(steps, k.id, m))} />
          </li>
        ))}
      </ul>
    </section>
  )
}

const PEN_HELP = "The clock pen is the one ▶ and Just Start paint with (the first linked pen). Click clock on another pen to switch it. Double-click a pen to open its settings."

/** The task's own pens (steps without their own inherit these). */
export function TaskPens({ task }: { task: Task }) {
  const updateTask = useTaskStore((s) => s.updateTask)
  return (
    <section aria-label="Pen" className="tcs-pens tcs-control-card">
      <h3 title={PEN_HELP}>Pen</h3>
      <ItemPenLinksField
        chain
        penLinks={task.penLinks}
        onChange={(penLinks) => updateTask({ ...task, penLinks })}
        onMakeClock={(penId) => {
          const next = withClockPen(task.penLinks, penId)
          if (next && next !== task.penLinks) updateTask({ ...task, penLinks: next })
        }}
      />
    </section>
  )
}

/** A step's pen: inherited by default; set its own, remove it, or go back to inheriting. */
function StepPens({ task, step, steps, write }: { task: Task; step: Subtask; steps: Subtask[]; write: Write }) {
  const updateTask = useTaskStore((s) => s.updateTask)
  const { links, from, own } = stepPenLinks({ ...task, subtasks: steps }, step.id)
  // What this step would inherit without its own pens: a new pen here counts as that one.
  const parentPen = own ? stepPenLinks({ ...task, subtasks: patchStep(steps, step.id, { penLinks: undefined }) }, step.id).links[0] : undefined
  const set = (label: string, penLinks: Subtask["penLinks"]) => write(label, patchStep(steps, step.id, { penLinks }))
  const makeClock = (penId: string) => {
    const next = withClockPen(links, penId)
    if (!next || next === links) return
    if (own) set("Clock pen", next)
    else if (from) write("Clock pen", patchStep(steps, from.id, { penLinks: next }))
    else updateTask({ ...task, penLinks: next })
  }
  return (
    <section aria-label="Pen" className="tcs-pens tcs-control-card">
      <h3 title={PEN_HELP}>Pen</h3>
      {own ? (
        <>
          <ItemPenLinksField chain penLinks={links} parent={parentPen} onMakeClock={makeClock} onChange={(next) => set("Step pen", next ?? [])} />
          <button type="button" className="tcs-link" title="Drop this step's own pens and use its parent's" onClick={() => set("Inherit pen", undefined)}>
            Inherit
          </button>
        </>
      ) : (
        <>
          <ItemPenLinksField chain penLinks={links} readOnly onMakeClock={makeClock} onChange={() => {}} />
          <p className="is-quiet">
            from {from ? from.description : "the task"} ·{" "}
            <button type="button" className="tcs-link" title="Give this step its own pens, starting from these" onClick={() => set("Step pen", [...links])}>
              change
            </button>{" "}
            ·{" "}
            <button type="button" className="tcs-link" title="This step paints with no pen" onClick={() => set("No pen", [])}>
              none
            </button>
          </p>
        </>
      )}
    </section>
  )
}

function pathTo(steps: readonly Subtask[], id: string, trail: Subtask[] = []): Subtask[] {
  for (const s of steps) {
    if (s.id === id) return [...trail, s]
    const hit = s.subtasks?.length ? pathTo(s.subtasks, id, [...trail, s]) : []
    if (hit.length) return hit
  }
  return []
}

// ── Several steps ────────────────────────────────────────────────────

export function SelectionSummary({ steps, ids, tierOf, isLocked, spentOf }: { steps: Subtask[]; ids: ReadonlySet<string>; tierOf: Map<string, StepTier>; isLocked: (s: Subtask) => boolean; spentOf: (id: string) => number }) {
  const picked = flattenSteps(steps).filter((s) => ids.has(s.id))
  // Count each subtree once: drop steps whose ancestor is also picked.
  const inside = new Set(picked.flatMap((s) => flattenSteps(s.subtasks).map((k) => k.id)))
  const tops = picked.filter((s) => !inside.has(s.id))
  const stats = splitStats(tops, tierOf)
  const mix = STEP_TIERS.map((t) => ({ t, n: picked.filter((s) => tierOf.get(s.id) === t).length }))
  const est = tops.reduce((n, s) => n + effectiveDurationMinutes(s.estimatedDuration, s.subtasks), 0)
  const spent = picked.reduce((n, s) => n + spentOf(s.id), 0)
  const pts = picked.reduce((n, s) => n + (s.tierPoints ? STEP_TIERS.reduce((m, t) => m + (s.tierPoints?.[t] ?? 0), 0) : (s.points ?? 0)), 0)
  const done = picked.filter((s) => s.completed).length
  const locked = picked.filter((s) => !s.completed && isLocked(s)).length
  const needs = picked.reduce((n, s) => n + (s.dependsOn?.length ?? 0) + (s.needsTaskIds?.length ?? 0) + (s.awaitIds?.length ?? 0), 0)
  return (
    <section className="tcs-sum" aria-label="Selection">
      <h3>
        Σ selection <span className="tcs-total">{picked.length}</span>
      </h3>
      <div className="tcs-mix" title="Levels of the selected steps">
        {mix.map(({ t, n }) => (n ? <span key={t} className={`is-${t}`} style={{ flexGrow: n }} title={`${STEP_TIER_LABEL[t]}: ${n}`}>{STEP_TIER_SHORT[t]} {n}</span> : null))}
      </div>
      {stats.leaves ? (
        <div className="tcs-mosaic">
          <Mosaic parts={stats.parts} equal={false} label="by ends" value={stats.raw} />
          <Mosaic parts={stats.parts} equal label="by parts" value={stats.split} />
        </div>
      ) : null}
      <dl className="task-card-dl">
        <dt>Done</dt>
        <dd>
          {done}/{picked.length} steps · {stats.done}/{stats.leaves} ends
        </dd>
        <dt>Completion</dt>
        <dd>
          ρ {formatPercent(stats.raw)} · σ {formatPercent(stats.split)}
        </dd>
        <dt>Estimate</dt>
        <dd>
          {est}m{spent ? ` · ${spent}m spent` : ""}
        </dd>
        <dt>Left</dt>
        <dd>{Math.max(0, est - Math.round(est * (stats.raw ?? 0)))}m by ends</dd>
        <dt>Points</dt>
        <dd>{pts}</dd>
        <dt>Locked</dt>
        <dd className={locked ? "is-over" : undefined}>{locked ? `${locked} waiting` : "none"}</dd>
        <dt>Needs</dt>
        <dd>{needs || "—"}</dd>
        <dt>Spans</dt>
        <dd>{tops.length} branch{tops.length === 1 ? "" : "es"}</dd>
      </dl>
    </section>
  )
}

// ── Notes ────────────────────────────────────────────────────────────

const NOTES_OPEN_KEY = "brain2-task-card-notes-open"
const readOpen = () => {
  try {
    return localStorage.getItem(NOTES_OPEN_KEY) !== "0"
  } catch {
    return true
  }
}

/** "Tue Oct 20" (the year only when it is not this one). */
function noteDate(date: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00`) : new Date(date)
  if (Number.isNaN(d.getTime())) return date
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) })
}

/** A running log of notes. Written on the node in focus (a step, else the task); "All" shows every node's notes. */
export function LogNotes({ task, nodeId, nodeName }: { task: Task; nodeId?: string; nodeName?: (id: string) => string | undefined }) {
  const updateTask = useTaskStore((s) => s.updateTask)
  const [draft, setDraft] = useState("")
  const [open, setOpen] = useState(readOpen)
  const [all, setAll] = useState(false)
  const due = needsNotice(task)
  const log = (task.noteLog ?? []).filter((e) => e.tag === "notice" || e.nodeId)
  const here = log.filter((e) => (e.nodeId ?? undefined) === nodeId)
  const answers = (all ? log : here).slice().reverse()
  const where = nodeId ? (nodeName?.(nodeId) ?? "this step") : "this task"
  // A note written but not logged is kept when the card is left (task-level only).
  const left = useRef(draft)
  left.current = draft
  useEffect(
    () => () => {
      const text = left.current.trim()
      const fresh = useTaskStore.getState().tasks.find((t) => t.id === task.id)
      if (text && fresh && !nodeId) useTaskStore.getState().updateTask(withNoticeAnswer(fresh, text))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [task.id],
  )
  const toggle = () => {
    setOpen(!open)
    try {
      localStorage.setItem(NOTES_OPEN_KEY, open ? "0" : "1")
    } catch {
      /* view state only */
    }
  }
  const add = () => {
    if (!draft.trim()) return
    if (nodeId) {
      const entry = makeNoteEntry(draft)
      if (entry) updateTask({ ...task, noteLog: [...(task.noteLog ?? []), { ...entry, nodeId }] })
    } else updateTask(withNoticeAnswer(task, draft))
    left.current = ""
    setDraft("")
  }
  return (
    <section aria-label="Notes" className={`tcs-notes${open ? " is-open" : ""}`}>
      <button type="button" className="tcs-fold" aria-expanded={open} title={open ? "Fold the notes" : "Open the notes"} onClick={toggle}>
        <span className="tcs-fold-caret" aria-hidden />
        Notes
        {here.length ? <span className="tcs-count">{here.length}</span> : null}
        {due ? <span className="tcs-due" title="Pushed 3+ times. A note here quiets the dot." /> : null}
      </button>
      {open ? (
        <div className="tcs-notes-body">
          <div className="tcs-notes-scope" role="group" aria-label="Which notes">
            <button type="button" aria-pressed={!all} onClick={() => setAll(false)} title={`Only notes written on ${where}`}>
              {nodeId ? "This step" : "This task"}
            </button>
            <button type="button" aria-pressed={all} onClick={() => setAll(true)} title="Every note on the task and its steps">
              All · {log.length}
            </button>
          </div>
          <div className="tcs-compose">
            <textarea
              data-draft=""
              aria-label="Note"
              rows={2}
              placeholder={due && !nodeId ? NOTICE_PROMPT : `A note on ${where}…`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) (e.preventDefault(), add())
              }}
            />
            <button type="button" className="tcs-send" aria-label="Log note" disabled={!draft.trim()} title="Add this note to the log (⌘↩)" onClick={add}>
              Log <kbd>⌘↩</kbd>
            </button>
          </div>
          {answers.length ? (
            <ol className="tcs-timeline">
              {answers.map((a) => (
                <li key={a.id}>
                  <time dateTime={a.date}>
                    {noteDate(a.date)}
                    {all ? <em> · {a.nodeId ? (nodeName?.(a.nodeId) ?? "a step") : "task"}</em> : null}
                  </time>
                  <p>{a.text}</p>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
