/**
 * components/Home/Tracking/tracking-view-prefs.ts — Fill-range + pen tray
 *
 * Cell size already lives on the tracking store. Typed Fill clocks are a view
 * preference: **Day fill starts/ends** are the Time Grid Fill *fallback* when
 * the viewed day is fully untracked (the waking window) — the control itself
 * defaults to the longest empty gap. **Week fill starts/ends** stay the week
 * grid's typed Fill default. Each bound is an HH:MM clock — not a calendar
 * date. The photographed pen-well plate lives here too so Wave 6 does not
 * bump persist or rewrite paint math. `penWellExpanded` is the one-line vs
 * wrapped bead well (Expand / Conceal, right of Tree). `notesWellExpanded`
 * is the day-notes metal well (hidden log vs a tall composer and history).
 * `hideLogFlags` hides discrete log flags (Text log, Intake, Switch, Spent…) on
 * the Day, Week, and Infinite time plots. The entries stay in the vault and in
 * the Tracking log; only the grid flags go.
 * `hideSunLines` hides the sunrise / sunset lines on those plots (the now line
 * stays). `superimposeMulti` (on by default) lets one view carry several ghosts at once
 * (`superimposeMultiByScope`, keyed like the single map). `superimposeAdvanced`
 * applies `superimposeOpacity` (ghost scope id → 0.05–1 wash opacity).
 * `superimposeByScope` remembers a faint second view **per active scope**.
 * Painting still writes the active view. The map is not tied to the viewed day.
 *
 * Per-view defaults from Tracking settings: `activityGapMinutes` (shortest
 * untracked gap the Activity Log lists; 0 lists none), `activityShowLogLines`
 * (Text log / Intake / Switch instants between blocks), `dayLogSpan` and
 * `logSpan` (Day or Week when the view opens), `logDefaultMode` (the composer
 * key the Tracking log opens on), `logShowRecents` (Recent intake / Again
 * chips), and `logFlagOnAdd` (the bottom-right "LOGGED" flag after Add).
 */
"use client"

import { useEffect, useMemo, useSyncExternalStore } from "react"
import { timeStringToMinutes } from "@/lib/time-entries"
import { persistKey, readAliasedLocal, writeAliasedLocal } from "@/lib/storage-keys"
import { DEFAULT_PEN_TRAY, isPenTrayId, parsePenTray, type PenTrayId } from "./pen-tray-bg"

export type TrackingViewPrefs = {
  /** HH:MM fallback start for Time Grid Fill when the day is fully untracked. */
  fillFrom: string
  /** HH:MM fallback end for Time Grid Fill. Earlier than start wraps past midnight. */
  fillTo: string
  /** HH:MM default start for Week Grid typed Fill (clock, not a week-of date). */
  weekFillFrom: string
  /** HH:MM default end for Week Grid typed Fill. */
  weekFillTo: string
  /** Photographed plate under the pen well and selected-pen strip. */
  penTray: PenTrayId
  /** Full wrapped beads. Off (default) is one clipped row under Search. */
  penWellExpanded: boolean
  /** Day summary well open (editor). Off hides it. The name stayed when the well was an append log. */
  notesWellExpanded: boolean
  /** Hide discrete log flags on the time plots. Off (default) draws them. */
  hideLogFlags: boolean
  /** Hide the sunrise / sunset lines on the time plots. Off (default) draws them. */
  hideSunLines: boolean
  /** Several ghosts per view: keys toggle in and out instead of switching. On by default. */
  superimposeMulti: boolean
  /** Ghost scope ids per active scope while Multi is on. Separate from the single map. */
  superimposeMultiByScope: Record<string, string[]>
  /** Per-ghost opacity sliders apply. Off uses the stock wash. */
  superimposeAdvanced: boolean
  /** Wash opacity per ghost scope id, 0.05–1. Only read while Advanced is on. */
  superimposeOpacity: Record<string, number>
  /**
   * Bottom ribbon percentages, per grid span: share of tracked time, or share
   * of the whole day / week. Kept per span, not per date.
   */
  ribbonPercent: RibbonPercentBySpan
  /**
   * Screen face per time base: **paper** (white and gray grid) or **glass**
   * (dark graticule). Day defaults to paper; Week and Infinite to glass.
   */
  screenFace: ScreenFaceBySpan
  /**
   * Overlay scope id keyed by the view you were standing on.
   * Missing key, empty, unknown, or a value equal to the key means off.
   */
  superimposeByScope: Record<string, string>
  /** Shortest untracked gap the Activity Log lists, in minutes. 0 lists no gaps. */
  activityGapMinutes: number
  /** Activity Log lists Text log / Intake / Switch instants between blocks. */
  activityShowLogLines: boolean
  /** Day Log opens on Day or Week. */
  dayLogSpan: TrackingSpan
  /** Tracking log opens on Day or Week. */
  logSpan: TrackingSpan
  /** Composer key the Tracking log opens on. */
  logDefaultMode: LogComposerModePref
  /** Recent intake and Again purchase chips on the composer. */
  logShowRecents: boolean
  /** Bottom-right "LOGGED" flag after Add. */
  logFlagOnAdd: boolean
}

