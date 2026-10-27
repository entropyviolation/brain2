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
 * Each painted block's notes say it was added from Working On Now, with the
 * task and the subtasks and objectives finished on this sitting. A note you
 * rewrote by hand is left as you wrote it.
 *
 * Only the header clock grows the block (`watchPenClockShown`). The Tracking
 * strip and the focus bar show the same sitting; they do not paint. The
 * sitting is persisted, so a refresh keeps the clock, the objectives, and the
 * task. A tick before the time grid has rehydrated does not drop a pen that
 * is not in the seed set yet. If the header clock is on screen and then off
 * screen, the sitting ends: the block gets an end, and the task and step stay
 * open.
 */
import type { TrackPen } from "@/lib/time-tracking-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { syncTrackedHabits } from "@/lib/habit-tracking-sync"
import { isRestoring, runAsAction, withoutUndo } from "@/lib/action-history"
import {
  sessionActiveEnd,
  splitIntoDaySlices,
  WORK_SESSION_TICK_MS,
  liveEntryUpToDate,
  type WorkDaySlice,
} from "@/lib/operation-work-session"
import { usePenColorSessionStore, type PenColorSession } from "@/lib/pen-color-session-store"
import {
  addCompletedNowObjective,
  addNowObjective,
  attachNowObjective,
  bankOpenStint,
  compactNowObjectives,
  editNowObjectiveText,
  moveNowObjectiveToNext,
  moveNowObjectiveToNow,
  parseObjectiveClock,
  removeNowObjective,
  setNowObjectiveCompletes,
  tieNowObjectiveToStep,
  toggleNowObjectiveComplete,
  type NowObjective,
  type NowObjectiveLane,
} from "@/lib/now-objective"
import {
  createTaskForObjective,
  fileObjectivesOnTask,
  homeForObjective,
  homesForPen,
  homesForTask,
  mergeResumed,
  objectivesAttachedToTask,
  toParked,
} from "@/lib/unfinished-objectives"
import { useUnfinishedObjectivesStore } from "@/lib/unfinished-objectives-store"
import {
  addStepForObjective,
  applyObjectiveToStep,
  clockNoteField,
  logTaskClockSpan,
  matchStepForObjective,
  WORKING_ON_NOW_NOTE_PREFIX,
  workingOnNowBlockNote,
} from "@/lib/task-clock-log"
import { sessionElapsedMs as elapsedMsOf } from "@/lib/operation-work-session"
import {
  appendPause,
  closeOpenPause,
  isHoldPause,
  mergeSittingNote,
  pauseReasonText,
  resumeOpenPause,
  type PauseRequest,
} from "@/lib/work-pause"

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

/** Title, task, objectives, the Working On Now note, and any pause timeline. A hand-written note keeps its words; a gap is appended under them. */
function stampClockEntries(
  session: Pick<PenColorSession, "title" | "taskId" | "stepId" | "nowObjectives" | "pauseSpans" | "startedAt">,
  ids: string[],
  clock?: { endedAt?: Date; stopped?: boolean },
): void {
  const tracking = useTimeTrackingStore.getState()
  const base = workingOnNowBlockNote(session)
  const nowObjectives = compactNowObjectives(session.nowObjectives)
  const spans = session.pauseSpans?.length ? session.pauseSpans.map((span) => ({ ...span })) : undefined
  for (const id of ids) {
    const entry = tracking.entries.find((row) => row.id === id)
    const owned = !entry?.notes || entry.notes.startsWith(WORKING_ON_NOW_NOTE_PREFIX)
    const notes = mergeSittingNote({
      existing: entry?.notes,
      base,
      owned,
      replaceOwned: true,
      startedAt: session.startedAt,
      endedAt: clock?.endedAt,
      spans,
      stopped: clock?.stopped,
    })
    tracking.updateEntry(id, {
      title: session.title,
      nowObjectives,
      ...taskFields(session),
      ...(notes !== undefined ? { notes } : clockNoteField(entry?.notes, base) ?? {}),
      ...(spans ? { pauseSpans: spans } : {}),
    })
  }
}

function writeObjectivesOnto(session: PenColorSession): void {
  stampClockEntries(session, session.trackingEntryIds ?? [])
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
  writeObjectivesOnto(next)
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
  for (const slice of slices) {
    tracking.paintMinutes(slice.date, session.scopeId, slice.startMin, slice.endMin, session.penId, undefined, spanId)
    const id = coveringEntryId(slice.date, session.scopeId, session.penId, slice.startMin)
    if (id) ids.push(id)
  }
  stampClockEntries(session, ids)
  return ids
}

