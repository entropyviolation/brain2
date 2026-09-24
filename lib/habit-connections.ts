/**
 * lib/habit-connections.ts — Habits that check themselves from a log
 *
 * Two connections, both optional and editable on the habit:
 * - A sleep clock. Bedtime on a day is the evening that leads into the next
 *   morning's night (`sleptMin`). Wake is that morning's `wokeMin`. The habit
 *   is met when the logged end is at or before the threshold.
 * - A next-action list. The habit is met when that many items on the named
 *   list, inside Next Actions, were completed that day.
 *
 * `undefined` on the habit means "use the name preset". `null` means the user
 * turned that connection off, so a later rename does not bring the preset back.
 * A hand tick still counts: the auto flag is separate (`sleepCompleted` /
 * `listCompleted`), the same way tracked time uses `trackedCompleted`.
 */
import type { Folder, HabitListLink, HabitSleepLink, List, Task, TaskCompletion, WeeklyTask } from "./types"
import { TaskType } from "./types"
import { addCalendarDays, formatLocalDateKey, parseLocalDate } from "./date-utils"
import { taskIsNextAction } from "./item-utils"
import { parseBedtime, parseWakeTime } from "./sleep-log"

export function normalizeListName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function hourInName(name: string): { hour: number; minute: number; suffix?: "am" | "pm" } | null {
  const labeled = name.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i)
  const bare = name.match(/\b(\d{1,2})(?::(\d{2}))?\b/)
  const match = labeled ?? bare
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2] ?? "0")
  if (hour > 23 || minute > 59) return null
  const suffix = labeled ? (match[3].toLowerCase() as "am" | "pm") : undefined
  return { hour, minute, suffix }
}

function clockFromToken(token: { hour: number; minute: number; suffix?: "am" | "pm" }, evening: boolean): string {
  let hour = token.hour
  if (token.suffix === "pm" && hour < 12) hour += 12
  if (token.suffix === "am" && hour === 12) hour = 0
  if (!token.suffix && evening && hour >= 1 && hour <= 11) hour += 12
  if (!token.suffix && evening && hour === 12) hour = 0
  return `${String(hour).padStart(2, "0")}:${String(token.minute).padStart(2, "0")}`
}

export function presetSleepLink(task: Pick<WeeklyTask, "name" | "frequency" | "type">): HabitSleepLink | null {
  if (task.frequency && task.frequency !== "daily") return null
  if (task.type && task.type !== TaskType.BOOLEAN) return null
  const name = (task.name || "").toLowerCase()
  if (/bed\s*time|bedtime/.test(name)) {
    const token = hourInName(name) ?? { hour: 11, minute: 0 }
    const beforeMinutes = parseBedtime(clockFromToken(token, true))
    if (beforeMinutes === undefined) return null
    return { end: "bed", beforeMinutes }
  }
  if (/wake/.test(name) && (/before|\bby\b/.test(name) || hourInName(name))) {
    const token = hourInName(name) ?? { hour: 9, minute: 0 }
    const beforeMinutes = parseWakeTime(clockFromToken(token, false))
    if (beforeMinutes === undefined) return null
    return { end: "wake", beforeMinutes }
  }
  return null
}

export function presetListLink(task: Pick<WeeklyTask, "name" | "frequency" | "type">): HabitListLink | null {
  if (task.frequency && task.frequency !== "daily") return null
  if (task.type && task.type !== TaskType.BOOLEAN) return null
  const name = (task.name || "").toLowerCase()
  if (!/to-?\s*do/.test(name)) return null
  if (!/complete|finish|\bdone\b/.test(name)) return null
  const countMatch = name.match(/\b(\d+)\b/)
  const count = countMatch ? Number(countMatch[1]) : 1
  if (!Number.isFinite(count) || count < 1) return { listName: "to do", count: 1 }
  return { listName: "to do", count }
}

/** `undefined` reads the preset. `null` stays off. */
export function effectiveSleepLink(
  task: Pick<WeeklyTask, "name" | "frequency" | "type" | "sleepLink">,
): HabitSleepLink | null {
  if (task.sleepLink === null) return null
  if (task.sleepLink) return task.sleepLink
  return presetSleepLink(task)
}

export function effectiveListLink(
  task: Pick<WeeklyTask, "name" | "frequency" | "type" | "listLink">,
): HabitListLink | null {
  if (task.listLink === null) return null
  if (task.listLink && task.listLink.listName.trim() && task.listLink.count >= 1) return task.listLink
  return presetListLink(task)
}

export function sleepEndMeets(
  link: HabitSleepLink,
  night: { sleptMin?: number; wokeMin?: number; allNighter?: boolean } | undefined,
): boolean {
  if (!night || night.allNighter) return false
  const value = link.end === "bed" ? night.sleptMin : night.wokeMin
  if (value === undefined) return false
  return value <= link.beforeMinutes
}

/** Bedtime on calendar day D is the night stored under the next morning. Wake is that morning. */
export function sleepHabitDayKey(morningKey: string, end: HabitSleepLink["end"]): string | null {
  if (end === "wake") return morningKey
  const morning = parseLocalDate(morningKey)
  if (!morning) return null
  return formatLocalDateKey(addCalendarDays(morning, -1))
}

export function doneNextActionCount(
  tasks: Task[],
  lists: List[],
  folders: Folder[],
  listName: string,
  dayKey: string,
): number {
  const want = normalizeListName(listName)
  if (!want) return 0
  const listIds = new Set(lists.filter((list) => normalizeListName(list.name) === want).map((list) => list.id))
  if (listIds.size === 0) return 0
  let count = 0
  for (const task of tasks) {
    if (!task.completed || !task.completedDate) continue
    const when = task.completedDate instanceof Date ? task.completedDate : new Date(task.completedDate)
    if (Number.isNaN(when.getTime()) || formatLocalDateKey(when) !== dayKey) continue
    if (!(task.lists ?? []).some((id) => listIds.has(id))) continue
    if (!taskIsNextAction(task, folders)) continue
    count += 1
  }
  return count
}

/**
 * Merge one auto flag into a boolean cell. A hand tick (completed, with no auto
 * flag) stays ticked when the log does not qualify. Returns null when the cell
 * would not change. Does not open an empty miss for a day the log is silent on.
 */
export function applyAutoFlag(
  completion: TaskCompletion | undefined,
  flag: "sleepCompleted" | "listCompleted",
  met: boolean,
): TaskCompletion | null {
  const prevMet = !!completion?.[flag]
  if (!met && !completion) return null
  const sleep = flag === "sleepCompleted" ? met : !!completion?.sleepCompleted
  const list = flag === "listCompleted" ? met : !!completion?.listCompleted
  const tracked = !!completion?.trackedCompleted
  const manual =
    !!completion?.completed &&
    !completion?.trackedCompleted &&
    !completion?.sleepCompleted &&
    !completion?.listCompleted
  const completed = manual || tracked || sleep || list
  if (prevMet === met && !!completion?.completed === completed) return null
  const next: TaskCompletion = { ...completion, completed }
  if (sleep) next.sleepCompleted = true
  else delete next.sleepCompleted
  if (list) next.listCompleted = true
  else delete next.listCompleted
  return next
}

export function autoCheckHint(completion: TaskCompletion | undefined): string | null {
  if (!completion?.completed) return null
  const parts: string[] = []
  if (completion.sleepCompleted) parts.push("the sleep log")
  if (completion.listCompleted) parts.push("a done next action")
  if (completion.trackedCompleted) parts.push("tracked time")
  if (!parts.length) return null
  return `Checked from ${parts.join(" and ")}. You can still tick it yourself.`
}
