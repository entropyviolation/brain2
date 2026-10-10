/**
 * lib/habit-keyword-source.ts — BIM keyword counts for one habit period
 *
 * A BIM keyword source counts messages already stored by ingest. The whole
 * message must be the phrase: "drank water" counts, "drank water please" does
 * not. The source row chooses how that count is used.
 *
 * - received — one exact message in the period marks the habit done
 * - after — done only after N exact messages in the period
 * - logged — a pattern such as "read {n} pages of {bookname}" parses the
 *   amount and the named slots onto that period. `{n}`, `{x}`, and
 *   `{minutes}` (also `{hours}`) are that amount. A trailing clock is not
 *   part of the pattern; `lib/habit-logged-span.ts` turns a minutes/hours
 *   amount into the prior tracking span.
 *
 * A hit with no timestamp is skipped. It is not painted onto every period.
 */
import { peelLogLineWhen } from "@/lib/ingest/log-line-time"
import type { HabitKeywordSource, HabitKeywordUse, TaskCompletion } from "./types"

/**
 * Placeholders that are the logged number, not a name.
 * `{n}` is the original. `{x}` / `{minutes}` are the same number — a habit
 * pattern written like a pen action (`cleaned for {x} minutes`) still credits
 * the amount. `{hours}` is the number of hours.
 */
const AMOUNT_SLOTS = new Set([
  "n",
  "x",
  "min",
  "mins",
  "minute",
  "minutes",
  "duration",
  "hour",
  "hours",
  "hr",
  "hrs",
])

/** Stamp prefix for a tracking block painted from a logged duration phrase. */
export const LOGGED_SPAN_STAMP_PREFIX = "kw:"

export function isAmountSlot(name: string): boolean {
  return AMOUNT_SLOTS.has(name.trim().toLowerCase())
}

export function isLoggedSpanStamp(id: string | undefined): boolean {
  return !!id && id.startsWith(LOGGED_SPAN_STAMP_PREFIX)
}

export const KEYWORD_USE_OPTIONS: { id: HabitKeywordUse; label: string }[] = [
  { id: "received", label: "True if received" },
  { id: "after", label: "True after a set number" },
  { id: "logged", label: "Logged phrase" },
]

export interface KeywordHit {
  text: string
  /** Send time. Missing means this hit belongs to no period. */
  at?: string | null
}

export interface KeywordPeriodResult {
  count: number
  /** The source has a real observation (at least one dated hit). */
  observed: boolean
  /** The habit is met by this source for the period. */
  done: boolean
  /** Sum of `{n}` on logged-phrase matches. Null when nothing numeric was parsed. */
  amount: number | null
  slots: Record<string, string>
}

export function sanitizeKeywordSource(value: unknown): HabitKeywordSource | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<HabitKeywordSource>
  if (raw.use !== "received" && raw.use !== "after" && raw.use !== "logged") return null
  const count =
    typeof raw.count === "number" && Number.isFinite(raw.count) ? Math.max(1, Math.floor(raw.count)) : undefined
  const pattern = typeof raw.pattern === "string" && raw.pattern.trim() ? raw.pattern.trim() : undefined
  return {
    use: raw.use,
    ...(count != null ? { count } : {}),
    ...(pattern ? { pattern } : {}),
  }
}

/** What the form stores. A blank row is true-if-received. Pattern and N stay so switching modes does not erase them. */
export function keywordForSubmit(keyword: Partial<HabitKeywordSource> | null | undefined): HabitKeywordSource {
  const use: HabitKeywordUse =
    keyword?.use === "after" || keyword?.use === "logged" || keyword?.use === "received" ? keyword.use : "received"
  const count =
    typeof keyword?.count === "number" && Number.isFinite(keyword.count) ? Math.max(1, Math.floor(keyword.count)) : undefined
  const pattern = typeof keyword?.pattern === "string" && keyword.pattern.trim() ? keyword.pattern.trim() : undefined
  return {
    use,
    ...(count != null ? { count } : {}),
    ...(pattern ? { pattern } : {}),
  }
}

