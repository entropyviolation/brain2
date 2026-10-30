/**
 * lib/kitchen-day-note.ts — One free note per calendar day
 *
 * Storage: `brain2-kitchen-day-note` (persist v1). Day keys are `YYYY-MM-DD`.
 * Week, month, and year notes use a prefix on the same map. This is not the
 * Tracking day summary. A note does not add calories.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { formatLocalDateKey, getWeekDates, getWeekStartDate } from "@/lib/date-utils"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
const PERIOD_KEY = /^(?:week:\d{4}-\d{2}-\d{2}|month:\d{4}-\d{2}|year:\d{4})$/

function noteKeyOk(key: string): boolean {
  return DATE_KEY.test(key) || PERIOD_KEY.test(key)
}

export const KITCHEN_DAY_NOTE_KEY = persistKey("kitchen-day-note")

interface DayNoteState {
  notes: Record<string, string>
  write: (date: string, note: string) => void
}

function cleanNotes(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!noteKeyOk(key) || typeof value !== "string") continue
    const note = value.replace(/\r\n/g, "\n")
    if (!note.trim()) continue
    out[key] = note
  }
  return out
}

export const useKitchenDayNotes = create<DayNoteState>()(
  persist(
    (set) => ({
      notes: {},
      write: (date, note) => {
        if (!noteKeyOk(date)) return
        const text = note.replace(/\r\n/g, "\n")
        set((state) => {
          const notes = { ...state.notes }
          if (!text.trim()) delete notes[date]
          else notes[date] = text
          return { notes }
        })
      },
    }),
    {
      name: KITCHEN_DAY_NOTE_KEY,
      version: 1,
      storage: createCogsJSONStorage(),
      partialize: (state) => ({ notes: state.notes }),
      merge: (persisted, current) => {
        const body = (persisted ?? {}) as { notes?: unknown }
        return { ...current, notes: cleanNotes(body.notes) }
      },
    },
  ),
)

/** The note for `YYYY-MM-DD`, or empty when that day has none. */
export function readDayNote(date: string): string {
  if (!DATE_KEY.test(date)) return ""
  return useKitchenDayNotes.getState().notes[date] ?? ""
}

/** Replace the note for one day. A blank note clears the day. */
export function writeDayNote(date: string, note: string): void {
  useKitchenDayNotes.getState().write(date, note)
}

export type FoodNotePeriod = "day" | "week" | "month" | "year"

/** Storage key for one period. A day key has no prefix, so it stays a date. */
export function foodNoteKey(period: FoodNotePeriod, anchor: Date): string {
  if (period === "day") return formatLocalDateKey(anchor)
  if (period === "week") return `week:${formatLocalDateKey(getWeekStartDate(anchor))}`
  if (period === "month") return `month:${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, "0")}`
  return `year:${anchor.getFullYear()}`
}

export function readFoodNote(key: string): string {
  if (!noteKeyOk(key)) return ""
  return useKitchenDayNotes.getState().notes[key] ?? ""
}

/** Replace one period note. A blank clears that key only. */
export function writeFoodNote(key: string, note: string): void {
  useKitchenDayNotes.getState().write(key, note)
}

export interface WeekFoodNotes {
  weekKey: string
  weekNote: string
  days: { key: string; note: string }[]
}

/** The week's own note, then each day's note. Editing a day does not write the week key. */
export function weekFoodNotes(anchor: Date): WeekFoodNotes {
  const start = getWeekStartDate(anchor)
  return {
    weekKey: foodNoteKey("week", start),
    weekNote: readFoodNote(foodNoteKey("week", start)),
    days: getWeekDates(start).map((day) => {
      const key = formatLocalDateKey(day)
      return { key, note: readDayNote(key) }
    }),
  }
}

export interface MonthFoodNotes {
  monthKey: string
  monthNote: string
  weeks: WeekFoodNotes[]
}

/** The month note, then each Monday week that touches the month. Editing a week does not write the month key. */
export function monthFoodNotes(anchor: Date): MonthFoodNotes {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
  const weeks: WeekFoodNotes[] = []
  const cursor = getWeekStartDate(first)
  const seen = new Set<string>()
  while (cursor <= last) {
    const bundle = weekFoodNotes(cursor)
    if (!seen.has(bundle.weekKey)) {
      seen.add(bundle.weekKey)
      weeks.push(bundle)
    }
    cursor.setDate(cursor.getDate() + 7)
  }
  return {
    monthKey: foodNoteKey("month", anchor),
    monthNote: readFoodNote(foodNoteKey("month", anchor)),
    weeks,
  }
}

export interface YearFoodNotes {
  yearKey: string
  yearNote: string
  months: MonthFoodNotes[]
}

/** The year's own note, then each month. Editing a month does not write the year key. */
export function yearFoodNotes(anchor: Date): YearFoodNotes {
  const year = anchor.getFullYear()
  const months: MonthFoodNotes[] = []
  for (let month = 0; month < 12; month++) months.push(monthFoodNotes(new Date(year, month, 1)))
  return {
    yearKey: foodNoteKey("year", anchor),
    yearNote: readFoodNote(foodNoteKey("year", anchor)),
    months,
  }
}

/** Tests: drop in-memory notes and the persisted key. */
export function resetKitchenDayNotes(): void {
  useKitchenDayNotes.setState({ notes: {} })
  if (typeof localStorage === "undefined") return
  try {
    localStorage.removeItem(KITCHEN_DAY_NOTE_KEY)
  } catch {
    /* the test double may refuse */
  }
}
