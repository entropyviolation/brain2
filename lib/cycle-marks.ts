/**
 * lib/cycle-marks.ts — Day marks for cycle phase
 *
 * One local calendar day (`YYYY-MM-DD`) to the flags the person set.
 * Spotting is stored here and does not change phase (`lib/cycle-phase.ts`).
 * This is a calendar record, not medical advice.
 *
 * Persisted like the sleep log: Zustand + `persistKey("cycle-marks")` through
 * the hub-safe storage adapter. Empty days are dropped. Clearing a flag is a
 * normal edit, so the vault guard treats the map as curated, not append-only.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage, registerPersistRehydrator } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"

export type CycleDayMark = {
  /** Local YYYY-MM-DD. */
  date: string
  bleeding?: boolean
  spotting?: boolean
  ovulation?: boolean
}

export const CYCLE_FLAGS = ["bleeding", "spotting", "ovulation"] as const
export type CycleFlag = (typeof CYCLE_FLAGS)[number]

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/

export function isCycleDayKey(value: string): boolean {
  const match = DAY_KEY.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

export function isCycleFlag(value: string): value is CycleFlag {
  return (CYCLE_FLAGS as readonly string[]).includes(value)
}

interface CycleMarksState {
  marks: Record<string, CycleDayMark>
  /** Set or clear one flag. `false` drops it. A day with no flags is removed. */
  setFlag: (date: string, flag: CycleFlag, value: boolean) => void
  /** Flip one flag. Returns the value now stored, or false when the day was removed. */
  toggleFlag: (date: string, flag: CycleFlag) => boolean
}

function cleanMark(mark: CycleDayMark): CycleDayMark | null {
  const next: CycleDayMark = { date: mark.date }
  if (mark.bleeding) next.bleeding = true
  if (mark.spotting) next.spotting = true
  if (mark.ovulation) next.ovulation = true
  if (!next.bleeding && !next.spotting && !next.ovulation) return null
  return next
}

export const useCycleMarksStore = create<CycleMarksState>()(
  persist(
    (set, get) => ({
      marks: {},

      setFlag: (date, flag, value) => {
        if (!isCycleDayKey(date) || !isCycleFlag(flag)) return
        set((state) => {
          const current = state.marks[date] ?? { date }
          const nextMark = cleanMark({ ...current, date, [flag]: value ? true : undefined })
          const marks = { ...state.marks }
          if (!nextMark) delete marks[date]
          else marks[date] = nextMark
          return { marks }
        })
      },

      toggleFlag: (date, flag) => {
        const on = get().marks[date]?.[flag] === true
        get().setFlag(date, flag, !on)
        return get().marks[date]?.[flag] === true
      },
    }),
    {
      name: persistKey("cycle-marks"),
      version: 1,
      storage: createCogsJSONStorage(),
      partialize: (state) => ({ marks: state.marks }),
    },
  ),
)

registerPersistRehydrator(persistKey("cycle-marks"), () => useCycleMarksStore.persist.rehydrate())

/** Every stored day mark. Subscribe through `useCycleMarksStore` in React. */
export function readCycleMarks(): Record<string, CycleDayMark> {
  return useCycleMarksStore.getState().marks
}

export function setCycleFlag(date: string, flag: CycleFlag, value: boolean): void {
  useCycleMarksStore.getState().setFlag(date, flag, value)
}

export function toggleCycleFlag(date: string, flag: CycleFlag): boolean {
  return useCycleMarksStore.getState().toggleFlag(date, flag)
}
