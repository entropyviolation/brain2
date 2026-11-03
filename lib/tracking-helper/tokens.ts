/**
 * lib/tracking-helper/tokens.ts — Find every time expression in a message, in code
 *
 * "on Friday … from 4:30 - 5 pm … until 6:19 … for 20 minutes" becomes tokens
 * (`D1`, `T1`, `T2`, `T3`, `U1`) and a marked copy of the text with the ids beside them
 * (`4:30[T1]`). The model reads the marked copy and points at ids; it never writes a
 * time. This is the cheap part: no model, and a model that cannot invent a clock.
 * Hedge words ("ish", "around", "maybe") and strong words ("for sure", "exactly") near a
 * clock are read here, so certainty is not left to a guess either.
 */

import type { Token } from "./types"

const DAYS = "monday|tuesday|wednesday|thursday|friday|saturday|sunday"
const MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec"
const PREP = "at|by|until|til|till|around|about|from|since|after|before|to|near"
const AMPM = String.raw`(?:a\.?m\.?|p\.?m\.?)`

const CLOCK_RE = new RegExp(
  [
    String.raw`(\d{1,2}):(\d{2})\s*(${AMPM})?`,
    String.raw`(?<![\d:.$])(\d{1,2})\s*(${AMPM})(?![a-z])`,
    String.raw`(?<![\d:.$])(\d{1,2})(?=\s*ish\b)`,
    String.raw`(?<=\b(?:${PREP})\s+)(\d{1,2})(?![\d:.]|\s*(?:min|mins|minutes|hour|hours|hr|hrs|times|x|dollars|bucks|people|things))\b`,
  ].join("|"),
  "gi",
)

const DAY_RE = new RegExp(
  String.raw`\b(today|yesterday|tonight|last night|this (?:morning|afternoon|evening)|(?:last\s+)?(?:${DAYS})|(?:${MONTHS})\.?\s+\d{1,2}(?:st|nd|rd|th)?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b`,
  "gi",
)

const DUR_RE = /\b(\d+(?:\.\d+)?|an?|half an?|a couple of|a few)\s*(minutes?|mins?|hours?|hrs?)\b/gi

const STRONG = /\b(exactly|definitely|for sure|sharp|precisely|certain(?:ly)?|on the dot|at exactly)\b/i
const HEDGE = /\b(around|about|approx\w*|roughly|like|maybe|potentially|probably|sometime|somewhere|or so|not sure|i guess|i think|seems?|seemed|ish)\b|~|\bish\b/i
const AFTER_HEDGE = /^\s*[-]?\s*(ish|or so)\b/i

/** How far back before a clock a hedge word still colours it. */
const HEDGE_REACH = 28

const clean = (s: string) => s.replace(/\s+/g, " ").trim()

/** The sentence that holds `at`: bounded by . ! ? or a line break. */
function sentenceAt(text: string, at: number): { start: number; end: number } {
  let start = at
  while (start > 0 && !/[.!?\n]/.test(text[start - 1]!)) start--
  let end = at
  while (end < text.length && !/[.!?\n]/.test(text[end]!)) end++
  return { start, end }
}

/** Strongest cue near a clock: a strong word right before it beats a hedge; "ish" right after is a hedge. */
function cueFor(text: string, at: number, len: number): Token["cue"] {
  const sent = sentenceAt(text, at)
  const before = text.slice(Math.max(sent.start, at - 24), at)
  const after = text.slice(at + len, Math.min(sent.end, at + len + 8))
  if (AFTER_HEDGE.test(after)) return "hedge"
  if (STRONG.test(before)) return "strong"
  if (HEDGE.test(before.slice(-HEDGE_REACH))) return "hedge"
  return "plain"
}

function periodOf(sentence: string): Token["period"] {
  if (/\b(morning|a\.?m\.?)\b/i.test(sentence)) return "am"
  if (/\b(afternoon|evening|tonight|night|p\.?m\.?)\b/i.test(sentence)) return "pm"
  return undefined
}

function ampmOf(s: string | undefined): Token["ampm"] {
  if (!s) return undefined
  return s.toLowerCase().startsWith("p") ? "pm" : "am"
}

function durMinutes(n: string, unit: string): number {
  const q = n.toLowerCase()
  const v = /^half/.test(q) ? 0.5 : /^an?$/.test(q) ? 1 : /couple/.test(q) ? 2 : /few/.test(q) ? 3 : Number(q)
  return Math.round(v * (/^h/i.test(unit) ? 60 : 1))
}

export interface Tokenized {
  tokens: Token[]
  /** The original words with each id written beside its match: `4:30[T1]`. */
  marked: string
}

/** Every day, clock, and duration in `text`, in reading order. A clock inside a day match or a duration is not counted twice. */
export function tokenize(text: string): Tokenized {
  type Hit = Omit<Token, "id"> & { end: number }
  const hits: Hit[] = []

  for (const m of text.matchAll(DAY_RE)) {
    hits.push({ kind: "day", raw: clean(m[0]), at: m.index!, end: m.index! + m[0].length, cue: "plain" })
  }
  for (const m of text.matchAll(DUR_RE)) {
    hits.push({ kind: "dur", raw: clean(m[0]), at: m.index!, end: m.index! + m[0].length, cue: "plain", minutes: durMinutes(m[1]!, m[2]!) })
  }
  for (const m of text.matchAll(CLOCK_RE)) {
    const at = m.index!
    const end = at + m[0].length
    if (hits.some((h) => at < h.end && end > h.at)) continue
    const hour = Number(m[1] ?? m[4] ?? m[6] ?? m[7])
    const minute = m[2] ? Number(m[2]) : 0
    const ampm = ampmOf(m[3] ?? m[5])
    if (hour > 24 || minute > 59 || (ampm && (hour < 1 || hour > 12))) continue
    const sent = sentenceAt(text, at)
    hits.push({ kind: "clock", raw: clean(m[0]), at, end, hour, minute, ampm, period: ampm ? undefined : periodOf(text.slice(sent.start, sent.end)), cue: cueFor(text, at, m[0].length) })
  }

  hits.sort((a, b) => a.at - b.at)
  const count = { clock: 0, day: 0, dur: 0 }
  const prefix = { clock: "T", day: "D", dur: "U" } as const
  const tokens: Token[] = []
  let marked = ""
  let cursor = 0
  for (const h of hits) {
    if (h.at < cursor) continue
    count[h.kind] += 1
    const { end, ...rest } = h
    const id = `${prefix[h.kind]}${count[h.kind]}`
    tokens.push({ id, ...rest })
    marked += `${text.slice(cursor, end)}[${id}]`
    cursor = end
  }
  marked += text.slice(cursor)
  // A time restated with a strong word ("FOR SURE left at 4:30") makes every mention of that time firm.
  const same = (a: Token, b: Token) => a.kind === "clock" && b.kind === "clock" && a.hour === b.hour && a.minute === b.minute && (a.ampm ?? b.ampm) === (b.ampm ?? a.ampm)
  for (const t of tokens) if (t.cue !== "strong" && tokens.some((o) => o.cue === "strong" && same(o, t))) t.cue = "strong"
  return { tokens, marked }
}