export const ACTIVITY_GAP_STEPS = [0, 5, 15, 30, 60] as const
export type TrackingSpan = "day" | "week"
export const LOG_COMPOSER_MODES = ["event", "switch", "intake", "spend", "note", "thought"] as const
export type LogComposerModePref = (typeof LOG_COMPOSER_MODES)[number]

function isSpan(value: unknown): value is TrackingSpan {
  return value === "day" || value === "week"
}

function isComposerMode(value: unknown): value is LogComposerModePref {
  return typeof value === "string" && (LOG_COMPOSER_MODES as readonly string[]).includes(value)
}

function isGapStep(value: unknown): value is number {
  return typeof value === "number" && (ACTIVITY_GAP_STEPS as readonly number[]).includes(value)
}

export type ScreenFace = "paper" | "glass"
export type ScreenFaceBySpan = { day: ScreenFace; week: ScreenFace; infinite: ScreenFace }
export const DEFAULT_SCREEN_FACE: ScreenFaceBySpan = { day: "paper", week: "glass", infinite: "glass" }

function parseScreenFace(value: unknown): ScreenFaceBySpan {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>
  const pick = (key: keyof ScreenFaceBySpan): ScreenFace =>
    raw[key] === "paper" || raw[key] === "glass" ? (raw[key] as ScreenFace) : DEFAULT_SCREEN_FACE[key]
  return { day: pick("day"), week: pick("week"), infinite: pick("infinite") }
}

export type RibbonPercentBasis = "tracked" | "period"
export type RibbonPercentBySpan = { day: RibbonPercentBasis; week: RibbonPercentBasis }

function parseRibbonPercent(value: unknown): RibbonPercentBySpan {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>
  return {
    day: raw.day === "period" ? "period" : "tracked",
    week: raw.week === "period" ? "period" : "tracked",
  }
}

/**
 * Marks a blob written after Multi became the default. Older blobs (which
 * stored `superimposeMulti: false` only because that was the default) load
 * with Multi on, seeded once from each view's single ghost.
 */
const MULTI_DEFAULT_MARK = "multiDefaultV2"

/** View-settings copy for the Fill clocks. Persist keys stay the four fields above. */
export const TRACKING_FILL_CLOCK_LABELS = {
  fillFrom: "Day fill starts",
  fillTo: "Day fill ends",
  weekFillFrom: "Week fill starts",
  weekFillTo: "Week fill ends",
} as const

export const DEFAULT_TRACKING_VIEW_PREFS: TrackingViewPrefs = {
  fillFrom: "09:00",
  fillTo: "10:00",
  weekFillFrom: "09:00",
  weekFillTo: "17:00",
  penTray: DEFAULT_PEN_TRAY,
  penWellExpanded: false,
  notesWellExpanded: false,
  hideLogFlags: false,
  hideSunLines: false,
  superimposeMulti: true,
  superimposeMultiByScope: {},
  superimposeAdvanced: false,
  superimposeOpacity: {},
  ribbonPercent: { day: "tracked", week: "tracked" },
  screenFace: { ...DEFAULT_SCREEN_FACE },
  superimposeByScope: {},
  activityGapMinutes: 15,
  activityShowLogLines: true,
  dayLogSpan: "day",
  logSpan: "day",
  logDefaultMode: "event",
  logShowRecents: true,
  logFlagOnAdd: true,
}

