/**
 * lib/social-bimby/birthday-reply.ts — A reply to a BIRTHDAY card, read into a date
 *
 * Pure, no model. "the birthday was the same day as the foxtide show at brooklyn steel last weekend. and 22 years
 * ago so 2004" holds three things:
 *
 *   - the year: said ("2004"), or counted back ("22 years ago", "turned 22").
 *   - the day: said ("march 14", "3/14"), or pinned to an event ("same day as the foxtide show at brooklyn steel").
 *   - when the event was: "last weekend", "yesterday", "in october" … a window of days to look in.
 *
 * An event day is looked up on the web by the caller (`card-reply.ts`); `pickEventDate` reads the results for
 * dates near the event's words, inside the window. Only the query leaves the Mac.
 */

import type { WebFound } from "@/lib/bim-flow/web-lane"

const pad = (n: number) => String(n).padStart(2, "0")
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const day0 = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?"
const monthOf = (word: string) => MONTHS.indexOf(word.slice(0, 3).toLowerCase())

export interface DayWindow {
  from: string
  to: string
  /** As said ("last weekend"), or "the past year" when nothing was said. */
  said: string
}

export interface BirthdayReply {
  /** Said outright, or counted from "N years ago" / "turned N" once the event's year is known. */
  year?: number
  yearsAgo?: number
  /** "march 14" said outright: no search needed. */
  monthDay?: { month: number; day: number }
  /** The event the birthday fell on, words only ("foxtide show at brooklyn steel"). */
  event?: string
  /** When the event was. */
  window?: DayWindow
  /** The search query for the event. */
  query?: string
}

/** The days a time phrase covers, counted from `now`. Null when the line names no time. */
export function windowOf(phrase: string, now: Date): DayWindow | null {
  const p = phrase.toLowerCase().trim()
  const today = day0(now)
  const dow = today.getDay()
  const monday = addDays(today, -((dow + 6) % 7))
  const span = (a: Date, b: Date): DayWindow => ({ from: ymd(a), to: ymd(b > today ? today : b), said: phrase.trim() })
  if (/\b(?:yesterday|last night)\b/.test(p)) return span(addDays(today, -1), addDays(today, -1))
  if (/\b(?:tonight|today)\b/.test(p)) return span(today, today)
  if (/\b(?:this past|this) weekend\b/.test(p)) {
    // The weekend that is on now, or the one just gone.
    const fri = dow === 5 || dow === 6 || dow === 0 ? addDays(today, -((dow + 2) % 7)) : addDays(monday, -3)
    return span(fri, addDays(fri, 2))
  }
  if (/\blast weekend\b/.test(p)) return span(addDays(monday, -3), addDays(monday, -1))
  if (/\blast week\b/.test(p)) return span(addDays(monday, -7), addDays(monday, -1))
  if (/\bthis week\b/.test(p)) return span(monday, today)
  const wd = new RegExp(`\\b(?:last|on|this past)\\s+(${WEEKDAYS.join("|")})\\b`).exec(p)
  if (wd) {
    const want = WEEKDAYS.indexOf(wd[1]!)
    const back = (dow - want + 7) % 7 || 7
    const d = addDays(today, -back)
    return span(d, d)
  }
  const ago = /\b(\d+|a|an|one|two|three|four|a few|a couple of)\s+(day|week|month)s?\s+ago\b/.exec(p)
  if (ago) {
    const n = /^\d+$/.test(ago[1]!) ? Number(ago[1]) : ({ a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, "a few": 3, "a couple of": 2 } as Record<string, number>)[ago[1]!] ?? 1
    const unit = ago[2] === "day" ? 1 : ago[2] === "week" ? 7 : 30
    const mid = addDays(today, -n * unit)
    const slack = ago[2] === "day" ? 1 : ago[2] === "week" ? 4 : 15
    return span(addDays(mid, -slack), addDays(mid, slack))
  }
  if (/\blast month\b/.test(p)) return span(new Date(today.getFullYear(), today.getMonth() - 1, 1), new Date(today.getFullYear(), today.getMonth(), 0))
  if (/\bthis month\b/.test(p)) return span(new Date(today.getFullYear(), today.getMonth(), 1), today)
  const inMonth = new RegExp(`\\b(?:in|back in|during)\\s+${MONTH_RE}(?:\\s+(\\d{4}))?\\b`).exec(p)
  if (inMonth) {
    const m = monthOf(inMonth[1]!)
    const y = inMonth[2] ? Number(inMonth[2]) : m > today.getMonth() ? today.getFullYear() - 1 : today.getFullYear()
    return span(new Date(y, m, 1), new Date(y, m + 1, 0))
  }
  return null
}

