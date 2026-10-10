/**
 * lib/drift-clock.ts — One pole-to-pole clock for warmth and Bouba/Kiki
 *
 * A full cycle is the current pole, the opposite pole, and back (`periodMs`).
 * `phase` at `epochMs` is the position on that cycle and which way it is
 * heading. Pause freezes the phase. A manual transition lerps a settings-panel
 * preview, while the rest of the app holds `transition.from`. When the
 * interval ends, the phase parks on the target and this period takes over.
 * The transition does not replace `periodMs`. `epochMs` of 0 means "not
 * stamped yet"; the painter stamps now so a fresh load starts at the anchor
 * instead of years of wrapped phase.
 */

export const DRIFT_MIN_MS = 1000
/** Ten 365-day years. Keeps the phase division finite. */
export const DRIFT_MAX_MS = 10 * 365 * 24 * 60 * 60 * 1000

export const DRIFT_PRESET_MS = {
  "1w": 7 * 24 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "1m": 60 * 1000,
  "30s": 30 * 1000,
} as const

export type DriftPresetId = "1w" | "1d" | "hours" | "1m" | "30s" | "custom"

export type DriftUnit = "seconds" | "minutes" | "hours" | "days" | "weeks"

export const DRIFT_UNIT_MS: Record<DriftUnit, number> = {
  seconds: 1000,
  minutes: 60 * 1000,
  hours: 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
  weeks: 7 * 24 * 60 * 60 * 1000,
}

export const DEFAULT_DRIFT_PERIOD_MS = DRIFT_PRESET_MS["1d"]

export type DriftDirection = "towardHigh" | "towardLow"

export type DriftTransition = {
  from: number
  to: number
  startedAt: number
  durationMs: number
}

export type DriftClock = {
  /** 0–100 position at `epochMs`. 0 is the low pole, 100 the high pole. */
  anchor: number
  /** Cycle phase in [0, 1) at `epochMs`. */
  phase: number
  /** `null` until the painter stamps the first real clock. `0` is a real epoch. */
  epochMs: number | null
  periodMs: number
  paused: boolean
  transition: DriftTransition | null
}

export function clampDriftPosition(value: number): number {
  if (!Number.isFinite(value)) return 50
  return Math.min(100, Math.max(0, value))
}

export function clampDriftPeriod(ms: number): number {
  if (!Number.isFinite(ms)) return DEFAULT_DRIFT_PERIOD_MS
  return Math.min(DRIFT_MAX_MS, Math.max(DRIFT_MIN_MS, ms))
}

export function periodFromAmount(amount: number, unit: DriftUnit): number {
  if (!Number.isFinite(amount) || amount <= 0) return DRIFT_MIN_MS
  return clampDriftPeriod(amount * DRIFT_UNIT_MS[unit])
}

/** Preset id for a stored period. Week and day win over a raw hour count. */
export function matchDriftPreset(periodMs: number): DriftPresetId {
  if (periodMs === DRIFT_PRESET_MS["1w"]) return "1w"
  if (periodMs === DRIFT_PRESET_MS["1d"]) return "1d"
  if (periodMs === DRIFT_PRESET_MS["1m"]) return "1m"
  if (periodMs === DRIFT_PRESET_MS["30s"]) return "30s"
  if (periodMs >= DRIFT_UNIT_MS.hours && periodMs % DRIFT_UNIT_MS.hours === 0) return "hours"
  return "custom"
}

export function splitPeriod(periodMs: number): { value: number; unit: DriftUnit } {
  const ms = clampDriftPeriod(periodMs)
  for (const unit of ["weeks", "days", "hours", "minutes", "seconds"] as const) {
    const unitMs = DRIFT_UNIT_MS[unit]
    if (ms % unitMs === 0) return { value: ms / unitMs, unit }
  }
  return { value: ms / DRIFT_UNIT_MS.seconds, unit: "seconds" }
}

export function mod1(value: number): number {
  if (!Number.isFinite(value)) return 0
  const wrapped = value % 1
  return wrapped < 0 ? wrapped + 1 : wrapped
}

/** 0 at phase 0, 100 at phase 0.5, 0 again at phase 1. */
export function positionFromPhase(phase: number): number {
  const p = mod1(phase)
  return ((1 - Math.cos(2 * Math.PI * p)) / 2) * 100
}

export function directionOfPhase(phase: number): DriftDirection {
  return mod1(phase) < 0.5 ? "towardHigh" : "towardLow"
}

/** Phase on the half of the cycle that matches `direction`. */
export function phaseForPosition(position: number, direction: DriftDirection): number {
  const p = clampDriftPosition(position) / 100
  const rising = Math.acos(Math.min(1, Math.max(-1, 1 - 2 * p))) / (2 * Math.PI)
  if (direction === "towardHigh") return rising
  return mod1(1 - rising)
}

export function createDriftClock(partial?: Partial<DriftClock>): DriftClock {
  const anchor = clampDriftPosition(partial?.anchor ?? 50)
  return {
    anchor,
    phase: partial?.phase ?? phaseForPosition(anchor, "towardHigh"),
    epochMs: partial?.epochMs === undefined ? null : partial.epochMs,
    periodMs: clampDriftPeriod(partial?.periodMs ?? DEFAULT_DRIFT_PERIOD_MS),
    paused: partial?.paused ?? false,
    transition: partial?.transition ?? null,
  }
}