const KEY = persistKey("tracking-view-prefs")

let snapshot: TrackingViewPrefs = load()
const listeners = new Set<() => void>()

function isClock(value: unknown): value is string {
  return typeof value === "string" && timeStringToMinutes(value) !== null
}

/** Drop empty and self-overlay entries. Leave every other scope alone. */
export function sanitizeSuperimposeMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const out: Record<string, string> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!key || typeof raw !== "string" || !raw || raw === key) continue
    out[key] = raw
  }
  return out
}

/** Stock ghost wash opacity (`.trk-super` in tracking-chrome.css). */
export const DEFAULT_SUPERIMPOSE_OPACITY = 0.32

export function clampSuperimposeOpacity(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SUPERIMPOSE_OPACITY
  return Math.min(1, Math.max(0.05, value))
}

/** Drop empty, self, and repeated ids. Leave every other scope alone. */
export function sanitizeSuperimposeMultiMap(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const out: Record<string, string[]> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!key || !Array.isArray(raw)) continue
    const ids: string[] = []
    for (const id of raw) {
      if (typeof id !== "string" || !id || id === key || ids.includes(id)) continue
      ids.push(id)
    }
    if (ids.length) out[key] = ids
  }
  return out
}

export function sanitizeSuperimposeOpacity(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const out: Record<string, number> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!key || typeof raw !== "number" || !Number.isFinite(raw)) continue
    out[key] = clampSuperimposeOpacity(raw)
  }
  return out
}

function multiMapsEqual(a: Record<string, string[]>, b: Record<string, string[]>): boolean {
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  return keys.every((key) => {
    const x = a[key]
    const y = b[key]
    return Boolean(y) && x.length === y.length && x.every((id, i) => id === y[i])
  })
}

function numberMapsEqual(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  return keys.every((key) => a[key] === b[key])
}

function mapsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  return keys.every((key) => a[key] === b[key])
}

function clonePrefs(prefs: TrackingViewPrefs): TrackingViewPrefs {
  const multi: Record<string, string[]> = {}
  for (const [key, ids] of Object.entries(prefs.superimposeMultiByScope)) multi[key] = [...ids]
  return {
    ...prefs,
    superimposeByScope: { ...prefs.superimposeByScope },
    superimposeMultiByScope: multi,
    superimposeOpacity: { ...prefs.superimposeOpacity },
    ribbonPercent: { ...prefs.ribbonPercent },
    screenFace: { ...prefs.screenFace },
  }
}

