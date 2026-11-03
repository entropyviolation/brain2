/**
 * lib/ingest/bim-tell.ts — Facts, questions, and widget commands typed to BIM Chat (pure)
 *
 * A plain sentence is not a `log:` line when it states or asks something BIM can
 * file. Code reads the shape; no model is asked. Shapes:
 *   fact      "The last time I saw Shelby was July 5th"      → last-seen
 *             "The Foxtide CDs are extremely overdue"        → overdue
 *             "Elijah comes home on nov 18th"                → event
 *   question  "When was the last time I saw Shelby?"         → ask-last-seen
 *             "When does Elijah come home?"                  → ask-event
 *   command   "Create a countdown widget to when Elijah comes home" → countdown
 * `parseTell` only names the shape and slots. `apply-tell.ts` looks the names up
 * in the vault and writes, or asks one question back.
 */

export type Tell =
  | { kind: "last-seen"; who: string; date: string }
  | { kind: "ask-last-seen"; who: string }
  | { kind: "overdue"; what: string; severity: "overdue" | "extreme" }
  | { kind: "event"; title: string; date: string; time?: string }
  | { kind: "ask-event"; phrase: string }
  | { kind: "countdown"; phrase: string }

export type DayHit = { iso: string; start: number; end: number }

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5,
  jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
}
const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12,
}

export type DayPrefer = "past" | "future"

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

export function isoOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, n: number): Date {
  const out = startOfDay(d)
  out.setDate(out.getDate() + n)
  return out
}

function realDate(y: number, m: number, d: number): Date | null {
  const out = new Date(y, m - 1, d)
  return out.getFullYear() === y && out.getMonth() === m - 1 && out.getDate() === d ? out : null
}

/** A month and day with no year takes the nearest one on the preferred side of today. */
function withYear(m: number, d: number, now: Date, prefer: DayPrefer): Date | null {
  const today = startOfDay(now)
  const here = realDate(today.getFullYear(), m, d)
  if (!here) return null
  if (prefer === "past" && here > today) return realDate(today.getFullYear() - 1, m, d)
  if (prefer === "future" && here < today) return realDate(today.getFullYear() + 1, m, d)
  return here
}

function count(word: string): number | null {
  if (/^\d+$/.test(word)) return Number(word)
  return NUMBER_WORDS[word] ?? null
}

/**
 * The first day named in `text`: "july 5th", "nov 18", "the 5th of july", "7/5",
 * "yesterday", "3 weeks ago", "in 2 days", "last friday". Null when none.
 * `prefer` settles a missing year and a bare weekday.
 */
