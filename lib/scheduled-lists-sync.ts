/**
 * lib/scheduled-lists-sync.ts — Keep Next Actions smart & scheduled lists in sync
 */
import { format, startOfWeek } from "date-fns"
import type { Folder, List, SchedulePlacementPeriod, Task } from "@/lib/types"
import {
  formatLocalDateKey,
  formatLocalMonthKey,
  formatWeekRange,
  getWeekString,
  parseLocalDate,
  parseWeekString,
  taskScheduledOnDay,
  taskScheduledInWeek,
  taskScheduledInMonth,
  taskScheduledInYear,
} from "@/lib/date-utils"
import { countsInDone, isNextActionsFolder } from "@/lib/item-utils"
import { getTaskCompletionDate, isClearedFromWork } from "@/lib/completion-status"
import { tasksForLedgerKind, type PeriodLedgerKind } from "@/lib/period-ledger"
import { isPastFunnelPeriod } from "@/lib/scheduling"
import { requestNavigateToList } from "@/lib/app-navigation"
import { useListsUiStore } from "@/lib/lists-ui-store"
import { useTaskStore } from "@/lib/task-store"

export const NA_SMART_DAILY = "na-smart-daily"
export const NA_SMART_WEEKLY = "na-smart-weekly"
export const NA_SMART_MONTHLY = "na-smart-monthly"
export const NA_SMART_COMPLETED = "na-smart-completed"
export const NA_SMART_MISSED = "na-smart-missed"
export const NA_SCHEDULED_FOLDER = "na-scheduled"

type Mutators = {
  lists: List[]
  folders: Folder[]
  addList: (c: List) => void
  updateList: (c: List) => void
  addFolder: (f: Folder) => void
  updateFolder: (f: Folder) => void
  deleteFolder?: (id: string) => void
  deleteList?: (id: string) => void
}

export function findNextActionsFolder(folders: Folder[]): Folder | undefined {
  return folders.find((f) => isNextActionsFolder(f.id, folders))
}

function ensureNextActionsFolder(mut: Mutators): Folder | undefined {
  let na = findNextActionsFolder(mut.folders)
  if (na) return na
  na = {
    id: "folder-next-actions",
    name: "Next Actions",
    createdAt: new Date(),
    listIds: [],
    scheduleable: false,
    color: "#2563eb",
  }
  mut.addFolder(na)
  return na
}

/** Ensure smart to-do list lists live inside Next Actions with dated titles. */
export function syncNextActionsSmartLists(mut: Mutators): void {
  const na = ensureNextActionsFolder(mut)
  if (!na) return

  const now = new Date()
  const specs = [
    { id: NA_SMART_DAILY, name: `To Do - ${format(now, "MMM d, yyyy")}`, color: "#16a34a" },
    {
      id: NA_SMART_WEEKLY,
      name: `To Do - week of ${format(startOfWeek(now, { weekStartsOn: 1 }), "MMM d, yyyy")}`,
      color: "#2563eb",
    },
    { id: NA_SMART_MONTHLY, name: `To Do - ${format(now, "MMMM yyyy")}`, color: "#9333ea" },
  ]
  const archiveSpecs: { id: string; name: string; color: string; autoArchive: "completed" | "missed" }[] = [
    { id: NA_SMART_COMPLETED, name: "Completed", color: "#059669", autoArchive: "completed" },
    { id: NA_SMART_MISSED, name: "Missed Opportunities", color: "#b45309", autoArchive: "missed" },
  ]

  const categoryIdsToAdd: string[] = []

  const ensureInFolder = (id: string) => {
    if (!categoryIdsToAdd.includes(id)) categoryIdsToAdd.push(id)
  }

  for (const spec of specs) {
    const existing = mut.lists.find((c) => c.id === spec.id)
    if (!existing) {
      mut.addList({
        id: spec.id,
        name: spec.name,
        color: spec.color,
        createdAt: new Date(),
        itemLabel: "task",
        scheduleable: false,
      })
      ensureInFolder(spec.id)
    } else if (existing.name !== spec.name) {
      mut.updateList({ ...existing, name: spec.name })
    }
  }

  for (const spec of archiveSpecs) {
    const byId = mut.lists.find((c) => c.id === spec.id)
    const byTag = mut.lists.find((c) => c.autoArchive === spec.autoArchive)
    const byName = mut.lists.find((c) => na.listIds.includes(c.id) && c.name === spec.name)
    const existing = byId || byTag || byName
    if (!existing) {
      mut.addList({
        id: spec.id,
        name: spec.name,
        color: spec.color,
        createdAt: new Date(),
        itemLabel: "task",
        scheduleable: false,
        autoArchive: spec.autoArchive,
      })
      ensureInFolder(spec.id)
      continue
    }
    const patch: Partial<List> = {}
    if (existing.name !== spec.name) patch.name = spec.name
    if (existing.autoArchive !== spec.autoArchive) patch.autoArchive = spec.autoArchive
    if (Object.keys(patch).length > 0) mut.updateList({ ...existing, ...patch })
    ensureInFolder(existing.id)
  }

  if (categoryIdsToAdd.length > 0) {
    const freshNa = findNextActionsFolder(mut.folders)
    if (freshNa) {
      const merged = [...freshNa.listIds]
      for (const id of categoryIdsToAdd) {
        if (!merged.includes(id)) merged.push(id)
      }
      if (merged.length !== freshNa.listIds.length) {
        mut.updateFolder({ ...freshNa, listIds: merged })
      }
    }
  }
}

