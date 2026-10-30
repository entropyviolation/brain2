/**
 * lib/operation-work-session.ts — "Working on this now" for Operations
 *
 * A live work session on an Operation is one clock: start stamps the minute,
 * stop writes what actually happened. The same span lands in four Home
 * surfaces so they cannot disagree:
 *
 *   1. To Do → Done ("worked on {name}") for that day / week / month
 *   2. the operation's `timeLogs` (Operations Log + Tracking Day Log)
 *   3. Tracking's minute-accurate Activity grid (editable like any other block)
 *   4. Habits, when the operation carries Tracking tags a daily habit links
 *
 * Pure slice math lives here so tests don't need stores; `startWorkingOnOperation`
 * / `stopWorkingOnOperation` / `tickWorkSession` talk to the task, tracking, and
 * work-session stores. Tracking blocks stay user-editable — this module paints
 * them, it does not lock them.
 */
import type { Task, TimeLogEntry } from "@/lib/types"
import { LOGGED_ACTION_TYPE_ID } from "@/lib/item-types"
import { taskRepository } from "@/lib/data/task-repository"
import { formatLocalDateKey, startOfLocalDay } from "@/lib/date-utils"
import {
  OPERATION_ATTR,
  getOperationTrackingTagIds,
} from "@/lib/operation-types"
import { minutesToTimeString, MINUTES_PER_DAY } from "@/lib/time-entries"
import {
  PEN_PALETTE,
  findPen,
  useTimeTrackingStore,
} from "@/lib/time-tracking-store"
import { syncTrackedHabits } from "@/lib/habit-tracking-sync"
import { useWorkSessionStore, type WorkSession } from "@/lib/work-session-store"
import { isRestoring, runAsAction, withoutUndo } from "@/lib/action-history"
import {
  addCompletedNowObjective,
  addNowObjective,
  attachNowObjective,
  bankOpenStint,
  compactNowObjectives,
  editNowObjectiveText,
  moveNowObjectiveToNext,
  moveNowObjectiveToNow,
  removeNowObjective,
  toggleNowObjectiveComplete,
  type NowObjective,
  type NowObjectiveLane,
} from "@/lib/now-objective"
import {
  createTaskForObjective,
  fileObjectivesOnTask,
  homeForObjective,
  homesForOperation,
  mergeResumed,
  objectivesAttachedToTask,
  toParked,
} from "@/lib/unfinished-objectives"
import { useUnfinishedObjectivesStore } from "@/lib/unfinished-objectives-store"
import {
  appendPause,
  closeOpenPause,
  isHoldPause,
  mergeSittingNote,
  pauseReasonText,
  resumeOpenPause,
  type PauseRequest,
  type WorkPauseSpan,
} from "@/lib/work-pause"

export const ACTIVITY_SCOPE_ID = "activity"
export const WORK_SESSION_TICK_MS = 15_000

/** One calendar day's portion of a session (times are minutes past local midnight). */
export interface WorkDaySlice {
  date: string
  startMin: number
  endMin: number
  durationMinutes: number
}

export function workedOnTitle(operationName: string): string {
  const name = operationName.trim() || "operation"
  return `worked on ${name}`
}

export function formatElapsedClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  return `${m}:${String(s).padStart(2, "0")}`
}

/** Fields both work sessions use to freeze the clock across pause/resume. */
export type SessionClockFields = {
  startedAt: string
  pausedAt?: string
  pausedAccumMs?: number
}

export function isSessionPaused(session: SessionClockFields): boolean {
  return Boolean(session.pausedAt)
}

/**
 * Active elapsed ms: wall time since start, minus completed pauses and any
 * open pause. Painted Tracking minutes use the same clock via `sessionActiveEnd`.
 */
export function sessionElapsedMs(session: SessionClockFields, nowMs = Date.now()): number {
  const started = new Date(session.startedAt).getTime()
  if (Number.isNaN(started)) return 0
  const accum = session.pausedAccumMs ?? 0
  const openPause = session.pausedAt
    ? Math.max(0, nowMs - new Date(session.pausedAt).getTime())
    : 0
  return Math.max(0, nowMs - started - accum - openPause)
}

