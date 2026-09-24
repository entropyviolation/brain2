/**
 * lib/theme-store.ts — User-customizable theme colors
 *
 * Points card colors, habit-type icon colors, the chrome face gray
 * set-point shared across every Win95 window, and the photoreal PCB
 * desktop mode (`pcbMode`). `appearanceRev` is bumped on each plate / hue
 * pick so a late persist-hub rehydrate cannot roll the desktop back. A blob
 * with `appearanceRev` > 0 wins over a stale `brain2-pcb-mode` pin (Electron
 * used to paint the pin back onto the plate on every launch). Storage:
 * localStorage today; target MongoDB `themePrefs` collection (§3).
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

interface ThemeState {
  colors: ThemeColors
  setColor: (key: keyof ThemeColors, value: string) => void
  resetColors: () => void
  /** 0–100 gunmetal set-point. 50 is classic Win95 `#c0c0c0`. */
  chromeFace: number
  setChromeFace: (value: number) => void
  resetChromeFace: () => void
  /** Photoreal PCB desktop plate behind every window. */
  pcbMode: PcbMode
  setPcbMode: (value: PcbMode) => void
  resetPcbMode: () => void
  /**
   * Bumped on every plate / hue pick so a late hub rehydrate cannot roll
   * the desktop back to an older snapshot.
   */
  appearanceRev: number
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
      chromeFace: DEFAULT_CHROME_FACE,
      setChromeFace: (value) =>
        set((state) => ({
          chromeFace: clampChromeFaceSetpoint(value),
          appearanceRev: nextAppearanceRev(state.appearanceRev),
        })),
      resetChromeFace: () =>
        set((state) => ({
          chromeFace: DEFAULT_CHROME_FACE,
          appearanceRev: nextAppearanceRev(state.appearanceRev),
        })),
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
      version: 4,
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
        return {
          ...prev,
          colors: { ...DEFAULT_THEME, ...prev.colors },
          chromeFace: clampChromeFaceSetpoint(
            typeof prev.chromeFace === "number" ? prev.chromeFace : DEFAULT_CHROME_FACE,
          ),
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
        return {
          ...current,
          ...p,
          appearanceRev: Math.max(liveRev, persistedRev),
          colors: keepLive ? current.colors : { ...current.colors, ...p.colors },
          chromeFace: keepLive
            ? current.chromeFace
            : typeof p.chromeFace === "number"
              ? clampChromeFaceSetpoint(p.chromeFace)
              : current.chromeFace,
          pcbMode: session ?? (keepLive ? current.pcbMode : persistedRev > 0 ? fromDisk : (pinned ?? fromDisk)),
        }
      },
      partialize: (state) => ({
        colors: state.colors,
        chromeFace: state.chromeFace,
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
