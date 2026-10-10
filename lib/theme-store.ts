/**
 * lib/theme-store.ts — User-customizable theme colors
 *
 * Points card colors, habit-type icon colors, the chrome warmth shared
 * across every Win95 window, the Bouba/Kiki corner mix, and the photoreal
 * PCB desktop mode (`pcbMode`). `appearanceRev` is bumped on each plate / hue
 * / warmth / corner pick so a late persist-hub rehydrate cannot roll the
 * desktop back. A blob with `appearanceRev` > 0 wins over a stale
 * `brain2-pcb-mode` pin (Electron used to paint the pin back onto the plate
 * on every launch). Drift ticks do not bump the rev. Storage: localStorage
 * today; target MongoDB `themePrefs` collection (§3).
 *
 * Persist **v5**: `chromeFace` is warmth along the design-ref grays
 * (0 olive … 50 classic default … 100 cool silver), not the old lightness
 * set-point. A pre-v5 blob parks warmth at 50.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { nextAppearanceRev } from "@/lib/appearance-rev"
import { createCogsJSONStorage, registerPersistRehydrator } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import {
  CHROME_FACE_DEFAULT_SETPOINT,
  clampChromeFaceSetpoint,
} from "@/lib/chrome-patina"
import { DEFAULT_CORNER_MIX } from "@/lib/corner-mix"
import {
  applyInstant,
  clampDriftPeriod,
  createDriftClock,
  DEFAULT_DRIFT_PERIOD_MS,
  phaseForPosition,
  setDriftPaused,
  setDriftPeriod,
  startDriftTransition,
  type DriftClock,
  type DriftTransition,
} from "@/lib/drift-clock"
import { DEFAULT_PCB_MODE, LEGACY_DEFAULT_PCB_MODE, parsePcbMode, readSessionPcbMode, readStoredPcbMode, writeStoredPcbMode, type PcbMode } from "@/lib/pcb-backdrop"

export interface ThemeColors {
  pointsAllTime: string
  pointsToday: string
  pointsWeek: string
  pointsMonth: string
  habitBoolean: string
  habitGoal: string
  habitText: string
  habitIncremental: string
}

export const DEFAULT_THEME: ThemeColors = {
  pointsAllTime: "#ca8a04",
  pointsToday: "#16a34a",
  pointsWeek: "#2563eb",
  pointsMonth: "#9333ea",
  habitBoolean: "#22c55e",
  habitGoal: "#3b82f6",
  habitText: "#a855f7",
  habitIncremental: "#06b6d4",
}

export const DEFAULT_CHROME_FACE = CHROME_FACE_DEFAULT_SETPOINT

const NEUTRAL_PHASE = phaseForPosition(DEFAULT_CHROME_FACE, "towardHigh")

export const DEFAULT_WARMTH_DRIFT = {
  chromeFace: DEFAULT_CHROME_FACE,
  chromePhase: NEUTRAL_PHASE,
  chromeEpochMs: null,
  chromePeriodMs: DEFAULT_DRIFT_PERIOD_MS,
  chromePaused: false,
  chromeTransition: null as DriftTransition | null,
}

export const DEFAULT_CORNER_DRIFT = {
  cornerMix: DEFAULT_CORNER_MIX,
  cornerPhase: NEUTRAL_PHASE,
  cornerEpochMs: null,
  cornerPeriodMs: DEFAULT_DRIFT_PERIOD_MS,
  cornerPaused: true,
  cornerTransition: null as DriftTransition | null,
}

interface ThemeState {
  colors: ThemeColors
  setColor: (key: keyof ThemeColors, value: string) => void
  resetColors: () => void
  /** Warmth 0–100 along the design-ref grays. 50 is the stored classic default. Anchor at `chromeEpochMs`. */
  chromeFace: number
  chromePhase: number
  chromeEpochMs: number | null
  chromePeriodMs: number
  chromePaused: boolean
  chromeTransition: DriftTransition | null
  setChromeFace: (value: number) => void
  setChromePeriod: (periodMs: number) => void
  setChromePaused: (paused: boolean) => void
  startChromeTransition: (target: number, durationMs: number, reducedMotion?: boolean) => void
  resetChromeFace: () => void
  /** Corner mix 0–100. 0 bouba, 50 the default snapshot, 100 kiki. */
  cornerMix: number
  cornerPhase: number
  cornerEpochMs: number | null
  cornerPeriodMs: number
  cornerPaused: boolean
  cornerTransition: DriftTransition | null
  setCornerMix: (value: number) => void
  setCornerPeriod: (periodMs: number) => void
  setCornerPaused: (paused: boolean) => void
  startCornerTransition: (target: number, durationMs: number, reducedMotion?: boolean) => void
  resetCornerMix: () => void
  /** Photoreal PCB desktop plate behind every window. */
  pcbMode: PcbMode
  setPcbMode: (value: PcbMode) => void
  resetPcbMode: () => void
  /**
   * Bumped on every plate / hue / warmth / corner pick so a late hub rehydrate
   * cannot roll the desktop back to an older snapshot.
   */
  appearanceRev: number
}

