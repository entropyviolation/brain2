/**
 * components/Home/Habits/habits-phone-page.tsx — Phone Habits page
 *
 * Its own page. `WeeklyTaskTracker` mounts this when the viewport is at
 * most 767px, and does not mount the desktop console. This file owns the
 * phone data wiring. The desktop tree stays in `habit-tracker.tsx`.
 */
"use client"

import { useState, useEffect, useLayoutEffect, useMemo } from "react"
import { usePersistHydrated } from "@/lib/use-persist-hydrated"
import {
  habitsCalendarKey,
  habitsLensFromStored,
  habitsViewedMonth,
  habitsViewedQuarter,
  habitsViewedWeekStart,
  retainHabitsWeekDates,
} from "@/components/Home/Habits/habits-period-cursor"
import { HabitControlBar, type HabitControlToggle } from "@/components/Home/Habits/habit-priority-bar"
import { HabitWandBanner } from "@/components/Home/Habits/habit-wand-banner"
import { filterHabitsByFrequency, weekPeriodColumns, monthPeriodColumns, seasonPeriodColumns, type PeriodColumn } from "@/components/Home/Habits/period-habit-list"
import { TaskFormDialog } from "@/components/Home/Habits/daily-task-form-dialog"
import { GradeBreakdownDialog } from "@/components/Home/Habits/grade-breakdown-dialog"
import { OutputGradeBreakdownDialog } from "@/components/Home/Habits/output-grade-breakdown-dialog"
import { GoodDaysDialog } from "@/components/Home/Habits/good-days-dialog"
import { weekWillpowerStones } from "@/lib/willpower-stones"
import { type WeeklyTask as Task, type TaskCompletion, type HabitFrequency } from "@/lib/types"
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
  getWeekDates,
  formatLocalDateKey,
  parseLocalDate,
  addCalendarDays,
  formatDateRange,
  isSameLocalWeek,
} from "@/lib/date-utils"
import { HabitsPhoneScreen } from "@/components/Home/Habits/habits-phone-screen"
import { SettingsDialog } from "@/components/Home/Habits/settings-dialog"
import { useHabitsStore } from "@/lib/habits-store"
import { useReviewsStore, localDayKey } from "@/lib/reviews-store"
import { useHabitTrackingSync, syncTrackedHabitsForTask } from "@/lib/habit-tracking-sync"
import { goodDaySummary, goodPeriodSummary, rawDayCompletionPercent, type GoodDaySummary } from "@/lib/habit-accomplishment"
import {
  blendPriorityScore,
  prioritizedHabits,
} from "@/lib/habit-priority"
import { mergeVisibleOrder } from "@/lib/habit-order"
import { effectiveSortDescending, sortHabits } from "@/lib/habit-sort"
import { exemptionKind, isHabitPeriodExempt } from "@/lib/habit-exemption"
import { useExemptionContext } from "@/lib/sleep-store"
import { format } from "date-fns"
import { APP_NAV_KEYS, HABIT_FREQ_TABS, readStoredDate, writeStoredDate } from "@/lib/app-navigation"
import { resolveHomeCursor } from "@/lib/use-current-date"
import { clearHabitSettingsReturn, habitSettingsReturnReady, peekHabitSettingsReturn, takeHabitDraft } from "@/lib/habit-list-item"
import { subscribeNavRestore } from "@/lib/screen-location"
import { quarterKey, quarterLabel, seasonOfDate, seasonSlug, shiftQuarter } from "@/lib/seasons"
import { usePersistedTab } from "@/lib/use-persisted-tab"
import "./habit-grid.css"
import "./habit-chrome.css"
import "./noble-gas-tube.css"

const EMPTY_HABIT_PRIORITY_IDS: string[] = []

/** Current column when a single-period rocker is on. The window list stays intact for grades. */
function singlePeriodColumns(periods: PeriodColumn[]): PeriodColumn[] {
  if (periods.length === 0) return periods
  const current = periods.find((column) => column.isCurrent)
  return [current ?? periods[periods.length - 1]]
}

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

