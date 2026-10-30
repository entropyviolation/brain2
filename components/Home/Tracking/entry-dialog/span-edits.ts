/**
 * components/Home/Tracking/entry-dialog/span-edits.ts — Clock follow for one block
 *
 * One of start, end, or duration is locked. Editing either free value rewrites
 * the other. Unknown ends have no length. A linked clock lets go only when
 * that clock actually moves. The form keeps the state and passes it in.
 */
import {
  applySpanEdit,
  calendarDaysBetween,
  parseDurationInput,
  readSpanClock,
  timeStringToMinutes,
  writeSpanClock,
  type SpanLock,
} from "@/lib/time-entries"

export type SpanClockFields = {
  from: string
  to: string
  fromDate: string
  toDate: string
  spanLock: SpanLock
  durationApplies: boolean
  durDraft: string | null
  startLinked: boolean
  endLinked: boolean
  startEventId: string | undefined
  startJoinId: string | undefined
  endEventId: string | undefined
  endJoinId: string | undefined
}

export type SpanClockSetters = {
  setFrom: (value: string) => void
  setTo: (value: string) => void
  setFromDate: (value: string) => void
  setToDate: (value: string) => void
  setDurDraft: (value: string | null) => void
  setStartEventId: (value: string | undefined) => void
  setStartJoinId: (value: string | undefined) => void
  setEndEventId: (value: string | undefined) => void
  setEndJoinId: (value: string | undefined) => void
}

export function currentSpan(fields: SpanClockFields) {
  const s = timeStringToMinutes(fields.from)
  const e = timeStringToMinutes(fields.to)
  if (s === null || e === null) return null
  return readSpanClock(fields.fromDate, s, fields.toDate, e)
}

export function placeSpan(fields: SpanClockFields, set: SpanClockSetters, startAbs: number, endAbs: number) {
  const written = writeSpanClock(fields.fromDate, startAbs, endAbs)
  if (!written) return
  const startMoved = written.from !== fields.from || written.fromDate !== fields.fromDate
  const endMoved = written.to !== fields.to || written.toDate !== fields.toDate
  set.setFrom(written.from)
  set.setFromDate(written.fromDate)
  set.setTo(written.to)
  set.setToDate(written.toDate)
  set.setDurDraft(null)
  if (startMoved && (fields.startEventId || fields.startJoinId)) {
    set.setStartEventId(undefined)
    set.setStartJoinId(undefined)
  }
  if (endMoved && (fields.endEventId || fields.endJoinId)) {
    set.setEndEventId(undefined)
    set.setEndJoinId(undefined)
  }
}

export function editSpan(fields: SpanClockFields, set: SpanClockSetters, edit: SpanLock, value: number) {
  const cur = currentSpan(fields)
  if (!cur) return false
  const next = applySpanEdit({ lock: fields.spanLock, start: cur.start, end: cur.end, edit, value })
  if (!next) return false
  placeSpan(fields, set, next.start, next.end)
  return true
}

export function onStartTime(fields: SpanClockFields, set: SpanClockSetters, time: string) {
  const clock = timeStringToMinutes(time)
  if (clock === null || !fields.durationApplies || !editSpan(fields, set, "start", clock)) {
    set.setFrom(time)
    set.setDurDraft(null)
  }
}

export function onEndTime(fields: SpanClockFields, set: SpanClockSetters, time: string) {
  const clock = timeStringToMinutes(time)
  if (clock === null || !fields.durationApplies) {
    set.setTo(time)
    set.setDurDraft(null)
    return
  }
  const days = calendarDaysBetween(fields.fromDate, fields.toDate)
  const endAbs = days === 0 && clock === 0 ? 1440 : clock + days * 1440
  if (!editSpan(fields, set, "end", endAbs)) {
    set.setTo(time)
    set.setDurDraft(null)
  }
}

export function onStartDate(fields: SpanClockFields, set: SpanClockSetters, date: string) {
  const clock = timeStringToMinutes(fields.from)
  if (!date || clock === null || fields.spanLock !== "duration" || !fields.durationApplies) {
    set.setFromDate(date)
    return
  }
  const shift = calendarDaysBetween(fields.fromDate, date)
  if (!editSpan(fields, set, "start", clock + shift * 1440)) set.setFromDate(date)
}

export function onEndDate(fields: SpanClockFields, set: SpanClockSetters, date: string) {
  const clock = timeStringToMinutes(fields.to)
  if (!date || clock === null || fields.spanLock !== "duration" || !fields.durationApplies) {
    set.setToDate(date)
    return
  }
  const days = calendarDaysBetween(fields.fromDate, date)
  const endAbs = days === 0 && clock === 0 ? 1440 : clock + days * 1440
  if (!editSpan(fields, set, "end", endAbs)) set.setToDate(date)
}

export function durationHelp(fields: SpanClockFields) {
  if (fields.durDraft !== null && parseDurationInput(fields.durDraft) === null) {
    return "Use minutes or hours, such as 45, 1:30 or 1h 30m."
  }
  const linked = fields.startLinked || fields.endLinked ? " A linked clock lets go when it has to move." : ""
  if (fields.spanLock === "end") return `Calculated from the clocks. End is locked, so a typed length moves Start.${linked}`
  if (fields.spanLock === "duration") return `Length is locked. Changing Start or End moves the other clock.${linked}`
  return `Calculated from the clocks. Start is locked, so a typed length moves End.${linked}`
}

export function commitDuration(fields: SpanClockFields, set: SpanClockSetters) {
  const text = fields.durDraft
  set.setDurDraft(null)
  const d = text === null ? null : parseDurationInput(text)
  if (d === null) return
  editSpan(fields, set, "duration", d)
}

export function readHeroMin(durDraft: string | null, draftDurationMin: number | null) {
  return durDraft !== null && parseDurationInput(durDraft) !== null ? parseDurationInput(durDraft) : draftDurationMin
}