function extendLiveEntry(session: PenColorSession, now: Date): string[] {
  const slices = splitIntoDaySlices(new Date(session.startedAt), now)
  const tracking = useTimeTrackingStore.getState()
  const ids: string[] = []
  const fresh: string[] = []

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
      ids.push(id)
      fresh.push(id)
    }
  }
  stampClockEntries(session, fresh)
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
    let session: PenColorSession = { ...draft, trackingEntryIds }
    const resumed = mergeResumed(
      undefined,
      useUnfinishedObjectivesStore.getState().take(homesForPen(located.scopeId, located.pen.id)),
      now,
    )
    if (resumed?.length) session = { ...session, nowObjectives: resumed }
    usePenColorSessionStore.getState().setSession(session)
    if (resumed?.length) writeObjectivesOnto(session)
    syncSliceDays(trackingEntryIds, slices)
    return session
  })
}

/**
 * Close the live pen block at active end and leave the painted minutes editable.
 * `parkUnfinished` banks the open stints and copies still-open objectives onto
 * the unfinished list for this pen, task, or subtask. They stay on this block.
 */
export function stopPenColorSession(now = new Date(), opts?: { parkUnfinished?: boolean }): PenColorSession | null {
  return runAsAction("stop pen color", () => {
    let session = usePenColorSessionStore.getState().session
    if (!session) return null
    const end = sessionActiveEnd(session, now)
    if (opts?.parkUnfinished && session.nowObjectives?.length) {
      const banked = session.nowObjectives.map((row) => bankOpenStint(row, end))
      const parked = banked.flatMap((row) => {
        const home = homeForObjective(row, session!)
        const packed = home ? toParked(row, home) : null
        return packed ? [packed] : []
      })
      if (parked.length) useUnfinishedObjectivesStore.getState().upsert(parked)
      session = { ...session, nowObjectives: banked }
      usePenColorSessionStore.getState().setSession(session)
    }

    const spans = closeOpenPause(session.pauseSpans, now)
    session = spans ? { ...session, pauseSpans: spans } : session
    let ids = session.trackingEntryIds ?? []
    if (locatePen(session.penId)) {
      const slices = splitIntoDaySlices(new Date(session.startedAt), end)
      ids = paintSlices(slices, session)
      if (spans?.length) stampClockEntries(session, ids, { endedAt: now, stopped: true })
      syncSliceDays(ids, slices)
    }

    usePenColorSessionStore.getState().clearSession()
    if (session.taskId) {
      logTaskClockSpan(
        {
          taskId: session.taskId,
          stepId: session.stepId,
          trackingEntryIds: ids,
          nowObjectives: session.nowObjectives,
          pauseSpans: spans,
        },
        new Date(session.startedAt),
        now,
        elapsedMsOf(session, now.getTime()),
      )
    }
    return session
  })
}

/**
 * How long the header may take to paint its clock before an open sitting is
 * closed. A lazy load is not a hidden clock.
 */
export const PEN_CLOCK_UNSHOWN_GRACE_MS = 3_000

/**
 * The header clock has been off-screen long enough that the sitting must end.
 * Ending sets the block's end. It does not complete the task or the step.
 */
export function penClockShouldStop(headerShown: boolean, unshownMs: number): boolean {
  return !headerShown && unshownMs >= PEN_CLOCK_UNSHOWN_GRACE_MS
}

/**
 * Grow the block only while `isShown` says the header clock is on screen.
 * After {@link PEN_CLOCK_UNSHOWN_GRACE_MS} off screen, end the sitting.
 * A refresh is not an end: the persisted session is what the next page reads.
 * Returns a dispose function. The label clocks elsewhere do not call this.
 */
export function watchPenClockShown(isShown: () => boolean, now = () => new Date()): () => void {
  let unshownSince: number | null = null
  const check = () => {
    if (typeof document !== "undefined" && document.hidden) return
    const shown = isShown()
    const at = now()
    if (shown) {
      unshownSince = null
      tickPenColorSession(at)
      return
    }
    if (unshownSince == null) unshownSince = at.getTime()
    if (penClockShouldStop(false, at.getTime() - unshownSince)) stopPenColorSession(at)
  }
  check()
  const id = window.setInterval(check, 1_000)
  return () => {
    window.clearInterval(id)
  }
}