/** Build year/month/week/day folder ids used under Scheduled. */
export function scheduledPeriodKeys(tasks: Task[]): {
  years: Set<string>
  months: Set<string>
  weeks: Set<string>
  days: Set<string>
} {
  const years = new Set<string>()
  const months = new Set<string>()
  const weeks = new Set<string>()
  const days = new Set<string>()
  const now = new Date()

  for (const t of tasks) {
    if (isClearedFromWork(t)) continue
    if (t.scheduledYear) years.add(t.scheduledYear)
    if (t.scheduledMonth) months.add(t.scheduledMonth)
    if (t.scheduledWeek) weeks.add(t.scheduledWeek)
    if (t.scheduledDate) {
      const d = parseLocalDate(t.scheduledDate)
      if (d) days.add(formatLocalDateKey(d))
    }
    if (t.deadline) {
      const d = parseLocalDate(t.deadline)
      if (d) {
        days.add(formatLocalDateKey(d))
        months.add(formatLocalMonthKey(d))
        weeks.add(getWeekString(d))
        years.add(String(d.getFullYear()))
      }
    }
    if (taskScheduledOnDay(t, now)) days.add(formatLocalDateKey(now))
    if (taskScheduledInWeek(t, getWeekString(now))) weeks.add(getWeekString(now))
    if (taskScheduledInMonth(t, formatLocalMonthKey(now))) months.add(formatLocalMonthKey(now))
  }

  return { years, months, weeks, days }
}

export function isScheduledFolderId(id: string): boolean {
  return id === NA_SCHEDULED_FOLDER || id.startsWith("na-sched-")
}

export function isAutoScheduledPeriodFolder(id: string): boolean {
  return (
    id.startsWith("na-sched-y-") ||
    id.startsWith("na-sched-m-") ||
    id.startsWith("na-sched-w-") ||
    id.startsWith("na-sched-d-")
  )
}

function parseMonthLabel(monthKey: string): string {
  return format(new Date(`${monthKey}-01T12:00:00`), "MMMM yyyy")
}

function parseWeekLabel(weekKey: string): string {
  const start = weekKey.split("_")[0]
  return `week of ${format(new Date(`${start}T12:00:00`), "MMM d, yyyy")}`
}

function parseDayLabel(dayKey: string): string {
  return format(new Date(`${dayKey}T12:00:00`), "EEE MMM d")
}

/** Year and month of a week's Monday. The week folder always hangs here. */
function weekAnchor(weekKey: string): { year: string; month: string } {
  const start = weekKey.split("_")[0] || weekKey
  return { year: start.slice(0, 4), month: start.slice(0, 7) }
}

const PERIOD_MARK: Record<SchedulePlacementPeriod, string> = { year: "y", month: "m", week: "w", day: "d" }
const MARK_PERIOD: Record<string, SchedulePlacementPeriod> = { y: "year", m: "month", w: "week", d: "day" }
const LEDGER_KINDS: PeriodLedgerKind[] = ["todo", "done", "undone"]
const PERIOD_LIST_COLOR: Record<SchedulePlacementPeriod, string> = {
  year: "#64748b",
  month: "#9333ea",
  week: "#2563eb",
  day: "#16a34a",
}
const LEDGER_COLOR: Record<PeriodLedgerKind, string | null> = {
  todo: null,
  done: "#059669",
  undone: "#b45309",
}

