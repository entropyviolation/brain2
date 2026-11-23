/**
 * lib/coach-bimby/context.ts — What the coach knows right now: you, your goals, today
 *
 * Read from the stores in code, never by a model. `coachSnapshot` is the structured read the briefs use;
 * `aboutBlock` is the same read as plain lines, handed to the chat lane and the coach's model so a reply can
 * speak to who you are and what you are working toward. Secret items are left out, as everywhere.
 */

import { isClearedFromWork } from "@/lib/completion-status"
import { useGoalsStore } from "@/lib/goals-store"
import { openTodoToday } from "@/lib/ingest/apply-todos"
import { itemTitle } from "@/lib/item-utils"
import { periodKeyFor } from "@/lib/objectives"
import { findRemindersList, reminderInstant } from "@/lib/reminders"
import { isSecret } from "@/lib/secrets"
import { useTaskStore } from "@/lib/task-store"
import type { PriorityPeriod, Task } from "@/lib/types"
import { useMeStore, type MeKind, type MeNote } from "./me-store"

export interface CoachGoal {
  title: string
  /** "3 / 12 books", "done", or empty for a yes/no goal not done. */
  progress: string
  /** 0..1 when the goal has a number target. */
  share?: number
}

export interface CoachSnapshot {
  notes: MeNote[]
  /** Your goals in your own words (notes), then the Goals tab's open goals. */
  goals: CoachGoal[]
  /** Objectives you prioritized for this day, week, month or year. */
  focus: string[]
  /** Open To Dos on today, most important first. */
  todo: string[]
  /** To Dos done today. */
  done: string[]
  /** Reminders still to come today, "17:00 call mom". */
  reminders: string[]
}

const hm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`

function sameDay(a: Date | string | undefined | null, b: Date): boolean {
  if (!a) return false
  const d = a instanceof Date ? a : new Date(a)
  return !Number.isNaN(d.getTime()) && d.getFullYear() === b.getFullYear() && d.getMonth() === b.getMonth() && d.getDate() === b.getDate()
}

export function coachSnapshot(now: Date = new Date()): CoachSnapshot {
  const notes = useMeStore.getState().notes
  const { goals, objectives } = useGoalsStore.getState()

  const goalRows: CoachGoal[] = [
    ...notes.filter((n) => n.kind === "goal").map((n) => ({ title: n.text, progress: "" })),
    ...goals
      .filter((g) => !g.completed && g.periodKind !== "aspirational")
      .slice(0, 8)
      .map((g) => {
        if (g.type === "boolean") return { title: g.title, progress: "" }
        const share = g.target > 0 ? Math.min(1, g.current / g.target) : undefined
        return { title: g.title, progress: `${g.current} / ${g.target}${g.unit ? ` ${g.unit}` : ""}`, ...(share !== undefined ? { share } : {}) }
      }),
  ]

  const periods: PriorityPeriod[] = ["day", "week", "month", "year"]
  const focus = objectives
    .filter((o) => !o.archived && (o.priorities ?? []).some((p) => periods.includes(p.period) && p.periodKey === periodKeyFor(p.period, now)))
    .map((o) => o.title)

  const tasks = useTaskStore.getState().tasks
  const open = openTodoToday(now).filter((t) => !isSecret(t))
  open.sort((a, b) => (b.importance ?? 0) + (b.urgency ?? 0) - ((a.importance ?? 0) + (a.urgency ?? 0)))
  const todo = open.map((t) => itemTitle(t).trim()).filter(Boolean)
  const done = tasks
    .filter((t) => !isSecret(t) && t.completed && sameDay(t.completedDate, now))
    .map((t) => itemTitle(t).trim())
    .filter(Boolean)

  const listId = findRemindersList(useTaskStore.getState().lists)?.id
  const reminders = listId
    ? tasks
        .filter((t) => (t.lists ?? []).includes(listId) && !isClearedFromWork(t) && !isSecret(t))
        .map((t) => ({ t, at: reminderInstant(t) }))
        .filter((r): r is { t: Task; at: Date } => !!r.at && r.at.getTime() > now.getTime() && sameDay(r.at, now))
        .sort((a, b) => a.at.getTime() - b.at.getTime())
        .map((r) => `${hm(r.at)} ${itemTitle(r.t).trim()}`)
    : []

  return { notes, goals: goalRows, focus, todo, done, reminders }
}

const KIND_LABEL: Record<MeKind, string> = {
  who: "WHO THEY ARE",
  want: "WHAT THEY WANT",
  goal: "GOALS (their words)",
  need: "WHAT THEY NEED",
  like: "LIKES",
  dislike: "DISLIKES",
  person: "PEOPLE IN THEIR LIFE",
  note: "OTHER THINGS THEY TOLD YOU",
}

/** The snapshot as prompt lines. Empty string when BIM knows nothing yet. */
export function aboutBlock(now: Date = new Date(), snap: CoachSnapshot = coachSnapshot(now)): string {
  const parts: string[] = []
  for (const kind of Object.keys(KIND_LABEL) as MeKind[]) {
    if (kind === "goal") continue
    const rows = snap.notes.filter((n) => n.kind === kind).slice(-12)
    if (rows.length) parts.push(`${KIND_LABEL[kind]}:\n${rows.map((n) => `- ${n.text}`).join("\n")}`)
  }
  if (snap.goals.length) parts.push(`GOALS:\n${snap.goals.slice(0, 12).map((g) => `- ${g.title}${g.progress ? ` (${g.progress})` : ""}`).join("\n")}`)
  if (snap.focus.length) parts.push(`PRIORITIZED RIGHT NOW: ${snap.focus.join("; ")}`)
  if (snap.todo.length) parts.push(`TODAY'S OPEN TO DO:\n${snap.todo.slice(0, 10).map((t) => `- ${t}`).join("\n")}`)
  if (snap.done.length) parts.push(`DONE TODAY: ${snap.done.slice(0, 10).join("; ")}`)
  if (snap.reminders.length) parts.push(`REMINDERS LATER TODAY: ${snap.reminders.slice(0, 6).join("; ")}`)
  return parts.join("\n\n")
}