function load(): TrackingViewPrefs {
  if (typeof window === "undefined") return clonePrefs(DEFAULT_TRACKING_VIEW_PREFS)
  try {
    const raw = readAliasedLocal(KEY)
    if (!raw) return clonePrefs(DEFAULT_TRACKING_VIEW_PREFS)
    const parsed = JSON.parse(raw) as Partial<TrackingViewPrefs> & { [MULTI_DEFAULT_MARK]?: boolean }
    const singleMap = sanitizeSuperimposeMap(parsed.superimposeByScope)
    const multiMap = sanitizeSuperimposeMultiMap(parsed.superimposeMultiByScope)
    const marked = parsed[MULTI_DEFAULT_MARK] === true
    if (!marked) {
      // First load since Multi became the default: keep each view's single ghost drawn.
      for (const [key, id] of Object.entries(singleMap)) if (!multiMap[key]?.length) multiMap[key] = [id]
    }
    // The old global `superimpose` / `superimposeScopeId` is ignored. Copying
    // that one lens onto every view is the bug this map replaces. A blob
    // without `superimposeByScope` reads as all-off.
    return {
      fillFrom: isClock(parsed.fillFrom) ? parsed.fillFrom : DEFAULT_TRACKING_VIEW_PREFS.fillFrom,
      fillTo: isClock(parsed.fillTo) ? parsed.fillTo : DEFAULT_TRACKING_VIEW_PREFS.fillTo,
      weekFillFrom: isClock(parsed.weekFillFrom) ? parsed.weekFillFrom : DEFAULT_TRACKING_VIEW_PREFS.weekFillFrom,
      weekFillTo: isClock(parsed.weekFillTo) ? parsed.weekFillTo : DEFAULT_TRACKING_VIEW_PREFS.weekFillTo,
      penTray: parsePenTray(parsed.penTray),
      penWellExpanded: parsed.penWellExpanded === true,
      notesWellExpanded: parsed.notesWellExpanded === true,
      hideLogFlags: parsed.hideLogFlags === true,
      hideSunLines: parsed.hideSunLines === true,
      superimposeMulti: marked ? parsed.superimposeMulti !== false : true,
      superimposeMultiByScope: multiMap,
      superimposeAdvanced: parsed.superimposeAdvanced === true,
      superimposeOpacity: sanitizeSuperimposeOpacity(parsed.superimposeOpacity),
      ribbonPercent: parseRibbonPercent(parsed.ribbonPercent),
      screenFace: parseScreenFace(parsed.screenFace),
      superimposeByScope: singleMap,
      activityGapMinutes: isGapStep(parsed.activityGapMinutes)
        ? parsed.activityGapMinutes
        : DEFAULT_TRACKING_VIEW_PREFS.activityGapMinutes,
      activityShowLogLines: parsed.activityShowLogLines !== false,
      dayLogSpan: isSpan(parsed.dayLogSpan) ? parsed.dayLogSpan : DEFAULT_TRACKING_VIEW_PREFS.dayLogSpan,
      logSpan: isSpan(parsed.logSpan) ? parsed.logSpan : DEFAULT_TRACKING_VIEW_PREFS.logSpan,
      logDefaultMode: isComposerMode(parsed.logDefaultMode) ? parsed.logDefaultMode : DEFAULT_TRACKING_VIEW_PREFS.logDefaultMode,
      logShowRecents: parsed.logShowRecents !== false,
      logFlagOnAdd: parsed.logFlagOnAdd !== false,
    }
  } catch {
    return clonePrefs(DEFAULT_TRACKING_VIEW_PREFS)
  }
}

function emit() {
  for (const listener of listeners) listener()
}

function sameAsDefault(prefs: TrackingViewPrefs): boolean {
  return (
    prefs.fillFrom === DEFAULT_TRACKING_VIEW_PREFS.fillFrom &&
    prefs.fillTo === DEFAULT_TRACKING_VIEW_PREFS.fillTo &&
    prefs.weekFillFrom === DEFAULT_TRACKING_VIEW_PREFS.weekFillFrom &&
    prefs.weekFillTo === DEFAULT_TRACKING_VIEW_PREFS.weekFillTo &&
    prefs.penTray === DEFAULT_TRACKING_VIEW_PREFS.penTray &&
    prefs.penWellExpanded === DEFAULT_TRACKING_VIEW_PREFS.penWellExpanded &&
    prefs.notesWellExpanded === DEFAULT_TRACKING_VIEW_PREFS.notesWellExpanded &&
    prefs.hideLogFlags === DEFAULT_TRACKING_VIEW_PREFS.hideLogFlags &&
    prefs.hideSunLines === DEFAULT_TRACKING_VIEW_PREFS.hideSunLines &&
    prefs.superimposeMulti === DEFAULT_TRACKING_VIEW_PREFS.superimposeMulti &&
    prefs.superimposeAdvanced === DEFAULT_TRACKING_VIEW_PREFS.superimposeAdvanced &&
    multiMapsEqual(prefs.superimposeMultiByScope, DEFAULT_TRACKING_VIEW_PREFS.superimposeMultiByScope) &&
    numberMapsEqual(prefs.superimposeOpacity, DEFAULT_TRACKING_VIEW_PREFS.superimposeOpacity) &&
    prefs.ribbonPercent.day === DEFAULT_TRACKING_VIEW_PREFS.ribbonPercent.day &&
    prefs.ribbonPercent.week === DEFAULT_TRACKING_VIEW_PREFS.ribbonPercent.week &&
    prefs.screenFace.day === DEFAULT_SCREEN_FACE.day &&
    prefs.screenFace.week === DEFAULT_SCREEN_FACE.week &&
    prefs.screenFace.infinite === DEFAULT_SCREEN_FACE.infinite &&
    mapsEqual(prefs.superimposeByScope, DEFAULT_TRACKING_VIEW_PREFS.superimposeByScope) &&
    prefs.activityGapMinutes === DEFAULT_TRACKING_VIEW_PREFS.activityGapMinutes &&
    prefs.activityShowLogLines === DEFAULT_TRACKING_VIEW_PREFS.activityShowLogLines &&
    prefs.dayLogSpan === DEFAULT_TRACKING_VIEW_PREFS.dayLogSpan &&
    prefs.logSpan === DEFAULT_TRACKING_VIEW_PREFS.logSpan &&
    prefs.logDefaultMode === DEFAULT_TRACKING_VIEW_PREFS.logDefaultMode &&
    prefs.logShowRecents === DEFAULT_TRACKING_VIEW_PREFS.logShowRecents &&
    prefs.logFlagOnAdd === DEFAULT_TRACKING_VIEW_PREFS.logFlagOnAdd
  )
}

