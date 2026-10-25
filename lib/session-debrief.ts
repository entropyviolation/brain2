/**
 * lib/session-debrief.ts — The sheet after Working on now stops
 *
 * Stop already wrote the span. This builds a picture of that sitting (the
 * task, its steps, the objectives, estimated against the minutes just spent)
 * and, on Done, writes the corrections back: step and task completion,
 * estimates, the log note, a 1–5 satisfaction, energy, what got in the way,
 * and an optional note for the next time that task or pen goes on the clock.
 *
 * Close leaves the log as the clock wrote it. Cancel on the unfinished
 * question never gets here — the clock is still running.
 */
"use client"

import type { NowObjective } from "@/lib/now-objective"
import { objectiveWorkedMs } from "@/lib/now-objective"
import type { PenColorSession } from "@/lib/pen-color-session-store"
import type { WorkSession } from "@/lib/work-session-store"
import type { Subtask, Task, TimeLogEntry, TimeLogSessionReview } from "@/lib/types"
import { formatLocalDateKey } from "@/lib/date-utils"
import { clockNoteField, clockPathLabel } from "@/lib/task-clock-log"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { finishStep, placeSteps, stepPath } from "@/lib/next-step"
import { setEstimate } from "@/lib/task-card"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { runAsAction } from "@/lib/action-history"
import {
  sessionActiveEnd,
  sessionElapsedMs,
  splitIntoDaySlices,
  stopWorkingOnOperation,
  workedOnTitle,
  workTimeLogId,
} from "@/lib/operation-work-session"
import { stopPenColorSession } from "@/lib/pen-color-session"
import { useSessionDebriefStore } from "@/lib/session-debrief-store"
import type { DebriefStep, SessionDebriefDraft, SittingEnergy, SittingReview } from "@/lib/session-debrief-store"

export type { DebriefObjective, DebriefStep, SessionDebriefDraft, SessionHandoff, SittingEnergy, SittingReview } from "@/lib/session-debrief-store"

export interface DebriefStepEdit {
  stepId: string
  completed: boolean
  estimated: number | null
}

export interface DebriefAnswers {
  note: string
  handoff: string
  handoffTask: boolean
  handoffPen: boolean
  satisfaction?: number
  energy?: SittingEnergy
  blocker: string
  taskCompleted: boolean
  taskEstimate: number | null
  logMinutes: number
  steps: DebriefStepEdit[]
}

function minutesOrNull(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : null
}