export function keywordPhrases(task: { textTriggers?: { keyword?: string }[] | null }): string[] {
  const out: string[] = []
  for (const trigger of task.textTriggers ?? []) {
    const keyword = trigger.keyword?.trim()
    if (!keyword) continue
    if (out.some((phrase) => phrase.toLowerCase() === keyword.toLowerCase())) continue
    out.push(keyword)
  }
  return out
}

/** Whole message, after trim, case-insensitive. A longer line is not a match. */
export function exactKeywordPhrase(message: string, phrase: string): boolean {
  const left = message.trim().toLowerCase()
  const right = phrase.trim().toLowerCase()
  return left.length > 0 && left === right
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Whole-message pattern. `{n}`, `{x}`, and `{minutes}` (and `{hours}`) are the
 * amount. Any other `{name}` is a slot. The message must use the whole pattern;
 * leftover words only land in a trailing slot. Matching is case-insensitive
 * and collapses flexible whitespace.
 */
export function matchLoggedPhrase(
  pattern: string,
  message: string,
): { amount: number | null; slots: Record<string, string> } | null {
  const trimmedPattern = pattern.trim().replace(/\s+/g, " ")
  const text = message.trim()
  if (!trimmedPattern || !text) return null
  const names: { name: string; numeric: boolean }[] = []
  let reSrc = ""
  let last = 0
  const slots = /\{([A-Za-z][A-Za-z0-9_]*)\}/g
  let found: RegExpExecArray | null
  while ((found = slots.exec(trimmedPattern))) {
    reSrc += escapeRegExp(trimmedPattern.slice(last, found.index)).replace(/ /g, "\\s+")
    const name = found[1]!
    const numeric = isAmountSlot(name)
    names.push({ name, numeric })
    const rest = trimmedPattern.slice(found.index + found[0].length)
    const terminal = !/\{[A-Za-z]/.test(rest)
    reSrc += numeric ? "(-?\\d+(?:\\.\\d+)?)" : terminal ? "(.+)" : "(.+?)"
    last = found.index + found[0].length
  }
  if (!names.length) return null
  reSrc += escapeRegExp(trimmedPattern.slice(last)).replace(/ /g, "\\s+")
  const match = new RegExp(`^${reSrc}$`, "i").exec(text)
  if (!match) return null
  const parsed: Record<string, string> = {}
  let amount: number | null = null
  names.forEach((slot, index) => {
    const value = (match[index + 1] ?? "").trim()
    if (!value) return
    parsed[slot.name] = value
    if (slot.numeric) {
      const number = Number(value)
      if (Number.isFinite(number)) amount = number
    }
  })
  return { amount, slots: parsed }
}

/**
 * Logged phrase, allowing a trailing clock the pattern does not mention.
 * `cleaned for 9 minutes 1:11` still matches `cleaned for {x} minutes`.
 * The clock is the same peel a log line uses (`peelLogLineWhen`).
 */
export function matchLoggedPhraseLine(
  pattern: string,
  message: string,
): { amount: number | null; slots: Record<string, string> } | null {
  const exact = matchLoggedPhrase(pattern, message)
  if (exact) return exact
  const peeled = peelLogLineWhen(message.trim(), new Date(2000, 0, 1, 12, 0, 0, 0))
  if (!peeled) return null
  const body = peeled.title.trim()
  if (!body || body === message.trim()) return null
  return matchLoggedPhrase(pattern, body)
}

/**
 * Clock minutes to paint when the phrase is a duration.
 * The number after `{x}` / `{n}` / `{minutes}` followed by a minute word is
 * that many minutes. An hour word (or an `{hours}` slot) converts to minutes.
 * `read {n} pages` is not a duration.
 */
export function loggedPhraseDurationMinutes(pattern: string, amount: number): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null
  const unit = durationUnit(pattern)
  if (!unit) return null
  const minutes = unit === "hours" ? amount * 60 : amount
  const rounded = Math.round(minutes)
  return rounded > 0 ? rounded : null
}

function durationUnit(pattern: string): "minutes" | "hours" | null {
  const re = /\{([A-Za-z][A-Za-z0-9_]*)\}/g
  let found: RegExpExecArray | null
  let unit: "minutes" | "hours" | null = null
  while ((found = re.exec(pattern))) {
    const name = found[1]!.toLowerCase()
    if (!isAmountSlot(name)) continue
    const rest = pattern.slice(found.index + found[0].length).trim()
    const word = (rest.split(/\s+/)[0] ?? "").toLowerCase().replace(/[^a-z]/g, "")
    if (name === "hour" || name === "hours" || name === "hr" || name === "hrs" || /^(hours?|hrs?|h)$/.test(word)) {
      unit = "hours"
      continue
    }
    if (
      name === "min" ||
      name === "mins" ||
      name === "minute" ||
      name === "minutes" ||
      name === "duration" ||
      /^(minutes?|mins?|m)$/.test(word)
    ) {
      if (unit !== "hours") unit = "minutes"
    }
  }
  return unit
}

function hitInstant(at: string | null | undefined): number | null {
  if (at == null) return null
  const text = String(at).trim()
  if (!text) return null
  const instant = Date.parse(text)
  return Number.isFinite(instant) ? instant : null
}

/** Dated hits in `[start, end)`. A missing or unreadable timestamp is not in any period. */
export function hitInPeriod(hit: KeywordHit, start: Date, end: Date): boolean {
  const instant = hitInstant(hit.at)
  if (instant == null) return false
  return instant >= start.getTime() && instant < end.getTime()
}

export function dedupeKeywordHits(hits: readonly KeywordHit[]): KeywordHit[] {
  const seen = new Set<string>()
  const out: KeywordHit[] = []
  for (const hit of hits) {
    const text = hit.text?.trim()
    if (!text) continue
    const instant = hitInstant(hit.at)
    const key = instant == null ? `${text.toLowerCase()}|missing` : `${text.toLowerCase()}|${Math.floor(instant / 60000)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ text, at: instant == null ? undefined : hit.at })
  }
  return out
}

export function evaluateKeywordPeriod(input: {
  hits: readonly KeywordHit[]
  phrases: readonly string[]
  use: HabitKeywordUse
  count?: number
  pattern?: string
  start: Date
  end: Date
}): KeywordPeriodResult {
  const hits = dedupeKeywordHits(input.hits).filter((hit) => hitInPeriod(hit, input.start, input.end))
  if (input.use === "logged") {
    const pattern = input.pattern?.trim() ?? ""
    let count = 0
    let amount = 0
    let sawAmount = false
    const slots: Record<string, string> = {}
    for (const hit of hits) {
      const parsed = pattern ? matchLoggedPhraseLine(pattern, hit.text) : null
      if (!parsed) continue
      count += 1
      if (parsed.amount != null) {
        amount += parsed.amount
        sawAmount = true
      }
      for (const [key, value] of Object.entries(parsed.slots)) {
        if (isAmountSlot(key)) continue
        slots[key] = value
      }
    }
    if (sawAmount) slots.n = String(amount)
    return {
      count,
      observed: count > 0,
      done: count > 0,
      amount: sawAmount ? amount : null,
      slots,
    }
  }
  const phrases = input.phrases.filter((phrase) => phrase.trim())
  const count = hits.filter((hit) => phrases.some((phrase) => exactKeywordPhrase(hit.text, phrase))).length
  if (input.use === "after") {
    const needed = Math.max(1, Math.floor(input.count ?? 2))
    return { count, observed: count > 0, done: count >= needed, amount: null, slots: {} }
  }
  return { count, observed: count > 0, done: count >= 1, amount: null, slots: {} }
}

export interface KeywordCellPatch {
  keywordUse: HabitKeywordUse
  keywordAfter?: number
  keywordHitCount: number
  keywordLogged: boolean
  keywordValue?: number
  keywordSlots?: Record<string, string>
}

export function keywordCompletionPatch(result: KeywordPeriodResult, source: HabitKeywordSource): KeywordCellPatch {
  const slots = Object.keys(result.slots).length ? result.slots : undefined
  return {
    keywordUse: source.use,
    ...(source.use === "after" ? { keywordAfter: Math.max(1, Math.floor(source.count ?? 2)) } : {}),
    keywordHitCount: result.count,
    keywordLogged: result.done,
    ...(result.amount != null ? { keywordValue: result.amount } : {}),
    ...(slots ? { keywordSlots: slots } : {}),
  }
}

/** Overlay keyword fields. Leaves list totals, hand ticks, and goal alone. */
export function applyKeywordToCompletion(
  previous: TaskCompletion | undefined,
  patch: KeywordCellPatch,
): TaskCompletion {
  const next: TaskCompletion = { ...(previous ?? {}) }
  next.keywordUse = patch.keywordUse
  next.keywordHitCount = patch.keywordHitCount
  next.keywordLogged = patch.keywordLogged
  if (patch.keywordAfter != null) next.keywordAfter = patch.keywordAfter
  else delete next.keywordAfter
  if (patch.keywordValue != null) next.keywordValue = patch.keywordValue
  else delete next.keywordValue
  if (patch.keywordSlots) next.keywordSlots = patch.keywordSlots
  else delete next.keywordSlots
  return next
}

export interface StoredKeywordEvent {
  raw?: string
  at?: string | null
  status?: string
}

export interface StoredKeywordEntry {
  title?: string
  date?: string
  startMin?: number
  generatedBy?: { kind?: string; id?: string }
}

/** Local instant for a text-log row. No date → no timestamp, so the row is not a hit in every period. */
export function instantFromEntryDate(date: string | undefined, startMin: number | undefined): string | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  if (startMin == null || !Number.isFinite(startMin)) return null
  const [year, month, day] = date.split("-").map((part) => Number(part))
  const at = new Date(year!, month! - 1, day!, 0, 0, 0, 0)
  at.setMinutes(startMin)
  return Number.isFinite(at.getTime()) ? at.toISOString() : null
}

/**
 * Messages the ingest path already stored: applied log rows, plus text-pipeline
 * instants (a discrete whole-line trigger such as "drank water"). Same text in
 * the same minute counts once. A row with no timestamp is kept so callers can
 * see it, and it matches no period.
 */
export function storedKeywordMessages(
  events: readonly StoredKeywordEvent[],
  entries: readonly StoredKeywordEntry[] = [],
): KeywordHit[] {
  const hits: KeywordHit[] = []
  for (const event of events) {
    if (event.status && event.status !== "applied") continue
    const text = event.raw?.trim()
    if (!text) continue
    hits.push({ text, at: event.at })
  }
  for (const entry of entries) {
    if (entry.generatedBy?.kind !== "text") continue
    if (isLoggedSpanStamp(entry.generatedBy.id)) continue
    const text = entry.title?.trim()
    if (!text) continue
    hits.push({ text, at: instantFromEntryDate(entry.date, entry.startMin) })
  }
  return dedupeKeywordHits(hits)
}

const MAX_RECEIPTS = 400

export interface KeywordReceipt {
  text: string
  at: string
}

/** Dated matches worth keeping after the 200-line ingest log rotates. Undated hits are not stored. */
export function rememberKeywordReceipts(
  existing: readonly KeywordReceipt[] | undefined,
  hits: readonly KeywordHit[],
  phrases: readonly string[],
  source: HabitKeywordSource,
): KeywordReceipt[] | undefined {
  const kept: KeywordReceipt[] = []
  const seen = new Set<string>()
  const consider = (text: string, at: string | null | undefined) => {
    const phrase = text.trim()
    const instant = hitInstant(at)
    if (!phrase || instant == null || at == null || !String(at).trim()) return
    const matches =
      source.use === "logged"
        ? !!source.pattern && matchLoggedPhraseLine(source.pattern, phrase) != null
        : phrases.some((item) => exactKeywordPhrase(phrase, item))
    if (!matches) return
    const key = `${phrase.toLowerCase()}|${Math.floor(instant / 60000)}`
    if (seen.has(key)) return
    seen.add(key)
    kept.push({ text: phrase, at: new Date(instant).toISOString() })
  }
  for (const row of existing ?? []) consider(row.text, row.at)
  for (const hit of hits) consider(hit.text, hit.at)
  const next = kept.slice(-MAX_RECEIPTS)
  if (!next.length) return existing?.length ? [] : undefined
  if (
    existing &&
    existing.length === next.length &&
    existing.every((row, index) => row.text === next[index]?.text && row.at === next[index]?.at)
  ) {
    return existing as KeywordReceipt[]
  }
  return next
}
