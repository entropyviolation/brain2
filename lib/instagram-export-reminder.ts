/**
 * lib/instagram-export-reminder.ts — Monthly "request a new Instagram export"
 *
 * Fresh Instagram data starts with a manual request in Accounts Center
 * (`lib/instagram-export-steps.ts`). This keeps one seeded row on the
 * Reminders list, repeating every month at 10:00, so the existing reminder
 * clock (`lib/reminders.ts`) inboxes it, texts it with the link when Text me
 * is on, and keeps it in the header bell until Dismiss.
 *
 * On means the row exists. Off deletes the row. The Instagram view seeds it
 * once (`seedInstagramExportReminderOnce`); after that only the switch adds
 * or removes it, so a deleted row stays deleted.
 */
import { createListItem, itemTitle } from "@/lib/item-utils"
import {
  INSTAGRAM_EXPORT_REMINDER_ID,
  INSTAGRAM_EXPORT_REMINDER_NAME,
  instagramExportStepsText,
} from "@/lib/instagram-export-steps"
import { ensureRemindersList, findRemindersList, reminderInstant, reminderScheduleFields } from "@/lib/reminders"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"

export const INSTAGRAM_EXPORT_REMINDER_HOUR = 10
export const INSTAGRAM_EXPORT_REMINDER_SEEDED_KEY = "brain2-instagram-export-reminder-seeded"

function sameMonthDay(base: Date, monthsAhead: number): Date {
  const year = base.getFullYear()
  const month = base.getMonth() + monthsAhead
  const last = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(base.getDate(), last), INSTAGRAM_EXPORT_REMINDER_HOUR, 0, 0, 0)
}

/**
 * First fire. One month after the last export when that is still ahead;
 * otherwise the next 10:00 from `now`.
 */
export function firstInstagramExportReminder(now: Date, lastExport?: Date | null): Date {
  if (lastExport && !Number.isNaN(lastExport.getTime())) {
    const due = sameMonthDay(lastExport, 1)
    if (due.getTime() > now.getTime()) return due
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), INSTAGRAM_EXPORT_REMINDER_HOUR, 0, 0, 0)
  if (today.getTime() > now.getTime()) return today
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, INSTAGRAM_EXPORT_REMINDER_HOUR, 0, 0, 0)
}

/**
 * The seeded row, by id prefix, then by exact title on the Reminders list.
 * Each switch-on gets a new id: a deleted id is tombstoned for sync.
 */
export function findInstagramExportReminder(tasks: Task[]): Task | undefined {
  const byId = tasks.find((task) => task.id.startsWith(INSTAGRAM_EXPORT_REMINDER_ID))
  if (byId) return byId
  const listId = findRemindersList(useTaskStore.getState().lists)?.id
  if (!listId) return undefined
  return tasks.find(
    (task) => (task.lists ?? []).includes(listId) && itemTitle(task).trim() === INSTAGRAM_EXPORT_REMINDER_NAME,
  )
}

export function instagramExportReminderOn(tasks: Task[] = useTaskStore.getState().tasks): boolean {
  return Boolean(findInstagramExportReminder(tasks))
}

/** Next fire instant of the seeded row, or null when it is off. */
export function nextInstagramExportReminder(tasks: Task[] = useTaskStore.getState().tasks): Date | null {
  const task = findInstagramExportReminder(tasks)
  return task ? reminderInstant(task) : null
}

/** Turn the monthly reminder on or off. Returns whether it is on afterwards. */
export function setInstagramExportReminder(on: boolean, now: Date = new Date(), lastExport?: Date | null): boolean {
  const store = useTaskStore.getState()
  const existing = findInstagramExportReminder(store.tasks)
  if (!on) {
    if (existing) store.deleteTask(existing.id)
    return false
  }
  if (existing) return true
  const listId = ensureRemindersList()
  const item: Task = {
    ...createListItem(INSTAGRAM_EXPORT_REMINDER_NAME, [listId]),
    id: `${INSTAGRAM_EXPORT_REMINDER_ID}-${now.getTime()}`,
    taskDescription: instagramExportStepsText(),
    ...reminderScheduleFields(firstInstagramExportReminder(now, lastExport), "monthly"),
  }
  store.addTask(item)
  return true
}

function readSeeded(): boolean {
  try {
    return window.localStorage.getItem(INSTAGRAM_EXPORT_REMINDER_SEEDED_KEY) === "1"
  } catch {
    return false
  }
}

function writeSeeded(): void {
  try {
    window.localStorage.setItem(INSTAGRAM_EXPORT_REMINDER_SEEDED_KEY, "1")
  } catch {
    // Private window or blocked storage: the seed may run again next time.
  }
}

/**
 * Seed the reminder the first time the Instagram view opens on this device.
 * A row that already exists (synced from another device) counts as seeded.
 */
export function seedInstagramExportReminderOnce(now: Date = new Date(), lastExport?: Date | null): boolean {
  if (readSeeded()) return instagramExportReminderOn()
  writeSeeded()
  return setInstagramExportReminder(true, now, lastExport)
}
