/**
 * lib/screen-history-controller.ts — Session singleton for back/forward
 *
 * Listens for navigation pin writes, records distinct screens, and applies
 * snapshots on back/forward. Mount once via `useScreenHistory`.
 */
"use client"

import {
  createScreenHistory,
  currentScreen,
  goBack,
  goForward,
  pushScreen,
  screenHistorySnapshot,
  type ScreenHistorySnapshot,
  type ScreenHistoryState,
} from "@/lib/screen-history"
import { COGS_NAV_PIN_CHANGED_EVENT } from "@/lib/app-navigation"
import {
  applyScreenLocation,
  COGS_SCREEN_HISTORY_EVENT,
  isScreenRestoreInProgress,
  readScreenLocation,
  screenLocationKey,
} from "@/lib/screen-location"

let state: ScreenHistoryState = createScreenHistory(null)
let seeded = false
let recordQueued = false
let pinListener: (() => void) | null = null

function emit(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(COGS_SCREEN_HISTORY_EVENT))
}

function setState(next: ScreenHistoryState): void {
  state = next
  emit()
}

function scheduleRecord(): void {
  if (typeof window === "undefined") return
  if (isScreenRestoreInProgress()) return
  if (recordQueued) return
  recordQueued = true
  queueMicrotask(() => {
    recordQueued = false
    if (isScreenRestoreInProgress()) return
    const loc = readScreenLocation()
    if (!seeded) {
      seeded = true
      setState(createScreenHistory(loc))
      return
    }
    const next = pushScreen(state, loc)
    if (next !== state) setState(next)
  })
}

function ensureListening(): void {
  if (typeof window === "undefined") return
  if (pinListener) return
  pinListener = () => scheduleRecord()
  window.addEventListener(COGS_NAV_PIN_CHANGED_EVENT, pinListener)
}

/** Seed from the live screen if the stack is still empty (first mount). */
export function seedScreenHistoryIfNeeded(): void {
  ensureListening()
  if (seeded) return
  if (typeof window === "undefined") return
  seeded = true
  setState(createScreenHistory(readScreenLocation()))
}

export function getScreenHistorySnapshot(): ScreenHistorySnapshot {
  return screenHistorySnapshot(state)
}

export function screenHistoryBack(): boolean {
  ensureListening()
  if (state.index <= 0) return false
  const next = goBack(state)
  const loc = currentScreen(next)
  if (!loc) return false
  setState(next)
  applyScreenLocation(loc)
  return true
}

export function screenHistoryForward(): boolean {
  ensureListening()
  if (state.index < 0 || state.index >= state.entries.length - 1) return false
  const next = goForward(state)
  const loc = currentScreen(next)
  if (!loc) return false
  setState(next)
  applyScreenLocation(loc)
  return true
}

/** Test helper — reset the session stack. */
export function resetScreenHistoryForTests(): void {
  state = createScreenHistory(null)
  seeded = false
  recordQueued = false
  if (typeof window !== "undefined" && pinListener) {
    window.removeEventListener(COGS_NAV_PIN_CHANGED_EVENT, pinListener)
    pinListener = null
  }
}

export function subscribeScreenHistory(handler: () => void): () => void {
  ensureListening()
  if (typeof window === "undefined") return () => {}
  const listener = () => handler()
  window.addEventListener(COGS_SCREEN_HISTORY_EVENT, listener)
  return () => window.removeEventListener(COGS_SCREEN_HISTORY_EVENT, listener)
}

export { screenLocationKey }
