/**
 * lib/day-photos-store.ts — Photos attached to a day
 *
 * Maps a local day key (`YYYY-MM-DD`) to Photo item ids. A photo with a `takenAt`
 * date belongs to that day automatically (`photoDayKey`); this store holds the
 * ones a person attaches by hand. Storage: `brain2-day-photos`.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import { registerPhoneWindowStore } from "@/lib/phone-window"

export const DAY_PHOTOS_STORAGE_KEY = persistKey("day-photos")

interface DayPhotosState {
  byDay: Record<string, string[]>
  attach: (dayKey: string, photoId: string) => void
  detach: (dayKey: string, photoId: string) => void
}

export const useDayPhotosStore = create<DayPhotosState>()(
  persist(
    (set) => ({
      byDay: {},
      attach: (dayKey, photoId) =>
        set((s) => {
          const cur = s.byDay[dayKey] ?? []
          return cur.includes(photoId) ? s : { byDay: { ...s.byDay, [dayKey]: [...cur, photoId] } }
        }),
      detach: (dayKey, photoId) =>
        set((s) => {
          const next = (s.byDay[dayKey] ?? []).filter((id) => id !== photoId)
          const byDay = { ...s.byDay }
          if (next.length) byDay[dayKey] = next
          else delete byDay[dayKey]
          return { byDay }
        }),
    }),
    { name: DAY_PHOTOS_STORAGE_KEY, version: 1, storage: createCogsJSONStorage() },
  ),
)

/** Photo ids on a day: attached by hand plus any whose `takenAt` falls on it. */
export function photoIdsForDay(
  dayKey: string,
  byDay: Record<string, string[]>,
  photos: { id: string; takenDayKey: string | null }[],
): string[] {
  const ids = new Set(byDay[dayKey] ?? [])
  for (const p of photos) if (p.takenDayKey === dayKey) ids.add(p.id)
  return [...ids]
}

registerPhoneWindowStore(useDayPhotosStore)
