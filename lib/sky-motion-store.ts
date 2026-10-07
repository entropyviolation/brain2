/**
 * lib/sky-motion-store.ts — Saved Moon-chart zoom and time rate
 *
 * View width is log10 kilometres across a 1,000 px view. Time rate is an
 * index into the real-time → one-year-per-second scale. Reset restores real
 * time and leaves the view width. Storage: `brain2-sky-motion` (persist v1).
 * Included in the Settings full backup.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import {
  clampRateIndex,
  clampViewWidthLog,
  DEFAULT_RATE_INDEX,
  DEFAULT_VIEW_WIDTH_LOG,
} from "@/lib/sky-motion"

export const SKY_MOTION_STORAGE_KEY = persistKey("sky-motion")

export type SkyMotionSettings = {
  viewWidthLog: number
  rateIndex: number
}

export const DEFAULT_SKY_MOTION: SkyMotionSettings = {
  viewWidthLog: DEFAULT_VIEW_WIDTH_LOG,
  rateIndex: DEFAULT_RATE_INDEX,
}

export function sanitizeSkyMotion(value: unknown): SkyMotionSettings {
  const raw = value && typeof value === "object" ? (value as Partial<SkyMotionSettings>) : {}
  return {
    viewWidthLog: clampViewWidthLog(raw.viewWidthLog),
    rateIndex: clampRateIndex(raw.rateIndex),
  }
}

interface SkyMotionState extends SkyMotionSettings {
  setViewWidthLog: (value: number) => void
  setRateIndex: (value: number) => void
  /** Back to real-time physics. The view width stays. */
  resetTimeRate: () => void
}

export const useSkyMotionStore = create<SkyMotionState>()(
  persist(
    (set) => ({
      ...DEFAULT_SKY_MOTION,
      setViewWidthLog: (value) => set({ viewWidthLog: clampViewWidthLog(value) }),
      setRateIndex: (value) => set({ rateIndex: clampRateIndex(value) }),
      resetTimeRate: () => set({ rateIndex: DEFAULT_RATE_INDEX }),
    }),
    {
      name: SKY_MOTION_STORAGE_KEY,
      version: 1,
      storage: createCogsJSONStorage(),
      partialize: (state) => ({
        viewWidthLog: state.viewWidthLog,
        rateIndex: state.rateIndex,
      }),
      migrate: (persisted) => sanitizeSkyMotion(persisted),
      merge: (persisted, current) => ({
        ...current,
        ...sanitizeSkyMotion(persisted),
      }),
    },
  ),
)
