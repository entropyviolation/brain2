/**
 * lib/phone-sync/health.ts — Apple Health pages into sleep, workouts, and daily totals
 *
 * The iPhone app reads HealthKit (`ios/App/App/HealthPlugin.swift`) and hands
 * each page here. There is no recent-day cap: `healthPages` starts at the
 * earliest sample and walks forward until now. One page is applied, then the
 * next, so a long history is not one query and not one in-memory list.
 *
 * Sleep fills an empty morning on the sleep log. Workouts paint Exercise on
 * Activity. Steps, walking and running distance, flights, active energy, and
 * heart rate stay as one row per day. A morning the person already logged is
 * left alone. A re-read writes nothing new.
 */
import { formatLocalDateKey } from "@/lib/date-utils"
import type { SleepNight } from "@/lib/sleep-log"
import { phoneEntryId, phoneStamp } from "./ids"
import { mergePhoneEntries } from "./to-entries"
import type { TimeEntry } from "@/lib/time-entries"
import type { TrackPen, TrackScope } from "@/lib/time-tracking-store"

/** One page of HealthKit. Thirty days, not a short recent window. */
export const HEALTH_PAGE_MS = 30 * 24 * 60 * 60 * 1000
/** About 160 years of thirty-day pages. Past this, the run says it stopped. */
export const HEALTH_PAGE_CAP = 2000

/** The read set. Matches `HealthPlugin.swift`. Nothing is written back to Health. */
export const HEALTH_READ_TYPES = [
  "steps",
  "distanceWalkingRunning",
  "flightsClimbed",
  "activeEnergy",
  "heartRate",
  "sleep",
  "workouts",
] as const

const ACTIVITY_SCOPE_ID = "activity"
const EXERCISE_PEN_ID = "act-exercise"
const MINUTES_PER_DAY = 1440
const SLEEP_GAP_MS = 3 * 60 * 60 * 1000
const MAX_SLEEP_MINUTES = 20 * 60
const MAX_WORKOUT_MS = 36 * 60 * 60 * 1000
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

export interface HealthPageWindow {
  /** Inclusive. */
  startMs: number
  /** Exclusive. */
  endMs: number
}

export interface HealthTally {
  days: number
  nights: number
  workouts: number
}

export interface HealthDay {
  date: string
  steps?: number
  distanceM?: number
  flights?: number
  activeKcal?: number
  heartAvg?: number
  heartMin?: number
  heartMax?: number
}

export interface HealthSleepSample {
  id: string
  startMs: number
  endMs: number
  stage: "asleep" | "inBed" | "awake"
}

export interface HealthWorkout {
  id: string
  activity: string
  startMs: number
  endMs: number
}

export interface HealthNightDraft {
  date: string
  sleptMin: number
  wokeMin: number
}

export interface HealthNightLedger {
  sleptMin: number
  wokeMin: number
}

export interface HealthMergeState {
  days: Record<string, HealthDay>
  ledger: Record<string, HealthNightLedger>
  sleep: Record<string, SleepNight>
  entries: TimeEntry[]
  removedEntryIds: string[]
  scopes: TrackScope[]
}

export interface HealthPageWrite {
  read: HealthTally
  written: HealthTally
}

export type HealthImportStatus = "imported" | "empty" | "denied" | "unavailable" | "failed"

export interface HealthImportResult {
  status: HealthImportStatus
  written: HealthTally
  read: HealthTally
  message: string
  capped?: boolean
}

export interface HealthKitClient {
  requestAccess(): Promise<{ ok?: boolean; denied?: boolean; error?: string }>
  /** Epoch ms of the oldest sample, or null when Health has nothing. */
  earliest(): Promise<{ at: number | null; denied?: boolean; error?: string }>
  readPage(startMs: number, endMs: number): Promise<{ raw: unknown; denied?: boolean; error?: string }>
}

const ZERO: HealthTally = { days: 0, nights: 0, workouts: 0 }

export function addTally(a: HealthTally, b: HealthTally): HealthTally {
  return { days: a.days + b.days, nights: a.nights + b.nights, workouts: a.workouts + b.workouts }
}

function tallyEmpty(t: HealthTally): boolean {
  return t.days === 0 && t.nights === 0 && t.workouts === 0
}

/**
 * Local midnight of the earliest sample, so the first day is a whole day
 * and not the hours after that one sample.
 */
