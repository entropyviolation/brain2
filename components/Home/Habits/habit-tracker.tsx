/**
 * components/Home/Habits/habit-tracker.tsx — Habit tracker (daily / weekly / monthly)
 */
"use client"

import { useState, useEffect } from "react"
import { TaskGrid } from "@/components/Home/Habits/task-grid"
import { PeriodHabitList, filterHabitsByFrequency } from "@/components/Home/Habits/period-habit-list"
import { TaskFormDialog } from "@/components/Home/Habits/daily-task-form-dialog"
import { GradeBreakdownDialog } from "@/components/Home/Habits/grade-breakdown-dialog"
import { OutputGradeBreakdownDialog } from "@/components/Home/Habits/output-grade-breakdown-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PlusCircle, Settings, EyeOff } from "lucide-react"
import { type WeeklyTask as Task, type TaskCompletion } from "@/lib/types"
import {
  calculateTaskPercentage,
  calculateDayPercentageAV,
  calculateWeekToDateGrade,
  calculateWeekToDateOutputGrade,
} from "@/lib/calculations"
import { Progress } from "@/components/ui/progress"
import { getWeekStartDate, getWeekDates, formatLocalDateKey, getWeekString } from "@/lib/date-utils"
import { WeekNavigation } from "@/components/Home/Habits/week-navigation"
import { SettingsDialog } from "@/components/Home/Habits/settings-dialog"
import { useHabitsStore } from "@/lib/habits-store"
import { format } from "date-fns"
import "./habit-grid.css"

