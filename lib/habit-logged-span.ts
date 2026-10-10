/**
 * lib/habit-logged-span.ts — Prior tracking span for a logged duration phrase
 *
 * `cleaned for {x} minutes` matches `cleaned for 9 minutes`. The habit is
 * credited with 9. The same match paints the 9 minutes that just finished on
 * the activity the habit already tracks (a pen carrying its tracking tags, or
 * a pen named for that tag). No clock: the span ends at the message time and
 * the block is estimated — the same `precision` / `clockCertainty` pair a log
 * line uses for `est`. A trailing clock is the end, read the way a log line
 * reads a clock (bare `1:11` is 1:11am), and it stays on the message’s date
 * even when that clock is still ahead. The span runs backward by the duration.
 *
 * Pure. The store write lives in `lib/habit-keyword-sync.ts`.
 */
import { formatLocalDateKey } from "@/lib/date-utils"
import { peelLogLineWhen } from "@/lib/ingest/log-line-time"
import type { HabitTrackingLink } from "@/lib/types"
import {
  LOGGED_SPAN_STAMP_PREFIX,
  loggedPhraseDurationMinutes,
  matchLoggedPhrase,
  matchLoggedPhraseLine,
} from "@/lib/habit-keyword-source"

export interface SpanScope {
  id: string
  name: string
  pens: { id: string; name: string; tags?: string[] }[]
}

export interface SpanTag {
  id: string
  name: string
}

export interface LoggedSpanPlan {
  /** Idempotency key. One message, one minute, one habit → one block. */
  stamp: string
  minutes: number
  /** Activity name shown on the block. */
  title: string
  /** Pen to paint. Existing id wins; otherwise create `penName`. */
  penName: string
  penId?: string
  scopeId: string
  /** Habit tracking tags, so the painted minutes credit that habit. */
  tagIds: string[]
  date: string
  startMin: number
  endMin: number
  /** End was the message time because the line named no clock. */
  endAssumed: boolean
  notes: string
}

export function loggedSpanStamp(habitId: string, text: string, at: string): string {
  const instant = Date.parse(at)
  const bucket = Number.isFinite(instant) ? Math.floor(instant / 60_000) : "na"
  return `${LOGGED_SPAN_STAMP_PREFIX}${habitId}:${text.trim().toLowerCase()}:${bucket}`
}

/**
 * Where the duration is painted. A pen that already carries one of the
 * habit’s tracking tags wins (a pen named like the tag, then the habit, then
 * the first). Otherwise the tag’s name is the new pen. No tags: the habit’s
 * own name. The block title is that tag when there is one, so “Cleaning”
 * stays the activity even when the pen is named something else.
 */
export function activityForHabit(
  habit: { name?: string; trackingLink?: HabitTrackingLink | null },
  scopes: readonly SpanScope[],
  tags: readonly SpanTag[],
): { title: string; penName: string; penId?: string; scopeId: string; tagIds: string[] } {
  const link = habit.trackingLink
  const tagIds = link && link.enabled !== false ? (link.tagIds ?? []).filter(Boolean) : []
  const scope =
    scopes.find((row) => row.id === "activity") ??
    scopes.find((row) => row.name.trim().toLowerCase() === "activity") ??
    scopes[0]
  const scopeId = scope?.id ?? "activity"
  const wanted = new Set(tagIds)
  const tagNames = tags
    .filter((tag) => wanted.has(tag.id))
    .map((tag) => tag.name.trim())
    .filter(Boolean)
  const pens = (scope?.pens ?? []).filter((pen) => (pen.tags ?? []).some((id) => wanted.has(id)))
  const habitName = habit.name?.trim() || ""
  const named = (list: typeof pens, name: string) =>
    list.find((pen) => pen.name.trim().toLowerCase() === name.trim().toLowerCase())
  const pen =
    tagNames.map((name) => named(pens, name)).find(Boolean) ??
    (habitName ? named(pens, habitName) : undefined) ??
    pens[0]
  if (pen) {
    return {
      title: tagNames[0] || pen.name,
      penName: pen.name,
      penId: pen.id,
      scopeId,
      tagIds,
    }
  }
  const penName = tagNames[0] || habitName || "Activity"
  return { title: penName, penName, scopeId, tagIds }
}

function clockSpan(start: Date, end: Date): { date: string; startMin: number; endMin: number } {
  const date = formatLocalDateKey(start)
  const endKey = formatLocalDateKey(end)
  const startMin = start.getHours() * 60 + start.getMinutes()
  const endMin = end.getHours() * 60 + end.getMinutes()
  if (endKey === date) return { date, startMin, endMin }
  if (endMin === 0) return { date, startMin, endMin: 24 * 60 }
  return { date, startMin, endMin }
}

/**
 * One duration hit → the block to paint. Null when the line is not a
 * minutes/hours phrase, or the clock cannot be placed.
 */
export function planLoggedSpan(input: {
  habit: { id: string; name?: string; trackingLink?: HabitTrackingLink | null }
  pattern: string
  text: string
  at: string
  scopes: readonly SpanScope[]
  tags: readonly SpanTag[]
}): LoggedSpanPlan | null {
  const text = input.text.trim()
  const sentMs = Date.parse(input.at)
  if (!text || !Number.isFinite(sentMs)) return null
  const sent = new Date(sentMs)
  const parsed = matchLoggedPhraseLine(input.pattern, text)
  if (!parsed || parsed.amount == null) return null
  const minutes = loggedPhraseDurationMinutes(input.pattern, parsed.amount)
  if (minutes == null) return null

  const exact = matchLoggedPhrase(input.pattern, text)
  const peeled = exact ? null : peelLogLineWhen(text, sent)
  const end = peeled?.at ?? sent
  const endAssumed = !peeled
  const start = new Date(end.getTime() - minutes * 60_000)
  const clock = clockSpan(start, end)
  if (clock.endMin <= clock.startMin && clock.endMin !== 0 && formatLocalDateKey(end) === clock.date) {
    return null
  }
  const activity = activityForHabit(input.habit, input.scopes, input.tags)
  return {
    stamp: loggedSpanStamp(input.habit.id, text, input.at),
    minutes,
    title: activity.title,
    penName: activity.penName,
    penId: activity.penId,
    scopeId: activity.scopeId,
    tagIds: activity.tagIds,
    date: clock.date,
    startMin: clock.startMin,
    endMin: clock.endMin,
    endAssumed,
    notes: text,
  }
}
