/**
 * lib/item-utils.ts — Item / task helpers
 *
 * Shared logic for distinguishing "next actions" items (lists in the Next Actions
 * folder tree) from plain list items, building minimal vs full task records,
 * and filtering planned-task sidebars in Plan views.
 */
import type { Task, ItemRecord, List, Folder, AttributeValue, ItemTypeDefinition, ItemTypeRule } from "@/lib/types"
import { composeListDefaults, getItemType, gatherItemRules, applyRules, type ItemLike } from "@/lib/item-types"
import {
  getWeekString,
  parseLocalDate,
  parseWeekString,
  taskScheduledOnDay,
  sameCalendarDay,
  type SchedulableFields,
} from "@/lib/date-utils"
import { normalizeAttributeType } from "@/lib/attribute-utils"
import type { AttributeDefinition } from "@/lib/types"
import { computeFormulaValue } from "@/lib/formula"
import { isClearedFromWork } from "@/lib/completion-status"

/**
 * Anything that carries a name. Deliberately structural rather than `Item` so
 * the accessors below work on `Task`, `Item`, `ItemLike`, workflow snapshots,
 * and plain records read back out of a backup file.
 */
export interface TitledRecord {
  title?: string
  description?: string
}

/**
 * **The one answer to "what is this called."**
 *
 * `Item.title` is the field of record; `Task.description` is the v1 name kept
 * as a mirror while persisted vaults and backups still carry it
 * (`docs/CANONICAL_FIELDS.md`). Read through here rather than reaching for
 * either field, so that when `description` finally retires, nothing has to be
 * re-audited — and so the two spellings cannot disagree about which one wins.
 *
 * Returns `""` when the record has no name at all; callers that need to *show*
 * something want {@link itemTitleOrUntitled}.
 */
export function itemTitle(item: TitledRecord | null | undefined): string {
  if (!item) return ""
  const title = typeof item.title === "string" ? item.title.trim() : ""
  if (title) return title
  return typeof item.description === "string" ? item.description.trim() : ""
}

/** {@link itemTitle}, with a label for records that never got a name. */
export function itemTitleOrUntitled(
  item: TitledRecord | null | undefined,
  fallback = "Untitled",
): string {
  return itemTitle(item) || fallback
}

/**
 * The write-side twin of {@link itemTitle}: keep `title` filled in and current
 * without ever touching `description`.
 *
 * Two things are true at once. Readers now prefer `title`, and several callers
 * still rename an item by writing `description` alone (`renameDocument` is the
 * plainest). Left as-is, a rename would show the old name. But `description` is
 * not always a mirror — a parked Apple Note keeps its whole body there — so
 * blindly following it would turn a note's name into its body.
 *
 * The test that separates those two cases is whether the pair *was* in lockstep
 * before the write. If it was, `description` was the name and the edit is a
 * rename. If it was not, this record is using the two fields for two different
 * things and neither is ours to rewrite.
 */
export function syncTitleFromDescription<T extends TitledRecord>(
  next: T,
  previous?: TitledRecord | null,
): T {
  const description = typeof next.description === "string" ? next.description.trim() : ""
  if (!description) return next

  const title = typeof next.title === "string" ? next.title.trim() : ""
  if (!title) return { ...next, title: description }
  if (!previous) return next

  const wasTitle = typeof previous.title === "string" ? previous.title.trim() : ""
  const wasDescription = typeof previous.description === "string" ? previous.description.trim() : ""
  const renamedThroughTheMirror =
    wasTitle === wasDescription && title === wasTitle && description !== wasDescription
  return renamedThroughTheMirror ? { ...next, title: description } : next
}

const NEXT_ACTIONS_RE = /next\s*actions?/i

export function isNextActionsFolder(folderId: string, folders: Folder[]): boolean {
  const folder = folders.find((f) => f.id === folderId)
  if (!folder) return false
  if (NEXT_ACTIONS_RE.test(folder.name)) return true
  if (folder.parentFolderId) return isNextActionsFolder(folder.parentFolderId, folders)
  return false
}

export function folderForCategory(categoryId: string, folders: Folder[]): Folder | undefined {
  return folders.find((f) => f.listIds.includes(categoryId))
}

export function listIsNextActions(categoryId: string, folders: Folder[]): boolean {
  const folder = folderForCategory(categoryId, folders)
  return folder ? isNextActionsFolder(folder.id, folders) : false
}

