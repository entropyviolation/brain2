/**
 * tracker/use-habits-desk-store.ts — One Zustand selector per Habits field.
 *
 * The morning-review fallback is the shared empty id list. A fresh `[]`
 * each render would change that subscription.
 */
"use client"

import { useHabitsStore } from "@/lib/habits-store"
import { useReviewsStore, localDayKey } from "@/lib/reviews-store"
import { useExemptionContext } from "@/lib/sleep-store"
import { EMPTY_HABIT_PRIORITY_IDS } from "@/components/Home/Habits/tracker/sheet-idle"

export function useHabitsDeskStore(currentDate: Date) {
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
  const setHabitSortMode = useHabitsStore((s) => s.setHabitSortMode)
  const highlightHabitPriorities = useHabitsStore((s) => s.highlightHabitPriorities)
  const groupHabitsByKind = useHabitsStore((s) => s.groupHabitsByKind)
  const setGroupHabitsByKind = useHabitsStore((s) => s.setGroupHabitsByKind)
  const setHighlightHabitPriorities = useHabitsStore((s) => s.setHighlightHabitPriorities)
  const showStreakMarks = useHabitsStore((s) => s.showStreakMarks)
  const setShowStreakMarks = useHabitsStore((s) => s.setShowStreakMarks)
  const ritualMultiplier = useHabitsStore((s) => s.morningRitualPointMultiplier)
  const reorderHabits = useHabitsStore((s) => s.reorderHabits)
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

  return {
    tasks,
    morningHabitPriorities,
    weeklyData,
    weeklyHabitData,
    monthlyHabitData,
    quarterlyHabitData,
    addTaskToStore,
    updateTaskInStore,
    deleteTaskFromStore,
    updateCompletion,
    updateWeeklyHabitCompletion,
    updateMonthlyHabitCompletion,
    updateQuarterlyHabitCompletion,
    importData,
    resetData,
    gradeTolerance,
    setGradeTolerance,
    outputGradeTolerance,
    setOutputGradeTolerance,
    accomplishmentThreshold,
    setAccomplishmentThreshold,
    accomplishmentBonus,
    setAccomplishmentBonus,
    gradeUsePriority,
    setGradeUsePriority,
    outputUsePriority,
    setOutputUsePriority,
    goodDaysUsePriority,
    setGoodDaysUsePriority,
    habitViewMode,
    setHabitViewMode,
    habitDayView,
    setHabitDayView,
    percentLoadingBar,
    setPercentLoadingBar,
    habitSmallLeds,
    setHabitSmallLeds,
    hideCompletedToday,
    setHideCompletedToday,
    exemptionWand,
    setExemptionWand,
    missedOpWand,
    setMissedOpWand,
    hideCompletedAndMissed,
    setHideCompletedAndMissed,
    habitExemptions,
    setHabitExemption,
    gradeTubeColor,
    outputGradeTubeColor,
    habitSortMode,
    habitSortDirection,
    setHabitSortDirection,
    exemptionCtx,
    setHabitSortMode,
    highlightHabitPriorities,
    groupHabitsByKind,
    setGroupHabitsByKind,
    setHighlightHabitPriorities,
    showStreakMarks,
    setShowStreakMarks,
    ritualMultiplier,
    reorderHabits,
    habitMonthWindow,
    setHabitMonthWindow,
    habitBirthday,
    setHabitBirthday,
    habitWeekWindow,
    setHabitWeekWindow,
    habitWeekView,
    setHabitWeekView,
    habitMonthView,
    setHabitMonthView,
    habitSeasonView,
    setHabitSeasonView,
  }
}
