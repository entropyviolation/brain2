/**
 * lib/item-utils.ts — Item / task helpers
 *
 * Shared logic for distinguishing "next actions" items (lists in the Next Actions
 * folder tree) from plain list items, building minimal vs full task records,
 * and filtering planned-task sidebars in Plan views.
 */
import type { Task, List, Folder, AttributeValue, ItemTypeDefinition, ItemTypeRule } from "@/lib/types"
import { composeListDefaults, getItemType, gatherItemRules, applyRules, type ItemLike } from "@/lib/item-types"
import {
  formatDateKey,
  getWeekString,
  parseLocalDate,
  parseWeekString,
  taskScheduledOnDay,
  safeToDate,
  type SchedulableFields,
} from "@/lib/date-utils"
import { normalizeAttributeType } from "@/lib/attribute-utils"
import type { AttributeDefinition } from "@/lib/types"
import { computeFormulaValue } from "@/lib/formula"

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

export function taskIsNextAction(task: Task, folders: Folder[]): boolean {
  return (task.lists ?? []).some((cid) => listIsNextActions(cid, folders))
}

/**
 * Whether an item is of the built-in "task" item type — which is what grants the
 * task attributes/features (scheduling, dependencies, subtasks, analysis, time).
 *
 * Being in the Next Actions folder (or any list within it) *makes* an item a
 * task: next-action membership implies the task item type. Otherwise we honor
 * the item's explicit `type` (defaults to "task" for plain items).
 */
export function isTaskItem(task: Task, folders: Folder[]): boolean {
  if (taskIsNextAction(task, folders)) return true
  return (task.type ?? "task") === "task"
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
  if (task.completed) return false
  if (taskHasFinerScheduleThanMonth(task)) return false
  if (task.scheduledMonth === monthKey) return true
  const deadline = safeToDate(task.deadline)
  if (deadline && !task.scheduledMonth && deadline.toISOString().slice(0, 7) === monthKey) return true
  return false
}

/** Week sidebar: scheduled for this week only (not assigned to a specific day/time). */
export function isWeekOnlyPlanned(task: Task, weekKey: string): boolean {
  if (task.completed) return false
  if (task.scheduledDate) return false
  if (task.scheduledWeek === weekKey) return true
  const deadline = safeToDate(task.deadline)
  if (deadline && !task.scheduledWeek && !task.scheduledDate && getWeekString(deadline) === weekKey) return true
  return false
}

/** Day sidebar: on today's to-do but not placed on the time grid yet. */
export function isDayUnscheduledPlanned(task: Task, date: Date): boolean {
  if (task.completed) return false
  if (taskHasDaySchedule(task)) return false
  const dayKey = formatDateKey(date)
  if (task.scheduledDate) {
    const d = safeToDate(task.scheduledDate)
    if (d && formatDateKey(d) === dayKey) return true
  }
  const deadline = safeToDate(task.deadline)
  if (deadline && formatDateKey(deadline) === dayKey) return true
  return false
}

/** Minimal list item — no next-actions scheduling defaults. */
export function createListItem(description: string, listIds: string[] = []): Task {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description,
    stage: listIds.length ? "clarified" : "list",
    // Unified Item base fields (spec §5)
    type: "task",
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

/** Next-actions item with scheduling / priority defaults. */
export function createNextActionItem(description: string, listIds: string[] = []): Task {
  return {
    ...createListItem(description, listIds),
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
  task: Task,
  list: List | undefined,
): Task {
  if (!list?.defaultAttributeValues) return task
  return {
    ...task,
    attributes: { ...list.defaultAttributeValues, ...(task.attributes || {}) },
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
  task: Task,
  lists: List[],
  types: ItemTypeDefinition[],
  trigger: ItemTypeRule["trigger"],
): Task {
  const memberLists = (task.lists ?? [])
    .map((id) => lists.find((c) => c.id === id))
    .filter((c): c is List => !!c)
  const type = getItemType(types, task.type)
  const rules = gatherItemRules(type, memberLists, types)
  if (rules.length === 0) return task
  // Task lacks the open index signature ItemLike uses for generic field access;
  // the rule engine only reads/writes known fields, so this cast is safe.
  return applyRules(task as unknown as ItemLike, rules, trigger).item as unknown as Task
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
  task: Task,
  list: List | undefined,
  types: ItemTypeDefinition[] = [],
): Task {
  if (!list) return task
  let next = task
  if (list.itemTypeId && (!next.type || next.type === "task")) {
    next = { ...next, type: list.itemTypeId }
  }
  const defaults = composeListDefaults(list, types)
  if (Object.keys(defaults).length > 0) {
    next = { ...next, attributes: { ...defaults, ...(next.attributes || {}) } }
  }
  return next
}

export function isTaskScheduleable(
  task: Task,
  lists: List[],
  folders: Folder[],
): boolean {
  if (task.scheduleable === false) return false
  if (task.scheduleable === true) return true
  const cats = (task.lists ?? [])
    .map((id) => lists.find((c) => c.id === id))
    .filter(Boolean) as List[]
  if (cats.some((c) => c.scheduleable === false)) return false
  if (cats.some((c) => c.scheduleable !== false)) return true
  return taskIsNextAction(task, folders)
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
