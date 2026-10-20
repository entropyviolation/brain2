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
 * searches, and creates when nothing fits. Points are `PointsDial`s: the node's
 * own value and, optionally, what every step inside pays (`stepPoints`).
 */
"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
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
import { noticeAnswers, taskPointsWithSource } from "@/lib/task-card"
import { openStepItem, pushItemLayer } from "@/lib/step-item-stack"
import { Mosaic } from "@/components/steps/TreeMath"
import { ItemPenLinksField } from "@/components/ItemDetail/ItemPenTime"
import { stepPenLinks } from "@/lib/task-clock"
import { runWithoutCompletionPopup } from "@/lib/completion-events"
import { openSubCard, setEstimate } from "@/lib/task-card"
import { partsMinutes } from "@/lib/tracked-time"
import { EstimateCell } from "./EstimateCell"

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
        <input type="number" min={0} inputMode="numeric" aria-label={label} value={value ?? ""} placeholder={fallback != null ? String(fallback) : "—"} onChange={(e) => onChange(toPoints(e.target.value))} />
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
    <section className="tcs-points" aria-label="Points">
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

      <Reveal label="Add need" title="Add something this waits on or uses">
        {(close) => <AddNeed kinds={kinds} pickerFor={pickerFor} close={close} />}
      </Reveal>
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
  const waiters = flat.filter((s) => (s.dependsOn ?? []).includes(step.id))
  const options = flat.filter((s) => s.id !== step.id && !waiters.includes(s) && stepPrereqChoices(steps, s.id).has(step.id)).map((s) => ({ id: s.id, label: s.description }))
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
      {options.length ? (
        <Reveal label="Make a step wait on this" title="Pick a step that waits until this one is done">
          {(close) => <Picker onDone={close} placeholder="Make a step wait on this…" title="Pick a step that waits until this one is done" options={options} onPick={(id) => write("Unlocks", toggleStepPrereq(steps, id, step.id))} />}
        </Reveal>
      ) : null}
    </div>
  )
}