export function HabitsPhonePage({ currentDate = new Date() }: { currentDate?: Date }) {
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
  const highlightHabitPriorities = useHabitsStore((s) => s.highlightHabitPriorities)
  const groupHabitsByKind = useHabitsStore((s) => s.groupHabitsByKind)
  const setGroupHabitsByKind = useHabitsStore((s) => s.setGroupHabitsByKind)
  const setHighlightHabitPriorities = useHabitsStore((s) => s.setHighlightHabitPriorities)
  const showStreakMarks = useHabitsStore((s) => s.showStreakMarks)
  const setShowStreakMarks = useHabitsStore((s) => s.setShowStreakMarks)
  const ritualMultiplier = useHabitsStore((s) => s.morningRitualPointMultiplier)
  const reorderHabits = useHabitsStore((s) => s.reorderHabits)
  const [orderDraft, setOrderDraft] = useState<{ frequency: HabitFrequency; ids: string[] } | null>(null)
  useEffect(() => {
    if (habitSortMode !== "default") setOrderDraft(null)
  }, [habitSortMode])
  const habitMonthWindow = useHabitsStore((s) => s.habitMonthWindow)
  const setHabitMonthWindow = useHabitsStore((s) => s.setHabitMonthWindow)
  const habitBirthday = useHabitsStore((s) => s.habitBirthday)
  const setHabitBirthday = useHabitsStore((s) => s.setHabitBirthday)
  const habitWeekWindow = useHabitsStore((s) => s.habitWeekWindow)
  const setHabitWeekWindow = useHabitsStore((s) => s.setHabitWeekWindow)
  const habitWeekView = useHabitsStore((s) => s.habitWeekView)
  const setHabitWeekView = useHabitsStore((s) => s.setHabitWeekView)
  const habitMonthView = useHabitsStore((s) => s.habitMonthView)
  const setHabitMonthView = useHabitsStore((s) => s.setHabitMonthView)
  const habitSeasonView = useHabitsStore((s) => s.habitSeasonView)
  const setHabitSeasonView = useHabitsStore((s) => s.setHabitSeasonView)

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

  // Coarser periods follow Home `currentDate` until milled nav pages a lens.
  // First paint matches SSR: ignore localStorage (same rule as usePersistedTab).
  // After mount, a stored cursor that is not Home day's period becomes the lens.
  const [weekLens, setWeekLens] = useState<Date | null>(null)
  const [monthLens, setMonthLens] = useState<Date | null>(null)
  const [quarterLens, setQuarterLens] = useState<Date | null>(null)
  const [weekDates, setWeekDates] = useState<Date[]>(() => getWeekDates(habitsViewedWeekStart(currentDate)))
  const [periodCursorReady, setPeriodCursorReady] = useState(false)

  const currentWeekStart = weekLens ?? habitsViewedWeekStart(currentDate)
  const currentMonth = monthLens ?? habitsViewedMonth(currentDate)
  const currentQuarter = quarterLens ?? habitsViewedQuarter(currentDate)

  useLayoutEffect(() => {
    const asOf = resolveHomeCursor(new Date())
    setWeekLens(habitsLensFromStored(asOf, readStoredDate(APP_NAV_KEYS.homeHabitsWeek), "week"))
    setMonthLens(habitsLensFromStored(asOf, readStoredDate(APP_NAV_KEYS.homeHabitsMonth), "month"))
    setQuarterLens(habitsLensFromStored(asOf, readStoredDate(APP_NAV_KEYS.homeHabitsQuarter), "quarter"))
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
  const orderWithDraft = (rows: Task[], frequency: HabitFrequency) => {
    if (!orderDraft || orderDraft.frequency !== frequency) return rows
    const rank = new Map(orderDraft.ids.map((id, index) => [id, index]))
    return [...rows].sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9))
  }
  const dailyRows = orderWithDraft(dailyShown, "daily")
  const weeklyRows = orderWithDraft(weeklyShown, "weekly")
  const monthlyRows = orderWithDraft(monthlyShown, "monthly")
  const quarterlyRows = orderWithDraft(quarterlyShown, "quarterly")
  const editingFrequency = habitSortMode === "default" ? orderDraft?.frequency : undefined
  const beginOrder = (rows: Task[], frequency: HabitFrequency) => {
    setOrderDraft({ frequency, ids: rows.map((row) => row.id) })
  }
  const saveOrder = () => {
    if (!orderDraft) return
    reorderHabits(orderDraft.frequency, orderDraft.ids)
    setOrderDraft(null)
  }
  const reorderVisible = (frequency: HabitFrequency, visibleIds: string[]) => {
    setOrderDraft((prev) => {
      if (!prev || prev.frequency !== frequency) return prev
      return { frequency, ids: mergeVisibleOrder(prev.ids, visibleIds) }
    })
  }
  const viewToggles = (frequency: HabitFrequency): HabitControlToggle[] => {
    const suffix =
      frequency === "weekly"
        ? "-weekly"
        : frequency === "monthly"
          ? "-monthly"
          : frequency === "quarterly"
            ? "-season"
            : ""
    const toggles: HabitControlToggle[] = [
      {
        id: `highlight-priorities${suffix}`,
        label: "Highlight priorities",
        checked: highlightHabitPriorities,
        onCheckedChange: setHighlightHabitPriorities,
      },
      {
        id: `streak-marks${suffix}`,
        label: "Streaks and multipliers",
        checked: showStreakMarks,
        onCheckedChange: setShowStreakMarks,
      },
    ]
    if (frequency === "daily") {
      toggles.push(
        {
          id: "group-by-kind",
          label: "Group by category",
          checked: groupHabitsByKind,
          onCheckedChange: setGroupHabitsByKind,
        },
        {
          id: "heatmap-view",
          label: "Heatmap View",
          checked: habitViewMode === "heatmap",
          onCheckedChange: (on) => setHabitViewMode(on ? "heatmap" : "grid"),
        },
        {
          id: "day-view",
          label: "Day View",
          checked: habitDayView,
          onCheckedChange: setHabitDayView,
        },
      )
    } else if (frequency === "weekly") {
      toggles.push({
        id: "week-view",
        label: "Week View",
        checked: habitWeekView,
        onCheckedChange: setHabitWeekView,
      })
    } else if (frequency === "monthly") {
      toggles.push({
        id: "month-view",
        label: "Month View",
        checked: habitMonthView,
        onCheckedChange: setHabitMonthView,
      })
    } else {
      toggles.push({
        id: "season-view",
        label: "Season View",
        checked: habitSeasonView,
        onCheckedChange: setHabitSeasonView,
      })
    }
    toggles.push(
      {
        id: `hide-done${suffix}`,
        label: "Hide Done",
        checked: hideCompletedToday,
        onCheckedChange: setHideCompletedToday,
      },
      {
        id: `hide-completed-and-missed${suffix}`,
        label: "Mask done and missed",
        checked: hideCompletedAndMissed,
        onCheckedChange: setHideCompletedAndMissed,
      },
    )
    return toggles
  }
  const sortTools = (frequency: HabitFrequency, rows: Task[], sortId: string) => (
    <HabitControlBar
      frequency={frequency}
      sortId={sortId}
      sortMode={habitSortMode}
      sortDirection={habitSortDirection}
      onSortMode={setHabitSortMode}
      onSortDirection={setHabitSortDirection}
      editing={editingFrequency === frequency}
      onEditOrder={() => beginOrder(rows, frequency)}
      onSaveOrder={saveOrder}
      onCancelOrder={() => setOrderDraft(null)}
    />
  )
  const priorityBar = () => {
    return (
      <div className="hab-sheet-mast">
        <div className="hab-wand-mount" data-testid="habit-wand-banner-mount">
          <HabitWandBanner
            view={exemptionWand ? "exemption" : missedOpWand ? "missed" : null}
          />
        </div>
      </div>
    )
  }
  const priorityProps = {
    highlightPriorities: highlightHabitPriorities,
    ritualIds: morningHabitPriorities,
    ritualMultiplier,
    showStreakMarks,
  }
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
  const goodPeriod = useMemo(() => {
    if (habitTab !== "weekly" && habitTab !== "monthly" && habitTab !== "quarterly") return null
    const unit = habitTab === "weekly" ? "week" : habitTab === "monthly" ? "month" : "season"
    return goodPeriodSummary(
      dailyTasks,
      weeklyData,
      goodDayAsOf,
      unit,
      accomplishmentThreshold,
      accomplishmentBonus,
      dailyExempt,
    )
  }, [
    habitTab,
    dailyTasks,
    weeklyData,
    goodDayAsOf,
    accomplishmentThreshold,
    accomplishmentBonus,
    dailyExempt,
  ])
  const periodWells = goodPeriod
    ? {
        streak: goodPeriod.streak,
        last30Count: goodPeriod.lookbackCount,
        streakLabel: goodPeriod.streakLabel,
        countLabel: goodPeriod.countLabel,
        countOf: goodPeriod.lookbackSize,
        title: `Click for ${goodPeriod.streakLabel}, recent ${goodPeriod.plural}, and accomplishment settings`,
        onClick: () => setShowGoodDays(true),
      }
    : undefined
  const viewingCurrentPeriod =
    habitTab === "quarterly"
      ? quarterKey(currentQuarter) === quarterKey(currentDate)
      : habitTab === "monthly"
        ? habitsCalendarKey(currentMonth) === habitsCalendarKey(habitsViewedMonth(currentDate))
        : isSameLocalWeek(currentWeekStart, currentDate)

  const weekWindowRange =
    weekPeriods.length === 0
      ? formatDateRange(weekWindowAsOf, addCalendarDays(weekWindowAsOf, 6))
      : formatDateRange(weekPeriods[0].date, addCalendarDays(weekPeriods[weekPeriods.length - 1].date, 6))

  const weekSheetPeriods = habitWeekView ? singlePeriodColumns(weekPeriods) : weekPeriods
  const monthSheetPeriods = habitMonthView ? singlePeriodColumns(monthPeriods) : monthPeriods
  const seasonSheetPeriods = habitSeasonView ? singlePeriodColumns(seasonPeriods) : seasonPeriods
  const weekPlanColumn = habitWeekView ? weekSheetPeriods[0] : undefined
  const monthPlanColumn = habitMonthView ? monthSheetPeriods[0] : undefined
  const seasonPlanColumn = habitSeasonView ? seasonSheetPeriods[0] : undefined
  const dayPlanKey = formatLocalDateKey(currentDate)
  const habitDialogs = (
    <>
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
  return (
      <HabitsPhoneScreen
        dialogs={habitDialogs}
        habitTab={habitTab}
        setHabitTab={setHabitTab}
        hydrated={hydrated}
        currentDate={currentDate}
        currentWeekStart={currentWeekStart}
        weekEndDate={weekEndDate}
        currentMonth={currentMonth}
        currentQuarter={currentQuarter}
        setWeekLens={setWeekLens}
        setMonthLens={setMonthLens}
        setQuarterLens={setQuarterLens}
        viewingCurrentPeriod={viewingCurrentPeriod}
        weekWindowRange={weekWindowRange}
        monthWindowAsOf={monthWindowAsOf}
        weekDates={weekDates}
        weekPeriods={weekPeriods}
        monthPeriods={monthPeriods}
        seasonPeriods={seasonPeriods}
        weekSheetPeriods={weekSheetPeriods}
        monthSheetPeriods={monthSheetPeriods}
        seasonSheetPeriods={seasonSheetPeriods}
        weekPlanColumn={weekPlanColumn}
        monthPlanColumn={monthPlanColumn}
        seasonPlanColumn={seasonPlanColumn}
        dailyRows={dailyRows}
        weeklyRows={weeklyRows}
        monthlyRows={monthlyRows}
        quarterlyRows={quarterlyRows}
        dailyShown={dailyShown}
        weeklyShown={weeklyShown}
        monthlyShown={monthlyShown}
        quarterlyShown={quarterlyShown}
        dailyTasks={dailyTasks}
        weeklyTasks={weeklyTasks}
        monthlyTasks={monthlyTasks}
        quarterlyTasks={quarterlyTasks}
        weeklyData={weeklyData}
        weeklyHabitData={weeklyHabitData}
        monthlyHabitData={monthlyHabitData}
        quarterlyHabitData={quarterlyHabitData}
        dailyWeekPercent={dailyWeekPercent}
        weeklyPeriodPercent={weeklyPeriodPercent}
        monthlyPeriodPercent={monthlyPeriodPercent}
        quarterlyPeriodPercent={quarterlyPeriodPercent}
        dailyExempt={dailyExempt}
        weeklyExempt={weeklyExempt}
        monthlyExempt={monthlyExempt}
        quarterlyExempt={quarterlyExempt}
        dailyKind={dailyKind}
        weeklyKind={weeklyKind}
        monthlyKind={monthlyKind}
        quarterlyKind={quarterlyKind}
        updateCompletion={updateCompletion}
        updateWeeklyHabitCompletion={updateWeeklyHabitCompletion}
        updateMonthlyHabitCompletion={updateMonthlyHabitCompletion}
        updateQuarterlyHabitCompletion={updateQuarterlyHabitCompletion}
        setHabitExemption={setHabitExemption}
        handleEditTask={handleEditTask}
        hideCompletedToday={hideCompletedToday}
        exemptionWand={exemptionWand}
        setExemptionWand={setExemptionWand}
        missedOpWand={missedOpWand}
        setMissedOpWand={setMissedOpWand}
        hideCompletedAndMissed={hideCompletedAndMissed}
        groupHabitsByKind={groupHabitsByKind}
        editingFrequency={editingFrequency}
        reorderVisible={reorderVisible}
        habitDayView={habitDayView}
        habitWeekView={habitWeekView}
        habitMonthView={habitMonthView}
        habitSeasonView={habitSeasonView}
        habitViewMode={habitViewMode}
        highlightHabitPriorities={highlightHabitPriorities}
        morningHabitPriorities={morningHabitPriorities}
        ritualMultiplier={ritualMultiplier}
        showStreakMarks={showStreakMarks}
        viewToggles={viewToggles}
        sortTools={sortTools}
        gradeLabel={gradeLabel}
        gradeValueText={gradeDaysReady === 0 ? "—" : `${shownGrade.toFixed(0)}%`}
        gradeThrough={gradeThrough}
        gradeBarValue={gradeDaysReady > 0 ? shownGrade : null}
        gradeHue={gradeTubeColor}
        outputValueText={!outputReady ? "—" : `${shownOutput.toFixed(0)}%`}
        outputBarValue={outputReady ? shownOutput : null}
        outputHue={outputGradeTubeColor}
        openGrade={() => setShowGradeBreakdown(true)}
        openOutput={() => setShowOutputGradeBreakdown(true)}
        openGoodDays={() => setShowGoodDays(true)}
        openSettings={() => setShowSettings(true)}
        openNewHabit={(frequency) => {
          setEditingTask(null)
          setDefaultFrequency(frequency)
          setShowTaskForm(true)
        }}
        goodStreak={goodDays.streak}
        goodLast30={goodDays.last30Count}
        periodWells={periodWells}
        willpowerStones={willpowerStones}
        habitWeekWindow={habitWeekWindow}
        setHabitWeekWindow={setHabitWeekWindow}
        habitMonthWindow={habitMonthWindow}
        setHabitMonthWindow={setHabitMonthWindow}
        habitBirthday={habitBirthday}
        setHabitBirthday={setHabitBirthday}
        percentLoadingBar={percentLoadingBar}
        setPercentLoadingBar={setPercentLoadingBar}
        habitSmallLeds={habitSmallLeds}
        setHabitSmallLeds={setHabitSmallLeds}
        dayPlanKey={dayPlanKey}
      />
    )
}
