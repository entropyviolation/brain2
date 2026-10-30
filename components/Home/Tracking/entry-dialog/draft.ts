/**
 * components/Home/Tracking/entry-dialog/draft.ts — Snapshot the dirty check compares
 *
 * Same keys the form used to build inline. Split time, the date toggle, the
 * new-tag box, the overlap checkbox, cleared-certainty flags, the drive
 * sentence, and the duration typing buffer stay out.
 */
import type { NowObjective } from "@/lib/now-objective"
import type { MoodReading } from "@/lib/mood-reading"
import type { SpanLock, TrackingClockCertainty } from "@/lib/time-entries"

export type EntryDraftSnapshot = {
  penId: string
  secondaryPenIds: string[]
  from: string
  to: string
  fromDate: string
  toDate: string
  spanLock: SpanLock
  durationEstimated: boolean
  title: string
  fieldTexts: Record<string, string>
  notes: string
  nowObjectives: NowObjective[] | undefined
  reading: MoodReading
  assumed: boolean
  startC: TrackingClockCertainty
  endC: TrackingClockCertainty
  endEventId: string | undefined
  startEventId: string | undefined
  startJoinId: string | undefined
  endJoinId: string | undefined
  amountText: string
  spentOn: string
  spentSource: string
  variantIds: string[]
  tagIds: string[]
}

export function entryDraftSnapshot(draft: EntryDraftSnapshot): EntryDraftSnapshot {
  return {
    penId: draft.penId,
    secondaryPenIds: draft.secondaryPenIds,
    from: draft.from,
    to: draft.to,
    fromDate: draft.fromDate,
    toDate: draft.toDate,
    spanLock: draft.spanLock,
    durationEstimated: draft.durationEstimated,
    title: draft.title,
    fieldTexts: draft.fieldTexts,
    notes: draft.notes,
    nowObjectives: draft.nowObjectives,
    reading: draft.reading,
    assumed: draft.assumed,
    startC: draft.startC,
    endC: draft.endC,
    endEventId: draft.endEventId,
    startEventId: draft.startEventId,
    startJoinId: draft.startJoinId,
    endJoinId: draft.endJoinId,
    amountText: draft.amountText,
    spentOn: draft.spentOn,
    spentSource: draft.spentSource,
    variantIds: draft.variantIds,
    tagIds: draft.tagIds,
  }
}
