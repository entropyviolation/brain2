/**
 * lib/habit-completion-pipeline.ts — Completion sources as a pipeline
 *
 * Engines still read `WeeklyTask.completionSources` (most trusted first).
 * A pipeline row is the form's grouping of those ids: a broad type, the ids
 * that type turns on, and an optional display name. An empty row is skipped.
 * The first source with something to say wins. A hand-typed cell still wins.
 *
 * Names are display-only. A Habits stats row may also store `stats`: the set,
 * the points, and an optional previous-period compare. A saved `statBinding`
 * is kept beside that (`lib/habit-stat-pipeline.ts`). Old habits have no
 * `completionPipelines`; the form builds one row per stored source id
 * (adjacent occupancy and sleep share a row, and so do adjacent habit stats).
 * No persist version bump.
 */
import type {
  HabitCompletionPipeline,
  HabitCompletionSourceId,
  HabitFrequency,
  HabitListMeasure,
  HabitListPipelineMode,
  HabitListSentLink,
  HabitListTarget,
  HabitPipelineKind,
  TaskCompletion,
  WeeklyTask,
} from "./types"
import { sanitizeKeywordSource } from "./habit-keyword-source"
import { HABIT_COMPLETION_SOURCE_ORDER } from "./habit-completion-trust"
import { migrateHabitStatsSource } from "./habit-stat-pipeline"
import { sanitizeHabitStats } from "./habit-stat-points"
import { clampListSentGrace, currentPeriodRange, isSentOnList, listSentCompletion, sentInstant } from "./list-sent"

export const PIPELINE_KIND_ORDER: readonly HabitPipelineKind[] = [
  "manual",
  "tags",
  "trackingTags",
  "trackingStats",
  "habitsStats",
  "lists",
  "keywords",
]

export const PIPELINE_KIND_LABELS: Record<HabitPipelineKind, string> = {
  manual: "By hand",
  tags: "Tags",
  trackingTags: "Tracking tags",
  trackingStats: "Tracking stats",
  habitsStats: "Habits stats",
  lists: "Lists",
  keywords: "BIM Keywords",
}

const KIND_SOURCES: Record<HabitPipelineKind, readonly HabitCompletionSourceId[]> = {
  manual: ["manual"],
  tags: ["taggedTasks"],
  trackingTags: ["tags"],
  trackingStats: ["coverage", "sleep"],
  habitsStats: ["dailyFloor", "habitValue", "dailyCompletionAverage"],
  lists: ["listSent", "list"],
  keywords: ["keywords"],
}

const BUNDLE = new Set<HabitPipelineKind>(["trackingStats", "habitsStats"])
const KIND_SET = new Set<string>(PIPELINE_KIND_ORDER)
const SOURCE_SET = new Set<string>(HABIT_COMPLETION_SOURCE_ORDER)

export function kindForSource(id: HabitCompletionSourceId): HabitPipelineKind {
  switch (id) {
    case "manual":
      return "manual"
    case "taggedTasks":
      return "tags"
    case "tags":
      return "trackingTags"
    case "coverage":
    case "sleep":
      return "trackingStats"
    case "dailyFloor":
    case "habitValue":
    case "dailyCompletionAverage":
      return "habitsStats"
    case "list":
    case "listSent":
      return "lists"
    case "keywords":
      return "keywords"
  }
}

export function defaultSourcesForKind(kind: HabitPipelineKind): HabitCompletionSourceId[] {
  switch (kind) {
    case "manual":
      return ["manual"]
    case "tags":
      return ["taggedTasks"]
    case "trackingTags":
      return ["tags"]
    case "trackingStats":
    case "habitsStats":
      return []
    case "lists":
      return ["listSent"]
    case "keywords":
      return ["keywords"]
  }
}

export function pipelineRowLabel(row: Pick<HabitCompletionPipeline, "kind" | "name">): string {
  const custom = row.name?.trim()
  return custom || PIPELINE_KIND_LABELS[row.kind]
}

let pipelineSeq = 0

export function makePipeline(kind: HabitPipelineKind, sources: readonly HabitCompletionSourceId[] = defaultSourcesForKind(kind)): HabitCompletionPipeline {
  pipelineSeq += 1
  const allowed = new Set(KIND_SOURCES[kind])
  return {
    id: `pipe-${kind}-${pipelineSeq}`,
    kind,
    sources: sources.filter((id) => allowed.has(id)),
  }
}

