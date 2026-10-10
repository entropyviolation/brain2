/**
 * lib/reminders.ts — Built-in Reminders list and timed delivery
 *
 * Items on the Reminders list fire at `scheduledDate` + `scheduledTime`.
 * `reminder.repeat` is once, every day, every week, each new moon, or each
 * full moon. That clock is not `repeatSettings` (count / frequency completions).
 *
 * A due occurrence is copied into the existing Inbox. When Text me is on
 * (the default), it is also texted to the paired Telegram chat through the
 * desktop bot (`window.desktop.telegram.send`) or, when that bridge is
 * absent, the phone-hub reply queue (`/api/ingest/reply`). Text me off skips
 * the text and records why. The same occurrence is not sent twice. A
 * recurring reminder then moves to the next future time, so a closed laptop
 * catches up once instead of texting every missed day. One-time reminders
 * stay on the list and do not fire again.
 *
 * Persistent (the default) keeps a due, undismissed occurrence in the header
 * bell until Dismiss. Dismiss is not delete: a one-time reminder leaves the
 * bell for good; a daily, weekly, or lunar reminder leaves until the next
 * cycle. That occurrence is not inboxed or texted again.
 *
 * Two seeded rows — `new moon tonight` and `full moon tonight` — inbox and
 * text at 18:00 local on the calendar day that contains that phase
 * (`lib/lunar.ts`, Meeus ch. 49). The header bell nags from local midnight of
 * that same day so the night is visible before evening. After deliver or
 * dismiss they advance to the next lunation.
 *
 * The tick lives in `hooks/use-reminder-tick.ts` and only runs while the app
 * is open.
 */
import { reminderCaptureOrigin } from "@/lib/capture-origin"
import { formatLocalDateKey, parseLocalDate, safeDateFormat, startOfLocalDay } from "@/lib/date-utils"
import { isClearedFromWork } from "@/lib/completion-status"
import { createListItem, itemTitle } from "@/lib/item-utils"
import { getTelegramDesktop } from "@/lib/ingest/telegram-bridge"
import { useIngestStore } from "@/lib/ingest/ingest-store"
import {
  MOON_REMINDER_HOUR,
  MOON_REMINDER_MINUTE,
  nextMoonReminderEvening,
  type LunarKind,
} from "@/lib/lunar"
import { useTaskStore } from "@/lib/task-store"
import type { List, Task } from "@/lib/types"

export const REMINDERS_LIST_ID = "reminders"
export const REMINDERS_LIST_NAME = "Reminders"

export const NEW_MOON_TONIGHT_NAME = "new moon tonight"
export const FULL_MOON_TONIGHT_NAME = "full moon tonight"
export const NEW_MOON_REMINDER_ID = "reminder-new-moon-tonight"
export const FULL_MOON_REMINDER_ID = "reminder-full-moon-tonight"

export type ReminderRepeat = "once" | "daily" | "weekly" | "new-moon" | "full-moon"
export type RecurringReminderRepeat = Exclude<ReminderRepeat, "once">

export const REMINDER_SKIP_NO_CHAT = "No paired Telegram chat"
export const REMINDER_SKIP_NO_TOKEN = "No bot token stored"
export const REMINDER_SKIP_NO_BRIDGE = "Telegram send is unavailable"
export const REMINDER_SKIP_TEXT_OFF = "Text me is off"

export interface ReminderPrefs {
  /** Omitted means yes — same as a reminder saved before this switch existed. */
  textMe?: boolean
  /** Omitted means yes — the header bell keeps the nag until dismiss. */
  persistent?: boolean
}

export interface ReminderSendResult {
  ok: boolean
  error?: string
}

export type ReminderSender = (chatId: string, text: string) => Promise<ReminderSendResult>

export interface ReminderDelivery {
  reminderId: string
  occurrenceKey: string
  inboxItemId: string
  telegramOk: boolean
  telegramNote?: string
}

export interface DeliverRemindersOptions {
  send?: ReminderSender
  /** Paired chat to text. Omit to use the latest allowed chat. */
  chatId?: string
}

const REPEAT: ReminderRepeat[] = ["once", "daily", "weekly", "new-moon", "full-moon"]
const RECURRING: RecurringReminderRepeat[] = ["daily", "weekly", "new-moon", "full-moon"]