/** End instant of active work (start + elapsed), so pause gaps are not painted. */
export function sessionActiveEnd(session: SessionClockFields, now = new Date()): Date {
  return new Date(new Date(session.startedAt).getTime() + sessionElapsedMs(session, now.getTime()))
}

/** Re-export: local midnight for session day-slice math. */
export { startOfLocalDay }

function atLocalMinutes(dateKey: string, minutes: number): Date {
  const [y, mo, d] = dateKey.split("-").map(Number)
  const clamped = Math.min(Math.max(0, minutes), MINUTES_PER_DAY - 1)
  return new Date(y, mo - 1, d, Math.floor(clamped / 60), clamped % 60, 0, 0)
}

/**
 * Split `[startedAt, endedAt]` onto local calendar days. A zero-length span is
 * bumped to one minute so a tap-and-release still leaves a record.
 */
export function splitIntoDaySlices(startedAt: Date, endedAt: Date): WorkDaySlice[] {
  let end = endedAt
  if (end.getTime() <= startedAt.getTime()) {
    end = new Date(startedAt.getTime() + 60_000)
  }
  const slices: WorkDaySlice[] = []
  let cursor = new Date(startedAt)
  while (cursor < end) {
    const date = formatLocalDateKey(cursor)
    const dayStart = startOfLocalDay(cursor)
    const dayEnd = new Date(dayStart.getTime() + MINUTES_PER_DAY * 60_000)
    const sliceEnd = end < dayEnd ? end : dayEnd
    const startMin = Math.floor((cursor.getTime() - dayStart.getTime()) / 60_000)
    let endMin = Math.ceil((sliceEnd.getTime() - dayStart.getTime()) / 60_000)
    if (endMin <= startMin) endMin = startMin + 1
    endMin = Math.min(endMin, MINUTES_PER_DAY)
    slices.push({
      date,
      startMin,
      endMin,
      durationMinutes: endMin - startMin,
    })
    cursor = sliceEnd
  }
  return slices
}

export function workDoneLogId(operationId: string, startedAtIso: string, date: string): string {
  return `op-work-${operationId}-${startedAtIso}-${date}`
}

export function workTimeLogId(operationId: string, startedAtIso: string, date: string): string {
  return `op-work-log-${operationId}-${startedAtIso}-${date}`
}

export function buildWorkedOnDoneItem(input: {
  operation: Pick<Task, "id" | "description" | "tags">
  slice: WorkDaySlice
  startedAtIso: string
  tagNames?: string[]
}): Task {
  const startedAt = atLocalMinutes(input.slice.date, input.slice.startMin)
  const completedAt = atLocalMinutes(input.slice.date, input.slice.endMin)
  const title = workedOnTitle(input.operation.description)
  const tags = ["operation", ...(input.tagNames ?? [])]
  return {
    id: workDoneLogId(input.operation.id, input.startedAtIso, input.slice.date),
    description: title,
    title,
    type: LOGGED_ACTION_TYPE_ID,
    loggedAction: true,
    stage: "completed",
    status: "done",
    createdAt: startedAt,
    completed: true,
    completedDate: completedAt,
    startedAt,
    scheduledDate: startedAt,
    actualDuration: input.slice.durationMinutes,
    estimatedDuration: input.slice.durationMinutes,
    lists: [],
    tags: [...new Set(tags.filter(Boolean))],
    links: [],
    rewardValue: 0,
    attributes: {
      sourceOperationId: input.operation.id,
      workSessionStartedAt: input.startedAtIso,
    },
  }
}

