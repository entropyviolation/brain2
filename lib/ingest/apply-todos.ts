/**
 * lib/ingest/apply-todos.ts — Next Actions (do:) and Home → To Do today
 */
import { createScheduledTodoTask } from "@/components/Home/ToDo/todo-utils"
import { isClearedFromWork } from "@/lib/completion-status"
import { taskScheduledOnDay } from "@/lib/date-utils"
import { ensureCaptureTarget } from "@/lib/capture-target"
import {
  createNextActionItem,
  itemTitleOrUntitled,
  withCategoryDefaults,
} from "@/lib/item-utils"
import { localDayKey, periodLabel } from "@/lib/reviews-store"
import { useTaskStore } from "@/lib/task-store"
import { taskStoreMutators } from "./apply-capture"
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

  return {
    status: "ok",
    kind: "todo-today" as ApplyResult["kind"],
    reply: replies.join("\n"),
    summary: `To do today (${lines.length})`,
    itemIds,
  } as ApplyResult
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
  const dayKey = localDayKey(now)
  const label = periodLabel("day", dayKey)

  if (open.length === 0) {
    return {
      status: "ok",
      kind: "read-todo-today" as ApplyResult["kind"],
      reply: "Nothing on to do today.",
      summary: `To do today · ${label}`,
    } as ApplyResult
  }

  const lines = [`To do today · ${label}`]
  open.forEach((task, i) => {
    lines.push(`${i + 1}. ${itemTitleOrUntitled(task)}`)
  })

  return {
    status: "ok",
    kind: "read-todo-today" as ApplyResult["kind"],
    reply: lines.join("\n"),
    summary: `To do today · ${open.length}`,
    itemIds: open.map((t) => t.id),
  } as ApplyResult
}
