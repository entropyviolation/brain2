/**
 * lib/theme-store.ts — User-customizable theme colors
 *
 * Points card colors and habit-type icon colors, shared across Home dashboard.
 * Storage: localStorage today; target MongoDB `themePrefs` collection (§3).
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface ThemeColors {
  pointsAllTime: string
  pointsToday: string
  pointsWeek: string
  pointsMonth: string
  habitBoolean: string
  habitGoal: string
  habitText: string
  habitIncremental: string
}

export const DEFAULT_THEME: ThemeColors = {
  pointsAllTime: "#ca8a04",
  pointsToday: "#16a34a",
  pointsWeek: "#2563eb",
  pointsMonth: "#9333ea",
  habitBoolean: "#22c55e",
  habitGoal: "#3b82f6",
  habitText: "#a855f7",
  habitIncremental: "#06b6d4",
}

interface ThemeState {
  colors: ThemeColors
  setColor: (key: keyof ThemeColors, value: string) => void
  resetColors: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      colors: DEFAULT_THEME,
      setColor: (key, value) =>
        set((state) => ({ colors: { ...state.colors, [key]: value } })),
      resetColors: () => set({ colors: DEFAULT_THEME }),
    }),
    { name: "cogs-theme-store", version: 1 },
  ),
)