/** Grow the live block up to active end. Silenced from undo. */
export function tickPenColorSession(now = new Date()): PenColorSession | null {
  return withoutUndo(() => {
    const session = usePenColorSessionStore.getState().session
    if (!session || isRestoring()) return session ?? null
    if (!locatePen(session.penId)) {
      // Seed scopes load before the vault. A refresh must not forget a pen
      // that is only in the saved time grid.
      if (useTimeTrackingStore.persist?.hasHydrated?.() === false) return session
      usePenColorSessionStore.getState().clearSession()
      return null
    }
    const end = sessionActiveEnd(session, now)
    if (liveEntryUpToDate(session, end)) return session
    const ids = extendLiveEntry(session, end)
    const next = { ...session, trackingEntryIds: ids }
    usePenColorSessionStore.getState().setSession(next)
    syncSliceDays(ids, [])
    return next
  })
}

/**
 * Freeze elapsed + paint. A Pause click passes the gap reason.
 * Empty or missing reason does not pause. `{ hold: true }` freezes without a gap
 * (end of sitting, a box timer, a linked plan that is parking).
 */
export function pausePenColorSession(now = new Date(), request?: PauseRequest): PenColorSession | null {
  return withoutUndo(() => {
    const session = usePenColorSessionStore.getState().session
    if (!session || session.pausedAt) return session
    const hold = isHoldPause(request)
    const spans = hold ? session.pauseSpans : appendPause(session.pauseSpans, now, pauseReasonText(request))
    if (!hold && !spans) return session
    usePenColorSessionStore.getState().setSession({
      ...session,
      pausedAt: now.toISOString(),
      ...(spans ? { pauseSpans: spans } : {}),
    })
    const ticked = tickPenColorSession(now)
    const live = ticked ?? usePenColorSessionStore.getState().session
    if (live?.pauseSpans?.length) stampClockEntries(live, live.trackingEntryIds ?? [])
    return usePenColorSessionStore.getState().session
  })
}

