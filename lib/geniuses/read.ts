/**
 * lib/geniuses/read.ts — What a genius can see of its own area (pure)
 *
 * The area is its bindings: items on a bound list, under a bound root item, or serving a bound goal or objective; bound
 * habits; bound goals and objectives. Secret items never enter. It reads only its own area, like Coach BIMBY's
 * `coachSnapshot` reads only what it needs. Code counts; the model only phrases from these facts.
 */

import { isClearedFromWork } from "@/lib/completion-status"
import { openFriendHabits } from "@/lib/friend-suggestion"
import type { ExemptionBooks } from "@/lib/habit-exemption"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { isSecret } from "@/lib/secrets"
import type { Goal, List, Objective, Task, WeeklyData, WeeklyTask } from "@/lib/types"
import type { Genius } from "./types"

export type AreaVault = {
  tasks: Task[]
  lists: List[]
  habits: WeeklyTask[]
  weeklyData: WeeklyData
  habitExemptions?: ExemptionBooks
  goals: Goal[]
  objectives: Objective[]
  now?: Date
}

export type AreaItem = { id: string; title: string; urgency: number; importance: number }

export type AreaRead = {
  open: AreaItem[]
  openCount: number
  doneThisWeek: number
  lastDoneAt: string | null
  /** Whole days since the last done step, or null when nothing in the area was ever done. */
  stalledDays: number | null
  habitsOpen: string[]
  habitsDone: string[]
  goals: { id: string; title: string; current: number; target: number; unit: string }[]
  objectives: string[]
  lists: string[]
  /** True when the genius has no bindings at all. */
  unbound: boolean
}

const DAY = 86_400_000
const stamp = (d: Date | string | undefined): number => (d ? new Date(d).getTime() : NaN)

/** Every item id in the area: bound lists, roots and their children, goal and objective contributors. */
export function areaItemIds(g: Genius, tasks: Task[]): Set<string> {
  const b = g.bindings
  const lists = new Set(b.listIds)
  const goals = new Set(b.goalIds)
  const objectives = new Set(b.objectiveIds)
  const roots = new Set(b.rootItemIds)
  const parent = new Map(tasks.map((t) => [t.id, t.parentTaskId]))
  const underRoot = (id: string): boolean => {
    for (let at: string | undefined = id, hops = 0; at && hops < 50; at = parent.get(at), hops++) if (roots.has(at)) return true
    return false
  }
  const out = new Set<string>()
  for (const t of tasks) {
    if (isSecret(t)) continue
    if (
      (t.lists ?? []).some((id) => lists.has(id)) ||
      (roots.size && underRoot(t.id)) ||
      (t.contributesToGoalIds ?? []).some((id) => goals.has(id)) ||
      (t.contributesToObjectiveIds ?? []).some((id) => objectives.has(id))
    )
      out.add(t.id)
  }
  return out
}

export function readArea(g: Genius, v: AreaVault): AreaRead {
  const now = v.now ?? new Date()
  const b = g.bindings
  const unbound = !b.listIds.length && !b.rootItemIds.length && !b.goalIds.length && !b.objectiveIds.length && !b.habitIds.length
  const inArea = areaItemIds(g, v.tasks)
  const rows = v.tasks.filter((t) => inArea.has(t.id))
  const open = rows
    .filter((t) => !t.completed && !isClearedFromWork(t))
    .map((t) => ({ id: t.id, title: itemTitleOrUntitled(t), urgency: t.urgency ?? 3, importance: t.importance ?? 3 }))
    .sort((a, b2) => b2.urgency + b2.importance - (a.urgency + a.importance))
  const doneAt = rows.map((t) => (t.completed ? stamp(t.completedDate) : NaN)).filter((n) => Number.isFinite(n))
  const last = doneAt.length ? Math.max(...doneAt) : null
  const bound = new Set(b.habitIds)
  const habits = v.habits.filter((h) => bound.has(h.id))
  const openHabitIds = new Set(openFriendHabits(habits, v.weeklyData, now, v.habitExemptions).map((h) => h.id))
  const goals = v.goals.filter((x) => b.goalIds.includes(x.id) && !x.completed)
  return {
    open: open.slice(0, 8),
    openCount: open.length,
    doneThisWeek: doneAt.filter((t) => now.getTime() - t < 7 * DAY).length,
    lastDoneAt: last === null ? null : new Date(last).toISOString(),
    stalledDays: last === null ? null : Math.max(0, Math.floor((now.getTime() - last) / DAY)),
    habitsOpen: habits.filter((h) => openHabitIds.has(h.id)).map((h) => h.name),
    habitsDone: habits.filter((h) => !openHabitIds.has(h.id)).map((h) => h.name),
    goals: goals.map((x) => ({ id: x.id, title: x.title, current: x.current, target: x.target, unit: x.unit ?? "" })),
    objectives: v.objectives.filter((o) => b.objectiveIds.includes(o.id)).map((o) => o.title),
    lists: v.lists.filter((l) => b.listIds.includes(l.id)).map((l) => l.name),
    unbound,
  }
}

/** The area as plain lines for a prompt. Only facts; no advice. */
export function areaLines(r: AreaRead): string {
  if (r.unbound) return "AREA: not bound to any list, goal or habit yet. Speak only from the charter and what they say."
  const out: string[] = []
  if (r.lists.length) out.push(`LISTS: ${r.lists.join(", ")}`)
  if (r.objectives.length) out.push(`OBJECTIVES: ${r.objectives.join(", ")}`)
  for (const g of r.goals) out.push(`GOAL: ${g.title} (${g.current} of ${g.target}${g.unit ? ` ${g.unit}` : ""})`)
  if (r.habitsOpen.length || r.habitsDone.length) out.push(`HABITS TODAY: ${r.habitsDone.length} done${r.habitsOpen.length ? `; open: ${r.habitsOpen.join(", ")}` : ""}`)
  out.push(`OPEN STEPS: ${r.openCount}${r.open.length ? ` (top: ${r.open.slice(0, 5).map((o) => o.title).join("; ")})` : ""}`)
  out.push(`DONE THIS WEEK: ${r.doneThisWeek}`)
  out.push(r.stalledDays === null ? "LAST DONE: never" : `LAST DONE: ${r.stalledDays === 0 ? "today" : `${r.stalledDays} days ago`}`)
  return out.join("\n")
}
