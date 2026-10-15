/**
 * components/Lists/lib/list-icon-fling-juice.ts — light grab / fling ghost trail helpers
 *
 * Optional juice for freeform icon drag. Does not own pointer capture — callers
 * push samples while dragging and paint via ListIconFlingGhostLayer (or own DOM).
 */

export const FLING_JUICE = {
  /** Max ghost samples kept in the ring. */
  MAX_SAMPLES: 8,
  /** Drop samples older than this (ms). */
  MAX_AGE_MS: 220,
  /** Min distance (px) between accepted samples. */
  MIN_STEP: 10,
  GRAB_CLASS: "fm-fling-grab",
  GRABBING_CLASS: "fm-fling-grabbing",
} as const

export type FlingGhostSample = {
  x: number
  y: number
  t: number
}

/** Append a sample if it moved far enough; trim by count and age. */
export function pushFlingSample(
  trail: FlingGhostSample[],
  x: number,
  y: number,
  t: number,
  opts?: { maxSamples?: number; maxAgeMs?: number; minStep?: number },
): FlingGhostSample[] {
  const maxSamples = opts?.maxSamples ?? FLING_JUICE.MAX_SAMPLES
  const maxAgeMs = opts?.maxAgeMs ?? FLING_JUICE.MAX_AGE_MS
  const minStep = opts?.minStep ?? FLING_JUICE.MIN_STEP
  const last = trail[trail.length - 1]
  if (last && Math.hypot(x - last.x, y - last.y) < minStep) {
    return pruneFlingTrail(trail, t, maxAgeMs, maxSamples)
  }
  const next = [...trail, { x, y, t }]
  return pruneFlingTrail(next, t, maxAgeMs, maxSamples)
}

export function pruneFlingTrail(
  trail: readonly FlingGhostSample[],
  now: number,
  maxAgeMs: number = FLING_JUICE.MAX_AGE_MS,
  maxSamples: number = FLING_JUICE.MAX_SAMPLES,
): FlingGhostSample[] {
  const kept = trail.filter((s) => now - s.t <= maxAgeMs)
  if (kept.length <= maxSamples) return kept
  return kept.slice(kept.length - maxSamples)
}

/** Opacity 1 → 0 over maxAgeMs (older samples fade). */
export function flingGhostOpacity(
  sample: FlingGhostSample,
  now: number,
  maxAgeMs: number = FLING_JUICE.MAX_AGE_MS,
): number {
  const age = now - sample.t
  if (age <= 0) return 0.55
  if (age >= maxAgeMs) return 0
  return 0.55 * (1 - age / maxAgeMs)
}

export function prefersFlingJuiceReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  } catch {
    return false
  }
}
