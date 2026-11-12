/**
 * lib/plan-bimby/day/apply.ts — What accepting a day plan writes
 *
 * `fileDay`: every item becomes (or updates) a task on To Do today, with its estimate, steps, why and
 * consequences; a must is marked Required and an important one Prioritized. The same items become one
 * intention in the follow-through ledger, one step each, with resistance and importance as a "before"
 * feeling. One undo step. Filing again only adds what is new and refreshes the fields on what it filed.
 * `startDayRun`: files, then hands the items to the Plan BIMBY's run list, each tied to its task so every
 * play is logged as time on it.
 */
"use client"

import { createScheduledTodoTask } from "@/components/Home/ToDo/todo-utils"
import { runAsAction } from "@/lib/action-history"
import { taskScheduledOnDay } from "@/lib/date-utils"
import { useFollowStore } from "@/lib/follow-through/store"
import { hashId, type Feeling, type Hedge, type Intention, type Scale, type Step } from "@/lib/follow-through/types"
import { useTaskStore } from "@/lib/task-store"
import { todoPeriodKey, withTodoCommitment } from "@/lib/todo-commitment"
import type { Subtask, Task } from "@/lib/types"
import { usePlanRunStore } from "../store"
import type { PlanItem } from "../types"
import { useDayPlanStore } from "./store"
import type { DayItem, DayPlan, DayTier } from "./types"

const pad = (n: number) => String(n).padStart(2, "0")
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const HEDGE: Record<DayTier, Hedge> = { must: "must", important: "will", rest: "maybe" }
const TODO_TIER = { must: "A+", important: "A", rest: "B" } as const
export const DAY_PLAN_NOTE = "From today's plan in BIM chat."

/** Add a sentence to a text field unless it is already there. Never replaces what the task held. */
function withLine(old: string | undefined, line: string): string | undefined {
  const add = line.trim()
  if (!add) return old
  if (!old?.trim()) return add
  return old.toLowerCase().includes(add.toLowerCase()) ? old : `${old.trim()}\n${add}`
}

function taskFields(task: Task, item: DayItem, now: Date, fresh: boolean): Task {
  const have = new Set((task.subtasks ?? []).map((s) => s.description.trim().toLowerCase()))
  const steps: Subtask[] = item.subtasks.filter((s) => !have.has(s.trim().toLowerCase())).map((s, i) => ({ id: `${task.id}-day-${now.getTime().toString(36)}-${i}`, description: s, completed: false }))
  const notes = [fresh ? DAY_PLAN_NOTE : "", item.note ?? "", item.blocker.trim() ? `In the way: ${item.blocker.trim()}` : ""].filter(Boolean).reduce<string | undefined>((all, line) => withLine(all, line), task.notes)
  const next: Task = {
    ...task,
    // An estimate the task already carried stays unless this one is firmer than a rough guess.
    ...(fresh || !task.estimatedDuration || item.estimate.source === "you" || item.estimate.source === "said" || item.estimate.source === "history" ? { estimatedDuration: item.estimate.minutes } : {}),
    ...(steps.length ? { subtasks: [...(task.subtasks ?? []), ...steps] } : {}),
    ...(notes !== task.notes ? { notes } : {}),
    ...(item.why.trim() ? { why: withLine(task.why, item.why) } : {}),
    ...(item.ifNot.trim() ? { consequences: withLine(task.consequences, item.ifNot) } : {}),
    ...(taskScheduledOnDay(task, now) ? {} : { scheduledDate: new Date(now.getFullYear(), now.getMonth(), now.getDate()) }),
  }
  return withTodoCommitment(next, "day", todoPeriodKey("day", now), { required: item.tier === "must", prioritized: item.tier === "important" })
}

export interface Filed {
  ok: boolean
  message: string
}

