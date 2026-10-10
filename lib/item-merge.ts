/**
 * lib/item-merge.ts — Combine multiple items into one surviving item
 *
 * Search-result Select and open-list Select share one write path
 * (`handleApplyItemMerge` → `applyItemMerge`). The survivor is a replace, not a
 * copy-alongside: discarded ids are filtered out and stamped into
 * `removedTaskIds` by the store.
 *
 * Field assembly (defaults keepAllDetails / preserve* true):
 * - Multi-value (tags, lists, links, deps, subtasks, goals/objectives, custom
 *   array attrs, timeLogs): union, no duplicates.
 * - Custom attribute map: every key from every source; arrays/files union; empty
 *   never overwrites held; differing text appends (survivor first); numbers stay
 *   numbers and take the max; booleans OR; goals take maxes.
 * - Dialog-picked singles (title, notes, why, lists, icon): plan wins as the
 *   primary. With keepAllDetails, other held notes/why/body are appended (the
 *   chosen line first). With it off, the chosen note/why is exclusive.
 * - Built-in scalars (priority-ish numbers, dates, context, type, …): prefer
 *   survivor when held, else first held from others; numbers take the max of
 *   held values when keepAllDetails so the stronger signal survives.
 *   `createdAt` is the earliest real instant across the sources, so an inbox
 *   arrival is not replaced by a later sibling.
 * - Live schedule stays one period (day, else week, else month, else year —
 *   survivor first). Other periods are kept on `schedulePlacements`.
 * - Links and dependencies that only pointed at a merged sibling are dropped.
 */
import type {
  AttributeValue,
  FileValue,
  GoalValue,
  ItemLink,
  List,
  SchedulePlacement,
  SchedulePlacementPeriod,
  Subtask,
  Task,
  TimeLogEntry,
} from "@/lib/types"
import { canonicalWeekKey, formatLocalDateKey, parseLocalDate, safeToDate } from "@/lib/date-utils"
import { clearedScheduleFields, scheduleFieldsForPeriod } from "@/lib/scheduling"
import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import { uniqueNonEmpty, unionById } from "@/lib/list-merge"
import { isNaSmartCategoryId } from "@/lib/scheduled-lists-sync"
import { itemTitleOrUntitled } from "@/lib/item-utils"

export interface ItemMergePlan {
  survivorId: string
  discardedIds: string[]
  description: string
  notes?: string
  why?: string
  icon?: string
  listIds: string[]
  keepAllDetails: boolean
  preserveAttributes: boolean
  preserveTags: boolean
  preserveLinks: boolean
}

export function itemMergeLabel(item: Task): string {
  return itemTitleOrUntitled(item)
}

export function defaultMergeListIds(items: Task[], lists: List[]): string[] {
  const wanted = new Set(items.flatMap((item) => item.lists ?? []))
  return lists
    .filter((l) => wanted.has(l.id) && !isFolderAllItemsCategoryId(l.id) && !isNaSmartCategoryId(l.id))
    .map((l) => l.id)
}

export function defaultItemMergePlan(items: Task[], lists: List[]): ItemMergePlan | null {
  if (items.length < 2) return null
  const survivor = items[0]
  return {
    survivorId: survivor.id,
    discardedIds: items.slice(1).map((item) => item.id),
    description: itemMergeLabel(survivor),
    notes: survivor.notes,
    why: survivor.why,
    icon: survivor.icon,
    listIds: defaultMergeListIds(items, lists),
    keepAllDetails: true,
    preserveAttributes: true,
    preserveTags: true,
    preserveLinks: true,
  }
}

function retargetId(id: string, discarded: Set<string>, survivorId: string): string {
  return discarded.has(id) ? survivorId : id
}

function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/** True when an attribute / optional field carries a real value. */
export function isHeldValue(value: AttributeValue | Date | undefined | null): boolean {
  if (value === undefined || value === null || value === "") return false
  if (value instanceof Date) return !Number.isNaN(value.getTime())
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === "object") {
    const g = value as GoalValue
    if ("current" in g || "target" in g) return g.current != null || g.target != null
    const f = value as FileValue
    if ("uri" in f || "name" in f) return !!(f.uri || f.name)
  }
  return true
}

