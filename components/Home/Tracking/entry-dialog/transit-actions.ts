/**
 * components/Home/Tracking/entry-dialog/transit-actions.ts — Drive reprice, Calculate, add transit
 *
 * Plain functions. Calculate writes the store, paints Activity, then sets
 * Start, End, and the result sentence in that order. The Driving pen is
 * `#64748b`.
 */
import { runAsAction } from "@/lib/action-history"
import { certaintyPatch, edgeOf } from "@/lib/entry-edges"
import { isInstant, minutesToLabel, minutesToTimeString, timeStringToMinutes, type TimeEntry, type TrackingClockCertainty } from "@/lib/time-entries"
import { useTimeTrackingStore, type TrackScope } from "@/lib/time-tracking-store"
import { travelMinutes } from "@/lib/transit-time"
import { isLocationScope, pinOf, transitPenOf } from "@/lib/transit-suggest"

type UpdateEntry = (
  id: string,
  patch: Partial<Omit<TimeEntry, "id">>,
  wrapEndDate?: string,
) => void

/**
 * A Location transit block between two pinned places takes the drive time as its
 * length, unless the user set it by hand. Runs for blocks touching `moved`.
 */
export async function repriceTransit(
  moved: { id: string; startMin: number; endMin: number },
  scope: TrackScope | undefined,
  entry: TimeEntry,
  updateEntry: UpdateEntry,
) {
  const transitPen = scope && isLocationScope(scope) ? transitPenOf(scope) : undefined
  if (!scope || !transitPen) return
  const live = useTimeTrackingStore.getState().entries
  for (const t of live) {
    if (t.penId !== transitPen.id || t.scopeId !== entry.scopeId || t.transitManual || isInstant(t)) continue
    const aId = t.transitFrom ?? t.startJoinId
    const bId = t.transitTo ?? t.endJoinId
    if (![t.id, aId, bId].includes(moved.id)) continue
    const a = live.find((e) => e.id === aId)
    const b = live.find((e) => e.id === bId)
    const from = pinOf(scope.pens.find((p) => p.id === a?.penId))
    const to = pinOf(scope.pens.find((p) => p.id === b?.penId))
    if (!a || !b || !from || !to) continue
    const start = a.id === moved.id ? moved.endMin : a.endMin
    const cap = b.id === moved.id ? moved.startMin : b.startMin
    const mins = await travelMinutes(from, to, t.date, start)
    if (mins == null || cap <= start) continue
    const len = Math.max(1, Math.round(mins))
    const end = Math.min(start + len, cap)
    const now = useTimeTrackingStore.getState().entries.find((e) => e.id === t.id)
    if (!now || (now.startMin === start && now.endMin === end && now.transitMin === len)) continue
    updateEntry(t.id, { startMin: start, endMin: end, transitMin: len })
  }
}

export function lookupDriveEnds(
  scope: TrackScope | undefined,
  transitPenId: string | undefined,
  entry: TimeEntry,
  allEntries: TimeEntry[],
) {
  if (!scope || !transitPenId || entry.penId !== transitPenId || isInstant(entry)) return null
  const a = allEntries.find((e) => e.id === (entry.transitFrom ?? entry.startJoinId))
  const b = allEntries.find((e) => e.id === (entry.transitTo ?? entry.endJoinId))
  const from = pinOf(scope.pens.find((p) => p.id === a?.penId))
  const to = pinOf(scope.pens.find((p) => p.id === b?.penId))
  return a && b && from && to ? { a, b, from, to } : null
}