const TIME_PHRASE = new RegExp(
  [
    "yesterday",
    "last night",
    "tonight",
    "today",
    "(?:this past|this|last) (?:weekend|week|month)",
    `(?:last|on|this past) (?:${WEEKDAYS.join("|")})`,
    "(?:\\d+|a|an|one|two|three|four|a few|a couple of) (?:day|week|month)s? ago",
    `(?:in|back in|during) ${MONTH_RE}(?: \\d{4})?`,
  ].join("|"),
  "i",
)

const ANCHOR = /\b(?:(?:the\s+)?same\s+(?:day|night|date)\s+(?:as|of)|(?:on\s+)?the\s+(?:day|night|date)\s+of|(?:it\s+was\s+)?(?:at|during)\s+the)\s+(.+?)(?=[.;!?]|,\s*(?:and|so|but)\b|\s+and\s+(?:\d|it|she|he|they|was|so)\b|$)/i
const EXPLICIT_DAY = new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b|\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\b|\\b(\\d{1,2})\\/(\\d{1,2})(?:\\/\\d{2,4})?\\b`, "i")
/** Event words that only say what kind of thing it was: kept in the query, not required near a date. */
const GENERIC = new Set(["show", "concert", "gig", "party", "set", "night", "the", "a", "an", "at", "in", "on", "of", "to", "my", "our", "their", "her", "his", "was", "that"])

/** The words of the event that must sit near a date on a page ("foxtide", "brooklyn", "steel"). */
export function eventWords(event: string): string[] {
  return event
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]+/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !GENERIC.has(w))
}

/** Read a reply to a birthday card. Every part is optional; the caller says what is missing. */
export function readBirthdayReply(text: string, now: Date): BirthdayReply {
  const t = text.replace(/\s+/g, " ").trim()
  const out: BirthdayReply = {}
  const year = /\b(19\d\d|20\d\d)\b/.exec(t)
  if (year) out.year = Number(year[1])
  const ago = /\b(\d{1,3})\s+(?:years?|yrs?)\s+(?:ago|before|earlier)\b|\bturned\s+(\d{1,3})\b|\b(\d{1,3})(?:st|nd|rd|th)\s+(?:birthday|bday)\b/i.exec(t)
  if (ago) out.yearsAgo = Number(ago[1] ?? ago[2] ?? ago[3])

  const anchor = ANCHOR.exec(t)
  if (anchor) {
    let event = anchor[1]!.trim()
    const time = TIME_PHRASE.exec(event)
    if (time) {
      out.window = windowOf(time[0], now) ?? undefined
      event = (event.slice(0, time.index) + event.slice(time.index + time[0].length)).replace(/\s+/g, " ")
    }
    event = event.replace(/^(?:the|a|an|that|this)\s+/i, "").replace(/[\s,]+$/g, "").trim()
    if (event) out.event = event
  }
  if (!out.window) {
    const time = TIME_PHRASE.exec(t)
    if (time) out.window = windowOf(time[0], now) ?? undefined
  }

  // A day said outright ("march 14"), outside the event's own words.
  const rest = anchor ? t.replace(anchor[0], " ") : t
  const said = EXPLICIT_DAY.exec(rest)
  if (said) {
    const month = said[1] ? monthOf(said[1]) : said[4] ? monthOf(said[4]) : Number(said[5]) - 1
    const day = Number(said[2] ?? said[3] ?? said[6])
    if (month >= 0 && month < 12 && day >= 1 && day <= 31) out.monthDay = { month: month + 1, day }
  }

  if (out.event && !out.monthDay) {
    const w = out.window
    const monthYear = w ? (() => {
      const a = new Date(`${w.from}T12:00:00`)
      const b = new Date(`${w.to}T12:00:00`)
      const name = (d: Date) => d.toLocaleString("en-US", { month: "long" })
      return a.getMonth() === b.getMonth() ? `${name(a)} ${a.getFullYear()}` : `${name(a)} ${name(b)} ${b.getFullYear()}`
    })() : ""
    out.query = [out.event.replace(/\b(?:at|the|a|an)\b/gi, " "), monthYear].join(" ").replace(/\s+/g, " ").trim()
  }
  return out
}

export interface DateMention {
  iso: string
  /** Where in the text it starts. */
  at: number
  raw: string
  weekday?: number
}

/**
 * Every date written in a text. A date with no year takes the year that puts it nearest `near` (the window's middle).
 */
export function datesIn(text: string, near: Date): DateMention[] {
  const out: DateMention[] = []
  const wdRe = "(?:(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)[a-z]*\\.?,?\\s+)?"
  const yearFor = (month: number, day: number, said?: string): number | null => {
    if (said) return Number(said.length === 2 ? `20${said}` : said)
    let best: number | null = null
    for (const y of [near.getFullYear() - 1, near.getFullYear(), near.getFullYear() + 1]) {
      const d = new Date(y, month, day)
      if (best === null || Math.abs(d.getTime() - near.getTime()) < Math.abs(new Date(best, month, day).getTime() - near.getTime())) best = y
    }
    return best
  }
  const push = (at: number, raw: string, y: number | null, month: number, day: number, wd?: string) => {
    if (y === null || month < 0 || month > 11 || day < 1 || day > 31) return
    const d = new Date(y, month, day)
    if (d.getMonth() !== month) return
    out.push({ iso: ymd(d), at, raw: raw.trim(), ...(wd ? { weekday: WEEKDAYS.findIndex((w) => w.startsWith(wd.toLowerCase().slice(0, 3))) } : {}) })
  }
  for (const m of text.matchAll(/\b(20\d\d|19\d\d)-(\d\d)-(\d\d)\b/g)) push(m.index!, m[0], Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  for (const m of text.matchAll(new RegExp(`\\b${wdRe}${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?`, "gi")))
    push(m.index!, m[0], yearFor(monthOf(m[2]!), Number(m[3]), m[4]), monthOf(m[2]!), Number(m[3]), m[1])
  for (const m of text.matchAll(new RegExp(`\\b${wdRe}(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}(?:,?\\s+(\\d{4}))?`, "gi")))
    push(m.index!, m[0], yearFor(monthOf(m[3]!), Number(m[2]), m[4]), monthOf(m[3]!), Number(m[2]), m[1])
  for (const m of text.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?\b/g)) push(m.index!, m[0], yearFor(Number(m[1]) - 1, Number(m[2]), m[3]), Number(m[1]) - 1, Number(m[2]))
  return out
}

export interface EventDate {
  iso: string
  /** True when the day is inside the window; false when only a nearby day was found. */
  inWindow: boolean
  /** The source it was read from, and the words around it. */
  source: { title: string; url: string; said: string }
  /** Other days the pages gave for the event, best first. */
  others: string[]
}

/** The day the event was, from a web search: dates near the event's words, inside the window first. */
export function pickEventDate(found: WebFound, reply: BirthdayReply, now: Date): EventDate | null {
  const words = eventWords(reply.event ?? "")
  if (!words.length) return null
  const from = reply.window?.from ?? ymd(addDays(now, -365))
  const to = reply.window?.to ?? ymd(now)
  const mid = new Date((new Date(`${from}T12:00:00`).getTime() + new Date(`${to}T12:00:00`).getTime()) / 2)
  const near = (iso: string, slack: number) => iso >= ymd(addDays(new Date(`${from}T12:00:00`), -slack)) && iso <= ymd(addDays(new Date(`${to}T12:00:00`), slack))
  const byUrl = new Map(found.pages.map((p) => [p.url, p.text]))
  const tally = new Map<string, { score: number; source: EventDate["source"] }>()
  for (const r of found.results) {
    const texts = [`${r.title}. ${r.snippet}`, byUrl.get(r.url) ?? ""]
    for (const text of texts) {
      if (!text) continue
      const lower = text.toLowerCase()
      for (const d of datesIn(text, mid)) {
        if (!near(d.iso, 14)) continue
        const around = lower.slice(Math.max(0, d.at - 200), d.at + d.raw.length + 200)
        const hits = words.filter((w) => around.includes(w)).length
        if (!hits) continue
        const weekdayOk = d.weekday !== undefined && d.weekday === new Date(`${d.iso}T12:00:00`).getDay() ? 1 : 0
        const score = hits / words.length + weekdayOk * 0.25
        // The words around the date, cut at word edges.
        const said = text.slice(Math.max(0, d.at - 90), d.at + d.raw.length + 90).replace(/^\S*\s/, "").replace(/\s\S*$/, "").replace(/\s+/g, " ").trim()
        const had = tally.get(d.iso)
        if (!had) tally.set(d.iso, { score, source: { title: r.title, url: r.url, said } })
        else {
          had.score += score
          if (score > 0.99 && had.source.url !== r.url && had.source.said.length < said.length) had.source = { title: r.title, url: r.url, said }
        }
      }
    }
  }
  const ranked = [...tally.entries()]
    .map(([iso, v]) => ({ iso, ...v, inWindow: near(iso, 0) }))
    .sort((a, b) => Number(b.inWindow) - Number(a.inWindow) || b.score - a.score)
  const best = ranked[0]
  if (!best) return null
  return { iso: best.iso, inWindow: best.inWindow, source: best.source, others: ranked.slice(1, 4).map((r) => r.iso) }
}
