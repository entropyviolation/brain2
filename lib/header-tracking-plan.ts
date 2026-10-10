/**
 * lib/header-tracking-plan.ts — Header Now popup plan writes
 *
 * A short plan for now or the next hours becomes Tasks (Item.title),
 * planned-action placements on that day, and a day-plan log line.
 * Followed / skipped / unplanned edits of an existing item go through
 * `commitItemEdit`. Nothing here is a private database.
 */
import { commitItemEdit } from "@/lib/commit-item-edit"
import { withStatus } from "@/lib/completion-status"
import { parseLocalDate } from "@/lib/date-utils"
import { clearEstimates, makeEstimate, mergeEstimates } from "@/lib/estimated-values"
import {
  hhmmToMinutes,
  makePlannedAction,
  plannedDurationMinutes,
  timesFromStartAndDuration,
  type PlannedAction,
} from "@/lib/planned-actions"
import { usePlannedActionStore } from "@/lib/planned-action-store"
import { appendPlanEntry } from "@/lib/plan-text"
import { useTaskStore } from "@/lib/task-store"
import type { Task, TimeLogEntry } from "@/lib/types"

export type HeaderPlanStep = {
  title: string
  minutes: number
}

function rid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function taskById(id: string): Task | undefined {
  return useTaskStore.getState().tasks.find((task) => task.id === id)
}

function actionById(id: string): PlannedAction | undefined {
  return usePlannedActionStore.getState().actions.find((action) => action.id === id)
}

/** Create the sequence. Later clocks inherit an estimated start. */
export function createHeaderPlan(input: {
  date: string
  startMin: number
  startEstimated: boolean
  actions: HeaderPlanStep[]
}): { taskIds: string[]; actionIds: string[] } {
  const usable = input.actions
    .map((action) => ({ title: action.title.trim(), minutes: Math.round(action.minutes) }))
    .filter((action) => action.title.length > 0 && action.minutes > 0)
  if (usable.length === 0) return { taskIds: [], actionIds: [] }

  const day = parseLocalDate(input.date) ?? undefined
  let cursor = input.startMin
  const taskIds: string[] = []
  const actionIds: string[] = []
  const lines: string[] = []
  const createdAt = new Date()

  usable.forEach((action, index) => {
    const times = timesFromStartAndDuration(cursor, action.minutes)
    cursor = hhmmToMinutes(times.endTime)
    const id = rid(`htk${index}`)
    useTaskStore.getState().addTask({
      id,
      title: action.title,
      description: action.title,
      type: "item",
      stage: "scheduled",
      lists: [],
      createdAt,
      completed: false,
      tags: [],
      links: [],
      scheduledDate: day,
      scheduledTime: times.startTime,
      estimatedDuration: action.minutes,
      startCertainty: input.startEstimated ? "estimated" : "exact",
      attributes: { headerTracking: "plan" },
    })
    const placement = makePlannedAction({
      date: input.date,
      startTime: times.startTime,
      endTime: times.endTime,
      source: "todo",
      sourceId: id,
      title: action.title,
    })
    usePlannedActionStore.getState().addAction(placement)
    taskIds.push(id)
    actionIds.push(placement.id)
    lines.push(`${action.title} (${action.minutes}m)`)
  })

  appendPlanEntry("day", input.date, lines.join("\n"))
  return { taskIds, actionIds }
}

export function renameHeaderPlanAction(actionId: string, title: string): void {
  const next = title.trim()
  const action = actionById(actionId)
  if (!next || !action || next === action.title) return
  usePlannedActionStore.getState().updateAction({ ...action, title: next })
  if (action.sourceId && taskById(action.sourceId)) {
    commitItemEdit(action.sourceId, { title: next }, "header-tracking", "observed")
  }
}

export function retimesHeaderPlanAction(actionId: string, minutes: number): void {
  const action = actionById(actionId)
  const length = Math.round(minutes)
  if (!action || length <= 0) return
  const times = timesFromStartAndDuration(hhmmToMinutes(action.startTime), length)
  usePlannedActionStore.getState().updateAction({
    ...action,
    startTime: times.startTime,
    endTime: times.endTime,
  })
  if (action.sourceId && taskById(action.sourceId)) {
    commitItemEdit(
      action.sourceId,
      { scheduledTime: times.startTime, estimatedDuration: length },
      "header-tracking",
      "observed",
    )
  }
}