function transitionEnd(transition: DriftTransition): number {
  return transition.startedAt + transition.durationMs
}

/**
 * Stamp a missing epoch, and when a manual shift has finished, park the phase
 * on the target so the stored period takes over. Returns the same clock when
 * nothing changed.
 */
export function settleDrift(clock: DriftClock, nowMs: number): DriftClock {
  let next = clock
  if (next.epochMs == null) next = { ...next, epochMs: nowMs }
  const transition = next.transition
  if (transition && nowMs >= transitionEnd(transition)) {
    const direction = directionOfPhase(next.phase)
    const anchor = clampDriftPosition(transition.to)
    next = {
      ...next,
      anchor,
      phase: phaseForPosition(anchor, direction),
      epochMs: transitionEnd(transition),
      transition: null,
    }
  }
  return next
}

export function livePhase(clock: DriftClock, nowMs: number): number {
  const settled = settleDrift(clock, nowMs)
  if (settled.transition || settled.paused) return mod1(settled.phase)
  const period = clampDriftPeriod(settled.periodMs)
  const epoch = settled.epochMs ?? nowMs
  return mod1(settled.phase + (nowMs - epoch) / period)
}

/**
 * Settings-panel position. An in-flight manual shift lerps here.
 * The rest of the app uses `appDriftPosition` and stays on `from` until the
 * interval ends.
 */
export function driftPosition(clock: DriftClock, nowMs: number): number {
  const settled = settleDrift(clock, nowMs)
  const transition = settled.transition
  if (transition) {
    const span = transition.durationMs
    const u = span > 0 ? (nowMs - transition.startedAt) / span : 1
    const t = Math.min(1, Math.max(0, u))
    return transition.from + (transition.to - transition.from) * t
  }
  return positionFromPhase(livePhase(settled, nowMs))
}

/**
 * Position painted on the rest of the app. During a timed shift this stays
 * at the previous state (`transition.from`). When the interval ends,
 * `settleDrift` has parked the phase on the target, so this returns that
 * new state and drift continues.
 */
export function appDriftPosition(clock: DriftClock, nowMs: number): number {
  const settled = settleDrift(clock, nowMs)
  const transition = settled.transition
  if (transition && nowMs < transition.startedAt + transition.durationMs) return transition.from
  return driftPosition(settled, nowMs)
}

export function applyInstant(clock: DriftClock, target: number, nowMs: number): DriftClock {
  const settled = settleDrift(clock, nowMs)
  const direction = directionOfPhase(settled.transition ? settled.phase : livePhase(settled, nowMs))
  const anchor = clampDriftPosition(target)
  return {
    ...settled,
    anchor,
    phase: phaseForPosition(anchor, direction),
    epochMs: nowMs,
    transition: null,
  }
}

/**
 * Begin a timed shift toward `target`. The panel lerps; the app holds
 * `from`. A shift already in flight keeps that hold, so a second Start does
 * not publish the in-between. Reduced motion, or a duration under the
 * minimum, jumps to the end and that end state is the whole app.
 * `periodMs` is left alone.
 */
export function startDriftTransition(
  clock: DriftClock,
  target: number,
  durationMs: number,
  nowMs: number,
  reducedMotion = false,
): DriftClock {
  const settled = settleDrift(clock, nowMs)
  const displayed = driftPosition(settled, nowMs)
  const from = settled.transition ? settled.transition.from : displayed
  const to = clampDriftPosition(target)
  if (reducedMotion || !(durationMs >= DRIFT_MIN_MS)) return applyInstant(clock, to, nowMs)
  const phase = settled.transition ? phaseForPosition(from, directionOfPhase(settled.phase)) : livePhase(settled, nowMs)
  return {
    ...settled,
    anchor: from,
    phase,
    epochMs: nowMs,
    transition: { from, to, startedAt: nowMs, durationMs: clampDriftPeriod(durationMs) },
    periodMs: settled.periodMs,
  }
}

export function setDriftPaused(clock: DriftClock, paused: boolean, nowMs: number): DriftClock {
  const settled = settleDrift(clock, nowMs)
  if (settled.transition && nowMs < transitionEnd(settled.transition)) {
    return { ...settled, paused }
  }
  const position = driftPosition(settled, nowMs)
  const anchor = Math.abs(position - settled.anchor) < 1e-4 ? settled.anchor : position
  return {
    ...settled,
    paused,
    anchor,
    phase: livePhase(settled, nowMs),
    epochMs: nowMs,
    transition: null,
  }
}

/** Change the cycle length without jumping the displayed position. */
export function setDriftPeriod(clock: DriftClock, periodMs: number, nowMs: number): DriftClock {
  const settled = settleDrift(clock, nowMs)
  const period = clampDriftPeriod(periodMs)
  if (settled.transition && nowMs < transitionEnd(settled.transition)) {
    return { ...settled, periodMs: period }
  }
  const position = driftPosition(settled, nowMs)
  return {
    ...settled,
    periodMs: period,
    anchor: position,
    phase: livePhase(settled, nowMs),
    epochMs: nowMs,
  }
}
