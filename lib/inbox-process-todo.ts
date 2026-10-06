/**
 * lib/inbox-process-todo.ts — To Do cue when the revisit Inbox is over 100
 *
 * More than 100 open revisit ideas (Monkey brain does not count) adds one
 * To Do for today named "process inbox information", with Auto-push on so an
 * unfinished copy walks to the next day. One open copy is enough. Marking it
 * done holds the cue off until the next local day. Dropping to 100 or fewer
 * leaves an existing copy where it is.
 */
import { createScheduledTodoTask } from "@/components/Home/ToDo/todo-utils"
import { isClearedFromWork, getTaskCompletionDate } from "@/lib/completion-status"
import { formatLocalDateKey, sameCalendarDay } from "@/lib/date-utils"
import { inInboxPartition } from "@/lib/inbox-batch"
import type { Task } from "@/lib/types"

/** Open revisit ideas that trigger the cue. 100 stays quiet; 101 adds it. */
export const PROCESS_INBOX_LIMIT = 100

export const PROCESS_INBOX_TITLE = "process inbox information"

/** Stable id. Later copies, after a done one, append `:` and the day key. */
export const PROCESS_INBOX_TODO_ID = "process-inbox-information"

export function revisitInboxCount(tasks: readonly Task[]): number {
  let count = 0
  for (const task of tasks) {
    if (inInboxPartition(task, "inbox")) count += 1
  }
  return count
}

export function isProcessInboxTodo(task: Pick<Task, "id" | "description" | "title">): boolean {
  if (task.id === PROCESS_INBOX_TODO_ID || task.id.startsWith(`${PROCESS_INBOX_TODO_ID}:`)) return true
  const title = (task.title ?? "").trim().toLowerCase()
  const description = (task.description ?? "").trim().toLowerCase()
  return title === PROCESS_INBOX_TITLE || description === PROCESS_INBOX_TITLE
}

function completedOnDay(task: Task, day: Date): boolean {
  if (!task.completed) return false
  const when = getTaskCompletionDate(task)
  return !!when && sameCalendarDay(when, day)
}

/** An open cue, including one already pushed onto a later day. */
export function openProcessInboxTodo(tasks: readonly Task[]): Task | undefined {
  return tasks.find((task) => isProcessInboxTodo(task) && !isClearedFromWork(task))
}

function nextProcessInboxId(tasks: readonly Task[], now: Date): string {
  if (!tasks.some((task) => task.id === PROCESS_INBOX_TODO_ID)) return PROCESS_INBOX_TODO_ID
  const day = formatLocalDateKey(now)
  let id = `${PROCESS_INBOX_TODO_ID}:${day}`
  let n = 2
  while (tasks.some((task) => task.id === id)) {
    id = `${PROCESS_INBOX_TODO_ID}:${day}:${n}`
    n += 1
  }
  return id
}

/**
 * The To Do to add, or null when the pile is at or under the limit, an open
 * cue already exists, or one was marked done today.
 */
export function processInboxTodoToAdd(tasks: readonly Task[], now: Date = new Date()): Task | null {
  if (revisitInboxCount(tasks) <= PROCESS_INBOX_LIMIT) return null
  if (openProcessInboxTodo(tasks)) return null
  if (tasks.some((task) => isProcessInboxTodo(task) && completedOnDay(task, now))) return null

  const created = createScheduledTodoTask({
    description: PROCESS_INBOX_TITLE,
    period: "day",
    date: now,
  })
  return {
    ...created,
    id: nextProcessInboxId(tasks, now),
    title: PROCESS_INBOX_TITLE,
    autoPush: true,
  }
}
