/**
 * lib/time-entries.ts — Minute-resolution interval model for Tracking
 *
 * The TimeGrid used to store a fixed array of 96 fifteen-minute slots per scope
 * per day. Minute resolution would make that 1440 entries per scope per day —
 * roughly 8 MB a year of mostly nulls, which localStorage cannot carry. Intervals
 * cost only what was actually tracked, so the grid can be minute-accurate while a
 * typical day stays a couple of dozen records.
 *
 * It also makes each painted block a real **event**: it has an identity, a start
 * and an end, optional variants and notes, and can be listed, edited, split, and
 * deleted from the Activity Log rather than existing only as a color on a grid.
 * `precision` omitted is certain; `"estimated"` is assumed / reconstructed.
 *
 * All times are minutes past local midnight; `endMin` is **exclusive**, so
 * 09:00–10:00 is `{ startMin: 540, endMin: 600 }` = 60 minutes. A From/To where
 * To is an earlier non-zero clock continues onto the next calendar day as two
 * slices sharing `spanId` (`wrappingSlices` / `paintWrappingRange`) — 23:00–02:00
 * is three hours, not a clip at midnight. Pass `endDate` when the user picked a
 * later calendar day explicitly. `00:00` as To still means the end of this day.
 * Everything here is pure — the store is the only stateful layer
 * (`lib/time-tracking-store.ts`).
 */

export const MINUTES_PER_DAY = 24 * 60

/** Cell sizes the grid can render. Data stays minute-accurate regardless. */
export const GRID_STEPS = [1, 5, 10, 15, 30] as const
export type GridStep = (typeof GRID_STEPS)[number]
export const DEFAULT_GRID_STEP: GridStep = 5

/**
 * How much time the grid shows at once.
 *
 * A day is for accuracy — where exactly did the afternoon go. A week is for
 * shape and for catching up: seven columns side by side make a routine, a gap,
 * or three unlogged days obvious at a glance, and let one drag fill Monday
 * through Friday. Both paint the same intervals into the same store; this only
 * decides what is on screen.
 */
export const GRID_SPANS = ["day", "week"] as const
export type GridSpan = (typeof GRID_SPANS)[number]

/**
 * Cell sizes for the week grid. A minute-per-row week would be 1440 rows tall
 * and useless, so the finest offered is the finest that stays legible; anything
 * more precise is a job for the day grid or the block editor, both one click
 * away.
 */
export const WEEK_STEPS = [15, 30, 60] as const
export type WeekStep = (typeof WEEK_STEPS)[number]
export const DEFAULT_WEEK_STEP: WeekStep = 30

/** Observed vs reconstructed time. Same vocabulary as the sleep log. */
export type TrackingPrecision = "estimated" | "definite"

export function isSpeculative(entry: { precision?: TrackingPrecision }): boolean {
  return entry.precision === "estimated"
}

/**
 * The entry a cell should take its color from, given a minute-indexed lookup.
 *
 * At one minute per cell that is simply the entry on that minute. At coarser
 * steps it is whichever entry holds the most of the cell, which keeps a
 * four-minute block from vanishing inside a 15-minute cell just because the
 * cell's first minute happens to be empty. Shared by both grids so a day and a
 * week never draw the same hour differently.
 */
export function dominantEntry(map: (TimeEntry | null)[], start: number, step: number): TimeEntry | null {
  if (step === 1) return map[start] ?? null
  const counts = new Map<TimeEntry, number>()
  for (let m = start; m < Math.min(start + step, MINUTES_PER_DAY); m++) {
    const entry = map[m]
    if (entry) counts.set(entry, (counts.get(entry) ?? 0) + 1)
  }
  let best: TimeEntry | null = null
  let bestCount = 0
  for (const [entry, count] of counts) {
    if (count > bestCount) {
      best = entry
      bestCount = count
    }
  }
  return best
}

/**
 * Intervals occupy a span of minutes. Instants are discrete events with a
 * single clock time — "smoked weed", "fell asleep", sunrise — and do not fill
 * occupancy. An interval may name an instant as its start or end.
 */
export type TimeEntryKind = "interval" | "instant"

