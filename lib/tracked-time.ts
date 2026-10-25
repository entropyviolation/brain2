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
import { formatLocalDateKey } from "@/lib/date-utils"
import { objectiveWorkedMs, type NowObjective } from "@/lib/now-objective"
import { numericFieldValue } from "@/lib/pen-fields"
import type { TimeEntry } from "@/lib/time-entries"
import type { Subtask } from "@/lib/types"
import { assignedPenIds, formatDuration } from "@/lib/time-entries"
import { effectiveDurationMinutes } from "@/lib/todo-steps"
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
  /**
   * `penScope: "tagged"` only: minutes on the linked pens that carry no tag for
   * this task. The pen's whole history, shown apart so it never inflates `total`.
   */
  penPoolMinutes: number
}

export interface TrackedTimeOptions {
  /**
   * `"all"` (default): every block on a linked pen counts, tagged or not (an operation's rollup).
   * `"tagged"`: a linked pen only colors the task; only blocks carrying the task's `taskId` count.
   */
  penScope?: "all" | "tagged"
}

type TrackedItem = {
  id: string
  penLinks?: { penId: string }[]
  timeLogs?: {
    id?: string
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
 * Minutes a log may occupy on the clock.
 * `durationMinutes` is the active time. A start and end that run much longer
 * (the clock was parked, or the end was stamped later) do not fill every
 * minute between them. With no duration, the window itself is the record.
 */
function logWindowTake(dur: number, from: number | null, to: number | null): number {
  const span = from != null && to != null && to > from ? to - from : 0
  if (span === 0) return 0
  if (dur > 0) return Math.min(dur, span)
  return span
}

/**
 * Every minute logged on a set of tasks, across days (Phase 5). Counts blocks
 * painted with a linked pen (`penLinks`, primary or secondary), blocks carrying
 * one of the tasks' ids, and their `timeLogs`. Minutes are unioned per day, so
 * a block painted in two linked views, or a log for the same span as a block
 * (the Operations clock writes both), counts once. A log that names its blocks
 * (`entryIds`) adds only what they did not; an untimed log adds its minutes.
 */
export function trackedTimeForItems(tasks: readonly TrackedItem[], entries: readonly TimeEntry[], options: TrackedTimeOptions = {}): ItemTrackedTime {
  const tagged = options.penScope === "tagged"
  const pool = new Map<string, Set<number>>()
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
    const mine = !!entry.taskId && ids.has(entry.taskId)
    if (tagged && pen && !mine) {
      add(pool, entry.date, entry.startMin, entry.endMin)
      continue
    }
    if (!pen && !mine) continue
    counted.set(entry.id, entry)
    if (pen) add(byPen, entry.date, entry.startMin, entry.endMin)
    add(all, entry.date, entry.startMin, entry.endMin)
  }
  const size = (map: Map<string, Set<number>>) => [...map.values()].reduce((n, set) => n + set.size, 0)
  const penMinutes = size(byPen)
  const penPoolMinutes = size(pool)
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
      const take = logWindowTake(dur, from, to)
      if (log.date && from !== null && take > 0) {
        const set = all.get(log.date) ?? new Set<number>()
        let fresh = 0
        for (let m = from; m < from + take; m++) {
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
  return { total: blockMinutes + logMinutes, penMinutes, clockMinutes: blockMinutes - penMinutes, logMinutes, entries: list, penPoolMinutes }
}

/** One task's tracked time. See `trackedTimeForItems`. */
export function trackedTimeForItem(task: TrackedItem, entries: readonly TimeEntry[], options?: TrackedTimeOptions): ItemTrackedTime {
  return trackedTimeForItems([task], entries, options)
}

export function trackedMinutesForItem(task: TrackedItem, entries: readonly TimeEntry[], options?: TrackedTimeOptions): number {
  return trackedTimeForItems([task], entries, options).total
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
 * Where a node's actual minutes sit.
 * `unlabeled` was indicated only here. `children` are each part's own total,
 * which already includes that part's parts. `total` is the sum.
 */
export interface ActualChild {
  id: string
  total: number
  unlabeled: number
  children: ActualChild[]
}

export interface ActualAccount {
  total: number
  unlabeled: number
  children: ActualChild[]
}

/**
 * One piece of the actual-time total. The rows sum to the task's spent.
 * `stepId` omitted: the minutes were indicated only on the task.
 */
export interface ActualSegment {
  id: string
  kind: "block" | "log" | "saved"
  minutes: number
  date?: string
  startMin?: number
  endMin?: number
  stepId?: string
  entryId?: string
  logId?: string
  /** Set when these minutes belong to one objective on the block. */
  objectiveId?: string
  penId?: string
}

const TASK_BUCKET = ""

type ActualTask = TrackedItem & StepNode

/** Minutes a finished objective actually worked. A parked gap does not count. */
function objectiveMinutes(row: NowObjective): number {
  const ms = objectiveWorkedMs(row)
  if (ms == null) return 0
  const minutes = ms / 60_000
  if (!(minutes >= 0.5)) return 0
  return Math.round(minutes)
}

function clockOnDate(iso: string | undefined, date: string): number | null {
  if (!iso) return null
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime()) || formatLocalDateKey(parsed) !== date) return null
  return parsed.getHours() * 60 + parsed.getMinutes()
}

function collectStepIds(steps: readonly StepNode[] | undefined, into = new Set<string>()): Set<string> {
  for (const step of steps ?? []) {
    into.add(step.id)
    collectStepIds(step.subtasks, into)
  }
  return into
}

interface ActualBuckets {
  /** date → minutes already given to some node, so a later log cannot take them again. */
  taken: Map<string, Set<number>>
  /** bucket key → date → minutes. `""` is the task itself. */
  days: Map<string, Map<string, Set<number>>>
  loose: Map<string, number>
  /** Objective minutes placed outside the block they rode on, keyed by block id. */
  outsideByBlock: Map<string, number>
  segments: ActualSegment[]
}

function blankBuckets(): ActualBuckets {
  return { taken: new Map(), days: new Map(), loose: new Map(), outsideByBlock: new Map(), segments: [] }
}

function coalesce(minutes: readonly number[]): { start: number; end: number }[] {
  if (!minutes.length) return []
  const sorted = [...minutes].sort((a, b) => a - b)
  const ranges: { start: number; end: number }[] = []
  let start = sorted[0]
  let prev = sorted[0]
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + 1) {
      prev = sorted[i]
      continue
    }
    ranges.push({ start, end: prev + 1 })
    start = prev = sorted[i]
  }
  ranges.push({ start, end: prev + 1 })
  return ranges
}