export function getTrackingViewPrefs(): TrackingViewPrefs {
  if (typeof window !== "undefined" && !readAliasedLocal(KEY)) {
    if (!sameAsDefault(snapshot)) snapshot = clonePrefs(DEFAULT_TRACKING_VIEW_PREFS)
  }
  return snapshot
}

export function setTrackingViewPrefs(patch: Partial<TrackingViewPrefs>): void {
  snapshot = {
    ...snapshot,
    fillFrom: isClock(patch.fillFrom) ? patch.fillFrom : snapshot.fillFrom,
    fillTo: isClock(patch.fillTo) ? patch.fillTo : snapshot.fillTo,
    weekFillFrom: isClock(patch.weekFillFrom) ? patch.weekFillFrom : snapshot.weekFillFrom,
    weekFillTo: isClock(patch.weekFillTo) ? patch.weekFillTo : snapshot.weekFillTo,
    penTray: isPenTrayId(patch.penTray) ? patch.penTray : snapshot.penTray,
    penWellExpanded: typeof patch.penWellExpanded === "boolean" ? patch.penWellExpanded : snapshot.penWellExpanded,
    notesWellExpanded: typeof patch.notesWellExpanded === "boolean" ? patch.notesWellExpanded : snapshot.notesWellExpanded,
    hideLogFlags: typeof patch.hideLogFlags === "boolean" ? patch.hideLogFlags : snapshot.hideLogFlags,
    hideSunLines: typeof patch.hideSunLines === "boolean" ? patch.hideSunLines : snapshot.hideSunLines,
    superimposeMulti: typeof patch.superimposeMulti === "boolean" ? patch.superimposeMulti : snapshot.superimposeMulti,
    superimposeMultiByScope:
      patch.superimposeMultiByScope === undefined
        ? snapshot.superimposeMultiByScope
        : sanitizeSuperimposeMultiMap(patch.superimposeMultiByScope),
    superimposeAdvanced:
      typeof patch.superimposeAdvanced === "boolean" ? patch.superimposeAdvanced : snapshot.superimposeAdvanced,
    superimposeOpacity:
      patch.superimposeOpacity === undefined
        ? snapshot.superimposeOpacity
        : sanitizeSuperimposeOpacity(patch.superimposeOpacity),
    ribbonPercent: patch.ribbonPercent === undefined ? snapshot.ribbonPercent : parseRibbonPercent(patch.ribbonPercent),
    screenFace: patch.screenFace === undefined ? snapshot.screenFace : parseScreenFace(patch.screenFace),
    superimposeByScope:
      patch.superimposeByScope === undefined
        ? snapshot.superimposeByScope
        : sanitizeSuperimposeMap(patch.superimposeByScope),
    activityGapMinutes: isGapStep(patch.activityGapMinutes) ? patch.activityGapMinutes : snapshot.activityGapMinutes,
    activityShowLogLines:
      typeof patch.activityShowLogLines === "boolean" ? patch.activityShowLogLines : snapshot.activityShowLogLines,
    dayLogSpan: isSpan(patch.dayLogSpan) ? patch.dayLogSpan : snapshot.dayLogSpan,
    logSpan: isSpan(patch.logSpan) ? patch.logSpan : snapshot.logSpan,
    logDefaultMode: isComposerMode(patch.logDefaultMode) ? patch.logDefaultMode : snapshot.logDefaultMode,
    logShowRecents: typeof patch.logShowRecents === "boolean" ? patch.logShowRecents : snapshot.logShowRecents,
    logFlagOnAdd: typeof patch.logFlagOnAdd === "boolean" ? patch.logFlagOnAdd : snapshot.logFlagOnAdd,
  }
  try {
    writeAliasedLocal(KEY, JSON.stringify({ ...snapshot, [MULTI_DEFAULT_MARK]: true }))
  } catch {
    /* private mode — prefs still apply for this session */
  }
  emit()
}

