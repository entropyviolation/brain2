/**
 * lib/session-plan.ts — A time box with three tiers of things to get done
 *
 * Tidy's plan (`lib/house-cleaning.ts` `HousePlan`), rebuilt over To Do tasks
 * and steps. A session is a duration, three tiers (**Bare minimum**, **Goal**,
 * **Exceptional**) of lines pointing at tasks or steps (never copies), and a
 * countdown. Unlike Tidy:
 * - estimates are required on Bare minimum before Start, and a fit gauge
 *   compares each tier's running total with the duration (`sessionFit`);
 * - lines are ordered with prerequisites first and missing ones are named;
 * - one line is current at a time and collects its own active seconds
 *   (Tidy's single running timer), and its next step comes from
 *   `pickStartStep`, the same brain as Just Start;
 * - the tier reached scores with the house completion-tier points;
 * - a running session can be parked and resumed later, keeping its line and
 *   the time it had left (`parkSession`, `resumeParked`), and only one runs at
 *   a time (`admitSession`);
 * - slice H2: a `"timebox"` shape whose Bare minimum is the clock itself
 *   (Just 25), templates, break lines every N minutes, a note to
 *   tomorrow-you (`futureNote`), a Hofstadter mark on the fit gauge, and one
 *   Bare-minimum floor suggestion (`floorSuggestion`).
 *
 * Pure. The store is `lib/session-plan-store.ts`.
 */
import type { Subtask, Task, TimeLogEntry } from "@/lib/types"
import { effectiveDurationMinutes } from "@/lib/todo-steps"
import { stepPercent, taskPercent } from "@/lib/step-progress"
import { findPlacedStep, pickStartStep, placeSteps, type StartPick } from "@/lib/next-step"
import { isStepAvailable } from "@/lib/prereqs"
import { hasUnmetDependencies } from "@/lib/available-tasks"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { HOFSTADTER_PADDING } from "@/lib/todo-commitment"
import { formatLocalDateKey, formatLocalHhmm } from "@/lib/date-utils"

export type SessionTier = "min" | "goal" | "exceptional"

export const SESSION_TIERS: { id: SessionTier; label: string }[] = [
  { id: "min", label: "Bare minimum" },
  { id: "goal", label: "Goal" },
  { id: "exceptional", label: "Exceptional" },
]

export const SESSION_DURATION_PRESETS = [30, 60, 120, 180] as const
/** Lengths offered for a timebox (Just 25). */
export const TIMEBOX_DURATION_PRESETS = [10, 25, 50] as const
/** Break-line spacing offered in the draft (minutes). */
export const BREAK_EVERY_PRESETS = [25, 50, 90] as const
export const DEFAULT_BREAK_MIN = 5

/** `lines` (default): tiers of lines. `timebox`: the clock is the commitment, lines optional. */
export type SessionShape = "lines" | "timebox"

/** One optional line left for the next sitting, with when it was written. */
export interface FutureNote {
  text: string
  at: string
}

export interface SessionLine {
  id: string
  taskId: string
  /** A step of that task; omitted = the whole task. */
  stepId?: string
  /** Minutes the line was expected to take, frozen at Start. */
  estMin?: number
  /** Active seconds while this line was current. */
  actualSec?: number
  /** A step inside the line picked with ▶ (2026-10-22). Omitted = Just Start's pick. */
  focusStepId?: string
  /** Active seconds per step inside the line, while it was the focus step. */
  stepSec?: Record<string, number>
  /** ISO, when the line was finished in this session. */
  doneAt?: string
  /** What the review decided for an unfinished line. */
  outcome?: "keep" | "push" | "leave"
}

export interface SessionClock {
  running: boolean
  /** ISO of the last resume. */
  startedAt?: string
  /** Seconds left at `startedAt` (or now, when paused). */
  baseSec: number
}

/** `parked`: put down mid-run, clock stopped, line remembered (slice H). */
export type SessionPhase = "draft" | "run" | "parked" | "review" | "done"

export interface SessionPlan {
  id: string
  title: string
  durationMin: number
  tiers: Record<SessionTier, SessionLine[]>
  phase: SessionPhase
  clock: SessionClock | null
  createdAt: string
  startedAt?: string
  endedAt?: string
  /** The line collecting time now, and since when (ISO). */
  activeLineId?: string
  activeSince?: string
  reachedTier?: SessionTier | "none"
  points?: number
  note?: string
  /** Put the current line on the Tracking pen clock while the session runs. */
  paint?: boolean
  /** ISO, when the session was parked. */
  parkedAt?: string
  /** Absent = `"lines"`. */
  shape?: SessionShape
  /** Note to tomorrow-you, asked at Park and at End (FN-1). */
  futureNote?: FutureNote
  /** A break line every N minutes of clock; absent = none. */
  breakEvery?: number
  /** Minutes per break (default 5). */
  breakMin?: number
  /** Breaks taken or skipped so far. */
  breaksTaken?: number
}

export function isTimebox(plan: Pick<SessionPlan, "shape">): boolean {
  return plan.shape === "timebox"
}

/** Set or clear the note to tomorrow-you. Blank clears it. */
export function withFutureNote(plan: SessionPlan, text: string | undefined, now = new Date()): SessionPlan {
  const trimmed = text?.trim()
  if (!trimmed) {
    const { futureNote: _drop, ...rest } = plan
    return rest
  }
  if (plan.futureNote?.text === trimmed) return plan
  return { ...plan, futureNote: { text: trimmed, at: now.toISOString() } }
}

function rid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function emptySession(now = new Date(), durationMin = 180): SessionPlan {
  return {
    id: rid("ses"),
    title: "Session",
    durationMin,
    tiers: { min: [], goal: [], exceptional: [] },
    phase: "draft",
    clock: null,
    createdAt: now.toISOString(),
  }
}

export function allLines(plan: SessionPlan): { line: SessionLine; tier: SessionTier }[] {
  return SESSION_TIERS.flatMap(({ id }) => plan.tiers[id].map((line) => ({ line, tier: id })))
}