export function healthRangeStart(earliestMs: number): number {
  const d = new Date(earliestMs)
  if (Number.isNaN(d.getTime())) return earliestMs
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/**
 * Pages from `earliestMs` through `untilMs`, oldest first, with no gap and
 * no page longer than `pageMs`. An empty span is no pages. The cap is a
 * safety stop, not a "last N days" window.
 */
export function healthPages(earliestMs: number, untilMs: number, pageMs = HEALTH_PAGE_MS): HealthPageWindow[] {
  if (!Number.isFinite(earliestMs) || !Number.isFinite(untilMs) || !(pageMs > 0) || untilMs <= earliestMs) return []
  const pages: HealthPageWindow[] = []
  let start = earliestMs
  while (start < untilMs && pages.length < HEALTH_PAGE_CAP) {
    const end = Math.min(untilMs, start + pageMs)
    if (!(end > start)) break
    pages.push({ startMs: start, endMs: end })
    start = end
  }
  return pages
}

export function healthPageLabel(startMs: number): string {
  return new Date(startMs).toLocaleString(undefined, { month: "short", year: "numeric" })
}

function roundNonNeg(v: unknown): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return undefined
  return Math.round(v)
}

function numMs(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined
}

function parseDay(raw: unknown): HealthDay | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  if (typeof row.date !== "string" || !DATE_KEY.test(row.date)) return null
  const day: HealthDay = { date: row.date }
  const steps = roundNonNeg(row.steps)
  const distanceM = roundNonNeg(row.distanceM)
  const flights = roundNonNeg(row.flights)
  const activeKcal = roundNonNeg(row.activeKcal)
  const heartAvg = roundNonNeg(row.heartAvg)
  const heartMin = roundNonNeg(row.heartMin)
  const heartMax = roundNonNeg(row.heartMax)
  if (steps !== undefined) day.steps = steps
  if (distanceM !== undefined) day.distanceM = distanceM
  if (flights !== undefined) day.flights = flights
  if (activeKcal !== undefined) day.activeKcal = activeKcal
  if (heartAvg !== undefined) day.heartAvg = heartAvg
  if (heartMin !== undefined) day.heartMin = heartMin
  if (heartMax !== undefined) day.heartMax = heartMax
  if (
    day.steps === undefined &&
    day.distanceM === undefined &&
    day.flights === undefined &&
    day.activeKcal === undefined &&
    day.heartAvg === undefined &&
    day.heartMin === undefined &&
    day.heartMax === undefined
  ) {
    return null
  }
  return day
}

function parseStage(v: unknown): HealthSleepSample["stage"] | null {
  if (v === "asleep" || v === "inBed" || v === "awake") return v
  return null
}

function parseSleep(raw: unknown): HealthSleepSample | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const id = typeof row.id === "string" ? row.id.trim() : ""
  const startMs = numMs(row.startMs)
  const endMs = numMs(row.endMs)
  const stage = parseStage(row.stage)
  if (!id || startMs === undefined || endMs === undefined || !stage || endMs <= startMs) return null
  return { id, startMs, endMs, stage }
}

function parseWorkout(raw: unknown): HealthWorkout | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const id = typeof row.id === "string" ? row.id.trim() : ""
  const startMs = numMs(row.startMs)
  const endMs = numMs(row.endMs)
  const activity = typeof row.activity === "string" && row.activity.trim() ? row.activity.trim() : "Workout"
  if (!id || startMs === undefined || endMs === undefined || endMs <= startMs) return null
  if (endMs - startMs > MAX_WORKOUT_MS) return null
  return { id, activity, startMs, endMs }
}

/** The plugin's page. Bad rows are dropped. A non-object is an empty page. */
export function parseHealthPage(raw: unknown): { days: HealthDay[]; sleeps: HealthSleepSample[]; workouts: HealthWorkout[] } {
  if (!raw || typeof raw !== "object") return { days: [], sleeps: [], workouts: [] }
  const obj = raw as Record<string, unknown>
  const days = Array.isArray(obj.days) ? obj.days.map(parseDay).filter((d): d is HealthDay => !!d) : []
  const sleeps = Array.isArray(obj.sleeps) ? obj.sleeps.map(parseSleep).filter((s): s is HealthSleepSample => !!s) : []
  const workouts = Array.isArray(obj.workouts) ? obj.workouts.map(parseWorkout).filter((w): w is HealthWorkout => !!w) : []
  return { days, sleeps, workouts }
}

/** Morning key for a cluster whose last moment is `endMs`. An evening end belongs to the next morning. */
export function morningKeyForSleep(endMs: number): string {
  const end = new Date(endMs)
  if (end.getHours() >= 18) {
    return formatLocalDateKey(new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1))
  }
  return formatLocalDateKey(end)
}

