/**
 * lib/tracking-presence.ts — Current vs last-known Tracking state
 *
 * Home's Tracking now tile: Activity, Location, Mood, Company. A lane is
 * **current** when a block covers now (including Telegram `currently` painted
 * through end of day), or a live Working-on-now / pen-color session owns that
 * scope. Otherwise the most recent interval that already started is **last**.
 * Instants do not count.
 *
 * Home Update stamps the present only: the open stretch from the previous log
 * up to now (or just the current minute when nothing precedes). A minute span
 * paints this minute alone and keeps a seam when the pen already touches it.
 * Future minutes are erased — never painted through midnight.
 */

import { formatLocalDateKey } from "@/lib/date-utils"
import { minutesPastMidnight, MINUTES_PER_DAY } from "@/lib/ingest/times"
import { entryClockCertainty, isInstant, isSpeculative, minutesToLabel, type TimeEntry } from "@/lib/time-entries"
import { PEN_PALETTE, useTimeTrackingStore, type TrackPen, type TrackScope } from "@/lib/time-tracking-store"

export const PRESENCE_SCOPE_IDS = ["activity", "location", "mood", "company"] as const

export type PresenceScopeId = (typeof PRESENCE_SCOPE_IDS)[number]

export const PRESENCE_SCOPE_LABEL: Record<PresenceScopeId, string> = {
  activity: "Activity",
  location: "Location",
  mood: "Mood",
  company: "Company",
}

export type PresenceKind = "current" | "last" | "empty"

export type PresenceLane = {
  scopeId: PresenceScopeId
  kind: PresenceKind
  name: string
}

export type LivePresenceHint = {
  scopeId: string
  name: string
}

export type PresenceSnapshot = {
  caption: "Now" | "Last"
  activity: PresenceLane
  lanes: PresenceLane[]
  footer: string
}

function penName(scopes: TrackScope[], penId: string, title?: string): string {
  for (const scope of scopes) {
    const pen = scope.pens.find((item) => item.id === penId)
    if (pen) return (title && title.trim()) || pen.name
  }
  return (title && title.trim()) || "—"
}

function covers(entry: TimeEntry, date: string, min: number): boolean {
  if (isInstant(entry) || entry.date !== date) return false
  return entry.startMin <= min && min < entry.endMin
}

function startedBy(entry: TimeEntry, date: string, min: number): boolean {
  if (isInstant(entry)) return false
  if (entry.date < date) return true
  if (entry.date > date) return false
  return entry.startMin <= min
}

function later(a: TimeEntry, b: TimeEntry): TimeEntry {
  if (a.date !== b.date) return a.date > b.date ? a : b
  if (a.endMin !== b.endMin) return a.endMin > b.endMin ? a : b
  return a.startMin >= b.startMin ? a : b
}

/** The latest minute a lane's fact still names. */
export type LoggedMoment = {
  date: string
  minute: number
}

export type ScopeStatusLane = {
  scopeId: string
  scopeName: string
  kind: PresenceKind
  name: string
  /** The block this lane names was estimated or unknown — not an observed clock. */
  estimated: boolean
  /** When this value was last true. Empty lanes have none. */
  loggedAt: LoggedMoment | null
}

const MOMENT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const

/** Readable clock, with the date when the fact is not from today. */
export function formatLoggedMoment(moment: LoggedMoment, today: string): string {
  const minute = Math.max(0, Math.min(MINUTES_PER_DAY - 1, moment.minute))
  const clock = minutesToLabel(minute)
  if (moment.date === today) return clock
  const [year, month, day] = moment.date.split("-").map(Number)
  const monthName = MOMENT_MONTHS[(month || 1) - 1] ?? ""
  const todayYear = Number(today.slice(0, 4))
  const date = year !== todayYear ? `${monthName} ${day}, ${year}` : `${monthName} ${day}`
  return `${date}, ${clock}`
}

function lastOccupiedMinute(entry: TimeEntry): number {
  const endInside = entry.endMin > entry.startMin ? entry.endMin - 1 : entry.startMin
  return Math.max(0, Math.min(MINUTES_PER_DAY - 1, endInside))
}

