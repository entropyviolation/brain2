/**
 * lib/user-settings-store.ts — Cross-cutting user prefs
 *
 * Home location (city) used by Plan's day itinerary for sunrise/sunset lines.
 * Defaults to San Diego. Storage: localStorage today.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"

export const DEFAULT_HOME_CITY = "San Diego, California"

interface UserSettingsState {
  homeCity: string
  setHomeCity: (city: string) => void
  resetHomeLocation: () => void
}

export const useUserSettingsStore = create<UserSettingsState>()(
  persist(
    (set) => ({
      homeCity: DEFAULT_HOME_CITY,
      setHomeCity: (city) => set({ homeCity: city.trim() || DEFAULT_HOME_CITY }),
      resetHomeLocation: () => set({ homeCity: DEFAULT_HOME_CITY }),
    }),
    { name: "cogs-user-settings", version: 1, storage: createCogsJSONStorage() },
  ),
)