/** One row per source. Adjacent stats of the same broad type share a row. */
export function pipelinesFromSources(order: readonly HabitCompletionSourceId[]): HabitCompletionPipeline[] {
  const rows: HabitCompletionPipeline[] = []
  for (const id of order) {
    if (!SOURCE_SET.has(id)) continue
    const kind = kindForSource(id)
    const prev = rows[rows.length - 1]
    if (prev && prev.kind === kind && BUNDLE.has(kind)) {
      if (!prev.sources.includes(id)) prev.sources.push(id)
      continue
    }
    rows.push({ id: `pipe-${kind}-${rows.length}`, kind, sources: [id] })
  }
  return rows
}

export function flattenPipelines(rows: readonly HabitCompletionPipeline[]): HabitCompletionSourceId[] {
  const out: HabitCompletionSourceId[] = []
  for (const row of rows) {
    for (const id of row.sources) {
      if (!SOURCE_SET.has(id) || out.includes(id)) continue
      out.push(id)
    }
  }
  return out
}

export function sanitizePipelines(value: unknown): HabitCompletionPipeline[] | undefined {
  if (!Array.isArray(value)) return undefined
  const rows: HabitCompletionPipeline[] = []
  const seen = new Set<HabitCompletionSourceId>()
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue
    const row = raw as Partial<HabitCompletionPipeline>
    if (typeof row.id !== "string" || !row.id || typeof row.kind !== "string" || !KIND_SET.has(row.kind)) continue
    const kind = row.kind as HabitPipelineKind
    const allowed = new Set(KIND_SOURCES[kind])
    const sources: HabitCompletionSourceId[] = []
    for (const id of row.sources ?? []) {
      if (typeof id !== "string" || !allowed.has(id as HabitCompletionSourceId) || seen.has(id as HabitCompletionSourceId)) continue
      sources.push(id as HabitCompletionSourceId)
      seen.add(id as HabitCompletionSourceId)
    }
    const name = typeof row.name === "string" ? row.name.trim() : ""
    const keyword = kind === "keywords" ? sanitizeKeywordSource(row.keyword) ?? undefined : undefined
    const stats = kind === "habitsStats" ? sanitizeHabitStats(row.stats) : undefined
    const statBinding =
      kind === "habitsStats" && row.statBinding != null ? migrateHabitStatsSource(row.statBinding) ?? undefined : undefined
    rows.push({
      id: row.id,
      kind,
      sources,
      ...(name ? { name } : {}),
      ...(keyword ? { keyword } : {}),
      ...(stats ? { stats } : {}),
      ...(statBinding ? { statBinding } : {}),
    })
  }
  return rows
}

export function movePipeline(rows: readonly HabitCompletionPipeline[], index: number, dir: -1 | 1): HabitCompletionPipeline[] {
  const next = index + dir
  if (index < 0 || next < 0 || next >= rows.length) return [...rows]
  const copy = rows.slice()
  const [row] = copy.splice(index, 1)
  copy.splice(next, 0, row)
  return copy
}

/** Turn one engine id on or off inside a row, keeping the kind's usual order. */
export function togglePipelineSource(row: HabitCompletionPipeline, id: HabitCompletionSourceId): HabitCompletionSourceId[] {
  const allowed = KIND_SOURCES[row.kind]
  if (!allowed.includes(id)) return row.sources
  if (row.sources.includes(id)) return row.sources.filter((source) => source !== id)
  const have = new Set(row.sources)
  have.add(id)
  return allowed.filter((source) => have.has(source))
}

export type ResolvedListPipeline = {
  listId: string
  mode: "all-complete" | "one-complete" | "one-added" | "sent-this-week"
  grace: number
}

const MODE_PUBLIC: Record<HabitListPipelineMode, ResolvedListPipeline["mode"]> = {
  allComplete: "all-complete",
  oneComplete: "one-complete",
  oneAdded: "one-added",
  sentThisWeek: "sent-this-week",
}

/**
 * The list a habit is bound to. A missing mode with `listSent` in the trust
 * list is sent-this-week. Grace defaults to 100.
 */
