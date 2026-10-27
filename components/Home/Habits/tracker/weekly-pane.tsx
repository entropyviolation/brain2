/**
 * tracker/weekly-pane.tsx — Weekly Habits sheet.
 *
 * Week View shows one column. Percents and the span grade still use the
 * full week window. An all-exempt row or column returns null.
 */
"use client"

import { PeriodHabitList, type PeriodColumn } from "@/components/Home/Habits/period-habit-list"
import { HabitsTabControls, type HabitsTabControlsProps } from "@/components/Home/Habits/panel/habits-tab-controls"
import { HabitWeekWindowControl } from "@/components/Home/Habits/panel/habit-week-window-control"
import { calculatePeriodColumnPercentage } from "@/lib/calculations"
import type { HabitWeekWindowMode } from "@/lib/habit-week-window"
import type { HabitFrequency, TaskCompletion, WeeklyData, WeeklyTask } from "@/lib/types"
import type { WillpowerStone } from "@/lib/willpower-stones"
import type { HabitFreqTab } from "@/lib/app-navigation"
import { HabitDeskFrame, type HabitMeterProps, type HabitPriorityProps } from "@/components/Home/Habits/tracker/habit-desk-frame"
import { HabitPlanLog, weekPlanLegend } from "@/components/Home/Habits/tracker/habit-plan-log"
import { HabitSheetLoading } from "@/components/Home/Habits/tracker/habit-sheet-loading"
import { habitSortTools, type HabitSortBag } from "@/components/Home/Habits/tracker/habit-sort-tools"
import { habitViewToggles, type HabitViewToggleFlags } from "@/components/Home/Habits/tracker/view-toggles"
import type { WeeklyExempt, WeeklyKind } from "@/components/Home/Habits/tracker/weekly-model"

export function WeeklyPane({
  hydrated,
  habitTab,
  weeklyRows,
  weeklyShown,
  weekSheetPeriods,
  weekPeriods,
  weeklyHabitData,
  updateWeeklyHabitCompletion,
  onEditTask,
  hideCompletedToday,
  weeklyKind,
  setHabitExemption,
  weeklyTasks,
  weeklyExempt,
  weeklyPeriodPercent,
  currentDate,
  habitWeekView,
  weekPlanColumn,
  priorityProps,
  editingFrequency,
  reorderVisible,
  willpowerStones,
  meter,
  viewFlags,
  sortBag,
  periodWells,
  habitWeekWindow,
  setHabitWeekWindow,
  setEditingTask,
  setDefaultFrequency,
  setShowTaskForm,
  hideCompletedAndMissed,
}: {
  hydrated: boolean
  habitTab: HabitFreqTab
  weeklyRows: WeeklyTask[]
  weeklyShown: WeeklyTask[]
  weekSheetPeriods: PeriodColumn[]
  weekPeriods: PeriodColumn[]
  weeklyHabitData: WeeklyData
  updateWeeklyHabitCompletion: (taskId: string, weekStart: Date, completion: TaskCompletion) => void
  onEditTask: (task: WeeklyTask) => void
  hideCompletedToday: boolean
  hideCompletedAndMissed: boolean
  weeklyKind: WeeklyKind
  setHabitExemption: (frequency: HabitFrequency, periodKey: string, taskId: string, exempt: boolean) => void
  weeklyTasks: WeeklyTask[]
  weeklyExempt: WeeklyExempt
  weeklyPeriodPercent: Map<string, number>
  currentDate: Date
  habitWeekView: boolean
  weekPlanColumn: PeriodColumn | undefined
  priorityProps: HabitPriorityProps
  editingFrequency: HabitFrequency | undefined
  reorderVisible: (frequency: HabitFrequency, visibleIds: string[]) => void
  willpowerStones: WillpowerStone[]
  meter: HabitMeterProps
  viewFlags: HabitViewToggleFlags
  sortBag: HabitSortBag
  periodWells: HabitsTabControlsProps["goodDays"]
  habitWeekWindow: HabitWeekWindowMode
  setHabitWeekWindow: (mode: HabitWeekWindowMode) => void
  setEditingTask: (task: WeeklyTask | null) => void
  setDefaultFrequency: (frequency: HabitFrequency) => void
  setShowTaskForm: (open: boolean) => void
}) {
  return (
    <HabitDeskFrame
      value="weekly"
      exemptionWand={meter.exemptionWand}
      missedOpWand={meter.missedOpWand}
      stones={willpowerStones}
      well={
        !hydrated ? (
          <HabitSheetLoading />
        ) : (
          <PeriodHabitList
            tasks={weeklyRows}
            periods={weekSheetPeriods}
            data={weeklyHabitData}
            onUpdate={(taskId, periodDate, c) => updateWeeklyHabitCompletion(taskId, periodDate, c)}
            onEdit={onEditTask}
            hideCompleted={hideCompletedToday}
            exemptionWand={meter.exemptionWand}
            missedOpWand={meter.missedOpWand}
            hideCompletedAndMissed={hideCompletedAndMissed}
            exemptionKindFor={weeklyKind}
            onSetExempt={(taskId, periodKey, _periodDate, exempt) =>
              setHabitExemption("weekly", periodKey, taskId, exempt)
            }
            calculateTaskPercentage={(taskId) => {
              const task = weeklyTasks.find((row) => row.id === taskId)
              if (!task) return 0
              if (weekPeriods.length > 0 && weekPeriods.every((period) => weeklyExempt(task, period.key))) return null
              return weeklyPeriodPercent.get(taskId) ?? 0
            }}
            calculatePeriodPercentage={(periodKey) => {
              const period = weekPeriods.find((p) => p.key === periodKey)
              if (!period) return 0
              if (weeklyTasks.length > 0 && weeklyTasks.every((task) => weeklyExempt(task, periodKey))) return null
              return calculatePeriodColumnPercentage(period, weeklyTasks, weeklyHabitData, weeklyExempt)
            }}
            completionLabel="Weekly completion"
            emptyLabel="No weekly habits yet. Add one to get started."
            asOf={currentDate}
            frequency="weekly"
            detailColumn={habitWeekView}
            {...priorityProps}
            onReorder={editingFrequency === "weekly" ? (ids) => reorderVisible("weekly", ids) : undefined}
          />
        )
      }
      controls={
        <HabitsTabControls
          {...meter}
          viewToggles={habitViewToggles("weekly", viewFlags)}
          sortTools={habitSortTools(sortBag, "weekly", weeklyShown, "habit-sort-weekly")}
          goodDays={habitTab === "weekly" ? periodWells : undefined}
          weekWindow={<HabitWeekWindowControl mode={habitWeekWindow} onMode={setHabitWeekWindow} />}
          toggles={["loadingBar", "smallLeds"]}
          loadingBarId="loading-bar-weekly"
          smallLedsId="small-leds-weekly"
          onNewHabit={() => {
            setEditingTask(null)
            setDefaultFrequency("weekly")
            setShowTaskForm(true)
          }}
        />
      }
      plan={
        hydrated && weekPlanColumn ? (
          <HabitPlanLog
            period="week"
            periodKey={weekPlanColumn.key}
            legend={weekPlanLegend(weekPlanColumn)}
            placeholder="Write your week plan, priorities, and focus areas..."
          />
        ) : null
      }
    />
  )
}
