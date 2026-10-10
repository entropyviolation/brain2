/**
 * lib/person-profile.ts — Biography on a person
 *
 * Birthday and standing notes stay attributes on the catalog Person type.
 * Everything else lives on `Task.personProfile`, so a Person type already
 * seeded in the vault still shows these fields. Derived spans (how long known,
 * time since last seen, days until the next birthday) are read here and not
 * stored.
 */
export type AddressPrecision = "mailing" | "neighborhood" | "state" | "country"

export interface PersonAddress {
  precision: AddressPrecision
  /** The words known: a street, a neighborhood, a state, or a country. */
  text: string
}

export interface PersonDatedNote {
  id: string
  /** Local day YYYY-MM-DD. */
  date: string
  text: string
}

export interface PersonInteraction {
  id: string
  date: string
  text: string
  /** This day counts as seeing them. */
  saw?: boolean
}

export interface PersonGiftIdea {
  id: string
  text: string
  given?: boolean
}

export interface PersonProfile {
  fullName?: string
  nicknames?: string[]
  /**
   * Optional free text: friend, sister, boyfriend, or whatever they type.
   * Empty stays absent.
   */
  relation?: string
  /** Local day YYYY-MM-DD. */
  dateMet?: string
  dateMetEstimated?: boolean
  instagram?: string
  address?: PersonAddress
  noteLog?: PersonDatedNote[]
  interactions?: PersonInteraction[]
  /**
   * Quick notes on the person. The Gift ideas folder lists are separate.
   * Turning Close on does not clear these.
   */
  giftIdeas?: PersonGiftIdea[]
  /**
   * Close people get a Gift ideas list. Absent and false are the same: off.
   * Turning it off does not delete a list that already exists.
   */
  close?: boolean
}

export interface CalendarSpan {
  years: number
  months: number
  days: number
}

