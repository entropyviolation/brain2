/**
 * lib/pen-color-session.ts — "Working on right now" for a Tracking pen
 *
 * Pick a pen color and start. The clock begins at that exact second. Tracking
 * stores minutes, so the block starts at the minute that contains this second
 * and grows until stop — same slice math as an Operations work session, but
 * the paint is the pen you chose, in that pen's own view. It does not write a
 * Done row or touch the Operations session.
 */
import type { TrackPen } from "@/lib/time-tracking-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { syncTrackedHabits } from "@/lib/habit-tracking-sync"
import { runAsAction, withoutUndo } from "@/lib/action-history"
import {
  sessionActiveEnd,
  splitIntoDaySlices,
  WORK_SESSION_TICK_MS,
  type WorkDaySlice,
} from "@/lib/operation-work-session"
import { usePenColorSessionStore, type PenColorSession } from "@/lib/pen-color-session-store"

export { WORK_SESSION_TICK_MS as PEN_COLOR_SESSION_TICK_MS }
export {
  isSessionPaused,
  sessionElapsedMs,
  sessionActiveEnd,
} from "@/lib/operation-work-session"

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

function paintSlices(slices: WorkDaySlice[], session: Pick<PenColorSession, "scopeId" | "penId" | "title" | "startedAt">): string[] {
  const tracking = useTimeTrackingStore.getState()
  const spanId = `pen-color-${session.startedAt}`
  const ids: string[] = []
  for (const slice of slices) {
    tracking.paintMinutes(slice.date, session.scopeId, slice.startMin, slice.endMin, session.penId, undefined, spanId)
    const id = coveringEntryId(slice.date, session.scopeId, session.penId, slice.startMin)
    if (id) {
      tracking.updateEntry(id, { title: session.title })
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
      tracking.updateEntry(id, { title: session.title })
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

    if (locatePen(session.penId)) {
      const end = sessionActiveEnd(session, now)
      const slices = splitIntoDaySlices(new Date(session.startedAt), end)
      const ids = paintSlices(slices, session)
      syncSliceDays(ids, slices)
    }

    usePenColorSessionStore.getState().clearSession()
    return session
  })
}

/** Grow the live block up to active end. Silenced from undo. */
export function tickPenColorSession(now = new Date()): PenColorSession | null {
  return withoutUndo(() => {
    const session = usePenColorSessionStore.getState().session
    if (!session) return null
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
