/**
 * components/Analytics/analytics-range-store.ts — Remembered Analytics window
 *
 * Tiny client store so every Analytics tab reads the same rolling or custom
 * range. First paint uses the default (SSR-safe); a layout effect restores the
 * last picked window from localStorage. Custom from–to is inclusive local dates.
 * Prev/next steps that window by length or by named week/month/season unit.
 */
"use client"

import { useLayoutEffect, useMemo } from "react"
import { create } from "zustand"
import { recentDateKeys } from "@/lib/tracking-summary"
import {
  ANALYTICS_RANGE_DAYS,
  DEFAULT_ANALYTICS_RANGE,
  analyticsWindowUnit,
  customRangeCaption,
  customRangeLabel,
  dateKeysInclusive,
  namedPeriodToWindowUnit,
  namedPeriodWindow,
  rangeLabel,
  rangeWindowCaption,
  readStoredAnalyticsRange,
  stepAnalyticsWindow,
  writeStoredAnalyticsRange,
  writeStoredCustomRange,
  type AnalyticsRangeDays,
  type AnalyticsRangeMode,
  type AnalyticsWindowUnit,
  type NamedAnalyticsPeriod,
} from "./analytics-range"

interface AnalyticsRangeState {
  mode: AnalyticsRangeMode
  days: number
  fromKey: string | null
  toKey: string | null
  /** Calendar unit for prev/next when set via This week/month/season; null = day length. */
  stepUnit: AnalyticsWindowUnit | null
  hydrated: boolean
  setDays: (days: AnalyticsRangeDays) => void
  setCustomRange: (from: string, to: string) => void
  setNamedPeriod: (period: NamedAnalyticsPeriod) => void
  stepPeriod: (direction: -1 | 1) => void
  hydrate: () => void
}

function applyCustom(
  from: string,
  to: string,
  stepUnit: AnalyticsWindowUnit | null,
): Pick<AnalyticsRangeState, "mode" | "days" | "fromKey" | "toKey" | "stepUnit" | "hydrated"> | null {
  const keys = dateKeysInclusive(from, to)
  if (keys.length === 0) return null
  writeStoredCustomRange(keys[0], keys[keys.length - 1])
  return {
    mode: "custom",
    days: keys.length,
    fromKey: keys[0],
    toKey: keys[keys.length - 1],
    stepUnit,
    hydrated: true,
  }
}

export const useAnalyticsRangeStore = create<AnalyticsRangeState>((set, get) => ({
  mode: "preset",
  days: DEFAULT_ANALYTICS_RANGE,
  fromKey: null,
  toKey: null,
  stepUnit: null,
  hydrated: false,
  setDays: (days) => {
    writeStoredAnalyticsRange(days)
    set({ mode: "preset", days, fromKey: null, toKey: null, stepUnit: null, hydrated: true })
  },
  setCustomRange: (from, to) => {
    const next = applyCustom(from, to, null)
    if (next) set(next)
  },
  setNamedPeriod: (period) => {
    const { from, to } = namedPeriodWindow(period)
    const next = applyCustom(from, to, namedPeriodToWindowUnit(period))
    if (next) set(next)
  },
  stepPeriod: (direction) => {
    const state = get()
    let from: string
    let to: string
    if (state.mode === "custom" && state.fromKey && state.toKey) {
      from = state.fromKey
      to = state.toKey
    } else {
      const keys = recentDateKeys(isAnalyticsPreset(state.days) ? state.days : DEFAULT_ANALYTICS_RANGE)
      if (keys.length === 0) return
      from = keys[0]
      to = keys[keys.length - 1]
    }
    const unit = state.stepUnit
    const stepped = stepAnalyticsWindow(from, to, direction, new Date(), unit)
    if (!stepped) return
    const keptUnit = unit ?? analyticsWindowUnit(from, to)
    const next = applyCustom(stepped.from, stepped.to, keptUnit === "days" ? null : keptUnit)
    if (next) set(next)
  },
  hydrate: () => {
    set((s) => {
      if (s.hydrated) return s
      const stored = readStoredAnalyticsRange()
      if (stored.mode === "custom") {
        const keys = dateKeysInclusive(stored.from, stored.to)
        if (keys.length === 0) {
          return {
            days: DEFAULT_ANALYTICS_RANGE,
            mode: "preset" as const,
            fromKey: null,
            toKey: null,
            stepUnit: null,
            hydrated: true,
          }
        }
        return {
          mode: "custom" as const,
          days: keys.length,
          fromKey: keys[0],
          toKey: keys[keys.length - 1],
          stepUnit: null,
          hydrated: true,
        }
      }
      return {
        mode: "preset" as const,
        days: stored.days,
        fromKey: null,
        toKey: null,
        stepUnit: null,
        hydrated: true,
      }
    })
  },
}))

export function useAnalyticsRange() {
  const mode = useAnalyticsRangeStore((s) => s.mode)
  const days = useAnalyticsRangeStore((s) => s.days)
  const fromKey = useAnalyticsRangeStore((s) => s.fromKey)
  const toKey = useAnalyticsRangeStore((s) => s.toKey)
  const stepUnit = useAnalyticsRangeStore((s) => s.stepUnit)
  const setDays = useAnalyticsRangeStore((s) => s.setDays)
  const setCustomRange = useAnalyticsRangeStore((s) => s.setCustomRange)
  const setNamedPeriod = useAnalyticsRangeStore((s) => s.setNamedPeriod)
  const stepPeriod = useAnalyticsRangeStore((s) => s.stepPeriod)
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

  const resolvedFrom = dateKeys[0] ?? fromKey
  const resolvedTo = dateKeys[dateKeys.length - 1] ?? toKey
  const canStepNext =
    resolvedFrom != null &&
    resolvedTo != null &&
    stepAnalyticsWindow(resolvedFrom, resolvedTo, 1, new Date(), stepUnit) != null

  return {
    mode,
    days: windowDays,
    fromKey: resolvedFrom,
    toKey: resolvedTo,
    stepUnit,
    setDays,
    setCustomRange,
    setNamedPeriod,
    stepPeriod,
    canStepNext,
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
