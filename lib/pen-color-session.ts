/**
 * lib/pen-color-session.ts — "Working on right now" for a Tracking pen
 *
 * Pick a pen color and start. The clock begins at that exact second. Tracking
 * stores minutes, so the block starts at the minute that contains this second
 * and grows until stop — same slice math as an Operations work session, but
 * the paint is the pen you chose, in that pen's own view. It does not write a
 * Done row or touch the Operations session.
 *
 * A task may ride the clock (`taskId` / `stepId`, set by `lib/task-clock.ts`).
 * Then the painted blocks carry the task and step, Stop logs the span on the
 * task (`lib/task-clock-log.ts`), and objectives tied to steps tick them.
 */
import type { TrackPen } from "@/lib/time-tracking-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { syncTrackedHabits } from "@/lib/habit-tracking-sync"
import { isRestoring, runAsAction, withoutUndo } from "@/lib/action-history"
import {
  sessionActiveEnd,
  splitIntoDaySlices,
  WORK_SESSION_TICK_MS,
  type WorkDaySlice,
} from "@/lib/operation-work-session"
import { usePenColorSessionStore, type PenColorSession } from "@/lib/pen-color-session-store"
import {
  addNowObjective,
  compactNowObjectives,
  editNowObjectiveText,
  parseObjectiveClock,
  removeNowObjective,
  tieNowObjectiveToStep,
  toggleNowObjectiveComplete,
  type NowObjective,
} from "@/lib/now-objective"
import {
  addStepForObjective,
  applyObjectiveToStep,
  logTaskClockSpan,
  matchStepForObjective,
} from "@/lib/task-clock-log"
import { sessionElapsedMs as elapsedMsOf } from "@/lib/operation-work-session"

/** Block fields that follow the task on the clock. Empty for a plain pen clock. */
function taskFields(session: Pick<PenColorSession, "taskId" | "stepId">): { taskId?: string; stepId?: string } {
  return session.taskId ? { taskId: session.taskId, stepId: session.stepId } : {}
}

export { WORK_SESSION_TICK_MS as PEN_COLOR_SESSION_TICK_MS }
export {
  isSessionPaused,
  sessionElapsedMs,
  sessionActiveEnd,
} from "@/lib/operation-work-session"

function writeObjectivesOnto(ids: string[], nowObjectives: NowObjective[] | undefined): void {
  const tracking = useTimeTrackingStore.getState()
  const next = compactNowObjectives(nowObjectives)
  for (const id of ids) {
    tracking.updateEntry(id, { nowObjectives: next })
  }
}

function patchPenColorObjectives(
  mutate: (list: NowObjective[] | undefined) => NowObjective[],
): PenColorSession | null {
  const session = usePenColorSessionStore.getState().session
  if (!session) return null
  const mutated = mutate(session.nowObjectives)
  const nowObjectives = mutated.length ? mutated : undefined
  const next: PenColorSession = { ...session, nowObjectives }
  usePenColorSessionStore.getState().setSession(next)
  writeObjectivesOnto(session.trackingEntryIds ?? [], nowObjectives)
  return next
}

function locatePen(penId: string): { scopeId: string; pen: TrackPen } | null {
  const { scopes } = useTimeTrackingStore.getState()
  for (const scope of scopes) {
    const pen = scope.pens.find((p) => p.id === penId)
    if (pen) return { scopeId: scope.id, pen }
  }
  return null
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

function paintSlices(
  slices: WorkDaySlice[],
  session: Pick<PenColorSession, "scopeId" | "penId" | "title" | "startedAt" | "nowObjectives" | "taskId" | "stepId">,
): string[] {
  const tracking = useTimeTrackingStore.getState()
  const spanId = `pen-color-${session.startedAt}`
  const ids: string[] = []
  const nowObjectives = compactNowObjectives(session.nowObjectives)
  for (const slice of slices) {
    tracking.paintMinutes(slice.date, session.scopeId, slice.startMin, slice.endMin, session.penId, undefined, spanId)
    const id = coveringEntryId(slice.date, session.scopeId, session.penId, slice.startMin)
    if (id) {
      tracking.updateEntry(id, { title: session.title, nowObjectives, ...taskFields(session) })
      ids.push(id)
    }
  }
  return ids
}

function extendLiveEntry(session: PenColorSession, now: Date): string[] {
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

    tracking.paintMinutes(
      slice.date,
      session.scopeId,
      slice.startMin,
      slice.endMin,
      session.penId,
      undefined,
      `pen-color-${session.startedAt}`,
    )
    const id = coveringEntryId(slice.date, session.scopeId, session.penId, slice.startMin)
    if (id) {
      tracking.updateEntry(id, {
        title: session.title,
        nowObjectives: compactNowObjectives(session.nowObjectives),
        ...taskFields(session),
      })
      ids.push(id)
    }
  }
  return ids
}