export function taskIsNextAction(item: ItemRecord, folders: Folder[]): boolean {
  return (item.lists ?? []).some((cid) => listIsNextActions(cid, folders))
}

/**
 * Whether an item is of the built-in "task" item type — which is what grants the
 * hardcoded Task surface (scheduling, dependencies, subtasks, analysis, time).
 *
 * Being in the Next Actions folder (or any list within it) *makes* an item a
 * task. Otherwise we honor the item's explicit `type` — missing/unknown types
 * are generic items, not tasks.
 */
export function isTaskItem(item: ItemRecord, folders: Folder[]): boolean {
  if (taskIsNextAction(item, folders)) return true
  return item.type === "task"
}

/** Generated implied-action rows that belong in Done even if they aren't Tasks. */
export function isLoggedAction(item: Pick<ItemRecord, "type" | "loggedAction">): boolean {
  return item.loggedAction === true || item.type === "action"
}

/** Completions that should appear in Home / To-Do Done for the period. */
export function countsInDone(item: ItemRecord, folders: Folder[]): boolean {
  if (!item.completed) return false
  return isTaskItem(item, folders) || isLoggedAction(item)
}

/** Which explicit schedule field is set (most specific stored assignment). */
export function getStoredScheduleLevel(task: SchedulableFields): "day" | "week" | "month" | "year" | null {
  if (task.scheduledDate) return "day"
  if (task.scheduledWeek) return "week"
  if (task.scheduledMonth) return "month"
  if (task.scheduledYear) return "year"
  return null
}

/** Scheduler "Always" overview: match only the task's stored schedule level. */
export function taskBelongsInOverviewBox(
  task: Task,
  period: "year" | "month" | "week" | "day",
  value: string,
): boolean {
  const level = getStoredScheduleLevel(task)
  if (!level) return false
  switch (period) {
    case "day":
      return level === "day" && taskScheduledOnDay(task, value)
    case "week":
      return level === "week" && task.scheduledWeek === value
    case "month":
      return level === "month" && task.scheduledMonth === value
    case "year":
      return level === "year" && task.scheduledYear === value
    default:
      return false
  }
}

export function taskHasFinerScheduleThanMonth(task: Task): boolean {
  return !!(task.scheduledWeek || task.scheduledDate)
}

export function taskHasDaySchedule(task: Task): boolean {
  return !!(task.scheduledDate && task.scheduledTime)
}

/** Month sidebar: scheduled for this month only (not also assigned to a week/day). */
export function isMonthOnlyPlanned(task: Task, monthKey: string): boolean {
  if (isClearedFromWork(task)) return false
  if (taskHasFinerScheduleThanMonth(task)) return false
  if (task.scheduledMonth === monthKey) return true
  const deadline = parseLocalDate(task.deadline)
  if (deadline && !task.scheduledMonth && formatLocalMonth(deadline) === monthKey) return true
  return false
}

function formatLocalMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

/** Week sidebar: scheduled for this week only (not assigned to a specific day/time). */
export function isWeekOnlyPlanned(task: Task, weekKey: string): boolean {
  if (isClearedFromWork(task)) return false
  if (task.scheduledDate) return false
  if (task.scheduledWeek === weekKey) return true
  const deadline = parseLocalDate(task.deadline)
  if (deadline && !task.scheduledWeek && !task.scheduledDate && getWeekString(deadline) === weekKey) return true
  return false
}

/** Day sidebar: on today's to-do but not placed on the time grid yet. */
export function isDayUnscheduledPlanned(task: Task, date: Date): boolean {
  if (isClearedFromWork(task)) return false
  if (taskHasDaySchedule(task)) return false
  if (task.scheduledDate && sameCalendarDay(task.scheduledDate, date)) return true
  if (!task.scheduledDate && task.deadline && sameCalendarDay(task.deadline, date)) return true
  return false
}

/** Minimal list item — no next-actions scheduling defaults. One Item record (`type: "item"`). */
export function createListItem(description: string, listIds: string[] = []): ItemRecord {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description,
    stage: listIds.length ? "clarified" : "list",
    // Unified Item base fields (spec §5)
    type: "item",
    title: description,
    tags: [],
    links: [],
    createdAt: new Date(),
    completed: false,
    lists: listIds,
    subtasks: [],
    rewardValue: 1,
  }
}