export function warmthClock(state: Pick<ThemeState, "chromeFace" | "chromePhase" | "chromeEpochMs" | "chromePeriodMs" | "chromePaused" | "chromeTransition">): DriftClock {
  return createDriftClock({
    anchor: state.chromeFace,
    phase: state.chromePhase,
    epochMs: state.chromeEpochMs,
    periodMs: state.chromePeriodMs,
    paused: state.chromePaused,
    transition: state.chromeTransition,
  })
}

export function cornerClock(state: Pick<ThemeState, "cornerMix" | "cornerPhase" | "cornerEpochMs" | "cornerPeriodMs" | "cornerPaused" | "cornerTransition">): DriftClock {
  return createDriftClock({
    anchor: state.cornerMix,
    phase: state.cornerPhase,
    epochMs: state.cornerEpochMs,
    periodMs: state.cornerPeriodMs,
    paused: state.cornerPaused,
    transition: state.cornerTransition,
  })
}

function warmthFields(clock: DriftClock) {
  return {
    chromeFace: clock.anchor,
    chromePhase: clock.phase,
    chromeEpochMs: clock.epochMs,
    chromePeriodMs: clock.periodMs,
    chromePaused: clock.paused,
    chromeTransition: clock.transition,
  }
}

function cornerFields(clock: DriftClock) {
  return {
    cornerMix: clock.anchor,
    cornerPhase: clock.phase,
    cornerEpochMs: clock.epochMs,
    cornerPeriodMs: clock.periodMs,
    cornerPaused: clock.paused,
    cornerTransition: clock.transition,
  }
}

function readTransition(value: unknown): DriftTransition | null {
  if (!value || typeof value !== "object") return null
  const t = value as Partial<DriftTransition>
  if (
    typeof t.from !== "number" ||
    typeof t.to !== "number" ||
    typeof t.startedAt !== "number" ||
    typeof t.durationMs !== "number"
  ) {
    return null
  }
  return {
    from: clampChromeFaceSetpoint(t.from),
    to: clampChromeFaceSetpoint(t.to),
    startedAt: t.startedAt,
    durationMs: t.durationMs,
  }
}

function readWarmth(raw: Partial<ThemeState>, reset: boolean) {
  if (reset) return { ...DEFAULT_WARMTH_DRIFT }
  return {
    chromeFace: clampChromeFaceSetpoint(
      typeof raw.chromeFace === "number" ? raw.chromeFace : DEFAULT_CHROME_FACE,
    ),
    chromePhase: typeof raw.chromePhase === "number" && Number.isFinite(raw.chromePhase) ? raw.chromePhase : NEUTRAL_PHASE,
    chromeEpochMs: typeof raw.chromeEpochMs === "number" && Number.isFinite(raw.chromeEpochMs) ? raw.chromeEpochMs : null,
    chromePeriodMs: clampDriftPeriod(
      typeof raw.chromePeriodMs === "number" ? raw.chromePeriodMs : DEFAULT_DRIFT_PERIOD_MS,
    ),
    chromePaused: typeof raw.chromePaused === "boolean" ? raw.chromePaused : false,
    chromeTransition: readTransition(raw.chromeTransition),
  }
}