function syncSliceDays(ids: string[], slices: WorkDaySlice[]): void {
  const dates = new Set(slices.map((slice) => slice.date))
  for (const id of ids) {
    const entry = useTimeTrackingStore.getState().entries.find((e) => e.id === id)
    if (entry) dates.add(entry.date)
  }
  if (dates.size > 0) syncTrackedHabits([...dates])
}

/** Begin a live block of this pen. The clock's first instant is `now`, seconds included. */
export function startPenColorSession(penId: string, now = new Date()): PenColorSession | null {
  return runAsAction("start pen color", () => {
    const current = usePenColorSessionStore.getState().session
    if (current?.penId === penId) return current
    if (current) stopPenColorSession(now)

    const located = locatePen(penId)
    if (!located) return null

    const slices = splitIntoDaySlices(now, new Date(now.getTime() + 60_000))
    const draft: PenColorSession = {
      penId: located.pen.id,
      scopeId: located.scopeId,
      title: located.pen.name,
      startedAt: now.toISOString(),
      trackingEntryIds: [],
    }
    const trackingEntryIds = paintSlices(slices, draft)
    const session: PenColorSession = { ...draft, trackingEntryIds }
    usePenColorSessionStore.getState().setSession(session)
    syncSliceDays(trackingEntryIds, slices)
    return session
  })
}

/** Close the live pen block at active end and leave the painted minutes editable. */
export function stopPenColorSession(now = new Date()): PenColorSession | null {
  return runAsAction("stop pen color", () => {
    const session = usePenColorSessionStore.getState().session
    if (!session) return null

    let ids = session.trackingEntryIds ?? []
    const end = sessionActiveEnd(session, now)
    if (locatePen(session.penId)) {
      const slices = splitIntoDaySlices(new Date(session.startedAt), end)
      ids = paintSlices(slices, session)
      syncSliceDays(ids, slices)
    }

    usePenColorSessionStore.getState().clearSession()
    if (session.taskId) {
      logTaskClockSpan(
        { taskId: session.taskId, stepId: session.stepId, trackingEntryIds: ids },
        new Date(session.startedAt),
        now,
        elapsedMsOf(session, now.getTime()),
      )
    }
    return session
  })
}

/** Grow the live block up to active end. Silenced from undo. */
export function tickPenColorSession(now = new Date()): PenColorSession | null {
  return withoutUndo(() => {
    const session = usePenColorSessionStore.getState().session
    if (!session || isRestoring()) return session ?? null
    if (!locatePen(session.penId)) {
      usePenColorSessionStore.getState().clearSession()
      return null
    }
    const ids = extendLiveEntry(session, sessionActiveEnd(session, now))
    const next = { ...session, trackingEntryIds: ids }
    usePenColorSessionStore.getState().setSession(next)
    syncSliceDays(ids, [])
    return next
  })
}

/** Freeze elapsed + paint; resume continues the same session. */
export function pausePenColorSession(now = new Date()): PenColorSession | null {
  return withoutUndo(() => {
    const session = usePenColorSessionStore.getState().session
    if (!session || session.pausedAt) return session
    usePenColorSessionStore.getState().setSession({ ...session, pausedAt: now.toISOString() })
    return tickPenColorSession(now)
  })
}

