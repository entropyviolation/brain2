/**
 * lib/metrics-store.ts — Core wellbeing metrics (Brain2 #137/#138/#275)
 *
 * A standalone, persisted Zustand store for the user's self-reported wellbeing
 * metrics. Unlike the old arbitrary-metric model, this tracks a FIXED set of
 * five subjective metrics on a 0–100 scale — joy, suffering, alignment,
 * self-satisfaction and situational satisfaction — captured together as a single
 * timestamped **datapoint**.
 *
 * A `MetricDatapoint` is one snapshot:
 *  - `at`     — local datetime to the minute (back-loggable: the user can record
 *               readings for an earlier moment),
 *  - `values` — any subset of the five core metrics (each clamped 0–100),
 *  - `context`/`details` — free-text annotations for the datapoint.
 *
 * The Metrics analytics views read derived per-metric series via `seriesFor`, so
 * the same data drives both visualisation (trends over time) and future
 * calculations / prediction engines (each datapoint is a labelled observation).
 *
 * Storage mirrors `lib/modules-store.ts`: localStorage via zustand `persist`
 * under `cogs-metrics-store`. Target: a future MongoDB `metrics` collection.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { SeriesPoint } from "@/lib/metrics"

/** The five core wellbeing metrics, all reported on a 0–100 scale. */
export type MetricKey = "joy" | "suffering" | "alignment" | "selfSatisfaction" | "situationalSatisfaction"

export interface MetricDefinition {
  key: MetricKey
  name: string
  description: string
  /** Inclusive bounds for the scale (always 0–100 for these metrics). */
  min: number
  max: number
  /** Badge/chart color (hex). */
  color: string
}

/** Canonical, ordered list of the tracked metrics. */
export const METRIC_DEFINITIONS: MetricDefinition[] = [
  {
    key: "joy",
    name: "Joy",
    description: "Felt positive affect — delight, enthusiasm, contentment.",
    min: 0,
    max: 100,
    color: "#a3863f",
  },
  {
    key: "suffering",
    name: "Suffering",
    description: "Felt negative affect — pain, distress, anguish.",
    min: 0,
    max: 100,
    color: "#a6534e",
  },
  {
    key: "alignment",
    name: "Alignment",
    description: "How aligned your actions feel with your values and goals.",
    min: 0,
    max: 100,
    color: "#5b7290",
  },
  {
    key: "selfSatisfaction",
    name: "Self satisfaction",
    description: "Satisfaction with yourself — who you are and how you're showing up.",
    min: 0,
    max: 100,
    color: "#5f7a5b",
  },
  {
    key: "situationalSatisfaction",
    name: "Situational satisfaction",
    description: "Satisfaction with your current situation and circumstances.",
    min: 0,
    max: 100,
    color: "#7d6a8a",
  },
]

export const METRIC_KEYS: MetricKey[] = METRIC_DEFINITIONS.map((d) => d.key)

const DEF_BY_KEY: Record<MetricKey, MetricDefinition> = METRIC_DEFINITIONS.reduce(
  (acc, d) => {
    acc[d.key] = d
    return acc
  },
  {} as Record<MetricKey, MetricDefinition>,
)

export function getMetricDefinition(key: MetricKey): MetricDefinition {
  return DEF_BY_KEY[key]
}

/** Resolve a metric's display color, honoring a user override map. */
export function resolveMetricColor(key: MetricKey, overrides?: Partial<Record<MetricKey, string>>): string {
  return overrides?.[key] ?? DEF_BY_KEY[key].color
}

export interface MetricDatapoint {
  id: string
  /**
   * Local datetime the reading applies to, to the minute, as a
   * "YYYY-MM-DDTHH:mm" string. Editable so the user can back-log past moments.
   */
  at: string
  /** Subset of the five core metrics, each clamped to 0–100. */
  values: Partial<Record<MetricKey, number>>
  /** Short context — what was happening at this moment. */
  context?: string
  /** Longer free-form details about this datapoint. */
  details?: string
  /** Wall-clock time the record was actually created (audit; distinct from `at`). */
  createdAt: Date
}

const rid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

const pad = (n: number) => String(n).padStart(2, "0")