/** Most recent moment this block still names, never a future minute. */
function loggedMoment(entry: TimeEntry, nowDate: string, nowMin: number): LoggedMoment {
  const occupied = lastOccupiedMinute(entry)
  const coversNow = entry.date === nowDate && entry.startMin <= nowMin && nowMin < entry.endMin
  if (coversNow) return { date: entry.date, minute: Math.max(0, Math.min(occupied, nowMin)) }
  return { date: entry.date, minute: occupied }
}

function blockIsEstimated(entry: TimeEntry): boolean {
  return isSpeculative(entry) || entryClockCertainty(entry) === "estimated"
}

function classifyScope(
  scopeId: string,
  input: {
    date: string
    min: number
    entries: TimeEntry[]
    scopes: TrackScope[]
    live?: LivePresenceHint[]
  },
): { kind: PresenceKind; name: string; estimated: boolean; loggedAt: LoggedMoment | null } {
  const live = input.live?.find((item) => item.scopeId === scopeId)
  const mine = input.entries.filter((entry) => entry.scopeId === scopeId)
  const covering = mine.find((entry) => covers(entry, input.date, input.min))
  if (covering) {
    return {
      kind: "current",
      name: laneLabel(covering, input.scopes),
      estimated: blockIsEstimated(covering),
      loggedAt: loggedMoment(covering, input.date, input.min),
    }
  }
  if (live?.name) {
    return {
      kind: "current",
      name: live.name,
      estimated: false,
      loggedAt: { date: input.date, minute: Math.max(0, Math.min(MINUTES_PER_DAY - 1, input.min)) },
    }
  }

  let last: TimeEntry | undefined
  for (const entry of mine) {
    if (!startedBy(entry, input.date, input.min)) continue
    last = last ? later(last, entry) : entry
  }
  if (!last) return { kind: "empty", name: "—", estimated: false, loggedAt: null }
  return {
    kind: "last",
    name: laneLabel(last, input.scopes),
    estimated: blockIsEstimated(last),
    loggedAt: loggedMoment(last, input.date, input.min),
  }
}

export function presenceLaneForScope(
  scopeId: PresenceScopeId,
  input: {
    date: string
    min: number
    entries: TimeEntry[]
    scopes: TrackScope[]
    live?: LivePresenceHint[]
  },
): PresenceLane {
  const status = classifyScope(scopeId, input)
  return { scopeId, kind: status.kind, name: status.name }
}

/**
 * Latest status of every tracking view, and when that fact was last true.
 * Current moment shows Activity, Location, Mood, and Company from this list.
 * Same entries the Home tile reads.
 */
export function trackingScopeStatuses(input: {
  date: string
  min: number
  entries: TimeEntry[]
  scopes: TrackScope[]
  live?: LivePresenceHint[]
}): ScopeStatusLane[] {
  return input.scopes.map((scope) => {
    const status = classifyScope(scope.id, input)
    return { scopeId: scope.id, scopeName: scope.name, ...status }
  })
}

/** Mood prefers the word written on the stretch. The pen name is the fallback. */
function laneLabel(entry: TimeEntry, scopes: TrackScope[]): string {
  if (entry.scopeId === "mood") {
    const word = entry.moodReading?.word?.trim()
    if (word) return word
  }
  return penName(scopes, entry.penId, entry.title)
}

export function trackingPresenceSnapshot(input: {
  date: string
  min: number
  entries: TimeEntry[]
  scopes: TrackScope[]
  live?: LivePresenceHint[]
}): PresenceSnapshot {
  const lanes = PRESENCE_SCOPE_IDS.map((scopeId) => presenceLaneForScope(scopeId, { ...input, scopeId }))
  const activity = lanes.find((lane) => lane.scopeId === "activity") ?? {
    scopeId: "activity" as const,
    kind: "empty" as const,
    name: "—",
  }
  const anyCurrent = lanes.some((lane) => lane.kind === "current")
  const rest = lanes.filter((lane) => lane.scopeId !== "activity")
  const named = rest
    .map((lane) => (lane.kind === "empty" ? null : lane.name))
    .filter((name): name is string => Boolean(name))
  const footer =
    named.length > 0
      ? named.join(" · ")
      : activity.kind === "current"
        ? "now"
        : activity.kind === "last"
          ? "last known"
          : "No tracking yet"
  return {
    caption: anyCurrent ? "Now" : "Last",
    activity,
    lanes,
    footer,
  }
}

