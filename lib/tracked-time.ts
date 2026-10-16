/**
 * lib/tracked-time.ts — Tag rollups over the TimeGrid
 *
 * Pure reads over the shape held by `lib/time-tracking-store.ts`: given the pen
 * scopes and the tracked intervals, how many minutes carry a given tag?
 *
 * Minutes are unioned across scopes before they are counted. The same minute can
 * be painted in Activity, Location and Mood at once, so summing per-scope totals
 * would triple-count a minute whenever several of those pens share a tag.
 *
 * Minute indices (0–1439), not slot indices — the grid has been interval-based
 * since v4 of the store (`lib/time-entries.ts`). `lib/completion-window.ts` reads
 * the same sets to find when in the day a habit actually closed.
 *
 * Consumers: `lib/habit-tracking-sync.ts` (habit auto-fill), `lib/habit-done-log.ts`,
 * and the Tracking day totals. Everything here takes plain state so tests never
 * touch a store.
 */
import { numericFieldValue } from "@/lib/pen-fields"
import type { TimeEntry } from "@/lib/time-entries"
import { assignedPenIds } from "@/lib/time-entries"
import type { TrackPen, TrackScope, TrackTag } from "@/lib/time-tracking-store"

/** The slice of the tracking store these helpers need. */
export interface TrackedTimeSource {
  scopes: TrackScope[]
  entries: TimeEntry[]
}

export function penTagIds(pen: Pick<TrackPen, "tags"> | undefined | null): string[] {
  return pen?.tags ?? []
}

/**
 * The tags a block actually carries: whatever **every assigned pen** always
 * carries (primary plus any secondaries), plus any pinned to this block alone.
 *
 * Tags are a property of *time*, not of pens — a pen tag is just the convenient
 * way to say "always". Secondary pens are not cosmetic: a youtube block that
 * also counts as studying spanish feeds both pens' tags into habits, operations,
 * and goals. Everything downstream (habit auto-fill, the By-tag totals,
 * analytics) counts minutes through this.
 */
export function effectiveTagIds(
  entry: Pick<TimeEntry, "penId" | "secondaryPenIds" | "tagIds">,
  scopes: TrackScope[],
): string[] {
  const ids = new Set<string>()
  for (const penId of assignedPenIds(entry)) {
    for (const id of penTagIds(findPen(scopes, penId))) ids.add(id)
  }
  for (const id of entry.tagIds ?? []) ids.add(id)
  return [...ids]
}

export function findPen(scopes: TrackScope[], penId: string): TrackPen | undefined {
  for (const scope of scopes) {
    const pen = scope.pens.find((p) => p.id === penId)
    if (pen) return pen
  }
  return undefined
}

export function tagsForPen(tags: TrackTag[], pen: Pick<TrackPen, "tags"> | undefined | null): TrackTag[] {
  const ids = new Set(penTagIds(pen))
  return tags.filter((t) => ids.has(t.id))
}

/** Every pen across every scope carrying at least one of `tagIds`. */
export function penIdsForTags(scopes: TrackScope[], tagIds: string[]): Set<string> {
  const wanted = new Set(tagIds)
  const penIds = new Set<string>()
  if (wanted.size === 0) return penIds
  for (const scope of scopes) {
    for (const pen of scope.pens) {
      if (penTagIds(pen).some((id) => wanted.has(id))) penIds.add(pen.id)
    }
  }
  return penIds
}

/** Minutes past midnight on `dateKey` carrying one of `tagIds`, from any scope. */
export function trackedMinuteSetForTags(
  source: TrackedTimeSource,
  dateKey: string,
  tagIds: string[],
): Set<number> {
  const minutes = new Set<number>()
  const wanted = new Set(tagIds)
  if (wanted.size === 0) return minutes
  for (const entry of source.entries) {
    if (entry.date !== dateKey) continue
    if (!effectiveTagIds(entry, source.scopes).some((id) => wanted.has(id))) continue
    for (let m = entry.startMin; m < entry.endMin; m++) minutes.add(m)
  }
  return minutes
}

export function trackedMinutesForTags(source: TrackedTimeSource, dateKey: string, tagIds: string[]): number {
  return trackedMinuteSetForTags(source, dateKey, tagIds).size
}

export function trackedMinutesForTagsInRange(
  source: TrackedTimeSource,
  dateKeys: string[],
  tagIds: string[],
): number {
  return dateKeys.reduce((sum, key) => sum + trackedMinutesForTags(source, key, tagIds), 0)
}

/**
 * Sum of a number detail field (`lib/pen-fields.ts`) on `dateKey`'s blocks that
 * carry one of `tagIds`. A block that runs past midnight is counted once, on
 * the slice where it starts.
 */