function minutesFromMorning(dateKey: string, ms: number): number {
  const [y, m, d] = dateKey.split("-").map(Number)
  const midnight = new Date(y, (m ?? 1) - 1, d ?? 1).getTime()
  return Math.round((ms - midnight) / 60000)
}

/**
 * Asleep samples (or in-bed, when that is all Health stored) become one
 * morning each. Awake rows are ignored. Fragments within three hours are one night.
 */
export function nightsFromSleepSamples(samples: readonly HealthSleepSample[]): HealthNightDraft[] {
  const usable = samples.filter((s) => s.stage !== "awake" && s.endMs > s.startMs && s.id)
  const asleep = usable.filter((s) => s.stage === "asleep")
  const chosen = (asleep.length ? asleep : usable.filter((s) => s.stage === "inBed")).slice().sort((a, b) => a.startMs - b.startMs)
  const clusters: HealthSleepSample[][] = []
  for (const sample of chosen) {
    const last = clusters[clusters.length - 1]
    const prev = last?.[last.length - 1]
    if (!last || !prev || sample.startMs - prev.endMs > SLEEP_GAP_MS) clusters.push([sample])
    else last.push(sample)
  }
  const byDate = new Map<string, HealthNightDraft>()
  for (const cluster of clusters) {
    const startMs = Math.min(...cluster.map((s) => s.startMs))
    const endMs = Math.max(...cluster.map((s) => s.endMs))
    const date = morningKeyForSleep(endMs)
    const sleptMin = minutesFromMorning(date, startMs)
    const wokeMin = minutesFromMorning(date, endMs)
    if (wokeMin < 0 || wokeMin > MINUTES_PER_DAY) continue
    const span = wokeMin - sleptMin
    if (span < 1 || span > MAX_SLEEP_MINUTES) continue
    const draft = { date, sleptMin, wokeMin }
    const prev = byDate.get(date)
    if (!prev || span > prev.wokeMin - prev.sleptMin) byDate.set(date, draft)
  }
  return [...byDate.values()]
}

function nightsTouch(a: { sleptMin: number; wokeMin: number }, b: { sleptMin: number; wokeMin: number }): boolean {
  const gap = 3 * 60
  return a.sleptMin <= b.wokeMin + gap && b.sleptMin <= a.wokeMin + gap
}

function localMinute(ms: number): { date: string; min: number; dayStart: number } {
  const d = new Date(ms)
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return { date: formatLocalDateKey(d), min: d.getHours() * 60 + d.getMinutes(), dayStart }
}

function wallMinuteUp(ms: number): number {
  const d = new Date(ms)
  return d.getHours() * 60 + d.getMinutes() + (d.getSeconds() || d.getMilliseconds() ? 1 : 0)
}

/** Activity intervals for one workout, sliced at local midnight. */
export function workoutEntries(workout: HealthWorkout, scopeId: string, penId: string): TimeEntry[] {
  const stamp = phoneStamp("health", workout.id)
  const spanId = phoneEntryId("health", workout.id)
  const out: TimeEntry[] = []
  let cursor = workout.startMs
  let part = 0
  while (cursor < workout.endMs && part < 3) {
    const { date, min, dayStart } = localMinute(cursor)
    const day = new Date(dayStart)
    const nextMidnight = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime()
    const sliceEnd = Math.min(workout.endMs, nextMidnight)
    let endMin = sliceEnd === nextMidnight ? MINUTES_PER_DAY : wallMinuteUp(sliceEnd)
    if (endMin <= min) endMin = Math.min(MINUTES_PER_DAY, min + 1)
    out.push({
      id: phoneEntryId("health", workout.id, part),
      date,
      scopeId,
      penId,
      startMin: min,
      endMin: Math.min(endMin, MINUTES_PER_DAY),
      title: workout.activity,
      spanId,
      generatedBy: stamp,
      logSource: "phone-sync",
    })
    cursor = sliceEnd
    part++
  }
  return out
}

function findActivity(scopes: readonly TrackScope[]): TrackScope | undefined {
  return scopes.find((s) => s.id === ACTIVITY_SCOPE_ID || s.name.trim().toLowerCase() === "activity")
}

function withExercisePen(scopes: TrackScope[]): { scopes: TrackScope[]; scopeId: string; penId: string } | null {
  const scope = findActivity(scopes)
  if (!scope) return null
  if (scope.pens.some((p) => p.id === EXERCISE_PEN_ID)) return { scopes, scopeId: scope.id, penId: EXERCISE_PEN_ID }
  const pen: TrackPen = { id: EXERCISE_PEN_ID, name: "Exercise", color: "#f59e0b", tags: ["tag-exercise"] }
  const next = scopes.map((s) => (s.id === scope.id ? { ...s, pens: [...s.pens, pen] } : s))
  return { scopes: next, scopeId: scope.id, penId: EXERCISE_PEN_ID }
}

