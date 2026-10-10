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
 * `superimposeByScope` remembers a faint second view **per active scope**.
 * Painting still writes the active view. The map is not tied to the viewed day.
 */
"use client"

import { useEffect, useSyncExternalStore } from "react"
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
  /**
   * Overlay scope id keyed by the view you were standing on.
   * Missing key, empty, unknown, or a value equal to the key means off.
   */
  superimposeByScope: Record<string, string>
}

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
  superimposeByScope: {},
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

function mapsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  return keys.every((key) => a[key] === b[key])
}

function clonePrefs(prefs: TrackingViewPrefs): TrackingViewPrefs {
  return { ...prefs, superimposeByScope: { ...prefs.superimposeByScope } }
}

function load(): TrackingViewPrefs {
  if (typeof window === "undefined") return clonePrefs(DEFAULT_TRACKING_VIEW_PREFS)
  try {
    const raw = readAliasedLocal(KEY)
    if (!raw) return clonePrefs(DEFAULT_TRACKING_VIEW_PREFS)
    const parsed = JSON.parse(raw) as Partial<TrackingViewPrefs>
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
      superimposeByScope: sanitizeSuperimposeMap(parsed.superimposeByScope),
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
    mapsEqual(prefs.superimposeByScope, DEFAULT_TRACKING_VIEW_PREFS.superimposeByScope)
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
    superimposeByScope:
      patch.superimposeByScope === undefined
        ? snapshot.superimposeByScope
        : sanitizeSuperimposeMap(patch.superimposeByScope),
  }
  try {
    writeAliasedLocal(KEY, JSON.stringify(snapshot))
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