/** Tasks that wait on this task; add or drop them here. */
export function TaskUnlocks({ task }: { task: Task }) {
  const tasks = useTaskStore((s) => s.tasks)
  const updateTask = useTaskStore((s) => s.updateTask)
  const waiters = tasks.filter((t) => (t.dependencies ?? []).includes(task.id))
  const options = tasks.filter((t) => t.id !== task.id && (t.type ?? "task") === "task" && !t.completed && !waiters.includes(t)).map((t) => ({ id: t.id, label: itemTitleOrUntitled(t) }))
  const flip = (t: Task) => updateTask({ ...t, dependencies: toggleId(t.dependencies, task.id) ?? [] })
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
      <Reveal label="Make a task wait on this" title="Pick a task that waits until this one is done">
        {(close) => <Picker onDone={close} placeholder="Make a task wait on this…" title="Pick a task that waits until this one is done" options={options} onPick={(id) => flip(tasks.find((t) => t.id === id)!)} />}
      </Reveal>
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
    <section className="tcs-points" aria-label="Points for this step">
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

export function NodeDetail({ task, step, steps, write, tier, locked, spent, onSelect, isRoot }: { task: Task; step: Subtask; steps: Subtask[]; write: Write; tier: StepTier; locked: boolean; spent?: number; onSelect?: (id: string) => void; isRoot?: boolean }) {
  const path = pathTo(steps, step.id)
  const { leaves, done } = leafTally(step)
  const est = effectiveDurationMinutes(step.estimatedDuration, step.subtasks)
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
        <p className="tcs-node-meta">
          <span className={`tcs-lamp is-${state}`}>{state}</span>
          <span className={`tcs-tier is-${tier}`} title={STEP_TIER_LABEL[tier]}>{STEP_TIER_SHORT[tier]}</span>
          <span>{est ? `${est}m` : "—"} est</span>
          {spent ? <span>{spent}m spent</span> : null}
          {step.subtasks?.length ? <span title="End nodes done / end nodes">{done}/{leaves} ends</span> : null}
        </p>
      </header>
      <EstimatePanel step={step} steps={steps} write={write} />
      <SubstepPreview step={step} steps={steps} write={write} onSelect={onSelect} />
      <PointsLadder task={task} step={step} steps={steps} write={write} />
      <StepPens task={task} step={step} steps={steps} write={write} />
      <section aria-label="Needs" className="tcs-needs">
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
    <section className="tcs-est" aria-label="Estimate">
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
    <section className="tcs-kids" aria-label="Steps inside">
      <h3>
        Inside <span className="tcs-total">{done}/{kids.length}</span>
      </h3>
      <ul>
        {kids.map((k) => (
          <li key={k.id} className={k.completed ? "is-done" : undefined}>
            <i aria-hidden />
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

const PEN_HELP = "The pen the time grid paints with when ▶ or Just Start runs on this, or when it is logged done. Double-click a pen to open its settings."

/** The task's own pens (steps without their own inherit these). */
export function TaskPens({ task }: { task: Task }) {
  const updateTask = useTaskStore((s) => s.updateTask)
  return (
    <section aria-label="Pen" className="tcs-pens">
      <h3 title={PEN_HELP}>Pen</h3>
      <ItemPenLinksField penLinks={task.penLinks} onChange={(penLinks) => updateTask({ ...task, penLinks })} />
    </section>
  )
}

/** A step's pen: inherited by default; set its own, remove it, or go back to inheriting. */
function StepPens({ task, step, steps, write }: { task: Task; step: Subtask; steps: Subtask[]; write: Write }) {
  const { links, from, own } = stepPenLinks({ ...task, subtasks: steps }, step.id)
  // What this step would inherit without its own pens: a new pen here counts as that one.
  const parentPen = own ? stepPenLinks({ ...task, subtasks: patchStep(steps, step.id, { penLinks: undefined }) }, step.id).links[0] : undefined
  const set = (label: string, penLinks: Subtask["penLinks"]) => write(label, patchStep(steps, step.id, { penLinks }))
  return (
    <section aria-label="Pen" className="tcs-pens">
      <h3 title={PEN_HELP}>Pen</h3>
      {own ? (
        <>
          <ItemPenLinksField penLinks={links} parent={parentPen} onChange={(next) => set("Step pen", next ?? [])} />
          <button type="button" className="tcs-link" title="Drop this step's own pens and use its parent's" onClick={() => set("Inherit pen", undefined)}>
            Inherit
          </button>
        </>
      ) : (
        <>
          <ItemPenLinksField penLinks={links} readOnly onChange={() => {}} />
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

/** A running log of notes on the task: fold, write, ⌘↩, newest first. */
export function LogNotes({ task }: { task: Task }) {
  const updateTask = useTaskStore((s) => s.updateTask)
  const [draft, setDraft] = useState("")
  const [open, setOpen] = useState(readOpen)
  const answers = noticeAnswers(task)
  const due = needsNotice(task)
  // A note written but not logged is kept when the card is left.
  const left = useRef(draft)
  left.current = draft
  useEffect(
    () => () => {
      const text = left.current.trim()
      const fresh = useTaskStore.getState().tasks.find((t) => t.id === task.id)
      if (text && fresh) useTaskStore.getState().updateTask(withNoticeAnswer(fresh, text))
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
    updateTask(withNoticeAnswer(task, draft))
    left.current = ""
    setDraft("")
  }
  return (
    <section aria-label="Notes" className={`tcs-notes${open ? " is-open" : ""}`}>
      <button type="button" className="tcs-fold" aria-expanded={open} title={open ? "Fold the notes" : "Open the notes"} onClick={toggle}>
        <span className="tcs-fold-caret" aria-hidden />
        Notes
        {answers.length ? <span className="tcs-count">{answers.length}</span> : null}
        {due ? <span className="tcs-due" title="Pushed 3+ times. A note here quiets the dot." /> : null}
      </button>
      {open ? (
        <div className="tcs-notes-body">
          <div className="tcs-compose">
            <textarea
              data-draft=""
              aria-label="Note"
              rows={2}
              placeholder={due ? NOTICE_PROMPT : "A note on this task…"}
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
                  <time dateTime={a.date}>{noteDate(a.date)}</time>
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