function sameDay(a: HealthDay | undefined, b: HealthDay): boolean {
  if (!a) return false
  return (
    a.steps === b.steps &&
    a.distanceM === b.distanceM &&
    a.flights === b.flights &&
    a.activeKcal === b.activeKcal &&
    a.heartAvg === b.heartAvg &&
    a.heartMin === b.heartMin &&
    a.heartMax === b.heartMax
  )
}

function mergeDay(prev: HealthDay | undefined, next: HealthDay): HealthDay {
  if (!prev) return next
  return {
    date: next.date,
    steps: next.steps ?? prev.steps,
    distanceM: next.distanceM ?? prev.distanceM,
    flights: next.flights ?? prev.flights,
    activeKcal: next.activeKcal ?? prev.activeKcal,
    heartAvg: next.heartAvg ?? prev.heartAvg,
    heartMin: next.heartMin ?? prev.heartMin,
    heartMax: next.heartMax ?? prev.heartMax,
  }
}

function hasClock(night: SleepNight | undefined): boolean {
  return !!night && (night.allNighter === true || typeof night.sleptMin === "number" || typeof night.wokeMin === "number")
}

/**
 * Fold one parsed page into the stores' data. Pure. A logged morning is not
 * replaced. A morning this import already wrote can widen when a later page
 * holds the other half of the same night.
 */
export function mergeHealthPage(state: HealthMergeState, raw: unknown): { state: HealthMergeState; write: HealthPageWrite; nightDates: string[] } {
  const page = parseHealthPage(raw)
  const read: HealthTally = { days: page.days.length, nights: 0, workouts: page.workouts.length }
  const written: HealthTally = { days: 0, nights: 0, workouts: 0 }
  let days = state.days
  for (const day of page.days) {
    const merged = mergeDay(days[day.date], day)
    if (sameDay(days[day.date], merged)) continue
    if (days === state.days) days = { ...days }
    days[day.date] = merged
    written.days++
  }

  const drafts = nightsFromSleepSamples(page.sleeps)
  read.nights = drafts.length
  let sleep = state.sleep
  let ledger = state.ledger
  const nightDates: string[] = []
  for (const draft of drafts) {
    const current = sleep[draft.date]
    const led = ledger[draft.date]
    const owned = !!led && current?.sleptMin === led.sleptMin && current?.wokeMin === led.wokeMin
    if (hasClock(current) && !owned) continue
    let next = draft
    if (led && nightsTouch(led, draft)) {
      next = { date: draft.date, sleptMin: Math.min(led.sleptMin, draft.sleptMin), wokeMin: Math.max(led.wokeMin, draft.wokeMin) }
    } else if (led && !nightsTouch(led, draft)) {
      continue
    }
    if (current?.sleptMin === next.sleptMin && current?.wokeMin === next.wokeMin && led?.sleptMin === next.sleptMin && led?.wokeMin === next.wokeMin) {
      continue
    }
    if (sleep === state.sleep) sleep = { ...sleep }
    if (ledger === state.ledger) ledger = { ...ledger }
    const prev = sleep[draft.date]
    sleep[draft.date] = {
      ...prev,
      date: draft.date,
      sleptMin: next.sleptMin,
      wokeMin: next.wokeMin,
      sleptPrecision: prev?.sleptPrecision ?? "definite",
      wokePrecision: prev?.wokePrecision ?? "definite",
      updatedAt: prev?.updatedAt,
    }
    ledger[draft.date] = { sleptMin: next.sleptMin, wokeMin: next.wokeMin }
    written.nights++
    nightDates.push(draft.date)
  }

  let scopes = state.scopes
  let entries = state.entries
  if (page.workouts.length) {
    const placed = withExercisePen(scopes)
    if (placed) {
      scopes = placed.scopes
      const incoming = page.workouts.flatMap((workout) => workoutEntries(workout, placed.scopeId, placed.penId))
      const merged = mergePhoneEntries(entries, state.removedEntryIds, incoming)
      entries = merged.entries
      const have = new Set(state.entries.map((e) => e.id))
      for (const id of state.removedEntryIds) have.add(id)
      written.workouts = page.workouts.filter((w) => {
        const span = phoneEntryId("health", w.id)
        return merged.entries.some((e) => e.spanId === span && !have.has(e.id))
      }).length
    }
  }

  return {
    state: { ...state, days, ledger, sleep, entries, scopes },
    write: { read, written },
    nightDates,
  }
}