export function livePresenceHints(input: {
  workSession?: { title: string; scopeId?: string } | null
  penSession?: { title: string; scopeId: string } | null
}): LivePresenceHint[] {
  const hints: LivePresenceHint[] = []
  if (input.workSession?.title) {
    hints.push({ scopeId: input.workSession.scopeId || "activity", name: input.workSession.title })
  }
  if (input.penSession?.title) {
    hints.push({ scopeId: input.penSession.scopeId, name: input.penSession.title })
  }
  return hints
}

export function ensureScopePen(scopeId: string, name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return null
  const store = useTimeTrackingStore.getState()
  const scope = store.scopes.find((item) => item.id === scopeId)
  if (!scope) return null
  const existing = scope.pens.find((pen) => pen.name.trim().toLowerCase() === trimmed.toLowerCase())
  if (existing) return existing.id
  return store.addPen(scope.id, {
    name: trimmed,
    color: PEN_PALETTE[scope.pens.length % PEN_PALETTE.length],
  })
}

/**
 * Start of the paint for a Home presence stamp.
 * - Covering block → current minute only (close the past; do not rewrite history).
 * - Gap after a prior log → fill that open stretch up to now.
 * - Nothing earlier today → current minute only.
 */
export function presencePaintStart(
  date: string,
  scopeId: string,
  nowMin: number,
  entries: TimeEntry[],
): number {
  const slot = Math.min(Math.max(0, Math.floor(nowMin)), MINUTES_PER_DAY - 1)
  const mine = entries.filter(
    (entry) => entry.date === date && entry.scopeId === scopeId && !isInstant(entry),
  )
  if (mine.some((entry) => covers(entry, date, slot))) return slot

  let priorEnd = -1
  for (const entry of mine) {
    if (entry.endMin <= slot && entry.endMin > priorEnd) priorEnd = entry.endMin
  }
  if (priorEnd >= 0) return priorEnd
  return slot
}

/** Exclusive end covering the current minute — never past now into the future. */
export function presencePaintEnd(nowMin: number): number {
  const slot = Math.min(Math.max(0, Math.floor(nowMin)), MINUTES_PER_DAY - 1)
  return Math.min(slot + 1, MINUTES_PER_DAY)
}

/**
 * How a now-stamp meets the blocks already on the view.
 * `open` fills from the previous log through now (one block when the pen matches).
 * `minute` paints only this minute, and keeps a seam so a matching pen stays a second block.
 */
export type ScopeNowSpan = "open" | "minute"

/**
 * Keep a same-pen neighbor from swallowing a one-minute stamp.
 * A covering block is split at this minute. A block that ends on this minute
 * gets `splitAfter`, which `mergeAdjacent` treats as a seam.
 */
function keepMinuteSeam(date: string, scopeId: string, penId: string, slot: number) {
  const store = useTimeTrackingStore.getState()
  const covering = store.entries.find(
    (entry) =>
      entry.date === date &&
      entry.scopeId === scopeId &&
      entry.penId === penId &&
      !isInstant(entry) &&
      entry.startMin < slot &&
      slot < entry.endMin,
  )
  if (covering) {
    store.splitEntryAt(covering.id, slot)
    return
  }
  const touching = useTimeTrackingStore.getState().entries.find(
    (entry) =>
      entry.date === date &&
      entry.scopeId === scopeId &&
      entry.penId === penId &&
      !isInstant(entry) &&
      entry.endMin === slot &&
      !entry.splitAfter,
  )
  if (touching) useTimeTrackingStore.getState().updateEntry(touching.id, { splitAfter: true })
}