export function buildWorkTimeLog(input: {
  operationId: string
  title: string
  slice: WorkDaySlice
  startedAtIso: string
  pauseSpans?: readonly WorkPauseSpan[]
  endedAt?: Date
}): TimeLogEntry {
  const spans = input.pauseSpans?.length ? input.pauseSpans.map((span) => ({ ...span })) : undefined
  const notes =
    (spans
      ? mergeSittingNote({
          existing: undefined,
          base: input.title,
          owned: true,
          replaceOwned: true,
          startedAt: input.startedAtIso,
          endedAt: input.endedAt,
          spans,
          stopped: true,
        })
      : undefined) ?? input.title
  return {
    id: workTimeLogId(input.operationId, input.startedAtIso, input.slice.date),
    date: input.slice.date,
    startTime: minutesToTimeString(input.slice.startMin),
    endTime: minutesToTimeString(input.slice.endMin),
    durationMinutes: input.slice.durationMinutes,
    notes,
    activityLabel: input.title,
    taskId: input.operationId,
    ...(spans ? { pauseSpans: spans } : {}),
  }
}

function mirrorOperationSitting(
  session: WorkSession,
  ids: string[],
  clock?: { endedAt?: Date; stopped?: boolean },
): void {
  if (!session.pauseSpans?.length) return
  const tracking = useTimeTrackingStore.getState()
  const base = workedOnTitle(session.title)
  const spans = session.pauseSpans.map((span) => ({ ...span }))
  for (const id of ids) {
    const entry = tracking.entries.find((row) => row.id === id)
    const owned = !entry?.notes || entry.notes.startsWith("worked on ")
    const notes = mergeSittingNote({
      existing: entry?.notes,
      base,
      owned,
      startedAt: session.startedAt,
      endedAt: clock?.endedAt,
      spans,
      stopped: clock?.stopped,
    })
    tracking.updateEntry(id, {
      ...(notes !== undefined ? { notes } : {}),
      pauseSpans: spans,
    })
  }
}

function penColorFor(operationId: string): string {
  let hash = 0
  for (let i = 0; i < operationId.length; i++) {
    hash = (hash * 31 + operationId.charCodeAt(i)) >>> 0
  }
  return PEN_PALETTE[hash % PEN_PALETTE.length]
}

function activityScopeId(): string {
  const { scopes } = useTimeTrackingStore.getState()
  return scopes.find((s) => s.id === ACTIVITY_SCOPE_ID)?.id ?? scopes[0]?.id ?? ACTIVITY_SCOPE_ID
}

function coveringEntryId(date: string, scopeId: string, penId: string, minute: number): string | undefined {
  return useTimeTrackingStore
    .getState()
    .entries.find(
      (entry) =>
        entry.date === date &&
        entry.scopeId === scopeId &&
        entry.penId === penId &&
        entry.startMin <= minute &&
        entry.endMin > minute,
    )?.id
}

/**
 * Create or refresh the Activity pen this operation paints with, carrying its
 * Tracking tags so linked habits see the minutes.
 */
export function ensureOperationPen(operation: Task): { scopeId: string; penId: string } | null {
  const tracking = useTimeTrackingStore.getState()
  const scopeId = activityScopeId()
  const scope = tracking.scopes.find((s) => s.id === scopeId)
  if (!scope) return null

  const tagIds = getOperationTrackingTagIds(operation)
  const storedPenId =
    typeof operation.attributes?.[OPERATION_ATTR.trackingPenId] === "string"
      ? (operation.attributes[OPERATION_ATTR.trackingPenId] as string)
      : ""
  const existing = storedPenId ? findPen(tracking.scopes, storedPenId) : undefined
  const existingScope = existing
    ? tracking.scopes.find((s) => s.pens.some((p) => p.id === existing.id))
    : undefined

  if (existing && existingScope) {
    tracking.updatePen(existingScope.id, {
      ...existing,
      name: operation.description,
      tags: tagIds,
    })
    return { scopeId: existingScope.id, penId: existing.id }
  }

  const penId = tracking.addPen(scopeId, {
    name: operation.description,
    color: penColorFor(operation.id),
    tags: tagIds,
  })
  const store = operation
  taskRepository.update({
    ...store,
    attributes: { ...(store.attributes ?? {}), [OPERATION_ATTR.trackingPenId]: penId },
  })
  return { scopeId, penId }
}