export function WeeklyTaskTracker({ currentDate = new Date() }: { currentDate?: Date }) {
  const tasks = useHabitsStore((s) => s.tasks)
  const weeklyData = useHabitsStore((s) => s.weeklyData)
  const weeklyHabitData = useHabitsStore((s) => s.weeklyHabitData)
  const monthlyHabitData = useHabitsStore((s) => s.monthlyHabitData)
  const addTaskToStore = useHabitsStore((s) => s.addTask)
  const updateTaskInStore = useHabitsStore((s) => s.updateTask)
  const deleteTaskFromStore = useHabitsStore((s) => s.deleteTask)
  const updateCompletion = useHabitsStore((s) => s.updateCompletion)
  const updateWeeklyHabitCompletion = useHabitsStore((s) => s.updateWeeklyHabitCompletion)
  const updateMonthlyHabitCompletion = useHabitsStore((s) => s.updateMonthlyHabitCompletion)
  const importData = useHabitsStore((s) => s.importData)
  const resetData = useHabitsStore((s) => s.resetData)
  const gradeTolerance = useHabitsStore((s) => s.gradeTolerance)
  const setGradeTolerance = useHabitsStore((s) => s.setGradeTolerance)
  const outputGradeTolerance = useHabitsStore((s) => s.outputGradeTolerance)
  const setOutputGradeTolerance = useHabitsStore((s) => s.setOutputGradeTolerance)

  const [showTaskForm, setShowTaskForm] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showGradeBreakdown, setShowGradeBreakdown] = useState(false)
  const [showOutputGradeBreakdown, setShowOutputGradeBreakdown] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [hideCompletedToday, setHideCompletedToday] = useState(false)
  const [habitTab, setHabitTab] = useState<"daily" | "weekly" | "monthly">("daily")
  const [defaultFrequency, setDefaultFrequency] = useState<"daily" | "weekly" | "monthly">("daily")

  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getWeekStartDate(new Date()))
  const [weekDates, setWeekDates] = useState<Date[]>(getWeekDates(getWeekStartDate(new Date())))

  useEffect(() => {
    setWeekDates(getWeekDates(currentWeekStart))
  }, [currentWeekStart])

  const dailyTasks = filterHabitsByFrequency(tasks, "daily")
  const weeklyTasks = filterHabitsByFrequency(tasks, "weekly")
  const monthlyTasks = filterHabitsByFrequency(tasks, "monthly")

  const handleAddTask = (task: Task) => {
    if (editingTask) {
      updateTaskInStore(task)
      setEditingTask(null)
    } else {
      addTaskToStore({ ...task, id: `task-${Date.now()}`, frequency: task.frequency || defaultFrequency })
    }
    setShowTaskForm(false)
  }

  const handleEditTask = (task: Task) => {
    setEditingTask(task)
    setDefaultFrequency(task.frequency || "daily")
    setShowTaskForm(true)
  }

  const weekEndDate = new Date(currentWeekStart)
  weekEndDate.setDate(weekEndDate.getDate() + 6)

  const weekKey = getWeekString(currentWeekStart)
  const monthKey = format(new Date(), "yyyy-MM")
  const weekGrade = calculateWeekToDateGrade(dailyTasks, weeklyData, weekDates, currentDate, gradeTolerance)
  const outputGrade = calculateWeekToDateOutputGrade(
    dailyTasks,
    weeklyData,
    weekDates,
    currentDate,
    outputGradeTolerance,
  )
  const gradeThrough =
    weekGrade.daysIncluded === 0
      ? null
      : weekGrade.daysIncluded === 7
        ? "full week"
        : `through ${format(weekDates[weekGrade.daysIncluded - 1], "EEE")}`

  return (
    <div className="space-y-3">
      <div className="habit-tracker-toolbar">
        {habitTab === "daily" ? (
          <WeekNavigation
            currentWeekStart={currentWeekStart}
            weekEndDate={weekEndDate}
            onPreviousWeek={() => {
              const d = new Date(currentWeekStart)
              d.setDate(d.getDate() - 7)
              setCurrentWeekStart(d)
            }}
            onNextWeek={() => {
              const d = new Date(currentWeekStart)
              d.setDate(d.getDate() + 7)
              setCurrentWeekStart(d)
            }}
            onCurrentWeek={() => setCurrentWeekStart(getWeekStartDate(new Date()))}
          />
        ) : (
          <h3 className="text-base font-semibold">
            {habitTab === "weekly" ? `Week of ${format(currentWeekStart, "MMM d")}` : format(new Date(), "MMMM yyyy")}
          </h3>
        )}

        {habitTab === "daily" && (
          <div className="habit-grades">
          <button
            type="button"
            className="habit-week-grade"
            title="Click for raw vs curved breakdown"
            onClick={() => setShowGradeBreakdown(true)}
          >
            <span className="text-muted-foreground whitespace-nowrap">Week grade</span>
            <strong>{weekGrade.daysIncluded === 0 ? "—" : `${weekGrade.grade.toFixed(0)}%`}</strong>
            {gradeThrough && <span className="text-muted-foreground whitespace-nowrap text-[11px]">{gradeThrough}</span>}
            {weekGrade.daysIncluded > 0 && (
              <Progress
                value={Math.min(100, weekGrade.grade)}
                className="h-1.5 w-[72px] shrink-0 rounded-full bg-gray-100 dark:bg-gray-800"
                indicatorClassName={
                  weekGrade.grade >= 100
                    ? "bg-gradient-to-r from-[#8cd4a5] to-[#9fc2a5]"
                    : weekGrade.grade >= 75
                      ? "bg-gradient-to-r from-[#8b7ecc] to-[#b89fbf]"
                      : weekGrade.grade >= 50
                        ? "bg-gradient-to-r from-[#5f756d] to-[#adc29f]"
                        : weekGrade.grade >= 25
                          ? "bg-gradient-to-r from-[#571833] to-[#130ead]"
                          : "bg-gray-400"
                }
              />
            )}
          </button>
          <button
            type="button"
            className="habit-week-grade"
            title="Click for elapsed row completion breakdown"
            onClick={() => setShowOutputGradeBreakdown(true)}
          >
            <span className="text-muted-foreground whitespace-nowrap">Perfect output</span>
            <strong>
              {outputGrade.daysIncluded === 0 || outputGrade.habits.length === 0
                ? "—"
                : `${outputGrade.grade.toFixed(0)}%`}
            </strong>
            {gradeThrough && <span className="text-muted-foreground whitespace-nowrap text-[11px]">{gradeThrough}</span>}
            {outputGrade.daysIncluded > 0 && outputGrade.habits.length > 0 && (
              <Progress
                value={Math.min(100, outputGrade.grade)}
                className="h-1.5 w-[72px] shrink-0 rounded-full bg-gray-100 dark:bg-gray-800"
                indicatorClassName={
                  outputGrade.grade >= 100
                    ? "bg-gradient-to-r from-[#8cd4a5] to-[#9fc2a5]"
                    : outputGrade.grade >= 75
                      ? "bg-gradient-to-r from-[#8b7ecc] to-[#b89fbf]"
                      : outputGrade.grade >= 50
                        ? "bg-gradient-to-r from-[#5f756d] to-[#adc29f]"
                        : outputGrade.grade >= 25
                          ? "bg-gradient-to-r from-[#571833] to-[#130ead]"
                          : "bg-gray-400"
                }
              />
            )}
          </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {habitTab === "daily" && (
            <div className="flex items-center gap-2">
              <Switch id="hide-done" checked={hideCompletedToday} onCheckedChange={setHideCompletedToday} />
              <Label htmlFor="hide-done" className="text-sm flex items-center gap-1 cursor-pointer">
                <EyeOff className="h-3.5 w-3.5" />
                Hide completed today
              </Label>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowSettings(true)} className="gap-1.5">
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      <Tabs value={habitTab} onValueChange={(v) => setHabitTab(v as typeof habitTab)}>
        <TabsList>
          <TabsTrigger value="daily">Daily ({dailyTasks.length})</TabsTrigger>
          <TabsTrigger value="weekly">Weekly ({weeklyTasks.length})</TabsTrigger>
          <TabsTrigger value="monthly">Monthly ({monthlyTasks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="mt-2">
          <Card className="overflow-hidden border-none shadow-sm rounded-lg">
            <CardContent className="p-1">
              <TaskGrid
                tasks={dailyTasks}
                weeklyData={weeklyData}
                weekDates={weekDates}
                onUpdateTaskCompletion={updateCompletion}
                onEditTask={handleEditTask}
                onDeleteTask={deleteTaskFromStore}
                calculateTaskPercentage={(taskId) =>
                  calculateTaskPercentage(taskId, dailyTasks, weeklyData, weekDates)
                }
                calculateDayPercentage={(date, index) =>
                  calculateDayPercentageAV(formatLocalDateKey(date), dailyTasks, weeklyData, index)
                }
                hideCompleted={hideCompletedToday}
                viewMode="day"
                selectedDate={currentDate}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weekly" className="mt-4">
          <Card className="p-4">
            <PeriodHabitList
              tasks={weeklyTasks}
              periodKey={weekKey}
              data={weeklyHabitData}
              periodLabel={`This week (${format(currentWeekStart, "MMM d")} – ${format(weekEndDate, "MMM d")})`}
              onUpdate={(taskId, c) => updateWeeklyHabitCompletion(taskId, currentWeekStart, c)}
              onEdit={handleEditTask}
              onDelete={deleteTaskFromStore}
            />
          </Card>
        </TabsContent>

        <TabsContent value="monthly" className="mt-4">
          <Card className="p-4">
            <PeriodHabitList
              tasks={monthlyTasks}
              periodKey={monthKey}
              data={monthlyHabitData}
              periodLabel={format(new Date(), "MMMM yyyy")}
              onUpdate={(taskId, c) => updateMonthlyHabitCompletion(taskId, new Date(), c)}
              onEdit={handleEditTask}
              onDelete={deleteTaskFromStore}
            />
          </Card>
        </TabsContent>
      </Tabs>

      <div className="fixed bottom-8 right-8">
        <Button
          onClick={() => {
            setEditingTask(null)
            setDefaultFrequency(habitTab)
            setShowTaskForm(true)
          }}
          size="lg"
          className="rounded-full h-14 w-14 shadow-xl bg-gradient-primary hover:opacity-90"
        >
          <PlusCircle className="h-6 w-6" />
          <span className="sr-only">Add Habit</span>
        </Button>
      </div>

      <TaskFormDialog
        open={showTaskForm}
        onOpenChange={setShowTaskForm}
        onSubmit={handleAddTask as (t: Task) => void}
        initialTask={editingTask}
        defaultFrequency={defaultFrequency}
      />

      <GradeBreakdownDialog
        open={showGradeBreakdown}
        onOpenChange={setShowGradeBreakdown}
        result={weekGrade}
        onToleranceChange={setGradeTolerance}
      />

      <OutputGradeBreakdownDialog
        open={showOutputGradeBreakdown}
        onOpenChange={setShowOutputGradeBreakdown}
        result={outputGrade}
        onToleranceChange={setOutputGradeTolerance}
      />

      <SettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        tasks={tasks}
        weeklyData={weeklyData}
        onImportData={importData}
        onResetData={resetData}
      />
    </div>
  )
}

export default WeeklyTaskTracker
