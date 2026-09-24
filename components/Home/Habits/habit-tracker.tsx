/**
 * components/Home/Habits/habit-tracker.tsx — Habit tracker (daily / weekly / monthly)
 *
 * Header: CRT Habits title, milled period nav, raised Settings key. Daily /
 * Weekly / Monthly keys sit in a milled bay above the sheet (active = CRT +
 * power lamp; persist). Daily rail rockers: Heatmap View,
 * Day View (today + week %), Hide Completed Today (persisted), Loading Bar (10-pip totals;
 * Day View daily footer uses a wide fill + 10% ticks),
 * Small LEDs (15px Yes/No lamps vs fill the cell).
 * Sort / New habit / grades share the Habits Tab Control Panel on every tab.
 * Weekly / monthly always use the period spreadsheet (heatmap and Day View
 * are Daily-only). Grade meters are glass noble-gas tubes (`noble-gas-tube.tsx`).
 */
"use client"

import { useState, useEffect } from "react"
import { usePersistHydrated } from "@/lib/use-persist-hydrated"
import { TaskGrid } from "@/components/Home/Habits/task-grid"
import { PeriodHabitList, filterHabitsByFrequency, weekPeriodColumns, monthPeriodColumns } from "@/components/Home/Habits/period-habit-list"
import { HabitHeatmap } from "@/components/Home/Habits/habit-heatmap"
import { TaskFormDialog } from "@/components/Home/Habits/daily-task-form-dialog"
import { GradeBreakdownDialog } from "@/components/Home/Habits/grade-breakdown-dialog"
import { OutputGradeBreakdownDialog } from "@/components/Home/Habits/output-grade-breakdown-dialog"
import { GoodDaysDialog } from "@/components/Home/Habits/good-days-dialog"
import { CockpitSwitch } from "@/components/Home/Habits/cockpit-switch"
import { HabitSortControl } from "@/components/Home/Habits/habit-sort-control"
import { HabitsControlPanel } from "@/components/Home/Habits/habits-control-panel"
import { ExemptionWandButton } from "@/components/Home/Habits/exemption-wand-button"
import { weekWillpowerStones } from "@/lib/willpower-stones"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Settings } from "lucide-react"
import { type WeeklyTask as Task, type TaskCompletion } from "@/lib/types"
import {
  calculateTaskPercentage,
  calculateDayPercentageAV,
  calculateWeekToDateGrade,
  calculateWeekToDateOutputGrade,
  calculatePeriodTaskPercentage,
  calculatePeriodColumnPercentage,
  calculatePeriodGrade,
  calculatePeriodOutputGrade,
  gradeAsOfForVisibleWindow,
  type OutputGradeResult,
  type WeekGradeResult,
} from "@/lib/calculations"
import { NobleGasTube } from "@/components/Home/Habits/noble-gas-tube"
import {
  getWeekStartDate,
  getWeekDates,
  formatLocalDateKey,
  addCalendarDays,
  isSameLocalMonth,
  isSameLocalWeek,
} from "@/lib/date-utils"
import { WeekNavigation } from "@/components/Home/Habits/week-navigation"
import { SettingsDialog } from "@/components/Home/Habits/settings-dialog"
import { useHabitsStore } from "@/lib/habits-store"
import { useReviewsStore, localDayKey } from "@/lib/reviews-store"
import { useHabitTrackingSync, syncTrackedHabitsForTask } from "@/lib/habit-tracking-sync"
import { goodDaySummary, GOOD_DAYS_LOOKBACK, rawDayCompletionPercent } from "@/lib/habit-accomplishment"
import {
  blendPriorityScore,
  prioritizedHabits,
} from "@/lib/habit-priority"
import { effectiveSortDescending, sortHabits } from "@/lib/habit-sort"
import { exemptionKind, isHabitPeriodExempt } from "@/lib/habit-exemption"
import { useExemptionContext } from "@/lib/sleep-store"
import { format } from "date-fns"
import { APP_NAV_KEYS, HABIT_FREQ_TABS, readStoredDate, writeStoredDate } from "@/lib/app-navigation"
import { usePersistedTab } from "@/lib/use-persisted-tab"
import "./habit-grid.css"
import "./habit-chrome.css"
import "./noble-gas-tube.css"

const EMPTY_HABIT_PRIORITY_IDS: string[] = []

function openGrade(result: WeekGradeResult): number | null {
  if (result.days.length > 0 && result.days.every((day) => day.vacant)) return null
  return result.grade
}

function openOutput(result: OutputGradeResult): number | null {
  if (result.daysIncluded > 0 && result.habits.length === 0) return null
  return result.grade
}

