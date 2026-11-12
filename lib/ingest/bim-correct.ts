/**
 * lib/ingest/bim-correct.ts — BIM Chat's `correct` lane: reading a fix to BIM's last turn
 *
 * "no, yesterday" used to be filed as a new log line. Here the words are read, in code, as a
 * correction of the turn just before:
 *
 *   when     "no, yesterday" · "actually it was at 3pm" · "wrong, 11/8 at 14:00" · "no, 2 days ago"
 *            → the last write is undone and the same line is filed again at that time
 *   is-log   "that wasn't a question" · "I wasn't asking" · "just log it"
 *            → the line BIM answered is filed as a log line
 *   is-ask   "that was a question" · "I was asking"
 *            → the write is undone and the line is asked instead
 *   undo     "scrap that" · "never mind" · "don't log that"
 *   unsure   "no" · "wrong" · "that's not right"  → BIM says what it did and offers keys
 *   leave    "leave it"
 *
 * This file only reads the words; `bim-chat.ts` acts on them, and only when there is a last turn
 * to correct and nothing else is open. A line that starts with "no" and goes on to say something
 * else ("no coffee today") is not a correction. No model is asked.
 * Plan: `docs/BIM_CHAT_SWITCHBOARD_PLAN.md` §3 L2 `correct`, §7.
 */

import { parseLogWhen } from "./log-line-time"

/** A correction this long after the turn is about something else. */
export const CORRECT_TTL_MS = 30 * 60 * 1000

export type Correction =
  | { kind: "when"; at: Date }
  | { kind: "is-log" }
  | { kind: "is-ask" }
  | { kind: "undo" }
  | { kind: "unsure" }
  | { kind: "leave" }

const LEAD = /^(?:no+|nope|nah|wrong|not quite|actually|oops|wait|sorry)\b[\s,.!:;-]*/i
const WAS = /^(?:(?:that|it|this)(?:\s+(?:was|is|happened)|'s)|i\s+meant|i\s+mean|make\s+it|change\s+it\s+to|should\s+be|it\s+should\s+be)\b[\s,:]*/i

const IS_LOG = /^(?:(?:that|it|this)\s+(?:wasn'?t|was\s+not|isn'?t|is\s+not)\s+a\s+question|not\s+a\s+question|i\s+(?:wasn'?t|was\s+not)\s+asking|(?:just\s+)?log\s+(?:it|that))$/i
const IS_ASK = /^(?:(?:that|it|this)\s+(?:was|is)\s+a\s+question|i\s+was\s+asking|not\s+a\s+log|(?:that|it|this)\s+(?:wasn'?t|was\s+not)\s+a\s+log)$/i
const UNDO = /^(?:scrap\s+(?:that|it)|never\s*mind|nvm|(?:don'?t|do\s+not)\s+(?:log|file|save|keep)\s+(?:that|it)|(?:delete|remove|undo)\s+(?:that|it))$/i
const UNSURE = /^(?:(?:that|it|this)(?:'s|\s+is|\s+was)\s+(?:wrong|not\s+right|incorrect)|not\s+right|incorrect)?$/i
const LEAVE = /^(?:leave\s+(?:it|that)|keep\s+(?:it|that)|it'?s\s+fine)$/i

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
const WORD_NUM: Record<string, number> = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 }

const onDay = (base: Date, back: number) => new Date(base.getFullYear(), base.getMonth(), base.getDate() - back, base.getHours(), base.getMinutes(), 0, 0)

/**
 * A time in a correction: a day word, a clock, a US date, or a day word and a clock. A day alone
 * keeps the original hour and minute; a clock alone keeps the original day. Null when the words
 * are not a time.
 */
export function parseCorrectedWhen(words: string, was: Date): Date | null {
  let rest = words.trim().replace(/[.!]+$/, "").replace(/\s+/g, " ")
  if (!rest) return null
  let base = was
  let dayGiven = false
  const take = (re: RegExp, back: (m: RegExpExecArray) => number | null): void => {
    if (dayGiven) return
    const m = re.exec(rest)
    if (!m) return
    const n = back(m)
    if (n == null) return
    base = onDay(was, n)
    dayGiven = true
    rest = `${rest.slice(0, m.index)} ${rest.slice(m.index + m[0].length)}`.replace(/\s+/g, " ").trim()
  }
  take(/\b(?:the\s+)?day\s+before\s+yesterday\b/i, () => 2)
  take(/\b(?:yesterday|last\s+night)\b/i, () => 1)
  take(/\btoday\b/i, () => 0)
  take(/\b(\d{1,2}|a|one|two|three|four|five|six|seven)\s+days?\s+ago\b/i, (m) => Number(m[1]) || WORD_NUM[m[1]!.toLowerCase()] || null)
  // A weekday is the most recent one before today.
  take(new RegExp(`\\b(?:on\\s+|last\\s+)?(${DAYS.join("|")})\\b`, "i"), (m) => (was.getDay() - DAYS.indexOf(m[1]!.toLowerCase()) + 7) % 7 || 7)
  rest = rest.replace(/^(?:on|at|around|about)\s+/i, (lead) => (/^at/i.test(lead) ? "at " : "")).trim()
  if (!rest) return dayGiven ? base : null
  const at = parseLogWhen(rest, base)
  return at
}

/**
 * The correction a line makes, or null when it is not one. `was` is when the turn being corrected
 * was sent, so "no, yesterday" means the day before that turn.
 */
export function parseCorrection(text: string, was: Date): Correction | null {
  const line = text.trim()
  if (!line || line.includes("\n") || line.length > 120 || /\?\s*$/.test(line)) return null
  const lead = LEAD.exec(line)
  const body = (lead ? line.slice(lead[0].length) : line).replace(/[.!]+$/, "").trim()

  if (IS_LOG.test(body)) return { kind: "is-log" }
  if (IS_ASK.test(body)) return { kind: "is-ask" }
  if (UNDO.test(body)) return { kind: "undo" }
  if (LEAVE.test(body)) return { kind: "leave" }
  // Everything below needs the "no": a bare "yesterday" or "that's wrong" could be about anything.
  if (!lead) return /^(?:(?:that|it|this)(?:'s|\s+is|\s+was)\s+(?:wrong|not\s+right|incorrect))$/i.test(body) ? { kind: "unsure" } : null
  if (UNSURE.test(body)) return { kind: "unsure" }
  const at = parseCorrectedWhen(body.replace(WAS, ""), was)
  return at ? { kind: "when", at } : null
}

/** "Sat Nov 7, 14:00": how a moved write is named back to the person. */
export function whenLabel(at: Date): string {
  const day = at.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
  return `${day}, ${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`
}