/** Place minutes that no bucket has yet. Returns the minutes that were new. */
function placeMinutes(buckets: ActualBuckets, key: string, date: string, mins: readonly number[]): number[] {
  const taken = buckets.taken.get(date) ?? new Set<number>()
  buckets.taken.set(date, taken)
  const byDate = buckets.days.get(key) ?? new Map<string, Set<number>>()
  buckets.days.set(key, byDate)
  const set = byDate.get(date) ?? new Set<number>()
  byDate.set(date, set)
  const placed: number[] = []
  for (const minute of mins) {
    if (minute < 0 || minute >= 1440 || taken.has(minute)) continue
    taken.add(minute)
    set.add(minute)
    placed.push(minute)
  }
  return placed
}

function remember(
  buckets: ActualBuckets,
  segment: Omit<ActualSegment, "minutes" | "startMin" | "endMin"> & { date?: string },
  placed: readonly number[],
) {
  for (const range of coalesce(placed)) {
    buckets.segments.push({
      ...segment,
      date: segment.date,
      startMin: range.start,
      endMin: range.end,
      minutes: range.end - range.start,
    })
  }
}

function addLoose(buckets: ActualBuckets, key: string, minutes: number, segment?: Omit<ActualSegment, "minutes" | "stepId">) {
  if (!(minutes > 0)) return
  buckets.loose.set(key, (buckets.loose.get(key) ?? 0) + minutes)
  buckets.segments.push({
    id: segment?.id ?? `loose-${key}-${buckets.segments.length}`,
    kind: segment?.kind ?? "log",
    minutes,
    date: segment?.date,
    stepId: key || undefined,
    entryId: segment?.entryId,
    logId: segment?.logId,
    objectiveId: segment?.objectiveId,
    penId: segment?.penId,
  })
}

