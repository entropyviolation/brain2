/**
 * lib/task-card.ts — The To Do task card's rules (Phase 12, R7 R8 R15)
 *
 * Pure. The card (`components/Home/ToDo/TaskCard.tsx`) plans this period's
 * work on one task. Here: which card is open (a tiny store, so item detail and
 * a step item can open it), the mass-edit bar's tree edits (each returns a new
 * tree; the card writes it once, so one undo per bar action), the task's
 * points and where they come from, step points on tick, the order lane, and
 * the period values. Store side effects for step points are in
 * `lib/step-points.ts`.
 */
import { create } from "zustand"
import type { Folder, List, SchedulePlacement, StepTier, Subtask, Task } from "@/lib/types"
import { flattenSteps, removeNestedStep, countingMinutes } from "@/lib/todo-steps"
import { STEP_TIERS, stepsForTier } from "@/lib/step-tiers"
import { resolveCompletionPoints } from "@/lib/item-utils"
import { formatLocalDateKey, formatLocalMonthKey, getWeekString, parseLocalDate } from "@/lib/date-utils"

// ── Which card is open ───────────────────────────────────────────────

interface TaskCardState {
  taskId: string | null
  /** Scroll to and select this step when the card opens (a step item's **Card**). */
  stepId?: string
  /** Open the card with this step as its root: the tree and totals show only what is inside it. */
  rootStepId?: string
  /** How many hosts (`todo-panel`) are mounted; item detail shows **Card** only when one is. */
  hosts: number
}

export const useTaskCardStore = create<TaskCardState>()(() => ({ taskId: null, hosts: 0 }))

export function openTaskCard(taskId: string, stepId?: string): void {
  useTaskCardStore.setState({ taskId, stepId, rootStepId: undefined })
}

/** Open a card whose root is one step ("sub-card"). The same task, so every write lands in the one tree. */
export function openSubCard(taskId: string, rootStepId: string | undefined): void {
  useTaskCardStore.setState({ taskId, stepId: undefined, rootStepId })
}

export function closeTaskCard(): void {
  useTaskCardStore.setState({ taskId: null, stepId: undefined, rootStepId: undefined })
}

/** The steps from the top down to `id` (empty when it is not in the tree). */
export function stepTrail(steps: readonly Subtask[] | undefined, id: string, trail: Subtask[] = []): Subtask[] {
  for (const s of steps ?? []) {
    if (s.id === id) return [...trail, s]
    const hit = stepTrail(s.subtasks, id, [...trail, s])
    if (hit.length) return hit
  }
  return []
}

/** `steps` with the children of step `id` swapped for `kids`. */
export function replaceKids(steps: readonly Subtask[], id: string, kids: Subtask[]): Subtask[] {
  return steps.map((s) => (s.id === id ? { ...s, subtasks: kids } : s.subtasks?.length ? { ...s, subtasks: replaceKids(s.subtasks, id, kids) } : s))
}

/** Set one step's estimate (0 clears it) and log the change when the value differs. */
export function withEstimate(s: Subtask, minutes: number, now = new Date()): Subtask {
  const next = Math.max(0, Math.round(minutes))
  if (next === (s.estimatedDuration ?? 0)) return s
  const out = { ...s, estimateLog: [...(s.estimateLog ?? []), { at: now.toISOString(), minutes: next }] }
  if (next > 0) out.estimatedDuration = next
  else delete out.estimatedDuration
  return out
}

export function setEstimate(steps: readonly Subtask[] | undefined, id: string, minutes: number): Subtask[] {
  return mapIds(steps, new Set([id]), (s) => withEstimate(s, minutes))
}

/** Called by the host on mount; returns the unmount. */
export function registerTaskCardHost(): () => void {
  useTaskCardStore.setState((s) => ({ hosts: s.hosts + 1 }))
  return () => useTaskCardStore.setState((s) => ({ hosts: Math.max(0, s.hosts - 1) }))
}

/** On this day's, this week's or this month's To Do list. */
export function onCurrentPeriod(
  task: Pick<Task, "scheduledDate" | "scheduledWeek" | "scheduledMonth">,
  now: Date = new Date(),
): boolean {
  const day = parseLocalDate(task.scheduledDate as Date | string | undefined)
  if (day && formatLocalDateKey(day) === formatLocalDateKey(now)) return true
  if (task.scheduledWeek && task.scheduledWeek === getWeekString(now)) return true
  return !!task.scheduledMonth && task.scheduledMonth === formatLocalMonthKey(now)
}