function isGoalValue(value: AttributeValue): value is GoalValue {
  return !!value && typeof value === "object" && !Array.isArray(value) && ("current" in value || "target" in value)
}

function attrKey(value: unknown): string {
  if (value && typeof value === "object" && "id" in (value as object)) {
    return `id:${String((value as { id?: string }).id)}`
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function isFileValue(value: AttributeValue): value is FileValue {
  return !!value && typeof value === "object" && !Array.isArray(value) && "uri" in value && "name" in value
}

/**
 * Union two held attribute values. Never drops a held scalar from the other
 * side: arrays/files union, goals take maxes, booleans OR, numbers stay numbers
 * and take the max, differing strings append (preferred first, same as notes).
 */
export function mergeAttributeValue(preferred: AttributeValue, other: AttributeValue): AttributeValue {
  if (!isHeldValue(other)) return preferred
  if (!isHeldValue(preferred)) return other

  if (Array.isArray(preferred) || Array.isArray(other) || isFileValue(preferred) || isFileValue(other)) {
    const a = Array.isArray(preferred)
      ? preferred
      : isFileValue(preferred) || isHeldValue(preferred)
        ? [preferred as string | FileValue]
        : []
    const b = Array.isArray(other)
      ? other
      : isFileValue(other) || isHeldValue(other)
        ? [other as string | FileValue]
        : []
    const seen = new Set<string>()
    const out: unknown[] = []
    for (const entry of [...a, ...b]) {
      const key = attrKey(entry)
      if (seen.has(key)) continue
      seen.add(key)
      out.push(entry)
    }
    return out as AttributeValue
  }

  if (isGoalValue(preferred) && isGoalValue(other)) {
    return {
      current: Math.max(Number(preferred.current ?? 0), Number(other.current ?? 0)),
      target: Math.max(Number(preferred.target ?? 0), Number(other.target ?? 0)),
    }
  }

  if (typeof preferred === "boolean" && typeof other === "boolean") {
    return preferred || other
  }

  if (typeof preferred === "number" && typeof other === "number") {
    if (!Number.isFinite(preferred)) return other
    if (!Number.isFinite(other)) return preferred
    return Math.max(preferred, other)
  }

  if (preferred === other) return preferred

  // Differing non-empty scalars — append so neither value is discarded.
  const left = String(preferred)
  const right = String(other)
  if (left === right) return preferred
  return `${left}\n\n${right}`
}

/** Every custom attribute key from every source; held values are never dropped. */
export function mergeAttributeRecords(sources: Task[], survivorId: string): Record<string, AttributeValue> {
  const survivor = sources.find((item) => item.id === survivorId)
  const others = sources.filter((item) => item.id !== survivorId)
  const keys = new Set<string>()
  for (const item of sources) {
    for (const id of Object.keys(item.attributes ?? {})) keys.add(id)
  }
  const out: Record<string, AttributeValue> = {}
  for (const key of keys) {
    let value: AttributeValue = undefined
    for (const item of others) {
      value = mergeAttributeValue(value, item.attributes?.[key])
    }
    // Survivor is preferred (listed first when appending), but other held
    // scalars are still kept via append / union — never clobbered away.
    value = mergeAttributeValue(survivor?.attributes?.[key], value)
    if (isHeldValue(value)) out[key] = value as AttributeValue
  }
  return out
}

/**
 * Dialog-chosen primary text, plus any other held texts when keepAllDetails so
 * a non-empty note/why/body from a discarded item is never dropped.
 */
export function joinChosenAndOthers(
  chosen: string | undefined,
  others: (string | undefined)[],
  keepAll: boolean,
): string | undefined {
  if (!keepAll) return chosen?.trim() ? chosen : undefined
  const parts = uniqueNonEmpty([chosen, ...others])
  if (parts.length === 0) return undefined
  if (parts.length === 1) return parts[0]
  const primary = (chosen ?? "").trim()
  if (primary && parts.includes(primary)) {
    return [primary, ...parts.filter((p) => p !== primary)].join("\n\n")
  }
  return parts.join("\n\n")
}

function firstHeld<T>(values: (T | undefined)[], held: (v: T) => boolean = (v) => isHeldValue(v as AttributeValue)): T | undefined {
  for (const v of values) {
    if (v !== undefined && v !== null && held(v)) return v
  }
  return undefined
}

function maxHeld(...nums: (number | undefined)[]): number | undefined {
  const held = nums.filter((n): n is number => typeof n === "number" && !Number.isNaN(n))
  return held.length ? Math.max(...held) : undefined
}

function earliestDate(...dates: (Date | undefined)[]): Date | undefined {
  const held = dates.filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()))
  if (!held.length) return undefined
  return held.reduce((a, b) => (a.getTime() <= b.getTime() ? a : b))
}

