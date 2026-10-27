/**
 * components/Home/Tracking/entry-dialog/edge-actions.ts — Anchors, settle, overlap “also end”
 *
 * Plain functions. `afterEndsSaved` takes `overlapping` as an argument: the
 * form declares that list later, and save runs only after render.
 */
import { edgeOf, refitTransit, settleAnchors, surer, type EdgeState } from "@/lib/entry-edges"
import { minutesToTimeString, timeStringToMinutes, type TimeEntry, type TrackingClockCertainty } from "@/lib/time-entries"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"

type UpdateEntry = (
  id: string,
  patch: Partial<Omit<TimeEntry, "id">>,
  wrapEndDate?: string,
) => void

export type EdgeSetters = {
  setFrom: (value: string) => void
  setTo: (value: string) => void
  setStartC: (value: TrackingClockCertainty) => void
  setEndC: (value: TrackingClockCertainty) => void
  setStartOff: (value: boolean) => void
  setEndOff: (value: boolean) => void
  setStartEventId: (value: string | undefined) => void
  setStartJoinId: (value: string | undefined) => void
  setEndEventId: (value: string | undefined) => void
  setEndJoinId: (value: string | undefined) => void
}

/** Anchored events and joined blocks agree with the saved ends; other-view blocks sharing the old end follow; transit refits. */
export function afterEndsSaved(input: {
  endMin: number
  origin: TimeEntry
  from: string
  endJoinId: string | undefined
  startJoinId: string | undefined
  updateEntry: UpdateEntry
  endEventId: string | undefined
  alsoOthers: boolean
  overlapping: TimeEntry[]
  settle: () => void
  repriceTransit: (moved: { id: string; startMin: number; endMin: number }) => void | Promise<void>
}) {
  const {
    endMin,
    origin,
    from,
    endJoinId,
    startJoinId,
    updateEntry,
    endEventId,
    alsoOthers,
    overlapping,
    settle,
    repriceTransit,
  } = input
  const live = useTimeTrackingStore.getState().entries
  const moved = { id: origin.id, startMin: timeStringToMinutes(from) ?? origin.startMin, endMin }
  // A seam is stored on both blocks; unlinking here clears the other side too.
  for (const [prev, next, back] of [
    [origin.endJoinId, endJoinId, "startJoinId"],
    [origin.startJoinId, startJoinId, "endJoinId"],
  ] as const) {
    if (prev && prev !== next && live.find((e) => e.id === prev)?.[back] === origin.id) updateEntry(prev, { [back]: undefined })
    if (next) updateEntry(next, { [back]: origin.id })
  }
  if (endEventId && alsoOthers) {
    for (const o of overlapping) updateEntry(o.id, { endEventId, endMin })
  }
  settle()
  const patches = refitTransit(useTimeTrackingStore.getState().entries, moved)
  for (const [id, patch] of Object.entries(patches)) updateEntry(id, patch)
  void repriceTransit(moved)
}

export function settle(originId: string, updateEntry: UpdateEntry) {
  for (const [id, patch] of Object.entries(settleAnchors(useTimeTrackingStore.getState().entries, originId))) updateEntry(id, patch)
}

export function takeEdge(edge: "start" | "end", to: EdgeState, set: EdgeSetters) {
  if (edge === "start") {
    set.setFrom(minutesToTimeString(to.min % 1440))
    set.setStartC(to.c)
    set.setStartOff(false)
  } else {
    set.setTo(minutesToTimeString(to.min % 1440))
    set.setEndC(to.c)
    set.setEndOff(false)
  }
}

/** Anchor an edge to an event or a neighbouring block; the surer side's time and certainty win. */
export function linkEdge(
  edge: "start" | "end",
  kind: "event" | "join",
  partner: TimeEntry,
  clock: { from: string; to: string; startC: TrackingClockCertainty; endC: TrackingClockCertainty },
  set: EdgeSetters,
) {
  const theirs = edgeOf(partner, kind === "event" || edge === "end" ? "start" : "end")
  const mine: EdgeState = {
    min: (timeStringToMinutes(edge === "start" ? clock.from : clock.to) ?? 0) || (edge === "end" ? 1440 : 0),
    c: edge === "start" ? clock.startC : clock.endC,
  }
  if (mine.c === theirs.c && mine.min === theirs.min) {
    /* already agrees */
  } else if (surer(theirs.c, mine.c) || (mine.min === theirs.min && theirs.c !== mine.c)) takeEdge(edge, theirs, set)
  if (edge === "start") {
    set.setStartEventId(kind === "event" ? partner.id : undefined)
    set.setStartJoinId(kind === "join" ? partner.id : undefined)
  } else {
    set.setEndEventId(kind === "event" ? partner.id : undefined)
    set.setEndJoinId(kind === "join" ? partner.id : undefined)
  }
}

export function unlinkEdge(edge: "start" | "end", set: EdgeSetters) {
  if (edge === "start") {
    set.setStartEventId(undefined)
    set.setStartJoinId(undefined)
  } else {
    set.setEndEventId(undefined)
    set.setEndJoinId(undefined)
  }
}
