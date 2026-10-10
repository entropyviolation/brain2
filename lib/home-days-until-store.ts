/**
 * lib/home-days-until-store.ts — Countdown / count-up home tiles
 *
 * Many timers. Each has a label, date, optional clock, unit/decimal format,
 * countdown-to or count-up-from mode, and an optional Plan event link with
 * all-day scheduling. Storage: `brain2-home-days-until` (persist **v3** is
 * the `items` list; v2 was one object). Included in the Settings full backup.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"

export const HOME_DAYS_UNTIL_STORAGE_KEY = persistKey("home-days-until")

export const DEFAULT_DAYS_UNTIL_ID = "default"

export type DaysUntilFormat = "unit" | "decimal"

/**
 * Count down to the mark, count up from it, or `auto` (Until while ahead,
 * Since once past — the pre-v3 face).
 */
export type DaysUntilMode = "countdown" | "countup" | "auto"

export type HomeDaysUntilItem = {
  id: string
  label: string
  date: string
  /** Optional local time `HH:MM`. Empty = date-only (midnight start of that day). */
  time: string
  format: DaysUntilFormat
  mode: DaysUntilMode
  /** Linked Plan `CalendarEvent.id`, when attached. */
  eventId: string
  /** When true, keep (or create) an all-day Plan event for this mark. */
  scheduleAllDay: boolean
}

/** @deprecated Prefer `HomeDaysUntilItem`. Flat shape kept for migrate + tests. */
export type HomeDaysUntil = {
  label: string
  date: string
  time: string
  format: DaysUntilFormat
}

export const EMPTY_HOME_DAYS_UNTIL_ITEM: Omit<HomeDaysUntilItem, "id"> = {
  label: "",
  date: "",
  time: "",
  format: "unit",
  mode: "countdown",
  eventId: "",
  scheduleAllDay: false,
}

/** Fresh vault / empty migrate seed — auto keeps the old Until/Since face. */
export const DEFAULT_HOME_DAYS_UNTIL_ITEM: HomeDaysUntilItem = {
  id: DEFAULT_DAYS_UNTIL_ID,
  label: "",
  date: "",
  time: "",
  format: "unit",
  mode: "auto",
  eventId: "",
  scheduleAllDay: false,
}

export const EMPTY_HOME_DAYS_UNTIL: HomeDaysUntil = {
  label: "",
  date: "",
  time: "",
  format: "unit",
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^\d{2}:\d{2}$/

export function sanitizeDaysUntilFormat(value: unknown): DaysUntilFormat {
  return value === "decimal" ? "decimal" : "unit"
}

export function sanitizeDaysUntilMode(value: unknown): DaysUntilMode {
  if (value === "countup" || value === "countdown") return value
  return "auto"
}

export function sanitizeDaysUntilTime(value: unknown): string {
  if (typeof value !== "string" || !TIME.test(value)) return ""
  const [hh, mm] = value.split(":").map(Number)
  if (hh! < 0 || hh! > 23 || mm! < 0 || mm! > 59) return ""
  return value
}

export function newDaysUntilId(): string {
  return `du-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function sanitizeHomeDaysUntilItem(value: unknown, fallbackId = DEFAULT_DAYS_UNTIL_ID): HomeDaysUntilItem {
  const raw = value && typeof value === "object" ? (value as Partial<HomeDaysUntilItem>) : {}
  const label =
    typeof raw.label === "string" ? raw.label.replace(/[\r\n\t]/g, " ").replace(/ {2,}/g, " ").slice(0, 40) : ""
  const date = typeof raw.date === "string" && DATE.test(raw.date) ? raw.date : ""
  const id =
    typeof raw.id === "string" && raw.id.trim()
      ? raw.id.replace(/[^\w:-]/g, "").slice(0, 64)
      : fallbackId
  return {
    id: id || fallbackId,
    label,
    date,
    time: sanitizeDaysUntilTime(raw.time),
    format: sanitizeDaysUntilFormat(raw.format),
    mode: sanitizeDaysUntilMode(raw.mode),
    eventId: typeof raw.eventId === "string" ? raw.eventId.slice(0, 80) : "",
    scheduleAllDay: raw.scheduleAllDay === true,
  }
}

/** Accept v2 flat object or v3 `{ items }`. Always at least one item. */
export function sanitizeHomeDaysUntilItems(value: unknown): HomeDaysUntilItem[] {
  if (value && typeof value === "object" && Array.isArray((value as { items?: unknown }).items)) {
    const seen = new Set<string>()
    const next: HomeDaysUntilItem[] = []
    for (const entry of (value as { items: unknown[] }).items) {
      const item = sanitizeHomeDaysUntilItem(entry, newDaysUntilId())
      let id = item.id
      while (seen.has(id)) id = newDaysUntilId()
      seen.add(id)
      next.push({ ...item, id })
    }
    if (next.length > 0) return next
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const flat = value as Record<string, unknown>
    if ("label" in flat || "date" in flat || "format" in flat) {
      // v2 had no mode — keep Until/Since auto so a past mark still reads Since.
      return [sanitizeHomeDaysUntilItem({ ...flat, mode: flat.mode ?? "auto" }, DEFAULT_DAYS_UNTIL_ID)]
    }
  }
  return [{ ...DEFAULT_HOME_DAYS_UNTIL_ITEM }]
}

export function primaryDaysUntilItem(items: HomeDaysUntilItem[]): HomeDaysUntilItem {
  return items[0] ?? { ...DEFAULT_HOME_DAYS_UNTIL_ITEM }
}

interface HomeDaysUntilState {
  items: HomeDaysUntilItem[]
  addCountdown: (patch?: Partial<Omit<HomeDaysUntilItem, "id">>) => string
  updateCountdown: (id: string, patch: Partial<Omit<HomeDaysUntilItem, "id">>) => void
  removeCountdown: (id: string) => void
  /** Patch the first item (tests + single-tile callers). */
  setCountdown: (patch: Partial<HomeDaysUntilItem>) => void
}

export const useHomeDaysUntilStore = create<HomeDaysUntilState>()(
  persist(
    (set, get) => ({
      items: [{ ...DEFAULT_HOME_DAYS_UNTIL_ITEM }],
      addCountdown: (patch) => {
        const id = newDaysUntilId()
        const item = sanitizeHomeDaysUntilItem(
          { ...EMPTY_HOME_DAYS_UNTIL_ITEM, mode: "countdown", ...patch, id },
          id,
        )
        set((state) => ({ items: [...state.items, item] }))
        return id
      },
      updateCountdown: (id, patch) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id
              ? sanitizeHomeDaysUntilItem({ ...item, ...patch, id: item.id }, item.id)
              : item,
          ),
        })),
      removeCountdown: (id) =>
        set((state) => {
          const next = state.items.filter((item) => item.id !== id)
          if (next.length > 0) return { items: next }
          return { items: [{ ...DEFAULT_HOME_DAYS_UNTIL_ITEM }] }
        }),
      setCountdown: (patch) => {
        const primary = primaryDaysUntilItem(get().items)
        get().updateCountdown(primary.id, patch)
      },
    }),
    {
      name: HOME_DAYS_UNTIL_STORAGE_KEY,
      version: 3,
      storage: createCogsJSONStorage(),
      partialize: (state) => ({ items: state.items }),
      migrate: (persisted) => ({ items: sanitizeHomeDaysUntilItems(persisted) }),
      merge: (persisted, current) => ({
        ...current,
        items: sanitizeHomeDaysUntilItems(persisted),
      }),
    },
  ),
)
