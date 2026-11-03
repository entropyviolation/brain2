/**
 * tracker/habit-period-keys.tsx — Daily, Weekly, Monthly, and Season keycaps.
 *
 * Counts appear only after the vault has hydrated. Season carries `data-season`.
 * These triggers stay inside the same `Tabs` root as the panes.
 */
"use client"

import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import { seasonOfDate, seasonSlug } from "@/lib/seasons"

export function HabitPeriodKeys({
  hydrated,
  dailyCount,
  weeklyCount,
  monthlyCount,
  quarterlyCount,
  currentQuarter,
}: {
  hydrated: boolean
  dailyCount: number
  weeklyCount: number
  monthlyCount: number
  quarterlyCount: number
  currentQuarter: Date
}) {
  return (
    <div className="habit-grades hab-view-changer b2-keycap-tab">
      <TabsList aria-label="Habit period" className="hab-period-keys">
        <TabsTrigger value="daily">Daily{hydrated ? ` (${dailyCount})` : ""}</TabsTrigger>
        <TabsTrigger value="weekly">Weekly{hydrated ? ` (${weeklyCount})` : ""}</TabsTrigger>
        <TabsTrigger value="monthly">Monthly{hydrated ? ` (${monthlyCount})` : ""}</TabsTrigger>
        <TabsTrigger value="quarterly" data-season={seasonSlug(seasonOfDate(currentQuarter))}>
          Season{hydrated ? ` (${quarterlyCount})` : ""}
        </TabsTrigger>
      </TabsList>
    </div>
  )
}