/**
 * `actualDuration` on a parent is sometimes its own minutes and sometimes a
 * rollup that already includes the parts. Larger than the parts: the extra is
 * its own. Equal: it already is the parts. Smaller: it cannot be that rollup,
 * so it is its own minutes and the parts are added.
 */
function ownFromStored(stored: number, kidSum: number): number {
  if (!(stored > 0)) return 0
  if (stored > kidSum) return stored - kidSum
  if (stored === kidSum) return 0
  return stored
}

function bucketMinutes(buckets: ActualBuckets, key: string): number {
  let total = buckets.loose.get(key) ?? 0
  const byDate = buckets.days.get(key)
  if (byDate) for (const set of byDate.values()) total += set.size
  return total
}

/**
 * Give a block's minutes to the steps that were actually indicated.
 * An objective's worked minutes go to its step, including time that falls
 * outside the painted block. Minutes of the block that no objective claimed
 * stay on the block's step when that step is a different one, and on the task
 * when the block's step is the objective's step (the clock often keeps only
 * the last step, so the earlier part of the sitting was never that step).
 */
function sliceOf(block: TimeEntry, stepId: string | undefined, objectiveId?: string): Omit<ActualSegment, "minutes" | "startMin" | "endMin"> {
  return {
    id: objectiveId ? `${block.id}:${objectiveId}` : block.id,
    kind: "block",
    stepId,
    entryId: block.id,
    objectiveId,
    penId: block.penId,
  }
}

function attributeBlock(buckets: ActualBuckets, block: TimeEntry, stepIds: ReadonlySet<string>) {
  const claimIds = new Set<string>()
  const covered = new Set<number>()
  for (const row of block.nowObjectives ?? []) {
    if (!row.stepId || !stepIds.has(row.stepId)) continue
    const worked = objectiveMinutes(row)
    if (worked < 1) continue
    const openStint = !row.completedAt && !!row.stintStartedAt
    claimIds.add(row.stepId)
    const start = clockOnDate(openStint ? row.stintStartedAt : row.addedAt, block.date)
    const endClock = clockOnDate(row.completedAt, block.date)
    const note = sliceOf(block, row.stepId, row.id)
    if (start == null) {
      const inside: number[] = []
      const take = Math.min(worked, block.endMin - block.startMin)
      for (let minute = block.startMin; minute < block.startMin + take; minute++) inside.push(minute)
      for (const minute of inside) covered.add(minute)
      const got = placeMinutes(buckets, row.stepId, block.date, inside)
      remember(buckets, { ...note, date: block.date }, got)
      if (!openStint) addLoose(buckets, row.stepId, worked - got.length, { ...note, date: block.date })
      continue
    }
    const wallEnd = openStint
      ? block.endMin
      : endClock != null && endClock > start
        ? endClock
        : Math.min(1440, start + worked)
    const spanEnd = openStint ? wallEnd : start + Math.min(worked, Math.max(0, wallEnd - start))
    const inside: number[] = []
    const outside: number[] = []
    for (let minute = start; minute < spanEnd; minute++) {
      if (minute >= block.startMin && minute < block.endMin) inside.push(minute)
      else if (!openStint) outside.push(minute)
    }
    for (const minute of inside) covered.add(minute)
    remember(buckets, { ...note, date: block.date }, placeMinutes(buckets, row.stepId, block.date, inside))
    if (!openStint) {
      const placedOutside = placeMinutes(buckets, row.stepId, block.date, outside)
      remember(buckets, { ...note, date: block.date }, placedOutside)
      if (placedOutside.length > 0) buckets.outsideByBlock.set(block.id, (buckets.outsideByBlock.get(block.id) ?? 0) + placedOutside.length)
      const span = inside.length + outside.length
      addLoose(buckets, row.stepId, Math.max(0, worked - span), { ...note, date: block.date })
    }
  }
  const paint = (key: string, mins: number[]) => {
    remember(buckets, { ...sliceOf(block, key || undefined), date: block.date }, placeMinutes(buckets, key, block.date, mins))
  }
  if (claimIds.size === 0) {
    const key = block.stepId && stepIds.has(block.stepId) ? block.stepId : TASK_BUCKET
    const all: number[] = []
    for (let minute = block.startMin; minute < block.endMin; minute++) all.push(minute)
    paint(key, all)
    return
  }
  const rest: number[] = []
  for (let minute = block.startMin; minute < block.endMin; minute++) {
    if (!covered.has(minute)) rest.push(minute)
  }
  if (rest.length === 0) return
  const key = block.stepId && stepIds.has(block.stepId) && !claimIds.has(block.stepId) ? block.stepId : TASK_BUCKET
  paint(key, rest)
}