function withTiers(plan: SessionPlan, tiers: Record<SessionTier, SessionLine[]>): SessionPlan {
  return { ...plan, tiers }
}

function mapLines(plan: SessionPlan, visit: (line: SessionLine) => SessionLine | null): SessionPlan {
  const tiers = { ...plan.tiers }
  for (const { id } of SESSION_TIERS) {
    tiers[id] = plan.tiers[id].map(visit).filter((l): l is SessionLine => !!l)
  }
  return withTiers(plan, tiers)
}

// ---- What a line points at -------------------------------------------------

export interface LineTarget {
  task?: Task
  step?: Subtask
  /** Ancestors of the step, outermost first. */
  path: Subtask[]
}

export function lineTarget(line: Pick<SessionLine, "taskId" | "stepId">, tasks: readonly Task[]): LineTarget {
  const task = tasks.find((t) => t.id === line.taskId)
  if (!task || !line.stepId) return { task, path: [] }
  const placed = findPlacedStep(task.subtasks, line.stepId)
  return { task, step: placed?.step, path: placed?.path ?? [] }
}

export function lineLabel(line: Pick<SessionLine, "taskId" | "stepId">, tasks: readonly Task[]): string {
  const { task, step, path } = lineTarget(line, tasks)
  const head = itemTitleOrUntitled(task)
  return step ? [head, ...path.map((s) => s.description), step.description].join(" › ") : head
}

/** Minutes of open work under a node: a done node is 0, a leaf its own estimate, a parent its open children (or its own estimate when none of them have one). */
function openMinutes(own: number | undefined, children: readonly Subtask[] | undefined, completed: boolean): number {
  if (completed) return 0
  const kids = children ?? []
  if (kids.length === 0) return own && own > 0 ? own : 0
  const sum = kids.reduce((total, kid) => total + openMinutes(kid.estimatedDuration, kid.subtasks, kid.completed), 0)
  if (sum > 0) return sum
  return effectiveDurationMinutes(own, undefined)
}

/** Minutes the line still needs, from the live task. */
export function lineMinutes(line: Pick<SessionLine, "taskId" | "stepId">, tasks: readonly Task[]): number {
  const { task, step } = lineTarget(line, tasks)
  if (!task) return 0
  if (step) return openMinutes(step.estimatedDuration, step.subtasks, step.completed)
  return openMinutes(task.estimatedDuration, task.subtasks, !!task.completed)
}

/** Open lowest-level pieces of the line with no estimate (the line itself when it is a bare leaf). */
export function lineUnestimated(line: Pick<SessionLine, "taskId" | "stepId">, tasks: readonly Task[]): number {
  const { task, step } = lineTarget(line, tasks)
  if (!task) return 0
  const kids = step ? step.subtasks : task.subtasks
  const done = step ? step.completed : !!task.completed
  if (done) return 0
  if (!kids?.length) {
    const own = step ? step.estimatedDuration : task.estimatedDuration
    return own && own > 0 ? 0 : 1
  }
  return placeSteps(kids).filter(
    (p) => !p.step.completed && !(p.step.subtasks?.length) && !(p.step.estimatedDuration && p.step.estimatedDuration > 0),
  ).length
}

export function lineIsDone(line: SessionLine, tasks: readonly Task[]): boolean {
  if (line.doneAt) return true
  const { task, step } = lineTarget(line, tasks)
  if (!task) return false
  return step ? step.completed : !!task.completed
}

/** Waiting on something outside: the step's prerequisites, or the task's. */
export function lineIsBlocked(line: SessionLine, tasks: readonly Task[]): boolean {
  const { task, step } = lineTarget(line, tasks)
  if (!task) return false
  if (hasUnmetDependencies(task, tasks)) return true
  return step ? !isStepAvailable(task.subtasks, step.id) : false
}

// ---- Draft --------------------------------------------------------------------

/**
 * Add a task or step to a tier. Already there: it moves to this tier. Like
 * Tidy, adding a parent drops its descendants, and adding something whose
 * ancestor (or whole task) is already in the session is refused.
 */
export function addLine(
  plan: SessionPlan,
  tier: SessionTier,
  ref: { taskId: string; stepId?: string },
  tasks: readonly Task[],
): SessionPlan {
  const lines = allLines(plan)
  const same = lines.find(({ line }) => line.taskId === ref.taskId && line.stepId === ref.stepId)
  if (same) return moveLine(plan, same.line.id, tier)

  const task = tasks.find((t) => t.id === ref.taskId)
  const ancestors = new Set(ref.stepId ? (findPlacedStep(task?.subtasks, ref.stepId)?.path ?? []).map((s) => s.id) : [])
  const covered = lines.some(
    ({ line }) => line.taskId === ref.taskId && (!line.stepId || (line.stepId && ancestors.has(line.stepId))),
  )
  if (covered && ref.stepId) return plan
  if (covered && !ref.stepId) return plan

  const inside = new Set(
    ref.stepId
      ? placeSteps(findPlacedStep(task?.subtasks, ref.stepId)?.step.subtasks).map((p) => p.step.id)
      : placeSteps(task?.subtasks).map((p) => p.step.id),
  )
  const pruned = mapLines(plan, (line) => (line.taskId === ref.taskId && line.stepId && inside.has(line.stepId) ? null : line))
  const line: SessionLine = { id: rid("sl"), taskId: ref.taskId, ...(ref.stepId ? { stepId: ref.stepId } : {}) }
  return withTiers(pruned, { ...pruned.tiers, [tier]: [...pruned.tiers[tier], line] })
}

export function removeLine(plan: SessionPlan, lineId: string): SessionPlan {
  return mapLines(plan, (line) => (line.id === lineId ? null : line))
}

/** Move a line to a tier, at `index` (end by default). */
export function moveLine(plan: SessionPlan, lineId: string, tier: SessionTier, index?: number): SessionPlan {
  const hit = allLines(plan).find(({ line }) => line.id === lineId)
  if (!hit) return plan
  const without = removeLine(plan, lineId)
  const list = [...without.tiers[tier]]
  const at = index == null ? list.length : Math.max(0, Math.min(list.length, index))
  list.splice(at, 0, hit.line)
  return withTiers(without, { ...without.tiers, [tier]: list })
}

