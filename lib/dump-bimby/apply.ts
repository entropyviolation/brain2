/**
 * lib/dump-bimby/apply.ts — Accept for the Dump BIMBY's own effects
 *
 * `amend`: a plan said again that is already an open task. Accept raises its urgency and
 * importance to the field's value, puts it on today's To Do when asked, sets a deadline when one
 * was said, and adds a dated note with the words. One undo step.
 * `pattern`: a thought pattern read from the message. Accept confirms it in the ledger
 * (`lib/thought-patterns/store.ts`), with your note when you wrote one; Reject marks it wrong.
 * Plain filings on the same card are `line` effects and go through the Stream BIMBY's writer.
 */
"use client"

import { runAsAction } from "@/lib/action-history"
import { taskScheduledOnDay, toLocalCalendarDate } from "@/lib/date-utils"
import { itemTitle } from "@/lib/item-utils"
import { useTaskStore } from "@/lib/task-store"
import type { ItemNoteEntry, Task } from "@/lib/types"
import { useThoughtPatternStore } from "@/lib/thought-patterns/store"
import { fieldValue, type Effect } from "@/lib/report-bimby/types"
import { parseDateTime } from "@/lib/report-bimby/time"

export interface DumpApplied {
  ok: boolean
  message: string
}

const pad = (n: number) => String(n).padStart(2, "0")

export function applyAmend(effect: Effect, now = new Date()): DumpApplied {
  const task = useTaskStore.getState().tasks.find((t) => t.id === effect.ref)
  if (!task) return { ok: false, message: "That task is gone, so there is nothing to amend." }
  if (task.completed) return { ok: false, message: `${itemTitle(task)} is already done.` }
  const rank = Number(fieldValue(effect, "urgency"))
  const today = fieldValue(effect, "today") === "yes"
  const byRaw = fieldValue(effect, "by").trim()
  const by = byRaw ? parseDateTime(byRaw) : NaN
  if (byRaw && Number.isNaN(by)) return { ok: false, message: "Deadline must look like 2026-11-24T14:00, or be empty." }
  const noteText = fieldValue(effect, "note").trim()
  const note: ItemNoteEntry | null = noteText
    ? { id: `bn_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, date: now.toISOString().slice(0, 10), time: `${pad(now.getHours())}:${pad(now.getMinutes())}`, text: noteText }
    : null
  const wasToday = taskScheduledOnDay(task, now) && !task.hiddenFromTodo
  const next: Task = {
    ...task,
    ...(Number.isFinite(rank) && rank > 0 ? { urgency: Math.max(task.urgency ?? 0, rank), importance: Math.max(task.importance ?? 0, rank) } : {}),
    ...(today ? { hiddenFromTodo: false, ...(wasToday ? {} : { scheduledDate: toLocalCalendarDate(now) }) } : {}),
    ...(Number.isFinite(by) ? { deadline: new Date(by) } : {}),
    ...(note ? { noteLog: [...(task.noteLog ?? []), note] } : {}),
  }
  runAsAction(`BIM dump: amend ${itemTitle(task)}`, () => useTaskStore.getState().updateTask(next))
  const said = [
    Number.isFinite(rank) && rank > 0 ? `priority ${rank}` : "",
    today ? (wasToday ? "already on today" : "on today's to do") : "",
    Number.isFinite(by) ? `due ${pad(new Date(by).getHours())}:${pad(new Date(by).getMinutes())}` : "",
    note ? "note added" : "",
  ].filter(Boolean)
  return { ok: true, message: `${itemTitle(task)}: ${said.join(", ") || "unchanged"}.` }
}

export function applyPattern(effect: Effect): DumpApplied {
  if (!effect.ref) return { ok: false, message: "No pattern to confirm." }
  const store = useThoughtPatternStore.getState()
  const obs = store.observations.find((o) => o.id === effect.ref)
  if (!obs) return { ok: false, message: "That read is no longer in the ledger." }
  const note = fieldValue(effect, "note").trim()
  store.add([{ ...obs, status: "confirmed", ...(note ? { quote: `${obs.quote} — ${note}` } : {}) }])
  return { ok: true, message: `Kept: ${effect.title.split(":")[0]}.` }
}

export function rejectPattern(effect: Effect): void {
  if (effect.ref) useThoughtPatternStore.getState().setStatus(effect.ref, "rejected")
}