interface Ymd {
  y: number
  m: number
  d: number
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const ADDRESS_PRECISIONS = new Set<AddressPrecision>(["mailing", "neighborhood", "state", "country"])

export function localIsoDate(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function ymdFromDate(date: Date): Ymd {
  return { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() }
}

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function parseIsoDate(value: string): Ymd | null {
  const match = ISO_DATE.exec(value)
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null
  return { y, m, d }
}

function compareYmd(a: Ymd, b: Ymd): number {
  if (a.y !== b.y) return a.y - b.y
  if (a.m !== b.m) return a.m - b.m
  return a.d - b.d
}

function daysBetween(from: Ymd, to: Ymd): number {
  const utc = (p: Ymd) => Date.UTC(p.y, p.m - 1, p.d)
  return Math.round((utc(to) - utc(from)) / 86400000)
}

function addMonths(p: Ymd, count: number): Ymd {
  const total = p.y * 12 + (p.m - 1) + count
  const y = Math.floor(total / 12)
  const m = (total % 12) + 1
  return { y, m, d: Math.min(p.d, daysInMonth(y, m)) }
}

/** Whole years, months, and days from `fromIso` up to `toIso`. Null when `from` is later or either day is not a real date. */
export function calendarSpan(fromIso: string, toIso: string): CalendarSpan | null {
  const from = parseIsoDate(fromIso)
  const to = parseIsoDate(toIso)
  if (!from || !to || compareYmd(from, to) > 0) return null
  let years = to.y - from.y
  let cursor: Ymd = { y: from.y + years, m: from.m, d: Math.min(from.d, daysInMonth(from.y + years, from.m)) }
  if (compareYmd(cursor, to) > 0) {
    years -= 1
    cursor = { y: from.y + years, m: from.m, d: Math.min(from.d, daysInMonth(from.y + years, from.m)) }
  }
  let months = 0
  while (months < 12) {
    const next = addMonths(cursor, 1)
    if (compareYmd(next, to) > 0) break
    cursor = next
    months += 1
  }
  return { years, months, days: daysBetween(cursor, to) }
}

export function formatSpan(span: CalendarSpan): string {
  const parts: string[] = []
  if (span.years) parts.push(`${span.years} ${span.years === 1 ? "year" : "years"}`)
  if (span.months) parts.push(`${span.months} ${span.months === 1 ? "month" : "months"}`)
  if (span.days || parts.length === 0) parts.push(`${span.days} ${span.days === 1 ? "day" : "days"}`)
  return parts.join(", ")
}

export function knownForSentence(
  dateMet: string | undefined,
  estimated: boolean | undefined,
  todayIso: string,
): string {
  if (!dateMet) return "Date met is not set."
  const span = calendarSpan(dateMet, todayIso)
  if (!span) return dateMet && !parseIsoDate(dateMet) ? "Date met is not set." : "That date is still ahead."
  if (span.years === 0 && span.months === 0 && span.days === 0) {
    return estimated ? "About today." : "Just met."
  }
  const body = formatSpan(span)
  return estimated ? `About ${body}.` : `${body}.`
}

/**
 * Latest day they were seen. Pen color is the rule: a Company block painted
 * with a joined pen counts even without a `company-timeblock` row. A stored
 * timeblock row is still read, so older time together is not dropped.
 * Pass only the entries that should count (Company scope).
 */
export function lastTogetherDate(
  profile: PersonProfile | undefined,
  joins: ReadonlyArray<{ kind: string; penId?: unknown; entryId?: unknown }> | undefined,
  entries: ReadonlyArray<{ id: string; date: string; penId: string }>,
): string | undefined {
  const dates: string[] = []
  for (const row of profile?.interactions ?? []) {
    if (row.saw && parseIsoDate(row.date)) dates.push(row.date)
  }
  const penIds = new Set<string>()
  const entryIds = new Set<string>()
  for (const join of joins ?? []) {
    if (join.kind === "company-pen" && typeof join.penId === "string" && join.penId) penIds.add(join.penId)
    if (join.kind === "company-timeblock" && typeof join.entryId === "string" && join.entryId) {
      entryIds.add(join.entryId)
    }
  }
  for (const entry of entries) {
    if (!parseIsoDate(entry.date)) continue
    if (entryIds.has(entry.id) || penIds.has(entry.penId)) dates.push(entry.date)
  }
  if (dates.length === 0) return undefined
  dates.sort()
  return dates[dates.length - 1]
}

export function lastSawSentence(lastIso: string | undefined, todayIso: string): string {
  if (!lastIso) return "No time together recorded yet."
  if (lastIso === todayIso) return "Today."
  const span = calendarSpan(lastIso, todayIso)
  if (!span) return "That day is still ahead."
  return `${formatSpan(span)} ago.`
}

/** Days until the next month/day. February 29 is read on March 1 in a common year. Null when the birthday is missing or not a real date. */
export function daysUntilBirthday(birthday: string | undefined, today: Ymd): number | null {
  const parsed = birthday ? parseIsoDate(birthday.slice(0, 10)) : null
  if (!parsed) return null
  const on = (year: number): Ymd => {
    if (parsed.m === 2 && parsed.d === 29 && !isLeap(year)) return { y: year, m: 3, d: 1 }
    return { y: year, m: parsed.m, d: parsed.d }
  }
  const thisYear = on(today.y)
  const next = compareYmd(thisYear, today) >= 0 ? thisYear : on(today.y + 1)
  return daysBetween(today, next)
}

export function birthdaySentence(days: number | null): string {
  if (days == null) return "No birthday yet."
  if (days === 0) return "Birthday today."
  if (days === 1) return "1 day until next birthday."
  return `${days} days until next birthday.`
}

export function addressPrecisionLabel(precision: AddressPrecision): string {
  switch (precision) {
    case "mailing":
      return "Mailing address"
    case "neighborhood":
      return "Neighborhood"
    case "state":
      return "State"
    case "country":
      return "Country"
  }
}

export function addressPlaceholder(precision: AddressPrecision): string {
  switch (precision) {
    case "mailing":
      return "Street, city, postal code"
    case "neighborhood":
      return "Neighborhood"
    case "state":
      return "State"
    case "country":
      return "Country"
  }
}

/** Handle only. Accepts @name or an instagram.com URL. */
export function normalizeInstagram(raw: string): string {
  let s = raw.trim()
  s = s.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
  s = s.replace(/^@+/, "")
  s = s.split(/[/?#]/)[0] ?? ""
  return s.trim()
}

function cleanText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const text = value.trim()
  return text || undefined
}

/** Keep a string the person is still typing, including a trailing space. Drop it when it is only whitespace. */
function keepTyped(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined
  return value
}

function cleanDate(value: unknown): string | undefined {
  return typeof value === "string" && parseIsoDate(value) ? value : undefined
}

function cleanNotes(rows: unknown): PersonDatedNote[] | undefined {
  if (!Array.isArray(rows)) return undefined
  const out: PersonDatedNote[] = []
  for (const row of rows) {
    if (!row || typeof row !== "object") continue
    const rec = row as { id?: unknown; date?: unknown; text?: unknown }
    const id = cleanText(rec.id)
    const date = cleanDate(rec.date)
    const text = cleanText(rec.text)
    if (!id || !date || !text) continue
    out.push({ id, date, text })
  }
  return out.length > 0 ? out : undefined
}

function cleanInteractions(rows: unknown): PersonInteraction[] | undefined {
  if (!Array.isArray(rows)) return undefined
  const out: PersonInteraction[] = []
  for (const row of rows) {
    if (!row || typeof row !== "object") continue
    const rec = row as { id?: unknown; date?: unknown; text?: unknown; saw?: unknown }
    const id = cleanText(rec.id)
    const date = cleanDate(rec.date)
    const text = cleanText(rec.text)
    if (!id || !date || !text) continue
    out.push(rec.saw === true ? { id, date, text, saw: true } : { id, date, text })
  }
  return out.length > 0 ? out : undefined
}

function cleanGifts(rows: unknown): PersonGiftIdea[] | undefined {
  if (!Array.isArray(rows)) return undefined
  const out: PersonGiftIdea[] = []
  for (const row of rows) {
    if (!row || typeof row !== "object") continue
    const rec = row as { id?: unknown; text?: unknown; given?: unknown }
    const id = cleanText(rec.id)
    const text = cleanText(rec.text)
    if (!id || !text) continue
    out.push(rec.given === true ? { id, text, given: true } : { id, text })
  }
  return out.length > 0 ? out : undefined
}

function assembleProfile(
  raw: PersonProfile,
  text: (value: unknown) => string | undefined,
  instagramOf: (value: unknown) => string | undefined,
): PersonProfile | undefined {
  const fullName = text(raw.fullName)
  const nicknames = Array.isArray(raw.nicknames)
    ? raw.nicknames
        .map((name) => (typeof name === "string" ? name.trim() : ""))
        .filter((name, index, all) => name && all.findIndex((other) => other.toLowerCase() === name.toLowerCase()) === index)
    : []
  const dateMet = cleanDate(raw.dateMet)
  const instagram = instagramOf(raw.instagram)
  const addressText = text(raw.address?.text)
  const precision = raw.address?.precision
  const address =
    addressText && precision && ADDRESS_PRECISIONS.has(precision)
      ? { precision, text: addressText }
      : undefined
  const relation = text(raw.relation)
  const noteLog = cleanNotes(raw.noteLog)
  const interactions = cleanInteractions(raw.interactions)
  const giftIdeas = cleanGifts(raw.giftIdeas)
  const next: PersonProfile = {}
  if (fullName) next.fullName = fullName
  if (nicknames.length > 0) next.nicknames = nicknames
  if (relation) next.relation = relation
  if (raw.close === true) next.close = true
  if (dateMet) {
    next.dateMet = dateMet
    if (raw.dateMetEstimated) next.dateMetEstimated = true
  }
  if (instagram) next.instagram = instagram
  if (address) next.address = address
  if (noteLog) next.noteLog = noteLog
  if (interactions) next.interactions = interactions
  if (giftIdeas) next.giftIdeas = giftIdeas
  return Object.keys(next).length > 0 ? next : undefined
}

/**
 * Biography as the person is typing it. A trailing space stays so the next
 * word can be typed. Whitespace-only fields are omitted.
 */
export function presentPersonProfile(raw: PersonProfile | undefined): PersonProfile | undefined {
  if (!raw) return undefined
  return assembleProfile(raw, keepTyped, (value) => keepTyped(value))
}

/** Drop blank fields and trim the rest so an empty biography is stored as absent. */
export function cleanPersonProfile(raw: PersonProfile | undefined): PersonProfile | undefined {
  if (!raw) return undefined
  return assembleProfile(raw, cleanText, (value) =>
    normalizeInstagram(typeof value === "string" ? value : "") || undefined,
  )
}