/**
 * One tracked block. A pen may carry several **variants** at once ("hanging out"
 * with both Elijah and Rebecca), which is why they are a list rather than a
 * second pen — the parent total must stay one span of time.
 *
 * `penId` is the **primary** pen (grid color). `secondaryPenIds` are extra pens
 * on the same minutes: they do not change the color, but they do count toward
 * every tag / habit / operation / goal any assigned pen fulfils. A block may
 * also carry a display `title` that surfaces instead of the pen name; counting
 * still uses pens and tags.
 */
export interface TimeEntry {
  id: string
  /** Local YYYY-MM-DD. */
  date: string
  scopeId: string
  /** Primary pen — the color the grid usually shows. */
  penId: string
  /**
   * Extra pens on this same block (same view). Omitted on older vaults — those
   * blocks have a primary and no secondaries. Never includes `penId`.
   */
  secondaryPenIds?: string[]
  /**
   * Omitted = an ordinary interval (old vaults). `"instant"` is a discrete
   * event at `startMin` with no duration — occupancy and untracked gaps ignore
   * it. The same event can later be named as the start or end of an interval
   * (`startEventId` / `endEventId`).
   */
  kind?: TimeEntryKind
  /** Inclusive, 0–1439. For instants this is the event's clock time. */
  startMin: number
  /**
   * Exclusive, 1–1440. For instants this equals `startMin` (duration 0) so
   * occupancy loops (`m < endMin`) never count the minute as filled.
   */
  endMin: number
  /** Instant this interval started at, when the start was a discrete event. */
  startEventId?: string
  /** Instant this interval ended at, when the end was a discrete event. */
  endEventId?: string
  /**
   * A scissors cut lives on the left half: do not merge this block with the
   * identical neighbour that begins at `endMin`. Same-pen adjacent strokes
   * without a seam still merge. Omitted on older vaults — those merge as before.
   */
  splitAfter?: boolean
  /** `PenVariant` ids; several can be true for the same minutes. */
  variantIds?: string[]
  /**
   * Tags that apply to *this block only*, on top of whatever its pen always
   * carries. Four hours of "San Diego Zoo" in the Location scope can count as
   * Exercise without every zoo visit becoming exercise forever.
   */
  tagIds?: string[]
  /**
   * Set when another record produced this block rather than a brush stroke —
   * the sleep log (`lib/sleep-sync.ts`) or Screen Time sync (`lib/screentime/sync.ts`).
   * `id` is the local calendar day (`YYYY-MM-DD`). Each generator replaces only
   * its own kind+id, so re-deriving is idempotent and can never quietly delete
   * time the user painted by hand.
   */
  generatedBy?: { kind: "sleep" | "screentime" | "text"; id: string }
  /**
   * Links calendar-day slices of one continuous block. Painting 11 PM–2 AM
   * stores Thursday 23:00–24:00 and Friday 00:00–02:00 with the same id, so the
   * Activity Log and block editor can treat them as one event that crossed
   * midnight rather than two unrelated strokes.
   */
  spanId?: string
  /**
   * Optional display name for this block ("walk to the beach"). Empty/omitted
   * falls back to the primary pen's name. Surfaces that show a block title use
   * this; Analytics counting still uses pens and tags.
   */
  title?: string
  notes?: string
  project?: string
  books?: string
  pages?: number
  /** Omitted = certain. `"estimated"` is assumed / speculative. */
  precision?: TrackingPrecision
}

/** The detail fields that make two otherwise identical blocks worth keeping apart. */
const DETAIL_KEYS = ["title", "notes", "project", "books", "pages", "startEventId", "endEventId"] as const

export function isInstant(entry: Pick<TimeEntry, "kind">): boolean {
  return entry.kind === "instant"
}

/** Sleep-derived or sleep-tagged blocks use woke/fell-asleep wording in the editor. */
export function isSleepBlock(entry: Pick<TimeEntry, "generatedBy" | "tagIds" | "penId">, sleepPenIds?: Set<string>): boolean {
  if (entry.generatedBy?.kind === "sleep") return true
  if (entry.tagIds?.includes("tag-sleep")) return true
  return sleepPenIds?.has(entry.penId) ?? false
}

export function entryMinutes(entry: TimeEntry): number {
  return Math.max(0, entry.endMin - entry.startMin)
}