/** Stamp one view up to now. A new name becomes a pen on that view. */
export function applyScopeNowUpdate(
  scopeId: string,
  name: string,
  now = new Date(),
  span: ScopeNowSpan = "open",
): boolean {
  const trimmed = name.trim()
  if (!trimmed) return false
  const date = formatLocalDateKey(now)
  const min = minutesPastMidnight(now)
  const endMin = presencePaintEnd(min)
  const store = useTimeTrackingStore.getState()
  const scope = store.scopes.find((item) => item.id === scopeId)
  if (!scope) return false
  const named =
    scope.pens.find((pen) => pen.id === trimmed) ??
    scope.pens.find((pen) => pen.name.trim().toLowerCase() === trimmed.toLowerCase())
  const penId = named ? named.id : ensureScopePen(scopeId, trimmed)
  if (!penId) return false

  const slot = Math.min(Math.max(0, Math.floor(min)), MINUTES_PER_DAY - 1)
  const startMin = span === "minute" ? slot : presencePaintStart(date, scopeId, min, store.entries)
  const neighbor = named
    ? store.entries.find(
        (entry) =>
          entry.date === date &&
          entry.scopeId === scopeId &&
          entry.penId === penId &&
          !isInstant(entry) &&
          (entry.endMin === startMin || (entry.startMin <= startMin && startMin < entry.endMin)),
      )
    : undefined
  const continueEstimate = neighbor ? blockIsEstimated(neighbor) : false
  const extras = named
    ? neighbor?.title || neighbor?.moodReading || continueEstimate
      ? {
          ...(neighbor?.title ? { title: neighbor.title } : {}),
          ...(neighbor?.moodReading ? { moodReading: neighbor.moodReading } : {}),
          ...(continueEstimate ? { clockCertainty: "estimated" as const } : {}),
        }
      : undefined
    : { title: trimmed }
  if (endMin < MINUTES_PER_DAY) {
    store.paintMinutes(date, scopeId, endMin, MINUTES_PER_DAY, null)
  }
  if (span === "minute") keepMinuteSeam(date, scopeId, penId, slot)
  store.paintMinutes(
    date,
    scopeId,
    startMin,
    endMin,
    penId,
    undefined,
    undefined,
    continueEstimate ? "estimated" : undefined,
    extras,
  )
  return true
}

export function applyTrackingPresenceUpdate(
  patches: Partial<Record<PresenceScopeId, string>>,
  now = new Date(),
): void {
  for (const scopeId of PRESENCE_SCOPE_IDS) {
    const raw = patches[scopeId]?.trim()
    if (!raw) continue
    applyScopeNowUpdate(scopeId, raw, now)
  }
}

export type ScopeSequenceStep = {
  name: string
  startMin: number
  endMin: number
  /** When true the clocks are approximate. Paint stores `precision` and `clockCertainty`. */
  estimated: boolean
}

/** Paint an ordered same-day sequence on one view. Estimated steps are not stored as exact. */
export function paintScopeSequence(scopeId: string, date: string, steps: ScopeSequenceStep[]): number {
  const store = useTimeTrackingStore.getState()
  if (!store.scopes.some((scope) => scope.id === scopeId)) return 0
  let painted = 0
  for (const step of steps) {
    const name = step.name.trim()
    if (!name || step.endMin <= step.startMin) continue
    const penId = ensureScopePen(scopeId, name)
    if (!penId) continue
    store.paintMinutes(
      date,
      scopeId,
      step.startMin,
      step.endMin,
      penId,
      undefined,
      undefined,
      step.estimated ? "estimated" : undefined,
      {
        title: name,
        ...(step.estimated ? { clockCertainty: "estimated" as const } : {}),
      },
    )
    painted += 1
  }
  return painted
}

export function pensForPresenceScope(scopes: TrackScope[], scopeId: PresenceScopeId): TrackPen[] {
  return scopes.find((scope) => scope.id === scopeId)?.pens ?? []
}

export type RecentScopeStep = {
  id: string
  name: string
  date: string
  startMin: number
  /** Last minute this block still names. */
  endMin: number
  estimated: boolean
}

/** Latest blocks on one view, oldest of that window first. Instants stay out. */
export function recentScopeSequence(
  scopeId: string,
  entries: TimeEntry[],
  scopes: TrackScope[],
  limit = 10,
): RecentScopeStep[] {
  const mine = entries
    .filter((entry) => entry.scopeId === scopeId && !isInstant(entry))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.startMin - b.startMin || a.endMin - b.endMin))
  return mine.slice(-limit).map((entry) => ({
    id: entry.id,
    name: laneLabel(entry, scopes),
    date: entry.date,
    startMin: entry.startMin,
    endMin: lastOccupiedMinute(entry),
    estimated: blockIsEstimated(entry),
  }))
}
