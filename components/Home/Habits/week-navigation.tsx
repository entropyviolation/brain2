/**
 * components/Home/Habits/week-navigation.tsx — Habit week picker
 *
 * The week navigation pill: previous/next week, "Today", and the current
 * date-range label, driving which week the habit grid displays.
 *
 * Spec: §9.3 (display & interaction).
 */
"use client"

import { Button } from "@/components/ui/button"
import { formatDateRange } from "@/lib/date-utils"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"

interface WeekNavigationProps {
  currentWeekStart: Date
  weekEndDate: Date
  onPreviousWeek: () => void
  onNextWeek: () => void
  onCurrentWeek: () => void
}

export function WeekNavigation({
  currentWeekStart,
  weekEndDate,
  onPreviousWeek,
  onNextWeek,
  onCurrentWeek,
}: WeekNavigationProps) {
  return (
    <div className="flex items-center gap-1 bg-white dark:bg-gray-900 p-1 rounded-full shadow-sm border border-gray-100 dark:border-gray-800">
      <Button
        variant="ghost"
        size="icon"
        onClick={onPreviousWeek}
        className="h-7 w-7 rounded-full"
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="sr-only">Previous Week</span>
      </Button>

      <Button
        variant="outline"
        onClick={onCurrentWeek}
        className="h-7 px-2.5 text-xs rounded-full"
      >
        <Calendar className="h-3 w-3 mr-1" />
        Today
      </Button>

      <span className="px-2 font-medium text-xs whitespace-nowrap">{formatDateRange(currentWeekStart, weekEndDate)}</span>

      <Button
        variant="ghost"
        size="icon"
        onClick={onNextWeek}
        className="h-7 w-7 rounded-full"
      >
        <ChevronRight className="h-5 w-5" />
        <span className="sr-only">Next Week</span>
      </Button>
    </div>
  )
}