/** Clear the open pause, record restarted-at, and fold the gap into `pausedAccumMs`. */
export function resumePenColorSession(now = new Date()): PenColorSession | null {
  return withoutUndo(() => {
    const session = usePenColorSessionStore.getState().session
    if (!session?.pausedAt) return session
    const pauseMs = Math.max(0, now.getTime() - new Date(session.pausedAt).getTime())
    const pauseSpans = resumeOpenPause(session.pauseSpans, now)
    const next: PenColorSession = {
      ...session,
      pausedAt: undefined,
      pausedAccumMs: (session.pausedAccumMs ?? 0) + pauseMs,
      ...(pauseSpans ? { pauseSpans } : {}),
    }
    usePenColorSessionStore.getState().setSession(next)
    if (pauseSpans?.length) stampClockEntries(next, next.trackingEntryIds ?? [])
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
export function addPenColorNowObjective(
  text: string,
  now = new Date(),
  stepId?: string,
  lane: NowObjectiveLane = "next",
): PenColorSession | null {
  const parsed: { text: string; at?: Date } = stepId ? { text } : parseObjectiveClock(text, now)
  const session = usePenColorSessionStore.getState().session
  const tied = stepId ?? (session?.taskId ? matchStepForObjective(session.taskId, parsed.text) : undefined)
  return withoutUndo(() =>
    patchPenColorObjectives((list) =>
      addNowObjective(list, parsed.text, now, { stepId: tied, addedAt: parsed.at, lane }),
    ),
  )
}

/** Already done during this sitting. Start is unknown, and not before the session began. */
export function addPenColorCompletedObjective(text: string, now = new Date()): PenColorSession | null {
  const session = usePenColorSessionStore.getState().session
  if (!session) return null
  return withoutUndo(() =>
    patchPenColorObjectives((list) => addCompletedNowObjective(list, text, new Date(session.startedAt), now)),
  )
}

/**
 * Take the objective off this sitting without counting the open stint, and
 * park it for the task, subtask, pen, or operation it belongs to.
 */
export function savePenObjectiveForLater(id: string): PenColorSession | null {
  const session = usePenColorSessionStore.getState().session
  if (!session) return null
  const row = session.nowObjectives?.find((item) => item.id === id)
  if (!row || row.completedAt) return session
  const home = homeForObjective(row, session)
  const parked = home ? toParked(row, home) : null
  return runAsAction("save objective for later", () => {
    if (parked) useUnfinishedObjectivesStore.getState().upsert([parked])
    return patchPenColorObjectives((list) => removeNowObjective(list, id))
  })
}

/** Attach the objective to a task or one of its steps. `createName` makes the task first. */
export function attachPenNowObjective(
  id: string,
  target: { taskId: string; stepId?: string } | { createName: string },
): PenColorSession | null {
  const session = usePenColorSessionStore.getState().session
  if (!session) return null
  return runAsAction("attach objective", () => {
    let taskId: string | undefined
    let stepId: string | undefined
    if ("createName" in target) {
      taskId =
        createTaskForObjective(target.createName, { scopeId: session.scopeId, penId: session.penId }) ?? undefined
    } else {
      taskId = target.taskId
      stepId = target.stepId
    }
    if (!taskId) return session
    const next = patchPenColorObjectives((list) => attachNowObjective(list, id, { taskId: taskId!, stepId }))
    const row = next?.nowObjectives?.find((item) => item.id === id)
    if (row?.completedAt) applyObjectiveToStep({ taskId: row.taskId ?? next?.taskId, stepId: row.stepId }, row)
    fileObjectivesOnTask(taskId, objectivesAttachedToTask(next?.nowObjectives, taskId))
    return next
  })
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
  const next = withoutUndo(() =>
    patchPenColorObjectives((list) => {
      const tied = tieNowObjectiveToStep(list, id, target)
      // A step picked from the list only counts the time toward it; a step made
      // from the objective is that objective. Either can be flipped in the popup.
      if (!target) return tied.map((row) => (row.id === id && row.completes === false ? { ...row, completes: undefined } : row))
      return setNowObjectiveCompletes(tied, id, stepId === "new")
    }),
  )
  const tiedRow = next?.nowObjectives?.find((row) => row.id === id)
  if (tiedRow?.stepId && tiedRow.completedAt && stepId !== "new") applyObjectiveToStep(next ?? {}, tiedRow)
  return next
}

export function setPenColorNowObjectiveCompletes(id: string, completes: boolean): PenColorSession | null {
  const next = withoutUndo(() => patchPenColorObjectives((list) => setNowObjectiveCompletes(list, id, completes)))
  const row = next?.nowObjectives?.find((o) => o.id === id)
  if ((next?.taskId || row?.taskId) && row?.completedAt) applyObjectiveToStep(next ?? {}, row)
  return next
}

export function editPenColorNowObjectiveText(id: string, text: string): PenColorSession | null {
  return withoutUndo(() => patchPenColorObjectives((list) => editNowObjectiveText(list, id, text)))
}

export function movePenColorNowObjectiveToNext(id: string, now = new Date()): PenColorSession | null {
  return withoutUndo(() => patchPenColorObjectives((list) => moveNowObjectiveToNext(list, id, now)))
}

export function movePenColorNowObjectiveToNow(id: string, now = new Date()): PenColorSession | null {
  return withoutUndo(() => patchPenColorObjectives((list) => moveNowObjectiveToNow(list, id, now)))
}

export function togglePenColorNowObjectiveComplete(id: string, now = new Date()): PenColorSession | null {
  const next = withoutUndo(() => patchPenColorObjectives((list) => toggleNowObjectiveComplete(list, id, now)))
  const row = next?.nowObjectives?.find((o) => o.id === id)
  if (row && (row.taskId || next?.taskId)) applyObjectiveToStep(next ?? {}, row)
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
  let next: PenColorSession = { ...session }
  if (ref) {
    next.taskId = ref.taskId
    if (ref.stepId) next.stepId = ref.stepId
    else delete next.stepId
    if (ref.title) next.title = ref.title
    const resumed = mergeResumed(
      next.nowObjectives,
      useUnfinishedObjectivesStore.getState().take(homesForTask(ref.taskId, ref.stepId)),
      new Date(),
    )
    if (resumed !== next.nowObjectives) next = { ...next, nowObjectives: resumed }
  } else {
    delete next.taskId
    delete next.stepId
  }
  usePenColorSessionStore.getState().setSession(next)
  stampClockEntries(next, next.trackingEntryIds ?? [])
  return next
}

export function removePenColorNowObjective(id: string): PenColorSession | null {
  return withoutUndo(() => patchPenColorObjectives((list) => removeNowObjective(list, id)))
}