function attributeLogs(buckets: ActualBuckets, task: ActualTask, stepIds: ReadonlySet<string>, blocks: readonly TimeEntry[]) {
  const byId = new Map(blocks.map((block) => [block.id, block]))
  for (const log of task.timeLogs ?? []) {
    const dur = Number.isFinite(log.durationMinutes) && log.durationMinutes > 0 ? log.durationMinutes : 0
    const key = log.stepId && stepIds.has(log.stepId) ? log.stepId : TASK_BUCKET
    const stamp = { id: log.id ? `log-${log.id}` : `log-${buckets.segments.length}`, kind: "log" as const, date: log.date, logId: log.id }
    const named = (log.entryIds ?? []).filter((id) => byId.has(id))
    if (named.length > 0) {
      const already = named.reduce((sum, id) => sum + (byId.get(id)!.endMin - byId.get(id)!.startMin), 0)
      const outside = named.reduce((sum, id) => sum + (buckets.outsideByBlock.get(id) ?? 0), 0)
      addLoose(buckets, key, Math.max(0, dur - already - outside), stamp)
      continue
    }
    const from = clockMinute(log.startTime)
    const to = clockMinute(log.endTime)
    const take = logWindowTake(dur, from, to)
    if (log.date && from !== null && take > 0) {
      const mins: number[] = []
      for (let minute = from; minute < from + take; minute++) mins.push(minute)
      remember(buckets, { ...stamp, date: log.date }, placeMinutes(buckets, key, log.date, mins))
      continue
    }
    addLoose(buckets, key, dur, stamp)
  }
}

function compileActual(task: ActualTask, entries: readonly TimeEntry[]): { task: ActualAccount; steps: Map<string, ActualAccount>; segments: ActualSegment[] } {
  const stepIds = collectStepIds(task.subtasks)
  const buckets = blankBuckets()
  const seen = new Set<string>()
  const blocks: TimeEntry[] = []
  for (const entry of entries) {
    if (seen.has(entry.id) || entry.taskId !== task.id || entry.kind === "instant" || entry.endMin <= entry.startMin) continue
    seen.add(entry.id)
    blocks.push(entry)
  }
  blocks.sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin)
  for (const block of blocks) attributeBlock(buckets, block, stepIds)
  attributeLogs(buckets, task, stepIds, blocks)

  const steps = new Map<string, ActualAccount>()
  const indicatedOf = (key: string) => bucketMinutes(buckets, key)
  /**
   * A saved `actualDuration` counts only when it is larger than the minutes
   * already placed on this node and on its parts. The same sitting saved on
   * the step and painted on a block is not added twice. A smaller saved
   * number is an older rollup, not extra own time.
   */
  const savedExtra = (key: string, stored: number, kidSum: number) => {
    const extra = Math.max(0, stored - indicatedOf(key) - kidSum)
    if (extra > 0) {
      buckets.segments.push({
        id: `saved-${key || "task"}`,
        kind: "saved",
        minutes: extra,
        stepId: key || undefined,
      })
    }
    return extra
  }
  const rollup = (step: StepNode): ActualChild => {
    const kids = (step.subtasks ?? []).map(rollup)
    const kidSum = kids.reduce((sum, kid) => sum + kid.total, 0)
    const unlabeled = indicatedOf(step.id) + savedExtra(step.id, step.actualDuration ?? 0, kidSum)
    const account: ActualAccount = {
      total: unlabeled + kidSum,
      unlabeled,
      children: kids.filter((kid) => kid.total > 0),
    }
    steps.set(step.id, account)
    return { id: step.id, ...account }
  }
  const tops = (task.subtasks ?? []).map(rollup)
  const kidSum = tops.reduce((sum, kid) => sum + kid.total, 0)
  const unlabeled = indicatedOf(TASK_BUCKET) + savedExtra(TASK_BUCKET, task.actualDuration ?? 0, kidSum)
  return {
    task: { total: unlabeled + kidSum, unlabeled, children: tops.filter((kid) => kid.total > 0) },
    steps,
    segments: buckets.segments.filter((segment) => segment.minutes > 0),
  }
}

