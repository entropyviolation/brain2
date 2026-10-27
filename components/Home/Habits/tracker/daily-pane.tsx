/**
 * tracker/daily-pane.tsx — Daily Habits sheet.
 *
 * Heatmap replaces the well when Heatmap View is on. Day View adds the
 * plan log under the desk. Row percents still return null when the week
 * is entirely exempt.
 */
"use client"

import { format } from "date-fns"
import { TaskGrid } from "@/components/Home/Habits/task-grid"
import { HabitHeatmap } from "@/components/Home/Habits/habit-heatmap"
import { HabitsTabControls } from "@/components/Home/Habits/habits-tab-controls"
import { calculateDayPercentageAV } from "@/lib/calculations"
import { formatLocalDateKey, parseLocalDate } from "@/lib/date-utils"
import type { HabitFrequency, TaskCompletion, WeeklyData, WeeklyTask } from "@/lib/types"
import type { WillpowerStone } from "@/lib/willpower-stones"
import type { GoodDaySummary } from "@/lib/habit-accomplishment"
import { HabitDeskFrame, type HabitMeterProps, type HabitPriorityProps } from "@/components/Home/Habits/tracker/habit-desk-frame"
import { HabitPlanLog } from "@/components/Home/Habits/tracker/habit-plan-log"
import { HabitSheetLoading } from "@/components/Home/Habits/tracker/habit-sheet-loading"
import { habitSortTools, type HabitSortBag } from "@/components/Home/Habits/tracker/habit-sort-tools"
import { habitViewToggles, type HabitViewToggleFlags } from "@/components/Home/Habits/tracker/view-toggles"
import type { DailyExempt, DailyKind } from "@/components/Home/Habits/tracker/daily-model"