/** Stable id for one of the three lists of a period. Week values keep their `_`. */
export function periodLedgerListId(kind: PeriodLedgerKind, period: SchedulePlacementPeriod, value: string): string {
  return `na-${kind}-${PERIOD_MARK[period]}-${value}`
}

/** Stable id for the Lists view of one scheduled period. Week values keep their `_`. */
export function periodTodoListId(period: SchedulePlacementPeriod, value: string): string {
  return periodLedgerListId("todo", period, value)
}

export function scheduledPeriodFolderId(period: SchedulePlacementPeriod, value: string): string {
  return `na-sched-${PERIOD_MARK[period]}-${value}`
}

export function parsePeriodLedgerListId(
  id: string,
): { kind: PeriodLedgerKind; period: SchedulePlacementPeriod; value: string } | null {
  const kind = LEDGER_KINDS.find((item) => id.startsWith(`na-${item}-`))
  if (!kind) return null
  const rest = id.slice(`na-${kind}-`.length)
  const period = MARK_PERIOD[rest[0]]
  if (!period || rest[1] !== "-") return null
  const value = rest.slice(2)
  return value ? { kind, period, value } : null
}

export function parsePeriodTodoListId(id: string): { period: SchedulePlacementPeriod; value: string } | null {
  const parsed = parsePeriodLedgerListId(id)
  if (!parsed || parsed.kind !== "todo") return null
  return { period: parsed.period, value: parsed.value }
}

export function isPeriodLedgerListId(id: string): boolean {
  return parsePeriodLedgerListId(id) !== null
}

export function isPeriodTodoListId(id: string): boolean {
  return parsePeriodTodoListId(id) !== null
}

function periodSpanLabel(period: SchedulePlacementPeriod, value: string): string {
  if (period === "week") {
    const range = parseWeekString(value)
    return range ? formatWeekRange(range.start) : value
  }
  if (period === "day") {
    const date = parseLocalDate(value)
    return date ? `${date.getMonth() + 1}/${date.getDate()}` : value
  }
  if (period === "month") return parseMonthLabel(value)
  return value
}

const LEDGER_TITLE: Record<PeriodLedgerKind, string> = { todo: "To do", done: "Done", undone: "Undone" }
const LEDGER_BLURB: Record<PeriodLedgerKind, string> = {
  todo: "Scheduled for this period. The open To Do list.",
  done: "Completed during this period.",
  undone: "Assigned to this period and still incomplete when the next one started.",
}

/** File-manager name. A week is `To do 8/31-9/6`, the same span the Scheduler card shows. */
export function periodLedgerListName(kind: PeriodLedgerKind, period: SchedulePlacementPeriod, value: string): string {
  return `${LEDGER_TITLE[kind]} ${periodSpanLabel(period, value)}`
}

export function periodTodoListName(period: SchedulePlacementPeriod, value: string): string {
  return periodLedgerListName("todo", period, value)
}

/** Tasks belonging to a scheduled period folder (year/month/week/day). */
export function getTasksForScheduledFolder(tasks: Task[], folderId: string): Task[] {
  if (folderId === NA_SCHEDULED_FOLDER) {
    return tasks.filter(
      (t) =>
        !isClearedFromWork(t) &&
        !!(t.scheduledDate || t.scheduledWeek || t.scheduledMonth || t.scheduledYear || t.deadline),
    )
  }
  if (folderId.startsWith("na-sched-d-")) {
    const day = folderId.slice("na-sched-d-".length)
    const d = new Date(`${day}T12:00:00`)
    return tasks.filter((t) => !isClearedFromWork(t) && taskScheduledOnDay(t, d))
  }
  if (folderId.startsWith("na-sched-w-")) {
    const week = folderId.slice("na-sched-w-".length)
    return tasks.filter((t) => !isClearedFromWork(t) && taskScheduledInWeek(t, week))
  }
  if (folderId.startsWith("na-sched-m-")) {
    const month = folderId.slice("na-sched-m-".length)
    return tasks.filter((t) => !isClearedFromWork(t) && taskScheduledInMonth(t, month))
  }
  if (folderId.startsWith("na-sched-y-")) {
    const year = folderId.slice("na-sched-y-".length)
    return tasks.filter((t) => !isClearedFromWork(t) && taskScheduledInYear(t, year))
  }
  return []
}