// ── Mass edit (R8) ───────────────────────────────────────────────────

function mapIds(steps: readonly Subtask[] | undefined, ids: ReadonlySet<string>, edit: (s: Subtask) => Subtask): Subtask[] {
  return (steps ?? []).map((step) => {
    const kids = step.subtasks?.length ? mapIds(step.subtasks, ids, edit) : step.subtasks
    const base = kids === step.subtasks ? step : { ...step, subtasks: kids }
    return ids.has(step.id) ? edit(base) : base
  })
}

export type EstimateEdit = { set: number } | { delta: number }

export function massEstimate(steps: readonly Subtask[] | undefined, ids: ReadonlySet<string>, edit: EstimateEdit): Subtask[] {
  return mapIds(steps, ids, (s) => {
    const next = "set" in edit ? edit.set : Math.max(0, (s.estimatedDuration ?? 0) + edit.delta)
    return withEstimate(s, next)
  })
}

/** `undefined` clears the tier (inherit). */
export function massTier(steps: readonly Subtask[] | undefined, ids: ReadonlySet<string>, tier: StepTier | undefined): Subtask[] {
  return mapIds(steps, ids, (s) => {
    const out = { ...s }
    if (tier) out.tier = tier
    else delete out.tier
    return out
  })
}

/** `undefined` or 0 clears step points. */
export function massPoints(steps: readonly Subtask[] | undefined, ids: ReadonlySet<string>, points: number | undefined): Subtask[] {
  return mapIds(steps, ids, (s) => {
    const out = { ...s }
    if (points && points > 0) out.points = points
    else delete out.points
    return out
  })
}

export function massSpark(steps: readonly Subtask[] | undefined, ids: ReadonlySet<string>, on: boolean, now = new Date()): Subtask[] {
  return mapIds(steps, ids, (s) => {
    const out = { ...s }
    if (on) out.sparkedAt = now.toISOString()
    else delete out.sparkedAt
    return out
  })
}

export function massDone(steps: readonly Subtask[] | undefined, ids: ReadonlySet<string>, done: boolean, now = new Date()): Subtask[] {
  return mapIds(steps, ids, (s) => {
    if (s.completed === done) return s
    const out = { ...s, completed: done }
    if (done) out.completedAt = now
    else delete out.completedAt
    return out
  })
}

export function massDelete(steps: readonly Subtask[] | undefined, ids: ReadonlySet<string>): Subtask[] {
  let out = [...(steps ?? [])]
  for (const id of ids) out = removeNestedStep(out, id)
  return out
}

/** **Needs…**: every selected step needs `needsId` (never itself). */
export function needsAll(steps: readonly Subtask[] | undefined, ids: ReadonlySet<string>, needsId: string): Subtask[] {
  return mapIds(steps, ids, (s) =>
    s.id === needsId || (s.dependsOn ?? []).includes(needsId) ? s : { ...s, dependsOn: [...(s.dependsOn ?? []), needsId] },
  )
}

/** **Chain**: each selected step needs the one above it, in visible order. */
export function chainNeeds(steps: readonly Subtask[] | undefined, orderedIds: readonly string[]): Subtask[] {
  const above = new Map<string, string>()
  for (let i = 1; i < orderedIds.length; i++) above.set(orderedIds[i], orderedIds[i - 1])
  return mapIds(steps, new Set(above.keys()), (s) => {
    const prev = above.get(s.id)!
    return (s.dependsOn ?? []).includes(prev) ? s : { ...s, dependsOn: [...(s.dependsOn ?? []), prev] }
  })
}

/** **Clear needs** on the selected steps. */
export function clearNeeds(steps: readonly Subtask[] | undefined, ids: ReadonlySet<string>): Subtask[] {
  return mapIds(steps, ids, (s) => {
    if (!s.dependsOn) return s
    const out = { ...s }
    delete out.dependsOn
    return out
  })
}

export function openStepIds(steps: readonly Subtask[] | undefined): string[] {
  return flattenSteps(steps).filter((s) => !s.completed).map((s) => s.id)
}

