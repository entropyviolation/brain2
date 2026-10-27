/**
 * components/Home/Tracking/entry-dialog/save-block.ts — Save one painted block
 *
 * Instant blocks settle and close. Interval blocks may wrap past midnight,
 * then agree their anchors and mirror details when the end stays on the same
 * day. Spend errors and the mood pen stay as they were. The form still wraps
 * the call in `runAsAction("edit block", saveNow)`.
 */
import { certaintyPatch, worseOf } from "@/lib/entry-edges"
import { isInstant, timeStringToMinutes, type SpanLock, type TimeEntry, type TrackingClockCertainty } from "@/lib/time-entries"
import { useTimeTrackingStore, type TrackScope } from "@/lib/time-tracking-store"
import { compactMoodReading, type MoodReading } from "@/lib/mood-reading"
import type { NowObjective } from "@/lib/now-objective"
import { isSpendEntry, parseSpendAmount } from "@/lib/spend"
import { transitPenOf } from "@/lib/transit-suggest"
import { fieldValuesPatch } from "@/lib/pen-fields"

type UpdateEntry = (
  id: string,
  patch: Partial<Omit<TimeEntry, "id">>,
  wrapEndDate?: string,
) => void

type FieldsPatch = ReturnType<typeof fieldValuesPatch>

export function saveBlock(input: {
  entry: TimeEntry
  origin: TimeEntry
  scope: TrackScope | undefined
  from: string
  to: string
  fromDate: string
  toDate: string
  penId: string
  secondaryPenIds: string[]
  liveVariantIds: string[]
  tagIds: string[]
  penTagIds: string[]
  title: string
  notes: string
  nowObjectives: NowObjective[] | undefined
  reading: MoodReading
  assumed: boolean
  durationEstimated: boolean
  spanLock: SpanLock
  startC: TrackingClockCertainty
  endC: TrackingClockCertainty
  startEventId: string | undefined
  endEventId: string | undefined
  startJoinId: string | undefined
  endJoinId: string | undefined
  amountText: string
  spentOn: string
  spentSource: string
  setSpendError: (value: string) => void
  updateEntry: UpdateEntry
  mirrorDetails: (window: { date: string; scopeId: string; startMin: number; endMin: number }) => void
  onClose: () => void
  fieldsPatch: () => FieldsPatch
  resolvePenId: () => string
  settle: () => void
  afterEndsSaved: (endMin: number) => void
}) {
  const {
    entry,
    origin,
    scope,
    from,
    to,
    fromDate,
    toDate,
    secondaryPenIds,
    liveVariantIds,
    tagIds,
    penTagIds,
    title,
    notes,
    nowObjectives,
    reading,
    assumed,
    durationEstimated,
    spanLock,
    startC,
    endC,
    startEventId,
    endEventId,
    startJoinId,
    endJoinId,
    amountText,
    spentOn,
    spentSource,
    setSpendError,
    updateEntry,
    mirrorDetails,
    onClose,
    fieldsPatch,
    resolvePenId,
    settle,
    afterEndsSaved,
  } = input
  const isMood = entry.scopeId === "mood"
  const spendEntry = isSpendEntry(entry)
  const startMin = timeStringToMinutes(from)
  if (startMin === null) return
  if (!isInstant(entry) && timeStringToMinutes(to) === null) return
  const savedPenId = resolvePenId()
  const moodPatch = isMood ? { moodReading: compactMoodReading(reading) } : {}
  let spendPatch: Partial<Omit<TimeEntry, "id">> = {}
  if (spendEntry) {
    const amount = parseSpendAmount(amountText)
    const on = spentOn.trim()
    const source = spentSource.trim()
    if (amount == null || !on || !source) {
      setSpendError(
        amount == null
          ? "Amount is dollars and cents, such as 4.50."
          : "Amount, what it was spent on, and the source each need a value.",
      )
      return
    }
    setSpendError("")
    spendPatch = {
      spendAmount: amount,
      spendOn: on,
      spendSource: source,
      eventKind: "spend",
      title: on,
    }
  }
  if (isInstant(entry)) {
    updateEntry(origin.id, {
      date: fromDate,
      penId: savedPenId,
      secondaryPenIds,
      startMin,
      endMin: startMin,
      kind: "instant",
      variantIds: liveVariantIds,
      tagIds: tagIds.filter((id) => !penTagIds.includes(id)),
      title: title.trim() || undefined,
      ...fieldsPatch(),
      notes: notes.trim() || undefined,
      nowObjectives,
      ...certaintyPatch(startC, startC),
      precision: assumed || startC !== "exact" ? "estimated" : undefined,
      ...moodPatch,
      ...spendPatch,
    })
    settle()
    onClose()
    return
  }
  const parsedEnd = timeStringToMinutes(to)
  if (parsedEnd === null) return
  // After Calculate the store holds the priced length; a different length is the user's own.
  const liveOrigin = useTimeTrackingStore.getState().entries.find((e) => e.id === origin.id) ?? origin
  const sameDay = toDate === fromDate
  const endMin = sameDay && parsedEnd === 0 ? 1440 : parsedEnd
  const wrapEndDate = sameDay ? undefined : toDate
  updateEntry(
    origin.id,
    {
      date: fromDate,
      penId: savedPenId,
      secondaryPenIds,
      startMin,
      endMin,
      variantIds: liveVariantIds,
      tagIds: tagIds.filter((id) => !penTagIds.includes(id)),
      title: title.trim() || undefined,
      ...fieldsPatch(),
      notes: notes.trim() || undefined,
      nowObjectives,
      ...certaintyPatch(startC, endC),
      precision: assumed || durationEstimated || worseOf(startC, endC) !== "exact" ? "estimated" : undefined,
      spanLock,
      durationEstimated: durationEstimated || undefined,
      startEventId,
      endEventId,
      startJoinId,
      endJoinId,
      ...(origin.transitMin != null || origin.transitFrom || origin.penId === (scope && transitPenOf(scope)?.id)
        ? endMin - startMin !== (liveOrigin.transitMin ?? liveOrigin.endMin - liveOrigin.startMin)
          ? { transitManual: true, transitMin: endMin - startMin }
          : {}
        : {}),
      ...moodPatch,
      ...spendPatch,
    },
    wrapEndDate,
  )
  afterEndsSaved(endMin)
  // Cross-view details and the views they name agree over the saved window.
  if (!wrapEndDate) mirrorDetails({ date: fromDate, scopeId: entry.scopeId, startMin, endMin })
  onClose()
}