/** Next-actions item with scheduling / priority defaults. Task-the-kind (`type: "task"`). */
export function createNextActionItem(description: string, listIds: string[] = []): ItemRecord {
  return {
    ...createListItem(description, listIds),
    type: "task",
    stage: "clarified",
    estimatedDuration: 30,
    cognitiveLoad: 2,
    urgency: 3,
    importance: 3,
    dependencies: [],
    context: "@general",
    entropy: 0.5,
    rewardValue: 1,
    allowPartialCompletion: false,
    minimumChunkSize: 15,
  }
}

/** Seed attributes from list defaults when adding to a category. */
export function withCategoryDefaults(
  item: ItemRecord,
  list: List | undefined,
): ItemRecord {
  if (!list?.defaultAttributeValues) return item
  return {
    ...item,
    attributes: { ...list.defaultAttributeValues, ...(item.attributes || {}) },
  }
}

/**
 * Run the rules that apply to an item (its item type's rules plus the rules of
 * every list it belongs to) for a given trigger, returning the item with rule
 * actions applied. Validation errors are intentionally ignored here — the store
 * persists state, it does not block edits. Pure (no store reads) so it stays
 * testable; callers pass the current `categories` and `types`.
 */
export function applyItemRules(
  item: ItemRecord,
  lists: List[],
  types: ItemTypeDefinition[],
  trigger: ItemTypeRule["trigger"],
  previous?: ItemRecord,
): ItemRecord {
  const memberLists = (item.lists ?? [])
    .map((id) => lists.find((c) => c.id === id))
    .filter((c): c is List => !!c)
  const type = getItemType(types, item.type)
  const rules = gatherItemRules(type, memberLists, types)
  if (rules.length === 0) return item
  return applyRules(
    item as unknown as ItemLike,
    rules,
    trigger,
    previous as unknown as ItemLike | undefined,
  ).item as unknown as ItemRecord
}

/**
 * Apply a list's *membership* to an item: adopt the list's item type (unless the
 * item is already a non-task type) and seed the list's composed default values
 * (item type defaults + list defaults) without overwriting values already set.
 *
 * Used when creating an item in a list or dragging an item into a new list, so
 * e.g. dropping a book onto "Books to Buy" adds that list's `cost`/`purchased`
 * defaults automatically.
 */
export function withListMembership(
  item: ItemRecord,
  list: List | undefined,
  types: ItemTypeDefinition[] = [],
): ItemRecord {
  if (!list) return item
  let next = item
  if (list.itemTypeId && (!next.type || next.type === "task" || next.type === "item")) {
    next = { ...next, type: list.itemTypeId }
  }
  const defaults = composeListDefaults(list, types)
  if (Object.keys(defaults).length > 0) {
    next = { ...next, attributes: { ...defaults, ...(next.attributes || {}) } }
  }
  return next
}

/**
 * Beat-the-clock "standard time" multiplier (Brain2 #28 — Gantt task-and-bonus).
 *
 * Finishing a task under its estimated ("standard") time earns up to a ~20%
 * point bonus, scaled by how far under you came in. Pure + deterministic:
 *   - returns 1 (no bonus) when either duration is missing/invalid, or when the
 *     actual time met/exceeded the estimate (default behavior is unchanged);
 *   - otherwise 1 + 0.2 · fractionSaved, where fractionSaved = (est-act)/est
 *     clamped to 0..1, so a task done in half the time → 1.10, instant → 1.20.
 */
export const MAX_BEAT_THE_CLOCK_BONUS = 0.2

export function beatTheClockMultiplier(
  estimatedDuration?: number,
  actualDuration?: number,
): number {
  if (
    estimatedDuration === undefined ||
    actualDuration === undefined ||
    !Number.isFinite(estimatedDuration) ||
    !Number.isFinite(actualDuration) ||
    estimatedDuration <= 0 ||
    actualDuration < 0
  ) {
    return 1
  }
  if (actualDuration >= estimatedDuration) return 1
  const fractionSaved = (estimatedDuration - actualDuration) / estimatedDuration
  const clamped = Math.min(1, Math.max(0, fractionSaved))
  return 1 + MAX_BEAT_THE_CLOCK_BONUS * clamped
}