export function leafStepIds(steps: readonly Subtask[] | undefined): string[] {
  return flattenSteps(steps).filter((s) => !s.subtasks?.length).map((s) => s.id)
}

// ── Points ───────────────────────────────────────────────────────────

export type PointsSource = "override" | "tier formula" | "list rule" | "item value" | "default"

/** The task's completion points (`resolveCompletionPoints`) and where they come from. */
export function taskPointsWithSource(
  task: Task,
  lists: readonly List[],
  folders: readonly Folder[],
): { points: number; source: PointsSource } {
  const points = resolveCompletionPoints(task, lists as List[], folders as Folder[])
  if (typeof task.pointsOverride === "number" && task.pointsOverride >= 0) return { points, source: "override" }
  const defs = (task.lists ?? [])
    .flatMap((id) => lists.find((l) => l.id === id)?.itemAttributes ?? [])
    .filter((d) => d.name.trim().toLowerCase() === "points")
  if (defs.some((d) => String(d.type) === "formula")) return { points, source: "tier formula" }
  if (defs.some((d) => task.attributes?.[d.id] != null && task.attributes?.[d.id] !== "")) return { points, source: "list rule" }
  if (task.rewardValue != null) return { points, source: "item value" }
  return { points, source: "default" }
}

/** The points store id for one step. */
export function stepPointsKey(taskId: string, stepId: string): string {
  return `step:${taskId}:${stepId}`
}

/** Each step's points: its own `points`, else the nearest `stepPoints` above it (a step, then the task). */
export function effectiveStepPoints(steps: readonly Subtask[] | undefined, taskDefault?: number): Map<string, number> {
  const out = new Map<string, number>()
  const walk = (list: readonly Subtask[] | undefined, inherited: number | undefined) => {
    for (const s of list ?? []) {
      out.set(s.id, s.points ?? inherited ?? 0)
      walk(s.subtasks, s.stepPoints ?? inherited)
    }
  }
  walk(steps, taskDefault)
  return out
}

/** Step points earned: the sum over ticked steps. */
export function stepPointsEarned(steps: readonly Subtask[] | undefined, taskDefault?: number): number {
  const pts = effectiveStepPoints(steps, taskDefault)
  return flattenSteps(steps).reduce((sum, s) => sum + (s.completed && !hasTierPoints(s) ? (pts.get(s.id) ?? 0) : 0), 0)
}

export interface StepPointChange {
  step: Subtask
  /** Ticked now (pay) or unticked (take back). */
  paid: boolean
}

/** True when the step pays by level (`Subtask.tierPoints`) instead of `points`. */
export function hasTierPoints(step: Pick<Subtask, "tierPoints"> | undefined): boolean {
  return !!step?.tierPoints && Object.values(step.tierPoints).some((v) => (v ?? 0) > 0)
}

/** Steps with points whose tick changed between two trees. */
export function stepPointChanges(prev: readonly Subtask[] | undefined, next: readonly Subtask[] | undefined, taskDefault?: number): StepPointChange[] {
  const before = new Map(flattenSteps(prev).map((s) => [s.id, s]))
  const ptsBefore = effectiveStepPoints(prev, taskDefault)
  const ptsAfter = effectiveStepPoints(next, taskDefault)
  const out: StepPointChange[] = []
  for (const step of flattenSteps(next)) {
    const was = before.get(step.id)
    if (hasTierPoints(step) || hasTierPoints(was)) continue
    const wasDone = !!was?.completed
    // Pay what it is worth now; take back what it was worth when ticked.
    const pts = step.completed && !wasDone ? (ptsAfter.get(step.id) ?? 0) : (ptsBefore.get(step.id) ?? ptsAfter.get(step.id) ?? 0)
    if (!(pts > 0)) continue
    if (step.completed && !wasDone) out.push({ step: { ...step, points: pts }, paid: true })
    else if (!step.completed && wasDone) out.push({ step: { ...step, points: pts, completedAt: was?.completedAt }, paid: false })
  }
  // A ticked step with points that was deleted takes its points back too.
  const nextIds = new Set(flattenSteps(next).map((s) => s.id))
  for (const [id, was] of before) {
    if (!nextIds.has(id) && was.completed && !hasTierPoints(was) && (ptsBefore.get(id) ?? 0) > 0) out.push({ step: { ...was, points: ptsBefore.get(id) }, paid: false })
  }
  return out
}