let delivering = false

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

export function isReminderRepeat(value: unknown): value is ReminderRepeat {
  return typeof value === "string" && (REPEAT as string[]).includes(value)
}

export function isRecurringReminderRepeat(value: unknown): value is RecurringReminderRepeat {
  return typeof value === "string" && (RECURRING as string[]).includes(value)
}

function lunarKindForRepeat(repeat: "new-moon" | "full-moon"): LunarKind {
  return repeat === "new-moon" ? "new" : "full"
}

function moonReminderTitle(task: Task): string {
  return itemTitle(task).trim()
}

function findSeededMoonReminder(tasks: Task[], listId: string, id: string, name: string): Task | undefined {
  const onList = (task: Task) => (task.lists ?? []).includes(listId)
  return (
    tasks.find((task) => onList(task) && task.id === id) ??
    tasks.find((task) => onList(task) && moonReminderTitle(task) === name)
  )
}

function remindersName(name: string | undefined): boolean {
  return (name ?? "").trim().toLowerCase() === REMINDERS_LIST_NAME.toLowerCase()
}

/** The live Reminders list: canonical id, then the flagged list, then a name match. */
export function findRemindersList(lists: List[]): List | undefined {
  return (
    lists.find((list) => list.id === REMINDERS_LIST_ID) ??
    lists.find((list) => list.reminderList) ??
    lists.find((list) => remindersName(list.name))
  )
}

/** Canonical id or the flagged list. A same-named list is not protected until adopted. */
export function isRemindersList(list: { id: string; reminderList?: boolean } | null | undefined): boolean {
  if (!list) return false
  return list.id === REMINDERS_LIST_ID || list.reminderList === true
}

/** True when this open list is the live Reminders list. */
export function listIsReminders(list: List | null | undefined, lists: List[]): boolean {
  if (!list) return false
  return findRemindersList(lists)?.id === list.id
}

export function isReminderTask(task: Pick<Task, "lists" | "reminder">, lists: List[]): boolean {
  const list = findRemindersList(lists)
  if (!list) return Boolean(task.reminder)
  return (task.lists ?? []).includes(list.id)
}

/** Create or adopt the Reminders list. Rename keeps `reminderList`. */
export function ensureRemindersList(): string {
  const store = useTaskStore.getState()
  const existing = findRemindersList(store.lists)
  if (existing) {
    if (!existing.reminderList) {
      store.updateList({
        ...existing,
        reminderList: true,
        itemLabel: existing.itemLabel || "reminder",
      })
    }
    return existing.id
  }
  store.addList({
    id: REMINDERS_LIST_ID,
    name: REMINDERS_LIST_NAME,
    color: "#c2410c",
    createdAt: new Date(),
    itemLabel: "reminder",
    scheduleable: false,
    reminderList: true,
    description: "Timed reminders. When one is due it lands in the Inbox and, when Text me is on, is texted through Telegram.",
  })
  return REMINDERS_LIST_ID
}

/**
 * Idempotent seed of `new moon tonight` and `full moon tonight` on the
 * Reminders list. Match by stable id or exact title. Text me and Persistent
 * default on. Next fire is 18:00 local on the next applicable phase day.
 */
export function ensureMoonNightReminders(now: Date = new Date()): {
  newMoonId: string
  fullMoonId: string
} {
  const listId = ensureRemindersList()
  return {
    newMoonId: seedOneMoonReminder(listId, NEW_MOON_REMINDER_ID, NEW_MOON_TONIGHT_NAME, "new-moon", now),
    fullMoonId: seedOneMoonReminder(listId, FULL_MOON_REMINDER_ID, FULL_MOON_TONIGHT_NAME, "full-moon", now),
  }
}

function parseClock(value: string | undefined): { hours: number; minutes: number } | null {
  if (!value) return null
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return { hours, minutes }
}

/** Local fire instant for the reminder's current day and clock. */
export function reminderInstant(task: Pick<Task, "scheduledDate" | "scheduledTime">): Date | null {
  const day = parseLocalDate(task.scheduledDate)
  const clock = parseClock(task.scheduledTime)
  if (!day || !clock) return null
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), clock.hours, clock.minutes, 0, 0)
}

