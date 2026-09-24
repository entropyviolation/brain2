/**
 * lib/sun-times-store.ts — Persisted per-day sunrise / sunset
 *
 * Keyed by `YYYY-MM-DD|lat|lng` (`sunCacheKey`). The first write for a calendar
 * day is sticky: later lookups (including "today's" sun, or a new home pin)
 * do not overwrite a day that already has a clock. Historical Tracking rows
 * and Sleep analytics therefore keep the sun they were given, not this morning's.
 *
 * Computation is local astronomy (`computeDaySun`). Open-Meteo weather is a
 * separate cache and is not the source of these clocks.
 */

"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import { DEFAULT_HOME_CITY } from "@/lib/user-settings-store"
import {
  computeDaySun,
  SAN_DIEGO_COORDS,
  sunCacheKey,
  type DaySunTimes,
} from "@/lib/sun-times"

export const SUN_TIMES_STORAGE_KEY = persistKey("sun-times")

export type SunPlace = { lat: number; lng: number; name: string }

interface SunTimesState {
  /** Exact pin+day slots. Never overwritten. */
  days: Record<string, DaySunTimes>
  /** First slot written for a calendar day — historical rows use this. */
  firstKeyByDate: Record<string, string>
  places: Record<string, SunPlace>
  rememberIfAbsent: (sun: DaySunTimes) => DaySunTimes
  rememberManyIfAbsent: (suns: DaySunTimes[]) => void
  rememberPlaceIfAbsent: (city: string, place: SunPlace) => void
  resetSunTimes: () => void
}

function isSanDiegoCity(city: string): boolean {
  const n = city.trim().toLowerCase()
  return n === "" || n === DEFAULT_HOME_CITY.toLowerCase() || n.startsWith("san diego")
}

export function defaultPlaceForCity(city: string): SunPlace | null {
  if (isSanDiegoCity(city)) {
    return { ...SAN_DIEGO_COORDS, name: DEFAULT_HOME_CITY }
  }
  return null
}

export function sunPlaceForCity(
  city: string,
  places: Record<string, SunPlace>,
): SunPlace | null {
  const name = city.trim() || DEFAULT_HOME_CITY
  return places[name] ?? defaultPlaceForCity(name)
}

/** Exact pin, else the first sun stored for that date, else undefined. */
export function peekStoredSun(
  days: Record<string, DaySunTimes>,
  firstKeyByDate: Record<string, string>,
  date: string,
  lat?: number,
  lng?: number,
): DaySunTimes | undefined {
  if (lat != null && lng != null) {
    const exact = days[sunCacheKey(date, lat, lng)]
    if (exact) return exact
  }
  const first = firstKeyByDate[date]
  return first ? days[first] : undefined
}

/** Read cache or compute; does not write. */
export function peekOrComputeDaySun(
  date: string,
  lat: number,
  lng: number,
  state: Pick<SunTimesState, "days" | "firstKeyByDate">,
): DaySunTimes | null {
  return peekStoredSun(state.days, state.firstKeyByDate, date, lat, lng) ?? computeDaySun(date, lat, lng)
}

export const useSunTimesStore = create<SunTimesState>()(
  persist(
    (set, get) => ({
      days: {},
      firstKeyByDate: {},
      places: {},
      rememberIfAbsent: (sun) => {
        const key = sunCacheKey(sun.date, sun.lat, sun.lng)
        const current = get()
        const existingExact = current.days[key]
        if (existingExact) return existingExact
        const firstKey = current.firstKeyByDate[sun.date]
        if (firstKey && current.days[firstKey]) return current.days[firstKey]
        set({
          days: { ...current.days, [key]: sun },
          firstKeyByDate: { ...current.firstKeyByDate, [sun.date]: key },
        })
        return sun
      },
      rememberManyIfAbsent: (suns) => {
        if (suns.length === 0) return
        set((current) => {
          let days = current.days
          let firstKeyByDate = current.firstKeyByDate
          let wrote = false
          for (const sun of suns) {
            const key = sunCacheKey(sun.date, sun.lat, sun.lng)
            if (days[key]) continue
            if (firstKeyByDate[sun.date] && days[firstKeyByDate[sun.date]]) continue
            if (!wrote) {
              days = { ...days }
              firstKeyByDate = { ...firstKeyByDate }
              wrote = true
            }
            days[key] = sun
            firstKeyByDate[sun.date] = key
          }
          return wrote ? { days, firstKeyByDate } : current
        })
      },
      rememberPlaceIfAbsent: (city, place) => {
        const name = city.trim() || DEFAULT_HOME_CITY
        if (get().places[name]) return
        set((state) => ({
          places: {
            ...state.places,
            [name]: { lat: place.lat, lng: place.lng, name: place.name || name },
          },
        }))
      },
      resetSunTimes: () => set({ days: {}, firstKeyByDate: {}, places: {} }),
    }),
    {
      name: SUN_TIMES_STORAGE_KEY,
      version: 1,
      storage: createCogsJSONStorage(),
      partialize: (state) => ({
        days: state.days,
        firstKeyByDate: state.firstKeyByDate,
        places: state.places,
      }),
    },
  ),
)

/** Sync resolve against the live store; persists a miss. */
export function sunForDate(date: string, lat: number, lng: number): DaySunTimes | null {
  const store = useSunTimesStore.getState()
  const hit = peekStoredSun(store.days, store.firstKeyByDate, date, lat, lng)
  if (hit) return hit
  const computed = computeDaySun(date, lat, lng)
  if (!computed) return null
  return store.rememberIfAbsent(computed)
}
