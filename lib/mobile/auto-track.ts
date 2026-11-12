/**
 * lib/mobile/auto-track.ts — Walks, workouts, sleep, and places, with no button
 *
 * The iPhone app runs this when it opens, when it comes back to the front,
 * and every few minutes while it is open. Nothing here runs in the
 * background. It does not need to: Apple Health keeps the steps and the
 * workouts, and the location plugin keeps its journal, so the next open
 * catches up on everything since the last one.
 *
 * One run, in this order:
 *  1. Location. With no upload relay set, the journal's new events are painted
 *     on Location here (`applyLocationBatch`). With a relay, the Mac hub lands
 *     them and this step is skipped, so one place never gets two pens.
 *  2. Health. A window from two days before the last run through now: daily
 *     totals, sleep, workouts, and walks found in the steps. Two days back so
 *     watch data that reached the phone late, and Location that landed late,
 *     still count. A re-read writes nothing new.
 *
 * The switches and the cursors live on this phone (`brain2-auto-track` in
 * localStorage). They are not part of the vault.
 */
import { applyLocationBatch, parseLocationBatch } from "@/lib/phone-sync/location"
import { DEFAULT_WALK_MIN_MINUTES, WALK_MIN_STEPS } from "@/lib/phone-sync/walks"
import type { HealthMergeOptions, HealthTally } from "@/lib/phone-sync/health"
import { isHealthPluginAvailable, syncHealthSince } from "./health-bridge"
import { getLocationStatus, isLocationPluginAvailable, readLocationJournal } from "./location-bridge"

const KEY = "brain2-auto-track"
const DAY_MS = 24 * 60 * 60 * 1000
/** First run reads this far back. Older history is the Health card's Import all history. */
export const AUTO_TRACK_FIRST_DAYS = 7
/** Each run re-reads this far before the last one. */
export const AUTO_TRACK_OVERLAP_DAYS = 2
/** Runs closer together than this are skipped unless forced. */
export const AUTO_TRACK_MIN_GAP_MS = 4 * 60_000

export interface AutoTrackPrefs {
  /** The whole automatic sync. */
  on: boolean
  /** Find walks in the steps. */
  walks: boolean
  /** Shortest walk kept, minutes. */
  walkMinMinutes: number
  /** Title walks and workouts with the place. */
  places: boolean
}

export interface AutoTrackLastRun {
  at: number
  written: HealthTally
  /** Location rows painted from the journal. */
  placed: number
  /** Why the run stopped short, in words for the card. */
  note?: string
}

export interface AutoTrackState extends AutoTrackPrefs {
  /** When Health was last read through (ms). */
  healthAt?: number
  /** Last location journal row landed. */
  locationSeq?: number
  last?: AutoTrackLastRun
}

export const DEFAULT_AUTO_TRACK: AutoTrackState = {
  on: true,
  walks: true,
  walkMinMinutes: DEFAULT_WALK_MIN_MINUTES,
  places: true,
}

const listeners = new Set<() => void>()
let cached: AutoTrackState | null = null

function parse(raw: string | null): AutoTrackState {
  if (!raw) return DEFAULT_AUTO_TRACK
  try {
    const row = JSON.parse(raw) as Partial<AutoTrackState>
    if (!row || typeof row !== "object") return DEFAULT_AUTO_TRACK
    const minutes = WALK_MIN_STEPS.find((step) => step === row.walkMinMinutes) ?? DEFAULT_WALK_MIN_MINUTES
    return {
      on: row.on !== false,
      walks: row.walks !== false,
      walkMinMinutes: minutes,
      places: row.places !== false,
      healthAt: typeof row.healthAt === "number" && Number.isFinite(row.healthAt) ? row.healthAt : undefined,
      locationSeq: typeof row.locationSeq === "number" && Number.isFinite(row.locationSeq) ? row.locationSeq : undefined,
      last: row.last && typeof row.last === "object" && typeof row.last.at === "number" ? row.last : undefined,
    }
  } catch {
    return DEFAULT_AUTO_TRACK
  }
}

export function getAutoTrack(): AutoTrackState {
  if (cached) return cached
  if (typeof window === "undefined") return DEFAULT_AUTO_TRACK
  try {
    cached = parse(window.localStorage.getItem(KEY))
  } catch {
    cached = DEFAULT_AUTO_TRACK
  }
  return cached
}

export function getAutoTrackServerSnapshot(): AutoTrackState {
  return DEFAULT_AUTO_TRACK
}