export function reminderOccurrenceKey(at: Date): string {
  return `${formatLocalDateKey(at)}T${pad(at.getHours())}:${pad(at.getMinutes())}`
}

/** `<input type="datetime-local">` value, or "" when the reminder has no clock. */
export function reminderWhenInputValue(task: Pick<Task, "scheduledDate" | "scheduledTime">): string {
  const at = reminderInstant(task)
  if (!at) return ""
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`
}

/** Parse a datetime-local value as a local instant. */
export function parseReminderWhen(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const at = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    0,
    0,
  )
  return Number.isNaN(at.getTime()) ? null : at
}

/** Text me. A missing flag stays on so older reminders still text. */
export function reminderTexts(reminder: { textMe?: boolean } | undefined): boolean {
  return reminder?.textMe !== false
}

/** Persistent / bothersome. A missing flag stays on so older reminders still nag. */
export function reminderPersists(reminder: { persistent?: boolean } | undefined): boolean {
  return reminder?.persistent !== false
}

export function reminderScheduleFields(
  when: Date,
  repeat: ReminderRepeat,
  prefs?: ReminderPrefs,
): Pick<Task, "scheduledDate" | "scheduledTime" | "reminder"> {
  return {
    scheduledDate: new Date(when.getFullYear(), when.getMonth(), when.getDate()),
    scheduledTime: `${pad(when.getHours())}:${pad(when.getMinutes())}`,
    reminder: {
      repeat,
      textMe: prefs?.textMe !== false,
      persistent: prefs?.persistent !== false,
    },
  }
}

function keptReminderMark(same: boolean, value: string | undefined): string | undefined {
  return same ? value : undefined
}

/**
 * Write a new clock. A changed time or repeat clears the sent and dismissed
 * marks so the new occurrence can fire and show in the bell. The same clock
 * keeps both marks. Text me and Persistent stay as they were.
 */
export function applyReminderSchedule(task: Task, when: Date, repeat: ReminderRepeat): Pick<Task, "scheduledDate" | "scheduledTime" | "reminder"> {
  const next = reminderScheduleFields(when, repeat, {
    textMe: task.reminder?.textMe !== false,
    persistent: task.reminder?.persistent !== false,
  })
  const key = reminderOccurrenceKey(when)
  const same = task.reminder?.deliveredKey === key && task.reminder.repeat === repeat
  return {
    ...next,
    reminder: {
      repeat,
      textMe: reminderTexts(task.reminder),
      persistent: reminderPersists(task.reminder),
      deliveredKey: keptReminderMark(same, task.reminder?.deliveredKey),
      dismissedKey: keptReminderMark(same, task.reminder?.dismissedKey),
      telegramNote: keptReminderMark(same, task.reminder?.telegramNote),
    },
  }
}

/** Text me / Persistent only. The clock and the sent mark stay. */
export function applyReminderPrefs(
  task: Task,
  prefs: ReminderPrefs,
): Pick<Task, "scheduledDate" | "scheduledTime" | "reminder"> {
  const reminder = task.reminder
  const repeat = reminder && isReminderRepeat(reminder.repeat) ? reminder.repeat : "once"
  return {
    scheduledDate: task.scheduledDate,
    scheduledTime: task.scheduledTime,
    reminder: {
      repeat,
      textMe: prefs.textMe !== undefined ? prefs.textMe : reminderTexts(reminder),
      persistent: prefs.persistent !== undefined ? prefs.persistent : reminderPersists(reminder),
      deliveredKey: reminder?.deliveredKey,
      dismissedKey: reminder?.dismissedKey,
      telegramNote: reminder?.telegramNote,
    },
  }
}

/** Reading-row caption: day, clock, repeat, and whether a one-time reminder already went out. */
export function reminderRowCaption(task: Task): string {
  if (!task.reminder || !task.scheduledTime) return ""
  const day = task.scheduledDate ? safeDateFormat(task.scheduledDate) : ""
  const repeat =
    task.reminder.repeat === "daily"
      ? "every day"
      : task.reminder.repeat === "weekly"
        ? "every week"
        : task.reminder.repeat === "new-moon"
          ? "each new moon"
          : task.reminder.repeat === "full-moon"
            ? "each full moon"
            : "once"
  const sent = task.reminder.repeat === "once" && task.reminder.deliveredKey ? "sent" : ""
  return [day && day !== "Not set" && day !== "Invalid date" ? day : "", task.scheduledTime, repeat, sent]
    .filter(Boolean)
    .join(" · ")
}

export function reminderTelegramText(task: Task): string {
  const title = itemTitle(task).trim() || "Reminder"
  return `Reminder: ${title}`
}

/**
 * Next local calendar day for a recurring reminder after an occurrence.
 * Daily / weekly step from `sentAt`'s clock. New / full moon use the next
 * 18:00 local on that phase's day after `now` (`nextMoonReminderEvening`).
 */
export function nextReminderDate(repeat: RecurringReminderRepeat, sentAt: Date, now: Date): Date {
  if (repeat === "new-moon" || repeat === "full-moon") {
    const evening = nextMoonReminderEvening(lunarKindForRepeat(repeat), now)
    return new Date(evening.getFullYear(), evening.getMonth(), evening.getDate())
  }
  const step = repeat === "weekly" ? 7 : 1
  const cursor = new Date(sentAt.getFullYear(), sentAt.getMonth(), sentAt.getDate())
  for (let i = 0; i < 366 * 5; i++) {
    cursor.setDate(cursor.getDate() + step)
    const at = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate(),
      sentAt.getHours(),
      sentAt.getMinutes(),
      0,
      0,
    )
    if (at.getTime() > now.getTime()) {
      return new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate())
    }
  }
  return new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate())
}

/** Keep lunar rows on 18:00 when advancing, in case the stored clock drifted. */
function nextScheduledTime(task: Task, repeat: ReminderRepeat): string | undefined {
  if (repeat === "new-moon" || repeat === "full-moon") {
    return `${pad(MOON_REMINDER_HOUR)}:${pad(MOON_REMINDER_MINUTE)}`
  }
  return task.scheduledTime
}

function pairedChatId(): string | undefined {
  const chats = useIngestStore.getState().allowedChats
  if (chats.length === 0) return undefined
  return [...chats].sort((a, b) => (a.pairedAt < b.pairedAt ? 1 : -1))[0]?.chatId
}

async function defaultSender(chatId: string, text: string): Promise<ReminderSendResult> {
  const desktop = getTelegramDesktop()
  if (desktop?.send) {
    try {
      const has = await desktop.hasToken()
      if (!has?.hasToken) return { ok: false, error: REMINDER_SKIP_NO_TOKEN }
      const sent = await desktop.send(chatId, text)
      if (!sent?.ok) return { ok: false, error: sent?.error || "Telegram send failed" }
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Telegram send failed" }
    }
  }
  try {
    const res = await fetch("/api/ingest/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, text }),
    })
    if (!res.ok) return { ok: false, error: REMINDER_SKIP_NO_BRIDGE }
    return { ok: true }
  } catch {
    return { ok: false, error: REMINDER_SKIP_NO_BRIDGE }
  }
}

const WHEN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** Local reading of an occurrence key (`YYYY-MM-DDTHH:mm`). */
export function parseOccurrenceKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(key)
  if (!match) return null
  const at = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), 0, 0)
  return Number.isNaN(at.getTime()) ? null : at
}

/** "Oct 9 · 3:00 PM" */
export function formatReminderWhen(at: Date): string {
  const hour = at.getHours()
  const h12 = hour % 12 || 12
  const ampm = hour < 12 ? "AM" : "PM"
  return `${WHEN_MONTHS[at.getMonth()]} ${at.getDate()} · ${h12}:${pad(at.getMinutes())} ${ampm}`
}

/** Lunar rows nag on the whole local phase day; inbox/Telegram still wait for 18:00. */
function lunarBellOpen(at: Date, now: Date): boolean {
  return formatLocalDateKey(at) === formatLocalDateKey(now) && now.getTime() >= startOfLocalDay(at).getTime()
}

/**
 * The occurrence the header bell is nagging about.
 * A clock still sitting on a due time uses that time. New-moon and full-moon
 * rows also nag from local midnight of their scheduled day (before 18:00).
 * After a recurring reminder has moved on, the occurrence just sent stays
 * until dismissed. Persistent off never nags. A dismissed occurrence never nags.
 */
export function nagOccurrence(task: Task, listId: string, now: Date): { key: string; at: Date } | null {
  if (isClearedFromWork(task)) return null
  if (!(task.lists ?? []).includes(listId)) return null
  if (!task.reminder || !isReminderRepeat(task.reminder.repeat)) return null
  if (!reminderPersists(task.reminder)) return null

  const at = reminderInstant(task)
  const lunar = task.reminder.repeat === "new-moon" || task.reminder.repeat === "full-moon"
  if (at && (at.getTime() <= now.getTime() || (lunar && lunarBellOpen(at, now)))) {
    const key = reminderOccurrenceKey(at)
    if (task.reminder.dismissedKey === key) return null
    return { key, at }
  }

  const delivered = task.reminder.deliveredKey
  if (!delivered || task.reminder.dismissedKey === delivered) return null
  const parsed = parseOccurrenceKey(delivered)
  if (!parsed) return null
  return { key: delivered, at: parsed }
}

export interface CurrentReminder {
  id: string
  name: string
  whenLabel: string
  at: Date
  occurrenceKey: string
  /** Reminders list name — where this row lives. */
  source: string
}

/** Undismissed persistent reminders that are current at `now`. */
export function currentReminders(tasks: Task[], lists: List[], now: Date): CurrentReminder[] {
  const list = findRemindersList(lists)
  if (!list) return []
  const rows: CurrentReminder[] = []
  for (const task of tasks) {
    const occurrence = nagOccurrence(task, list.id, now)
    if (!occurrence) continue
    rows.push({
      id: task.id,
      name: itemTitle(task).trim() || "Reminder",
      whenLabel: formatReminderWhen(occurrence.at),
      at: occurrence.at,
      occurrenceKey: occurrence.key,
      source: list.name?.trim() || REMINDERS_LIST_NAME,
    })
  }
  rows.sort((a, b) => a.at.getTime() - b.at.getTime() || a.name.localeCompare(b.name))
  return rows
}

/**
 * Dismiss the current occurrence. The item stays on the Reminders list.
 * One-time: it does not return to the bell or fire again.
 * Daily / weekly / lunar: hidden until the next cycle, which is a new occurrence.
 * A not-yet-sent occurrence is consumed here so it is not inboxed or texted.
 */
export function dismissReminder(taskId: string, now: Date = new Date()): boolean {
  const store = useTaskStore.getState()
  const listId = findRemindersList(store.lists)?.id
  const task = store.tasks.find((row) => row.id === taskId)
  if (!task?.reminder || !listId || !isReminderRepeat(task.reminder.repeat)) return false
  const occurrence = nagOccurrence(task, listId, now)
  if (!occurrence) return false

  const sitting = reminderInstant(task)
  const sittingKey = sitting ? reminderOccurrenceKey(sitting) : null
  const recurring = isRecurringReminderRepeat(task.reminder.repeat)
  const scheduledDate =
    sittingKey === occurrence.key && recurring
      ? nextReminderDate(task.reminder.repeat, occurrence.at, now)
      : task.scheduledDate
  const scheduledTime =
    sittingKey === occurrence.key && recurring
      ? nextScheduledTime(task, task.reminder.repeat)
      : task.scheduledTime

  store.updateTask({
    ...task,
    scheduledDate,
    scheduledTime,
    reminder: {
      ...task.reminder,
      deliveredKey: occurrence.key,
      dismissedKey: occurrence.key,
    },
  })
  return true
}

function dueReminder(task: Task, listId: string, now: Date): { at: Date; key: string } | null {
  if (isClearedFromWork(task)) return null
  if (!(task.lists ?? []).includes(listId)) return null
  if (!task.reminder || !isReminderRepeat(task.reminder.repeat)) return null
  const at = reminderInstant(task)
  if (!at || at.getTime() > now.getTime()) return null
  const key = reminderOccurrenceKey(at)
  if (task.reminder.deliveredKey === key || task.reminder.dismissedKey === key) return null
  return { at, key }
}

function inboxNotice(reminder: Task, key: string, now: Date): Task {
  const text = reminderTelegramText(reminder)
  return {
    ...createListItem(text, []),
    id: `reminder-inbox-${reminder.id}-${key.replace(/:/g, "")}`,
    stage: "inbox",
    createdAt: now,
    notes: `From reminder ${reminder.id} at ${key}`,
    captureOrigin: reminderCaptureOrigin(itemTitle(reminder), key),
  }
}

/**
 * Deliver every due reminder once. Inbox is written even when Telegram is
 * skipped or throws. A second call for the same occurrence does nothing.
 */
export async function deliverDueReminders(
  now: Date = new Date(),
  options: DeliverRemindersOptions = {},
): Promise<ReminderDelivery[]> {
  if (delivering) return []
  delivering = true
  try {
    const listId = ensureRemindersList()
    const send = options.send ?? defaultSender
    const chatId = options.chatId ?? pairedChatId()
    const due = useTaskStore
      .getState()
      .tasks.filter((task) => dueReminder(task, listId, now))
    const delivered: ReminderDelivery[] = []

    for (const task of due) {
      const fresh = useTaskStore.getState().tasks.find((row) => row.id === task.id) ?? task
      const slot = dueReminder(fresh, listId, now)
      if (!slot || !fresh.reminder) continue

      const notice = inboxNotice(fresh, slot.key, now)
      useTaskStore.getState().addTask(notice)

      let telegramOk = false
      let telegramNote: string | undefined
      if (!reminderTexts(fresh.reminder)) {
        telegramNote = REMINDER_SKIP_TEXT_OFF
      } else if (!chatId) {
        telegramNote = REMINDER_SKIP_NO_CHAT
      } else {
        try {
          const sent = await send(chatId, reminderTelegramText(fresh))
          telegramOk = Boolean(sent?.ok)
          if (!telegramOk) telegramNote = sent?.error || "Telegram send failed"
        } catch (err) {
          telegramNote = err instanceof Error ? err.message : "Telegram send failed"
        }
      }

      const recurring = isRecurringReminderRepeat(fresh.reminder.repeat)
      const scheduledDate = recurring
        ? nextReminderDate(fresh.reminder.repeat, slot.at, now)
        : fresh.scheduledDate
      const scheduledTime = recurring ? nextScheduledTime(fresh, fresh.reminder.repeat) : fresh.scheduledTime

      useTaskStore.getState().updateTask({
        ...fresh,
        scheduledDate,
        scheduledTime,
        reminder: {
          ...fresh.reminder,
          deliveredKey: slot.key,
          telegramNote,
        },
      })

      delivered.push({
        reminderId: fresh.id,
        occurrenceKey: slot.key,
        inboxItemId: notice.id,
        telegramOk,
        telegramNote,
      })
    }

    return delivered
  } finally {
    delivering = false
  }
}

/** File a new reminder on the built-in list. Text me and Persistent default on. */
export function addReminder(
  description: string,
  when: Date,
  repeat: ReminderRepeat,
  prefs?: ReminderPrefs,
): string {
  const listId = ensureRemindersList()
  const item: Task = {
    ...createListItem(description.trim(), [listId]),
    ...reminderScheduleFields(when, repeat, prefs),
  }
  useTaskStore.getState().addTask(item)
  return item.id
}

function seedOneMoonReminder(
  listId: string,
  id: string,
  name: string,
  repeat: "new-moon" | "full-moon",
  now: Date,
): string {
  const store = useTaskStore.getState()
  const existing = findSeededMoonReminder(store.tasks, listId, id, name)
  const when = nextMoonReminderEvening(lunarKindForRepeat(repeat), now)
  if (existing) {
    const repeatOk = existing.reminder?.repeat === repeat
    const clockOk = Boolean(existing.scheduledDate && existing.scheduledTime)
    if (repeatOk && clockOk) return existing.id
    const schedule = reminderScheduleFields(when, repeat, {
      textMe: reminderTexts(existing.reminder),
      persistent: reminderPersists(existing.reminder),
    })
    store.updateTask({
      ...existing,
      ...schedule,
      reminder: {
        ...schedule.reminder!,
        deliveredKey: existing.reminder?.deliveredKey,
        dismissedKey: existing.reminder?.dismissedKey,
        telegramNote: existing.reminder?.telegramNote,
      },
    })
    return existing.id
  }
  const item: Task = {
    ...createListItem(name, [listId]),
    id,
    ...reminderScheduleFields(when, repeat),
  }
  store.addTask(item)
  return id
}
