/**
 * tracker/habit-desk-header.tsx — Fascia title, period nameplate, Settings, Chat (Habits BIMBY).
 *
 * Season, week, month, and day each keep their own range and lens update.
 * The daily nameplate still adds six days with `setDate`. With Day View on,
 * the daily nameplate names one day and its keys step one day. Double-click
 * any nameplate to pick a date. Today shows only away from the period that
 * holds today (`isOnCurrentPeriod`); Day View asks the day lens.
 */
"use client"

import { format } from "date-fns"
import { Settings } from "lucide-react"
import { WeekNavigation } from "@/components/Home/Habits/period/week-navigation"
import { HabitsBimbyKey } from "@/components/Home/Habits/helper/habit-helper-key"
import { isOnCurrentPeriod } from "@/components/Home/Habits/period/habits-period-cursor"
import { addCalendarDays, formatDateRange, getWeekStartDate } from "@/lib/date-utils"
import { quarterKey, quarterLabel, quarterStartDate, shiftQuarter } from "@/lib/seasons"
import type { useHabitsDayLens } from "@/components/Home/Habits/period/habits-day-lens"
import type { HabitFreqTab } from "@/lib/app-navigation"
import type { PeriodColumn } from "@/components/Home/Habits/period-habit-list"

export function HabitDeskHeader({
  habitTab,
  currentDate,
  currentQuarter,
  setQuarterLens,
  currentWeekStart,
  setWeekLens,
  currentMonth,
  setMonthLens,
  weekPeriods,
  weekWindowAsOf,
  monthPeriods,
  monthWindowAsOf,
  dayView,
  dayLens,
  onOpenSettings,
}: {
  habitTab: HabitFreqTab
  currentDate: Date
  currentQuarter: Date
  setQuarterLens: (next: Date | null) => void
  currentWeekStart: Date
  setWeekLens: (next: Date | null) => void
  currentMonth: Date
  setMonthLens: (next: Date | null) => void
  weekPeriods: PeriodColumn[]
  weekWindowAsOf: Date
  monthPeriods: PeriodColumn[]
  monthWindowAsOf: Date
  dayView: boolean
  dayLens: ReturnType<typeof useHabitsDayLens>
  onOpenSettings: () => void
}) {
  const weekEndDate = new Date(currentWeekStart)
  weekEndDate.setDate(weekEndDate.getDate() + 6)
  const viewingCurrentPeriod =
    habitTab === "quarterly"
      ? isOnCurrentPeriod(currentQuarter, "season", currentDate)
      : habitTab === "monthly"
        ? isOnCurrentPeriod(currentMonth, "month", currentDate)
        : isOnCurrentPeriod(currentWeekStart, "week", currentDate)
  const weekWindowRange =
    weekPeriods.length === 0
      ? formatDateRange(weekWindowAsOf, addCalendarDays(weekWindowAsOf, 6))
      : formatDateRange(weekPeriods[0].date, addCalendarDays(weekPeriods[weekPeriods.length - 1].date, 6))

  return (
    <div className="hab-head">
      <h3 className="hab-head-title">Habits</h3>
      <div className="hab-head-center">
        {habitTab === "quarterly" ? (
          <WeekNavigation
            currentWeekStart={currentQuarter}
            weekEndDate={currentQuarter}
            rangeLabel={quarterLabel(quarterKey(currentQuarter))}
            currentButtonLabel="This season"
            previousAriaLabel="Previous season"
            nextAriaLabel="Next season"
            isCurrentPeriod={viewingCurrentPeriod}
            onPreviousWeek={() => setQuarterLens(shiftQuarter(currentQuarter, -1))}
            onNextWeek={() => setQuarterLens(shiftQuarter(currentQuarter, 1))}
            onCurrentWeek={() => setQuarterLens(null)}
            onPick={(date) => setQuarterLens(quarterStartDate(date))}
          />
        ) : habitTab === "weekly" ? (
          <WeekNavigation
            currentWeekStart={weekPeriods[0]?.date ?? weekWindowAsOf}
            weekEndDate={
              weekPeriods.length
                ? addCalendarDays(weekPeriods[weekPeriods.length - 1].date, 6)
                : weekWindowAsOf
            }
            rangeLabel={weekWindowRange}
            currentButtonLabel="This week"
            previousAriaLabel="Previous Week"
            nextAriaLabel="Next Week"
            isCurrentPeriod={viewingCurrentPeriod}
            onPreviousWeek={() => setWeekLens(addCalendarDays(currentWeekStart, -7))}
            onNextWeek={() => setWeekLens(addCalendarDays(currentWeekStart, 7))}
            onCurrentWeek={() => setWeekLens(null)}
            onPick={(date) => setWeekLens(getWeekStartDate(date))}
          />
        ) : habitTab === "monthly" ? (
          <WeekNavigation
            currentWeekStart={currentMonth}
            weekEndDate={currentMonth}
            rangeLabel={
              monthPeriods.length === 0
                ? format(monthWindowAsOf, "MMMM yyyy")
                : monthPeriods.length === 1
                  ? format(monthPeriods[0].date, "MMMM yyyy")
                  : `${format(monthPeriods[0].date, "MMM yyyy")} – ${format(monthPeriods[monthPeriods.length - 1].date, "MMM yyyy")}`
            }
            currentButtonLabel="This month"
            previousAriaLabel="Previous Month"
            nextAriaLabel="Next Month"
            isCurrentPeriod={viewingCurrentPeriod}
            onPreviousWeek={() =>
              setMonthLens(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
            }
            onNextWeek={() =>
              setMonthLens(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
            }
            onCurrentWeek={() => setMonthLens(null)}
            onPick={(date) => setMonthLens(new Date(date.getFullYear(), date.getMonth(), 1))}
          />
        ) : dayView ? (
          <WeekNavigation
            currentWeekStart={dayLens.dayViewDate}
            weekEndDate={dayLens.dayViewDate}
            rangeLabel={format(dayLens.dayViewDate, "EEE, MMM d, yyyy")}
            previousAriaLabel="Previous day"
            nextAriaLabel="Next day"
            isCurrentPeriod={dayLens.isToday}
            onPreviousWeek={() => dayLens.stepDay(-1)}
            onNextWeek={() => dayLens.stepDay(1)}
            onCurrentWeek={dayLens.goToToday}
            onPick={dayLens.goToDay}
          />
        ) : (
          <WeekNavigation
            currentWeekStart={currentWeekStart}
            weekEndDate={weekEndDate}
            isCurrentPeriod={viewingCurrentPeriod}
            onPreviousWeek={() => setWeekLens(addCalendarDays(currentWeekStart, -7))}
            onNextWeek={() => setWeekLens(addCalendarDays(currentWeekStart, 7))}
            onCurrentWeek={dayLens.goToToday}
            onPick={(date) => setWeekLens(getWeekStartDate(date))}
          />
        )}
      </div>
      <div className="hab-head-utils">
        <button type="button" className="habit-chrome-btn" data-no95="" onClick={onOpenSettings}>
          <Settings className="h-3.5 w-3.5" />
          Settings
        </button>
        <HabitsBimbyKey />
      </div>
    </div>
  )
}