function paintSlices(
  slices: WorkDaySlice[],
  scopeId: string,
  penId: string,
  title: string,
  spanId?: string,
  nowObjectives?: NowObjective[],
): string[] {
  const tracking = useTimeTrackingStore.getState()
  const ids: string[] = []
  const objectives = compactNowObjectives(nowObjectives)
  for (const slice of slices) {
    const previous = tracking.entries.find(
      (entry) =>
        entry.date === slice.date &&
        entry.scopeId === scopeId &&
        entry.penId === penId &&
        entry.startMin <= slice.startMin &&
        entry.endMin >= slice.startMin,
    )
    tracking.paintMinutes(slice.date, scopeId, slice.startMin, slice.endMin, penId, undefined, spanId)
    const id = coveringEntryId(slice.date, scopeId, penId, slice.startMin)
    if (id) {
      tracking.updateEntry(id, {
        title,
        notes: previous?.notes,
        nowObjectives: objectives ?? previous?.nowObjectives,
      })
      ids.push(id)
    }
  }
  return ids
}

function writeWorkObjectivesOnto(ids: string[], nowObjectives: NowObjective[] | undefined): void {
  const tracking = useTimeTrackingStore.getState()
  const next = compactNowObjectives(nowObjectives)
  for (const id of ids) {
    tracking.updateEntry(id, { nowObjectives: next })
  }
}

function patchWorkNowObjectives(
  mutate: (list: NowObjective[] | undefined) => NowObjective[],
): WorkSession | null {
  const session = useWorkSessionStore.getState().session
  if (!session) return null
  const mutated = mutate(session.nowObjectives)
  const nowObjectives = mutated.length ? mutated : undefined
  const next: WorkSession = { ...session, nowObjectives }
  useWorkSessionStore.getState().setSession(next)
  writeWorkObjectivesOnto(session.trackingEntryIds ?? [], nowObjectives)
  return next
}

/**
 * True when the painted Tracking block already ends at the rounded active end,
 * so a tick would rewrite identical data (store writes persist the whole blob).
 * Any drift (user moved the block, pen changed, entry missing) returns false.
 */
export function liveEntryUpToDate(
  session: Pick<WorkSession, "startedAt" | "penId" | "scopeId" | "trackingEntryIds">,
  end: Date,
): boolean {
  const ids = session.trackingEntryIds ?? []
  if (ids.length === 0) return false
  const slices = splitIntoDaySlices(new Date(session.startedAt), end)
  if (slices.length !== ids.length) return false
  const last = slices[slices.length - 1]
  const entries = useTimeTrackingStore.getState().entries
  const live = entries.find(
    (e) => e.date === last.date && ids.includes(e.id),
  )
  return Boolean(
    live &&
      live.penId === session.penId &&
      live.scopeId === session.scopeId &&
      live.startMin === last.startMin &&
      live.endMin === last.endMin,
  )
}

function extendLiveEntry(session: WorkSession, now: Date): string[] {
  const slices = splitIntoDaySlices(new Date(session.startedAt), now)
  const tracking = useTimeTrackingStore.getState()
  const ids: string[] = []

  for (let i = 0; i < slices.length; i++) {
    const slice = slices[i]
    const isLive = i === slices.length - 1
    const existingId = (session.trackingEntryIds ?? []).find((id) => {
      const entry = tracking.entries.find((e) => e.id === id)
      return entry?.date === slice.date
    })
    const live = existingId ? tracking.entries.find((e) => e.id === existingId) : undefined

    if (isLive && live && live.penId === session.penId && live.scopeId === session.scopeId) {
      tracking.moveEntryTo(live.id, slice.startMin, slice.endMin)
      const still = tracking.entries.find((e) => e.id === live.id)
      ids.push(still?.id ?? coveringEntryId(slice.date, session.scopeId, session.penId, slice.startMin) ?? live.id)
      continue
    }

    tracking.paintMinutes(slice.date, session.scopeId, slice.startMin, slice.endMin, session.penId, undefined, `work-${session.startedAt}`)
    const id = coveringEntryId(slice.date, session.scopeId, session.penId, slice.startMin)
    if (id) {
      tracking.updateEntry(id, {
        title: session.title,
        nowObjectives: compactNowObjectives(session.nowObjectives),
      })
      ids.push(id)
    }
  }
  if (session.pauseSpans?.length) {
    const fresh = useTimeTrackingStore.getState()
    const missing = ids.filter((id) => !fresh.entries.find((row) => row.id === id)?.pauseSpans?.length)
    if (missing.length) mirrorOperationSitting(session, missing)
  }
  return ids
}