/** Nudge a line up or down inside its tier. */
export function nudgeLine(plan: SessionPlan, lineId: string, delta: -1 | 1): SessionPlan {
  const hit = allLines(plan).find(({ line }) => line.id === lineId)
  if (!hit) return plan
  const at = plan.tiers[hit.tier].findIndex((l) => l.id === lineId)
  return moveLine(plan, lineId, hit.tier, at + delta)
}

/** Does `a` need `b` first? Step prerequisites within one task, task prerequisites across tasks. */
function lineNeeds(a: SessionLine, b: SessionLine, tasks: readonly Task[]): boolean {
  const ta = tasks.find((t) => t.id === a.taskId)
  if (!ta) return false
  if (a.taskId !== b.taskId) return (ta.dependencies ?? []).includes(b.taskId)
  if (!a.stepId || !b.stepId) return false
  const placed = findPlacedStep(ta.subtasks, a.stepId)
  if (!placed) return false
  const needs = new Set([...placed.path, placed.step].flatMap((s) => s.dependsOn ?? []))
  if (needs.has(b.stepId)) return true
  // b, or something inside b, is what a waits on.
  const inside = placeSteps(findPlacedStep(ta.subtasks, b.stepId)?.step.subtasks).map((p) => p.step.id)
  return inside.some((id) => needs.has(id))
}

/**
 * Put prerequisites first, across the whole session: a line never sits before
 * a line it needs. A needed line in a later tier moves up into the tier that
 * needs it. Order is otherwise kept (stable).
 */
export function orderByPrereqs(plan: SessionPlan, tasks: readonly Task[]): SessionPlan {
  const flat = allLines(plan)
  const tierRank: Record<SessionTier, number> = { min: 0, goal: 1, exceptional: 2 }
  const tierOf = new Map(flat.map(({ line, tier }) => [line.id, tier]))
  // Pull needed lines into the earliest tier that needs them.
  let changed = true
  while (changed) {
    changed = false
    for (const a of flat) {
      for (const b of flat) {
        if (a === b || !lineNeeds(a.line, b.line, tasks)) continue
        const ta = tierOf.get(a.line.id)!
        const tb = tierOf.get(b.line.id)!
        if (tierRank[tb] > tierRank[ta]) {
          tierOf.set(b.line.id, ta)
          changed = true
        }
      }
    }
  }
  const tiers: Record<SessionTier, SessionLine[]> = { min: [], goal: [], exceptional: [] }
  for (const { id } of SESSION_TIERS) {
    const group = flat.filter(({ line }) => tierOf.get(line.id) === id).map(({ line }) => line)
    // Stable topological order inside the tier.
    const placed: SessionLine[] = []
    const pending = [...group]
    let guard = 0
    while (pending.length && guard++ < 1000) {
      const i = pending.findIndex((a) => !pending.some((b) => b !== a && lineNeeds(a, b, tasks)))
      placed.push(...pending.splice(i < 0 ? 0 : i, 1))
    }
    tiers[id] = placed
  }
  return withTiers(plan, tiers)
}

/** Open prerequisites of the session's lines that are not in the session. */
export interface MissingPrereq {
  lineId: string
  needs: string
  /** What **Add *X*** puts in the session. */
  ref: { taskId: string; stepId?: string }
}

export function missingPrereqs(plan: SessionPlan, tasks: readonly Task[]): MissingPrereq[] {
  const lines = allLines(plan).map(({ line }) => line)
  const out: MissingPrereq[] = []
  for (const line of lines) {
    const task = tasks.find((t) => t.id === line.taskId)
    if (!task) continue
    for (const depId of task.dependencies ?? []) {
      const dep = tasks.find((t) => t.id === depId)
      if (!dep || dep.completed) continue
      if (!lines.some((l) => l.taskId === depId)) out.push({ lineId: line.id, needs: itemTitleOrUntitled(dep), ref: { taskId: depId } })
    }
    if (line.stepId) {
      const placed = findPlacedStep(task.subtasks, line.stepId)
      for (const depId of new Set([...(placed?.path ?? []), ...(placed ? [placed.step] : [])].flatMap((s) => s.dependsOn ?? []))) {
        const dep = findPlacedStep(task.subtasks, depId)?.step
        if (!dep || dep.completed) continue
        const inSession = lines.some((l) => {
          if (l.taskId !== task.id) return false
          if (!l.stepId || l.stepId === depId) return true
          return placeSteps(findPlacedStep(task.subtasks, l.stepId)?.step.subtasks).some((p) => p.step.id === depId)
        })
        if (!inSession) out.push({ lineId: line.id, needs: dep.description, ref: { taskId: task.id, stepId: depId } })
      }
    }
  }
  return out
}

/**
 * **Add *X*** on a locked line (Phase 14 A): put the prerequisite in the same
 * tier, just above the line that needs it. Unchanged when `addLine` refuses.
 */
export function addPrereqAbove(
  plan: SessionPlan,
  lineId: string,
  ref: { taskId: string; stepId?: string },
  tasks: readonly Task[],
): SessionPlan {
  const hit = allLines(plan).find(({ line }) => line.id === lineId)
  if (!hit) return plan
  const added = addLine(plan, hit.tier, ref, tasks)
  const fresh = allLines(added).find(({ line }) => line.taskId === ref.taskId && line.stepId === ref.stepId)
  if (!fresh) return plan
  const at = added.tiers[hit.tier].findIndex((l) => l.id === lineId)
  return moveLine(added, fresh.line.id, hit.tier, at < 0 ? undefined : at)
}

/** A line's percent over its parts (`lib/step-progress.ts`), or `null` when it has none. */
export function linePercent(line: Pick<SessionLine, "taskId" | "stepId">, tasks: readonly Task[]): number | null {
  const task = tasks.find((t) => t.id === line.taskId)
  if (!task) return null
  if (!line.stepId) return taskPercent(task, !!task.completed)
  const step = findPlacedStep(task.subtasks, line.stepId)?.step
  return step?.subtasks?.length ? stepPercent(step) : null
}

