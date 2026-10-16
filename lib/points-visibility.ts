/**
 * lib/points-visibility.ts — The Points visible setting (Phase 15 D, Decision 13)
 *
 * One view pref, set in Settings → Points. Off by default: step-point figures
 * stay hidden (the lid, the task card, reviews, `steps N` in the card header).
 * It never touches `lib/points-store.ts`: points still accrue and are stored
 * exactly as before. Task, tier and session points always show.
 */
"use client"

import { useSyncExternalStore } from "react"
import { persistKey, readAliasedLocal, writeAliasedLocal } from "@/lib/storage-keys"

export const POINTS_VISIBLE_KEY = persistKey("points-visible")

export type PointsVisibility = { stepPoints: boolean }

export const DEFAULT_POINTS_VISIBILITY: PointsVisibility = { stepPoints: false }

const listeners = new Set<() => void>()

function load(): PointsVisibility {
  if (typeof window === "undefined") return DEFAULT_POINTS_VISIBILITY
  try {
    const raw = readAliasedLocal(POINTS_VISIBLE_KEY)
    if (!raw) return DEFAULT_POINTS_VISIBILITY
    const parsed = JSON.parse(raw) as Partial<PointsVisibility>
    return { stepPoints: parsed.stepPoints === true }
  } catch {
    return DEFAULT_POINTS_VISIBILITY
  }
}

let snapshot: PointsVisibility = load()

export function getPointsVisibility(): PointsVisibility {
  return snapshot
}

export function setPointsVisibility(patch: Partial<PointsVisibility>): void {
  snapshot = { stepPoints: patch.stepPoints ?? snapshot.stepPoints }
  try {
    writeAliasedLocal(POINTS_VISIBLE_KEY, JSON.stringify(snapshot))
  } catch {
    /* private mode — still applies for this session */
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** True when step-point figures may show. Every step-point figure reads this. */
export function useStepPointsVisible(): boolean {
  return useSyncExternalStore(subscribe, () => snapshot.stepPoints, () => DEFAULT_POINTS_VISIBILITY.stepPoints)
}

/** Tests: re-read after `localStorage.clear()`. */
export function resetPointsVisibilityForTests(): void {
  snapshot = load()
  for (const listener of listeners) listener()
}
