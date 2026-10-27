/**
 * tracker/season-pane.tsx — Season Habits sheet.
 *
 * Season View shows one column. Percents and the span grade still use the
 * full season window. The pane and its key both carry `data-season`.
 */
"use client"

import { PeriodHabitList, type PeriodColumn } from "@/components/Home/Habits/period-habit-list"
import { HabitsTabControls, type HabitsTabControlsProps } from "@/components/Home/Habits/habits-tab-controls"
import { calculatePeriodColumnPercentage } from "@/lib/calculations"
import { quarterLabel, seasonOfDate, seasonSlug } from "@/lib/seasons"
import type { HabitFrequency, TaskCompletion, WeeklyData, WeeklyTask } from "@/lib/types"
import type { WillpowerStone } from "@/lib/willpower-stones"
import type { HabitFreqTab } from "@/lib/app-navigation"
import { HabitDeskFrame, type HabitMeterProps, type HabitPriorityProps } from "@/components/Home/Habits/tracker/habit-desk-frame"
import { HabitPlanLog } from "@/components/Home/Habits/tracker/habit-plan-log"
import { HabitSheetLoading } from "@/components/Home/Habits/tracker/habit-sheet-loading"
import { habitSortTools, type HabitSortBag } from "@/components/Home/Habits/tracker/habit-sort-tools"
import { habitViewToggles, type HabitViewToggleFlags } from "@/components/Home/Habits/tracker/view-toggles"
import type { QuarterlyExempt, QuarterlyKind } from "@/components/Home/Habits/tracker/season-model"

export function SeasonPane({
  hydrated,
  habitTab,
  quarterlyRows,
  quarterlyShown,
  seasonSheetPeriods,
  seasonPeriods,
  quarterlyHabitData,
  updateQuarterlyHabitCompletion,
  onEditTask,
  hideCompletedToday,
  hideCompletedAndMissed,
  quarterlyKind,
  setHabitExemption,
  quarterlyTasks,
  quarterlyExempt,
  quarterlyPeriodPercent,
  currentDate,
  currentQuarter,
  habitSeasonView,
  seasonPlanColumn,
  priorityProps,
  editingFrequency,
  reorderVisible,
  willpowerStones,
  meter,
  viewFlags,
  sortBag,
  periodWells,
  setEditingTask,
  setDefaultFrequency,
  setShowTaskForm,
}: {
  hydrated: boolean
  habitTab: HabitFreqTab
  quarterlyRows: WeeklyTask[]
  quarterlyShown: WeeklyTask[]
  seasonSheetPeriods: PeriodColumn[]
  seasonPeriods: PeriodColumn[]
  quarterlyHabitData: WeeklyData
  updateQuarterlyHabitCompletion: (taskId: string, quarterStart: Date, completion: TaskCompletion) => void
  onEditTask: (task: WeeklyTask) => void
  hideCompletedToday: boolean
  hideCompletedAndMissed: boolean
  quarterlyKind: QuarterlyKind
  setHabitExemption: (frequency: HabitFrequency, periodKey: string, taskId: string, exempt: boolean) => void
  quarterlyTasks: WeeklyTask[]
  quarterlyExempt: QuarterlyExempt
  quarterlyPeriodPercent: Map<string, number>
  currentDate: Date
  currentQuarter: Date
  habitSeasonView: boolean
  seasonPlanColumn: PeriodColumn | undefined
  priorityProps: HabitPriorityProps
  editingFrequency: HabitFrequency | undefined
  reorderVisible: (frequency: HabitFrequency, visibleIds: string[]) => void
  willpowerStones: WillpowerStone[]
  meter: HabitMeterProps
  viewFlags: HabitViewToggleFlags
  sortBag: HabitSortBag
  periodWells: HabitsTabControlsProps["goodDays"]
  setEditingTask: (task: WeeklyTask | null) => void
  setDefaultFrequency: (frequency: HabitFrequency) => void
  setShowTaskForm: (open: boolean) => void
}) {
  return (
    <HabitDeskFrame
      value="quarterly"
      season={seasonSlug(seasonOfDate(currentQuarter))}
      exemptionWand={meter.exemptionWand}
      missedOpWand={meter.missedOpWand}
      stones={willpowerStones}
      well={
        !hydrated ? (
          <HabitSheetLoading />
        ) : (
          <PeriodHabitList
            tasks={quarterlyRows}
            periods={seasonSheetPeriods}
            data={quarterlyHabitData}
            onUpdate={(taskId, periodDate, c) => updateQuarterlyHabitCompletion(taskId, periodDate, c)}
            onEdit={onEditTask}
            hideCompleted={hideCompletedToday}
            exemptionWand={meter.exemptionWand}
            missedOpWand={meter.missedOpWand}
            hideCompletedAndMissed={hideCompletedAndMissed}
            exemptionKindFor={quarterlyKind}
            onSetExempt={(taskId, periodKey, _periodDate, exempt) =>
              setHabitExemption("quarterly", periodKey, taskId, exempt)
            }
            calculateTaskPercentage={(taskId) => {
              const task = quarterlyTasks.find((row) => row.id === taskId)
              if (!task) return 0
              if (seasonPeriods.length > 0 && seasonPeriods.every((period) => quarterlyExempt(task, period.key))) {
                return null
              }
              return quarterlyPeriodPercent.get(taskId) ?? 0
            }}
            calculatePeriodPercentage={(periodKey) => {
              const period = seasonPeriods.find((p) => p.key === periodKey)
              if (!period) return 0
              if (quarterlyTasks.length > 0 && quarterlyTasks.every((task) => quarterlyExempt(task, periodKey))) {
                return null
              }
              return calculatePeriodColumnPercentage(period, quarterlyTasks, quarterlyHabitData, quarterlyExempt)
            }}
            completionLabel="Season completion"
            emptyLabel="No season habits yet. Add one to get started."
            asOf={currentDate}
            frequency="quarterly"
            detailColumn={habitSeasonView}
            {...priorityProps}
            onReorder={editingFrequency === "quarterly" ? (ids) => reorderVisible("quarterly", ids) : undefined}
          />
        )
      }
      controls={
        <HabitsTabControls
          {...meter}
          viewToggles={habitViewToggles("quarterly", viewFlags)}
          sortTools={habitSortTools(sortBag, "quarterly", quarterlyShown, "habit-sort-season")}
          goodDays={habitTab === "quarterly" ? periodWells : undefined}
          toggles={["loadingBar", "smallLeds"]}
          loadingBarId="loading-bar-season"
          smallLedsId="small-leds-season"
          onNewHabit={() => {
            setEditingTask(null)
            setDefaultFrequency("quarterly")
            setShowTaskForm(true)
          }}
        />
      }
      plan={
        hydrated && seasonPlanColumn ? (
          <HabitPlanLog
            period="quarter"
            periodKey={seasonPlanColumn.key}
            legend={`Season plan — ${quarterLabel(seasonPlanColumn.key)}`}
            placeholder="Write this season's plan — what the quarter is for..."
          />
        ) : null
      }
    />
  )
}
