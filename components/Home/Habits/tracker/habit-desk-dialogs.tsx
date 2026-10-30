/**
 * tracker/habit-desk-dialogs.tsx — Habit form, both grade sheets, good periods, settings.
 *
 * Rendered inside `.hab-frame` and outside `Tabs`, so a tab change does not
 * unmount an open sheet.
 */
"use client"

import { TaskFormDialog } from "@/components/Home/Habits/daily-task-form-dialog"
import { GradeBreakdownDialog } from "@/components/Home/Habits/dialogs/grade-breakdown-dialog"
import { OutputGradeBreakdownDialog } from "@/components/Home/Habits/dialogs/output-grade-breakdown-dialog"
import { GoodDaysDialog } from "@/components/Home/Habits/dialogs/good-days-dialog"
import { SettingsDialog } from "@/components/Home/Habits/settings-dialog"
import { rawDayCompletionPercent, type GoodDaySummary, type GoodPeriodSummary } from "@/lib/habit-accomplishment"
import type { OutputGradeResult, WeekGradeResult } from "@/lib/calculations"
import type { Category, HabitFrequency, WeeklyData, WeeklyTask } from "@/lib/types"
import type { DailyExempt } from "@/components/Home/Habits/tracker/daily-model"

export function HabitDeskDialogs({
  showTaskForm,
  setShowTaskForm,
  handleAddTask,
  deleteTaskFromStore,
  setEditingTask,
  editingTask,
  defaultFrequency,
  showGradeBreakdown,
  setShowGradeBreakdown,
  activeGrade,
  setGradeTolerance,
  accomplishmentThreshold,
  accomplishmentBonus,
  gradePeriodUnit,
  gradeUsePriority,
  setGradeUsePriority,
  activePrioGrade,
  habitTab,
  weekAverage,
  showOutputGradeBreakdown,
  setShowOutputGradeBreakdown,
  activeOutput,
  setOutputGradeTolerance,
  outputUsePriority,
  setOutputUsePriority,
  activePrioOutput,
  showGoodDays,
  setShowGoodDays,
  goodDays,
  goodPeriod,
  setAccomplishmentThreshold,
  setAccomplishmentBonus,
  goodDaysUsePriority,
  setGoodDaysUsePriority,
  dailyTasks,
  weeklyData,
  goodDayAsOf,
  dailyExempt,
  todayPrioRaw,
  showSettings,
  setShowSettings,
  tasks,
  importData,
  resetData,
}: {
  showTaskForm: boolean
  setShowTaskForm: (open: boolean) => void
  handleAddTask: (task: WeeklyTask) => void
  deleteTaskFromStore: (taskId: string) => void
  setEditingTask: (task: WeeklyTask | null) => void
  editingTask: WeeklyTask | null
  defaultFrequency: HabitFrequency
  showGradeBreakdown: boolean
  setShowGradeBreakdown: (open: boolean) => void
  activeGrade: WeekGradeResult
  setGradeTolerance: (tolerance: number) => void
  accomplishmentThreshold: number
  accomplishmentBonus: number
  gradePeriodUnit: "season" | "month" | "week" | "day"
  gradeUsePriority: boolean
  setGradeUsePriority: (value: boolean) => void
  activePrioGrade: number | null
  habitTab: string
  weekAverage: number | null
  showOutputGradeBreakdown: boolean
  setShowOutputGradeBreakdown: (open: boolean) => void
  activeOutput: OutputGradeResult
  setOutputGradeTolerance: (tolerance: number) => void
  outputUsePriority: boolean
  setOutputUsePriority: (value: boolean) => void
  activePrioOutput: number | null
  showGoodDays: boolean
  setShowGoodDays: (open: boolean) => void
  goodDays: GoodDaySummary
  goodPeriod: GoodPeriodSummary | null
  setAccomplishmentThreshold: (threshold: number) => void
  setAccomplishmentBonus: (bonus: number) => void
  goodDaysUsePriority: boolean
  setGoodDaysUsePriority: (value: boolean) => void
  dailyTasks: WeeklyTask[]
  weeklyData: WeeklyData
  goodDayAsOf: Date
  dailyExempt: DailyExempt
  todayPrioRaw: number | null
  showSettings: boolean
  setShowSettings: (open: boolean) => void
  tasks: WeeklyTask[]
  importData: (data: {
    tasks: WeeklyTask[]
    weeklyData: WeeklyData
    weeklyHabitData?: WeeklyData
    monthlyHabitData?: WeeklyData
    quarterlyHabitData?: WeeklyData
    categories?: Category[]
  }) => void
  resetData: () => void
}) {
  return (
    <>
      <TaskFormDialog
        open={showTaskForm}
        onOpenChange={setShowTaskForm}
        onSubmit={handleAddTask as (t: WeeklyTask) => void}
        onDelete={(taskId) => {
          deleteTaskFromStore(taskId)
          setShowTaskForm(false)
          setEditingTask(null)
        }}
        initialTask={editingTask}
        defaultFrequency={defaultFrequency}
      />
      <GradeBreakdownDialog
        open={showGradeBreakdown}
        onOpenChange={setShowGradeBreakdown}
        result={activeGrade}
        onToleranceChange={setGradeTolerance}
        accomplishmentThreshold={accomplishmentThreshold}
        accomplishmentBonus={accomplishmentBonus}
        periodUnit={gradePeriodUnit}
        usePriority={gradeUsePriority}
        onUsePriorityChange={setGradeUsePriority}
        priorityScore={activePrioGrade}
        weekAverage={habitTab === "daily" ? weekAverage : null}
      />
      <OutputGradeBreakdownDialog
        open={showOutputGradeBreakdown}
        onOpenChange={setShowOutputGradeBreakdown}
        result={activeOutput}
        onToleranceChange={setOutputGradeTolerance}
        periodUnit={gradePeriodUnit}
        usePriority={outputUsePriority}
        onUsePriorityChange={setOutputUsePriority}
        priorityScore={activePrioOutput}
      />
      <GoodDaysDialog
        open={showGoodDays}
        onOpenChange={setShowGoodDays}
        summary={goodDays}
        period={habitTab === "daily" ? null : goodPeriod}
        onThresholdChange={setAccomplishmentThreshold}
        onBonusChange={setAccomplishmentBonus}
        usePriority={goodDaysUsePriority}
        onUsePriorityChange={setGoodDaysUsePriority}
        todayOverall={
          habitTab === "daily" ? rawDayCompletionPercent(dailyTasks, weeklyData, goodDayAsOf, dailyExempt) : 0
        }
        todayPriority={todayPrioRaw}
      />
      <SettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        tasks={tasks}
        weeklyData={weeklyData}
        onImportData={importData}
        onResetData={resetData}
        accomplishmentThreshold={accomplishmentThreshold}
        accomplishmentBonus={accomplishmentBonus}
        onAccomplishmentThresholdChange={setAccomplishmentThreshold}
        onAccomplishmentBonusChange={setAccomplishmentBonus}
      />
    </>
  )
}