export function subscribeAutoTrack(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setAutoTrack(patch: Partial<AutoTrackState>): AutoTrackState {
  const next = { ...getAutoTrack(), ...patch }
  cached = next
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Private mode or a full box: the switches hold for this session.
  }
  for (const listener of listeners) listener()
  return next
}

export function resetAutoTrackForTests(): void {
  cached = null
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // no storage in this test
  }
}

/** True in the iPhone app, where Health or the location plugin can be read. */
export function autoTrackAvailable(): boolean {
  return isHealthPluginAvailable() || isLocationPluginAvailable()
}

/** Local midnight, `AUTO_TRACK_OVERLAP_DAYS` before the last run (or a week back the first time). Pure. */
export function autoTrackSince(healthAt: number | undefined, now: number): number {
  const from =
    healthAt === undefined || healthAt > now
      ? now - AUTO_TRACK_FIRST_DAYS * DAY_MS
      : healthAt - AUTO_TRACK_OVERLAP_DAYS * DAY_MS
  const d = new Date(from)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export function autoTrackMergeOptions(prefs: AutoTrackPrefs, now = Date.now()): HealthMergeOptions {
  return {
    walks: prefs.walks ? { minMinutes: prefs.walkMinMinutes, nowMs: now } : false,
    places: prefs.places,
  }
}

/** Words for the card and the settings row. Pure. */
export function autoTrackLine(state: AutoTrackState, now = Date.now()): string {
  if (!state.on) return "Off. Nothing is read until you sync."
  const last = state.last
  if (!last) return "On. First sync runs when the Mac's data has loaded."
  const mins = Math.max(0, Math.round((now - last.at) / 60000))
  const ago = mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : mins < 2880 ? `${Math.round(mins / 60)} h ago` : `${Math.round(mins / 1440)} days ago`
  if (last.note) return `Synced ${ago}. ${last.note}`
  const parts: string[] = []
  const w = last.written
  if (w.walks) parts.push(`${w.walks} walk${w.walks === 1 ? "" : "s"}`)
  if (w.workouts) parts.push(`${w.workouts} workout${w.workouts === 1 ? "" : "s"}`)
  if (w.nights) parts.push(`${w.nights} night${w.nights === 1 ? "" : "s"}`)
  if (last.placed) parts.push(`${last.placed} place row${last.placed === 1 ? "" : "s"}`)
  return parts.length ? `Synced ${ago}. Added ${parts.join(", ")}.` : `Synced ${ago}. Nothing new.`
}

let running: Promise<AutoTrackLastRun | null> | null = null

/** Paint the journal's new events, when no relay does it. Returns rows written. */
async function landLocationJournal(state: AutoTrackState): Promise<{ placed: number; seq?: number }> {
  if (!isLocationPluginAvailable()) return { placed: 0 }
  const status = await getLocationStatus()
  if (status.configured) return { placed: 0 }
  const { events, lastSeq } = await readLocationJournal(state.locationSeq ?? 0)
  if (events.length === 0) return { placed: 0, seq: lastSeq }
  const batch = parseLocationBatch({ kind: "location", events })
  const placed = batch ? applyLocationBatch(batch).written : 0
  return { placed, seq: lastSeq }
}

/**
 * One run. Skipped (null) when off, off the phone, or run moments ago. Two
 * callers at once share one run.
 */
export function runAutoTrack(opts: { force?: boolean; now?: number } = {}): Promise<AutoTrackLastRun | null> {
  if (running) return running
  const state = getAutoTrack()
  const now = opts.now ?? Date.now()
  if (!autoTrackAvailable()) return Promise.resolve(null)
  if (!opts.force && (!state.on || (state.last && now - state.last.at < AUTO_TRACK_MIN_GAP_MS))) return Promise.resolve(null)
  running = (async () => {
    let placed = 0
    let note: string | undefined
    const patch: Partial<AutoTrackState> = {}
    try {
      const landed = await landLocationJournal(state)
      placed = landed.placed
      if (landed.seq !== undefined) patch.locationSeq = landed.seq
    } catch (err) {
      note = `Location did not land: ${err instanceof Error ? err.message : String(err)}`
    }
    const health = await syncHealthSince(autoTrackSince(state.healthAt, now), autoTrackMergeOptions(state, now), now)
    if (health.status === "synced") patch.healthAt = now
    else if (health.status === "denied") note = "Health access is off. Turn it on in the Health app, under Sharing, then Apps, then Brain2."
    else if (health.status === "failed") note = health.error || "Health did not answer."
    const last: AutoTrackLastRun = { at: now, written: health.written, placed, ...(note ? { note } : {}) }
    setAutoTrack({ ...patch, last })
    return last
  })().finally(() => {
    running = null
  })
  return running
}
