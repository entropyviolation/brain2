/**
 * lib/ingest/apply-habit.ts — Habit completions from a phrase
 */
import { useHabitsStore } from "@/lib/habits-store"
import { TaskType, type WeeklyTask } from "@/lib/types"
import { incrementHabitProgress } from "@/lib/implied-actions"
import { addLocalDays } from "./times"
import { resolveName, splitNameAndRest } from "./name-resolve"
import type { ApplyResult } from "./types"

function habitDate(payload: string, now: Date): { date: Date; rest: string } {
  const yesterday = /\byesterday\b/i.test(payload)
  const rest = payload.replace(/\byesterday\b/gi, "").replace(/\s+/g, " ").trim()
  const date = yesterday ? addLocalDays(now, -1) : now
  return { date, rest }
}

export function applyHabit(payload: string, now = new Date()): ApplyResult {
  const habits = useHabitsStore.getState().tasks.filter((t) => !t.frequency || t.frequency === "daily")
  const { date, rest } = habitDate(payload, now)
  if (!rest) {
    return { status: "error", kind: "habit", reply: "Which habit? Example: habit: exercise 30" }
  }

  const { query, rest: remainder } = splitNameAndRest(rest, habits)
  const resolved = resolveName(query, habits)
  if (resolved.status === "none") {
    return {
      status: "needs_clarify",
      kind: "habit",
      reply: `No habit matches “${query}”. Reply with a name from Habits, or send help.`,
      pending: {
        kind: "habit",
        query,
        candidates: [],
        remainder,
        createdAt: now.toISOString(),
      },
    }
  }
  if (resolved.status === "ambiguous") {
    const list = resolved.candidates.map((c, i) => `${i + 1}. ${c.name}`).join("\n")
    return {
      status: "needs_clarify",
      kind: "habit",
      reply: `Which habit?\n${list}`,
      pending: {
        kind: "habit",
        query,
        candidates: resolved.candidates,
        remainder,
        createdAt: now.toISOString(),
      },
    }
  }

  const habit = habits.find((h) => h.id === resolved.candidate.id)
  if (!habit) {
    return { status: "error", kind: "habit", reply: "Habit disappeared. Try again." }
  }
  return writeHabit(habit, remainder, date)
}

export function writeHabit(habit: WeeklyTask, remainder: string, date: Date): ApplyResult {
  const payload = remainder.trim()
  const lower = payload.toLowerCase()
  const store = useHabitsStore.getState()

  if (habit.type === TaskType.BOOLEAN) {
    const off = lower === "no" || lower === "undo" || lower === "off"
    store.updateCompletion(habit.id, date, { completed: !off })
    return {
      status: "ok",
      kind: "habit",
      reply: off ? `${habit.name}: not done` : `${habit.name}: done`,
      summary: `${habit.name} ${off ? "unchecked" : "checked"}`,
    }
  }

  if (habit.type === TaskType.TEXT) {
    const text = payload || "logged"
    store.updateCompletion(habit.id, date, { text, completed: true })
    return {
      status: "ok",
      kind: "habit",
      reply: `${habit.name}: ${text}`,
      summary: `${habit.name} text logged`,
    }
  }

  const numeric = payload.match(/(-?\d+(?:\.\d+)?)/)
  if (habit.type === TaskType.INCREMENTAL) {
    if (numeric) {
      store.updateCompletion(habit.id, date, { value: Number(numeric[1]) })
      return {
        status: "ok",
        kind: "habit",
        reply: `${habit.name}: ${numeric[1]}${habit.unit ? ` ${habit.unit}` : ""}`,
        summary: `${habit.name} = ${numeric[1]}`,
      }
    }
    incrementHabitProgress(habit.id, 1, date)
    return {
      status: "ok",
      kind: "habit",
      reply: `${habit.name}: +1`,
      summary: `${habit.name} incremented`,
    }
  }

  // GOAL / TIME / COUNT
  const goal = habit.goal ?? 0
  if (numeric) {
    const value = Number(numeric[1])
    store.updateCompletion(habit.id, date, { value, goal })
    return {
      status: "ok",
      kind: "habit",
      reply: `${habit.name}: ${value}${habit.unit ? ` ${habit.unit}` : ""}`,
      summary: `${habit.name} = ${value}`,
    }
  }

  const value = goal || 1
  store.updateCompletion(habit.id, date, { value, goal, completed: true })
  return {
    status: "ok",
    kind: "habit",
    reply: `${habit.name}: ${value}${habit.unit ? ` ${habit.unit}` : ""}`,
    summary: `${habit.name} logged`,
  }
}