function writeDoneAndTimeLogs(operation: Task, slices: WorkDaySlice[], session: WorkSession, endedAt: Date): void {
  const tagNames = (() => {
    const ids = new Set(getOperationTrackingTagIds(operation))
    if (ids.size === 0) return []
    return useTimeTrackingStore
      .getState()
      .tags.filter((tag) => ids.has(tag.id))
      .map((tag) => tag.name)
  })()
  const title = workedOnTitle(operation.description)
  let nextLogs = [...(operation.timeLogs ?? [])]

  for (const slice of slices) {
    const done = buildWorkedOnDoneItem({ operation, slice, startedAtIso: session.startedAt, tagNames })
    const existingDone = taskRepository.getById(done.id)
    if (existingDone) taskRepository.update({ ...existingDone, ...done, id: done.id })
    else taskRepository.add(done)

    const log = buildWorkTimeLog({
      operationId: operation.id,
      title,
      slice,
      startedAtIso: session.startedAt,
      pauseSpans: session.pauseSpans,
      endedAt,
    })
    const logIndex = nextLogs.findIndex((entry) => entry.id === log.id)
    if (logIndex >= 0) nextLogs[logIndex] = log
    else nextLogs = [...nextLogs, log]
  }

  const actualDuration = nextLogs.reduce((sum, log) => sum + log.durationMinutes, 0)
  const latest = taskRepository.getById(operation.id)
  if (latest) {
    taskRepository.update({ ...latest, timeLogs: nextLogs, actualDuration })
  }
}

/** Begin (or switch to) a live session on this operation. */
export function startWorkingOnOperation(operationId: string, now = new Date()): WorkSession | null {
  return runAsAction("start work", () => {
  const current = useWorkSessionStore.getState().session
  if (current?.operationId === operationId) return current
  if (current) stopWorkingOnOperation(now)

  const operation = taskRepository.getById(operationId)
  if (!operation) return null

  const pen = ensureOperationPen(taskRepository.getById(operationId) ?? operation)
  const title = operation.description
  const slices = splitIntoDaySlices(now, new Date(now.getTime() + 60_000))
  let trackingEntryIds: string[] = []
  let scopeId = pen?.scopeId ?? activityScopeId()
  let penId = pen?.penId ?? ""

  if (pen) {
    trackingEntryIds = paintSlices(slices, pen.scopeId, pen.penId, title, `work-${now.toISOString()}`)
    scopeId = pen.scopeId
    penId = pen.penId
    syncTrackedHabits(slices.map((s) => s.date))
  }

  const session: WorkSession = {
    operationId,
    startedAt: now.toISOString(),
    title,
    scopeId,
    penId,
    trackingEntryIds,
  }
  const resumed = mergeResumed(
    undefined,
    useUnfinishedObjectivesStore.getState().take(homesForOperation(operationId)),
    now,
  )
  const next: WorkSession = resumed?.length ? { ...session, nowObjectives: resumed } : session
  useWorkSessionStore.getState().setSession(next)
  if (resumed?.length) writeWorkObjectivesOnto(trackingEntryIds, resumed)
  return next
  })
}