/**
 * Mark the plan row done. A blank length copies the plan and is estimated.
 * A typed length is observed unless the person marks it estimated.
 */
export function recordPlanFollowed(input: {
  taskId: string
  date: string
  plannedMinutes: number
  actualMinutes?: number
  durationEstimated: boolean
  startTime?: string
  endTime?: string
}): void {
  const task = taskById(input.taskId)
  if (!task) return
  const typed = input.actualMinutes
  const usedPlanLength = typed === undefined || !Number.isFinite(typed) || typed <= 0
  const minutes = usedPlanLength ? Math.max(1, Math.round(input.plannedMinutes)) : Math.round(typed)
  const estimated = input.durationEstimated || usedPlanLength
  const now = new Date()
  const log: TimeLogEntry = {
    id: rid("htk-log"),
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    durationMinutes: minutes,
    taskId: task.id,
    notes: estimated ? "Length marked estimated" : undefined,
  }
  const stamped = withStatus(task, "done", now)
  const estimates = estimated
    ? mergeEstimates(task.estimates, [
        makeEstimate(
          "actualDuration",
          "logged",
          usedPlanLength
            ? "Filled from the planned length — not a measured clock"
            : "You marked this length as approximate",
          now,
        ),
      ])
    : clearEstimates(task.estimates, ["actualDuration"])

  commitItemEdit(
    task.id,
    {
      status: stamped.status,
      completed: true,
      missedAt: undefined,
      completedDate: now,
      stage: "completed",
      actualDuration: minutes,
      durationCertainty: estimated ? "estimated" : "exact",
      timeRough: estimated ? true : undefined,
      estimates,
      timeLogs: [...(task.timeLogs ?? []), log],
    },
    "header-tracking",
    estimated ? "derived" : "observed",
  )
}

/** Planned, not taken. Stays on the day so the plan-vs-reality count still includes it. */
export function recordPlanSkipped(taskId: string, now = new Date()): void {
  const task = taskById(taskId)
  if (!task) return
  const stamped = withStatus(task, "missed", now)
  commitItemEdit(
    task.id,
    {
      status: "missed",
      completed: false,
      missedAt: stamped.missedAt,
      stage: "list",
    },
    "header-tracking",
    "observed",
  )
}

/** Something that happened and was not on the plan. Not scheduled, so it is not a planned task. */
export function insertUnplanned(input: {
  title: string
  date: string
  minutes: number
  estimated: boolean
}): string | null {
  const title = input.title.trim()
  const minutes = Math.round(input.minutes)
  if (!title || minutes <= 0) return null
  const id = rid("htk-extra")
  const now = new Date()
  const estimates = input.estimated
    ? [makeEstimate("actualDuration", "logged", "You marked this length as approximate", now)]
    : undefined
  useTaskStore.getState().addTask({
    id,
    title,
    description: title,
    type: "item",
    stage: "completed",
    lists: [],
    createdAt: now,
    completed: true,
    completedDate: now,
    status: "done",
    tags: [],
    links: [],
    loggedAction: true,
    actualDuration: minutes,
    durationCertainty: input.estimated ? "estimated" : "exact",
    timeRough: input.estimated ? true : undefined,
    estimates,
    notes: "Not on the plan",
    attributes: { headerTracking: "unplanned" },
    timeLogs: [
      {
        id: rid("htk-log"),
        date: input.date,
        durationMinutes: minutes,
        taskId: id,
        notes: "Not on the plan",
      },
    ],
  })
  return id
}

/** Actual minus planned. The difference is calculated, so the UI marks it estimated. */
export function derivedDurationGap(planned: number, actual: number | undefined): number | null {
  if (actual === undefined || !Number.isFinite(actual)) return null
  return Math.round(actual) - Math.round(planned)
}

export function plannedMinutesOf(action: PlannedAction): number {
  return plannedDurationMinutes(action)
}