/** Points awarded on completion: default 1, overridable via list "Points" attribute or rewardValue. */
export function resolveCompletionPoints(
  task: Task,
  lists: List[],
  folders: Folder[],
): number {
  const isNextAction = taskIsNextAction(task, folders)
  let base = 1
  let resolvedFromPointsAttr = false

  const taskCategories = (task.lists ?? [])
    .map((id) => lists.find((c) => c.id === id))
    .filter(Boolean) as List[]

  // Union of every attribute definition the item inherits from its lists. Needed
  // so a formula "Points" attribute can resolve its sibling references (the
  // completion-tier thresholds / current value).
  const allDefs = new Map<string, AttributeDefinition>()
  for (const cat of taskCategories) {
    for (const def of cat.itemAttributes ?? []) {
      if (!allDefs.has(def.id)) allDefs.set(def.id, def)
    }
  }

  const isPointsAttr = (a: AttributeDefinition) => a.name.trim().toLowerCase() === "points"

  for (const def of allDefs.values()) {
    if (!isPointsAttr(def)) continue
    const type = normalizeAttributeType(def.type)

    if (type === "formula") {
      // Evaluate the points formula against the item's stored attribute values
      // (e.g. the completion-tier ladder). Blank/invalid → fall back to base 1.
      const result = computeFormulaValue(def, task.attributes ?? {}, allDefs)
      if (!result.error && result.value !== null && result.value >= 0) {
        base = result.value
        resolvedFromPointsAttr = true
        break
      }
      continue
    }

    if (type === "number") {
      const raw = task.attributes?.[def.id]
      if (raw !== undefined && raw !== null && raw !== "") {
        const n = typeof raw === "number" ? raw : Number(raw)
        if (!Number.isNaN(n) && n >= 0) {
          base = n
          resolvedFromPointsAttr = true
          break
        }
      }
    }
  }

  // Non-next-action items may also set rewardValue directly (including 0).
  if (!resolvedFromPointsAttr && !isNextAction && task.rewardValue !== undefined && task.rewardValue !== null) {
    base = task.rewardValue
  }

  if (isNextAction) {
    // Reward beating the standard time. No durations → multiplier 1 → base only.
    const multiplier = beatTheClockMultiplier(task.estimatedDuration, task.actualDuration)
    return Math.round(base * multiplier * 100) / 100
  }
  return base
}

/** Singular label for items in a list (e.g. task, book, habit). */
export function getItemLabel(
  list: List | undefined,
  folders: Folder[],
  categoryId?: string,
): string {
  if (list?.itemLabel?.trim()) return list.itemLabel.trim()
  if (categoryId && listIsNextActions(categoryId, folders)) return "task"
  if (list && listIsNextActions(list.id, folders)) return "task"
  return "item"
}

export function capitalizeLabel(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Push a task forward one day/week/month and increment its pushed counter. */
export function pushTaskOnePeriod(
  task: Task,
  period: "day" | "week" | "month",
  refDate: Date = new Date(),
): Partial<Task> {
  const cleared = {
    scheduledDate: undefined,
    scheduledWeek: undefined,
    scheduledMonth: undefined,
    scheduledYear: undefined,
  }

  switch (period) {
    case "day": {
      const base = parseLocalDate(task.scheduledDate) ?? refDate
      const next = new Date(base)
      next.setDate(next.getDate() + 1)
      next.setHours(0, 0, 0, 0)
      return {
        ...cleared,
        scheduledDate: next,
        daysPushed: (task.daysPushed ?? 0) + 1,
        hiddenFromTodo: false,
      }
    }
    case "week": {
      const base = task.scheduledWeek
        ? (parseWeekString(task.scheduledWeek)?.start ?? refDate)
        : (parseLocalDate(task.scheduledDate) ?? refDate)
      const next = new Date(base)
      next.setDate(next.getDate() + 7)
      return {
        ...cleared,
        scheduledWeek: getWeekString(next),
        weeksPushed: (task.weeksPushed ?? 0) + 1,
        hiddenFromTodo: false,
      }
    }
    case "month": {
      const base = task.scheduledMonth
        ? (parseLocalDate(`${task.scheduledMonth}-01`) ?? refDate)
        : (parseLocalDate(task.scheduledDate) ?? refDate)
      const next = new Date(base.getFullYear(), base.getMonth() + 1, 1)
      return {
        ...cleared,
        scheduledMonth: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`,
        monthsPushed: (task.monthsPushed ?? 0) + 1,
        hiddenFromTodo: false,
      }
    }
  }
}