export function findDay(text: string, now: Date, prefer: DayPrefer): DayHit | null {
  const src = text
  const today = startOfDay(now)
  const hit = (d: Date | null, m: RegExpExecArray): DayHit | null =>
    d ? { iso: isoOf(d), start: m.index, end: m.index + m[0].length } : null

  let m = new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s*(\\d{4}))?`, "i").exec(src)
  if (m) {
    const month = MONTHS[m[1]!.toLowerCase()]!
    const day = Number(m[2])
    const d = m[3] ? realDate(Number(m[3]), month, day) : withYear(month, day, now, prefer)
    const found = hit(d, m)
    if (found) return found
  }
  m = new RegExp(`\\b(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+of\\s+${MONTH_RE}\\b(?:,?\\s*(\\d{4}))?`, "i").exec(src)
  if (m) {
    const month = MONTHS[m[2]!.toLowerCase()]!
    const day = Number(m[1])
    const d = m[3] ? realDate(Number(m[3]), month, day) : withYear(month, day, now, prefer)
    const found = hit(d, m)
    if (found) return found
  }
  m = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(src)
  if (m) {
    const month = Number(m[1])
    const day = Number(m[2])
    let d: Date | null
    if (m[3]) {
      const y = Number(m[3])
      d = realDate(y < 100 ? 2000 + y : y, month, day)
    } else d = withYear(month, day, now, prefer)
    const found = hit(d, m)
    if (found) return found
  }
  m = /\bday after tomorrow\b/i.exec(src)
  if (m) return hit(addDays(today, 2), m)
  m = /\b(today|tonight|this morning|this afternoon|this evening)\b/i.exec(src)
  if (m) return hit(today, m)
  m = /\btomorrow\b/i.exec(src)
  if (m) return hit(addDays(today, 1), m)
  m = /\byesterday\b/i.exec(src)
  if (m) return hit(addDays(today, -1), m)
  m = /\b(\d+|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(day|week|month|year)s?\s+ago\b/i.exec(src)
  if (m) {
    const n = count(m[1]!.toLowerCase())
    if (n != null) return hit(shiftBy(today, -n, m[2]!.toLowerCase()), m)
  }
  m = /\bin\s+(\d+|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(day|week|month|year)s?\b/i.exec(src)
  if (m) {
    const n = count(m[1]!.toLowerCase())
    if (n != null) return hit(shiftBy(today, n, m[2]!.toLowerCase()), m)
  }
  m = /\blast\s+(week|month|year)\b/i.exec(src)
  if (m) return hit(shiftBy(today, -1, m[1]!.toLowerCase()), m)
  m = /\bnext\s+(week|month|year)\b/i.exec(src)
  if (m) return hit(shiftBy(today, 1, m[1]!.toLowerCase()), m)
  m = new RegExp(`\\b(last|next|this|on)\\s+(${WEEKDAYS.join("|")})\\b`, "i").exec(src)
  if (m) {
    const target = WEEKDAYS.indexOf(m[2]!.toLowerCase())
    const lead = m[1]!.toLowerCase()
    const back = (today.getDay() - target + 7) % 7 || 7
    const ahead = (target - today.getDay() + 7) % 7 || 7
    const past = lead === "last" || (lead !== "next" && prefer === "past")
    return hit(addDays(today, past ? -back : ahead), m)
  }
  m = /\bthe\s+(\d{1,2})(?:st|nd|rd|th)\b(?!\s+of\b)/i.exec(src)
  if (m) {
    const day = Number(m[1])
    let d = realDate(today.getFullYear(), today.getMonth() + 1, day)
    if (prefer === "future") {
      for (let step = 1; (!d || d < today) && step <= 12; step++) d = realDate(today.getFullYear(), today.getMonth() + 1 + step, day)
    } else {
      for (let step = 1; (!d || d > today) && step <= 12; step++) d = realDate(today.getFullYear(), today.getMonth() + 1 - step, day)
    }
    return hit(d, m)
  }
  return null
}

function shiftBy(from: Date, n: number, unit: string): Date {
  const out = startOfDay(from)
  if (unit === "day") out.setDate(out.getDate() + n)
  else if (unit === "week") out.setDate(out.getDate() + 7 * n)
  else if (unit === "month") out.setMonth(out.getMonth() + n)
  else out.setFullYear(out.getFullYear() + n)
  return out
}

/** "at 5pm", "at 6:30 pm", "at 18:00". A bare "at 5" is not read. Returns HH:MM. */
export function findClock(text: string): { time: string; start: number; end: number } | null {
  const m = /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?(?![\d:])/i.exec(text)
  if (!m) return null
  let h = Number(m[1])
  const min = m[2] ? Number(m[2]) : 0
  const mer = m[3]?.toLowerCase().replace(/\./g, "")
  if (!mer && !m[2]) return null
  if (mer === "pm" && h < 12) h += 12
  if (mer === "am" && h === 12) h = 0
  if (h > 23 || min > 59) return null
  return { time: `${pad(h)}:${pad(min)}`, start: m.index, end: m.index + m[0].length }
}

const LEAD_IN = /^(?:(?:hey\s+)?bim[,:]?\s+|btw[,:]?\s+|fyi[,:]?\s+|note(?:\s+that)?[,:]?\s+|remember(?:\s+that)?[,:]?\s+|just so you know[,:]?\s+|so\s+|also\s+)+/i

function tidy(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:.-]+|[\s,;:.!?-]+$/g, "")
    .trim()
}

/** The sentence with the lead-in, trailing punctuation, and a leading "the" cut off a name. */
export function cleanName(text: string): string {
  return tidy(text.replace(/^the\s+/i, "").replace(/^my\s+/i, ""))
}

function sentenceCase(text: string): string {
  return text ? text[0]!.toUpperCase() + text.slice(1) : text
}

const PAST_WORD = /\b(was|were|went|had|did|saw|met|got|came|left|ate|took|made|said|told|bought|called|texted)\b|\b[a-z]{3,}ed\b/i
const SEEN_VERB = "(?:saw|seen|met|visited|hung out with|spent time with|got to see|ran into)"

/** Take the span at [start, end) out of `text`, and a preposition left hanging before it. */
function without(text: string, start: number, end: number): string {
  const head = text.slice(0, start).replace(/\b(?:on|in|at|around|about|back on|sometime|by)\s*$/i, "")
  return tidy(`${head} ${text.slice(end)}`)
}

const URGENT = /\b(overdue|over due|past due|late|behind|urgent|urgently|asap|immediately|right away|right now|top priority|highest priority|critical)\b/i
const EXTREME = /\b(extremely|very|so|really|way|super|incredibly|seriously|massively|badly)\s+(?:overdue|late|behind|past due)|\b(immediately|asap|right away|right now|top priority|highest priority|critical)\b/i

/** Parse one typed line. Null when it is not a fact, question, or command BIM can file. */
export function parseTell(raw: string, now = new Date()): Tell | null {
  const flat = raw.replace(/^﻿/, "").trim()
  if (!flat || flat.includes("\n")) return null
  const text = flat.replace(LEAD_IN, "").trim()
  if (!text || text.length > 240) return null

  // Command: a countdown to something said in words.
  const count = /^(?:please\s+)?(?:create|make|add|set\s*up|start|build|give me)\s+(?:me\s+)?(?:a|another|the)?\s*countdown(?:\s+(?:widget|tile|mark|timer))?\s+(?:to|for|until|till|towards?)\s+(.+?)[.!?]*$/i.exec(text)
  if (count) {
    const phrase = tidy(count[1]!.replace(/^(?:when|the day|the date)\s+/i, ""))
    return phrase ? { kind: "countdown", phrase } : null
  }

  // Question: when did I last see someone.
  if (/^(?:when|how long|what day)\b/i.test(text) && /\?\s*$|^(?:when|how long)/i.test(text)) {
    const seen = new RegExp(`\\b(?:last\\s+time\\s+(?:that\\s+)?i\\s+${SEEN_VERB}|i\\s+last\\s+(?:saw|see|met|visited)|last\\s+(?:saw|see|met)|since\\s+i\\s+${SEEN_VERB})\\s+(.+?)[\\s?!.]*$`, "i").exec(text)
    if (seen) {
      const who = cleanName(seen[1]!)
      if (who) return { kind: "ask-last-seen", who }
    }
    const when = /^when\s+(?:is|are|does|do|will)\s+(.+?)[\s?!.]*$/i.exec(text)
    if (when) {
      const phrase = tidy(when[1]!)
      if (phrase.split(/\s+/).length >= 2) return { kind: "ask-event", phrase }
    }
    return null
  }
  if (/\?\s*$/.test(text)) return null

  // Fact: when someone was last seen.
  const seenDay = findDay(text, now, "past")
  if (seenDay && new RegExp(`\\b${SEEN_VERB}\\b`, "i").test(text) && /\blast\b|\bi\s+(?:saw|met|visited|ran into)\b|\bgot to see\b/i.test(text)) {
    const rest = without(text, seenDay.start, seenDay.end)
    const who =
      new RegExp(`^(?:the\\s+)?last\\s+time\\s+(?:that\\s+)?i\\s+${SEEN_VERB}\\s+(.+?)(?:\\s+was)?$`, "i").exec(rest)?.[1] ??
      new RegExp(`^i\\s+(?:last\\s+)?${SEEN_VERB}\\s+(.+?)$`, "i").exec(rest)?.[1] ??
      new RegExp(`^(.+?)\\s+(?:was\\s+)?the\\s+last\\s+time\\s+i\\s+${SEEN_VERB}\\s+(.+)$`, "i").exec(rest)?.[2]
    const name = who ? cleanName(who.replace(/\s+was$/i, "")) : ""
    if (name && name.split(/\s+/).length <= 4) return { kind: "last-seen", who: name, date: seenDay.iso }
  }

  // Fact: something is overdue and should go on today.
  if (URGENT.test(text)) {
    const subject = new RegExp(
      `^(?:i\\s+(?:really\\s+)?need\\s+to\\s+(?:do|finish|get\\s+to)\\s+)?(.+?)\\s+(?:is|are|has\\s+been|have\\s+been|was|were|needs?\\s+to\\s+be|need\\s+to\\s+be|needs?)\\b`,
      "i",
    ).exec(text)
    const what = subject ? cleanName(subject[1]!.replace(URGENT, "")) : ""
    if (what && what.split(/\s+/).length <= 6 && !/^(?:i|it|this|that|they|we|there)$/i.test(what)) {
      return { kind: "overdue", what, severity: EXTREME.test(text) ? "extreme" : "overdue" }
    }
  }

  // Fact: a planned event on a future day.
  const ahead = findDay(text, now, "future")
  if (ahead && ahead.iso >= isoOf(now) && !PAST_WORD.test(text)) {
    const clock = findClock(text)
    let head = text
    const spans = [ahead, ...(clock ? [clock] : [])].sort((a, b) => b.start - a.start)
    for (const span of spans) head = without(head, span.start, span.end)
    const before = text.slice(0, ahead.start).trim()
    if (/\b(?:on|by|is|are|will\s+be|for)\s*$/i.test(before) && head.split(/\s+/).length >= 2) {
      const title = tidy(head.replace(/\s+(?:is|are|will\s+be)$/i, ""))
      return { kind: "event", title: sentenceCase(title), date: ahead.iso, ...(clock ? { time: clock.time } : {}) }
    }
  }
  return null
}

/** A reply that is only a day ("july 5th", "about two weeks ago"), maybe with a sentence around it. */
export function parseDayAnswer(raw: string, now: Date, prefer: DayPrefer): { iso: string; time?: string } | null {
  const hit = findDay(raw, now, prefer)
  if (!hit) return null
  const clock = findClock(raw)
  return { iso: hit.iso, ...(clock ? { time: clock.time } : {}) }
}

/** "skip", "never mind", "I don't remember": the person is declining the question. */
export function isDecline(raw: string): boolean {
  return /^(?:skip|never\s*mind|nvm|cancel|no idea|idk|i\s+don'?t\s+(?:know|remember|recall)|dunno|not sure|forget it|no)\b/i.test(raw.trim())
}

/** The event words of a phrase, as a title: "when elijah comes home" → "Elijah comes home". */
export function titleFromPhrase(phrase: string): string {
  return sentenceCase(tidy(phrase.replace(/^(?:when|the day|the date)\s+/i, "")))
}
