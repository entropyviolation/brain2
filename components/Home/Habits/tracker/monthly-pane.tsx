/**
 * tracker/monthly-pane.tsx — Monthly Habits sheet.
 *
 * Month View shows one column. Percents and the span grade still use the
 * full month window. An all-exempt row or column returns null.
 */
"use client"

import { format } from "date-fns"
import { PeriodHabitList, type PeriodColumn } from "@/components/Home/Habits/period-habit-list"
import { HabitsTabControls, type HabitsTabControlsProps } from "@/components/Home/Habits/panel/habits-tab-controls"
import { HabitMonthWindowControl } from "@/components/Home/Habits/panel/habit-month-window-control"
import { calculatePeriodColumnPercentage } from "@/lib/calculations"
import type { HabitBirthday, HabitMonthWindowMode } from "@/lib/habit-month-window"
import type { HabitFrequency, TaskCompletion, WeeklyData, WeeklyTask } from "@/lib/types"
import type { WillpowerStone } from "@/lib/willpower-stones"
import type { HabitFreqTab } from "@/lib/app-navigation"
import { HabitDeskFrame, type HabitMeterProps, type HabitPriorityProps } from "@/components/Home/Habits/tracker/habit-desk-frame"
import { HabitPlanLog } from "@/components/Home/Habits/tracker/habit-plan-log"
import { HabitSheetLoading } from "@/components/Home/Habits/tracker/habit-sheet-loading"
import { habitSortTools, type HabitSortBag } from "@/components/Home/Habits/tracker/habit-sort-tools"
import { habitViewToggles, type HabitViewToggleFlags } from "@/components/Home/Habits/tracker/view-toggles"
import type { MonthlyExempt, MonthlyKind } from "@/components/Home/Habits/tracker/monthly-model"

export function MonthlyPane({
  hydrated,
  habitTab,
  monthlyRows,
  monthlyShown,
  monthSheetPeriods,
  monthPeriods,
  monthlyHabitData,
  updateMonthlyHabitCompletion,
  onEditTask,
  hideCompletedToday,
  hideCompletedAndMissed,
  monthlyKind,
  setHabitExemption,
  monthlyTasks,
  monthlyExempt,
  monthlyPeriodPercent,
  currentDate,
  habitMonthView,
  monthPlanColumn,
  priorityProps,
  editingFrequency,
  reorderVisible,
  willpowerStones,
  meter,
  viewFlags,
  sortBag,
  periodWells,
  habitMonthWindow,
  habitBirthday,
  setHabitMonthWindow,
  setHabitBirthday,
  setEditingTask,
  setDefaultFrequency,
  setShowTaskForm,
}: {
  hydrated: boolean
  habitTab: HabitFreqTab
  monthlyRows: WeeklyTask[]
  monthlyShown: WeeklyTask[]
  monthSheetPeriods: PeriodColumn[]
  monthPeriods: PeriodColumn[]
  monthlyHabitData: WeeklyData
  updateMonthlyHabitCompletion: (taskId: string, monthDate: Date, completion: TaskCompletion) => void
  onEditTask: (task: WeeklyTask) => void
  hideCompletedToday: boolean
  hideCompletedAndMissed: boolean
  monthlyKind: MonthlyKind
  setHabitExemption: (frequency: HabitFrequency, periodKey: string, taskId: string, exempt: boolean) => void
  monthlyTasks: WeeklyTask[]
  monthlyExempt: MonthlyExempt
  monthlyPeriodPercent: Map<string, number>
  currentDate: Date
  habitMonthView: boolean
  monthPlanColumn: PeriodColumn | undefined
  priorityProps: HabitPriorityProps
  editingFrequency: HabitFrequency | undefined
  reorderVisible: (frequency: HabitFrequency, visibleIds: string[]) => void
  willpowerStones: WillpowerStone[]
  meter: HabitMeterProps
  viewFlags: HabitViewToggleFlags
  sortBag: HabitSortBag
  periodWells: HabitsTabControlsProps["goodDays"]
  habitMonthWindow: HabitMonthWindowMode
  habitBirthday: HabitBirthday
  setHabitMonthWindow: (mode: HabitMonthWindowMode) => void
  setHabitBirthday: (birthday: HabitBirthday) => void
  setEditingTask: (task: WeeklyTask | null) => void
  setDefaultFrequency: (frequency: HabitFrequency) => void
  setShowTaskForm: (open: boolean) => void
}) {
  return (
    <HabitDeskFrame
      value="monthly"
      exemptionWand={meter.exemptionWand}
      missedOpWand={meter.missedOpWand}
      stones={willpowerStones}
      well={
        !hydrated ? (
          <HabitSheetLoading />
        ) : (
          <PeriodHabitList
            tasks={monthlyRows}
            periods={monthSheetPeriods}
            data={monthlyHabitData}
            onUpdate={(taskId, periodDate, c) => updateMonthlyHabitCompletion(taskId, periodDate, c)}
            onEdit={onEditTask}
            hideCompleted={hideCompletedToday}
            exemptionWand={meter.exemptionWand}
            missedOpWand={meter.missedOpWand}
            hideCompletedAndMissed={hideCompletedAndMissed}
            exemptionKindFor={monthlyKind}
            onSetExempt={(taskId, periodKey, _periodDate, exempt) =>
              setHabitExemption("monthly", periodKey, taskId, exempt)
            }
            calculateTaskPercentage={(taskId) => {
              const task = monthlyTasks.find((row) => row.id === taskId)
              if (!task) return 0
              if (monthPeriods.length > 0 && monthPeriods.every((period) => monthlyExempt(task, period.key))) return null
              return monthlyPeriodPercent.get(taskId) ?? 0
            }}
            calculatePeriodPercentage={(periodKey) => {
              const period = monthPeriods.find((p) => p.key === periodKey)
              if (!period) return 0
              if (monthlyTasks.length > 0 && monthlyTasks.every((task) => monthlyExempt(task, periodKey))) return null
              return calculatePeriodColumnPercentage(period, monthlyTasks, monthlyHabitData, monthlyExempt)
            }}
            completionLabel="Monthly completion"
            emptyLabel="No monthly habits yet. Add one to get started."
            asOf={currentDate}
            frequency="monthly"
            detailColumn={habitMonthView}
            {...priorityProps}
            onReorder={editingFrequency === "monthly" ? (ids) => reorderVisible("monthly", ids) : undefined}
          />
        )
      }
      controls={
        <HabitsTabControls
          {...meter}
          viewToggles={habitViewToggles("monthly", viewFlags)}
          sortTools={habitSortTools(sortBag, "monthly", monthlyShown, "habit-sort-monthly")}
          goodDays={habitTab === "monthly" ? periodWells : undefined}
          monthWindow={
            <HabitMonthWindowControl
              mode={habitMonthWindow}
              birthday={habitBirthday}
              onMode={setHabitMonthWindow}
              onBirthday={setHabitBirthday}
            />
          }
          toggles={["loadingBar", "smallLeds"]}
          loadingBarId="loading-bar-monthly"
          smallLedsId="small-leds-monthly"
          onNewHabit={() => {
            setEditingTask(null)
            setDefaultFrequency("monthly")
            setShowTaskForm(true)
          }}
        />
      }
      plan={
        hydrated && monthPlanColumn ? (
          <HabitPlanLog
            period="month"
            periodKey={monthPlanColumn.key}
            legend={`Month Plan — ${format(monthPlanColumn.date, "MMMM yyyy")}`}
            placeholder="Write your month plan, goals, and objectives..."
          />
        ) : null
      }
    />
  )
}