function ensureScheduledRoot(mut: Mutators): void {
  const na = ensureNextActionsFolder(mut)
  if (!na) return
  const scheduled = mut.folders.find((f) => f.id === NA_SCHEDULED_FOLDER)
  if (!scheduled) {
    mut.addFolder({
      id: NA_SCHEDULED_FOLDER,
      name: "Scheduled",
      createdAt: new Date(),
      listIds: [],
      parentFolderId: na.id,
      color: "#64748b",
    })
    return
  }
  if (scheduled.parentFolderId !== na.id) mut.updateFolder({ ...scheduled, parentFolderId: na.id })
}

function ensureSchedFolder(mut: Mutators, neededIds: Set<string>, id: string, name: string, parentId: string): void {
  neededIds.add(id)
  const existing = mut.folders.find((f) => f.id === id)
  if (existing) {
    const patch: Partial<Folder> = {}
    if (existing.parentFolderId !== parentId) patch.parentFolderId = parentId
    if (existing.name !== name) patch.name = name
    if (Object.keys(patch).length > 0) mut.updateFolder({ ...existing, ...patch })
    return
  }
  mut.addFolder({
    id,
    name,
    createdAt: new Date(),
    listIds: [],
    parentFolderId: parentId,
    color: "#94a3b8",
  })
}

function ledgerKindsForPeriod(period: SchedulePlacementPeriod, value: string, now: Date): PeriodLedgerKind[] {
  return isPastFunnelPeriod(period, value, now) ? ["todo", "done", "undone"] : ["todo", "done"]
}

function filePeriodLedgerLists(
  mut: Mutators,
  neededListIds: Set<string>,
  period: SchedulePlacementPeriod,
  value: string,
  now: Date,
): void {
  const ids: string[] = []
  for (const kind of ledgerKindsForPeriod(period, value, now)) {
    const id = periodLedgerListId(kind, period, value)
    neededListIds.add(id)
    ids.push(id)
    const name = periodLedgerListName(kind, period, value)
    const existing = mut.lists.find((list) => list.id === id)
    if (!existing) {
      mut.addList({
        id,
        name,
        color: LEDGER_COLOR[kind] ?? PERIOD_LIST_COLOR[period],
        createdAt: new Date(),
        itemLabel: "task",
        scheduleable: false,
        description: LEDGER_BLURB[kind],
      })
    } else if (existing.name !== name) {
      mut.updateList({ ...existing, name })
    }
  }
  const folder = mut.folders.find((f) => f.id === scheduledPeriodFolderId(period, value))
  if (!folder) return
  const missing = ids.filter((id) => !folder.listIds.includes(id))
  if (missing.length > 0) mut.updateFolder({ ...folder, listIds: [...folder.listIds, ...missing] })
}

/**
 * Create the Scheduled folder chain and the period's To do list.
 * An empty period still gets a list, so a card can open it before any item is scheduled.
 */