export function totalMinutes(entries: TimeEntry[]): number {
  return entries.reduce((sum, e) => sum + entryMinutes(e), 0)
}

export function clampMinute(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(MINUTES_PER_DAY, Math.max(0, Math.round(value)))
}

function shiftDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number)
  const shifted = new Date(y, (m ?? 1) - 1, (d ?? 1) + days)
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}-${String(
    shifted.getDate(),
  ).padStart(2, "0")}`
}

/** Local calendar day after `dateKey`. */
function nextDateKey(dateKey: string): string {
  return shiftDateKey(dateKey, 1)
}

/**
 * Split a typed From/To into calendar-day slices.
 *
 * `To` after `From` is the same day. `To` of 00:00, or `To === From`, means
 * midnight at the **end** of this day (15 hours from 09:00, not a wrap). Any
 * other `To` earlier than `From` continues onto the next morning — 23:00–02:00
 * is three hours, not a same-day 02:00–23:00 fill and not a clip at midnight.
 * Pass `endDate` when the user picked a later calendar day explicitly
 * (11 PM Tuesday → 11 PM Wednesday) — clock wrap alone cannot say that.
 */
export function wrappingSlices(
  date: string,
  startMin: number,
  endMin: number,
  endDate?: string,
): { date: string; startMin: number; endMin: number }[] {
  const from = clampMinute(startMin)
  const to = clampMinute(endMin)
  if (!endDate || endDate <= date) {
    if (to > from) return [{ date, startMin: from, endMin: to }]
    if (to === 0 || to === from) {
      if (MINUTES_PER_DAY <= from) return []
      return [{ date, startMin: from, endMin: MINUTES_PER_DAY }]
    }
    const slices: { date: string; startMin: number; endMin: number }[] = [
      { date, startMin: from, endMin: MINUTES_PER_DAY },
    ]
    if (to > 0) slices.push({ date: nextDateKey(date), startMin: 0, endMin: to })
    return slices
  }

  const slices: { date: string; startMin: number; endMin: number }[] = [
    { date, startMin: from, endMin: MINUTES_PER_DAY },
  ]
  let cursor = nextDateKey(date)
  let guard = 0
  while (cursor < endDate && guard++ < 31) {
    slices.push({ date: cursor, startMin: 0, endMin: MINUTES_PER_DAY })
    cursor = nextDateKey(cursor)
  }
  if (to > 0) slices.push({ date: endDate, startMin: 0, endMin: to })
  return slices.filter((slice) => slice.endMin > slice.startMin)
}

export function entriesForSpan(entries: TimeEntry[], spanId: string): TimeEntry[] {
  return entries
    .filter((e) => e.spanId === spanId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin)
}

export function spanMinutes(entries: TimeEntry[], spanId: string): number {
  return totalMinutes(entriesForSpan(entries, spanId))
}

/** Sorted, de-duplicated, or `undefined` when empty — so equality is a plain compare. */
export function normalizeIds(ids: string[] | undefined): string[] | undefined {
  if (!ids?.length) return undefined
  const unique = [...new Set(ids.filter(Boolean))].sort()
  return unique.length ? unique : undefined
}

export function sameIds(a: string[] | undefined, b: string[] | undefined): boolean {
  const na = normalizeIds(a) ?? []
  const nb = normalizeIds(b) ?? []
  return na.length === nb.length && na.every((id, i) => id === nb[i])
}

export const normalizeVariants = normalizeIds
export const sameVariants = sameIds

/**
 * Primary first, then unique secondaries. Older blocks omit `secondaryPenIds`,
 * which means "this pen only".
 */
export function assignedPenIds(entry: Pick<TimeEntry, "penId" | "secondaryPenIds">): string[] {
  const extra = (entry.secondaryPenIds ?? []).filter((id) => id && id !== entry.penId)
  return [entry.penId, ...[...new Set(extra)]]
}

/** Drop the primary and empties so equality is a plain `sameIds` compare. */
export function normalizeSecondaryPenIds(
  penId: string,
  ids: string[] | undefined,
): string[] | undefined {
  return normalizeIds((ids ?? []).filter((id) => id && id !== penId))
}

/**
 * What a surface should print for this block. A blank title is the pen name,
 * not an empty label.
 */
export function entryDisplayName(entry: Pick<TimeEntry, "title">, penName?: string | null): string {
  const custom = entry.title?.trim()
  if (custom) return custom
  const fallback = penName?.trim()
  return fallback || "Block"
}

function sameDetails(a: TimeEntry, b: TimeEntry): boolean {
  return DETAIL_KEYS.every((key) => (a[key] ?? undefined) === (b[key] ?? undefined))
}

export function hasDetails(entry: Partial<TimeEntry>): boolean {
  return DETAIL_KEYS.some((key) => {
    const value = entry[key]
    return value !== undefined && value !== "" && value !== null
  })
}

/** Entries for one scope-day, chronological. */
export function entriesForDay(entries: TimeEntry[], date: string, scopeId: string): TimeEntry[] {
  return entries.filter((e) => e.date === date && e.scopeId === scopeId).sort((a, b) => a.startMin - b.startMin)
}

/** Every scope's entries for a day, chronological — the Activity Log's source. */
export function entriesOnDate(entries: TimeEntry[], date: string): TimeEntry[] {
  return entries.filter((e) => e.date === date).sort((a, b) => a.startMin - b.startMin || a.scopeId.localeCompare(b.scopeId))
}

export function entryAt(
  entries: TimeEntry[],
  date: string,
  scopeId: string,
  minute: number,
): TimeEntry | undefined {
  return entries.find(
    (e) => e.date === date && e.scopeId === scopeId && e.startMin <= minute && e.endMin > minute,
  )
}

/**
 * A 1440-long lookup from minute → entry for one scope-day. Derived on demand
 * for rendering and rollups; never stored.
 */
export function minuteMap(entries: TimeEntry[], date: string, scopeId: string): (TimeEntry | null)[] {
  const map: (TimeEntry | null)[] = new Array(MINUTES_PER_DAY).fill(null)
  for (const entry of entriesForDay(entries, date, scopeId)) {
    if (isInstant(entry)) continue
    const from = clampMinute(entry.startMin)
    const to = clampMinute(entry.endMin)
    for (let m = from; m < to; m++) map[m] = entry
  }
  return map
}

/** Discrete events on a scope-day, clock order. Occupancy ignores these. */
export function instantsForDay(entries: TimeEntry[], date: string, scopeId: string): TimeEntry[] {
  return entriesForDay(entries, date, scopeId).filter(isInstant)
}

/** Merge touching blocks that are the same in every respect that matters. */
export function mergeAdjacent(entries: TimeEntry[], date: string, scopeId: string): TimeEntry[] {
  const day = entriesForDay(entries, date, scopeId)
  const others = entries.filter((e) => e.date !== date || e.scopeId !== scopeId)
  const merged: TimeEntry[] = []
  for (const entry of day) {
    const previous = merged[merged.length - 1]
    if (
      previous &&
      !previous.splitAfter &&
      !isInstant(previous) &&
      !isInstant(entry) &&
      previous.endMin === entry.startMin &&
      previous.penId === entry.penId &&
      sameIds(previous.secondaryPenIds, entry.secondaryPenIds) &&
      sameIds(previous.variantIds, entry.variantIds) &&
      sameIds(previous.tagIds, entry.tagIds) &&
      // Derived blocks keep their own identity: swallowing a hand-painted
      // neighbour would put minutes the user owns under the generator's control.
      previous.generatedBy?.kind === entry.generatedBy?.kind &&
      previous.generatedBy?.id === entry.generatedBy?.id &&
      previous.spanId === entry.spanId &&
      (previous.precision ?? "definite") === (entry.precision ?? "definite") &&
      sameDetails(previous, entry)
    ) {
      merged[merged.length - 1] = { ...previous, endMin: entry.endMin }
      continue
    }
    merged.push(entry)
  }
  return [...others, ...merged]
}

/**
 * Punch `[from, to)` out of a scope-day. Blocks that straddle the hole are
 * trimmed; one that fully contains it splits in two, keeping its details on both
 * halves — the notes describe the activity, not the minutes.
 */
export function clearRange(
  entries: TimeEntry[],
  date: string,
  scopeId: string,
  from: number,
  to: number,
  makeId: () => string = defaultId,
): TimeEntry[] {
  const lo = clampMinute(Math.min(from, to))
  const hi = clampMinute(Math.max(from, to))
  if (hi <= lo) return entries

  const next: TimeEntry[] = []
  for (const entry of entries) {
    if (entry.date !== date || entry.scopeId !== scopeId || entry.endMin <= lo || entry.startMin >= hi) {
      next.push(entry)
      continue
    }
    const keepsHead = entry.startMin < lo
    const keepsTail = entry.endMin > hi
    if (keepsHead) next.push({ ...entry, endMin: lo })
    if (keepsTail) next.push({ ...entry, id: keepsHead ? makeId() : entry.id, startMin: hi })
    // Neither side survives → the block was inside the hole and is dropped.
  }
  return next
}

export interface PaintRangeInput {
  date: string
  scopeId: string
  penId: string
  startMin: number
  endMin: number
  variantIds?: string[]
  tagIds?: string[]
  secondaryPenIds?: string[]
  title?: string
  notes?: string
  project?: string
  books?: string
  pages?: number
  spanId?: string
  precision?: TrackingPrecision
  kind?: TimeEntryKind
  startEventId?: string
  endEventId?: string
  /** Later calendar day for an explicit wrap. Not stored — slices carry `date`. */
  endDate?: string
}

function entryFromPaint(input: PaintRangeInput, lo: number, hi: number, id: string): TimeEntry {
  return {
    id,
    date: input.date,
    scopeId: input.scopeId,
    penId: input.penId,
    startMin: lo,
    endMin: hi,
    kind: input.kind === "instant" ? "instant" : undefined,
    variantIds: normalizeIds(input.variantIds),
    tagIds: normalizeIds(input.tagIds),
    secondaryPenIds: normalizeSecondaryPenIds(input.penId, input.secondaryPenIds),
    title: input.title,
    notes: input.notes,
    project: input.project,
    books: input.books,
    pages: input.pages,
    spanId: input.spanId,
    precision: input.precision,
    startEventId: input.startEventId,
    endEventId: input.endEventId,
  }
}

/** Lay a block over `[startMin, endMin)`, replacing whatever was there. */
export function paintRange(
  entries: TimeEntry[],
  input: PaintRangeInput,
  makeId: () => string = defaultId,
): TimeEntry[] {
  if (input.kind === "instant") {
    const at = clampMinute(input.startMin)
    const entry = entryFromPaint(input, at, at, makeId())
    return [...entries.filter((e) => e.id !== entry.id), entry]
  }

  const lo = clampMinute(Math.min(input.startMin, input.endMin))
  const hi = clampMinute(Math.max(input.startMin, input.endMin))
  if (hi <= lo) return entries

  const cleared = clearRange(entries, input.date, input.scopeId, lo, hi, makeId)
  return mergeAdjacent([...cleared, entryFromPaint(input, lo, hi, makeId())], input.date, input.scopeId)
}

/**
 * Paint `[startMin, endMin)`, wrapping past midnight onto the next date when
 * `endMin` is a later clock that is numerically earlier (23:00–02:00). Linked
 * slices share `spanId`.
 */
export function paintWrappingRange(
  entries: TimeEntry[],
  input: PaintRangeInput,
  makeId: () => string = defaultId,
): TimeEntry[] {
  if (input.kind === "instant") return paintRange(entries, input, makeId)
  const slices = wrappingSlices(input.date, input.startMin, input.endMin, input.endDate)
  if (!slices.length) return entries
  const spanId = slices.length > 1 ? input.spanId ?? `span-${makeId()}` : input.spanId
  let next = entries
  for (const slice of slices) {
    next = paintRange(next, { ...input, ...slice, spanId }, makeId)
  }
  return next
}

/** Erase a From/To that may continue onto the next morning. */
export function clearWrappingRange(
  entries: TimeEntry[],
  date: string,
  scopeId: string,
  startMin: number,
  endMin: number,
  makeId: () => string = defaultId,
): TimeEntry[] {
  let next = entries
  for (const slice of wrappingSlices(date, startMin, endMin)) {
    next = clearRange(next, slice.date, scopeId, slice.startMin, slice.endMin, makeId)
  }
  return next
}

/** Move an existing block's bounds, clearing whatever the new span covers. */
export function moveEntry(
  entries: TimeEntry[],
  id: string,
  startMin: number,
  endMin: number,
  makeId: () => string = defaultId,
): TimeEntry[] {
  const entry = entries.find((e) => e.id === id)
  if (!entry) return entries
  if (isInstant(entry)) {
    const at = clampMinute(startMin)
    return entries.map((e) => (e.id === id ? { ...e, startMin: at, endMin: at } : e))
  }
  const lo = clampMinute(Math.min(startMin, endMin))
  const hi = clampMinute(Math.max(startMin, endMin))
  if (hi <= lo) return entries
  const without = entries.filter((e) => e.id !== id)
  const cleared = clearRange(without, entry.date, entry.scopeId, lo, hi, makeId)
  return mergeAdjacent([...cleared, { ...entry, startMin: lo, endMin: hi }], entry.date, entry.scopeId)
}

/** Cut a block at `atMin`, so the halves can be labeled differently. */
export function splitEntry(entries: TimeEntry[], id: string, atMin: number, makeId: () => string = defaultId): TimeEntry[] {
  const entry = entries.find((e) => e.id === id)
  if (!entry || isInstant(entry)) return entries
  const at = clampMinute(atMin)
  if (at <= entry.startMin || at >= entry.endMin) return entries
  const left: TimeEntry = { ...entry, endMin: at, splitAfter: true }
  const right: TimeEntry = { ...entry, id: makeId(), startMin: at }
  return [...entries.filter((e) => e.id !== id), left, right]
}

/** Toggle one variant on a block — the "both were true" case. */
export function toggleEntryVariant(entry: TimeEntry, variantId: string): TimeEntry {
  const current = entry.variantIds ?? []
  const next = current.includes(variantId)
    ? current.filter((v) => v !== variantId)
    : [...current, variantId]
  return { ...entry, variantIds: normalizeIds(next) }
}

/** Toggle a block-only tag — "this zoo trip also counted as exercise". */
export function toggleEntryTag(entry: TimeEntry, tagId: string): TimeEntry {
  const current = entry.tagIds ?? []
  const next = current.includes(tagId) ? current.filter((t) => t !== tagId) : [...current, tagId]
  return { ...entry, tagIds: normalizeIds(next) }
}

/** Persist key for a note on an untracked gap. */
export function untrackedNoteKey(date: string, scopeId: string, startMin: number, endMin: number): string {
  return `${date}|${scopeId}|${startMin}|${endMin}`
}

/** Gaps in a scope-day, for the "untracked" rows in the Activity Log. */
export function untrackedRanges(
  entries: TimeEntry[],
  date: string,
  scopeId: string,
): { startMin: number; endMin: number }[] {
  const day = entriesForDay(entries, date, scopeId).filter((e) => !isInstant(e))
  const gaps: { startMin: number; endMin: number }[] = []
  let cursor = 0
  for (const entry of day) {
    if (entry.startMin > cursor) gaps.push({ startMin: cursor, endMin: entry.startMin })
    cursor = Math.max(cursor, entry.endMin)
  }
  if (cursor < MINUTES_PER_DAY) gaps.push({ startMin: cursor, endMin: MINUTES_PER_DAY })
  return gaps
}

/** Dates holding any entry, newest first. */
export function trackedDates(entries: TimeEntry[]): string[] {
  return [...new Set(entries.map((e) => e.date))].sort((a, b) => b.localeCompare(a))
}

// ---- formatting -------------------------------------------------------------

export function minutesToLabel(minute: number): string {
  const m = clampMinute(minute) % MINUTES_PER_DAY
  const h = Math.floor(m / 60)
  const mins = m % 60
  const period = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 || 12
  return `${h12}:${mins.toString().padStart(2, "0")} ${period}`
}

/** "13:30" → 810. */
export function timeStringToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return h * 60 + m
}

/** 810 → "13:30", for `<input type="time">`. */
export function minutesToTimeString(minute: number): string {
  const m = clampMinute(minute) % MINUTES_PER_DAY
  return `${Math.floor(m / 60).toString().padStart(2, "0")}:${(m % 60).toString().padStart(2, "0")}`
}

export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

let counter = 0
function defaultId(): string {
  counter += 1
  return `te-${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export { defaultId as makeEntryId }