/**
 * Write the overlay for one view. `null` (or the view itself) deletes only
 * that key. Other views' entries stay.
 */
export function setScopeSuperimpose(activeScopeId: string, overlayScopeId: string | null): void {
  if (!activeScopeId) return
  const next = { ...snapshot.superimposeByScope }
  if (!overlayScopeId || overlayScopeId === activeScopeId) delete next[activeScopeId]
  else next[activeScopeId] = overlayScopeId
  if (mapsEqual(snapshot.superimposeByScope, next)) return
  setTrackingViewPrefs({ superimposeByScope: next })
}

/**
 * Multi mode: add the ghost when it is off for this view, drop it when it is
 * on. Other views' lists stay. The view itself is never a ghost.
 */
export function toggleScopeSuperimposeMulti(activeScopeId: string, overlayScopeId: string): void {
  if (!activeScopeId || !overlayScopeId || overlayScopeId === activeScopeId) return
  const current = snapshot.superimposeMultiByScope[activeScopeId] ?? []
  const nextIds = current.includes(overlayScopeId)
    ? current.filter((id) => id !== overlayScopeId)
    : [...current, overlayScopeId]
  const next = { ...snapshot.superimposeMultiByScope }
  if (nextIds.length) next[activeScopeId] = nextIds
  else delete next[activeScopeId]
  setTrackingViewPrefs({ superimposeMultiByScope: next })
}

/** Multi mode Off: clear this view's ghost list only. */
export function clearScopeSuperimposeMulti(activeScopeId: string): void {
  if (!activeScopeId || !snapshot.superimposeMultiByScope[activeScopeId]) return
  const next = { ...snapshot.superimposeMultiByScope }
  delete next[activeScopeId]
  setTrackingViewPrefs({ superimposeMultiByScope: next })
}

/**
 * Flip Multi. Turning it on seeds each view's list from its single ghost when
 * that view has no list yet, so the ghost you had stays drawn. Turning it off
 * returns to the single map, which Multi never rewrote.
 */
export function setSuperimposeMulti(on: boolean): void {
  if (!on) {
    setTrackingViewPrefs({ superimposeMulti: false })
    return
  }
  const next = { ...snapshot.superimposeMultiByScope }
  for (const [key, id] of Object.entries(snapshot.superimposeByScope)) {
    if (!next[key]?.length) next[key] = [id]
  }
  setTrackingViewPrefs({ superimposeMulti: true, superimposeMultiByScope: next })
}

export function setSuperimposeOpacity(overlayScopeId: string, opacity: number): void {
  if (!overlayScopeId) return
  setTrackingViewPrefs({
    superimposeOpacity: { ...snapshot.superimposeOpacity, [overlayScopeId]: clampSuperimposeOpacity(opacity) },
  })
}

/** Paper or glass for one time base. The other spans keep theirs. */
export function setScreenFace(span: keyof ScreenFaceBySpan, face: ScreenFace): void {
  if (snapshot.screenFace[span] === face) return
  setTrackingViewPrefs({ screenFace: { ...snapshot.screenFace, [span]: face } })
}

