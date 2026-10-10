/**
 * lib/ingest/apply-todos.ts — Next Actions (do:) and Home → To Do today
 *
 * The live to-do pin is today's Home → To Do list (`to do today`), not Next
 * Actions. The dump reply is that card. A reply to the pin adds lines or
 * checks numbered lines off. Finish time is `completedDate` and
 * `completionReview.completedAt`. `-est` / `-e` flags that finish with a
 * `completedDate` estimate (`logged`).
 */
import { createScheduledTodoTask } from "@/components/Home/ToDo/todo-utils"
import { isClearedFromWork } from "@/lib/completion-status"
import { taskScheduledOnDay } from "@/lib/date-utils"
import { isEstimated, makeEstimate, mergeEstimates } from "@/lib/estimated-values"
import { ensureCaptureTarget } from "@/lib/capture-target"
import {
  createNextActionItem,
  itemTitleOrUntitled,
  withCategoryDefaults,
} from "@/lib/item-utils"
import { completeTask, saveCompletionReview } from "@/lib/services/completion-service"
import { localDayKey, periodLabel } from "@/lib/reviews-store"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import { taskStoreMutators } from "./apply-capture"
import { parseExpectedWhen } from "./times"
import type { ApplyResult } from "./types"

function splitLines(payload: string): string[] {
  return payload
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

export function applyDoNext(payload: string, _now = new Date()): ApplyResult {
  const lines = splitLines(payload)
  if (lines.length === 0) {
    return {
      status: "error",
      kind: "do" as ApplyResult["kind"],
      reply: "Send do: call dentist",
    } as ApplyResult
  }

  const target = ensureCaptureTarget(
    { folderPath: ["Next Actions"], category: "General" },
    taskStoreMutators,
  )
  const itemIds: string[] = []
  const replies: string[] = []

  for (const line of lines) {
    let item = createNextActionItem(line, target.listIds)
    item = withCategoryDefaults(item, target.list)
    useTaskStore.getState().addTask(item)
    itemIds.push(item.id)
    replies.push(`Next actions · General: ${line}`)
  }

  return {
    status: "ok",
    kind: "do" as ApplyResult["kind"],
    reply: replies.join("\n"),
    summary: `Next actions · General (${lines.length})`,
    itemIds,
  } as ApplyResult
}

export function applyTodoToday(payload: string, now = new Date()): ApplyResult {
  const lines = splitLines(payload)
  if (lines.length === 0) {
    return {
      status: "error",
      kind: "todo-today" as ApplyResult["kind"],
      reply: "Send todo today: call dentist",
    } as ApplyResult
  }

  const itemIds: string[] = []
  const replies: string[] = []

  for (const line of lines) {
    const task = createScheduledTodoTask({
      description: line,
      period: "day",
      date: now,
    })
    useTaskStore.getState().addTask(task)
    itemIds.push(task.id)
    replies.push(`To do today: ${line}`)
  }

  return withTodoPin(
    {
      status: "ok",
      kind: "todo-today" as ApplyResult["kind"],
      reply: replies.join("\n"),
      summary: `To do today (${lines.length})`,
      itemIds,
    } as ApplyResult,
    now,
  )
}

export function openTodoToday(now = new Date()) {
  return useTaskStore
    .getState()
    .tasks.filter(
      (task) =>
        !isClearedFromWork(task) &&
        !task.hiddenFromTodo &&
        taskScheduledOnDay(task, now),
    )
}

export function applyReadTodoToday(now = new Date()): ApplyResult {
  const open = openTodoToday(now)
  const card = todoTodayCard(now)
  const label = periodLabel("day", localDayKey(now))
  return {
    status: "ok",
    kind: "read-todo-today" as ApplyResult["kind"],
    reply: card,
    summary: open.length ? `To do today · ${open.length}` : `To do today · ${label}`,
    itemIds: open.map((t) => t.id),
    pinText: card,
    pinKind: "todo",
  } as ApplyResult
}

/** Same card `read to do today` pins. The reply is this string, not a second dump. */
export function todoTodayCard(now = new Date()): string {
  const open = openTodoToday(now)
  const done = doneOnToday(now)
  if (open.length === 0 && done.length === 0) return "Nothing on to do today."
  const lines = [`To do today · ${periodLabel("day", localDayKey(now))}`]
  if (open.length === 0) lines.push("Nothing open.")
  else open.forEach((task, i) => lines.push(`${i + 1}. ${itemTitleOrUntitled(task)}`))
  if (done.length) {
    lines.push("", "Done")
    for (const task of done) {
      const when = finishLabel(task)
      lines.push(when ? `• ${itemTitleOrUntitled(task)} ${when}` : `• ${itemTitleOrUntitled(task)}`)
    }
  }
  return lines.join("\n")
}

export function applyTodoPin(now = new Date()): ApplyResult {
  const card = todoTodayCard(now)
  return {
    status: "ok",
    kind: "pin",
    reply: card,
    summary: "Pinned to do today",
    pinText: card,
    pinKind: "todo",
  }
}

/**
 * A reply to the to-do pin. Numbers are the open lines on that card.
 * A bare number finishes at `now`. `1. 3 pm` finishes at that clock today
 * unless the line already names a date `parseExpectedWhen` understands.
 * `-est` / `-e` marks the finish estimated. Any other line is a new item.
 */
export function applyTodoPinReply(text: string, now = new Date()): ApplyResult {
  const lines = splitLines(text)
  if (lines.length === 0) {
    return {
      status: "error",
      kind: "todo-today",
      reply: "Reply with a new line, or a number from to do today.",
    }
  }

  const open = openTodoToday(now)
  const notes: string[] = []
  const added: string[] = []
  const finished: string[] = []

  for (const line of lines) {
    const completes = completionRequests(line, now)
    if (!completes) {
      added.push(line)
      continue
    }
    for (const request of completes) {
      if (request.badTime) {
        notes.push(`“${request.badTime}” is not a time for line ${request.index}.`)
        continue
      }
      const task = open[request.index - 1]
      if (!task) {
        notes.push(`No line ${request.index} on to do today.`)
        continue
      }
      if (finished.includes(task.id) || task.completed) {
        notes.push(`${request.index} is already done.`)
        continue
      }
      const when = request.at ?? now
      finishTodo(task.id, when, request.estimated, now)
      finished.push(task.id)
      const name = itemTitleOrUntitled(task)
      notes.push(`Done ${request.index}. ${name} ${formatPinClock(when, request.estimated)}`)
    }
  }

  if (added.length) {
    for (const line of added) {
      const task = createScheduledTodoTask({ description: line, period: "day", date: now })
      useTaskStore.getState().addTask(task)
      notes.push(`To do today: ${line}`)
    }
  }

  const card = todoTodayCard(now)
  return withTodoPin(
    {
      status: "ok",
      kind: "todo-today",
      reply: notes.join("\n"),
      summary: finished.length ? `Checked off ${finished.length}` : `To do today (${added.length})`,
      itemIds: finished,
    },
    now,
    card,
  )
}

function withTodoPin(result: ApplyResult, now: Date, card = todoTodayCard(now)): ApplyResult {
  if (result.status !== "ok" && result.status !== "needs_clarify") return result
  const reply = result.reply.trim() === card.trim() ? card : result.reply
  return { ...result, reply, pinText: card, pinKind: "todo" }
}

function doneOnToday(now: Date): Task[] {
  return useTaskStore
    .getState()
    .tasks.filter((task) => task.completed && !task.hiddenFromTodo && taskScheduledOnDay(task, now))
    .sort((a, b) => finishMs(a) - finishMs(b))
}

function finishMs(task: Task): number {
  const raw = task.completedDate
  if (!raw) return 0
  return raw instanceof Date ? raw.getTime() : new Date(raw).getTime()
}

function finishLabel(task: Task): string | null {
  const raw = task.completedDate
  if (!raw) return null
  const date = raw instanceof Date ? raw : new Date(raw)
  if (Number.isNaN(date.getTime())) return null
  return formatPinClock(date, isEstimated(task.estimates, "completedDate"))
}

function formatPinClock(date: Date, estimated: boolean): string {
  const h = date.getHours()
  const m = date.getMinutes()
  const suffix = h < 12 ? "AM" : "PM"
  const h12 = h % 12 || 12
  const clock = `${h12}:${String(m).padStart(2, "0")} ${suffix}`
  return estimated ? `~${clock}` : clock
}

interface CompletionRequest {
  index: number
  at: Date | null
  estimated: boolean
  badTime?: string
}

function completionRequests(line: string, now: Date): CompletionRequest[] | null {
  const onlyNumbers = line.trim().match(/^\d+(?:[\s,]+\d+)*$/)
  if (onlyNumbers) {
    return line
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((part) => ({ index: Number(part), at: null, estimated: false }))
  }
  const numbered = /^(\d+)\s*[.)]?\s*(.*)$/.exec(line.trim())
  if (!numbered) return null
  const index = Number(numbered[1])
  const peeled = peelEstimate(numbered[2] ?? "")
  if (!peeled.text) return [{ index, at: null, estimated: peeled.estimated }]
  const when = parseExpectedWhen(peeled.text)
  if (!when || when.minutes == null) return [{ index, at: null, estimated: peeled.estimated, badTime: peeled.text }]
  return [{ index, at: clockOn(when, now), estimated: peeled.estimated }]
}