function GradeFace({
  label,
  title,
  valueText,
  through,
  barValue,
  hue,
  onClick,
}: {
  label: string
  title: string
  valueText: string
  through: string | null
  barValue: number | null
  hue: string
  onClick: () => void
}) {
  const gas = label === "Perfect output" ? "xenon" : "argon"
  return (
    <button type="button" className="habit-week-grade" title={title} onClick={onClick}>
      <span className="text-muted-foreground">{label}</span>
      <strong>{valueText}</strong>
      {through && <span className="text-muted-foreground text-[11px]">{through}</span>}
      {barValue !== null && (
        <NobleGasTube
          value={Math.min(100, barValue)}
          gas={gas}
          hue={hue}
          label={label}
        />
      )}
    </button>
  )
}

export function WeeklyTaskTracker({ currentDate = new Date() }: { currentDate?: Date }) {
  useHabitTrackingSync()
  const hydrated = usePersistHydrated(useHabitsStore.persist)
  const tasks = useHabitsStore((s) => s.tasks)
  const morningHabitDayKey = localDayKey(currentDate)
  const morningHabitPriorities = useReviewsStore(
    (s) => s.getMorningReview(morningHabitDayKey)?.priorityHabitIds ?? EMPTY_HABIT_PRIORITY_IDS,
  )
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
  const accomplishmentThreshold = useHabitsStore((s) => s.accomplishmentThreshold)
  const setAccomplishmentThreshold = useHabitsStore((s) => s.setAccomplishmentThreshold)
  const accomplishmentBonus = useHabitsStore((s) => s.accomplishmentBonus)
  const setAccomplishmentBonus = useHabitsStore((s) => s.setAccomplishmentBonus)
  const gradeUsePriority = useHabitsStore((s) => s.gradeUsePriority)
  const setGradeUsePriority = useHabitsStore((s) => s.setGradeUsePriority)
  const outputUsePriority = useHabitsStore((s) => s.outputUsePriority)
  const setOutputUsePriority = useHabitsStore((s) => s.setOutputUsePriority)
  const goodDaysUsePriority = useHabitsStore((s) => s.goodDaysUsePriority)
  const setGoodDaysUsePriority = useHabitsStore((s) => s.setGoodDaysUsePriority)
  const habitViewMode = useHabitsStore((s) => s.habitViewMode)
  const setHabitViewMode = useHabitsStore((s) => s.setHabitViewMode)
  const habitDayView = useHabitsStore((s) => s.habitDayView)
  const setHabitDayView = useHabitsStore((s) => s.setHabitDayView)
  const percentLoadingBar = useHabitsStore((s) => s.percentLoadingBar)
  const setPercentLoadingBar = useHabitsStore((s) => s.setPercentLoadingBar)
  const habitSmallLeds = useHabitsStore((s) => s.habitSmallLeds)
  const setHabitSmallLeds = useHabitsStore((s) => s.setHabitSmallLeds)
  const hideCompletedToday = useHabitsStore((s) => s.hideCompletedToday)
  const setHideCompletedToday = useHabitsStore((s) => s.setHideCompletedToday)
  const exemptionWand = useHabitsStore((s) => s.exemptionWand)
  const setExemptionWand = useHabitsStore((s) => s.setExemptionWand)
  const habitExemptions = useHabitsStore((s) => s.habitExemptions)
  const setHabitExemption = useHabitsStore((s) => s.setHabitExemption)
  const gradeTubeColor = useHabitsStore((s) => s.gradeTubeColor)
  const outputGradeTubeColor = useHabitsStore((s) => s.outputGradeTubeColor)
  const habitSortMode = useHabitsStore((s) => s.habitSortMode)
  const habitSortDirection = useHabitsStore((s) => s.habitSortDirection)
  const setHabitSortDirection = useHabitsStore((s) => s.setHabitSortDirection)
  const exemptionCtx = useExemptionContext()
  const sortDescending = effectiveSortDescending(habitSortMode, habitSortDirection)
  const setHabitSortMode = useHabitsStore((s) => s.setHabitSortMode)

  const [showTaskForm, setShowTaskForm] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showGradeBreakdown, setShowGradeBreakdown] = useState(false)
  const [showOutputGradeBreakdown, setShowOutputGradeBreakdown] = useState(false)
  const [showGoodDays, setShowGoodDays] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [habitTab, setHabitTab] = usePersistedTab(APP_NAV_KEYS.homeHabitsTab, HABIT_FREQ_TABS, "daily")
  const [defaultFrequency, setDefaultFrequency] = useState<"daily" | "weekly" | "monthly">("daily")

  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(
    () => getWeekStartDate(readStoredDate(APP_NAV_KEYS.homeHabitsWeek) ?? new Date()),
  )
  const [weekDates, setWeekDates] = useState<Date[]>(() => getWeekDates(getWeekStartDate(readStoredDate(APP_NAV_KEYS.homeHabitsWeek) ?? new Date())))
  const [currentMonth, setCurrentMonth] = useState(() => {
    const stored = readStoredDate(APP_NAV_KEYS.homeHabitsMonth)
    const now = stored ?? new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  useEffect(() => {
    setWeekDates(getWeekDates(currentWeekStart))
    writeStoredDate(APP_NAV_KEYS.homeHabitsWeek, currentWeekStart)
  }, [currentWeekStart])

  useEffect(() => {
    writeStoredDate(APP_NAV_KEYS.homeHabitsMonth, currentMonth)
  }, [currentMonth])

  const dailyTasks = filterHabitsByFrequency(tasks, "daily")
  const weeklyTasks = filterHabitsByFrequency(tasks, "weekly")
  const monthlyTasks = filterHabitsByFrequency(tasks, "monthly")
  const dailyExempt = (task: Task, key: string) => isHabitPeriodExempt(task, key, "daily", habitExemptions, exemptionCtx)
  const weeklyExempt = (task: Task, key: string) => isHabitPeriodExempt(task, key, "weekly", habitExemptions, exemptionCtx)
  const monthlyExempt = (task: Task, key: string) => isHabitPeriodExempt(task, key, "monthly", habitExemptions, exemptionCtx)
  const dailyKind = (task: Task, key: string) => exemptionKind(task, key, "daily", habitExemptions, exemptionCtx)
  const weeklyKind = (task: Task, key: string) => exemptionKind(task, key, "weekly", habitExemptions, exemptionCtx)
  const monthlyKind = (task: Task, key: string) => exemptionKind(task, key, "monthly", habitExemptions, exemptionCtx)

  const handleAddTask = (task: Task) => {
    let savedId = task.id
    if (editingTask) {
      updateTaskInStore(task)
      setEditingTask(null)
    } else {
      savedId = `task-${Date.now()}`
      addTaskToStore({ ...task, id: savedId, frequency: task.frequency || defaultFrequency })
    }
    // Close first so a tracking backfill error cannot swallow this setState.
    setShowTaskForm(false)
    try {
      syncTrackedHabitsForTask(savedId)
    } catch (error) {
      console.error("Failed to sync tracked time onto habit", savedId, error)
    }
  }

  const handleEditTask = (task: Task) => {
    setEditingTask(task)
    setDefaultFrequency(task.frequency || "daily")
    setShowTaskForm(true)
  }

  const weekEndDate = new Date(currentWeekStart)
  weekEndDate.setDate(weekEndDate.getDate() + 6)

  const weekPeriods = weekPeriodColumns(currentWeekStart, currentDate)
  const monthPeriods = monthPeriodColumns(currentMonth, currentDate)
  const dailyShown = sortHabits(dailyTasks, habitSortMode, {
    data: weeklyData,
    asOf: currentDate,
    frequency: "daily",
    descending: sortDescending,
    completionPercent: (taskId) => calculateTaskPercentage(taskId, dailyTasks, weeklyData, weekDates, dailyExempt),
  })
  const willpowerStones = hydrated
    ? weekWillpowerStones(dailyTasks, weeklyData, weekDates, dailyExempt)
    : []
  const weeklyShown = sortHabits(weeklyTasks, habitSortMode, {
    data: weeklyHabitData,
    asOf: currentDate,
    frequency: "weekly",
    descending: sortDescending,
    completionPercent: (taskId) =>
      calculatePeriodTaskPercentage(taskId, weeklyTasks, weeklyHabitData, weekPeriods, weeklyExempt),
  })
  const monthlyShown = sortHabits(monthlyTasks, habitSortMode, {
    data: monthlyHabitData,
    asOf: currentDate,
    frequency: "monthly",
    descending: sortDescending,
    completionPercent: (taskId) =>
      calculatePeriodTaskPercentage(taskId, monthlyTasks, monthlyHabitData, monthPeriods, monthlyExempt),
  })

  const weekGradeAsOf =
    weekDates.length > 0
      ? gradeAsOfForVisibleWindow(weekDates[0], weekDates[weekDates.length - 1], currentDate)
      : currentDate
  const weekPeriodEnd = weekPeriods.length
    ? addCalendarDays(weekPeriods[weekPeriods.length - 1].date, 6)
    : weekEndDate
  const weeklyGradeAsOf = weekPeriods.length
    ? gradeAsOfForVisibleWindow(weekPeriods[0].date, weekPeriodEnd, currentDate)
    : currentDate
  const monthPeriodEnd = monthPeriods.length
    ? new Date(
        monthPeriods[monthPeriods.length - 1].date.getFullYear(),
        monthPeriods[monthPeriods.length - 1].date.getMonth() + 1,
        0,
      )
    : currentMonth
  const monthlyGradeAsOf = monthPeriods.length
    ? gradeAsOfForVisibleWindow(monthPeriods[0].date, monthPeriodEnd, currentDate)
    : currentDate

  const weekGrade = calculateWeekToDateGrade(dailyTasks, weeklyData, weekDates, weekGradeAsOf, gradeTolerance, dailyExempt)
  const outputGrade = calculateWeekToDateOutputGrade(
    dailyTasks,
    weeklyData,
    weekDates,
    weekGradeAsOf,
    outputGradeTolerance,
    dailyExempt,
  )
  const weeklyGrade = calculatePeriodGrade(
    weeklyTasks,
    weeklyHabitData,
    weekPeriods,
    weeklyGradeAsOf,
    gradeTolerance,
    weeklyExempt,
  )
  const weeklyOutput = calculatePeriodOutputGrade(
    weeklyTasks,
    weeklyHabitData,
    weekPeriods,
    weeklyGradeAsOf,
    outputGradeTolerance,
    weeklyExempt,
  )
  const monthlyGrade = calculatePeriodGrade(
    monthlyTasks,
    monthlyHabitData,
    monthPeriods,
    monthlyGradeAsOf,
    gradeTolerance,
    monthlyExempt,
  )
  const monthlyOutput = calculatePeriodOutputGrade(
    monthlyTasks,
    monthlyHabitData,
    monthPeriods,
    monthlyGradeAsOf,
    outputGradeTolerance,
    monthlyExempt,
  )
  const dailyPrio = prioritizedHabits(dailyTasks, weeklyData, weekGradeAsOf, "daily")
  const weeklyPrio = prioritizedHabits(weeklyTasks, weeklyHabitData, weeklyGradeAsOf, "weekly")
  const monthlyPrio = prioritizedHabits(monthlyTasks, monthlyHabitData, monthlyGradeAsOf, "monthly")
  const weekPrioGrade =
    dailyPrio.length > 0
      ? openGrade(calculateWeekToDateGrade(dailyPrio, weeklyData, weekDates, weekGradeAsOf, gradeTolerance, dailyExempt))
      : null
  const outputPrioGrade =
    dailyPrio.length > 0
      ? openOutput(
          calculateWeekToDateOutputGrade(dailyPrio, weeklyData, weekDates, weekGradeAsOf, outputGradeTolerance, dailyExempt),
        )
      : null
  const weeklyPrioGrade =
    weeklyPrio.length > 0
      ? openGrade(calculatePeriodGrade(weeklyPrio, weeklyHabitData, weekPeriods, weeklyGradeAsOf, gradeTolerance, weeklyExempt))
      : null
  const weeklyPrioOutput =
    weeklyPrio.length > 0
      ? openOutput(
          calculatePeriodOutputGrade(
            weeklyPrio,
            weeklyHabitData,
            weekPeriods,
            weeklyGradeAsOf,
            outputGradeTolerance,
            weeklyExempt,
          ),
        )
      : null
  const monthlyPrioGrade =
    monthlyPrio.length > 0
      ? openGrade(
          calculatePeriodGrade(monthlyPrio, monthlyHabitData, monthPeriods, monthlyGradeAsOf, gradeTolerance, monthlyExempt),
        )
      : null
  const monthlyPrioOutput =
    monthlyPrio.length > 0
      ? openOutput(
          calculatePeriodOutputGrade(
            monthlyPrio,
            monthlyHabitData,
            monthPeriods,
            monthlyGradeAsOf,
            outputGradeTolerance,
            monthlyExempt,
          ),
        )
      : null
  const activePrioGrade = habitTab === "monthly" ? monthlyPrioGrade : habitTab === "weekly" ? weeklyPrioGrade : weekPrioGrade
  const activePrioOutput =
    habitTab === "monthly" ? monthlyPrioOutput : habitTab === "weekly" ? weeklyPrioOutput : outputPrioGrade
  const activeGrade = habitTab === "monthly" ? monthlyGrade : habitTab === "weekly" ? weeklyGrade : weekGrade
  const activeOutput = habitTab === "monthly" ? monthlyOutput : habitTab === "weekly" ? weeklyOutput : outputGrade
  // Hold tubes until the vault lands so a hollow seed cannot paint "—" / 0 and stick.
  const shownGrade = hydrated ? blendPriorityScore(activeGrade.grade, activePrioGrade, gradeUsePriority) : 0
  const shownOutput = hydrated ? blendPriorityScore(activeOutput.grade, activePrioOutput, outputUsePriority) : 0
  const gradeDaysReady = hydrated ? activeGrade.daysIncluded : 0
  const outputReady = hydrated && activeOutput.daysIncluded > 0 && activeOutput.habits.length > 0
  const gradePeriodUnit = habitTab === "monthly" ? "month" : habitTab === "weekly" ? "week" : "day"
  const gradeLabel = habitTab === "daily" ? "Week grade" : "Span grade"
  const gradeThrough =
    gradeDaysReady === 0
      ? null
      : habitTab === "daily"
        ? gradeDaysReady === 7
          ? "full week"
          : `through ${format(weekDates[gradeDaysReady - 1], "EEE")}`
        : `through ${format(activeGrade.days[gradeDaysReady - 1].date, habitTab === "monthly" ? "MMM yyyy" : "MMM d")}`
  const goodDays = goodDaySummary(
    dailyTasks,
    weeklyData,
    currentDate,
    accomplishmentThreshold,
    accomplishmentBonus,
    goodDaysUsePriority
      ? (date, overall) => {
          const prio = prioritizedHabits(dailyTasks, weeklyData, date, "daily")
          const prioRaw =
            prio.length > 0 ? rawDayCompletionPercent(prio, weeklyData, date, dailyExempt) : null
          return blendPriorityScore(overall, prioRaw, true)
        }
      : undefined,
    dailyExempt,
  )
  const todayPrioHabits = prioritizedHabits(dailyTasks, weeklyData, currentDate, "daily")
  const todayPrioRaw =
    todayPrioHabits.length > 0 ? rawDayCompletionPercent(todayPrioHabits, weeklyData, currentDate, dailyExempt) : null
  const viewingCurrentPeriod =
    habitTab === "monthly" ? isSameLocalMonth(currentMonth, currentDate) : isSameLocalWeek(currentWeekStart, currentDate)

  return (
    <div data-ui-name="Habits" data-ui-docs="components/Home/Habits/README.md">
      <Tabs value={habitTab} onValueChange={(v) => setHabitTab(v as typeof habitTab)}>
        <div className="hab-head">
          <h3 className="hab-head-title">Habits</h3>
          <div className="hab-head-center">
            {habitTab === "monthly" ? (
              <WeekNavigation
                currentWeekStart={currentMonth}
                weekEndDate={currentMonth}
                rangeLabel={format(currentMonth, "MMMM yyyy")}
                currentButtonLabel="This month"
                previousAriaLabel="Previous Month"
                nextAriaLabel="Next Month"
                isCurrentPeriod={viewingCurrentPeriod}
                onPreviousWeek={() =>
                  setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
                }
                onNextWeek={() => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                onCurrentWeek={() => {
                  const now = new Date()
                  setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1))
                }}
              />
            ) : (
              <WeekNavigation
                currentWeekStart={currentWeekStart}
                weekEndDate={weekEndDate}
                isCurrentPeriod={viewingCurrentPeriod}
                onPreviousWeek={() => setCurrentWeekStart(addCalendarDays(currentWeekStart, -7))}
                onNextWeek={() => setCurrentWeekStart(addCalendarDays(currentWeekStart, 7))}
                onCurrentWeek={() => setCurrentWeekStart(getWeekStartDate(new Date()))}
              />
            )}
          </div>
          <div className="hab-head-utils">
            <button type="button" className="habit-chrome-btn" onClick={() => setShowSettings(true)}>
              <Settings className="h-3.5 w-3.5" />
              Settings
            </button>
          </div>
        </div>

        <div className="habit-grades hab-view-changer">
          <TabsList aria-label="Habit period">
            <TabsTrigger value="daily">Daily{hydrated ? ` (${dailyTasks.length})` : ""}</TabsTrigger>
            <TabsTrigger value="weekly">Weekly{hydrated ? ` (${weeklyTasks.length})` : ""}</TabsTrigger>
            <TabsTrigger value="monthly">Monthly{hydrated ? ` (${monthlyTasks.length})` : ""}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="daily" className="hab-pane">
          <div className="hab-desk">
            {morningHabitPriorities.length > 0 && (
              <div className="mb-3 rounded-md border border-dashed p-3 mx-2 mt-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Morning habit priorities
                </p>
                <ol className="list-decimal pl-5 text-sm space-y-0.5">
                  {morningHabitPriorities.map((id) => {
                    const habit = tasks.find((t) => t.id === id)
                    return <li key={id}>{habit?.name ?? id}</li>
                  })}
                </ol>
              </div>
            )}
            <div className="hab-well">
              {!hydrated ? (
                <div className="habit-grid-wrap" aria-busy="true">
                  <p className="text-sm text-muted-foreground p-4">Loading habits…</p>
                </div>
              ) : habitViewMode === "heatmap" ? (
                <HabitHeatmap
                  tasks={dailyShown}
                  data={weeklyData}
                  asOf={currentDate}
                  frequency="daily"
                  onEditTask={handleEditTask}
                  hideCompleted={hideCompletedToday}
                  focusKey={formatLocalDateKey(currentDate)}
                  exemptionWand={exemptionWand}
                  exemptionKindFor={dailyKind}
                  onToggleExempt={(taskId, periodKey, exempt) => setHabitExemption("daily", periodKey, taskId, exempt)}
                />
              ) : (
                <TaskGrid
                  tasks={dailyShown}
                  weeklyData={weeklyData}
                  weekDates={weekDates}
                  onUpdateTaskCompletion={updateCompletion}
                  onEditTask={handleEditTask}
                  calculateTaskPercentage={(taskId) => {
                    const task = dailyTasks.find((row) => row.id === taskId)
                    if (!task) return 0
                    if (weekDates.length > 0 && weekDates.every((date) => dailyExempt(task, formatLocalDateKey(date)))) {
                      return null
                    }
                    return calculateTaskPercentage(taskId, dailyTasks, weeklyData, weekDates, dailyExempt)
                  }}
                  calculateDayPercentage={(date, index) => {
                    const key = formatLocalDateKey(date)
                    if (dailyTasks.length > 0 && dailyTasks.every((task) => dailyExempt(task, key))) return null
                    return calculateDayPercentageAV(key, dailyTasks, weeklyData, index, dailyExempt)
                  }}
                  hideCompleted={hideCompletedToday}
                  exemptionWand={exemptionWand}
                  exemptionKindFor={dailyKind}
                  onSetExempt={(taskId, date, exempt) =>
                    setHabitExemption("daily", formatLocalDateKey(date), taskId, exempt)
                  }
                  viewMode="day"
                  dayView={habitDayView}
                  selectedDate={currentDate}
                />
              )}
            </div>
            <HabitsControlPanel stones={willpowerStones}>
              <div className="hab-control-stack">
                <div className="hab-control-gauges">
                  <GradeFace
                    label={gradeLabel}
                    title="Click for raw vs curved breakdown"
                    valueText={gradeDaysReady === 0 ? "—" : `${shownGrade.toFixed(0)}%`}
                    through={gradeThrough}
                    barValue={gradeDaysReady > 0 ? shownGrade : null}
                    hue={gradeTubeColor}
                    onClick={() => setShowGradeBreakdown(true)}
                  />
                  <GradeFace
                    label="Perfect output"
                    title="Click for elapsed row completion breakdown"
                    valueText={
                      !outputReady
                        ? "—"
                        : `${shownOutput.toFixed(0)}%`
                    }
                    through={gradeThrough}
                    barValue={
                      outputReady
                        ? shownOutput
                        : null
                    }
                    hue={outputGradeTubeColor}
                    onClick={() => setShowOutputGradeBreakdown(true)}
                  />
                </div>
                <div className="hab-control-streak">
                  <button
                    type="button"
                    className="habit-good-days"
                    title="Click for Good day streak, last 30 days, and accomplishment settings"
                    onClick={() => setShowGoodDays(true)}
                  >
                    <span className="habit-good-days-stat">
                      <span className="text-muted-foreground">Good day streak</span>
                      <strong>{goodDays.streak}</strong>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="habit-good-days"
                    title="Click for Good day streak, last 30 days, and accomplishment settings"
                    onClick={() => setShowGoodDays(true)}
                  >
                    <span className="habit-good-days-stat">
                      <span className="text-muted-foreground">Good days in the last month</span>
                      <strong>
                        {goodDays.last30Count}
                        <span className="habit-good-days-of">/{GOOD_DAYS_LOOKBACK}</span>
                      </strong>
                    </span>
                  </button>
                </div>
                <HabitSortControl
                  value={habitSortMode}
                  direction={habitSortDirection}
                  onChange={setHabitSortMode}
                  onDirection={setHabitSortDirection}
                />
                <div className="hab-control-toggles">
                  <ExemptionWandButton on={exemptionWand} onToggle={setExemptionWand} />
                  <CockpitSwitch
                    id="heatmap-view"
                    checked={habitViewMode === "heatmap"}
                    onCheckedChange={(on) => setHabitViewMode(on ? "heatmap" : "grid")}
                    label="Heatmap View"
                  />
                  <CockpitSwitch
                    id="day-view"
                    checked={habitDayView}
                    onCheckedChange={setHabitDayView}
                    label="Day View"
                  />
                  <CockpitSwitch
                    id="hide-done"
                    checked={hideCompletedToday}
                    onCheckedChange={setHideCompletedToday}
                    label="Hide Completed Today"
                  />
                  <CockpitSwitch
                    id="loading-bar"
                    checked={percentLoadingBar}
                    onCheckedChange={setPercentLoadingBar}
                    label="Loading Bar"
                  />
                  <CockpitSwitch
                    id="small-leds"
                    checked={habitSmallLeds}
                    onCheckedChange={setHabitSmallLeds}
                    label="Small LEDs"
                  />
                </div>
                <button
                  type="button"
                  className="habit-chrome-btn habit-chrome-btn-cta hab-control-new"
                  onClick={() => {
                    setEditingTask(null)
                    setDefaultFrequency(habitTab)
                    setShowTaskForm(true)
                  }}
                >
                  <Plus className="inline h-3 w-3" />
                  New habit
                </button>
              </div>
            </HabitsControlPanel>
          </div>
        </TabsContent>

        <TabsContent value="weekly" className="hab-pane">
          <div className="hab-desk">
            <div className="hab-well">
              {!hydrated ? (
                <div className="habit-grid-wrap" aria-busy="true">
                  <p className="text-sm text-muted-foreground p-4">Loading habits…</p>
                </div>
              ) : (
              <PeriodHabitList
                tasks={weeklyShown}
                periods={weekPeriods}
                data={weeklyHabitData}
                onUpdate={(taskId, periodDate, c) => updateWeeklyHabitCompletion(taskId, periodDate, c)}
                onEdit={handleEditTask}
                hideCompleted={hideCompletedToday}
                exemptionWand={exemptionWand}
                exemptionKindFor={weeklyKind}
                onSetExempt={(taskId, periodKey, _periodDate, exempt) =>
                  setHabitExemption("weekly", periodKey, taskId, exempt)
                }
                calculateTaskPercentage={(taskId) => {
                  const task = weeklyTasks.find((row) => row.id === taskId)
                  if (!task) return 0
                  if (weekPeriods.length > 0 && weekPeriods.every((period) => weeklyExempt(task, period.key))) return null
                  return calculatePeriodTaskPercentage(taskId, weeklyTasks, weeklyHabitData, weekPeriods, weeklyExempt)
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
              />
              )}
            </div>
            <HabitsControlPanel stones={willpowerStones}>
              <div className="hab-control-stack">
                <div className="hab-control-gauges">
                  <GradeFace
                    label={gradeLabel}
                    title="Click for raw vs curved breakdown"
                    valueText={gradeDaysReady === 0 ? "—" : `${shownGrade.toFixed(0)}%`}
                    through={gradeThrough}
                    barValue={gradeDaysReady > 0 ? shownGrade : null}
                    hue={gradeTubeColor}
                    onClick={() => setShowGradeBreakdown(true)}
                  />
                  <GradeFace
                    label="Perfect output"
                    title="Click for elapsed row completion breakdown"
                    valueText={
                      !outputReady
                        ? "—"
                        : `${shownOutput.toFixed(0)}%`
                    }
                    through={gradeThrough}
                    barValue={
                      outputReady
                        ? shownOutput
                        : null
                    }
                    hue={outputGradeTubeColor}
                    onClick={() => setShowOutputGradeBreakdown(true)}
                  />
                </div>
                <HabitSortControl
                  id="habit-sort-weekly"
                  value={habitSortMode}
                  direction={habitSortDirection}
                  onChange={setHabitSortMode}
                  onDirection={setHabitSortDirection}
                />
                <div className="hab-control-toggles">
                  <ExemptionWandButton on={exemptionWand} onToggle={setExemptionWand} />
                  <CockpitSwitch
                    id="hide-done-weekly"
                    checked={hideCompletedToday}
                    onCheckedChange={setHideCompletedToday}
                    label="Hide Completed This Week"
                  />
                  <CockpitSwitch
                    id="loading-bar-weekly"
                    checked={percentLoadingBar}
                    onCheckedChange={setPercentLoadingBar}
                    label="Loading Bar"
                  />
                  <CockpitSwitch
                    id="small-leds-weekly"
                    checked={habitSmallLeds}
                    onCheckedChange={setHabitSmallLeds}
                    label="Small LEDs"
                  />
                </div>
                <button
                  type="button"
                  className="habit-chrome-btn habit-chrome-btn-cta hab-control-new"
                  onClick={() => {
                    setEditingTask(null)
                    setDefaultFrequency("weekly")
                    setShowTaskForm(true)
                  }}
                >
                  <Plus className="inline h-3 w-3" />
                  New habit
                </button>
              </div>
            </HabitsControlPanel>
          </div>
        </TabsContent>

        <TabsContent value="monthly" className="hab-pane">
          <div className="hab-desk">
            <div className="hab-well">
              {!hydrated ? (
                <div className="habit-grid-wrap" aria-busy="true">
                  <p className="text-sm text-muted-foreground p-4">Loading habits…</p>
                </div>
              ) : (
              <PeriodHabitList
                tasks={monthlyShown}
                periods={monthPeriods}
                data={monthlyHabitData}
                onUpdate={(taskId, periodDate, c) => updateMonthlyHabitCompletion(taskId, periodDate, c)}
                onEdit={handleEditTask}
                hideCompleted={hideCompletedToday}
                exemptionWand={exemptionWand}
                exemptionKindFor={monthlyKind}
                onSetExempt={(taskId, periodKey, _periodDate, exempt) =>
                  setHabitExemption("monthly", periodKey, taskId, exempt)
                }
                calculateTaskPercentage={(taskId) => {
                  const task = monthlyTasks.find((row) => row.id === taskId)
                  if (!task) return 0
                  if (monthPeriods.length > 0 && monthPeriods.every((period) => monthlyExempt(task, period.key))) return null
                  return calculatePeriodTaskPercentage(taskId, monthlyTasks, monthlyHabitData, monthPeriods, monthlyExempt)
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
              />
              )}
            </div>
            <HabitsControlPanel stones={willpowerStones}>
              <div className="hab-control-stack">
                <div className="hab-control-gauges">
                  <GradeFace
                    label={gradeLabel}
                    title="Click for raw vs curved breakdown"
                    valueText={gradeDaysReady === 0 ? "—" : `${shownGrade.toFixed(0)}%`}
                    through={gradeThrough}
                    barValue={gradeDaysReady > 0 ? shownGrade : null}
                    hue={gradeTubeColor}
                    onClick={() => setShowGradeBreakdown(true)}
                  />
                  <GradeFace
                    label="Perfect output"
                    title="Click for elapsed row completion breakdown"
                    valueText={
                      !outputReady
                        ? "—"
                        : `${shownOutput.toFixed(0)}%`
                    }
                    through={gradeThrough}
                    barValue={
                      outputReady
                        ? shownOutput
                        : null
                    }
                    hue={outputGradeTubeColor}
                    onClick={() => setShowOutputGradeBreakdown(true)}
                  />
                </div>
                <HabitSortControl
                  id="habit-sort-monthly"
                  value={habitSortMode}
                  direction={habitSortDirection}
                  onChange={setHabitSortMode}
                  onDirection={setHabitSortDirection}
                />
                <div className="hab-control-toggles">
                  <ExemptionWandButton on={exemptionWand} onToggle={setExemptionWand} />
                  <CockpitSwitch
                    id="hide-done-monthly"
                    checked={hideCompletedToday}
                    onCheckedChange={setHideCompletedToday}
                    label="Hide Completed This Month"
                  />
                  <CockpitSwitch
                    id="loading-bar-monthly"
                    checked={percentLoadingBar}
                    onCheckedChange={setPercentLoadingBar}
                    label="Loading Bar"
                  />
                  <CockpitSwitch
                    id="small-leds-monthly"
                    checked={habitSmallLeds}
                    onCheckedChange={setHabitSmallLeds}
                    label="Small LEDs"
                  />
                </div>
                <button
                  type="button"
                  className="habit-chrome-btn habit-chrome-btn-cta hab-control-new"
                  onClick={() => {
                    setEditingTask(null)
                    setDefaultFrequency("monthly")
                    setShowTaskForm(true)
                  }}
                >
                  <Plus className="inline h-3 w-3" />
                  New habit
                </button>
              </div>
            </HabitsControlPanel>
          </div>
        </TabsContent>
      </Tabs>

      <TaskFormDialog
        open={showTaskForm}
        onOpenChange={setShowTaskForm}
        onSubmit={handleAddTask as (t: Task) => void}
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
        onThresholdChange={setAccomplishmentThreshold}
        onBonusChange={setAccomplishmentBonus}
        usePriority={goodDaysUsePriority}
        onUsePriorityChange={setGoodDaysUsePriority}
        todayOverall={rawDayCompletionPercent(dailyTasks, weeklyData, currentDate, dailyExempt)}
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
    </div>
  )
}

export default WeeklyTaskTracker