// ── Order lane ───────────────────────────────────────────────────────

export interface LaneNode {
  id: string
  name: string
  /** Column: the longest chain of open prerequisites before it. */
  depth: number
  /** How many open steps wait on it, directly or through others. */
  unlocks: number
}

/** The open steps' prerequisite graph, left to right. Loops are cut. */
export function orderLane(steps: readonly Subtask[] | undefined): LaneNode[] {
  const open = flattenSteps(steps).filter((s) => !s.completed)
  const byId = new Map(open.map((s) => [s.id, s]))
  const depth = new Map<string, number>()
  const visiting = new Set<string>()
  const depthOf = (id: string): number => {
    if (depth.has(id)) return depth.get(id)!
    if (visiting.has(id)) return 0
    visiting.add(id)
    const needs = (byId.get(id)?.dependsOn ?? []).filter((n) => byId.has(n))
    const d = needs.length ? 1 + Math.max(...needs.map(depthOf)) : 0
    visiting.delete(id)
    depth.set(id, d)
    return d
  }
  const waiters = new Map<string, string[]>()
  for (const s of open) for (const n of s.dependsOn ?? []) if (byId.has(n)) waiters.set(n, [...(waiters.get(n) ?? []), s.id])
  const unlocksOf = (id: string): number => {
    const seen = new Set<string>()
    const walk = (x: string) => {
      for (const w of waiters.get(x) ?? []) if (!seen.has(w) && w !== id) (seen.add(w), walk(w))
    }
    walk(id)
    return seen.size
  }
  const linked = open.filter((s) => (s.dependsOn ?? []).some((n) => byId.has(n)) || waiters.has(s.id))
  return linked.map((s) => ({ id: s.id, name: s.description, depth: depthOf(s.id), unlocks: unlocksOf(s.id) }))
}

// ── Period values ────────────────────────────────────────────────────

type Grain = "day" | "week" | "month"

/** Pushes into this period (left an earlier one of the same grain) and out of it. */
export function periodPushes(
  task: Pick<Task, "schedulePlacements">,
  grain: Grain,
  value: string,
): { in: number; out: number } {
  const same = (task.schedulePlacements ?? []).filter(
    (p: SchedulePlacement) => p.period === grain && p.resolved === "pushed",
  )
  return { in: same.filter((p) => p.value !== value).length, out: same.filter((p) => p.value === value).length }
}

/** Minutes still open in one level's view (open leaves, own estimate or the default). */
export function remainingForLevel(steps: readonly Subtask[] | undefined, tier: StepTier, defaultMin = 0): number {
  const view = stepsForTier(steps ?? [], tier)
  const ids = view.ids as ReadonlySet<string>
  return flattenSteps(steps)
    .filter((s) => ids.has(s.id) && !s.completed && !s.subtasks?.length)
    .reduce((sum, s) => sum + countingMinutes(s, defaultMin), 0)
}

export interface TierEstimateDetail {
  tier: StepTier
  /** Standard estimate for this cumulative tier (min = B, goal = B+G, exceptional = B+G+E). */
  estimate: number
  /** Sum of step estimates counting toward this cumulative tier. */
  parts: number
  /** Original estimate before any tasks were completed: sum of initial/estimated values UNLESS an estimated value does not and never did exist, in which case use actual duration at finish. */
  original: number
  /** Running estimate: ACTUAL duration of all completed steps if known at current moment as much as possible, and estimates when step is not completed or duration is unknown. */
  running: number
  /** Number of steps included in this cumulative tier. */
  stepCount: number
}