export function materializePeriodTodoList(
  mut: Mutators,
  period: SchedulePlacementPeriod,
  value: string,
  neededFolderIds: Set<string> = new Set<string>([NA_SCHEDULED_FOLDER]),
  neededListIds: Set<string> = new Set<string>(),
): string {
  ensureScheduledRoot(mut)
  neededFolderIds.add(NA_SCHEDULED_FOLDER)
  const now = new Date()
  const file = (grain: SchedulePlacementPeriod, key: string) =>
    filePeriodLedgerLists(mut, neededListIds, grain, key, now)
  if (period === "year") {
    ensureSchedFolder(mut, neededFolderIds, `na-sched-y-${value}`, value, NA_SCHEDULED_FOLDER)
    file("year", value)
  } else if (period === "month") {
    const year = value.slice(0, 4)
    ensureSchedFolder(mut, neededFolderIds, `na-sched-y-${year}`, year, NA_SCHEDULED_FOLDER)
    ensureSchedFolder(mut, neededFolderIds, `na-sched-m-${value}`, parseMonthLabel(value), `na-sched-y-${year}`)
    file("year", year)
    file("month", value)
  } else if (period === "week") {
    const { year, month } = weekAnchor(value)
    ensureSchedFolder(mut, neededFolderIds, `na-sched-y-${year}`, year, NA_SCHEDULED_FOLDER)
    ensureSchedFolder(mut, neededFolderIds, `na-sched-m-${month}`, parseMonthLabel(month), `na-sched-y-${year}`)
    ensureSchedFolder(mut, neededFolderIds, `na-sched-w-${value}`, parseWeekLabel(value), `na-sched-m-${month}`)
    file("year", year)
    file("month", month)
    file("week", value)
  } else {
    const year = value.slice(0, 4)
    const month = value.slice(0, 7)
    const week = getWeekString(new Date(`${value}T12:00:00`))
    const anchor = weekAnchor(week)
    ensureSchedFolder(mut, neededFolderIds, `na-sched-y-${year}`, year, NA_SCHEDULED_FOLDER)
    ensureSchedFolder(mut, neededFolderIds, `na-sched-m-${month}`, parseMonthLabel(month), `na-sched-y-${year}`)
    if (anchor.year !== year) {
      ensureSchedFolder(mut, neededFolderIds, `na-sched-y-${anchor.year}`, anchor.year, NA_SCHEDULED_FOLDER)
    }
    if (anchor.month !== month) {
      ensureSchedFolder(mut, neededFolderIds, `na-sched-m-${anchor.month}`, parseMonthLabel(anchor.month), `na-sched-y-${anchor.year}`)
    }
    // The week lives under its Monday, including when this day falls in the next month.
    // Parenting it under the day moved the folder back and forth on every sync.
    ensureSchedFolder(mut, neededFolderIds, `na-sched-w-${week}`, parseWeekLabel(week), `na-sched-m-${anchor.month}`)
    ensureSchedFolder(mut, neededFolderIds, `na-sched-d-${value}`, parseDayLabel(value), `na-sched-w-${week}`)
    file("year", year)
    if (anchor.year !== year) file("year", anchor.year)
    file("month", month)
    if (anchor.month !== month) file("month", anchor.month)
    file("week", week)
    file("day", value)
  }
  return periodTodoListId(period, value)
}

function rememberPeriodLedgerKeys(
  tasks: Task[],
  folders: Folder[],
  keys: { years: Set<string>; months: Set<string>; weeks: Set<string>; days: Set<string> },
): void {
  const add = (period: SchedulePlacementPeriod, value: string) => {
    if (!value) return
    if (period === "year") keys.years.add(value)
    else if (period === "month") keys.months.add(value)
    else if (period === "week") keys.weeks.add(value)
    else keys.days.add(value)
  }
  for (const task of tasks) {
    for (const placement of task.schedulePlacements ?? []) {
      if (placement.resolved === "discarded") continue
      add(placement.period, placement.value)
    }
    if (!countsInDone(task, folders)) continue
    const at = getTaskCompletionDate(task)
    if (!at) continue
    add("day", formatLocalDateKey(at))
    add("week", getWeekString(at))
    add("month", formatLocalMonthKey(at))
    add("year", String(at.getFullYear()))
  }
}

function rememberOpenedPeriodLists(
  mut: Mutators,
  keys: { years: Set<string>; months: Set<string>; weeks: Set<string>; days: Set<string> },
): void {
  for (const list of mut.lists) {
    const parsed = parsePeriodLedgerListId(list.id)
    if (!parsed) continue
    if (parsed.period === "year") keys.years.add(parsed.value)
    else if (parsed.period === "month") keys.months.add(parsed.value)
    else if (parsed.period === "week") keys.weeks.add(parsed.value)
    else keys.days.add(parsed.value)
  }
}