export function resolveListPipeline(
  task: Pick<WeeklyTask, "completionSources" | "listSentLink">,
): ResolvedListPipeline | null {
  const link = task.listSentLink
  if (!link?.listId || link.enabled === false) return null
  const sentOn = !!task.completionSources?.includes("listSent")
  const mode = link.mode ?? (sentOn ? "sentThisWeek" : undefined)
  if (!mode) return null
  return { listId: link.listId, mode: MODE_PUBLIC[mode], grace: clampListSentGrace(link.grace) }
}

export interface ListRouting {
  measure: HabitListMeasure
  target: HabitListTarget
}

/** Old mode menus, read as what is counted and what the target is. */
export function listRoutingFromMode(mode: HabitListPipelineMode): ListRouting {
  switch (mode) {
    case "allComplete":
      return { measure: "completed", target: "listLength" }
    case "oneComplete":
      return { measure: "completed", target: "one" }
    case "oneAdded":
      return { measure: "added", target: "one" }
    case "sentThisWeek":
      return { measure: "sent", target: "periodSet" }
  }
}

/**
 * Sent this week is measure sent and target this period's set.
 * An explicit measure and target win. A missing mode is sent-this-week.
 */
export function listRoutingFromLink(
  link: Pick<HabitListSentLink, "mode" | "measure" | "target"> | null | undefined,
  fallback: HabitListPipelineMode = "sentThisWeek",
): ListRouting {
  if (link?.measure && link?.target) return { measure: link.measure, target: link.target }
  return listRoutingFromMode(link?.mode ?? fallback)
}

/**
 * Fields to store beside list id and grace.
 * Sent this week omits mode, measure, and target so an old link does not change.
 */
export function storedListSentFields(
  link: Pick<HabitListSentLink, "mode" | "measure" | "target"> | null | undefined,
): Pick<HabitListSentLink, "mode" | "measure" | "target"> {
  const routing = listRoutingFromLink(link)
  const legacy = legacyModeForRouting(routing)
  if (legacy === "sentThisWeek") return {}
  if (legacy) return { mode: legacy }
  return { measure: routing.measure, target: routing.target }
}

/** The four old modes. Null when the pair is a newer routing. Sent this week is included. */
export function legacyModeForRouting(routing: ListRouting): HabitListPipelineMode | null {
  const { measure, target } = routing
  if (measure === "sent" && target === "periodSet") return "sentThisWeek"
  if (measure === "completed" && target === "listLength") return "allComplete"
  if (measure === "completed" && target === "one") return "oneComplete"
  if (measure === "added" && target === "one") return "oneAdded"
  return null
}

export interface ListPipelinePreviewItem {
  title?: string
  description?: string
  lists?: readonly string[] | null
  sentAtByList?: Readonly<Record<string, string>> | null
  completed?: boolean
  completedDate?: Date | string | null
  createdAt?: Date | string | null
}

export interface ListPipelinePreview {
  summary: string
  names: string[]
  counted: number
  target: number
}

function itemName(item: ListPipelinePreviewItem): string {
  const title = item.title?.trim()
  if (title) return title
  const description = item.description?.trim()
  return description || "Untitled"
}

function onList(item: ListPipelinePreviewItem, listId: string): boolean {
  return (item.lists ?? []).includes(listId)
}

function instantOf(value: Date | string | null | undefined): number | null {
  if (!value) return null
  const at = value instanceof Date ? value.getTime() : Date.parse(value)
  return Number.isFinite(at) ? at : null
}

/**
 * Read-only counted/target for a list routing at `now`. Does not mark anything sent.
 * List length and this period's set use `listPeriodMeasure` for the period that
 * contains `now`, with the clock at that same instant, so the preview follows
 * the live list. A fixed target of 1 stays 1.
 */