/** Close the live session and stamp Done / timeLogs / Tracking for the elapsed span. */
export function stopWorkingOnOperation(now = new Date(), opts?: { parkUnfinished?: boolean }): WorkSession | null {
  return runAsAction("stop work", () => {
  let session = useWorkSessionStore.getState().session
  if (!session) return null
  const end = sessionActiveEnd(session, now)
  if (opts?.parkUnfinished && session.nowObjectives?.length) {
    const banked = session.nowObjectives.map((row) => bankOpenStint(row, end))
    const parked = banked.flatMap((row) => {
      const home = homeForObjective(row, { ...session!, operationId: session!.operationId })
      const packed = home ? toParked(row, home) : null
      return packed ? [packed] : []
    })
    if (parked.length) useUnfinishedObjectivesStore.getState().upsert(parked)
    session = { ...session, nowObjectives: banked }
    useWorkSessionStore.getState().setSession(session)
  }

  const spans = closeOpenPause(session.pauseSpans, now)
  if (spans) session = { ...session, pauseSpans: spans }
  const operation = taskRepository.getById(session.operationId)
  const slices = splitIntoDaySlices(new Date(session.startedAt), end)

  if (operation && session.penId) {
    const ids = paintSlices(
      slices,
      session.scopeId,
      session.penId,
      session.title,
      `work-${session.startedAt}`,
      session.nowObjectives,
    )
    useWorkSessionStore.getState().setSession({ ...session, trackingEntryIds: ids })
    if (spans?.length) mirrorOperationSitting(session, ids, { endedAt: now, stopped: true })
    writeDoneAndTimeLogs(operation, slices, session, now)
    syncTrackedHabits(slices.map((s) => s.date))
  } else if (operation) {
    writeDoneAndTimeLogs(operation, slices, session, now)
  }

  useWorkSessionStore.getState().clearSession()
  return session
  })
}

/** Grow the live Tracking block up to active end without writing Done yet. */
export function tickWorkSession(now = new Date()): WorkSession | null {
  return withoutUndo(() => {
  const session = useWorkSessionStore.getState().session
  if (!session || isRestoring()) return session ?? null
  if (!session.penId) return session
  const end = sessionActiveEnd(session, now)
  if (liveEntryUpToDate(session, end)) return session
  const ids = extendLiveEntry(session, end)
  const next = { ...session, trackingEntryIds: ids }
  useWorkSessionStore.getState().setSession(next)
  syncTrackedHabits([...new Set(ids.flatMap((id) => {
    const entry = useTimeTrackingStore.getState().entries.find((e) => e.id === id)
    return entry ? [entry.date] : []
  }))])
  return next
  })
}

/**
 * Freeze elapsed + paint. A Pause click passes the gap reason.
 * Empty or missing reason does not pause. `{ hold: true }` freezes without a gap.
 */
export function pauseWorkingOnOperation(now = new Date(), request?: PauseRequest): WorkSession | null {
  return withoutUndo(() => {
    const session = useWorkSessionStore.getState().session
    if (!session || session.pausedAt) return session
    const hold = isHoldPause(request)
    const spans = hold ? session.pauseSpans : appendPause(session.pauseSpans, now, pauseReasonText(request))
    if (!hold && !spans) return session
    useWorkSessionStore.getState().setSession({
      ...session,
      pausedAt: now.toISOString(),
      ...(spans ? { pauseSpans: spans } : {}),
    })
    const ticked = tickWorkSession(now)
    const live = ticked ?? useWorkSessionStore.getState().session
    if (live?.pauseSpans?.length) mirrorOperationSitting(live, live.trackingEntryIds ?? [])
    return useWorkSessionStore.getState().session
  })
}