export function syncScheduledFolderHierarchy(tasks: Task[], mut: Mutators): void {
  const na = ensureNextActionsFolder(mut)
  if (!na) return
  ensureScheduledRoot(mut)

  const keys = scheduledPeriodKeys(tasks)
  rememberPeriodLedgerKeys(tasks, mut.folders, keys)
  rememberOpenedPeriodLists(mut, keys)
  const neededIds = new Set<string>([NA_SCHEDULED_FOLDER])
  const neededListIds = new Set<string>()

  for (const year of keys.years) materializePeriodTodoList(mut, "year", year, neededIds, neededListIds)
  for (const month of keys.months) materializePeriodTodoList(mut, "month", month, neededIds, neededListIds)
  for (const week of keys.weeks) materializePeriodTodoList(mut, "week", week, neededIds, neededListIds)
  for (const day of keys.days) materializePeriodTodoList(mut, "day", day, neededIds, neededListIds)

  if (mut.deleteFolder) {
    for (const folder of [...mut.folders]) {
      if (isAutoScheduledPeriodFolder(folder.id) && !neededIds.has(folder.id)) {
        mut.deleteFolder(folder.id)
      }
    }
  }

  if (mut.deleteList) {
    for (const list of [...mut.lists]) {
      if (isPeriodLedgerListId(list.id) && !neededListIds.has(list.id)) mut.deleteList(list.id)
    }
    for (const folder of [...mut.folders]) {
      const listIds = folder.listIds.filter((id) => !isPeriodLedgerListId(id) || neededListIds.has(id))
      if (listIds.length !== folder.listIds.length) mut.updateFolder({ ...folder, listIds })
    }
  }
}

export function isNaArchiveCategoryId(id: string, lists?: List[]): boolean {
  if (id === NA_SMART_COMPLETED || id === NA_SMART_MISSED) return true
  return !!lists?.some((l) => l.id === id && (l.autoArchive === "completed" || l.autoArchive === "missed"))
}

export function isNaPeriodSmartCategoryId(id: string): boolean {
  return id === NA_SMART_DAILY || id === NA_SMART_WEEKLY || id === NA_SMART_MONTHLY
}

export function isNaSmartCategoryId(id: string, lists?: List[]): boolean {
  return isNaPeriodSmartCategoryId(id) || isPeriodLedgerListId(id) || isNaArchiveCategoryId(id, lists)
}

/** Items on a To do, Done, or Undone period list. Same sets as Home → To Do. */
export function tasksForPeriodLedgerList(
  id: string,
  tasks: Task[],
  folders: Folder[] = [],
  now: Date = new Date(),
): Task[] {
  const parsed = parsePeriodLedgerListId(id)
  if (!parsed) return []
  return tasksForLedgerKind(tasks, parsed.kind, parsed.period, parsed.value, folders, now)
}

/** Open work for one period To do list. */
export function tasksForPeriodTodoList(id: string, tasks: Task[], folders: Folder[] = []): Task[] {
  return tasksForPeriodLedgerList(id, tasks, folders)
}

export function naSmartIdToPeriod(id: string): "daily" | "weekly" | "monthly" | null {
  if (id === NA_SMART_DAILY) return "daily"
  if (id === NA_SMART_WEEKLY) return "weekly"
  if (id === NA_SMART_MONTHLY) return "monthly"
  return null
}

/** Live rows for a Next Actions period To Do smart list. Archives use membership (`tasksForArchiveList`). */
export function tasksForNaSmartList(id: string, tasks: Task[], now = new Date()): Task[] {
  const period = naSmartIdToPeriod(id)
  if (period === "daily") return tasks.filter((t) => !isClearedFromWork(t) && taskScheduledOnDay(t, now))
  if (period === "weekly") return tasks.filter((t) => !isClearedFromWork(t) && taskScheduledInWeek(t, getWeekString(now)))
  if (period === "monthly") {
    return tasks.filter((t) => !isClearedFromWork(t) && taskScheduledInMonth(t, format(now, "yyyy-MM")))
  }
  return []
}

function liveScheduleMutator(): Mutators {
  const snap = () => useTaskStore.getState()
  return {
    get lists() {
      return snap().lists
    },
    get folders() {
      return snap().folders
    },
    addList: (list) => {
      if (snap().lists.some((item) => item.id === list.id)) return
      snap().addList(list)
    },
    updateList: (list) => snap().updateList(list),
    addFolder: (folder) => {
      if (snap().folders.some((item) => item.id === folder.id)) return
      snap().addFolder(folder)
    },
    updateFolder: (folder) => snap().updateFolder(folder),
  }
}

/**
 * Open Lists on this period's To do list, in the file manager's List view,
 * showing the full default list of items scheduled for that span.
 */
export function openPeriodTodoList(period: SchedulePlacementPeriod, value: string): void {
  const listId = materializePeriodTodoList(liveScheduleMutator(), period, value)
  useListsUiStore.getState().setFolderView("list")
  useListsUiStore.getState().setListDisplay(listId, "default")
  requestNavigateToList(listId, useTaskStore.getState().folders)
}