// ---- Fit --------------------------------------------------------------------

export type FitBand = "fits" | "tight" | "over"

export interface TierFit {
  tier: SessionTier
  /** This tier's minutes alone. */
  minutes: number
  /** This tier plus every tier before it. */
  cumulative: number
  /** Open lowest-level pieces in the tier with no estimate. */
  unestimated: number
  band: FitBand
  /** Cumulative × pace ÷ the time left after breaks. */
  ratio: number
  /** The same with Hofstadter's ×2 on top: where the load strip's needle would sit. */
  padded: number
}

/** Minutes of break lines inside the session (one every `breakEvery`, none at the very end). */
export function breakMinutes(plan: Pick<SessionPlan, "durationMin" | "breakEvery" | "breakMin">): number {
  if (!plan.breakEvery || plan.breakEvery <= 0 || plan.durationMin <= 0) return 0
  const count = Math.max(0, Math.ceil(plan.durationMin / plan.breakEvery) - 1)
  return count * (plan.breakMin ?? DEFAULT_BREAK_MIN)
}

/**
 * How the tiers fit the duration. `pace` is the person's usual actual ÷
 * estimate (from `sessionPace`), so a fit reads as it will really go. At or
 * under 0.85 of the time fits, up to 1 is tight, past 1 is over.
 */
export function sessionFit(plan: SessionPlan, tasks: readonly Task[], pace = 1): TierFit[] {
  let running = 0
  const room = Math.max(0, plan.durationMin - breakMinutes(plan))
  return SESSION_TIERS.map(({ id }) => {
    const lines = plan.tiers[id]
    const minutes = lines.reduce((total, line) => total + lineMinutes(line, tasks), 0)
    running += minutes
    const ratio = room > 0 ? (running * pace) / room : running > 0 ? Infinity : 0
    return {
      tier: id,
      minutes,
      cumulative: running,
      unestimated: lines.reduce((total, line) => total + lineUnestimated(line, tasks), 0),
      band: ratio <= 0.85 ? "fits" : ratio <= 1 ? "tight" : "over",
      ratio,
      padded: ratio * HOFSTADTER_PADDING,
    }
  })
}

/**
 * Median actual ÷ estimate over finished lines of past sessions (lines with
 * both numbers). 1 with too little history. Clamped to 0.5–4.
 */
export function sessionPace(history: readonly SessionPlan[]): number {
  const ratios: number[] = []
  for (const plan of history) {
    for (const { line } of allLines(plan)) {
      if (line.doneAt && line.estMin && line.estMin > 0 && line.actualSec && line.actualSec > 0) {
        ratios.push(line.actualSec / 60 / line.estMin)
      }
    }
  }
  if (ratios.length < 3) return 1
  ratios.sort((a, b) => a - b)
  const mid = Math.floor(ratios.length / 2)
  const median = ratios.length % 2 ? ratios[mid] : (ratios[mid - 1] + ratios[mid]) / 2
  return Math.min(4, Math.max(0.5, median))
}

/** Why Start is not allowed yet, or null when it is. */
export function cannotStartReason(plan: SessionPlan, tasks: readonly Task[]): string | null {
  if (plan.durationMin <= 0) return "Set how long the session is."
  // A timebox is the clock: lines are optional, and any estimate gap is fine.
  if (isTimebox(plan)) return null
  const min = plan.tiers.min.filter((line) => !lineIsDone(line, tasks))
  if (min.length === 0) return "Put at least one thing in Bare minimum."
  const bare = min.filter((line) => lineMinutes(line, tasks) === 0)
  if (bare.length) {
    return bare.length === 1
      ? `Estimate “${lineLabel(bare[0], tasks)}” first.`
      : `Estimate the ${bare.length} Bare minimum lines without minutes first.`
  }
  return null
}

// ---- Run ----------------------------------------------------------------------

function activeSeconds(plan: SessionPlan, now: Date): number {
  if (!plan.activeSince || !plan.clock?.running) return 0
  return Math.max(0, Math.round((now.getTime() - new Date(plan.activeSince).getTime()) / 1000))
}

/** Fold the current line's running seconds into it. */
function commitActive(plan: SessionPlan, now: Date): SessionPlan {
  if (!plan.activeLineId) return plan
  const add = activeSeconds(plan, now)
  const next = add
    ? mapLines(plan, (line) =>
        line.id !== plan.activeLineId
          ? line
          : {
              ...line,
              actualSec: (line.actualSec ?? 0) + add,
              ...(line.focusStepId ? { stepSec: { ...line.stepSec, [line.focusStepId]: (line.stepSec?.[line.focusStepId] ?? 0) + add } } : {}),
            },
      )
    : plan
  return { ...next, activeSince: plan.clock?.running ? now.toISOString() : undefined }
}

export function startSession(plan: SessionPlan, tasks: readonly Task[], now = new Date()): SessionPlan {
  const frozen = mapLines(orderByPrereqs(plan, tasks), (line) => ({ ...line, estMin: lineMinutes(line, tasks) || undefined }))
  const started: SessionPlan = {
    ...frozen,
    phase: "run",
    startedAt: now.toISOString(),
    clock: { running: true, startedAt: now.toISOString(), baseSec: Math.round(plan.durationMin * 60) },
  }
  const current = nextLine(started, tasks)
  return current ? { ...started, activeLineId: current.id, activeSince: now.toISOString() } : started
}

export function remainingSec(plan: SessionPlan, now = new Date()): number {
  const clock = plan.clock
  if (!clock) return Math.round(plan.durationMin * 60)
  if (!clock.running || !clock.startedAt) return clock.baseSec
  return clock.baseSec - Math.round((now.getTime() - new Date(clock.startedAt).getTime()) / 1000)
}

export function pauseSession(plan: SessionPlan, now = new Date()): SessionPlan {
  if (!plan.clock?.running) return plan
  const committed = commitActive(plan, now)
  return { ...committed, activeSince: undefined, clock: { running: false, baseSec: remainingSec(plan, now) } }
}