/** Clear the open pause and fold its duration into `pausedAccumMs`. */
export function resumePenColorSession(now = new Date()): PenColorSession | null {
  return withoutUndo(() => {
    const session = usePenColorSessionStore.getState().session
    if (!session?.pausedAt) return session
    const pauseMs = Math.max(0, now.getTime() - new Date(session.pausedAt).getTime())
    const next: PenColorSession = {
      ...session,
      pausedAt: undefined,
      pausedAccumMs: (session.pausedAccumMs ?? 0) + pauseMs,
    }
    usePenColorSessionStore.getState().setSession(next)
    return next
  })
}

export function togglePenColorSession(penId: string, now = new Date()): PenColorSession | null {
  const session = usePenColorSessionStore.getState().session
  if (session?.penId === penId) {
    stopPenColorSession(now)
    return null
  }
  return startPenColorSession(penId, now)
}

/**
 * Add an objective for right now on the live pen-color block. A leading clock
 * (`NOW 847 …`, `8:47 …`) backdates it. With a task on the clock, a line that
 * names an open step is tied to that step; `stepId` ties it explicitly.
 */
export function addPenColorNowObjective(text: string, now = new Date(), stepId?: string): PenColorSession | null {
  const parsed: { text: string; at?: Date } = stepId ? { text } : parseObjectiveClock(text, now)
  const session = usePenColorSessionStore.getState().session
  const tied = stepId ?? (session?.taskId ? matchStepForObjective(session.taskId, parsed.text) : undefined)
  return withoutUndo(() =>
    patchPenColorObjectives((list) => addNowObjective(list, parsed.text, now, { stepId: tied, addedAt: parsed.at })),
  )
}

/**
 * Point an objective at a step of the task on the clock. `"new"` makes a step
 * from the objective's text (beside the step on the clock); `undefined` unties it.
 */
export function tiePenColorNowObjective(id: string, stepId: string | "new" | undefined): PenColorSession | null {
  const session = usePenColorSessionStore.getState().session
  if (!session) return null
  const objective = session.nowObjectives?.find((row) => row.id === id)
  if (!objective) return session
  let target = stepId === "new" ? undefined : stepId
  if (stepId === "new") {
    target = addStepForObjective({ taskId: session.taskId, stepId: session.stepId }, objective)
    if (!target) return session
  }
  const next = withoutUndo(() => patchPenColorObjectives((list) => tieNowObjectiveToStep(list, id, target)))
  const tiedRow = next?.nowObjectives?.find((row) => row.id === id)
  if (tiedRow?.stepId && tiedRow.completedAt && stepId !== "new") applyObjectiveToStep(next ?? {}, tiedRow)
  return next
}

export function editPenColorNowObjectiveText(id: string, text: string): PenColorSession | null {
  return withoutUndo(() => patchPenColorObjectives((list) => editNowObjectiveText(list, id, text)))
}

export function togglePenColorNowObjectiveComplete(id: string, now = new Date()): PenColorSession | null {
  const next = withoutUndo(() => patchPenColorObjectives((list) => toggleNowObjectiveComplete(list, id, now)))
  const row = next?.nowObjectives?.find((o) => o.id === id)
  if (next?.taskId && row?.stepId) applyObjectiveToStep(next, row)
  return next
}

/**
 * Put a task (and optionally one of its steps) on the live clock without
 * splitting the pen block. The blocks painted so far take the task and step.
 */
export function setPenColorSessionTask(
  ref: { taskId: string; stepId?: string; title?: string } | null,
): PenColorSession | null {
  const session = usePenColorSessionStore.getState().session
  if (!session) return null
  const next: PenColorSession = { ...session }
  if (ref) {
    next.taskId = ref.taskId
    if (ref.stepId) next.stepId = ref.stepId
    else delete next.stepId
    if (ref.title) next.title = ref.title
  } else {
    delete next.taskId
    delete next.stepId
  }
  usePenColorSessionStore.getState().setSession(next)
  const tracking = useTimeTrackingStore.getState()
  for (const entryId of next.trackingEntryIds ?? []) {
    tracking.updateEntry(entryId, { title: next.title, taskId: next.taskId, stepId: next.stepId })
  }
  return next
}

export function removePenColorNowObjective(id: string): PenColorSession | null {
  return withoutUndo(() => patchPenColorObjectives((list) => removeNowObjective(list, id)))
}
