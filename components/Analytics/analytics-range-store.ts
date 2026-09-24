/**
 * components/Analytics/analytics-range-store.ts — Remembered Analytics window
 *
 * Tiny client store so every Analytics tab reads the same rolling or custom
 * range. First paint uses the default (SSR-safe); a layout effect restores the
 * last picked window from localStorage. Custom from–to is inclusive local dates.
 */
"use client"

import { useLayoutEffect, useMemo } from "react"
import { create } from "zustand"
import { recentDateKeys } from "@/lib/tracking-summary"
import {
  ANALYTICS_RANGE_DAYS,
  DEFAULT_ANALYTICS_RANGE,
  customRangeCaption,
  customRangeLabel,
  dateKeysInclusive,
  namedPeriodWindow,
  rangeLabel,
  rangeWindowCaption,
  readStoredAnalyticsRange,
  writeStoredAnalyticsRange,
  writeStoredCustomRange,
  type AnalyticsRangeDays,
  type AnalyticsRangeMode,
  type NamedAnalyticsPeriod,
} from "./analytics-range"

interface AnalyticsRangeState {
  mode: AnalyticsRangeMode
  days: number
  fromKey: string | null
  toKey: string | null
  hydrated: boolean
  setDays: (days: AnalyticsRangeDays) => void
  setCustomRange: (from: string, to: string) => void
  setNamedPeriod: (period: NamedAnalyticsPeriod) => void
  hydrate: () => void
}

export const useAnalyticsRangeStore = create<AnalyticsRangeState>((set) => ({
  mode: "preset",
  days: DEFAULT_ANALYTICS_RANGE,
  fromKey: null,
  toKey: null,
  hydrated: false,
  setDays: (days) => {
    writeStoredAnalyticsRange(days)
    set({ mode: "preset", days, fromKey: null, toKey: null, hydrated: true })
  },
  setCustomRange: (from, to) => {
    const keys = dateKeysInclusive(from, to)
    if (keys.length === 0) return
    writeStoredCustomRange(keys[0], keys[keys.length - 1])
    set({
      mode: "custom",
      days: keys.length,
      fromKey: keys[0],
      toKey: keys[keys.length - 1],
      hydrated: true,
    })
  },
  setNamedPeriod: (period) => {
    const { from, to } = namedPeriodWindow(period)
    const keys = dateKeysInclusive(from, to)
    if (keys.length === 0) return
    writeStoredCustomRange(keys[0], keys[keys.length - 1])
    set({
      mode: "custom",
      days: keys.length,
      fromKey: keys[0],
      toKey: keys[keys.length - 1],
      hydrated: true,
    })
  },
  hydrate: () => {
    set((s) => {
      if (s.hydrated) return s
      const stored = readStoredAnalyticsRange()
      if (stored.mode === "custom") {
        const keys = dateKeysInclusive(stored.from, stored.to)
        if (keys.length === 0) {
          return { days: DEFAULT_ANALYTICS_RANGE, mode: "preset" as const, fromKey: null, toKey: null, hydrated: true }
        }
        return {
          mode: "custom" as const,
          days: keys.length,
          fromKey: keys[0],
          toKey: keys[keys.length - 1],
          hydrated: true,
        }
      }
      return { mode: "preset" as const, days: stored.days, fromKey: null, toKey: null, hydrated: true }
    })
  },
}))

export function useAnalyticsRange() {
  const mode = useAnalyticsRangeStore((s) => s.mode)
  const days = useAnalyticsRangeStore((s) => s.days)
  const fromKey = useAnalyticsRangeStore((s) => s.fromKey)
  const toKey = useAnalyticsRangeStore((s) => s.toKey)
  const setDays = useAnalyticsRangeStore((s) => s.setDays)
  const setCustomRange = useAnalyticsRangeStore((s) => s.setCustomRange)
  const setNamedPeriod = useAnalyticsRangeStore((s) => s.setNamedPeriod)
  const hydrate = useAnalyticsRangeStore((s) => s.hydrate)

  useLayoutEffect(() => {
    hydrate()
  }, [hydrate])

  const dateKeys = useMemo(() => {
    if (mode === "custom" && fromKey && toKey) return dateKeysInclusive(fromKey, toKey)
    return recentDateKeys(isAnalyticsPreset(days) ? days : DEFAULT_ANALYTICS_RANGE)
  }, [mode, days, fromKey, toKey])
  const keySet = useMemo(() => new Set(dateKeys), [dateKeys])
  const windowDays = dateKeys.length
  const label =
    mode === "custom" && fromKey && toKey ? customRangeLabel(fromKey, toKey) : rangeLabel(windowDays)
  const caption =
    mode === "custom" && fromKey && toKey
      ? customRangeCaption(fromKey, toKey)
      : rangeWindowCaption(windowDays)

  return {
    mode,
    days: windowDays,
    fromKey: dateKeys[0] ?? fromKey,
    toKey: dateKeys[dateKeys.length - 1] ?? toKey,
    setDays,
    setCustomRange,
    setNamedPeriod,
    presets: ANALYTICS_RANGE_DAYS,
    dateKeys,
    keySet,
    label,
    caption,
  }
}

function isAnalyticsPreset(days: number): days is AnalyticsRangeDays {
  return (ANALYTICS_RANGE_DAYS as readonly number[]).includes(days)
}