export function resumeSession(plan: SessionPlan, now = new Date()): SessionPlan {
  if (!plan.clock || plan.clock.running) return plan
  return {
    ...plan,
    clock: { running: true, startedAt: now.toISOString(), baseSec: plan.clock.baseSec },
    activeSince: plan.activeLineId ? now.toISOString() : undefined,
  }
}

// ---- Park and resume (slice H) ----------------------------------------------

/** A parked session older than this asks Resume as was / Fresh clock. */
export const PARK_STALE_MS = 24 * 60 * 60 * 1000

/** Put a running session down: the clock stops, the current line is remembered. */
export function parkSession(plan: SessionPlan, now = new Date(), futureNote?: string): SessionPlan {
  if (plan.phase !== "run") return plan
  const paused = pauseSession(plan, now)
  const parked: SessionPlan = { ...paused, phase: "parked", parkedAt: now.toISOString(), activeSince: undefined }
  return futureNote === undefined ? parked : withFutureNote(parked, futureNote, now)
}

/** Parked more than a day: resume asks whether to keep the clock. */
export function parkedLong(plan: SessionPlan, now = new Date()): boolean {
  return plan.phase === "parked" && !!plan.parkedAt && now.getTime() - new Date(plan.parkedAt).getTime() > PARK_STALE_MS
}

/**
 * Take a parked session up again. `as-was` keeps the seconds left; `fresh`
 * restarts the whole duration on the same lines. The time away is never
 * counted. The remembered line is current again, unless it was finished
 * meanwhile; then the next open line is.
 */
export function resumeParked(
  plan: SessionPlan,
  tasks: readonly Task[],
  now = new Date(),
  mode: "as-was" | "fresh" = "as-was",
): SessionPlan {
  if (plan.phase !== "parked") return plan
  const baseSec = mode === "fresh" ? Math.round(plan.durationMin * 60) : (plan.clock?.baseSec ?? Math.round(plan.durationMin * 60))
  const remembered = allLines(plan).find(({ line }) => line.id === plan.activeLineId)?.line
  const lineId = remembered && !lineIsDone(remembered, tasks) ? remembered.id : nextLine(plan, tasks)?.id
  const { parkedAt: _parkedAt, ...rest } = plan
  return {
    ...rest,
    phase: "run",
    ...(mode === "fresh" ? { startedAt: now.toISOString() } : {}),
    clock: { running: true, startedAt: now.toISOString(), baseSec },
    activeLineId: lineId,
    activeSince: lineId ? now.toISOString() : undefined,
  }
}

/** Running or in review: the one session that holds the clock. */
export function isLiveSession(plan: SessionPlan): boolean {
  return plan.phase === "run" || plan.phase === "review"
}

/**
 * Put `plan` into the open list (replacing it by id). When it is live, every
 * other live session is parked first, so two never run at once. A session in
 * review that gets bumped goes back to parked with its clock as it was.
 */
export function admitSession(
  open: readonly SessionPlan[],
  plan: SessionPlan,
  now = new Date(),
): { open: SessionPlan[]; parked: SessionPlan[] } {
  const parked: SessionPlan[] = []
  const others = open
    .filter((p) => p.id !== plan.id)
    .map((p) => {
      if (!isLiveSession(plan) || !isLiveSession(p)) return p
      const put: SessionPlan =
        p.phase === "run"
          ? parkSession(p, now)
          : { ...p, phase: "parked", parkedAt: now.toISOString(), endedAt: undefined, reachedTier: undefined }
      parked.push(put)
      return put
    })
  const at = open.findIndex((p) => p.id === plan.id)
  const next = [...others]
  next.splice(at < 0 ? next.length : at, 0, plan)
  return { open: next, parked }
}

/** A done session as a fresh draft: same lines and tiers, new ids, no clock. */
export function runAgain(plan: SessionPlan, now = new Date()): SessionPlan {
  const base = emptySession(now, plan.durationMin)
  const tiers = { ...base.tiers }
  for (const { id } of SESSION_TIERS) {
    tiers[id] = plan.tiers[id].map((line) => ({ id: rid("sl"), taskId: line.taskId, ...(line.stepId ? { stepId: line.stepId } : {}) }))
  }
  return {
    ...base,
    title: plan.title,
    tiers,
    ...(plan.paint ? { paint: true } : {}),
    ...(plan.shape ? { shape: plan.shape } : {}),
    ...(plan.breakEvery ? { breakEvery: plan.breakEvery, ...(plan.breakMin ? { breakMin: plan.breakMin } : {}) } : {}),
    // Carried over with its own date, so the draft can say when it was written.
    ...(plan.futureNote ? { futureNote: plan.futureNote } : {}),
  }
}

/** Add minutes to the time box (+15 by default). */
export function extendSession(plan: SessionPlan, minutes = 15, now = new Date()): SessionPlan {
  if (!plan.clock) return { ...plan, durationMin: plan.durationMin + minutes }
  const left = remainingSec(plan, now)
  return {
    ...plan,
    durationMin: plan.durationMin + minutes,
    clock: plan.clock.running
      ? { running: true, startedAt: now.toISOString(), baseSec: left + minutes * 60 }
      : { running: false, baseSec: left + minutes * 60 },
  }
}

/** The first open, unblocked line in tier order (Bare minimum first); else the first open one. */
export function nextLine(plan: SessionPlan, tasks: readonly Task[], skip: readonly string[] = []): SessionLine | undefined {
  const open = allLines(plan)
    .map(({ line }) => line)
    .filter((line) => !lineIsDone(line, tasks))
  const ready = open.filter((line) => !lineIsBlocked(line, tasks))
  return ready.find((line) => !skip.includes(line.id)) ?? ready[0] ?? open[0]
}

/** Lines you could switch to now: open, not waiting on anything, not in `exclude`. */
export function pickableLines(plan: SessionPlan, tasks: readonly Task[], exclude: readonly string[] = []): SessionLine[] {
  return allLines(plan)
    .map(({ line }) => line)
    .filter((line) => !exclude.includes(line.id) && !lineIsDone(line, tasks) && !lineIsBlocked(line, tasks))
}