/** Cumulative estimates (min = B, goal = B+G, exceptional = B+G+E) plus original and running totals. */
export function tierEstimates(
  steps: readonly Subtask[] | undefined,
  ownEst?: number,
  stepSpent?: ReadonlyMap<string, number>,
  estLog?: readonly { at: string; minutes: number }[],
  rootCompleted?: boolean,
  rootActual?: number,
): Record<StepTier, TierEstimateDetail> {
  const allFlat = flattenSteps(steps)
  const actualOf = (step: Subtask): number => Math.max(step.actualDuration ?? 0, stepSpent?.get(step.id) ?? 0)
  const firstEstOf = (step: Subtask): number => {
    const fromLog = step.estimateLog?.find((e) => e.minutes > 0)?.minutes
    if (fromLog && fromLog > 0) return fromLog
    return (step.estimatedDuration ?? 0) > 0 ? step.estimatedDuration! : 0
  }

  const out = {} as Record<StepTier, TierEstimateDetail>
  for (const tier of STEP_TIERS) {
    const view = stepsForTier(steps ?? [], tier)

    const stepEst = (step: Subtask): number => {
      if (!view.ids.has(step.id) && !view.containers.has(step.id)) return 0
      const childSum = (step.subtasks ?? []).reduce((s, k) => s + stepEst(k), 0)
      if (view.ids.has(step.id)) {
        const own = (step.estimatedDuration ?? 0) > 0 ? step.estimatedDuration! : 0
        return Math.max(own, childSum)
      }
      return childSum
    }

    const stepOrig = (step: Subtask): number => {
      if (!view.ids.has(step.id) && !view.containers.has(step.id)) return 0
      const childOrig = (step.subtasks ?? []).reduce((s, k) => s + stepOrig(k), 0)
      if (view.ids.has(step.id)) {
        const first = firstEstOf(step)
        const ownOrig = first > 0 ? first : step.completed ? actualOf(step) : 0
        return Math.max(ownOrig, childOrig)
      }
      return childOrig
    }

    const stepRun = (step: Subtask): number => {
      if (!view.ids.has(step.id) && !view.containers.has(step.id)) return 0
      const relevantKids = (step.subtasks ?? []).filter((k) => view.ids.has(k.id) || view.containers.has(k.id))
      const act = actualOf(step)
      if (relevantKids.length === 0) {
        if (step.completed && act > 0) return act
        return (step.estimatedDuration ?? 0) > 0 ? step.estimatedDuration! : 0
      }
      const childRun = relevantKids.reduce((s, k) => s + stepRun(k), 0)
      const childEst = relevantKids.reduce((s, k) => s + stepEst(k), 0)
      if (step.completed && act > 0) {
        return childRun === 0 ? act : childRun
      }
      if (view.ids.has(step.id)) {
        const unsplit = Math.max(0, (step.estimatedDuration ?? 0) - childEst)
        return childRun + unsplit
      }
      return childRun
    }

    const allIncluded = allFlat.length === 0 || view.ids.size === allFlat.length
    const parts = (steps ?? []).reduce((s, step) => s + stepEst(step), 0)
    const own = (ownEst ?? 0) > 0 ? ownEst! : 0
    const estimate = allIncluded ? Math.max(own, parts) : parts > 0 ? parts : 0

    const partsOrig = (steps ?? []).reduce((s, step) => s + stepOrig(step), 0)
    const firstRootEst = estLog?.find((e) => e.minutes > 0)?.minutes ?? (own > 0 ? own : 0)
    const rootOrigOwn = firstRootEst > 0 ? firstRootEst : rootCompleted ? Math.max(0, rootActual ?? 0) : 0
    const original = allIncluded ? Math.max(rootOrigOwn, partsOrig) : partsOrig

    const partsRun = (steps ?? []).reduce((s, step) => s + stepRun(step), 0)
    let running: number
    if (allFlat.length === 0) {
      running = rootCompleted && (rootActual ?? 0) > 0 ? rootActual! : own
    } else if (allIncluded) {
      const unsplitOwn = Math.max(0, own - parts)
      running = rootCompleted && (rootActual ?? 0) > 0 && partsRun === 0 ? rootActual! : partsRun + (rootCompleted ? 0 : unsplitOwn)
    } else {
      running = partsRun
    }

    out[tier] = {
      tier,
      estimate,
      parts,
      original,
      running,
      stepCount: view.ids.size,
    }
  }
  return out
}

/** The notice-dot answers on this task, newest first. */
export function noticeAnswers(task: Pick<Task, "noteLog">): { id: string; date: string; text: string }[] {
  return (task.noteLog ?? [])
    .filter((e) => e.tag === "notice")
    .map((e) => ({ id: e.id, date: e.date, text: e.text }))
    .reverse()
}