export function fileDay(planId: string, now = new Date()): Filed {
  const plan = useDayPlanStore.getState().plans[planId]
  if (!plan) return { ok: false, message: "That plan is no longer kept on this device." }
  const items = plan.items.filter((i) => i.title.trim() && !i.doneAt)
  if (!items.length) return { ok: false, message: "There is nothing on the plan to file." }
  let made = 0
  let updated = 0
  const patches = new Map<string, Partial<DayItem>>()
  try {
    runAsAction("day plan", () => {
      const tasks = useTaskStore.getState()
      for (const item of items) {
        const targetId = item.filedTaskId ?? (item.useTask ? item.taskId : undefined)
        const existing = targetId ? tasks.tasks.find((t) => t.id === targetId) : undefined
        if (existing) {
          useTaskStore.getState().updateTask(taskFields(existing, item, now, false))
          if (!item.filedTaskId) updated++
          patches.set(item.id, { filedTaskId: existing.id })
        } else {
          const task = taskFields(createScheduledTodoTask({ description: item.title.trim(), period: "day", date: now, tier: TODO_TIER[item.tier] }), item, now, true)
          useTaskStore.getState().addTask(task)
          made++
          patches.set(item.id, { filedTaskId: task.id })
        }
      }
      // The same plan as an intention: one step per thing not yet in the ledger.
      const fresh = items.filter((i) => !i.stepId)
      if (fresh.length) {
        const day = dayKey(now)
        const id = hashId("in", day, plan.text, String(plan.items.filter((i) => i.stepId).length))
        const steps: Step[] = fresh.map((item, order) => ({ id: `${id}_${order}`, intentionId: id, order, what: item.title.trim(), hedge: HEDGE[item.tier], verdict: "open", standing: "proposed", repeats: [], asked: [], ...(item.blocker.trim() ? { blocker: item.blocker.trim() } : {}) }))
        const intention: Intention = { id, at: now.toISOString(), day, said: plan.text, steps, source: "chat" }
        const feelings: Feeling[] = []
        fresh.forEach((item, order) => {
          const importance: Scale | undefined = item.tier === "must" ? 4 : item.tier === "important" ? 3 : undefined
          const resistance = item.resistance !== undefined ? (Math.max(0, Math.min(4, Math.round(item.resistance))) as Scale) : undefined
          patches.set(item.id, { ...patches.get(item.id), stepId: steps[order]!.id })
          if (importance === undefined && resistance === undefined) return
          // You set these on the card, so they are confirmed, not proposed.
          feelings.push({ id: hashId("fb", steps[order]!.id), at: now.toISOString(), day, phase: "before", stepId: steps[order]!.id, ...(resistance !== undefined ? { resistance } : {}), ...(importance !== undefined ? { importance } : {}), words: item.blocker.trim() || item.why.trim(), by: "asked", standing: "confirmed" })
        })
        useFollowStore.getState().take({ intentions: [intention], actions: [], feelings }, now)
      }
    })
  } catch (error) {
    return { ok: false, message: `Could not file the plan: ${error instanceof Error ? error.message : String(error)}` }
  }
  useDayPlanStore.getState().patch(planId, (p) => ({ ...p, filed: { at: now.toISOString(), tasks: (p.filed?.tasks ?? 0) + made + updated }, items: p.items.map((i) => (patches.has(i.id) ? { ...i, ...patches.get(i.id) } : i)) }))
  const parts = [made ? `${made} new on To Do today` : "", updated ? `${updated} existing task${updated === 1 ? "" : "s"} moved to today` : ""].filter(Boolean)
  return { ok: true, message: parts.length ? `Filed: ${parts.join(", ")}. Reasons and estimates are on each task, and the plan is in follow-through. Send undo to reverse it.` : "To Do is up to date with the card." }
}

function toPlanItem(item: DayItem): PlanItem {
  return {
    id: item.id,
    title: item.title,
    subtasks: item.subtasks.map((s, i) => ({ id: `${item.id}-s${i}`, title: s })),
    pace: item.urgent ? "urgent" : "steady",
    minutes: item.estimate.minutes,
    ...(item.filedTaskId ? { link: { kind: "task" as const, taskId: item.filedTaskId, title: item.title, confirmed: true } } : {}),
  }
}

/** File the plan, then start it in the Plan BIMBY's run list. Refuses while another plan is running. */
export function startDayRun(planId: string, now = new Date()): Filed {
  const before = useDayPlanStore.getState().plans[planId]
  if (!before) return { ok: false, message: "That plan is no longer kept on this device." }
  const running = usePlanRunStore.getState().run
  if (running && running.id === before.runId) return { ok: true, message: "This plan is already running." }
  if (running) return { ok: false, message: "Another plan is running in the Plan BIMBY. End that one first." }
  const filed = fileDay(planId, now)
  if (!filed.ok) return filed
  const plan = useDayPlanStore.getState().plans[planId] as DayPlan
  const items = plan.items.filter((i) => i.title.trim() && !i.doneAt)
  usePlanRunStore.getState().begin(items.map(toPlanItem), plan.remarks, plan.text, now)
  const run = usePlanRunStore.getState().run
  useDayPlanStore.getState().patch(planId, (p) => ({ ...p, runId: run?.id }))
  return { ok: true, message: `Started. ${items.length} rows are in the Plan BIMBY; press play on one and its time is logged on the task. Done checks it off To Do.` }
}

export function rejectDay(planId: string): void {
  useDayPlanStore.getState().patch(planId, (p) => ({ ...p, rejected: true, asking: undefined, thinking: false }))
}