/** Minutes a line still asks for: its open estimate now, else the one frozen at Start. 0 = unestimated. */
function lineMinutesLeft(line: SessionLine, tasks: readonly Task[]): number {
  return lineMinutes(line, tasks) || line.estMin || 0
}

/**
 * "Next shortest task" (2026-10-22): the pickable line with the fewest minutes
 * left. Unestimated lines come last; ties keep tier order.
 */
export function shortestLine(plan: SessionPlan, tasks: readonly Task[], exclude: readonly string[] = []): SessionLine | undefined {
  const rank = (line: SessionLine) => lineMinutesLeft(line, tasks) || Number.POSITIVE_INFINITY
  return pickableLines(plan, tasks, exclude).reduce<SessionLine | undefined>((best, line) => (!best || rank(line) < rank(best) ? line : best), undefined)
}

/** "Random task" (2026-10-22): any pickable line. `rand` returns [0, 1). */
export function randomLine(
  plan: SessionPlan,
  tasks: readonly Task[],
  exclude: readonly string[] = [],
  rand: () => number = Math.random,
): SessionLine | undefined {
  const lines = pickableLines(plan, tasks, exclude)
  return lines.length ? lines[Math.min(lines.length - 1, Math.floor(rand() * lines.length))] : undefined
}

/** Press ▶ on a line: it becomes current and the clock runs. */
export function playLine(plan: SessionPlan, lineId: string, now = new Date()): SessionPlan {
  return resumeSession(focusLine(plan, lineId, now), now)
}

/** Point a line at one of its steps (`undefined` = Just Start's pick) and make it current. The clock is left as it is. */
export function focusLineStep(plan: SessionPlan, lineId: string, stepId: string | undefined, now = new Date()): SessionPlan {
  const committed = commitActive(plan, now)
  return focusLine(
    mapLines(committed, (line) => (line.id === lineId ? { ...line, focusStepId: stepId } : line)),
    lineId,
    now,
  )
}

/** Press ▶ on a step inside a line: that step is what you are on, and the clock runs. */
export function playStep(plan: SessionPlan, lineId: string, stepId: string, now = new Date()): SessionPlan {
  return resumeSession(focusLineStep(plan, lineId, stepId, now), now)
}

/** Seconds spent on one step inside a line in this session (live for the focus step). */
export function stepSeconds(plan: SessionPlan, line: SessionLine, stepId: string, now = new Date()): number {
  const live = plan.activeLineId === line.id && line.focusStepId === stepId ? activeSeconds(plan, now) : 0
  return (line.stepSec?.[stepId] ?? 0) + live
}

/** Change a line's estimate for this session (minutes; 0 clears it). */
export function setLineEstimate(plan: SessionPlan, lineId: string, minutes: number): SessionPlan {
  const m = Math.max(0, Math.round(minutes))
  return mapLines(plan, (line) => (line.id === lineId ? { ...line, estMin: m || undefined } : line))
}

/** Press ■ on the current line: its time is kept, nothing is current, the session clock keeps going. */
export function stopLine(plan: SessionPlan, now = new Date()): SessionPlan {
  return focusLine(plan, undefined, now)
}

/** Make a line current (committing the time of the one before). */
export function focusLine(plan: SessionPlan, lineId: string | undefined, now = new Date()): SessionPlan {
  const committed = commitActive(plan, now)
  return {
    ...committed,
    activeLineId: lineId,
    activeSince: lineId && plan.clock?.running ? now.toISOString() : undefined,
  }
}

/**
 * Mark a line finished in this session. Finishing the current line moves on
 * to the next; ticking another line leaves what you are on alone.
 */
export function finishLine(plan: SessionPlan, lineId: string, tasks: readonly Task[], now = new Date()): SessionPlan {
  const committed = commitActive(plan, now)
  const done = mapLines(committed, (line) => (line.id === lineId ? { ...line, doneAt: line.doneAt ?? now.toISOString() } : line))
  if (plan.activeLineId !== lineId) return done
  const next = nextLine(done, tasks)
  return focusLine({ ...done, activeLineId: undefined, activeSince: undefined }, next?.id, now)
}

/**
 * The step to do now for a line: the line's own step when it is a leaf, else
 * Just Start's pick inside it (lowest-level, ready, smallest estimate).
 */
export function lineFocusStep(line: SessionLine, tasks: readonly Task[]): StartPick | null {
  const { task, step } = lineTarget(line, tasks)
  if (!task) return null
  if (line.focusStepId) {
    const picked = findPlacedStep(step ? step.subtasks : task.subtasks, line.focusStepId)
    if (picked && !picked.step.completed && !picked.step.subtasks?.some((s) => !s.completed)) {
      return { kind: "step", step: picked.step, path: picked.path, minutes: picked.step.estimatedDuration ?? 0, ready: 1 }
    }
  }
  if (step && !(step.subtasks?.length)) {
    return step.completed
      ? { kind: "all-done" }
      : { kind: "step", step, path: lineTarget(line, tasks).path, minutes: step.estimatedDuration ?? 0, ready: 1 }
  }
  if (step) return pickStartStep({ subtasks: step.subtasks })
  return pickStartStep(task, { allTasks: tasks })
}

/** Seconds on a line, including the running stretch. */
export function lineSeconds(plan: SessionPlan, line: SessionLine, now = new Date()): number {
  return (line.actualSec ?? 0) + (plan.activeLineId === line.id ? activeSeconds(plan, now) : 0)
}

/** The highest tier whose lines (and every lower tier's) are all done. */
export function tierReached(plan: SessionPlan, tasks: readonly Task[], now = new Date()): SessionTier | "none" {
  if (isTimebox(plan)) return timeboxReached(plan, tasks, now)
  let reached: SessionTier | "none" = "none"
  for (const { id } of SESSION_TIERS) {
    const lines = plan.tiers[id]
    if (lines.length === 0) {
      if (reached === "none" && id === "min") return "none"
      continue
    }
    if (lines.every((line) => lineIsDone(line, tasks))) reached = id
    else break
  }
  return reached
}