/** Clear the open pause, record restarted-at, and fold the gap into `pausedAccumMs`. */
export function resumeWorkingOnOperation(now = new Date()): WorkSession | null {
  return withoutUndo(() => {
    const session = useWorkSessionStore.getState().session
    if (!session?.pausedAt) return session
    const pauseMs = Math.max(0, now.getTime() - new Date(session.pausedAt).getTime())
    const pauseSpans = resumeOpenPause(session.pauseSpans, now)
    const next: WorkSession = {
      ...session,
      pausedAt: undefined,
      pausedAccumMs: (session.pausedAccumMs ?? 0) + pauseMs,
      ...(pauseSpans ? { pauseSpans } : {}),
    }
    useWorkSessionStore.getState().setSession(next)
    if (pauseSpans?.length) mirrorOperationSitting(next, next.trackingEntryIds ?? [])
    return next
  })
}

export function toggleWorkingOnOperation(operationId: string, now = new Date()): WorkSession | null {
  const session = useWorkSessionStore.getState().session
  if (session?.operationId === operationId) {
    stopWorkingOnOperation(now)
    return null
  }
  return startWorkingOnOperation(operationId, now)
}

/** Add an objective on the live Operations activity block, in Now or Next. */
export function addWorkNowObjective(
  text: string,
  now = new Date(),
  lane: NowObjectiveLane = "next",
): WorkSession | null {
  return withoutUndo(() => patchWorkNowObjectives((list) => addNowObjective(list, text, now, { lane })))
}

/** Already done during this sitting. Start is unknown, and not before the session began. */
export function addWorkCompletedObjective(text: string, now = new Date()): WorkSession | null {
  const session = useWorkSessionStore.getState().session
  if (!session) return null
  return withoutUndo(() =>
    patchWorkNowObjectives((list) => addCompletedNowObjective(list, text, new Date(session.startedAt), now)),
  )
}

/** Take the objective off this sitting without counting the open stint, and park it. */
export function saveWorkObjectiveForLater(id: string): WorkSession | null {
  const session = useWorkSessionStore.getState().session
  if (!session) return null
  const row = session.nowObjectives?.find((item) => item.id === id)
  if (!row || row.completedAt) return session
  const home = homeForObjective(row, { ...session, operationId: session.operationId })
  const parked = home ? toParked(row, home) : null
  return runAsAction("save objective for later", () => {
    if (parked) useUnfinishedObjectivesStore.getState().upsert([parked])
    return patchWorkNowObjectives((list) => removeNowObjective(list, id))
  })
}

/** Attach the objective to a task in this operation, or make a new task from its name. */
export function attachWorkNowObjective(
  id: string,
  target: { taskId: string; stepId?: string } | { createName: string },
): WorkSession | null {
  const session = useWorkSessionStore.getState().session
  if (!session) return null
  return runAsAction("attach objective", () => {
    const taskId =
      "createName" in target
        ? createTaskForObjective(
            target.createName,
            session.penId ? { scopeId: session.scopeId, penId: session.penId } : undefined,
          )
        : target.taskId
    if (!taskId) return session
    const stepId = "createName" in target ? undefined : target.stepId
    const next = patchWorkNowObjectives((list) => attachNowObjective(list, id, { taskId, stepId }))
    fileObjectivesOnTask(taskId, objectivesAttachedToTask(next?.nowObjectives, taskId))
    return next
  })
}

export function editWorkNowObjectiveText(id: string, text: string): WorkSession | null {
  return withoutUndo(() => patchWorkNowObjectives((list) => editNowObjectiveText(list, id, text)))
}

export function moveWorkNowObjectiveToNext(id: string, now = new Date()): WorkSession | null {
  return withoutUndo(() => patchWorkNowObjectives((list) => moveNowObjectiveToNext(list, id, now)))
}

export function moveWorkNowObjectiveToNow(id: string, now = new Date()): WorkSession | null {
  return withoutUndo(() => patchWorkNowObjectives((list) => moveNowObjectiveToNow(list, id, now)))
}

export function toggleWorkNowObjectiveComplete(id: string, now = new Date()): WorkSession | null {
  return withoutUndo(() => patchWorkNowObjectives((list) => toggleNowObjectiveComplete(list, id, now)))
}

export function removeWorkNowObjective(id: string): WorkSession | null {
  return withoutUndo(() => patchWorkNowObjectives((list) => removeNowObjective(list, id)))
}