export function describeListRoutingPreview(
  items: readonly ListPipelinePreviewItem[],
  listId: string,
  routing: ListRouting,
  frequency: HabitFrequency | undefined,
  now: Date,
): ListPipelinePreview {
  if (!listId) return { summary: "", names: [], counted: 0, target: 0 }
  const range = currentPeriodRange(frequency, now)
  const start = range.start.getTime()
  const end = range.end.getTime()
  const members = items.filter((item) => onList(item, listId))
  const periodSplit = routing.target === "listLength" || routing.target === "periodSet"
  const sentCounts = routing.measure === "sent" ? listSentCompletion(items, listId, range) : null

  let counted = 0
  let names: string[] = []
  if (routing.measure === "sent") {
    counted = sentCounts?.sent ?? 0
    names = members.filter((item) => !isSentOnList(item, listId)).map(itemName)
  } else if (routing.measure === "added") {
    const added = members.filter((item) => {
      const at = instantOf(item.createdAt)
      return at !== null && at >= start && at < end
    })
    counted = added.length
    names = added.map(itemName)
  } else if (periodSplit) {
    const tripped = items.filter((item) => {
      if (item.completed !== true) return false
      const at = instantOf(item.completedDate)
      return at !== null && at >= start && at < end
    })
    counted = tripped.length
    names = members.filter((item) => item.completed !== true).map(itemName)
  } else {
    counted = members.filter((item) => item.completed === true).length
    names = members.filter((item) => item.completed !== true).map(itemName)
  }

  let target = 1
  if (periodSplit) {
    const measure = measureListSpan(items, listId, routing, frequency, now, now)
    counted = measure.sentInSpan
    target = measure.listLength
  }
  return { summary: `${counted} of ${target}`, names, counted, target }
}

export interface ListPeriodMeasure {
  /** Live length while the period is open; length at the period's end once it has closed. */
  listLength: number
  /** Items whose counted moment falls inside this period only. */
  sentInSpan: number
  /** `max(0, listLength - sentInSpan)`. */
  leftToSend: number
  /** True after the period ends. Later edits to the list do not change `listLength`. */
  frozen: boolean
}

/**
 * Fraction for one period of a goal habit fed by a list.
 * The grid prints `sentInSpan / listLength`. The detail window reads the same
 * object for list length, sent in the span, and left to send.
 * A fixed target of 1 does not use this. Null when the list source is off.
 *
 * `period` is any instant inside the day, week, month, or season.
 * `now` is the clock. The length freezes once `now` is at or past the period end.
 */
export function listPeriodMeasure(
  task: Pick<WeeklyTask, "frequency" | "listSentLink">,
  items: readonly ListPipelinePreviewItem[],
  period: Date,
  now: Date = new Date(),
): ListPeriodMeasure | null {
  const link = task.listSentLink
  if (!link?.listId || link.enabled === false) return null
  const routing = listRoutingFromLink(link)
  if (routing.target !== "listLength" && routing.target !== "periodSet") return null
  return measureListSpan(items, link.listId, routing, task.frequency, period, now)
}

/**
 * End-of-period length is reconstructed. Nothing else is stored.
 *
 * Arrival is `createdAt`. An item created at or after the period end is not
 * in that period's length, so an item added later does not change a finished
 * period.
 *
 * While the period is still open, length is the live membership (`lists`).
 *
 * After it closes, an item still on the list counts when it had already been
 * created. An item that has left counts only when `sentAt` for this list falls
 * in this period or a later one: the weekly clear drops that membership after
 * the period that contains the send, so the item was still on the list at the
 * end of every period from its creation through that send. A send from an
 * earlier period does not stay in this length. A counted flag with no moment
 * is not given a send in any period, and it is not treated as a departure.
 * `completedDate` is the counted moment for Completed. It does not remove the
 * item. Added uses `createdAt` as the counted moment and only for items still
 * on the list, because a removed item no longer says which list it joined.
 */
function measureListSpan(
  items: readonly ListPipelinePreviewItem[],
  listId: string,
  routing: ListRouting,
  frequency: HabitFrequency | undefined,
  period: Date,
  now: Date,
): ListPeriodMeasure {
  const range = currentPeriodRange(frequency, period)
  const start = range.start.getTime()
  const end = range.end.getTime()
  const frozen = now.getTime() >= end
  const sentInSpan = items.filter((item) => countedInSpan(item, listId, routing.measure, start, end)).length
  const listLength = frozen
    ? items.filter((item) => memberAtPeriodEnd(item, listId, start, end)).length
    : items.filter((item) => onList(item, listId)).length
  return {
    listLength,
    sentInSpan,
    leftToSend: Math.max(0, listLength - sentInSpan),
    frozen,
  }
}

