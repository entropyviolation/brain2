/**
 * components/Home/Habits/habit-tracker.tsx — Habit tracker (daily / weekly / monthly / season)
 *
 * Header: CRT Habits title, milled period nav, raised Settings key. Daily /
 * Weekly / Monthly / Season keys sit in a milled bay above the sheet (active = CRT +
 * power lamp; persist). Daily rail rockers: Heatmap View,
 * Day View (today + week %), Hide Completed Today (persisted), Loading Bar (thin glass tubes;
 * the same tube in the Day View daily footer),
 * Small LEDs (15px Yes/No lamps vs fill the cell). Missed op wand sits under
 * Exemption wand. Hide completed and missed hatches those cells and does not
 * remove rows.
 * Sort / New habit / grades share the Habits Tab Control Panel on every tab.
 * Weekly / monthly always use the period spreadsheet (heatmap and Day View
 * are Daily-only). Weekly columns and the span grade share
 * `habitWeekWindowStarts` (default: seven Monday-weeks). Monthly columns and
 * the span grade share `habitMonthWindowStarts` (default: January through this month).
 * Grade meters are glass noble-gas tubes (`noble-gas-tube.tsx`).
 */
"use client"

import { useState, useEffect, useLayoutEffect, useMemo } from "react"
import { usePersistHydrated } from "@/lib/use-persist-hydrated"
import {
  habitsViewedMonth,
  habitsViewedQuarter,
  habitsViewedWeekStart,
  retainHabitsCursorDate,
  retainHabitsWeekDates,
} from "@/components/Home/Habits/habits-period-cursor"
import { TaskGrid } from "@/components/Home/Habits/task-grid"
import { PeriodHabitList, filterHabitsByFrequency, weekPeriodColumns, monthPeriodColumns, seasonPeriodColumns } from "@/components/Home/Habits/period-habit-list"
import { HabitHeatmap } from "@/components/Home/Habits/habit-heatmap"
import { TaskFormDialog } from "@/components/Home/Habits/daily-task-form-dialog"
import { GradeBreakdownDialog } from "@/components/Home/Habits/grade-breakdown-dialog"
import { OutputGradeBreakdownDialog } from "@/components/Home/Habits/output-grade-breakdown-dialog"
import { GoodDaysDialog } from "@/components/Home/Habits/good-days-dialog"
import { HabitsControlPanel } from "@/components/Home/Habits/habits-control-panel"
import { HabitsTabControls } from "@/components/Home/Habits/habits-tab-controls"
import { HabitMonthWindowControl } from "@/components/Home/Habits/habit-month-window-control"
import { HabitWeekWindowControl } from "@/components/Home/Habits/habit-week-window-control"
import { weekWillpowerStones } from "@/lib/willpower-stones"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings } from "lucide-react"
import { type WeeklyTask as Task, type TaskCompletion } from "@/lib/types"
import {
  calculateTaskPercentage,
  calculateDayPercentageAV,
  averageWeekGradeAcrossWeeksWithData,
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
import {
  getWeekStartDate,
  getWeekDates,
  formatLocalDateKey,
  parseLocalDate,
  addCalendarDays,
  formatDateRange,
  isSameLocalWeek,
} from "@/lib/date-utils"
import { WeekNavigation } from "@/components/Home/Habits/week-navigation"
import { SettingsDialog } from "@/components/Home/Habits/settings-dialog"
import { useHabitsStore } from "@/lib/habits-store"
import { useReviewsStore, localDayKey } from "@/lib/reviews-store"
import { useHabitTrackingSync, syncTrackedHabitsForTask } from "@/lib/habit-tracking-sync"
import { goodDaySummary, rawDayCompletionPercent, type GoodDaySummary } from "@/lib/habit-accomplishment"
import {
  blendPriorityScore,
  prioritizedHabits,
} from "@/lib/habit-priority"
import { effectiveSortDescending, sortHabits } from "@/lib/habit-sort"
import { exemptionKind, isHabitPeriodExempt } from "@/lib/habit-exemption"
import { useExemptionContext } from "@/lib/sleep-store"
import { format } from "date-fns"
import { APP_NAV_KEYS, HABIT_FREQ_TABS, readStoredDate, writeStoredDate } from "@/lib/app-navigation"
import { clearHabitSettingsReturn, habitSettingsReturnReady, peekHabitSettingsReturn, takeHabitDraft } from "@/lib/habit-list-item"
import { subscribeNavRestore } from "@/lib/screen-location"
import { quarterKey, quarterLabel, quarterStartDate, seasonOfDate, seasonSlug, shiftQuarter } from "@/lib/seasons"
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

/** Placeholder while that frequency's tab is closed. Tubes read the live memo once the tab opens. */
const IDLE_GRADE: WeekGradeResult = {
  grade: 0,
  rawGrade: 0,
  daysIncluded: 0,
  days: [],
  tolerance: 100,
  curveBonus: 0,
}

const IDLE_OUTPUT: OutputGradeResult = {
  grade: 0,
  rawGrade: 0,
  daysIncluded: 0,
  habits: [],
  tolerance: 100,
  curveBonus: 0,
}

const IDLE_PERCENTS = new Map<string, number>()

const IDLE_GOOD_DAYS: GoodDaySummary = {
  threshold: 80,
  bonus: 50,
  streak: 0,
  longestStreak: 0,
  last30Count: 0,
  last30: [],
  todayRaw: 0,
  todayCompletionRaw: 0,
  todayGood: false,
  prior7Average: 0,
  prior30Average: 0,
  prior7VsToday: "same",
  prior30VsToday: "same",
  yesterdayCompletionRaw: 0,
  yesterdayVsToday: "same",
  weeks: {
    thisWeek: 0,
    lastWeek: 0,
    thisYear: 0,
    allTime: 0,
    lastWeekVs: "same",
    thisYearVs: "same",
    allTimeVs: "same",
  },
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
  const quarterlyHabitData = useHabitsStore((s) => s.quarterlyHabitData)
  const addTaskToStore = useHabitsStore((s) => s.addTask)
  const updateTaskInStore = useHabitsStore((s) => s.updateTask)
  const deleteTaskFromStore = useHabitsStore((s) => s.deleteTask)
  const updateCompletion = useHabitsStore((s) => s.updateCompletion)
  const updateWeeklyHabitCompletion = useHabitsStore((s) => s.updateWeeklyHabitCompletion)
  const updateMonthlyHabitCompletion = useHabitsStore((s) => s.updateMonthlyHabitCompletion)
  const updateQuarterlyHabitCompletion = useHabitsStore((s) => s.updateQuarterlyHabitCompletion)
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
  const missedOpWand = useHabitsStore((s) => s.missedOpWand)
  const setMissedOpWand = useHabitsStore((s) => s.setMissedOpWand)
  const hideCompletedAndMissed = useHabitsStore((s) => s.hideCompletedAndMissed)
  const setHideCompletedAndMissed = useHabitsStore((s) => s.setHideCompletedAndMissed)
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
  const habitMonthWindow = useHabitsStore((s) => s.habitMonthWindow)
  const setHabitMonthWindow = useHabitsStore((s) => s.setHabitMonthWindow)
  const habitBirthday = useHabitsStore((s) => s.habitBirthday)
  const setHabitBirthday = useHabitsStore((s) => s.setHabitBirthday)
  const habitWeekWindow = useHabitsStore((s) => s.habitWeekWindow)
  const setHabitWeekWindow = useHabitsStore((s) => s.setHabitWeekWindow)

  const [showTaskForm, setShowTaskForm] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showGradeBreakdown, setShowGradeBreakdown] = useState(false)
  const [showOutputGradeBreakdown, setShowOutputGradeBreakdown] = useState(false)
  const [showGoodDays, setShowGoodDays] = useState(false)
  // Checklist "today" is the wall clock. Home's plan cursor can sit on another day.
  const [goodDayAsOf] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  })
  // Monthly columns and span grade end on the wall-clock month, not a saved cursor.
  const [monthWindowAsOf] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  })
  // Weekly columns and span grade use the wall-clock day, not the saved week cursor.
  const [weekWindowAsOf] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  })
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [habitTab, setHabitTab] = usePersistedTab(APP_NAV_KEYS.homeHabitsTab, HABIT_FREQ_TABS, "daily")
  const [defaultFrequency, setDefaultFrequency] = useState<"daily" | "weekly" | "monthly" | "quarterly">("daily")

  // First paint matches SSR: ignore localStorage (same rule as usePersistedTab).
  // Wall clock, not Home `currentDate` — Plan can sit on another day while Habits shows this week.
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => habitsViewedWeekStart(new Date()))
  const [weekDates, setWeekDates] = useState<Date[]>(() => getWeekDates(habitsViewedWeekStart(new Date())))
  const [currentMonth, setCurrentMonth] = useState(() => habitsViewedMonth(new Date()))
  const [currentQuarter, setCurrentQuarter] = useState(() => habitsViewedQuarter(new Date()))
  const [periodCursorReady, setPeriodCursorReady] = useState(false)

  useLayoutEffect(() => {
    const asOf = new Date()
    const week = habitsViewedWeekStart(asOf, readStoredDate(APP_NAV_KEYS.homeHabitsWeek))
    const month = habitsViewedMonth(asOf, readStoredDate(APP_NAV_KEYS.homeHabitsMonth))
    const quarter = habitsViewedQuarter(asOf, readStoredDate(APP_NAV_KEYS.homeHabitsQuarter))
    setCurrentWeekStart((prev) => retainHabitsCursorDate(prev, week))
    setWeekDates((prev) => retainHabitsWeekDates(prev, week))
    setCurrentMonth((prev) => retainHabitsCursorDate(prev, month))
    setCurrentQuarter((prev) => retainHabitsCursorDate(prev, quarter))
    setPeriodCursorReady(true)
  }, [])

  useEffect(() => {
    setWeekDates((prev) => retainHabitsWeekDates(prev, currentWeekStart))
    if (!periodCursorReady) return
    writeStoredDate(APP_NAV_KEYS.homeHabitsWeek, currentWeekStart)
  }, [currentWeekStart, periodCursorReady])

  useEffect(() => {
    if (!periodCursorReady) return
    writeStoredDate(APP_NAV_KEYS.homeHabitsMonth, currentMonth)
  }, [currentMonth, periodCursorReady])

  useEffect(() => {
    if (!periodCursorReady) return
    writeStoredDate(APP_NAV_KEYS.homeHabitsQuarter, currentQuarter)
  }, [currentQuarter, periodCursorReady])

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

  useEffect(() => {
    return subscribeNavRestore(() => {
      if (!habitSettingsReturnReady()) return
      const id = peekHabitSettingsReturn()
      if (!id) return
      clearHabitSettingsReturn()
      const draft = takeHabitDraft(id)
      const habit = draft ?? useHabitsStore.getState().tasks.find((row) => row.id === id) ?? null
      if (!habit) return
      setEditingTask(habit)
      setDefaultFrequency(habit.frequency || "daily")
      setShowTaskForm(true)
    })
  }, [])

  const weekEndDate = new Date(currentWeekStart)
  weekEndDate.setDate(weekEndDate.getDate() + 6)

  // Each frequency reads only its own completion map. Sort, grade, and output
  // run for the open tab. A daily cell replaces `weeklyData` and does not
  // rerun weekly / monthly / season work.
  const daily = useMemo(() => {
    const dailyTasks = filterHabitsByFrequency(tasks, "daily")
    const dailyExempt = (task: Task, key: string) => isHabitPeriodExempt(task, key, "daily", habitExemptions, exemptionCtx)
    const dailyKind = (task: Task, key: string) => exemptionKind(task, key, "daily", habitExemptions, exemptionCtx)
    const stones = weekWillpowerStones(dailyTasks, weeklyData, weekDates, dailyExempt)
    if (habitTab !== "daily") {
      return {
        dailyTasks,
        dailyExempt,
        dailyKind,
        shown: dailyTasks,
        weekPercent: IDLE_PERCENTS,
        grade: IDLE_GRADE,
        output: IDLE_OUTPUT,
        prioGrade: null,
        prioOutput: null,
        weekAverage: null,
        stones,
      }
    }
    const weekPercent = new Map<string, number>()
    for (const task of dailyTasks) {
      weekPercent.set(task.id, calculateTaskPercentage(task.id, dailyTasks, weeklyData, weekDates, dailyExempt))
    }
    const shown = sortHabits(dailyTasks, habitSortMode, {
      data: weeklyData,
      asOf: currentDate,
      frequency: "daily",
      descending: sortDescending,
      completionPercent: (taskId) => weekPercent.get(taskId) ?? 0,
    })
    const gradeAsOf =
      weekDates.length > 0
        ? gradeAsOfForVisibleWindow(weekDates[0], weekDates[weekDates.length - 1], currentDate)
        : currentDate
    const grade = calculateWeekToDateGrade(dailyTasks, weeklyData, weekDates, gradeAsOf, gradeTolerance, dailyExempt)
    const weekAverage = averageWeekGradeAcrossWeeksWithData(
      dailyTasks,
      weeklyData,
      gradeAsOf,
      gradeTolerance,
      dailyExempt,
    )
    const output = calculateWeekToDateOutputGrade(
      dailyTasks,
      weeklyData,
      weekDates,
      gradeAsOf,
      outputGradeTolerance,
      dailyExempt,
    )
    const prio = prioritizedHabits(dailyTasks, weeklyData, gradeAsOf, "daily")
    return {
      dailyTasks,
      dailyExempt,
      dailyKind,
      shown,
      weekPercent,
      grade,
      output,
      weekAverage,
      prioGrade:
        prio.length > 0
          ? openGrade(calculateWeekToDateGrade(prio, weeklyData, weekDates, gradeAsOf, gradeTolerance, dailyExempt))
          : null,
      prioOutput:
        prio.length > 0
          ? openOutput(
              calculateWeekToDateOutputGrade(prio, weeklyData, weekDates, gradeAsOf, outputGradeTolerance, dailyExempt),
            )
          : null,
      stones,
    }
  }, [
    habitTab,
    tasks,
    weeklyData,
    habitExemptions,
    exemptionCtx,
    weekDates,
    currentDate,
    gradeTolerance,
    outputGradeTolerance,
    habitSortMode,
    sortDescending,
  ])

  const weekly = useMemo(() => {
    const weeklyTasks = filterHabitsByFrequency(tasks, "weekly")
    const weeklyExempt = (task: Task, key: string) =>
      isHabitPeriodExempt(task, key, "weekly", habitExemptions, exemptionCtx)
    const weeklyKind = (task: Task, key: string) => exemptionKind(task, key, "weekly", habitExemptions, exemptionCtx)
    if (habitTab !== "weekly") {
      return {
        weeklyTasks,
        weeklyExempt,
        weeklyKind,
        periods: [],
        periodPercent: IDLE_PERCENTS,
        shown: weeklyTasks,
        grade: IDLE_GRADE,
        output: IDLE_OUTPUT,
        prioGrade: null,
        prioOutput: null,
      }
    }
    const periods = weekPeriodColumns(weekWindowAsOf, habitWeekWindow)
    const periodPercent = new Map<string, number>()
    for (const task of weeklyTasks) {
      periodPercent.set(
        task.id,
        calculatePeriodTaskPercentage(task.id, weeklyTasks, weeklyHabitData, periods, weeklyExempt),
      )
    }
    const shown = sortHabits(weeklyTasks, habitSortMode, {
      data: weeklyHabitData,
      asOf: currentDate,
      frequency: "weekly",
      descending: sortDescending,
      completionPercent: (taskId) => periodPercent.get(taskId) ?? 0,
    })
    const gradeAsOf = weekWindowAsOf
    const grade = calculatePeriodGrade(weeklyTasks, weeklyHabitData, periods, gradeAsOf, gradeTolerance, weeklyExempt)
    const output = calculatePeriodOutputGrade(
      weeklyTasks,
      weeklyHabitData,
      periods,
      gradeAsOf,
      outputGradeTolerance,
      weeklyExempt,
    )
    const prio = prioritizedHabits(weeklyTasks, weeklyHabitData, gradeAsOf, "weekly")
    return {
      weeklyTasks,
      weeklyExempt,
      weeklyKind,
      periods,
      periodPercent,
      shown,
      grade,
      output,
      prioGrade:
        prio.length > 0
          ? openGrade(calculatePeriodGrade(prio, weeklyHabitData, periods, gradeAsOf, gradeTolerance, weeklyExempt))
          : null,
      prioOutput:
        prio.length > 0
          ? openOutput(
              calculatePeriodOutputGrade(prio, weeklyHabitData, periods, gradeAsOf, outputGradeTolerance, weeklyExempt),
            )
          : null,
    }
  }, [
    habitTab,
    tasks,
    weeklyHabitData,
    habitExemptions,
    exemptionCtx,
    weekWindowAsOf,
    habitWeekWindow,
    currentDate,
    gradeTolerance,
    outputGradeTolerance,
    habitSortMode,
    sortDescending,
  ])

  const monthly = useMemo(() => {
    const monthlyTasks = filterHabitsByFrequency(tasks, "monthly")
    const monthlyExempt = (task: Task, key: string) =>
      isHabitPeriodExempt(task, key, "monthly", habitExemptions, exemptionCtx)
    const monthlyKind = (task: Task, key: string) => exemptionKind(task, key, "monthly", habitExemptions, exemptionCtx)
    if (habitTab !== "monthly") {
      return {
        monthlyTasks,
        monthlyExempt,
        monthlyKind,
        periods: [],
        periodPercent: IDLE_PERCENTS,
        shown: monthlyTasks,
        grade: IDLE_GRADE,
        output: IDLE_OUTPUT,
        prioGrade: null,
        prioOutput: null,
      }
    }
    const periods = monthPeriodColumns(monthWindowAsOf, habitMonthWindow, habitBirthday)
    const periodPercent = new Map<string, number>()
    for (const task of monthlyTasks) {
      periodPercent.set(
        task.id,
        calculatePeriodTaskPercentage(task.id, monthlyTasks, monthlyHabitData, periods, monthlyExempt),
      )
    }
    const shown = sortHabits(monthlyTasks, habitSortMode, {
      data: monthlyHabitData,
      asOf: currentDate,
      frequency: "monthly",
      descending: sortDescending,
      completionPercent: (taskId) => periodPercent.get(taskId) ?? 0,
    })
    const gradeAsOf = monthWindowAsOf
    const grade = calculatePeriodGrade(monthlyTasks, monthlyHabitData, periods, gradeAsOf, gradeTolerance, monthlyExempt)
    const output = calculatePeriodOutputGrade(
      monthlyTasks,
      monthlyHabitData,
      periods,
      gradeAsOf,
      outputGradeTolerance,
      monthlyExempt,
    )
    const prio = prioritizedHabits(monthlyTasks, monthlyHabitData, gradeAsOf, "monthly")
    return {
      monthlyTasks,
      monthlyExempt,
      monthlyKind,
      periods,
      periodPercent,
      shown,
      grade,
      output,
      prioGrade:
        prio.length > 0
          ? openGrade(calculatePeriodGrade(prio, monthlyHabitData, periods, gradeAsOf, gradeTolerance, monthlyExempt))
          : null,
      prioOutput:
        prio.length > 0
          ? openOutput(
              calculatePeriodOutputGrade(
                prio,
                monthlyHabitData,
                periods,
                gradeAsOf,
                outputGradeTolerance,
                monthlyExempt,
              ),
            )
          : null,
    }
  }, [
    habitTab,
    tasks,
    monthlyHabitData,
    habitExemptions,
    exemptionCtx,
    monthWindowAsOf,
    habitMonthWindow,
    habitBirthday,
    currentDate,
    gradeTolerance,
    outputGradeTolerance,
    habitSortMode,
    sortDescending,
  ])

  const quarterly = useMemo(() => {
    const quarterlyTasks = filterHabitsByFrequency(tasks, "quarterly")
    const quarterlyExempt = (task: Task, key: string) =>
      isHabitPeriodExempt(task, key, "quarterly", habitExemptions, exemptionCtx)
    const quarterlyKind = (task: Task, key: string) =>
      exemptionKind(task, key, "quarterly", habitExemptions, exemptionCtx)
    if (habitTab !== "quarterly") {
      return {
        quarterlyTasks,
        quarterlyExempt,
        quarterlyKind,
        periods: [],
        periodPercent: IDLE_PERCENTS,
        shown: quarterlyTasks,
        grade: IDLE_GRADE,
        output: IDLE_OUTPUT,
        prioGrade: null,
        prioOutput: null,
      }
    }
    const periods = seasonPeriodColumns(currentQuarter, currentDate)
    const periodPercent = new Map<string, number>()
    for (const task of quarterlyTasks) {
      periodPercent.set(
        task.id,
        calculatePeriodTaskPercentage(task.id, quarterlyTasks, quarterlyHabitData, periods, quarterlyExempt),
      )
    }
    const shown = sortHabits(quarterlyTasks, habitSortMode, {
      data: quarterlyHabitData,
      asOf: currentDate,
      frequency: "quarterly",
      descending: sortDescending,
      completionPercent: (taskId) => periodPercent.get(taskId) ?? 0,
    })
    const last = periods[periods.length - 1]?.date
    const periodEnd = last ? new Date(last.getFullYear(), last.getMonth() + 3, 0) : currentQuarter
    const gradeAsOf = periods.length ? gradeAsOfForVisibleWindow(periods[0].date, periodEnd, currentDate) : currentDate
    const grade = calculatePeriodGrade(
      quarterlyTasks,
      quarterlyHabitData,
      periods,
      gradeAsOf,
      gradeTolerance,
      quarterlyExempt,
    )
    const output = calculatePeriodOutputGrade(
      quarterlyTasks,
      quarterlyHabitData,
      periods,
      gradeAsOf,
      outputGradeTolerance,
      quarterlyExempt,
    )
    const prio = prioritizedHabits(quarterlyTasks, quarterlyHabitData, gradeAsOf, "quarterly")
    return {
      quarterlyTasks,
      quarterlyExempt,
      quarterlyKind,
      periods,
      periodPercent,
      shown,
      grade,
      output,
      prioGrade:
        prio.length > 0
          ? openGrade(
              calculatePeriodGrade(prio, quarterlyHabitData, periods, gradeAsOf, gradeTolerance, quarterlyExempt),
            )
          : null,
      prioOutput:
        prio.length > 0
          ? openOutput(
              calculatePeriodOutputGrade(
                prio,
                quarterlyHabitData,
                periods,
                gradeAsOf,
                outputGradeTolerance,
                quarterlyExempt,
              ),
            )
          : null,
    }
  }, [
    habitTab,
    tasks,
    quarterlyHabitData,
    habitExemptions,
    exemptionCtx,
    currentQuarter,
    currentDate,
    gradeTolerance,
    outputGradeTolerance,
    habitSortMode,
    sortDescending,
  ])

  const {
    dailyTasks,
    dailyExempt,
    dailyKind,
    shown: dailyShown,
    weekPercent: dailyWeekPercent,
    grade: weekGrade,
    output: outputGrade,
    weekAverage,
    prioGrade: weekPrioGrade,
    prioOutput: outputPrioGrade,
    stones: willpowerStoneRows,
  } = daily
  const willpowerStones = hydrated ? willpowerStoneRows : []
  const {
    weeklyTasks,
    weeklyExempt,
    weeklyKind,
    periods: weekPeriods,
    periodPercent: weeklyPeriodPercent,
    shown: weeklyShown,
    grade: weeklyGrade,
    output: weeklyOutput,
    prioGrade: weeklyPrioGrade,
    prioOutput: weeklyPrioOutput,
  } = weekly
  const {
    monthlyTasks,
    monthlyExempt,
    monthlyKind,
    periods: monthPeriods,
    periodPercent: monthlyPeriodPercent,
    shown: monthlyShown,
    grade: monthlyGrade,
    output: monthlyOutput,
    prioGrade: monthlyPrioGrade,
    prioOutput: monthlyPrioOutput,
  } = monthly
  const {
    quarterlyTasks,
    quarterlyExempt,
    quarterlyKind,
    periods: seasonPeriods,
    periodPercent: quarterlyPeriodPercent,
    shown: quarterlyShown,
    grade: quarterlyGrade,
    output: quarterlyOutput,
    prioGrade: quarterlyPrioGrade,
    prioOutput: quarterlyPrioOutput,
  } = quarterly
  const activePrioGrade =
    habitTab === "quarterly"
      ? quarterlyPrioGrade
      : habitTab === "monthly"
        ? monthlyPrioGrade
        : habitTab === "weekly"
          ? weeklyPrioGrade
          : weekPrioGrade
  const activePrioOutput =
    habitTab === "quarterly"
      ? quarterlyPrioOutput
      : habitTab === "monthly"
        ? monthlyPrioOutput
        : habitTab === "weekly"
          ? weeklyPrioOutput
          : outputPrioGrade
  const activeGrade =
    habitTab === "quarterly" ? quarterlyGrade : habitTab === "monthly" ? monthlyGrade : habitTab === "weekly" ? weeklyGrade : weekGrade
  const activeOutput =
    habitTab === "quarterly"
      ? quarterlyOutput
      : habitTab === "monthly"
        ? monthlyOutput
        : habitTab === "weekly"
          ? weeklyOutput
          : outputGrade
  // Hold tubes until the vault lands so a hollow seed cannot paint "—" / 0 and stick.
  const shownGrade = hydrated ? blendPriorityScore(activeGrade.grade, activePrioGrade, gradeUsePriority) : 0
  const shownOutput = hydrated ? blendPriorityScore(activeOutput.grade, activePrioOutput, outputUsePriority) : 0
  const gradeDaysReady = hydrated ? activeGrade.daysIncluded : 0
  const outputReady = hydrated && activeOutput.daysIncluded > 0 && activeOutput.habits.length > 0
  const gradePeriodUnit =
    habitTab === "quarterly" ? "season" : habitTab === "monthly" ? "month" : habitTab === "weekly" ? "week" : "day"
  const gradeLabel = habitTab === "daily" ? "Week grade" : "Span grade"
  const gradeThrough =
    gradeDaysReady === 0
      ? null
      : habitTab === "daily"
        ? gradeDaysReady === 7
          ? "full week"
          : `through ${format(weekDates[gradeDaysReady - 1], "EEE")}`
        : `through ${format(
            activeGrade.days[gradeDaysReady - 1].date,
            habitTab === "quarterly" ? "MMM yyyy" : habitTab === "monthly" ? "MMM yyyy" : "MMM d",
          )}`
  const goodDays = useMemo(() => {
    if (habitTab !== "daily") return IDLE_GOOD_DAYS
    return goodDaySummary(
      dailyTasks,
      weeklyData,
      goodDayAsOf,
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
  }, [
    habitTab,
    dailyTasks,
    weeklyData,
    goodDayAsOf,
    accomplishmentThreshold,
    accomplishmentBonus,
    goodDaysUsePriority,
    dailyExempt,
  ])
  const todayPrioRaw = useMemo(() => {
    if (habitTab !== "daily") return null
    const todayPrioHabits = prioritizedHabits(dailyTasks, weeklyData, goodDayAsOf, "daily")
    return todayPrioHabits.length > 0
      ? rawDayCompletionPercent(todayPrioHabits, weeklyData, goodDayAsOf, dailyExempt)
      : null
  }, [habitTab, dailyTasks, weeklyData, goodDayAsOf, dailyExempt])
  const viewingCurrentPeriod =
    habitTab === "quarterly"
      ? quarterKey(currentQuarter) === quarterKey(currentDate)
      : habitTab === "monthly" || habitTab === "weekly"
        ? true
        : isSameLocalWeek(currentWeekStart, currentDate)

  const weekWindowRange =
    weekPeriods.length === 0
      ? formatDateRange(weekWindowAsOf, addCalendarDays(weekWindowAsOf, 6))
      : formatDateRange(weekPeriods[0].date, addCalendarDays(weekPeriods[weekPeriods.length - 1].date, 6))

  return (
    <div data-ui-name="Habits" data-ui-docs="components/Home/Habits/README.md">
      <Tabs value={habitTab} onValueChange={(v) => setHabitTab(v as typeof habitTab)}>
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
                onPreviousWeek={() => setCurrentQuarter((q) => shiftQuarter(q, -1))}
                onNextWeek={() => setCurrentQuarter((q) => shiftQuarter(q, 1))}
                onCurrentWeek={() => setCurrentQuarter(quarterStartDate(new Date()))}
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
                onPreviousWeek={() => setCurrentWeekStart(addCalendarDays(currentWeekStart, -7))}
                onNextWeek={() => setCurrentWeekStart(addCalendarDays(currentWeekStart, 7))}
                onCurrentWeek={() => setCurrentWeekStart(getWeekStartDate(new Date()))}
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
          <TabsList aria-label="Habit period" className="hab-period-keys">
            <TabsTrigger value="daily">Daily{hydrated ? ` (${dailyTasks.length})` : ""}</TabsTrigger>
            <TabsTrigger value="weekly">Weekly{hydrated ? ` (${weeklyTasks.length})` : ""}</TabsTrigger>
            <TabsTrigger value="monthly">Monthly{hydrated ? ` (${monthlyTasks.length})` : ""}</TabsTrigger>
            <TabsTrigger value="quarterly" data-season={seasonSlug(seasonOfDate(currentQuarter))}>
              Season{hydrated ? ` (${quarterlyTasks.length})` : ""}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="daily" className="hab-pane">
          {morningHabitPriorities.length > 0 && (
            <div className="hab-morning">
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
          <div className="hab-desk">
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
                  missedOpWand={missedOpWand}
                  hideCompletedAndMissed={hideCompletedAndMissed}
                  onToggleMissed={(taskId, periodKey, missed) => {
                    const date = parseLocalDate(periodKey)
                    if (date) updateCompletion(taskId, date, { missedOpportunity: missed })
                  }}
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
                    return dailyWeekPercent.get(taskId) ?? 0
                  }}
                  calculateDayPercentage={(date, index) => {
                    const key = formatLocalDateKey(date)
                    if (dailyTasks.length > 0 && dailyTasks.every((task) => dailyExempt(task, key))) return null
                    return calculateDayPercentageAV(key, dailyTasks, weeklyData, index, dailyExempt)
                  }}
                  hideCompleted={hideCompletedToday}
                  exemptionWand={exemptionWand}
                  missedOpWand={missedOpWand}
                  hideCompletedAndMissed={hideCompletedAndMissed}
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
              <HabitsTabControls
                gradeLabel={gradeLabel}
                gradeValueText={gradeDaysReady === 0 ? "—" : `${shownGrade.toFixed(0)}%`}
                gradeThrough={gradeThrough}
                gradeBarValue={gradeDaysReady > 0 ? shownGrade : null}
                gradeHue={gradeTubeColor}
                onGradeClick={() => setShowGradeBreakdown(true)}
                outputValueText={!outputReady ? "—" : `${shownOutput.toFixed(0)}%`}
                outputBarValue={outputReady ? shownOutput : null}
                outputHue={outputGradeTubeColor}
                onOutputClick={() => setShowOutputGradeBreakdown(true)}
                goodDays={{
                  streak: goodDays.streak,
                  last30Count: goodDays.last30Count,
                  onClick: () => setShowGoodDays(true),
                }}
                sortCompletionLabel="Weekly completion %"
                habitSortMode={habitSortMode}
                habitSortDirection={habitSortDirection}
                onHabitSortMode={setHabitSortMode}
                onHabitSortDirection={setHabitSortDirection}
                exemptionWand={exemptionWand}
                onExemptionWand={setExemptionWand}
                missedOpWand={missedOpWand}
                onMissedOpWand={setMissedOpWand}
                toggles={["heatmap", "dayView", "hideCompleted", "loadingBar", "smallLeds"]}
                hideCompletedLabel="Hide Completed Today"
                hideCompletedId="hide-done"
                hideCompleted={hideCompletedToday}
                onHideCompleted={setHideCompletedToday}
                hideCompletedAndMissedId="hide-completed-and-missed"
                hideCompletedAndMissed={hideCompletedAndMissed}
                onHideCompletedAndMissed={setHideCompletedAndMissed}
                heatmapOn={habitViewMode === "heatmap"}
                onHeatmap={(on) => setHabitViewMode(on ? "heatmap" : "grid")}
                dayViewOn={habitDayView}
                onDayView={setHabitDayView}
                loadingBarId="loading-bar"
                loadingBar={percentLoadingBar}
                onLoadingBar={setPercentLoadingBar}
                smallLedsId="small-leds"
                smallLeds={habitSmallLeds}
                onSmallLeds={setHabitSmallLeds}
                onNewHabit={() => {
                  setEditingTask(null)
                  setDefaultFrequency(habitTab)
                  setShowTaskForm(true)
                }}
              />
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
                missedOpWand={missedOpWand}
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
              />
              )}
            </div>
            <HabitsControlPanel stones={willpowerStones}>
              <HabitsTabControls
                gradeLabel={gradeLabel}
                gradeValueText={gradeDaysReady === 0 ? "—" : `${shownGrade.toFixed(0)}%`}
                gradeThrough={gradeThrough}
                gradeBarValue={gradeDaysReady > 0 ? shownGrade : null}
                gradeHue={gradeTubeColor}
                onGradeClick={() => setShowGradeBreakdown(true)}
                outputValueText={!outputReady ? "—" : `${shownOutput.toFixed(0)}%`}
                outputBarValue={outputReady ? shownOutput : null}
                outputHue={outputGradeTubeColor}
                onOutputClick={() => setShowOutputGradeBreakdown(true)}
                sortId="habit-sort-weekly"
                sortCompletionLabel="Weekly completion %"
                weekWindow={
                  <HabitWeekWindowControl mode={habitWeekWindow} onMode={setHabitWeekWindow} />
                }
                habitSortMode={habitSortMode}
                habitSortDirection={habitSortDirection}
                onHabitSortMode={setHabitSortMode}
                onHabitSortDirection={setHabitSortDirection}
                exemptionWand={exemptionWand}
                onExemptionWand={setExemptionWand}
                missedOpWand={missedOpWand}
                onMissedOpWand={setMissedOpWand}
                toggles={["hideCompleted", "loadingBar", "smallLeds"]}
                hideCompletedLabel="Hide Completed This Week"
                hideCompletedId="hide-done-weekly"
                hideCompleted={hideCompletedToday}
                onHideCompleted={setHideCompletedToday}
                hideCompletedAndMissedId="hide-completed-and-missed-weekly"
                hideCompletedAndMissed={hideCompletedAndMissed}
                onHideCompletedAndMissed={setHideCompletedAndMissed}
                loadingBarId="loading-bar-weekly"
                loadingBar={percentLoadingBar}
                onLoadingBar={setPercentLoadingBar}
                smallLedsId="small-leds-weekly"
                smallLeds={habitSmallLeds}
                onSmallLeds={setHabitSmallLeds}
                onNewHabit={() => {
                  setEditingTask(null)
                  setDefaultFrequency("weekly")
                  setShowTaskForm(true)
                }}
              />
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
                missedOpWand={missedOpWand}
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
              />
              )}
            </div>
            <HabitsControlPanel stones={willpowerStones}>
              <HabitsTabControls
                gradeLabel={gradeLabel}
                gradeValueText={gradeDaysReady === 0 ? "—" : `${shownGrade.toFixed(0)}%`}
                gradeThrough={gradeThrough}
                gradeBarValue={gradeDaysReady > 0 ? shownGrade : null}
                gradeHue={gradeTubeColor}
                onGradeClick={() => setShowGradeBreakdown(true)}
                outputValueText={!outputReady ? "—" : `${shownOutput.toFixed(0)}%`}
                outputBarValue={outputReady ? shownOutput : null}
                outputHue={outputGradeTubeColor}
                onOutputClick={() => setShowOutputGradeBreakdown(true)}
                sortId="habit-sort-monthly"
                sortCompletionLabel="Monthly completion %"
                monthWindow={
                  <HabitMonthWindowControl
                    mode={habitMonthWindow}
                    birthday={habitBirthday}
                    onMode={setHabitMonthWindow}
                    onBirthday={setHabitBirthday}
                  />
                }
                habitSortMode={habitSortMode}
                habitSortDirection={habitSortDirection}
                onHabitSortMode={setHabitSortMode}
                onHabitSortDirection={setHabitSortDirection}
                exemptionWand={exemptionWand}
                onExemptionWand={setExemptionWand}
                missedOpWand={missedOpWand}
                onMissedOpWand={setMissedOpWand}
                toggles={["hideCompleted", "loadingBar", "smallLeds"]}
                hideCompletedLabel="Hide Completed This Month"
                hideCompletedId="hide-done-monthly"
                hideCompleted={hideCompletedToday}
                onHideCompleted={setHideCompletedToday}
                hideCompletedAndMissedId="hide-completed-and-missed-monthly"
                hideCompletedAndMissed={hideCompletedAndMissed}
                onHideCompletedAndMissed={setHideCompletedAndMissed}
                loadingBarId="loading-bar-monthly"
                loadingBar={percentLoadingBar}
                onLoadingBar={setPercentLoadingBar}
                smallLedsId="small-leds-monthly"
                smallLeds={habitSmallLeds}
                onSmallLeds={setHabitSmallLeds}
                onNewHabit={() => {
                  setEditingTask(null)
                  setDefaultFrequency("monthly")
                  setShowTaskForm(true)
                }}
              />
            </HabitsControlPanel>
          </div>
        </TabsContent>

        <TabsContent value="quarterly" className="hab-pane" data-season={seasonSlug(seasonOfDate(currentQuarter))}>
          <div className="hab-desk">
            <div className="hab-well">
              {!hydrated ? (
                <div className="habit-grid-wrap" aria-busy="true">
                  <p className="text-sm text-muted-foreground p-4">Loading habits…</p>
                </div>
              ) : (
                <PeriodHabitList
                  tasks={quarterlyShown}
                  periods={seasonPeriods}
                  data={quarterlyHabitData}
                  onUpdate={(taskId, periodDate, c) => updateQuarterlyHabitCompletion(taskId, periodDate, c)}
                  onEdit={handleEditTask}
                  hideCompleted={hideCompletedToday}
                  exemptionWand={exemptionWand}
                  missedOpWand={missedOpWand}
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
                />
              )}
            </div>
            <HabitsControlPanel stones={willpowerStones}>
              <HabitsTabControls
                gradeLabel={gradeLabel}
                gradeValueText={gradeDaysReady === 0 ? "—" : `${shownGrade.toFixed(0)}%`}
                gradeThrough={gradeThrough}
                gradeBarValue={gradeDaysReady > 0 ? shownGrade : null}
                gradeHue={gradeTubeColor}
                onGradeClick={() => setShowGradeBreakdown(true)}
                outputValueText={!outputReady ? "—" : `${shownOutput.toFixed(0)}%`}
                outputBarValue={outputReady ? shownOutput : null}
                outputHue={outputGradeTubeColor}
                onOutputClick={() => setShowOutputGradeBreakdown(true)}
                sortId="habit-sort-season"
                sortCompletionLabel="Season completion %"
                habitSortMode={habitSortMode}
                habitSortDirection={habitSortDirection}
                onHabitSortMode={setHabitSortMode}
                onHabitSortDirection={setHabitSortDirection}
                exemptionWand={exemptionWand}
                onExemptionWand={setExemptionWand}
                missedOpWand={missedOpWand}
                onMissedOpWand={setMissedOpWand}
                toggles={["hideCompleted", "loadingBar", "smallLeds"]}
                hideCompletedLabel="Hide Completed This Season"
                hideCompletedId="hide-done-season"
                hideCompleted={hideCompletedToday}
                onHideCompleted={setHideCompletedToday}
                hideCompletedAndMissedId="hide-completed-and-missed-season"
                hideCompletedAndMissed={hideCompletedAndMissed}
                onHideCompletedAndMissed={setHideCompletedAndMissed}
                loadingBarId="loading-bar-season"
                loadingBar={percentLoadingBar}
                onLoadingBar={setPercentLoadingBar}
                smallLedsId="small-leds-season"
                smallLeds={habitSmallLeds}
                onSmallLeds={setHabitSmallLeds}
                onNewHabit={() => {
                  setEditingTask(null)
                  setDefaultFrequency("quarterly")
                  setShowTaskForm(true)
                }}
              />
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
    </div>
  )
}

export default WeeklyTaskTracker