const DENIED_HINT = "Turn it on in the Health app, under Sharing, then Apps, then Brain2."

/** Words for the card. */
export function healthResultMessage(result: {
  status: HealthImportStatus
  written: HealthTally
  read: HealthTally
  error?: string
  capped?: boolean
}): string {
  const { status, written, read, error, capped } = result
  if (status === "unavailable") return "Health import runs in the iPhone app."
  if (status === "denied") return `Health access is off. ${DENIED_HINT}`
  const imported = `Imported ${written.days} days, ${written.nights} nights, and ${written.workouts} workouts.`
  if (status === "failed") {
    const why = error?.trim() || "Health import stopped."
    return tallyEmpty(written) ? why : `${why} ${imported}`
  }
  if (tallyEmpty(read) && tallyEmpty(written)) {
    return `Apple Health returned nothing for steps, sleep, or workouts. If you tapped Don't Allow, ${DENIED_HINT.charAt(0).toLowerCase()}${DENIED_HINT.slice(1)}`
  }
  if (tallyEmpty(written)) {
    const already = `Nothing new. This history is already imported (${read.days} days, ${read.nights} nights, ${read.workouts} workouts in this run).`
    return capped ? `${already} Stopped early: the history is longer than one import reads.` : already
  }
  return capped ? `${imported} Stopped early: the history is longer than one import reads.` : imported
}

/**
 * Read every page from the oldest sample through `untilMs`. The client fetches
 * one page at a time. `apply` lands that page before the next fetch.
 */
export async function runHealthImport(
  client: HealthKitClient,
  opts: {
    untilMs: number
    pageMs?: number
    apply: (raw: unknown) => HealthPageWrite
    onProgress?: (progress: { index: number; total: number; startMs: number }) => void
  },
): Promise<HealthImportResult> {
  const fail = (error: string, written: HealthTally = ZERO, read: HealthTally = ZERO): HealthImportResult => ({
    status: "failed",
    written,
    read,
    message: healthResultMessage({ status: "failed", written, read, error }),
  })
  let access: { ok?: boolean; denied?: boolean; error?: string }
  try {
    access = await client.requestAccess()
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err))
  }
  if (access.denied) {
    return { status: "denied", written: ZERO, read: ZERO, message: healthResultMessage({ status: "denied", written: ZERO, read: ZERO }) }
  }
  if (access.ok === false) return fail(access.error || "Health access could not be requested.")

  let earliest: { at: number | null; denied?: boolean; error?: string }
  try {
    earliest = await client.earliest()
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err))
  }
  if (earliest.denied) {
    return { status: "denied", written: ZERO, read: ZERO, message: healthResultMessage({ status: "denied", written: ZERO, read: ZERO }) }
  }
  if (earliest.error) return fail(earliest.error)
  if (earliest.at === null || !Number.isFinite(earliest.at)) {
    return {
      status: "empty",
      written: ZERO,
      read: ZERO,
      message: healthResultMessage({ status: "imported", written: ZERO, read: ZERO }),
    }
  }
  const pages = healthPages(healthRangeStart(earliest.at), opts.untilMs, opts.pageMs ?? HEALTH_PAGE_MS)
  const capped = pages.length >= HEALTH_PAGE_CAP && pages.length > 0 && pages[pages.length - 1].endMs < opts.untilMs
  if (pages.length === 0) {
    return {
      status: "empty",
      written: ZERO,
      read: ZERO,
      message: healthResultMessage({ status: "imported", written: ZERO, read: ZERO }),
    }
  }
  let written = ZERO
  let read = ZERO
  for (let index = 0; index < pages.length; index++) {
    const page = pages[index]
    opts.onProgress?.({ index, total: pages.length, startMs: page.startMs })
    let fetched: { raw: unknown; denied?: boolean; error?: string }
    try {
      fetched = await client.readPage(page.startMs, page.endMs)
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err), written, read)
    }
    if (fetched.denied) {
      const message = healthResultMessage({ status: "denied", written, read })
      return {
        status: "denied",
        written,
        read,
        message: tallyEmpty(written) ? message : `${message} ${healthResultMessage({ status: "imported", written, read })}`,
      }
    }
    if (fetched.error) return fail(fetched.error, written, read)
    try {
      const applied = opts.apply(fetched.raw)
      written = addTally(written, applied.written)
      read = addTally(read, applied.read)
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err), written, read)
    }
  }
  const status: HealthImportStatus = tallyEmpty(read) && tallyEmpty(written) ? "empty" : "imported"
  return {
    status,
    written,
    read,
    capped,
    message: healthResultMessage({ status: "imported", written, read, capped }),
  }
}