/**
 * Actual minutes saved on a step from `actualDuration` alone, plus the same
 * for each part. A number that already includes the parts is not added twice.
 * Estimates are left untouched.
 */
export function storedActualMinutes(step: StepNode | undefined): number {
  if (!step) return 0
  const kids = (step.subtasks ?? []).reduce((sum, kid) => sum + storedActualMinutes(kid), 0)
  return ownFromStored(step.actualDuration ?? 0, kids) + kids
}

/** The account, every step's account, and the rows that sum to the task total. */
export function taskActualReport(task: ActualTask, entries: readonly TimeEntry[]) {
  return compileActual(task, entries)
}

/** This task's actual minutes: its own unlabeled time, plus each part. */
export function taskActualAccount(task: ActualTask, entries: readonly TimeEntry[]): ActualAccount {
  return compileActual(task, entries).task
}

/** The rows behind `taskActualAccount`. They sum to that total. */
export function taskActualSegments(task: ActualTask, entries: readonly TimeEntry[]): ActualSegment[] {
  return compileActual(task, entries).segments
}

/** One step's actual minutes. Null when the step is not in the task. */
export function stepActualAccount(task: ActualTask, stepId: string, entries: readonly TimeEntry[]): ActualAccount | null {
  if (!findStepNode(task.subtasks, stepId)) return null
  return compileActual(task, entries).steps.get(stepId) ?? { total: 0, unlabeled: 0, children: [] }
}

/**
 * Every actual minute on one step and the steps inside it (Phase 6 spent).
 * A block tagged to the step counts. So does an objective tied to the step,
 * and `actualDuration` when that saved number is larger than the blocks.
 * Minutes indicated only on an ancestor stay on the ancestor. 0 when the
 * step is not in the task.
 */
export function stepSpentMinutes(task: ActualTask, stepId: string, entries: readonly TimeEntry[]): number {
  return stepActualAccount(task, stepId, entries)?.total ?? 0
}

/** Spent minutes for every step of a task, keyed by step id. Steps with none are left out. */
export function stepSpentMap(task: ActualTask, entries: readonly TimeEntry[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const [id, account] of compileActual(task, entries).steps) {
    if (account.total > 0) out.set(id, account.total)
  }
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

/**
 * parts (Phase 6, R6): the sum of the children's counting minutes. 0 on a
 * leaf. The one rule for est · parts · spent outside the step tree too.
 */
export function partsMinutes(steps: readonly Subtask[] | undefined): number {
  return (steps ?? []).reduce((total, step) => total + effectiveDurationMinutes(step.estimatedDuration, step.subtasks), 0)
}

/** "52m · est 30 · parts 45", leaving out what is not there. */
export function timeTrio(est: number, parts: number, spent: number): string {
  const bits: string[] = []
  if (spent > 0) bits.push(formatDuration(spent))
  if (est > 0) bits.push(`est ${est}`)
  if (parts > 0) bits.push(`parts ${parts}`)
  return bits.join(" · ")
}