function latestDate(...dates: (Date | undefined)[]): Date | undefined {
  const held = dates.filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()))
  if (!held.length) return undefined
  return held.reduce((a, b) => (a.getTime() >= b.getTime() ? a : b))
}

/** Every live period a record is holding, finest first. */
function heldPeriods(item: Task): { period: SchedulePlacementPeriod; value: string }[] {
  const out: { period: SchedulePlacementPeriod; value: string }[] = []
  if (item.scheduledDate) {
    const date = parseLocalDate(item.scheduledDate)
    if (date) out.push({ period: "day", value: formatLocalDateKey(date) })
  }
  if (item.scheduledWeek) out.push({ period: "week", value: canonicalWeekKey(item.scheduledWeek) })
  if (item.scheduledMonth) out.push({ period: "month", value: item.scheduledMonth })
  if (item.scheduledYear) out.push({ period: "year", value: item.scheduledYear })
  return out
}

/**
 * One live period for the survivor, plus every other period as history.
 * The funnel stores a single live bucket; day wins over week over month over year,
 * and the survivor's bucket wins over a discarded item's.
 */
function settleSchedule(sources: Task[], survivor: Task, others: Task[]): Partial<Task> {
  const chosen = heldPeriods(survivor)[0] ?? others.map((item) => heldPeriods(item)[0]).find((p) => p != null)
  const seen = new Set<string>()
  const resolvedByKey = new Map<string, NonNullable<SchedulePlacement["resolved"]>>()
  const placements: SchedulePlacement[] = []
  const push = (period: SchedulePlacementPeriod, value: string, resolved?: SchedulePlacement["resolved"]) => {
    const normalized = period === "week" ? canonicalWeekKey(value) : value
    const key = `${period}:${normalized}`
    if (resolved && !resolvedByKey.has(key)) resolvedByKey.set(key, resolved)
    if (seen.has(key)) {
      if (resolved) {
        const row = placements.find((p) => p.period === period && p.value === normalized)
        if (row && !row.resolved) row.resolved = resolved
      }
      return
    }
    if (chosen && chosen.period === period && chosen.value === normalized) return
    seen.add(key)
    const kept = resolvedByKey.get(key)
    placements.push(kept ? { period, value: normalized, resolved: kept } : { period, value: normalized })
  }
  for (const item of sources) {
    for (const row of item.schedulePlacements ?? []) push(row.period, row.value, row.resolved)
    for (const live of heldPeriods(item)) push(live.period, live.value)
  }
  const schedulePlacements = placements.length ? placements : undefined
  if (!chosen) return { ...clearedScheduleFields(), schedulePlacements }
  let scheduledTime: string | undefined
  if (chosen.period === "day") {
    scheduledTime = sources.find((item) => {
      const day = heldPeriods(item).find((p) => p.period === "day")
      return day?.value === chosen.value && item.scheduledTime
    })?.scheduledTime
  }
  return {
    ...scheduleFieldsForPeriod(chosen.period, chosen.value),
    scheduledTime,
    schedulePlacements,
  }
}