function hhmm(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

function clockFace(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}

/** `9:14–9:47`, or with the day when the sitting crossed midnight. */
export function whenLabel(fromIso: string, toIso: string): string {
  const from = new Date(fromIso)
  const to = new Date(toIso)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return ""
  const left = clockFace(fromIso)
  const right = clockFace(toIso)
  if (from.toDateString() === to.toDateString()) return left === right ? left : `${left}–${right}`
  const day = (date: Date) => date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  return `${day(from)} ${left} – ${day(to)} ${right}`
}

function objectiveWindow(row: NowObjective, endedAt: Date): { minutes: number | null; when: string } {
  const ms = objectiveWorkedMs(row, endedAt)
  const minutes = ms == null ? null : Math.max(0, Math.round(ms / 60_000))
  if (row.startUnknown) return { minutes: null, when: "start unknown" }
  const from = row.stintStartedAt ?? (row.completedAt ? row.addedAt : undefined)
  const to = row.completedAt ?? (row.stintStartedAt ? endedAt.toISOString() : undefined)
  return { minutes, when: from && to ? whenLabel(from, to) : "" }
}

function penLogIds(task: Task | undefined, session: { trackingEntryIds?: string[]; startedAt: string; stepId?: string }): string[] {
  if (!task?.timeLogs?.length) return []
  const ids = new Set(session.trackingEntryIds ?? [])
  const painted = task.timeLogs.filter((log) => log.entryIds?.some((id) => ids.has(id)))
  if (painted.length) return painted.map((log) => log.id)
  const start = hhmm(new Date(session.startedAt))
  const date = formatLocalDateKey(new Date(session.startedAt))
  const loose = [...task.timeLogs].reverse().find((log) => log.date === date && log.startTime === start && log.stepId === session.stepId)
  return loose ? [loose.id] : []
}

function stepsFor(
  task: Task | undefined,
  clockStepId: string | undefined,
  objectives: readonly NowObjective[] | undefined,
  startedAt: string,
  endedAt: Date,
  activeMinutes: number,
): DebriefStep[] {
  if (!task) return []
  const endedIso = endedAt.toISOString()
  const byStep = new Map<string, { ms: number; from?: string; to?: string }>()
  for (const row of objectives ?? []) {
    if (!row.stepId || row.stepId === clockStepId) continue
    const window = objectiveWindow(row, endedAt)
    if (window.minutes == null && !window.when) continue
    const prev = byStep.get(row.stepId) ?? { ms: 0 }
    prev.ms += (window.minutes ?? 0) * 60_000
    if (!prev.from && row.stintStartedAt) prev.from = row.stintStartedAt
    else if (!prev.from && row.addedAt && !row.startUnknown) prev.from = row.addedAt
    prev.to = row.completedAt ?? endedIso
    byStep.set(row.stepId, prev)
  }
  return placeSteps(task.subtasks).map((placed) => {
    const onClock = placed.step.id === clockStepId
    const extra = byStep.get(placed.step.id)
    const sittingMinutes = onClock ? activeMinutes : extra ? Math.round(extra.ms / 60_000) : null
    const when = onClock
      ? whenLabel(startedAt, endedIso)
      : extra?.from && extra.to
        ? whenLabel(extra.from, extra.to)
        : ""
    return {
      stepId: placed.step.id,
      label: placed.step.description,
      depth: placed.path.length,
      estimated: minutesOrNull(placed.step.estimatedDuration),
      completed: placed.step.completed,
      sittingMinutes,
      when,
    }
  })
}

function objectiveRows(list: readonly NowObjective[] | undefined, endedAt: Date): DebriefObjective[] {
  return (list ?? []).map((row) => {
    const window = objectiveWindow(row, endedAt)
    return { text: row.text, completed: Boolean(row.completedAt), minutes: window.minutes, when: window.when }
  })
}

function draftBase(input: {
  kind: "pen" | "operation"
  title: string
  task: Task | undefined
  stepId?: string
  startedAt: string
  endedAt: Date
  activeMinutes: number
  objectives?: readonly NowObjective[]
  penId?: string
  scopeId?: string
  penName?: string
  penColor?: string
  trackingEntryIds: string[]
  timeLogIds: string[]
  note: string
  operationId?: string
}): SessionDebriefDraft {
  const path = input.task ? clockPathLabel(input.task, input.stepId) : input.title
  return {
    kind: input.kind,
    title: input.title,
    path: path || input.title,
    taskTitle: input.task ? itemTitleOrUntitled(input.task) : input.title,
    startedAt: input.startedAt,
    endedAt: input.endedAt.toISOString(),
    activeMinutes: input.activeMinutes,
    ...(input.task ? { taskId: input.task.id } : {}),
    ...(input.stepId ? { stepId: input.stepId } : {}),
    ...(input.operationId ? { operationId: input.operationId } : {}),
    ...(input.penId ? { penId: input.penId } : {}),
    ...(input.scopeId ? { scopeId: input.scopeId } : {}),
    ...(input.penName ? { penName: input.penName } : {}),
    ...(input.penColor ? { penColor: input.penColor } : {}),
    trackingEntryIds: input.trackingEntryIds,
    timeLogIds: input.timeLogIds,
    note: input.note,
    taskCompleted: Boolean(input.task?.completed),
    taskEstimate: minutesOrNull(input.task?.estimatedDuration),
    steps: stepsFor(input.task, input.stepId, input.objectives, input.startedAt, input.endedAt, input.activeMinutes),
    objectives: objectiveRows(input.objectives, input.endedAt),
  }
}

/** The pen clock that just stopped. `task` is the record after the stop wrote its log. */
export function buildPenDraft(
  session: PenColorSession,
  endedAt: Date,
  task: Task | undefined,
  pen?: { name: string; color: string },
): SessionDebriefDraft {
  const end = sessionActiveEnd(session, endedAt)
  const activeMinutes = Math.max(0, Math.round(sessionElapsedMs(session, endedAt.getTime()) / 60_000))
  const logIds = penLogIds(task, session)
  const log = task?.timeLogs?.find((row) => row.id === logIds[0])
  return draftBase({
    kind: "pen",
    title: session.title,
    task,
    stepId: session.stepId,
    startedAt: session.startedAt,
    endedAt: end,
    activeMinutes,
    objectives: session.nowObjectives,
    penId: session.penId,
    scopeId: session.scopeId,
    penName: pen?.name ?? session.title,
    penColor: pen?.color,
    trackingEntryIds: session.trackingEntryIds ?? [],
    timeLogIds: logIds,
    note: log?.notes ?? "",
    operationId: undefined,
  })
}

/** The operation clock that just stopped. */
export function buildWorkDraft(
  session: WorkSession,
  endedAt: Date,
  task: Task | undefined,
  pen?: { name: string; color: string },
): SessionDebriefDraft {
  const end = sessionActiveEnd(session, endedAt)
  const activeMinutes = Math.max(0, Math.round(sessionElapsedMs(session, endedAt.getTime()) / 60_000))
  const slices = splitIntoDaySlices(new Date(session.startedAt), end)
  const timeLogIds = slices.map((slice) => workTimeLogId(session.operationId, session.startedAt, slice.date))
  const log = task?.timeLogs?.find((row) => row.id === timeLogIds[0])
  return draftBase({
    kind: "operation",
    title: session.title,
    task,
    startedAt: session.startedAt,
    endedAt: end,
    activeMinutes,
    objectives: session.nowObjectives,
    penId: session.penId || undefined,
    scopeId: session.scopeId || undefined,
    penName: pen?.name,
    penColor: pen?.color,
    trackingEntryIds: session.trackingEntryIds ?? [],
    timeLogIds,
    note: log?.notes ?? workedOnTitle(session.title),
    operationId: session.operationId,
  })
}

function openIds(steps: readonly Subtask[] | undefined, id: string): Subtask[] {
  const path = stepPath(steps, id) ?? []
  const ids = new Set([id, ...path.map((step) => step.id)])
  const walk = (list: readonly Subtask[]): Subtask[] =>
    list.map((step) => {
      const subtasks = step.subtasks?.length ? walk(step.subtasks) : step.subtasks
      if (!ids.has(step.id)) return subtasks === step.subtasks ? step : { ...step, subtasks }
      const next: Subtask = { ...step, completed: false, subtasks }
      delete next.completedAt
      return next
    })
  return walk(steps ?? [])
}

/** Apply the sheet's step ticks and estimates. Completing a finished branch ticks its parent. */
export function applyDebriefSteps(
  steps: readonly Subtask[] | undefined,
  before: readonly DebriefStep[],
  edits: readonly DebriefStepEdit[],
  now = new Date(),
): Subtask[] {
  let tree: Subtask[] = [...(steps ?? [])]
  for (const edit of edits) {
    const prev = before.find((row) => row.stepId === edit.stepId)
    if (!prev) continue
    if ((prev.estimated ?? null) !== edit.estimated) tree = setEstimate(tree, edit.stepId, edit.estimated ?? 0)
    if (prev.completed === edit.completed) continue
    tree = edit.completed ? finishStep(tree, edit.stepId, prev.sittingMinutes ?? undefined, now) : openIds(tree, edit.stepId)
  }
  return tree
}

function reviewFields(answers: DebriefAnswers): TimeLogSessionReview | undefined {
  const review: TimeLogSessionReview = {}
  if (answers.satisfaction && answers.satisfaction >= 1 && answers.satisfaction <= 5) review.satisfaction = answers.satisfaction
  if (answers.energy) review.energy = answers.energy
  const blocker = answers.blocker.trim()
  if (blocker) review.blocker = blocker
  const handoff = answers.handoff.trim()
  if (handoff) review.handoff = handoff
  return Object.keys(review).length ? review : undefined
}

function withLogMinutes(logs: TimeLogEntry[], ids: string[], minutes: number): TimeLogEntry[] {
  const chosen = logs.filter((log) => ids.includes(log.id))
  if (!chosen.length) return logs
  if (chosen.length === 1) {
    const id = chosen[0].id
    return logs.map((log) => (log.id === id ? { ...log, durationMinutes: Math.max(0, minutes) } : log))
  }
  const last = chosen[chosen.length - 1]
  const others = chosen.slice(0, -1).reduce((sum, log) => sum + log.durationMinutes, 0)
  const lastMinutes = Math.max(0, minutes - others)
  return logs.map((log) => (log.id === last.id ? { ...log, durationMinutes: lastMinutes } : log))
}

function patchLogs(logs: TimeLogEntry[] | undefined, draft: SessionDebriefDraft, answers: DebriefAnswers): TimeLogEntry[] {
  const review = reviewFields(answers)
  const note = answers.note.trim()
  let next = [...(logs ?? [])]
  const known = next.filter((log) => draft.timeLogIds.includes(log.id))
  if (!known.length && draft.taskId && answers.logMinutes >= 1) {
    const started = new Date(draft.startedAt)
    const ended = new Date(draft.endedAt)
    next.push({
      id: `tl-debrief-${draft.startedAt}`,
      date: formatLocalDateKey(started),
      startTime: hhmm(started),
      endTime: hhmm(ended),
      durationMinutes: answers.logMinutes,
      notes: note || undefined,
      taskId: draft.taskId,
      ...(draft.stepId ? { stepId: draft.stepId } : {}),
      ...(draft.trackingEntryIds.length ? { entryIds: [...draft.trackingEntryIds] } : {}),
      ...(review ? { sessionReview: review } : {}),
    })
    return next
  }
  let stamped = false
  next = next.map((log) => {
    if (!draft.timeLogIds.includes(log.id)) return log
    const row: TimeLogEntry = { ...log, notes: note || undefined }
    if (!stamped && review) {
      row.sessionReview = review
      stamped = true
    }
    return row
  })
  return withLogMinutes(next, draft.timeLogIds, answers.logMinutes)
}

function penFace(scopeId: string | undefined, penId: string | undefined): { name: string; color: string } | undefined {
  if (!scopeId || !penId) return undefined
  const scope = useTimeTrackingStore.getState().scopes.find((row) => row.id === scopeId)
  const pen = scope?.pens.find((row) => row.id === penId)
  return pen ? { name: pen.name, color: pen.color } : undefined
}

/** Open the sheet for a pen clock that just stopped. A null session does nothing. */
export function offerPenDebrief(session: PenColorSession | null, endedAt = new Date()): void {
  if (!session) return
  const task = session.taskId ? useTaskStore.getState().tasks.find((row) => row.id === session.taskId) : undefined
  const draft = buildPenDraft(session, endedAt, task, penFace(session.scopeId, session.penId))
  if (!draft.note) {
    const entry = useTimeTrackingStore.getState().entries.find((row) => session.trackingEntryIds.includes(row.id) && row.notes)
    if (entry?.notes) draft.note = entry.notes
  }
  useSessionDebriefStore.getState().open(draft)
}

/** Open the sheet for an operation clock that just stopped. */
export function offerWorkDebrief(session: WorkSession | null, endedAt = new Date()): void {
  if (!session) return
  const task = useTaskStore.getState().tasks.find((row) => row.id === session.operationId)
  useSessionDebriefStore.getState().open(buildWorkDraft(session, endedAt, task, penFace(session.scopeId, session.penId)))
}

/** Stop the pen clock from a Stop key, then open the sitting review. */
export function reviewPenStop(park: boolean, now = new Date()): void {
  offerPenDebrief(stopPenColorSession(now, park ? { parkUnfinished: true } : undefined), now)
}

/** Stop the operation clock from a Stop key, then open the sitting review. */
export function reviewWorkStop(park: boolean, now = new Date()): void {
  offerWorkDebrief(stopWorkingOnOperation(now, park ? { parkUnfinished: true } : undefined), now)
}

/** Write the sheet. One undo step. Close does not call this. */
export function saveSessionDebrief(draft: SessionDebriefDraft, answers: DebriefAnswers, now = new Date()): void {
  runAsAction("save sitting notes", () => {
    const task = draft.taskId ? useTaskStore.getState().tasks.find((row) => row.id === draft.taskId) : undefined
    if (task) {
      const next: Task = {
        ...task,
        subtasks: applyDebriefSteps(task.subtasks, draft.steps, answers.steps, now),
        timeLogs: patchLogs(task.timeLogs, draft, answers),
      }
      if (answers.taskCompleted !== Boolean(task.completed)) {
        next.completed = answers.taskCompleted
        if (answers.taskCompleted) next.completedDate = now
        else delete next.completedDate
      }
      if ((minutesOrNull(task.estimatedDuration) ?? null) !== answers.taskEstimate) {
        if (answers.taskEstimate && answers.taskEstimate > 0) next.estimatedDuration = answers.taskEstimate
        else delete next.estimatedDuration
      }
      useTaskStore.getState().updateTask(next)
    }

    const note = answers.note.trim()
    for (const id of draft.trackingEntryIds) {
      const entry = useTimeTrackingStore.getState().entries.find((row) => row.id === id)
      if (!entry) continue
      const field = clockNoteField(entry.notes, note)
      if (field) useTimeTrackingStore.getState().updateEntry(id, field)
    }

    const handoff = answers.handoff.trim()
    if (handoff && ((answers.handoffTask && draft.taskId) || (answers.handoffPen && draft.penId))) {
      useSessionDebriefStore.getState().leaveHandoff({
        text: handoff,
        at: now.toISOString(),
        ...(answers.handoffTask && draft.taskId ? { taskId: draft.taskId } : {}),
        ...(answers.handoffPen && draft.penId ? { penId: draft.penId } : {}),
      })
    }

    const review = reviewFields(answers)
    const saved: SittingReview = {
      id: `srev-${draft.kind}-${draft.startedAt}`,
      kind: draft.kind,
      startedAt: draft.startedAt,
      endedAt: draft.endedAt,
      activeMinutes: answers.logMinutes,
      ...(draft.taskId ? { taskId: draft.taskId } : {}),
      ...(draft.stepId ? { stepId: draft.stepId } : {}),
      ...(draft.operationId ? { operationId: draft.operationId } : {}),
      ...(draft.penId ? { penId: draft.penId } : {}),
      ...(draft.scopeId ? { scopeId: draft.scopeId } : {}),
      ...(review?.satisfaction ? { satisfaction: review.satisfaction } : {}),
      ...(review?.energy ? { energy: review.energy } : {}),
      ...(review?.blocker ? { blocker: review.blocker } : {}),
      ...(review?.handoff ? { handoff: review.handoff } : {}),
      ...(note ? { note } : {}),
    }
    useSessionDebriefStore.getState().saveReview(saved)
  })
}

/** `+13m` over the estimate, `2m under`, or `even`. Blank when either side is missing. */
export function versusLabel(estimated: number | null, spent: number | null): string {
  if (estimated == null || spent == null) return ""
  const delta = spent - estimated
  if (delta === 0) return "even"
  return delta > 0 ? `${delta}m over` : `${-delta}m under`
}
