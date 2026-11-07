/**
 * lib/habit-helper/evidence.ts — Find a session's one known end in the BIM log, and read the answer for the other
 *
 * "i did exercise yesterday" names no amount. Before the BIMBY sets the goal, it reads the person's own BIM
 * lines for that day. "home from my walk" sent at 6 pm says the walk ended at 6 pm; "heading out for a run"
 * says it began. One end is known, so the BIMBY asks for the other, then paints the span and credits the
 * minutes. A clock the person states is definite; "around 5" is an estimate, still credited and painted as
 * estimated. All code, no model. Pure.
 */

import { formatLocalDateKey } from "@/lib/date-utils"
import { peelLogLineWhen } from "@/lib/ingest/log-line-time"
import { scoreClause } from "./lexicon"
import type { HabitBrief } from "./types"
import { clock, stem } from "./words"

/** One line the person sent BIM, with when. */
export interface BimLog {
  text: string
  /** ISO. */
  at: string
}

/** The session with one end known, waiting for the other. Kept between messages. */
export interface PendingSpan {
  habitId: string
  day: string
  /** Which end the log gave. */
  known: "end" | "start"
  /** Minutes past midnight of the known end. */
  min: number
  /** The log line, as written. */
  line: string
  /** `walk`, `run`: the activity word in the line. */
  activity: string
}

const ENDED = /\b(?:(?:home|back) from|just got back|got back|came back|finished|done with|wrapped up|done)\b/i
const STARTED = /\b(?:heading out|head(?:ed|ing)? out|going (?:out )?(?:for|on)|off (?:for|to)|setting off|about to go|starting|starting out|leaving for)\b/i
const ACTIVITY = ["walk", "run", "jog", "hike", "gym", "workout", "swim", "bike", "ride", "cycle", "yoga", "lift", "exercise", "pilates", "dance", "stroll"]
const ACTIVITY_STEMS = new Set(ACTIVITY.map(stem))
const EXERCISE_HABIT = new Set(["exercis", "workout", "fitness", "gym", "train", "cardio", "walk", "run", "jog", "hike", "swim", "bike", "yoga", "sport"].map(stem))

const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes()

const activityIn = (text: string): string | null => {
  for (const w of text.toLowerCase().split(/[^a-z]+/)) if (w && ACTIVITY_STEMS.has(stem(w))) return w
  return null
}

/** The habit counts minutes, so a span of minutes is a fair answer. */
export function countsMinutes(h: HabitBrief): boolean {
  return h.kind === "goal" && (!h.unit || h.unit === "min")
}

/** Does this log line talk about the habit: by its own words, or an exercise word for an exercise habit. */
function aboutHabit(text: string, h: HabitBrief): boolean {
  if (scoreClause(text, [h]).length) return true
  const exerciseHabit = [h.name, h.shorthand ?? "", ...h.words].some((s) => s.toLowerCase().split(/[^a-z]+/).some((w) => w && EXERCISE_HABIT.has(stem(w))))
  return exerciseHabit && !!activityIn(text)
}

/**
 * The newest log line on `day` that gives one end of a session of this habit, or null. An end needs a cue
 * ("home from", "finished"); a start needs one ("heading out", "starting"). A line that names a clock
 * ("home from my walk 6:10") uses it; otherwise the time it was sent.
 */
export function findEvidence(h: HabitBrief, day: string, logs: readonly BimLog[]): PendingSpan | null {
  if (!countsMinutes(h)) return null
  const hits: { at: Date; line: string; known: "end" | "start"; activity: string }[] = []
  for (const log of logs) {
    const sent = new Date(log.at)
    if (!Number.isFinite(sent.getTime()) || formatLocalDateKey(sent) !== day) continue
    const peeled = peelLogLineWhen(log.text, sent)
    const text = peeled?.title ?? log.text
    if (!aboutHabit(text, h)) continue
    const known = ENDED.test(text) ? "end" : STARTED.test(text) ? "start" : null
    if (!known) continue
    hits.push({ at: peeled?.at ?? sent, line: log.text.trim(), known, activity: activityIn(text) ?? "session" })
  }
  const last = hits.sort((a, b) => b.at.getTime() - a.at.getTime())[0]
  return last ? { habitId: h.id, day, known: last.known, min: minutesOf(last.at), line: last.line, activity: last.activity } : null
}

