/**
 * lib/kitchen-day-note.ts — One free note per calendar day
 *
 * Storage: `brain2-kitchen-day-note` (persist v1). The note is not food and
 * does not add calories. The plate and the time entry stay where they are.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

export const KITCHEN_DAY_NOTE_KEY = persistKey("kitchen-day-note")

interface DayNoteState {
  notes: Record<string, string>
  write: (date: string, note: string) => void
}

function cleanNotes(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!DATE_KEY.test(key) || typeof value !== "string") continue
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
        if (!DATE_KEY.test(date)) return
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
