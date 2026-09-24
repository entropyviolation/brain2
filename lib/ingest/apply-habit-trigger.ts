/**
 * lib/ingest/apply-habit-trigger.ts — Keyword habit lines from text
 *
 * Whole-message matches only (`hemisync`, `read 30 pages`, …). Writes the habit
 * completion and puts the trailing detail + "from text message at {time}" onto
 * the Done-today notes.
 */
import { useHabitsStore } from "@/lib/habits-store"
import { habitDoneLogId } from "@/lib/habit-done-log"
import { taskRepository } from "@/lib/data/task-repository"
import { TaskType, type WeeklyTask } from "@/lib/types"
import { writeHabit } from "./apply-habit"
import {
  fromTextMessageNote,
  matchHabitTextTrigger,
  type HabitTriggerMatch,
} from "./text-triggers"
import type { ApplyResult } from "./types"

export function tryApplyHabitTrigger(raw: string, now = new Date()): ApplyResult | null {
  const habits = useHabitsStore.getState().tasks.filter((t) => !t.frequency || t.frequency === "daily")
  const hit = matchHabitTextTrigger(raw, habits)
  if (!hit) return null
  return applyHabitTriggerMatch(hit, now)
}

export function applyHabitTriggerMatch(hit: HabitTriggerMatch, now = new Date()): ApplyResult {
  const habit = useHabitsStore.getState().tasks.find((h) => h.id === hit.habitId)
  if (!habit) {
    return { status: "error", kind: "habit-trigger", reply: "That habit disappeared. Try again." }
  }

  const remainder = buildRemainder(habit, hit)
  const result = writeHabit(habit, remainder, now)
  if (result.status !== "ok") return { ...result, kind: "habit-trigger" }

  const note = fromTextMessageNote(now, hit.note)
  attachDoneNotes(habit, now, note)

  return {
    ...result,
    kind: "habit-trigger",
    reply: hit.note ? `${result.reply} (noted)` : result.reply,
    summary: `${result.summary} from text`,
  }
}

function buildRemainder(habit: WeeklyTask, hit: HabitTriggerMatch): string {
  if (hit.trigger.mode === "done") {
    if (habit.type === TaskType.TEXT && hit.note) return hit.note
    return "done"
  }
  if (hit.value == null) return "done"
  return String(hit.value)
}

function attachDoneNotes(habit: WeeklyTask, date: Date, note: string): void {
  const id = habitDoneLogId(habit.id, date)
  // syncHabitDoneLog runs inside updateCompletion; give the row a moment to exist.
  const existing = taskRepository.getById(id)
  if (existing) {
    const prev = (existing.notes ?? "").trim()
    const next = prev && !prev.includes(note) ? `${prev}\n${note}` : prev || note
    taskRepository.update({ ...existing, notes: next })
    return
  }
  // Completion may still be writing — patch via a microtask-free re-read after
  // the store flush by updating completion text for TEXT habits, else notes later.
  if (habit.type === TaskType.TEXT) {
    useHabitsStore.getState().updateCompletion(habit.id, date, { text: note, completed: true })
  }
}