export interface SpanAnswer {
  startMin: number
  endMin: number
  /** The person guessed ("around 5"). Still credited. */
  estimated: boolean
}

const GUESS = /\b(?:around|about|roughly|approx(?:imately)?|maybe|probably|i think|think|like|ish|~)\b|~|ish\b/i

/** A clock or a length said in `text`, as minutes past midnight / minutes. Null when it names neither. */
function clockIn(text: string, near: number, before: boolean): number | null {
  const m = /(\d{1,2})(?::(\d{2}))?\s*([ap])?\.?m?\b/i.exec(text.replace(/\bfor\s+\d+/gi, " "))
  if (!m || (!m[2] && !m[3] && !/\b(at|around|about|roughly|since|from|till|until|to)\s+\d/i.test(text) && !/^\s*\d{1,2}\s*$/.test(text))) return null
  const h = Number(m[1])
  const min = m[2] ? Number(m[2]) : 0
  if (h > 24 || min > 59) return null
  if (m[3] || h === 0 || h > 12) {
    const pm = m[3]?.toLowerCase() === "p"
    return ((h % 12) + (pm ? 12 : 0)) * 60 + min
  }
  // No am/pm: of the two readings, take the nearer one on the right side of the known end.
  const a = (h % 12) * 60 + min
  const b = a + 720
  const ok = (v: number) => (before ? v < near : v > near)
  const fits = [a, b].filter(ok).sort((x, y) => Math.abs(near - x) - Math.abs(near - y))
  return fits[0] ?? a
}

function lengthIn(text: string): number | null {
  if (/\b(?:half an hour|half hour)\b/i.test(text)) return 30
  if (/\ban hour\b/i.test(text)) return 60
  const h = /(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours?)\b/i.exec(text)
  const m = /(\d+)\s*(?:m|min|mins|minutes?)\b/i.exec(text)
  if (!h && !m) return null
  return Math.round((h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0))
}

/** The other end, or the length, from the person's reply. Null when it is neither (so it is not an answer). */
export function readSpanAnswer(text: string, pending: Pick<PendingSpan, "known" | "min">): SpanAnswer | null {
  const estimated = GUESS.test(text)
  const knownEnd = pending.known === "end"
  const len = lengthIn(text)
  if (len && len > 0) {
    const startMin = knownEnd ? pending.min - len : pending.min
    const endMin = knownEnd ? pending.min : pending.min + len
    return startMin < 0 || endMin > 1440 ? null : { startMin, endMin, estimated }
  }
  const at = clockIn(text, pending.min, knownEnd)
  if (at == null) return null
  const startMin = knownEnd ? at : pending.min
  const endMin = knownEnd ? pending.min : at
  return endMin > startMin ? { startMin, endMin, estimated } : null
}

/** The question the BIMBY asks, naming what it found. */
export function spanQuestion(p: PendingSpan, dayLabel: string, habit: string): string {
  const other = p.known === "end" ? "start" : "end"
  const found = p.known === "end" ? `the ${p.activity} ended at ${clock(p.min)}` : `the ${p.activity} began at ${clock(p.min)}`
  return (
    `I found “${p.line}” in your BIM log ${dayLabel}, so ${found}. Do you know when it ${p.known === "end" ? "started" : "ended"}? ` +
    `Say the ${other} (“started at 5 pm”), or a guess (“around 5”), or how long (“about an hour”) and I'll log that for ${habit}. “skip” leaves it.`
  )
}
