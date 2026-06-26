/**
 * lib/scheduled-lists-sync.ts — Keep Next Actions smart & scheduled lists in sync
 */
import { format, startOfWeek } from "date-fns"
import type { Task, List, Folder } from "@/lib/types"
import {
  getWeekString,
  taskScheduledOnDay,
  taskScheduledInWeek,
  taskScheduledInMonth,
  taskScheduledInYear,
} from "@/lib/date-utils"
import { isNextActionsFolder } from "@/lib/item-utils"

export const NA_SMART_DAILY = "na-smart-daily"
export const NA_SMART_WEEKLY = "na-smart-weekly"
export const NA_SMART_MONTHLY = "na-smart-monthly"
export const NA_SCHEDULED_FOLDER = "na-scheduled"

type Mutators = {
  lists: List[]
  folders: Folder[]
  addList: (c: List) => void
  updateList: (c: List) => void
  addFolder: (f: Folder) => void
  updateFolder: (f: Folder) => void
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
    scheduleable: true,
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

  const categoryIdsToAdd: string[] = []

  for (const spec of specs) {
    const existing = mut.lists.find((c) => c.id === spec.id)
    if (!existing) {
      mut.addList({
        id: spec.id,
        name: spec.name,
        color: spec.color,
        createdAt: new Date(),
        itemLabel: "task",
        scheduleable: true,
      })
      categoryIdsToAdd.push(spec.id)
    } else if (existing.name !== spec.name) {
      mut.updateList({ ...existing, name: spec.name })
    }
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
    if (t.completed) continue
    if (t.scheduledYear) years.add(t.scheduledYear)
    if (t.scheduledMonth) months.add(t.scheduledMonth)
    if (t.scheduledWeek) weeks.add(t.scheduledWeek)
    if (t.scheduledDate) {
      const d = t.scheduledDate instanceof Date ? t.scheduledDate : new Date(t.scheduledDate)
      if (!isNaN(d.getTime())) days.add(format(d, "yyyy-MM-dd"))
    }
    if (t.deadline) {
      const d = t.deadline instanceof Date ? t.deadline : new Date(t.deadline)
      if (!isNaN(d.getTime())) {
        days.add(format(d, "yyyy-MM-dd"))
        months.add(format(d, "yyyy-MM"))
        weeks.add(getWeekString(d))
        years.add(String(d.getFullYear()))
      }
    }
    if (taskScheduledOnDay(t, now)) days.add(format(now, "yyyy-MM-dd"))
    if (taskScheduledInWeek(t, getWeekString(now))) weeks.add(getWeekString(now))
    if (taskScheduledInMonth(t, format(now, "yyyy-MM"))) months.add(format(now, "yyyy-MM"))
  }

  return { years, months, weeks, days }
}

export function isScheduledFolderId(id: string): boolean {
  return id === NA_SCHEDULED_FOLDER || id.startsWith("na-sched-")
}

/** Tasks belonging to a scheduled period folder (year/month/week/day). */
export function getTasksForScheduledFolder(tasks: Task[], folderId: string): Task[] {
  if (folderId === NA_SCHEDULED_FOLDER) {
    return tasks.filter(
      (t) =>
        !t.completed &&
        !!(t.scheduledDate || t.scheduledWeek || t.scheduledMonth || t.scheduledYear || t.deadline),
    )
  }
  if (folderId.startsWith("na-sched-d-")) {
    const day = folderId.slice("na-sched-d-".length)
    const d = new Date(`${day}T12:00:00`)
    return tasks.filter((t) => !t.completed && taskScheduledOnDay(t, d))
  }
  if (folderId.startsWith("na-sched-w-")) {
    const week = folderId.slice("na-sched-w-".length)
    return tasks.filter((t) => !t.completed && taskScheduledInWeek(t, week))
  }
  if (folderId.startsWith("na-sched-m-")) {
    const month = folderId.slice("na-sched-m-".length)
    return tasks.filter((t) => !t.completed && taskScheduledInMonth(t, month))
  }
  if (folderId.startsWith("na-sched-y-")) {
    const year = folderId.slice("na-sched-y-".length)
    return tasks.filter((t) => !t.completed && taskScheduledInYear(t, year))
  }
  return []
}

export function syncScheduledFolderHierarchy(tasks: Task[], mut: Mutators): void {
  const na = ensureNextActionsFolder(mut)
  if (!na) return

  let scheduled = mut.folders.find((f) => f.id === NA_SCHEDULED_FOLDER)
  if (!scheduled) {
    scheduled = {
      id: NA_SCHEDULED_FOLDER,
      name: "Scheduled",
      createdAt: new Date(),
      listIds: [],
      parentFolderId: na.id,
      color: "#64748b",
    }
    mut.addFolder(scheduled)
  } else if (scheduled.parentFolderId !== na.id) {
    mut.updateFolder({ ...scheduled, parentFolderId: na.id })
  }

  const { years, months, weeks, days } = scheduledPeriodKeys(tasks)
  const knownIds = new Set(mut.folders.map((f) => f.id))

  const ensureFolder = (id: string, name: string, parentId: string) => {
    if (knownIds.has(id)) return
    knownIds.add(id)
    mut.addFolder({
      id,
      name,
      createdAt: new Date(),
      listIds: [],
      parentFolderId: parentId,
      color: "#94a3b8",
    })
  }

  for (const y of years) ensureFolder(`na-sched-y-${y}`, y, NA_SCHEDULED_FOLDER)
  for (const m of months) {
    const y = m.slice(0, 4)
    ensureFolder(`na-sched-y-${y}`, y, NA_SCHEDULED_FOLDER)
    ensureFolder(`na-sched-m-${m}`, format(new Date(`${m}-01`), "MMMM yyyy"), `na-sched-y-${y}`)
  }
  for (const w of weeks) {
    const [start] = w.split("_")
    const y = start.slice(0, 4)
    const m = start.slice(0, 7)
    ensureFolder(`na-sched-y-${y}`, y, NA_SCHEDULED_FOLDER)
    ensureFolder(`na-sched-m-${m}`, format(new Date(`${m}-01`), "MMMM yyyy"), `na-sched-y-${y}`)
    ensureFolder(`na-sched-w-${w}`, `week of ${format(new Date(`${start}T12:00:00`), "MMM d")}`, `na-sched-m-${m}`)
  }
  for (const d of days) {
    const y = d.slice(0, 4)
    const m = d.slice(0, 7)
    const w = getWeekString(new Date(`${d}T12:00:00`))
    ensureFolder(`na-sched-y-${y}`, y, NA_SCHEDULED_FOLDER)
    ensureFolder(`na-sched-m-${m}`, format(new Date(`${m}-01`), "MMMM yyyy"), `na-sched-y-${y}`)
    ensureFolder(`na-sched-w-${w}`, `week of ${format(new Date(w.split("_")[0] + "T12:00:00"), "MMM d")}`, `na-sched-m-${m}`)
    ensureFolder(`na-sched-d-${d}`, format(new Date(`${d}T12:00:00`), "EEE MMM d"), `na-sched-w-${w}`)
  }
}

export function isNaSmartCategoryId(id: string): boolean {
  return id === NA_SMART_DAILY || id === NA_SMART_WEEKLY || id === NA_SMART_MONTHLY
}

export function naSmartIdToPeriod(id: string): "daily" | "weekly" | "monthly" | null {
  if (id === NA_SMART_DAILY) return "daily"
  if (id === NA_SMART_WEEKLY) return "weekly"
  if (id === NA_SMART_MONTHLY) return "monthly"
  return null
}
