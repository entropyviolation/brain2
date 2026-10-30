/**
 * tracker/habits-desktop-page.tsx — Desktop Habits console.
 *
 * Composes the fascia, period keys, four panes, and the dialogs. Grade
 * memos stay here so a closed tab can still skip that tab's grade math,
 * and so daily willpower stones still fill the other sheets.
 * `WeeklyTaskTracker` in `habit-tracker.tsx` is the public door. This file
 * is not imported from outside `components/Home/Habits/`.
 *
 * Header: CRT Habits title, milled period nav, raised Settings key. Daily /
 * Weekly / Monthly / Season keys sit in a milled bay above the sheet (active = CRT +
 * power lamp; persist). The control bar holds one wrapping rocker cluster:
 * Highlight priorities, streaks, then that sheet's view rockers, Hide Done,
 * and Mask done and missed (stored `hideCompletedAndMissed`; the hatch is
 * unchanged). SORT: and Edit default order sit beside the cluster. Every
 * binary toggle there is one horizontal rocker. Loading Bar and Small LEDs
 * stay on the rail. Missed op wand sits under Exemption wand. Mask done and
 * missed hatches those cells and does not remove rows. The control bar
 * sits above each sheet, with the wand banner flush under the whole bar.
 * New habit and grades stay on the Habits Tab Control Panel.
 * Heatmap and Day View are Daily-only. Day View opens that day's plan log
 * as its own frame below the habit desk, not inside the sheet.
 * Week View, Month View, and Season View are the same kind of rocker, pinned
 * on that sheet's control bar only. Each collapses that sheet to the current
 * period and opens that period's plan log in the same kind of frame — the
 * same `PlanTextLog` as the Plan tab.
 * Turning one off restores the multi-column window. Those rockers do not
 * change `habitWeekWindow` or `habitMonthWindow`. Weekly columns and the span
 * grade share `habitWeekWindowStarts` (default: seven Monday-weeks). Monthly
 * columns and the span grade share `habitMonthWindowStarts` (default: January
 * through this month).
 * Grade meters are glass noble-gas tubes (`noble-gas-tube.tsx`).
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { Tabs } from "@/components/ui/tabs"
import { usePersistHydrated } from "@/lib/use-persist-hydrated"
import { useHabitsStore } from "@/lib/habits-store"
import { useHabitTrackingSync } from "@/lib/habit-tracking-sync"
import { effectiveSortDescending } from "@/lib/habit-sort"
import type { HabitFrequency, WeeklyTask } from "@/lib/types"
import { useHabitsDeskStore } from "@/components/Home/Habits/tracker/use-habits-desk-store"
import { useHabitPeriodLens } from "@/components/Home/Habits/tracker/use-habit-period-lens"
import { useHabitFormSession } from "@/components/Home/Habits/tracker/use-habit-form-session"
import { computeDailyBundle } from "@/components/Home/Habits/tracker/daily-model"
import { computeWeeklyBundle } from "@/components/Home/Habits/tracker/weekly-model"
import { computeMonthlyBundle } from "@/components/Home/Habits/tracker/monthly-model"
import { computeSeasonBundle } from "@/components/Home/Habits/tracker/season-model"
import { resolveActiveGrade } from "@/components/Home/Habits/tracker/active-grade"
import { computeGoodDays, computeGoodPeriod, computeTodayPrioRaw } from "@/components/Home/Habits/tracker/good-period-model"
import { editingFrequency as editingFrequencyOf, orderWithDraft, reorderVisibleDraft, type HabitOrderDraft } from "@/components/Home/Habits/tracker/order-draft"
import { singlePeriodColumns } from "@/components/Home/Habits/tracker/single-period"
import { HabitDeskHeader } from "@/components/Home/Habits/tracker/habit-desk-header"
import { HabitPeriodKeys } from "@/components/Home/Habits/tracker/habit-period-keys"
import { HabitDeskDialogs } from "@/components/Home/Habits/tracker/habit-desk-dialogs"
import { DailyPane } from "@/components/Home/Habits/tracker/daily-pane"
import { WeeklyPane } from "@/components/Home/Habits/tracker/weekly-pane"
import { MonthlyPane } from "@/components/Home/Habits/tracker/monthly-pane"
import { SeasonPane } from "@/components/Home/Habits/tracker/season-pane"
import { HabitsScratchPad } from "@/components/Home/Habits/tracker/habits-scratch-pad"
import type { HabitMeterProps } from "@/components/Home/Habits/tracker/habit-desk-frame"

export function HabitsDesktopPage({ currentDate = new Date() }: { currentDate?: Date }) {
  useHabitTrackingSync()
  const hydrated = usePersistHydrated(useHabitsStore.persist)
  const store = useHabitsDeskStore(currentDate)
  const lens = useHabitPeriodLens(currentDate)
  const form = useHabitFormSession({
    addTaskToStore: store.addTaskToStore,
    updateTaskInStore: store.updateTaskInStore,
  })

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
  const [orderDraft, setOrderDraft] = useState<HabitOrderDraft | null>(null)
  useEffect(() => {
    if (store.habitSortMode !== "default") setOrderDraft(null)
  }, [store.habitSortMode])

  const { habitTab } = form
  const { weekDates, currentWeekStart, currentMonth, currentQuarter } = lens
  const sortDescending = effectiveSortDescending(store.habitSortMode, store.habitSortDirection)

  // Each frequency reads only its own completion map. Sort, grade, and output
  // run for the open tab. A daily cell replaces `weeklyData` and does not
  // rerun weekly / monthly / season work.
  const daily = useMemo(
    () =>
      computeDailyBundle({
        habitTab,
        tasks: store.tasks,
        weeklyData: store.weeklyData,
        habitExemptions: store.habitExemptions,
        exemptionCtx: store.exemptionCtx,
        weekDates,
        currentDate,
        gradeTolerance: store.gradeTolerance,
        outputGradeTolerance: store.outputGradeTolerance,
        habitSortMode: store.habitSortMode,
        sortDescending,
      }),
    [
      habitTab,
      store.tasks,
      store.weeklyData,
      store.habitExemptions,
      store.exemptionCtx,
      weekDates,
      currentDate,
      store.gradeTolerance,
      store.outputGradeTolerance,
      store.habitSortMode,
      sortDescending,
    ],
  )

  const weekly = useMemo(
    () =>
      computeWeeklyBundle({
        habitTab,
        tasks: store.tasks,
        weeklyHabitData: store.weeklyHabitData,
        habitExemptions: store.habitExemptions,
        exemptionCtx: store.exemptionCtx,
        weekWindowAsOf,
        habitWeekWindow: store.habitWeekWindow,
        currentDate,
        gradeTolerance: store.gradeTolerance,
        outputGradeTolerance: store.outputGradeTolerance,
        habitSortMode: store.habitSortMode,
        sortDescending,
      }),
    [
      habitTab,
      store.tasks,
      store.weeklyHabitData,
      store.habitExemptions,
      store.exemptionCtx,
      weekWindowAsOf,
      store.habitWeekWindow,
      currentDate,
      store.gradeTolerance,
      store.outputGradeTolerance,
      store.habitSortMode,
      sortDescending,
    ],
  )

  const monthly = useMemo(
    () =>
      computeMonthlyBundle({
        habitTab,
        tasks: store.tasks,
        monthlyHabitData: store.monthlyHabitData,
        habitExemptions: store.habitExemptions,
        exemptionCtx: store.exemptionCtx,
        monthWindowAsOf,
        habitMonthWindow: store.habitMonthWindow,
        habitBirthday: store.habitBirthday,
        currentDate,
        gradeTolerance: store.gradeTolerance,
        outputGradeTolerance: store.outputGradeTolerance,
        habitSortMode: store.habitSortMode,
        sortDescending,
      }),
    [
      habitTab,
      store.tasks,
      store.monthlyHabitData,
      store.habitExemptions,
      store.exemptionCtx,
      monthWindowAsOf,
      store.habitMonthWindow,
      store.habitBirthday,
      currentDate,
      store.gradeTolerance,
      store.outputGradeTolerance,
      store.habitSortMode,
      sortDescending,
    ],
  )

  const quarterly = useMemo(
    () =>
      computeSeasonBundle({
        habitTab,
        tasks: store.tasks,
        quarterlyHabitData: store.quarterlyHabitData,
        habitExemptions: store.habitExemptions,
        exemptionCtx: store.exemptionCtx,
        currentQuarter,
        currentDate,
        gradeTolerance: store.gradeTolerance,
        outputGradeTolerance: store.outputGradeTolerance,
        habitSortMode: store.habitSortMode,
        sortDescending,
      }),
    [
      habitTab,
      store.tasks,
      store.quarterlyHabitData,
      store.habitExemptions,
      store.exemptionCtx,
      currentQuarter,
      currentDate,
      store.gradeTolerance,
      store.outputGradeTolerance,
      store.habitSortMode,
      sortDescending,
    ],
  )

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

  const dailyRows = orderWithDraft(dailyShown, "daily", orderDraft)
  const weeklyRows = orderWithDraft(weeklyShown, "weekly", orderDraft)
  const monthlyRows = orderWithDraft(monthlyShown, "monthly", orderDraft)
  const quarterlyRows = orderWithDraft(quarterlyShown, "quarterly", orderDraft)
  const editingFrequency = editingFrequencyOf(store.habitSortMode, orderDraft)
  const beginOrder = (rows: WeeklyTask[], frequency: HabitFrequency) => {
    setOrderDraft({ frequency, ids: rows.map((row) => row.id) })
  }
  const saveOrder = () => {
    if (!orderDraft) return
    store.reorderHabits(orderDraft.frequency, orderDraft.ids)
    setOrderDraft(null)
  }
  const reorderVisible = (frequency: HabitFrequency, visibleIds: string[]) => {
    setOrderDraft((prev) => reorderVisibleDraft(prev, frequency, visibleIds))
  }

  const priorityProps = {
    highlightPriorities: store.highlightHabitPriorities,
    ritualIds: store.morningHabitPriorities,
    ritualMultiplier: store.ritualMultiplier,
    showStreakMarks: store.showStreakMarks,
  }
  const grade = resolveActiveGrade({
    habitTab,
    hydrated,
    weekPrioGrade,
    monthlyPrioGrade,
    weeklyPrioGrade,
    quarterlyPrioGrade,
    outputPrioGrade,
    weeklyPrioOutput,
    monthlyPrioOutput,
    quarterlyPrioOutput,
    weekGrade,
    weeklyGrade,
    monthlyGrade,
    quarterlyGrade,
    outputGrade,
    weeklyOutput,
    monthlyOutput,
    quarterlyOutput,
    gradeUsePriority: store.gradeUsePriority,
    outputUsePriority: store.outputUsePriority,
    weekDates,
  })
  const goodDays = useMemo(
    () =>
      computeGoodDays({
        habitTab,
        dailyTasks,
        weeklyData: store.weeklyData,
        goodDayAsOf,
        accomplishmentThreshold: store.accomplishmentThreshold,
        accomplishmentBonus: store.accomplishmentBonus,
        goodDaysUsePriority: store.goodDaysUsePriority,
        dailyExempt,
      }),
    [
      habitTab,
      dailyTasks,
      store.weeklyData,
      goodDayAsOf,
      store.accomplishmentThreshold,
      store.accomplishmentBonus,
      store.goodDaysUsePriority,
      dailyExempt,
    ],
  )
  const todayPrioRaw = useMemo(
    () =>
      computeTodayPrioRaw({
        habitTab,
        dailyTasks,
        weeklyData: store.weeklyData,
        goodDayAsOf,
        dailyExempt,
      }),
    [habitTab, dailyTasks, store.weeklyData, goodDayAsOf, dailyExempt],
  )
  const goodPeriod = useMemo(
    () =>
      computeGoodPeriod({
        habitTab,
        dailyTasks,
        weeklyData: store.weeklyData,
        goodDayAsOf,
        accomplishmentThreshold: store.accomplishmentThreshold,
        accomplishmentBonus: store.accomplishmentBonus,
        dailyExempt,
      }),
    [
      habitTab,
      dailyTasks,
      store.weeklyData,
      goodDayAsOf,
      store.accomplishmentThreshold,
      store.accomplishmentBonus,
      dailyExempt,
    ],
  )
  const periodWells = goodPeriod
    ? {
        streak: goodPeriod.streak,
        last30Count: goodPeriod.lookbackCount,
        streakLabel: goodPeriod.streakLabel,
        countLabel: goodPeriod.countLabel,
        countOf: goodPeriod.lookbackSize,
        title: `Click for ${goodPeriod.streakLabel}, recent ${goodPeriod.plural}, and accomplishment settings`,
        onClick: () => form.setShowGoodDays(true),
      }
    : undefined

  const weekSheetPeriods = store.habitWeekView ? singlePeriodColumns(weekPeriods) : weekPeriods
  const monthSheetPeriods = store.habitMonthView ? singlePeriodColumns(monthPeriods) : monthPeriods
  const seasonSheetPeriods = store.habitSeasonView ? singlePeriodColumns(seasonPeriods) : seasonPeriods
  const weekPlanColumn = store.habitWeekView ? weekSheetPeriods[0] : undefined
  const monthPlanColumn = store.habitMonthView ? monthSheetPeriods[0] : undefined
  const seasonPlanColumn = store.habitSeasonView ? seasonSheetPeriods[0] : undefined

  const meter: HabitMeterProps = {
    gradeLabel: grade.gradeLabel,
    gradeValueText: grade.gradeDaysReady === 0 ? "—" : `${grade.shownGrade.toFixed(0)}%`,
    gradeThrough: grade.gradeThrough,
    gradeBarValue: grade.gradeDaysReady > 0 ? grade.shownGrade : null,
    gradeHue: store.gradeTubeColor,
    onGradeClick: () => form.setShowGradeBreakdown(true),
    outputValueText: !grade.outputReady ? "—" : `${grade.shownOutput.toFixed(0)}%`,
    outputBarValue: grade.outputReady ? grade.shownOutput : null,
    outputHue: store.outputGradeTubeColor,
    onOutputClick: () => form.setShowOutputGradeBreakdown(true),
    exemptionWand: store.exemptionWand,
    onExemptionWand: store.setExemptionWand,
    missedOpWand: store.missedOpWand,
    onMissedOpWand: store.setMissedOpWand,
    loadingBar: store.percentLoadingBar,
    onLoadingBar: store.setPercentLoadingBar,
    smallLeds: store.habitSmallLeds,
    onSmallLeds: store.setHabitSmallLeds,
  }
  const viewFlags = {
    highlightHabitPriorities: store.highlightHabitPriorities,
    setHighlightHabitPriorities: store.setHighlightHabitPriorities,
    showStreakMarks: store.showStreakMarks,
    setShowStreakMarks: store.setShowStreakMarks,
    groupHabitsByKind: store.groupHabitsByKind,
    setGroupHabitsByKind: store.setGroupHabitsByKind,
    habitViewMode: store.habitViewMode,
    setHabitViewMode: store.setHabitViewMode,
    habitDayView: store.habitDayView,
    setHabitDayView: store.setHabitDayView,
    habitWeekView: store.habitWeekView,
    setHabitWeekView: store.setHabitWeekView,
    habitMonthView: store.habitMonthView,
    setHabitMonthView: store.setHabitMonthView,
    habitSeasonView: store.habitSeasonView,
    setHabitSeasonView: store.setHabitSeasonView,
    hideCompletedToday: store.hideCompletedToday,
    setHideCompletedToday: store.setHideCompletedToday,
    hideCompletedAndMissed: store.hideCompletedAndMissed,
    setHideCompletedAndMissed: store.setHideCompletedAndMissed,
  }
  const sortBag = {
    sortMode: store.habitSortMode,
    sortDirection: store.habitSortDirection,
    onSortMode: store.setHabitSortMode,
    onSortDirection: store.setHabitSortDirection,
    editingFrequency,
    beginOrder,
    saveOrder,
    cancelOrder: () => setOrderDraft(null),
  }

  return (
    <div className="hab-frame" data-ui-name="Habits" data-ui-docs="components/Home/Habits/README.md">
      <Tabs className="hab-frame-tabs" value={habitTab} onValueChange={(v) => form.setHabitTab(v as typeof habitTab)}>
        <HabitDeskHeader
          habitTab={habitTab}
          currentDate={currentDate}
          currentQuarter={currentQuarter}
          setQuarterLens={lens.setQuarterLens}
          currentWeekStart={currentWeekStart}
          setWeekLens={lens.setWeekLens}
          currentMonth={currentMonth}
          setMonthLens={lens.setMonthLens}
          weekPeriods={weekPeriods}
          weekWindowAsOf={weekWindowAsOf}
          monthPeriods={monthPeriods}
          monthWindowAsOf={monthWindowAsOf}
          onOpenSettings={() => form.setShowSettings(true)}
        />
        <HabitPeriodKeys
          hydrated={hydrated}
          dailyCount={dailyTasks.length}
          weeklyCount={weeklyTasks.length}
          monthlyCount={monthlyTasks.length}
          quarterlyCount={quarterlyTasks.length}
          currentQuarter={currentQuarter}
        />
        <DailyPane
          hydrated={hydrated}
          habitViewMode={store.habitViewMode}
          dailyRows={dailyRows}
          dailyShown={dailyShown}
          weeklyData={store.weeklyData}
          currentDate={currentDate}
          onEditTask={form.handleEditTask}
          hideCompletedToday={store.hideCompletedToday}
          hideCompletedAndMissed={store.hideCompletedAndMissed}
          dailyWeekPercent={dailyWeekPercent}
          dailyKind={dailyKind}
          setHabitExemption={store.setHabitExemption}
          updateCompletion={store.updateCompletion}
          groupHabitsByKind={store.groupHabitsByKind}
          dailyTasks={dailyTasks}
          dailyExempt={dailyExempt}
          weekDates={weekDates}
          habitDayView={store.habitDayView}
          priorityProps={priorityProps}
          editingFrequency={editingFrequency}
          reorderVisible={reorderVisible}
          willpowerStones={willpowerStones}
          meter={meter}
          viewFlags={viewFlags}
          sortBag={sortBag}
          goodDays={goodDays}
          setShowGoodDays={form.setShowGoodDays}
          setEditingTask={form.setEditingTask}
          setDefaultFrequency={form.setDefaultFrequency}
          setShowTaskForm={form.setShowTaskForm}
          habitTab={habitTab}
        />
        <WeeklyPane
          hydrated={hydrated}
          habitTab={habitTab}
          weeklyRows={weeklyRows}
          weeklyShown={weeklyShown}
          weekSheetPeriods={weekSheetPeriods}
          weekPeriods={weekPeriods}
          weeklyHabitData={store.weeklyHabitData}
          updateWeeklyHabitCompletion={store.updateWeeklyHabitCompletion}
          onEditTask={form.handleEditTask}
          hideCompletedToday={store.hideCompletedToday}
          hideCompletedAndMissed={store.hideCompletedAndMissed}
          weeklyKind={weeklyKind}
          setHabitExemption={store.setHabitExemption}
          weeklyTasks={weeklyTasks}
          weeklyExempt={weeklyExempt}
          weeklyPeriodPercent={weeklyPeriodPercent}
          currentDate={currentDate}
          habitWeekView={store.habitWeekView}
          weekPlanColumn={weekPlanColumn}
          priorityProps={priorityProps}
          editingFrequency={editingFrequency}
          reorderVisible={reorderVisible}
          willpowerStones={willpowerStones}
          meter={meter}
          viewFlags={viewFlags}
          sortBag={sortBag}
          periodWells={periodWells}
          habitWeekWindow={store.habitWeekWindow}
          setHabitWeekWindow={store.setHabitWeekWindow}
          setEditingTask={form.setEditingTask}
          setDefaultFrequency={form.setDefaultFrequency}
          setShowTaskForm={form.setShowTaskForm}
        />
        <MonthlyPane
          hydrated={hydrated}
          habitTab={habitTab}
          monthlyRows={monthlyRows}
          monthlyShown={monthlyShown}
          monthSheetPeriods={monthSheetPeriods}
          monthPeriods={monthPeriods}
          monthlyHabitData={store.monthlyHabitData}
          updateMonthlyHabitCompletion={store.updateMonthlyHabitCompletion}
          onEditTask={form.handleEditTask}
          hideCompletedToday={store.hideCompletedToday}
          hideCompletedAndMissed={store.hideCompletedAndMissed}
          monthlyKind={monthlyKind}
          setHabitExemption={store.setHabitExemption}
          monthlyTasks={monthlyTasks}
          monthlyExempt={monthlyExempt}
          monthlyPeriodPercent={monthlyPeriodPercent}
          currentDate={currentDate}
          habitMonthView={store.habitMonthView}
          monthPlanColumn={monthPlanColumn}
          priorityProps={priorityProps}
          editingFrequency={editingFrequency}
          reorderVisible={reorderVisible}
          willpowerStones={willpowerStones}
          meter={meter}
          viewFlags={viewFlags}
          sortBag={sortBag}
          periodWells={periodWells}
          habitMonthWindow={store.habitMonthWindow}
          habitBirthday={store.habitBirthday}
          setHabitMonthWindow={store.setHabitMonthWindow}
          setHabitBirthday={store.setHabitBirthday}
          setEditingTask={form.setEditingTask}
          setDefaultFrequency={form.setDefaultFrequency}
          setShowTaskForm={form.setShowTaskForm}
        />
        <SeasonPane
          hydrated={hydrated}
          habitTab={habitTab}
          quarterlyRows={quarterlyRows}
          quarterlyShown={quarterlyShown}
          seasonSheetPeriods={seasonSheetPeriods}
          seasonPeriods={seasonPeriods}
          quarterlyHabitData={store.quarterlyHabitData}
          updateQuarterlyHabitCompletion={store.updateQuarterlyHabitCompletion}
          onEditTask={form.handleEditTask}
          hideCompletedToday={store.hideCompletedToday}
          hideCompletedAndMissed={store.hideCompletedAndMissed}
          quarterlyKind={quarterlyKind}
          setHabitExemption={store.setHabitExemption}
          quarterlyTasks={quarterlyTasks}
          quarterlyExempt={quarterlyExempt}
          quarterlyPeriodPercent={quarterlyPeriodPercent}
          currentDate={currentDate}
          currentQuarter={currentQuarter}
          habitSeasonView={store.habitSeasonView}
          seasonPlanColumn={seasonPlanColumn}
          priorityProps={priorityProps}
          editingFrequency={editingFrequency}
          reorderVisible={reorderVisible}
          willpowerStones={willpowerStones}
          meter={meter}
          viewFlags={viewFlags}
          sortBag={sortBag}
          periodWells={periodWells}
          setEditingTask={form.setEditingTask}
          setDefaultFrequency={form.setDefaultFrequency}
          setShowTaskForm={form.setShowTaskForm}
        />
      </Tabs>
      {hydrated ? <HabitsScratchPad /> : null}
      <HabitDeskDialogs
        showTaskForm={form.showTaskForm}
        setShowTaskForm={form.setShowTaskForm}
        handleAddTask={form.handleAddTask}
        deleteTaskFromStore={store.deleteTaskFromStore}
        setEditingTask={form.setEditingTask}
        editingTask={form.editingTask}
        defaultFrequency={form.defaultFrequency}
        showGradeBreakdown={form.showGradeBreakdown}
        setShowGradeBreakdown={form.setShowGradeBreakdown}
        activeGrade={grade.activeGrade}
        setGradeTolerance={store.setGradeTolerance}
        accomplishmentThreshold={store.accomplishmentThreshold}
        accomplishmentBonus={store.accomplishmentBonus}
        gradePeriodUnit={grade.gradePeriodUnit}
        gradeUsePriority={store.gradeUsePriority}
        setGradeUsePriority={store.setGradeUsePriority}
        activePrioGrade={grade.activePrioGrade}
        habitTab={habitTab}
        weekAverage={weekAverage}
        showOutputGradeBreakdown={form.showOutputGradeBreakdown}
        setShowOutputGradeBreakdown={form.setShowOutputGradeBreakdown}
        activeOutput={grade.activeOutput}
        setOutputGradeTolerance={store.setOutputGradeTolerance}
        outputUsePriority={store.outputUsePriority}
        setOutputUsePriority={store.setOutputUsePriority}
        activePrioOutput={grade.activePrioOutput}
        showGoodDays={form.showGoodDays}
        setShowGoodDays={form.setShowGoodDays}
        goodDays={goodDays}
        goodPeriod={goodPeriod}
        setAccomplishmentThreshold={store.setAccomplishmentThreshold}
        setAccomplishmentBonus={store.setAccomplishmentBonus}
        goodDaysUsePriority={store.goodDaysUsePriority}
        setGoodDaysUsePriority={store.setGoodDaysUsePriority}
        dailyTasks={dailyTasks}
        weeklyData={store.weeklyData}
        goodDayAsOf={goodDayAsOf}
        dailyExempt={dailyExempt}
        todayPrioRaw={todayPrioRaw}
        showSettings={form.showSettings}
        setShowSettings={form.setShowSettings}
        tasks={store.tasks}
        importData={store.importData}
        resetData={store.resetData}
      />
    </div>
  )
}