export function trackedFieldSumForTags(
  source: TrackedTimeSource,
  dateKey: string,
  tagIds: string[],
  fieldId: string,
): number {
  const wanted = new Set(tagIds)
  if (wanted.size === 0) return 0
  let sum = 0
  for (const entry of source.entries) {
    if (entry.date !== dateKey) continue
    if (entry.spanId && entry.startMin === 0) continue
    if (!effectiveTagIds(entry, source.scopes).some((id) => wanted.has(id))) continue
    sum += numericFieldValue(entry, fieldId)
  }
  return sum
}

export function trackedFieldSumForTagsInRange(
  source: TrackedTimeSource,
  dateKeys: string[],
  tagIds: string[],
  fieldId: string,
): number {
  return dateKeys.reduce((sum, key) => sum + trackedFieldSumForTags(source, key, tagIds, fieldId), 0)
}

/** Minutes per tag for one day, for the Tracking footer and analytics. */
export function trackedMinutesByTag(source: TrackedTimeSource, dateKey: string): Record<string, number> {
  const totals: Record<string, number> = {}
  const minutesByTag = new Map<string, Set<number>>()
  for (const entry of source.entries) {
    if (entry.date !== dateKey) continue
    for (const tagId of effectiveTagIds(entry, source.scopes)) {
      const set = minutesByTag.get(tagId) ?? new Set<number>()
      for (let m = entry.startMin; m < entry.endMin; m++) set.add(m)
      minutesByTag.set(tagId, set)
    }
  }
  for (const [tagId, minutes] of minutesByTag) totals[tagId] = minutes.size
  return totals
}

/** Dates that have any painted data, newest first — the sync's re-check window. */
export function trackedDateKeys(source: TrackedTimeSource): string[] {
  return [...new Set(source.entries.map((e) => e.date))].sort((a, b) => b.localeCompare(a))
}

/** What an item's tracked total is made of. */
export interface ItemTrackedTime {
  total: number
  /** Minutes on blocks painted with a linked pen (primary or secondary). */
  penMinutes: number
  /** Minutes on blocks carrying the task's `taskId`, not already under a linked pen. */
  clockMinutes: number
  /** `timeLogs` minutes no counted block already covers. */
  logMinutes: number
  /** The counted blocks, newest first. */
  entries: TimeEntry[]
}

type TrackedItem = {
  id: string
  penLinks?: { penId: string }[]
  timeLogs?: {
    date?: string
    startTime?: string
    endTime?: string
    durationMinutes: number
    entryIds?: string[]
    stepId?: string
  }[]
}

function clockMinute(hhmm: string | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? "")
  if (!m) return null
  const v = Number(m[1]) * 60 + Number(m[2])
  return v >= 0 && v <= 1440 ? v : null
}

/**
 * Every minute logged on a set of tasks, across days (Phase 5). Counts blocks
 * painted with a linked pen (`penLinks`, primary or secondary), blocks carrying
 * one of the tasks' ids, and their `timeLogs`. Minutes are unioned per day, so
 * a block painted in two linked views, or a log for the same span as a block
 * (the Operations clock writes both), counts once. A log that names its blocks
 * (`entryIds`) adds only what they did not; an untimed log adds its minutes.
 */
export function trackedTimeForItems(tasks: readonly TrackedItem[], entries: readonly TimeEntry[]): ItemTrackedTime {
  const pens = new Set(tasks.flatMap((t) => (t.penLinks ?? []).map((link) => link.penId)))
  const ids = new Set(tasks.map((t) => t.id))
  const counted = new Map<string, TimeEntry>()
  const byPen = new Map<string, Set<number>>()
  const all = new Map<string, Set<number>>()
  const add = (map: Map<string, Set<number>>, date: string, from: number, to: number) => {
    const set = map.get(date) ?? new Set<number>()
    for (let m = from; m < to; m++) set.add(m)
    map.set(date, set)
  }
  for (const entry of entries) {
    if (entry.kind === "instant" || entry.endMin <= entry.startMin || counted.has(entry.id)) continue
    const pen = pens.size > 0 && assignedPenIds(entry).some((id) => pens.has(id))
    if (!pen && !(entry.taskId && ids.has(entry.taskId))) continue
    counted.set(entry.id, entry)
    if (pen) add(byPen, entry.date, entry.startMin, entry.endMin)
    add(all, entry.date, entry.startMin, entry.endMin)
  }
  const size = (map: Map<string, Set<number>>) => [...map.values()].reduce((n, set) => n + set.size, 0)
  const penMinutes = size(byPen)
  const blockMinutes = size(all)

  let logMinutes = 0
  for (const task of tasks) {
    for (const log of task.timeLogs ?? []) {
      const dur = Number.isFinite(log.durationMinutes) && log.durationMinutes > 0 ? log.durationMinutes : 0
      const named = (log.entryIds ?? []).filter((id) => counted.has(id))
      if (named.length > 0) {
        const already = named.reduce((sum, id) => sum + (counted.get(id)!.endMin - counted.get(id)!.startMin), 0)
        logMinutes += Math.max(0, dur - already)
        continue
      }
      const from = clockMinute(log.startTime)
      const to = clockMinute(log.endTime)
      if (log.date && from !== null && to !== null && to > from) {
        const set = all.get(log.date) ?? new Set<number>()
        let fresh = 0
        for (let m = from; m < to; m++) {
          if (!set.has(m)) {
            set.add(m)
            fresh++
          }
        }
        all.set(log.date, set)
        logMinutes += fresh
        continue
      }
      logMinutes += dur
    }
  }
  const list = [...counted.values()].sort((a, b) => b.date.localeCompare(a.date) || b.startMin - a.startMin)
  return { total: blockMinutes + logMinutes, penMinutes, clockMinutes: blockMinutes - penMinutes, logMinutes, entries: list }
}

