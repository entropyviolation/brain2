/**
 * lib/screen-history.ts — Browser-style back/forward stack for in-app screens
 *
 * Pure stack: push, back, forward, truncate-on-branch, no consecutive duplicates.
 * Screen identity lives in `screen-location.ts`; this file only owns the stack.
 */
import type { ScreenLocation } from "@/lib/screen-location"
import { screenLocationKey } from "@/lib/screen-location"

export interface ScreenHistoryState {
  entries: ScreenLocation[]
  index: number
}

export interface ScreenHistorySnapshot {
  entries: ScreenLocation[]
  index: number
  canBack: boolean
  canForward: boolean
  current: ScreenLocation | null
}

export function createScreenHistory(initial?: ScreenLocation | null): ScreenHistoryState {
  if (!initial) return { entries: [], index: -1 }
  return { entries: [initial], index: 0 }
}

export function screenHistorySnapshot(state: ScreenHistoryState): ScreenHistorySnapshot {
  const current = state.index >= 0 ? state.entries[state.index] ?? null : null
  return {
    entries: state.entries,
    index: state.index,
    canBack: state.index > 0,
    canForward: state.index >= 0 && state.index < state.entries.length - 1,
    current,
  }
}

/** Record a visit. No-ops on consecutive duplicates; truncates the forward stack. */
export function pushScreen(
  state: ScreenHistoryState,
  location: ScreenLocation,
): ScreenHistoryState {
  const key = screenLocationKey(location)
  const current = state.index >= 0 ? state.entries[state.index] : null
  if (current && screenLocationKey(current) === key) return state

  const kept = state.entries.slice(0, state.index + 1)
  return {
    entries: [...kept, location],
    index: kept.length,
  }
}

export function goBack(state: ScreenHistoryState): ScreenHistoryState {
  if (state.index <= 0) return state
  return { ...state, index: state.index - 1 }
}

export function goForward(state: ScreenHistoryState): ScreenHistoryState {
  if (state.index < 0 || state.index >= state.entries.length - 1) return state
  return { ...state, index: state.index + 1 }
}

export function currentScreen(state: ScreenHistoryState): ScreenLocation | null {
  if (state.index < 0) return null
  return state.entries[state.index] ?? null
}