function peelEstimate(raw: string): { text: string; estimated: boolean } {
  const text = raw.trim()
  if (/^-(?:est|e)$/i.test(text)) return { text: "", estimated: true }
  const flag = /^(.*)\s+-(?:est|e)$/i.exec(text)
  if (!flag) return { text, estimated: false }
  return { text: flag[1]!.trim(), estimated: true }
}

function clockOn(when: { minutes: number | null; date?: string }, now: Date): Date {
  let year = now.getFullYear()
  let month = now.getMonth()
  let day = now.getDate()
  if (when.date) {
    const [y, m, d] = when.date.split("-").map(Number)
    year = y!
    month = (m ?? 1) - 1
    day = d!
  }
  const minutes = when.minutes ?? 0
  return new Date(year, month, day, Math.floor(minutes / 60), minutes % 60, 0, 0)
}

function finishTodo(taskId: string, when: Date, estimated: boolean, now: Date) {
  completeTask(taskId)
  const task = useTaskStore.getState().tasks.find((item) => item.id === taskId)
  if (!task) return
  const estimates = estimated
    ? mergeEstimates(task.estimates, [
        makeEstimate("completedDate", "logged", "marked estimated on the to-do pin", now),
      ])
    : task.estimates
  useTaskStore.getState().updateTask({
    ...task,
    completed: true,
    completedDate: when,
    estimates,
  })
  saveCompletionReview(taskId, { completedAt: when })
}