export function DailyPane({
  hydrated,
  habitViewMode,
  dailyRows,
  dailyShown,
  weeklyData,
  currentDate,
  onEditTask,
  hideCompletedToday,
  dailyWeekPercent,
  dailyKind,
  setHabitExemption,
  updateCompletion,
  hideCompletedAndMissed,
  groupHabitsByKind,
  dailyTasks,
  dailyExempt,
  weekDates,
  habitDayView,
  priorityProps,
  editingFrequency,
  reorderVisible,
  willpowerStones,
  meter,
  viewFlags,
  sortBag,
  goodDays,
  setShowGoodDays,
  setEditingTask,
  setDefaultFrequency,
  setShowTaskForm,
  habitTab,
}: {
  hydrated: boolean
  habitViewMode: "grid" | "heatmap"
  dailyRows: WeeklyTask[]
  dailyShown: WeeklyTask[]
  weeklyData: WeeklyData
  currentDate: Date
  onEditTask: (task: WeeklyTask) => void
  hideCompletedToday: boolean
  dailyWeekPercent: Map<string, number>
  dailyKind: DailyKind
  setHabitExemption: (frequency: HabitFrequency, periodKey: string, taskId: string, exempt: boolean) => void
  updateCompletion: (taskId: string, date: Date, completion: TaskCompletion) => void
  hideCompletedAndMissed: boolean
  groupHabitsByKind: boolean
  dailyTasks: WeeklyTask[]
  dailyExempt: DailyExempt
  weekDates: Date[]
  habitDayView: boolean
  priorityProps: HabitPriorityProps
  editingFrequency: HabitFrequency | undefined
  reorderVisible: (frequency: HabitFrequency, visibleIds: string[]) => void
  willpowerStones: WillpowerStone[]
  meter: HabitMeterProps
  viewFlags: HabitViewToggleFlags
  sortBag: HabitSortBag
  goodDays: GoodDaySummary
  setShowGoodDays: (open: boolean) => void
  setEditingTask: (task: WeeklyTask | null) => void
  setDefaultFrequency: (frequency: HabitFrequency) => void
  setShowTaskForm: (open: boolean) => void
  habitTab: HabitFrequency
}) {
  const dayPlanKey = formatLocalDateKey(currentDate)
  return (
    <HabitDeskFrame
      value="daily"
      exemptionWand={meter.exemptionWand}
      missedOpWand={meter.missedOpWand}
      stones={willpowerStones}
      well={
        !hydrated ? (
          <HabitSheetLoading />
        ) : habitViewMode === "heatmap" ? (
          <HabitHeatmap
            tasks={dailyRows}
            data={weeklyData}
            asOf={currentDate}
            frequency="daily"
            onEditTask={onEditTask}
            hideCompleted={hideCompletedToday}
            periodPercentFor={(taskId) => dailyWeekPercent.get(taskId) ?? 0}
            focusKey={formatLocalDateKey(currentDate)}
            exemptionWand={meter.exemptionWand}
            exemptionKindFor={dailyKind}
            onToggleExempt={(taskId, periodKey, exempt) => setHabitExemption("daily", periodKey, taskId, exempt)}
            missedOpWand={meter.missedOpWand}
            hideCompletedAndMissed={hideCompletedAndMissed}
            onToggleMissed={(taskId, periodKey, missed, missReason) => {
              const date = parseLocalDate(periodKey)
              if (!date) return
              const text = missed ? (missReason?.trim() ?? "") : ""
              updateCompletion(taskId, date, { missedOpportunity: missed, missReason: text })
            }}
            {...priorityProps}
          />
        ) : (
          <TaskGrid
            groupByKind={groupHabitsByKind}
            tasks={dailyRows}
            weeklyData={weeklyData}
            weekDates={weekDates}
            onUpdateTaskCompletion={updateCompletion}
            onEditTask={onEditTask}
            calculateTaskPercentage={(taskId) => {
              const task = dailyTasks.find((row) => row.id === taskId)
              if (!task) return 0
              if (weekDates.length > 0 && weekDates.every((date) => dailyExempt(task, formatLocalDateKey(date)))) {
                return null
              }
              return dailyWeekPercent.get(taskId) ?? 0
            }}
            calculateDayPercentage={(date, index) => {
              const key = formatLocalDateKey(date)
              if (dailyTasks.length > 0 && dailyTasks.every((task) => dailyExempt(task, key))) return null
              return calculateDayPercentageAV(key, dailyTasks, weeklyData, index, dailyExempt)
            }}
            hideCompleted={hideCompletedToday}
            exemptionWand={meter.exemptionWand}
            missedOpWand={meter.missedOpWand}
            hideCompletedAndMissed={hideCompletedAndMissed}
            exemptionKindFor={dailyKind}
            onSetExempt={(taskId, date, exempt) =>
              setHabitExemption("daily", formatLocalDateKey(date), taskId, exempt)
            }
            viewMode="day"
            dayView={habitDayView}
            selectedDate={currentDate}
            {...priorityProps}
            onReorder={editingFrequency === "daily" ? (ids) => reorderVisible("daily", ids) : undefined}
          />
        )
      }
      controls={
        <HabitsTabControls
          {...meter}
          viewToggles={habitViewToggles("daily", viewFlags)}
          sortTools={habitSortTools(sortBag, "daily", dailyShown, "habit-sort")}
          goodDays={{
            streak: goodDays.streak,
            last30Count: goodDays.last30Count,
            onClick: () => setShowGoodDays(true),
          }}
          toggles={["loadingBar", "smallLeds"]}
          loadingBarId="loading-bar"
          smallLedsId="small-leds"
          onNewHabit={() => {
            setEditingTask(null)
            setDefaultFrequency(habitTab)
            setShowTaskForm(true)
          }}
        />
      }
      plan={
        hydrated && habitDayView ? (
          <HabitPlanLog
            period="day"
            periodKey={dayPlanKey}
            legend={`Day Plan — ${format(currentDate, "MMMM dd, yyyy")}`}
            placeholder="Write your day plan, goals, and objectives..."
            size="day"
          />
        ) : null
      }
    />
  )
}