function countedInSpan(
  item: ListPipelinePreviewItem,
  listId: string,
  measure: ListRouting["measure"],
  start: number,
  end: number,
): boolean {
  if (measure === "sent") {
    const at = sentInstant(item, listId)
    return at !== null && at >= start && at < end
  }
  if (measure === "added") {
    if (!onList(item, listId)) return false
    const at = instantOf(item.createdAt)
    return at !== null && at >= start && at < end
  }
  if (!onList(item, listId) || item.completed !== true) return false
  const at = instantOf(item.completedDate)
  return at !== null && at >= start && at < end
}

function memberAtPeriodEnd(item: ListPipelinePreviewItem, listId: string, start: number, end: number): boolean {
  const sentAt = sentInstant(item, listId)
  const created = instantOf(item.createdAt)
  const existed = created !== null ? created < end : sentAt !== null && sentAt < end
  if (!existed) return false
  if (onList(item, listId)) return true
  return sentAt !== null && sentAt >= start
}

export interface EffectiveHabitCount {
  /** Items that match what is counted, unless a typed cell still owns the number. */
  current: number
  /** This period's ratio when the target is list length; otherwise the stored goal. */
  target: number
  /** True when save and the list sync should write this period's list-length ratio onto `goal`. */
  derived: boolean
}

/**
 * Effective target and current count for the open period `now` falls in.
 * List length follows the live list here, because save and the list sync call
 * this with the clock. Finished periods freeze in `listPeriodMeasure`; this
 * does not write those. A typed number keeps the cell's current value.
 * Grace is not this number.
 */
export function effectiveHabitCount(
  task: Pick<WeeklyTask, "goal" | "frequency" | "listSentLink">,
  completion: Pick<TaskCompletion, "value" | "manualValue" | "handCompleted" | "trackedValue" | "trackedCompleted" | "coverageCompleted" | "habitSumValue" | "taggedTaskCount" | "dailyCompletionAverage" | "keywordLogged" | "sleepCompleted" | "listCompleted" | "dailyFloorCompleted"> | undefined,
  items: readonly ListPipelinePreviewItem[],
  now: Date,
): EffectiveHabitCount {
  const link = task.listSentLink
  if (!link?.listId || link.enabled === false) {
    return { current: completion?.value ?? 0, target: task.goal || 0, derived: false }
  }
  const routing = listRoutingFromLink(link)
  if (routing.target !== "listLength") {
    return { current: completion?.value ?? 0, target: task.goal || 0, derived: false }
  }
  const preview = describeListRoutingPreview(items, link.listId, routing, task.frequency, now)
  const handOwns =
    completion?.manualValue !== undefined ||
    completion?.handCompleted !== undefined ||
    completion?.trackedValue !== undefined ||
    completion?.trackedCompleted !== undefined ||
    completion?.coverageCompleted !== undefined ||
    completion?.habitSumValue !== undefined ||
    completion?.taggedTaskCount !== undefined ||
    completion?.dailyCompletionAverage !== undefined ||
    completion?.keywordLogged === true ||
    completion?.sleepCompleted !== undefined ||
    completion?.listCompleted !== undefined ||
    completion?.dailyFloorCompleted !== undefined
  return {
    current: handOwns ? (completion?.value ?? 0) : preview.counted,
    target: preview.target,
    derived: true,
  }
}

/**
 * Goal the list-sent percent is compared with. That percent is 0–100 after grace.
 * List length stores its size on `goal`, so the percent still meets at 100.
 */
export function listSentTrustGoal(task: Pick<WeeklyTask, "goal" | "listSentLink">): number {
  const link = task.listSentLink
  if (link?.listId && link.enabled !== false && listRoutingFromLink(link).target === "listLength") return 100
  return task.goal || 0
}

/** Read-only names and count for a stored list mode. Does not mark anything sent. */
export function describeListPipelinePreview(
  items: readonly ListPipelinePreviewItem[],
  listId: string,
  mode: HabitListPipelineMode,
  frequency: HabitFrequency | undefined,
  now: Date,
): ListPipelinePreview {
  return describeListRoutingPreview(items, listId, listRoutingFromMode(mode), frequency, now)
}