/** Drive time between the neighbours becomes this block's length; empty Activity minutes in it read as driving. */
export async function calculateDrive(input: {
  driveEnds: NonNullable<ReturnType<typeof lookupDriveEnds>> | null
  setDriveBusy: (value: boolean) => void
  setDriveMsg: (value: string) => void
  entry: TimeEntry
  setFrom: (value: string) => void
  setTo: (value: string) => void
}) {
  const { driveEnds, setDriveBusy, setDriveMsg, entry, setFrom, setTo } = input
  if (!driveEnds) return
  setDriveBusy(true)
  setDriveMsg("")
  const { a, b, from, to } = driveEnds
  const mins = await travelMinutes(from, to, entry.date, a.endMin)
  setDriveBusy(false)
  if (mins == null) return setDriveMsg("No route found.")
  const start = a.endMin
  const end = Math.min(start + Math.max(1, Math.round(mins)), b.startMin)
  if (end <= start) return setDriveMsg("No room between the two blocks.")
  runAsAction("calculate driving commute", () => {
    const st = useTimeTrackingStore.getState()
    st.updateEntry(entry.id, { startMin: start, endMin: end, transitMin: Math.round(mins), transitManual: undefined, ...certaintyPatch(edgeOf(a, "end").c, edgeOf(b, "start").c), precision: "estimated" })
    const act = useTimeTrackingStore.getState().scopes.find((s) => s.id === "activity")
    if (!act) return
    const penId = act.pens.find((p) => /^driving$/i.test(p.name.trim()))?.id ?? st.addPen(act.id, { name: "Driving", color: "#64748b" } as never)
    if (!penId) return
    const taken = useTimeTrackingStore
      .getState()
      .entries.filter((e) => e.date === entry.date && e.scopeId === "activity" && !isInstant(e) && e.endMin > start && e.startMin < end)
      .sort((x, y) => x.startMin - y.startMin)
    let at = start
    for (const e of taken) {
      if (e.startMin > at) useTimeTrackingStore.getState().paintMinutes(entry.date, "activity", at, e.startMin, penId, [], undefined, "estimated")
      at = Math.max(at, e.endMin)
    }
    if (at < end) useTimeTrackingStore.getState().paintMinutes(entry.date, "activity", at, end, penId, [], undefined, "estimated")
  })
  setFrom(minutesToTimeString(start))
  setTo(minutesToTimeString(end % 1440))
  const clipped = Math.round(mins) > end - start
  setDriveMsg(
    `About ${Math.round(mins)} min leaving ${minutesToLabel(start)}${clipped ? `, but only ${end - start} min fit between the blocks` : ""}. Edit Start, End or Duration to set your own.`,
  )
}

export function addTransit(
  spec: { from: TimeEntry; to: TimeEntry; minutes: number; label: string },
  scope: TrackScope | undefined,
  to: string,
  endC: TrackingClockCertainty,
  updateEntry: UpdateEntry,
  onClose: () => void,
) {
  const { from: a, to: b, minutes, label } = spec
  const pen = scope ? transitPenOf(scope) : undefined
  const endMin = timeStringToMinutes(to) ?? a.endMin
  if (!pen) return
  const stop = Math.min(endMin + Math.max(1, Math.round(minutes)), b.startMin)
  const paint = useTimeTrackingStore.getState().paintMinutes
  paint(a.date, a.scopeId, endMin, stop, pen.id, [], undefined, endC === "exact" ? "definite" : "estimated", { title: label })
  const made = useTimeTrackingStore
    .getState()
    .entries.find((e) => e.date === a.date && e.scopeId === a.scopeId && e.penId === pen.id && e.startMin === endMin)
  if (made) {
    // Anchored both ways: the trip leaves where this block ends and arrives where the next one starts.
    updateEntry(made.id, {
      transitFrom: a.id,
      transitTo: b.id,
      transitMin: Math.round(minutes),
      startJoinId: a.id,
      endJoinId: b.id,
      ...certaintyPatch(endC, edgeOf(b, "start").c),
      precision: endC === "exact" && edgeOf(b, "start").c === "exact" ? undefined : "estimated",
    })
    updateEntry(a.id, { endJoinId: made.id })
    updateEntry(b.id, { startJoinId: made.id })
  }
  onClose()
}