/**
 * A timebox's Bare minimum is time given: the clock ran out with you on it,
 * whatever got done ("showed up"). Goal and Exceptional are still lines:
 * every Bare-minimum and Goal line done reaches Goal, then Exceptional's.
 */
function timeboxReached(plan: SessionPlan, tasks: readonly Task[], now: Date): SessionTier | "none" {
  if (!plan.clock || remainingSec(plan, now) > 0) return "none"
  const goal = [...plan.tiers.min, ...plan.tiers.goal]
  if (goal.length === 0 || !goal.every((line) => lineIsDone(line, tasks))) return "min"
  const exc = plan.tiers.exceptional
  return exc.length && exc.every((line) => lineIsDone(line, tasks)) ? "exceptional" : "goal"
}

export interface TierPoints {
  bareMin: number
  goal: number
  exceptional: number
}

export function sessionPoints(reached: SessionTier | "none", amounts: TierPoints): number {
  if (reached === "exceptional") return amounts.exceptional
  if (reached === "goal") return amounts.goal
  if (reached === "min") return amounts.bareMin
  return 0
}

/** Stop the clock and open the review. */
export function endSession(plan: SessionPlan, tasks: readonly Task[], now = new Date()): SessionPlan {
  const committed = commitActive(plan, now)
  return {
    ...committed,
    phase: "review",
    endedAt: now.toISOString(),
    activeLineId: undefined,
    activeSince: undefined,
    clock: committed.clock ? { running: false, baseSec: remainingSec(plan, now) } : null,
    reachedTier: tierReached(committed, tasks, now),
  }
}

export function setLineOutcome(plan: SessionPlan, lineId: string, outcome: SessionLine["outcome"]): SessionPlan {
  return mapLines(plan, (line) => (line.id === lineId ? { ...line, outcome } : line))
}

/** Close the review: the session is history. */
export function closeSession(
  plan: SessionPlan,
  tasks: readonly Task[],
  amounts: TierPoints,
  note?: string,
  futureNote?: string,
  now = new Date(),
): SessionPlan {
  const reached = tierReached(plan, tasks, now)
  const closed: SessionPlan = {
    ...plan,
    phase: "done",
    reachedTier: reached,
    points: sessionPoints(reached, amounts),
    ...(note?.trim() ? { note: note.trim() } : {}),
  }
  return futureNote === undefined ? closed : withFutureNote(closed, futureNote, now)
}

/** Unfinished lines the review marked **Keep for next session**, as fresh draft refs. */
export function keptRefs(plan: SessionPlan, tasks: readonly Task[]): { tier: SessionTier; taskId: string; stepId?: string }[] {
  return allLines(plan)
    .filter(({ line }) => line.outcome === "keep" && !lineIsDone(line, tasks))
    .map(({ line, tier }) => ({ tier, taskId: line.taskId, ...(line.stepId ? { stepId: line.stepId } : {}) }))
}

/** Minutes the session actually ran (duration minus what was left). */
export function ranMinutes(plan: SessionPlan): number {
  if (!plan.startedAt) return 0
  const end = plan.endedAt ? new Date(plan.endedAt) : new Date()
  const left = plan.clock ? Math.max(0, plan.clock.baseSec) : 0
  const wall = Math.round((end.getTime() - new Date(plan.startedAt).getTime()) / 60000)
  return Math.max(0, Math.min(wall, plan.durationMin - Math.round(left / 60)))
}

/**
 * Old blobs named the third tier `excellent`. Rename it to `exceptional` on
 * the tiers, the reached tier and kept refs. Anything else passes through.
 */
export function migrateSessionPlan(raw: unknown): SessionPlan | null {
  if (!raw || typeof raw !== "object") return null
  const plan = raw as SessionPlan & { tiers: Record<string, SessionLine[] | undefined> }
  const tiers = plan.tiers ?? {}
  return {
    ...plan,
    tiers: {
      min: tiers.min ?? [],
      goal: tiers.goal ?? [],
      exceptional: tiers.exceptional ?? tiers.excellent ?? [],
    },
    ...(plan.reachedTier ? { reachedTier: renameTier(plan.reachedTier) } : {}),
  }
}

export function renameTier<T extends string>(tier: T): T | "exceptional" {
  return (tier as string) === "excellent" ? "exceptional" : tier
}

/**
 * The `timeLogs` a closed session writes, one per line that ran a minute or
 * more. The pen clock already logs what it painted, so minutes logged on the
 * same task and step inside the session window are taken off. Ids are stable
 * per line, so a second write adds nothing.
 */
export function sessionTimeLogs(plan: SessionPlan, tasks: readonly Task[]): { taskId: string; entry: TimeLogEntry }[] {
  if (!plan.startedAt) return []
  const start = new Date(plan.startedAt)
  const end = plan.endedAt ? new Date(plan.endedAt) : new Date()
  const from = formatLocalDateKey(start)
  const to = formatLocalDateKey(end)
  const out: { taskId: string; entry: TimeLogEntry }[] = []
  for (const { line } of allLines(plan)) {
    const task = tasks.find((t) => t.id === line.taskId)
    if (!task) continue
    const id = `session-log-${plan.id}-${line.id}`
    const logs = task.timeLogs ?? []
    if (logs.some((log) => log.id === id)) continue
    const covered = logs
      .filter((log) => log.date >= from && log.date <= to && (log.stepId ?? undefined) === line.stepId && !log.id.startsWith("session-log-"))
      .filter((log) => !log.startTime || (log.startTime >= formatLocalHhmm(start) || log.date > from))
      .reduce((sum, log) => sum + log.durationMinutes, 0)
    const minutes = Math.round((line.actualSec ?? 0) / 60) - covered
    if (minutes < 1) continue
    out.push({
      taskId: task.id,
      entry: {
        id,
        date: from,
        durationMinutes: minutes,
        notes: `Session · ${plan.title} · ${lineLabel(line, tasks)}`,
        taskId: task.id,
        ...(line.stepId ? { stepId: line.stepId } : {}),
      },
    })
  }
  return out
}

// ---- Breaks (interstitials) ---------------------------------------------------