export function retargetLinks(
  links: ItemLink[] | undefined,
  discarded: Set<string>,
  survivorId: string,
  selfId: string = survivorId,
): ItemLink[] {
  const out: ItemLink[] = []
  const seen = new Set<string>()
  for (const link of links ?? []) {
    const targetId = retargetId(link.targetId, discarded, survivorId)
    if (!targetId || targetId === selfId) continue
    const key = `${link.relation}:${targetId}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(targetId === link.targetId ? link : { ...link, targetId })
  }
  return out
}

export function buildMergedItem(items: Task[], plan: ItemMergePlan): Task | null {
  const sources = items.filter((item) => item.id === plan.survivorId || plan.discardedIds.includes(item.id))
  const survivor = sources.find((item) => item.id === plan.survivorId)
  if (!survivor) return null
  const discarded = new Set(plan.discardedIds)
  const others = sources.filter((item) => item.id !== plan.survivorId)
  const keep = plan.keepAllDetails

  const attributes = plan.preserveAttributes
    ? mergeAttributeRecords(sources, plan.survivorId)
    : survivor.attributes
  const itemAttributeDefinitions = plan.preserveAttributes
    ? unionById(sources.flatMap((item) => item.itemAttributeDefinitions ?? []))
    : survivor.itemAttributeDefinitions
  const tags = plan.preserveTags ? uniqueNonEmpty(sources.flatMap((item) => item.tags ?? [])) : survivor.tags
  const links = plan.preserveLinks
    ? retargetLinks(sources.flatMap((item) => item.links ?? []), discarded, plan.survivorId)
    : retargetLinks(survivor.links, discarded, plan.survivorId)
  const subtasks: Subtask[] | undefined = keep
    ? unionById(sources.flatMap((item) => item.subtasks ?? []))
    : survivor.subtasks
  const dependencies = uniqueIds(
    (keep ? sources.flatMap((item) => item.dependencies ?? []) : survivor.dependencies ?? [])
      .map((id) => retargetId(id, discarded, plan.survivorId))
      .filter((id) => id !== plan.survivorId),
  )

  const notes = joinChosenAndOthers(
    plan.notes,
    sources.map((item) => item.notes),
    keep,
  )
  const why = joinChosenAndOthers(
    plan.why,
    sources.map((item) => item.why),
    keep,
  )
  const body = keep
    ? joinChosenAndOthers(survivor.body, sources.map((item) => item.body), true)
    : survivor.body
  const consequences = keep
    ? joinChosenAndOthers(survivor.consequences, sources.map((item) => item.consequences), true)
    : survivor.consequences
  const context = keep
    ? firstHeld([survivor.context, ...others.map((item) => item.context)])
    : survivor.context
  const icon = plan.icon ?? (keep ? firstHeld([survivor.icon, ...others.map((item) => item.icon)]) : survivor.icon)
  const type = keep ? firstHeld([survivor.type, ...others.map((item) => item.type)]) : survivor.type

  const timeLogs: TimeLogEntry[] | undefined = keep
    ? unionById(sources.flatMap((item) => item.timeLogs ?? []))
    : survivor.timeLogs
  const listMembershipExclusions = keep
    ? uniqueIds(sources.flatMap((item) => item.listMembershipExclusions ?? [])).filter(
        (id) => !plan.listIds.includes(id),
      )
    : survivor.listMembershipExclusions

  const merged: Task = {
    ...survivor,
    createdAt:
      earliestDate(...sources.map((item) => safeToDate(item.createdAt) ?? undefined)) ?? survivor.createdAt,
    description: plan.description,
    title: plan.description,
    notes,
    why,
    icon,
    type,
    body,
    consequences,
    context,
    lists: plan.listIds,
    attributes: Object.keys(attributes ?? {}).length ? attributes : survivor.attributes,
    itemAttributeDefinitions: itemAttributeDefinitions?.length
      ? itemAttributeDefinitions
      : survivor.itemAttributeDefinitions,
    tags: tags?.length ? tags : survivor.tags,
    links: links.length ? links : undefined,
    subtasks: subtasks?.length ? subtasks : survivor.subtasks,
    dependencies: dependencies.length ? dependencies : undefined,
    contributesToObjectiveIds: keep
      ? uniqueIds(sources.flatMap((item) => item.contributesToObjectiveIds ?? []))
      : survivor.contributesToObjectiveIds,
    contributesToGoalIds: keep
      ? uniqueIds(sources.flatMap((item) => item.contributesToGoalIds ?? []))
      : survivor.contributesToGoalIds,
    timeLogs: timeLogs?.length ? timeLogs : survivor.timeLogs,
    listMembershipExclusions: listMembershipExclusions?.length
      ? listMembershipExclusions
      : survivor.listMembershipExclusions,
  }

  if (keep) {
    merged.importance = maxHeld(...sources.map((item) => item.importance)) ?? survivor.importance
    merged.urgency = maxHeld(...sources.map((item) => item.urgency)) ?? survivor.urgency
    merged.cognitiveLoad = maxHeld(...sources.map((item) => item.cognitiveLoad)) ?? survivor.cognitiveLoad
    merged.entropy = maxHeld(...sources.map((item) => item.entropy)) ?? survivor.entropy
    merged.rewardValue = maxHeld(...sources.map((item) => item.rewardValue)) ?? survivor.rewardValue
    merged.estimatedDuration =
      maxHeld(...sources.map((item) => item.estimatedDuration)) ?? survivor.estimatedDuration
    const actuals = sources.map((item) => item.actualDuration).filter((n): n is number => typeof n === "number")
    merged.actualDuration = actuals.length ? actuals.reduce((a, b) => a + b, 0) : survivor.actualDuration
    merged.deadline = earliestDate(...sources.map((item) => item.deadline)) ?? survivor.deadline
    Object.assign(merged, settleSchedule(sources, survivor, others))
    merged.completedDate = latestDate(...sources.map((item) => item.completedDate)) ?? survivor.completedDate
    merged.startedAt = earliestDate(...sources.map((item) => item.startedAt)) ?? survivor.startedAt
    merged.minimumChunkSize =
      maxHeld(...sources.map((item) => item.minimumChunkSize)) ?? survivor.minimumChunkSize
    if (sources.some((item) => item.allowPartialCompletion)) merged.allowPartialCompletion = true
    if (sources.some((item) => item.scheduleable === true)) merged.scheduleable = true
    else if (sources.every((item) => item.scheduleable === false)) merged.scheduleable = false
    merged.parallelGroup =
      firstHeld([survivor.parallelGroup, ...others.map((item) => item.parallelGroup)]) ?? survivor.parallelGroup
    if (sources.some((item) => item.riskFlag)) merged.riskFlag = true
    if (sources.some((item) => item.isSummary)) merged.isSummary = true
    merged.pertEstimate =
      firstHeld([survivor.pertEstimate, ...others.map((item) => item.pertEstimate)], (v) => !!v) ??
      survivor.pertEstimate
    const estimateRows: NonNullable<Task["estimates"]> = []
    const seenEstimate = new Set<string>()
    for (const item of sources) {
      for (const row of item.estimates ?? []) {
        const key = `${row.field}:${row.kind}:${row.generatedAt ?? ""}`
        if (seenEstimate.has(key)) continue
        seenEstimate.add(key)
        estimateRows.push(row)
      }
    }
    merged.estimates = estimateRows.length ? estimateRows : survivor.estimates
  }

  return merged
}

export function retargetTasksForItemMerge(tasks: Task[], plan: ItemMergePlan): Task[] {
  const discarded = new Set(plan.discardedIds)
  return tasks.map((task) => {
    if (discarded.has(task.id) || task.id === plan.survivorId) return task
    const dependencies = uniqueIds(
      (task.dependencies ?? []).map((id) => retargetId(id, discarded, plan.survivorId)).filter((id) => id !== task.id),
    )
    const parentRaw = task.parentTaskId ? retargetId(task.parentTaskId, discarded, plan.survivorId) : task.parentTaskId
    const parentTaskId = parentRaw === task.id ? undefined : parentRaw
    const links = retargetLinks(task.links, discarded, plan.survivorId, task.id)
    const depsUnchanged =
      dependencies.length === (task.dependencies ?? []).length &&
      dependencies.every((id, i) => id === (task.dependencies ?? [])[i])
    const linksUnchanged =
      links.length === (task.links ?? []).length &&
      links.every((link, i) => link === (task.links ?? [])[i])
    if (depsUnchanged && parentTaskId === task.parentTaskId && linksUnchanged) return task
    return {
      ...task,
      dependencies: depsUnchanged ? task.dependencies : dependencies,
      parentTaskId,
      links: linksUnchanged ? task.links : links,
    }
  })
}

export function applyItemMerge(tasks: Task[], plan: ItemMergePlan): Task[] {
  const merged = buildMergedItem(tasks, plan)
  if (!merged) return tasks
  const discarded = new Set(plan.discardedIds)
  return retargetTasksForItemMerge(tasks, plan)
    .filter((task) => !discarded.has(task.id))
    .map((task) => (task.id === plan.survivorId ? merged : task))
}