/** Format a Date as a local "YYYY-MM-DDTHH:mm" string (datetime-local value). */
export function toLocalDateTimeValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Clamp a metric value to its 0–100 scale (returns undefined for non-finite). */
export function clampMetricValue(value: number): number | undefined {
  if (!Number.isFinite(value)) return undefined
  return Math.max(0, Math.min(100, Math.round(value)))
}

function sanitizeValues(values: Partial<Record<MetricKey, number>>): Partial<Record<MetricKey, number>> {
  const out: Partial<Record<MetricKey, number>> = {}
  for (const key of METRIC_KEYS) {
    const raw = values[key]
    if (raw === undefined || raw === null) continue
    const v = clampMetricValue(Number(raw))
    if (v !== undefined) out[key] = v
  }
  return out
}

interface MetricsState {
  datapoints: MetricDatapoint[]
  /** User-chosen color overrides per metric (falls back to the default color). */
  colors: Partial<Record<MetricKey, string>>

  /** Set (or reset, with undefined) a metric's display color. */
  setMetricColor: (key: MetricKey, color: string | undefined) => void

  /** Record a datapoint. `at` defaults to now; values are clamped to 0–100. */
  addDatapoint: (input: {
    at?: string
    values: Partial<Record<MetricKey, number>>
    context?: string
    details?: string
  }) => string
  updateDatapoint: (
    id: string,
    patch: Partial<Pick<MetricDatapoint, "at" | "values" | "context" | "details">>,
  ) => void
  removeDatapoint: (id: string) => void

  /** Datapoints sorted by `at` (most recent first). */
  datapointsChrono: (descending?: boolean) => MetricDatapoint[]
  /** Per-metric value series ({ date: at, value }), chronological ascending. */
  seriesFor: (key: MetricKey) => SeriesPoint[]
}

export const useMetricsStore = create<MetricsState>()(
  persist(
    (set, get) => ({
      datapoints: [],
      colors: {},

      setMetricColor: (key, color) =>
        set((state) => {
          const colors = { ...state.colors }
          if (color) colors[key] = color
          else delete colors[key]
          return { colors }
        }),

      addDatapoint: (input) => {
        const id = rid("dp")
        const at = input.at && input.at.trim() ? input.at : toLocalDateTimeValue(new Date())
        const datapoint: MetricDatapoint = {
          id,
          at,
          values: sanitizeValues(input.values),
          context: input.context?.trim() || undefined,
          details: input.details?.trim() || undefined,
          createdAt: new Date(),
        }
        set((state) => ({ datapoints: [...state.datapoints, datapoint] }))
        return id
      },

      updateDatapoint: (id, patch) =>
        set((state) => ({
          datapoints: state.datapoints.map((d) =>
            d.id === id
              ? {
                  ...d,
                  ...(patch.at !== undefined ? { at: patch.at } : {}),
                  ...(patch.values !== undefined ? { values: sanitizeValues(patch.values) } : {}),
                  ...(patch.context !== undefined ? { context: patch.context?.trim() || undefined } : {}),
                  ...(patch.details !== undefined ? { details: patch.details?.trim() || undefined } : {}),
                }
              : d,
          ),
        })),

      removeDatapoint: (id) => set((state) => ({ datapoints: state.datapoints.filter((d) => d.id !== id) })),

      datapointsChrono: (descending = true) =>
        get()
          .datapoints.slice()
          .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0) * (descending ? -1 : 1)),

      seriesFor: (key) =>
        get()
          .datapoints.filter((d) => d.values[key] !== undefined)
          .map((d) => ({ date: d.at, value: d.values[key] as number }))
          .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    }),
    {
      name: "cogs-metrics-store",
      version: 2,
      // v1 stored arbitrary metric definitions + per-day entries; that model is
      // incompatible, so older persisted state is dropped on upgrade.
      migrate: (persisted, version) => {
        if (version < 2 || !persisted || typeof persisted !== "object") {
          return { datapoints: [] } as Partial<MetricsState>
        }
        return persisted as Partial<MetricsState>
      },
      // Revive Date fields after rehydration from JSON strings.
      onRehydrateStorage: () => (state) => {
        if (!state) return
        state.datapoints.forEach((d) => {
          if (!(d.createdAt instanceof Date)) d.createdAt = new Date(d.createdAt)
        })
      },
    },
  ),
)