/** Minutes of clock used so far (duration minus what is left). */
export function elapsedMin(plan: SessionPlan, now = new Date()): number {
  if (!plan.clock) return 0
  return Math.max(0, plan.durationMin - remainingSec(plan, now) / 60)
}

/** A break line is due: `breakEvery` more minutes ran since the last one, and the session is not at its end. */
export function breakDue(plan: SessionPlan, now = new Date()): boolean {
  if (plan.phase !== "run" || !plan.breakEvery || plan.breakEvery <= 0) return false
  const next = ((plan.breaksTaken ?? 0) + 1) * plan.breakEvery
  return next < plan.durationMin && elapsedMin(plan, now) >= next
}

/**
 * Take the due break or skip it. Breaks sit inside the time box (the fit
 * gauge already set their minutes aside), so taking one keeps the clock going
 * and lets go of the current line: no line collects break time. Either way it
 * is counted, so the next one is `breakEvery` later.
 */
export function settleBreak(plan: SessionPlan, take: boolean, now = new Date()): SessionPlan {
  const counted = { ...plan, breaksTaken: (plan.breaksTaken ?? 0) + 1 }
  return take ? focusLine(counted, undefined, now) : counted
}

// ---- Templates ------------------------------------------------------------------

export interface SessionTemplate {
  id: string
  title: string
  durationMin: number
  shape?: SessionShape
  breakEvery?: number
  /** Saved tier shape: pointers, like lines. */
  tiers: Record<SessionTier, { taskId: string; stepId?: string }[]>
  builtIn?: boolean
}

const NO_TIERS = (): SessionTemplate["tiers"] => ({ min: [], goal: [], exceptional: [] })

export const JUST_25_TEMPLATE_ID = "tpl-just-25"

/** Built in: Just 25 (FN-3), Morning 90m, Evening 3h. Never stored. */
export const BUILT_IN_TEMPLATES: readonly SessionTemplate[] = [
  { id: JUST_25_TEMPLATE_ID, title: "Just 25", durationMin: 25, shape: "timebox", tiers: NO_TIERS(), builtIn: true },
  { id: "tpl-morning-90", title: "Morning 90m", durationMin: 90, breakEvery: 45, tiers: NO_TIERS(), builtIn: true },
  { id: "tpl-evening-3h", title: "Evening 3h", durationMin: 180, breakEvery: 50, tiers: NO_TIERS(), builtIn: true },
]

/** The draft's shape as a template: length, shape, breaks and its lines as pointers. */
export function templateFromSession(plan: SessionPlan, title = plan.title): SessionTemplate {
  const tiers = NO_TIERS()
  for (const { id } of SESSION_TIERS) {
    tiers[id] = plan.tiers[id].map((line) => ({ taskId: line.taskId, ...(line.stepId ? { stepId: line.stepId } : {}) }))
  }
  return {
    id: rid("tpl"),
    title: title.trim() || "Session",
    durationMin: plan.durationMin,
    ...(plan.shape ? { shape: plan.shape } : {}),
    ...(plan.breakEvery ? { breakEvery: plan.breakEvery } : {}),
    tiers,
  }
}

/**
 * A new draft from a template. Lines whose task is gone or done are dropped;
 * `seed` (for Just 25 on a task) goes into the first tier that lines use.
 */
export function sessionFromTemplate(
  template: SessionTemplate,
  tasks: readonly Task[],
  now = new Date(),
  seed: { taskId: string; stepId?: string }[] = [],
): SessionPlan {
  let plan: SessionPlan = {
    ...emptySession(now, template.durationMin),
    title: template.title,
    ...(template.shape && template.shape !== "lines" ? { shape: template.shape } : {}),
    ...(template.breakEvery ? { breakEvery: template.breakEvery } : {}),
  }
  for (const { id } of SESSION_TIERS) {
    for (const ref of template.tiers[id] ?? []) {
      const task = tasks.find((t) => t.id === ref.taskId)
      if (!task || task.completed) continue
      if (ref.stepId && !findPlacedStep(task.subtasks, ref.stepId)) continue
      plan = addLine(plan, id, ref, tasks)
    }
  }
  // A timebox's Bare minimum is time, so its seed is the Goal.
  const seedTier: SessionTier = isTimebox(plan) ? "goal" : "min"
  for (const ref of seed) plan = addLine(plan, seedTier, ref, tasks)
  if (seed.length === 1 && isTimebox(plan)) plan = { ...plan, title: `${template.title} · ${lineLabel(seed[0], tasks)}` }
  return plan
}

// ---- Bare-minimum floor (FN-4) -------------------------------------------------

export interface FloorSuggestion {
  taskId: string
  stepId?: string
  label: string
  minutes: number
}

/**
 * The smallest ready step that counts, for a draft with no Bare-minimum lines:
 * Just Start's pick in each of the draft's tasks (or the lens's, when the
 * draft is empty), smallest first. Locked steps and tasks waiting on other
 * tasks are never offered. A step-less task with its own estimate counts as
 * one step. Null when Bare minimum already has lines or nothing is ready.
 */
export function floorSuggestion(plan: SessionPlan, tasks: readonly Task[], lensTasks: readonly Task[] = []): FloorSuggestion | null {
  if (plan.tiers.min.length) return null
  const fromDraft = [...new Set(allLines(plan).map(({ line }) => line.taskId))]
  const ids = fromDraft.length ? fromDraft : lensTasks.map((t) => t.id)
  let best: FloorSuggestion | null = null
  for (const id of ids) {
    const task = tasks.find((t) => t.id === id)
    if (!task || task.completed) continue
    const pick = pickStartStep(task, { allTasks: tasks })
    let found: FloorSuggestion | null = null
    if (pick.kind === "step") {
      found = { taskId: task.id, stepId: pick.step.id, label: lineLabel({ taskId: task.id, stepId: pick.step.id }, tasks), minutes: pick.minutes }
    } else if (pick.kind === "no-steps" && task.estimatedDuration && task.estimatedDuration > 0) {
      found = { taskId: task.id, label: itemTitleOrUntitled(task), minutes: task.estimatedDuration }
    }
    if (found && (!best || found.minutes < best.minutes)) best = found
  }
  return best
}