/** One task's tracked time. See `trackedTimeForItems`. */
export function trackedTimeForItem(task: TrackedItem, entries: readonly TimeEntry[]): ItemTrackedTime {
  return trackedTimeForItems([task], entries)
}

export function trackedMinutesForItem(task: TrackedItem, entries: readonly TimeEntry[]): number {
  return trackedTimeForItems([task], entries).total
}

type StepNode = { id: string; completed?: boolean; actualDuration?: number; subtasks?: StepNode[] }

function findStepNode(steps: readonly StepNode[] | undefined, id: string): StepNode | undefined {
  for (const step of steps ?? []) {
    if (step.id === id) return step
    const inner = findStepNode(step.subtasks, id)
    if (inner) return inner
  }
  return undefined
}

function subtreeIds(step: StepNode, into = new Set<string>()): Set<string> {
  into.add(step.id)
  for (const kid of step.subtasks ?? []) subtreeIds(kid, into)
  return into
}

/**
 * Every minute logged on one step and the steps inside it, across days (Phase 6
 * spent): `timeLogs` and blocks carrying a `stepId` in that subtree, deduped the
 * same way as `trackedTimeForItems`. 0 for a step that is not in the task.
 */
export function stepSpentMinutes(
  task: TrackedItem & { subtasks?: StepNode[] },
  stepId: string,
  entries: readonly TimeEntry[],
): number {
  const step = findStepNode(task.subtasks, stepId)
  if (!step) return 0
  const ids = subtreeIds(step)
  const logs = (task.timeLogs ?? []).filter((log) => !!log.stepId && ids.has(log.stepId))
  const blocks = entries.filter((e) => e.taskId === task.id && !!e.stepId && ids.has(e.stepId))
  if (logs.length === 0 && blocks.length === 0) return 0
  return trackedTimeForItems([{ id: task.id, timeLogs: logs }], blocks).total
}

/** Spent minutes for every step of a task, keyed by step id. Steps with none are left out. */
export function stepSpentMap(
  task: TrackedItem & { subtasks?: StepNode[] },
  entries: readonly TimeEntry[],
): Map<string, number> {
  const out = new Map<string, number>()
  const hasStepTime =
    (task.timeLogs ?? []).some((log) => log.stepId) ||
    entries.some((e) => e.taskId === task.id && e.stepId)
  if (!hasStepTime) return out
  const visit = (steps: readonly StepNode[] | undefined) => {
    for (const step of steps ?? []) {
      const spent = stepSpentMinutes(task, step.id, entries)
      if (spent > 0) out.set(step.id, spent)
      visit(step.subtasks)
    }
  }
  visit(task.subtasks)
  return out
}

/**
 * On completion, a step's `actualDuration` takes its spent minutes when spent is
 * larger (Phase 6). Only steps that were open in `before` and are done in
 * `after` are touched; everything else is returned as is.
 */
export function settleSpentOnFinish<S extends StepNode>(
  task: TrackedItem & { subtasks?: StepNode[] },
  after: S[],
  entries: readonly TimeEntry[],
): S[] {
  const before = task.subtasks
  const visit = (steps: S[]): S[] => {
    let changed = false
    const next = steps.map((step) => {
      let out = step
      if (step.completed && findStepNode(before, step.id)?.completed === false) {
        const spent = stepSpentMinutes(task, step.id, entries)
        if (spent > (step.actualDuration ?? 0)) out = { ...out, actualDuration: spent }
      }
      if (step.subtasks?.length) {
        const kids = visit(step.subtasks as S[])
        if (kids !== step.subtasks) out = { ...out, subtasks: kids }
      }
      if (out !== step) changed = true
      return out
    })
    return changed ? next : steps
  }
  return visit(after)
}