/** Flip the bottom ribbon's percentages for one span. Other span unchanged. */
export function setRibbonPercent(span: "day" | "week", basis: RibbonPercentBasis): void {
  if (snapshot.ribbonPercent[span] === basis) return
  setTrackingViewPrefs({ ribbonPercent: { ...snapshot.ribbonPercent, [span]: basis } })
}

/** Tests: re-read localStorage (or defaults) after a store reset. */
export function resetTrackingViewPrefs(): void {
  snapshot = load()
  emit()
}

export function subscribeTrackingViewPrefs(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTrackingViewPrefs(): TrackingViewPrefs {
  return useSyncExternalStore(subscribeTrackingViewPrefs, getTrackingViewPrefs, () => DEFAULT_TRACKING_VIEW_PREFS)
}

/**
 * The other view this scope wants drawn faintly, or null when that entry is
 * missing, empty, unknown, or the scope itself.
 */
export function resolveSuperimposeScopeId(
  activeScopeId: string | undefined,
  scopeIds: readonly string[],
  prefs: Pick<TrackingViewPrefs, "superimposeByScope">,
): string | null {
  if (!activeScopeId) return null
  const id = prefs.superimposeByScope[activeScopeId]
  if (!id || id === activeScopeId) return null
  if (!scopeIds.includes(id)) return null
  return id
}

/**
 * Resolved overlay for the view you are standing on. A self-entry is deleted
 * for that scope only — switching views never clears the rest of the map.
 */
export function useSuperimposeScope(activeScopeId: string | undefined, scopeIds: readonly string[]): string | null {
  const prefs = useTrackingViewPrefs()
  const resolved = resolveSuperimposeScopeId(activeScopeId, scopeIds, prefs)
  useEffect(() => {
    if (!activeScopeId) return
    const stored = prefs.superimposeByScope[activeScopeId]
    if (stored && stored === activeScopeId) setScopeSuperimpose(activeScopeId, null)
  }, [activeScopeId, prefs.superimposeByScope])
  return resolved
}

export type SuperimposeLayer = {
  scopeId: string
  /** Wash opacity, only while Advanced is on. Undefined keeps the stock CSS wash. */
  opacity?: number
}

/**
 * Every ghost this view wants drawn, in key order. Single mode is the one
 * resolved ghost (or none). Multi mode is this view's list, minus unknown ids.
 */
export function resolveSuperimposeLayers(
  activeScopeId: string | undefined,
  scopeIds: readonly string[],
  prefs: Pick<
    TrackingViewPrefs,
    "superimposeByScope" | "superimposeMulti" | "superimposeMultiByScope" | "superimposeAdvanced" | "superimposeOpacity"
  >,
): SuperimposeLayer[] {
  if (!activeScopeId) return []
  const ids = prefs.superimposeMulti
    ? (prefs.superimposeMultiByScope[activeScopeId] ?? []).filter((id) => id !== activeScopeId && scopeIds.includes(id))
    : [resolveSuperimposeScopeId(activeScopeId, scopeIds, prefs)].filter((id): id is string => Boolean(id))
  return ids.map((scopeId) => ({
    scopeId,
    opacity: prefs.superimposeAdvanced ? prefs.superimposeOpacity[scopeId] ?? DEFAULT_SUPERIMPOSE_OPACITY : undefined,
  }))
}

/**
 * Ghost layers for the view you are standing on. Same self-entry cleanup as
 * `useSuperimposeScope`. The array is stable while its ids and opacities are.
 */
export function useSuperimposeLayers(activeScopeId: string | undefined, scopeIds: readonly string[]): SuperimposeLayer[] {
  useSuperimposeScope(activeScopeId, scopeIds)
  const prefs = useTrackingViewPrefs()
  const layers = resolveSuperimposeLayers(activeScopeId, scopeIds, prefs)
  const key = layers.map((layer) => `${layer.scopeId}:${layer.opacity ?? ""}`).join("|")
  return useMemo(() => layers, [key]) // eslint-disable-line react-hooks/exhaustive-deps
}
