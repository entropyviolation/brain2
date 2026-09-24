/**
 * lib/home-weather-store.ts — Last city / beach on the Home weather widget
 *
 * Independent of Settings `homeCity` (that stays the fallback + Plan sun).
 * Storage: `brain2-home-weather`. Included in the Settings full backup.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import {
  EMPTY_HOME_WEATHER_PLACE,
  HOME_WEATHER_STORAGE_KEY,
  sanitizeHomeWeatherPlace,
  type HomeWeatherPlace,
} from "@/lib/home-weather"

interface HomeWeatherState extends HomeWeatherPlace {
  setPlace: (patch: Partial<HomeWeatherPlace>) => void
  resetPlace: () => void
}

export const useHomeWeatherStore = create<HomeWeatherState>()(
  persist(
    (set) => ({
      ...EMPTY_HOME_WEATHER_PLACE,
      setPlace: (patch) =>
        set((state) =>
          sanitizeHomeWeatherPlace({
            cityQuery: state.cityQuery,
            cityName: state.cityName,
            lat: state.lat,
            lng: state.lng,
            stationId: state.stationId,
            beachLabel: state.beachLabel,
            ...patch,
          }),
        ),
      resetPlace: () => set({ ...EMPTY_HOME_WEATHER_PLACE }),
    }),
    {
      name: HOME_WEATHER_STORAGE_KEY,
      version: 1,
      storage: createCogsJSONStorage(),
      partialize: (state) => ({
        cityQuery: state.cityQuery,
        cityName: state.cityName,
        lat: state.lat,
        lng: state.lng,
        stationId: state.stationId,
        beachLabel: state.beachLabel,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...sanitizeHomeWeatherPlace(persisted),
      }),
    },
  ),
)