function readCorner(raw: Partial<ThemeState>, reset: boolean) {
  if (reset) return { ...DEFAULT_CORNER_DRIFT }
  return {
    cornerMix: clampChromeFaceSetpoint(typeof raw.cornerMix === "number" ? raw.cornerMix : DEFAULT_CORNER_MIX),
    cornerPhase: typeof raw.cornerPhase === "number" && Number.isFinite(raw.cornerPhase) ? raw.cornerPhase : NEUTRAL_PHASE,
    cornerEpochMs: typeof raw.cornerEpochMs === "number" && Number.isFinite(raw.cornerEpochMs) ? raw.cornerEpochMs : null,
    cornerPeriodMs: clampDriftPeriod(
      typeof raw.cornerPeriodMs === "number" ? raw.cornerPeriodMs : DEFAULT_DRIFT_PERIOD_MS,
    ),
    cornerPaused: typeof raw.cornerPaused === "boolean" ? raw.cornerPaused : true,
    cornerTransition: readTransition(raw.cornerTransition),
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      colors: DEFAULT_THEME,
      appearanceRev: 0,
      setColor: (key, value) =>
        set((state) => ({
          colors: { ...state.colors, [key]: value },
          appearanceRev: nextAppearanceRev(state.appearanceRev),
        })),
      resetColors: () =>
        set((state) => ({ colors: DEFAULT_THEME, appearanceRev: nextAppearanceRev(state.appearanceRev) })),
      ...DEFAULT_WARMTH_DRIFT,
      setChromeFace: (value) =>
        set((state) => ({
          ...warmthFields(applyInstant(warmthClock(state), value, Date.now())),
          appearanceRev: nextAppearanceRev(state.appearanceRev),
        })),
      setChromePeriod: (periodMs) =>
        set((state) => ({
          ...warmthFields(setDriftPeriod(warmthClock(state), periodMs, Date.now())),
          appearanceRev: nextAppearanceRev(state.appearanceRev),
        })),
      setChromePaused: (paused) =>
        set((state) => ({
          ...warmthFields(setDriftPaused(warmthClock(state), paused, Date.now())),
          appearanceRev: nextAppearanceRev(state.appearanceRev),
        })),
      startChromeTransition: (target, durationMs, reducedMotion = false) =>
        set((state) => ({
          ...warmthFields(startDriftTransition(warmthClock(state), target, durationMs, Date.now(), reducedMotion)),
          appearanceRev: nextAppearanceRev(state.appearanceRev),
        })),
      resetChromeFace: () =>
        set((state) => {
          const now = Date.now()
          const parked = setDriftPaused(applyInstant(warmthClock(state), DEFAULT_CHROME_FACE, now), true, now)
          return {
            ...warmthFields(parked),
            appearanceRev: nextAppearanceRev(state.appearanceRev),
          }
        }),
      ...DEFAULT_CORNER_DRIFT,
      setCornerMix: (value) =>
        set((state) => ({
          ...cornerFields(applyInstant(cornerClock(state), value, Date.now())),
          appearanceRev: nextAppearanceRev(state.appearanceRev),
        })),
      setCornerPeriod: (periodMs) =>
        set((state) => ({
          ...cornerFields(setDriftPeriod(cornerClock(state), periodMs, Date.now())),
          appearanceRev: nextAppearanceRev(state.appearanceRev),
        })),
      setCornerPaused: (paused) =>
        set((state) => ({
          ...cornerFields(setDriftPaused(cornerClock(state), paused, Date.now())),
          appearanceRev: nextAppearanceRev(state.appearanceRev),
        })),
      startCornerTransition: (target, durationMs, reducedMotion = false) =>
        set((state) => ({
          ...cornerFields(startDriftTransition(cornerClock(state), target, durationMs, Date.now(), reducedMotion)),
          appearanceRev: nextAppearanceRev(state.appearanceRev),
        })),
      resetCornerMix: () =>
        set((state) => {
          const now = Date.now()
          const parked = setDriftPaused(applyInstant(cornerClock(state), DEFAULT_CORNER_MIX, now), true, now)
          return {
            ...cornerFields(parked),
            appearanceRev: nextAppearanceRev(state.appearanceRev),
          }
        }),
      pcbMode: DEFAULT_PCB_MODE,
      setPcbMode: (value) =>
        set((state) => ({
          pcbMode: writeStoredPcbMode(value),
          appearanceRev: nextAppearanceRev(state.appearanceRev),
        })),
      resetPcbMode: () =>
        set((state) => ({
          pcbMode: writeStoredPcbMode(DEFAULT_PCB_MODE),
          appearanceRev: nextAppearanceRev(state.appearanceRev),
        })),
    }),
    {
      name: persistKey("theme-store"),
      version: 5,
      storage: createCogsJSONStorage(),
      migrate: (state, version) => {
        const prev = (state ?? {}) as Partial<ThemeState>
        const pinned = readStoredPcbMode()
        const fromBlob =
          prev.pcbMode != null
            ? parsePcbMode(prev.pcbMode)
            : version < 4
              ? LEGACY_DEFAULT_PCB_MODE
              : DEFAULT_PCB_MODE
        const resetAxis = version < 5
        return {
          ...prev,
          colors: { ...DEFAULT_THEME, ...prev.colors },
          ...readWarmth(prev, resetAxis),
          ...readCorner(prev, resetAxis),
          pcbMode:
            typeof prev.appearanceRev === "number" && prev.appearanceRev > 0
              ? fromBlob
              : pinned ?? fromBlob,
          appearanceRev: typeof prev.appearanceRev === "number" ? prev.appearanceRev : 0,
        } as ThemeState
      },
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ThemeState>
        const liveRev = typeof current.appearanceRev === "number" ? current.appearanceRev : 0
        const persistedRev = typeof p.appearanceRev === "number" ? p.appearanceRev : 0
        const keepLive = liveRev > persistedRev
        const session = readSessionPcbMode()
        const pinned = readStoredPcbMode()
        const fromDisk = keepLive
          ? current.pcbMode
          : p.pcbMode != null
            ? parsePcbMode(p.pcbMode)
            : current.pcbMode
        const warmth = keepLive ? readWarmth(current, false) : readWarmth(p, false)
        const corner = keepLive ? readCorner(current, false) : readCorner(p, false)
        return {
          ...current,
          ...p,
          appearanceRev: Math.max(liveRev, persistedRev),
          colors: keepLive ? current.colors : { ...current.colors, ...p.colors },
          ...warmth,
          ...corner,
          pcbMode: session ?? (keepLive ? current.pcbMode : persistedRev > 0 ? fromDisk : (pinned ?? fromDisk)),
        }
      },
      partialize: (state) => ({
        colors: state.colors,
        chromeFace: state.chromeFace,
        chromePhase: state.chromePhase,
        chromeEpochMs: state.chromeEpochMs,
        chromePeriodMs: state.chromePeriodMs,
        chromePaused: state.chromePaused,
        chromeTransition: state.chromeTransition,
        cornerMix: state.cornerMix,
        cornerPhase: state.cornerPhase,
        cornerEpochMs: state.cornerEpochMs,
        cornerPeriodMs: state.cornerPeriodMs,
        cornerPaused: state.cornerPaused,
        cornerTransition: state.cornerTransition,
        pcbMode: state.pcbMode,
        appearanceRev: state.appearanceRev,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const session = readSessionPcbMode()
        if (session) {
          if (state.pcbMode !== session) {
            queueMicrotask(() => useThemeStore.setState({ pcbMode: session }))
          }
          writeStoredPcbMode(session, { session: false })
          return
        }
        const rev = typeof state.appearanceRev === "number" ? state.appearanceRev : 0
        if (rev > 0) {
          writeStoredPcbMode(state.pcbMode, { session: false })
          return
        }
        const pinned = readStoredPcbMode()
        if (pinned) {
          if (state.pcbMode !== pinned) {
            queueMicrotask(() => useThemeStore.setState({ pcbMode: pinned }))
          }
          return
        }
        writeStoredPcbMode(state.pcbMode, { session: false })
      },
    },
  ),
)

registerPersistRehydrator(persistKey("theme-store"), () => useThemeStore.persist.rehydrate())
