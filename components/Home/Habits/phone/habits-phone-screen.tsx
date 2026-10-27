/**
 * components/Home/Habits/habits-phone-screen.tsx
 *
 * Phone page body. `HabitsPhonePage` renders this. The desktop console
 * does not. Grids, the panel, and the dialogs are the same data doors
 * the desktop sheet uses. They sit in this page's sheet, not in its layout.
 */
"use client"

import type { ReactNode } from "react"
import { format } from "date-fns"
import { HabitsPhone, type HabitsPhonePeriod } from "@/components/Home/Habits/habits-phone"
import { HabitWandBanner } from "@/components/Home/Habits/habit-wand-banner"
import { TaskGrid } from "@/components/Home/Habits/task-grid"
import {
  PeriodHabitList,
  type PeriodColumn,
} from "@/components/Home/Habits/period-habit-list"
import { HabitHeatmap } from "@/components/Home/Habits/habit-heatmap"
import { PlanTextLog, planPeriodStampProps } from "@/components/Home/Plan/plan-text-log"
import type { PlanTextPeriod } from "@/lib/plan-text"
import { HabitsControlPanel } from "@/components/Home/Habits/habits-control-panel"
import { HabitsTabControls } from "@/components/Home/Habits/habits-tab-controls"
import type { HabitControlToggle } from "@/components/Home/Habits/habit-priority-bar"
import { HabitMonthWindowControl } from "@/components/Home/Habits/habit-month-window-control"
import { HabitWeekWindowControl } from "@/components/Home/Habits/habit-week-window-control"
import {
  calculateDayPercentageAV,
  calculatePeriodColumnPercentage,
} from "@/lib/calculations"
import {
  addCalendarDays,
  formatDateRange,
  formatLocalDateKey,
  parseLocalDate,
} from "@/lib/date-utils"
import { quarterLabel, quarterKey, shiftQuarter } from "@/lib/seasons"
import type { HabitFrequency, TaskCompletion, WeeklyData, WeeklyTask } from "@/lib/types"
import type { ExemptionKind } from "@/lib/habit-exemption"
import type { WillpowerStone } from "@/lib/willpower-stones"
import type { HabitWeekWindowMode } from "@/lib/habit-week-window"
import type { HabitMonthWindowMode, HabitBirthday } from "@/lib/habit-month-window"

function PhonePlanLog({
  period,
  periodKey,
  legend,
  placeholder,
  size = "period",
}: {
  period: PlanTextPeriod
  periodKey: string
  legend: string
  placeholder: string
  size?: "day" | "period"
}) {
  return (
    <fieldset className="hab-period-plan hab-plan-frame" {...planPeriodStampProps(period)}>
      <legend>{legend}</legend>
      <PlanTextLog period={period} periodKey={periodKey} placeholder={placeholder} size={size} />
    </fieldset>
  )
}

function phoneDay(date: Date, homeKey: string): HabitsPhonePeriod {
  const key = formatLocalDateKey(date)
  return {
    key,
    date,
    label: format(date, "EEE"),
    sublabel: format(date, "d"),
    title: format(date, "EEEE, MMM d"),
    isCurrent: key === homeKey,
  }
}

function phoneColumn(column: PeriodColumn, title: string): HabitsPhonePeriod {
  return {
    key: column.key,
    date: column.date,
    label: column.label,
    sublabel: column.sublabel,
    title,
    isCurrent: column.isCurrent,
  }
}

export type HabitsPhoneScreenProps = {
  dialogs: ReactNode
  habitTab: HabitFrequency
  setHabitTab: (frequency: HabitFrequency) => void
  hydrated: boolean
  currentDate: Date
  currentWeekStart: Date
  weekEndDate: Date
  currentMonth: Date
  currentQuarter: Date
  setWeekLens: (date: Date | null) => void
  setMonthLens: (date: Date | null) => void
  setQuarterLens: (date: Date | null) => void
  viewingCurrentPeriod: boolean
  weekWindowRange: string
  monthWindowAsOf: Date
  weekDates: Date[]
  weekPeriods: PeriodColumn[]
  monthPeriods: PeriodColumn[]
  seasonPeriods: PeriodColumn[]
  weekSheetPeriods: PeriodColumn[]
  monthSheetPeriods: PeriodColumn[]
  seasonSheetPeriods: PeriodColumn[]
  weekPlanColumn?: PeriodColumn
  monthPlanColumn?: PeriodColumn
  seasonPlanColumn?: PeriodColumn
  dailyRows: WeeklyTask[]
  weeklyRows: WeeklyTask[]
  monthlyRows: WeeklyTask[]
  quarterlyRows: WeeklyTask[]
  dailyShown: WeeklyTask[]
  weeklyShown: WeeklyTask[]
  monthlyShown: WeeklyTask[]
  quarterlyShown: WeeklyTask[]
  dailyTasks: WeeklyTask[]
  weeklyTasks: WeeklyTask[]
  monthlyTasks: WeeklyTask[]
  quarterlyTasks: WeeklyTask[]
  weeklyData: WeeklyData
  weeklyHabitData: WeeklyData
  monthlyHabitData: WeeklyData
  quarterlyHabitData: WeeklyData
  dailyWeekPercent: Map<string, number>
  weeklyPeriodPercent: Map<string, number>
  monthlyPeriodPercent: Map<string, number>
  quarterlyPeriodPercent: Map<string, number>
  dailyExempt: (task: WeeklyTask, key: string) => boolean
  weeklyExempt: (task: WeeklyTask, key: string) => boolean
  monthlyExempt: (task: WeeklyTask, key: string) => boolean
  quarterlyExempt: (task: WeeklyTask, key: string) => boolean
  dailyKind: (task: WeeklyTask, key: string) => ExemptionKind
  weeklyKind: (task: WeeklyTask, key: string) => ExemptionKind
  monthlyKind: (task: WeeklyTask, key: string) => ExemptionKind
  quarterlyKind: (task: WeeklyTask, key: string) => ExemptionKind
  updateCompletion: (taskId: string, date: Date, completion: TaskCompletion) => void
  updateWeeklyHabitCompletion: (taskId: string, date: Date, completion: TaskCompletion) => void
  updateMonthlyHabitCompletion: (taskId: string, date: Date, completion: TaskCompletion) => void
  updateQuarterlyHabitCompletion: (taskId: string, date: Date, completion: TaskCompletion) => void
  setHabitExemption: (frequency: HabitFrequency, periodKey: string, taskId: string, exempt: boolean) => void
  handleEditTask: (task: WeeklyTask) => void
  hideCompletedToday: boolean
  exemptionWand: boolean
  setExemptionWand: (on: boolean) => void
  missedOpWand: boolean
  setMissedOpWand: (on: boolean) => void
  hideCompletedAndMissed: boolean
  groupHabitsByKind: boolean
  editingFrequency?: HabitFrequency
  reorderVisible: (frequency: HabitFrequency, ids: string[]) => void
  habitDayView: boolean
  habitWeekView: boolean
  habitMonthView: boolean
  habitSeasonView: boolean
  habitViewMode: "grid" | "heatmap"
  highlightHabitPriorities: boolean
  morningHabitPriorities: readonly string[]
  ritualMultiplier: number
  showStreakMarks: boolean
  viewToggles: (frequency: HabitFrequency) => HabitControlToggle[]
  sortTools: (frequency: HabitFrequency, rows: WeeklyTask[], sortId: string) => ReactNode
  gradeLabel: string
  gradeValueText: string
  gradeThrough: string | null
  gradeBarValue: number | null
  gradeHue: string
  outputValueText: string
  outputBarValue: number | null
  outputHue: string
  openGrade: () => void
  openOutput: () => void
  openGoodDays: () => void
  openSettings: () => void
  openNewHabit: (frequency: HabitFrequency) => void
  goodStreak: number
  goodLast30: number
  periodWells?: {
    streak: number
    last30Count: number
    streakLabel: string
    countLabel: string
    countOf: number
    title: string
    onClick: () => void
  }
  willpowerStones: WillpowerStone[]
  habitWeekWindow: HabitWeekWindowMode
  setHabitWeekWindow: (mode: HabitWeekWindowMode) => void
  habitMonthWindow: HabitMonthWindowMode
  setHabitMonthWindow: (mode: HabitMonthWindowMode) => void
  habitBirthday: HabitBirthday
  setHabitBirthday: (birthday: HabitBirthday) => void
  percentLoadingBar: boolean
  setPercentLoadingBar: (on: boolean) => void
  habitSmallLeds: boolean
  setHabitSmallLeds: (on: boolean) => void
  dayPlanKey: string
}

export function HabitsPhoneScreen(props: HabitsPhoneScreenProps) {
  const tab = props.habitTab
  const homeKey = formatLocalDateKey(props.currentDate)
  const dailySpan = props.weekDates.map((date) => phoneDay(date, homeKey))
  const weeklySpan = props.weekPeriods.map((column) =>
    phoneColumn(column, formatDateRange(column.date, addCalendarDays(column.date, 6))),
  )
  const monthlySpan = props.monthPeriods.map((column) => phoneColumn(column, format(column.date, "MMMM yyyy")))
  const seasonSpan = props.seasonPeriods.map((column) => phoneColumn(column, quarterLabel(column.key)))
  const periods =
    tab === "daily"
      ? props.habitDayView
        ? [phoneDay(props.currentDate, homeKey)]
        : dailySpan
      : tab === "weekly"
        ? props.weekSheetPeriods.map((column) =>
            phoneColumn(column, formatDateRange(column.date, addCalendarDays(column.date, 6))),
          )
        : tab === "monthly"
          ? props.monthSheetPeriods.map((column) => phoneColumn(column, format(column.date, "MMMM yyyy")))
          : props.seasonSheetPeriods.map((column) => phoneColumn(column, quarterLabel(column.key)))
  const spanPeriods = tab === "daily" ? dailySpan : tab === "weekly" ? weeklySpan : tab === "monthly" ? monthlySpan : seasonSpan
  const preferredKey = tab === "daily" ? homeKey : (spanPeriods.find((period) => period.isCurrent)?.key ?? periods[0]?.key ?? homeKey)
  const hidePeriod =
    tab === "daily"
      ? phoneDay(props.currentDate, homeKey)
      : (spanPeriods.find((period) => period.isCurrent) ??
        spanPeriods[spanPeriods.length - 1] ??
        phoneDay(props.currentDate, homeKey))

  const rows = tab === "weekly" ? props.weeklyRows : tab === "monthly" ? props.monthlyRows : tab === "quarterly" ? props.quarterlyRows : props.dailyRows
  const shown = tab === "weekly" ? props.weeklyShown : tab === "monthly" ? props.monthlyShown : tab === "quarterly" ? props.quarterlyShown : props.dailyShown
  const data = tab === "weekly" ? props.weeklyHabitData : tab === "monthly" ? props.monthlyHabitData : tab === "quarterly" ? props.quarterlyHabitData : props.weeklyData
  const kind = tab === "weekly" ? props.weeklyKind : tab === "monthly" ? props.monthlyKind : tab === "quarterly" ? props.quarterlyKind : props.dailyKind
  const tasksForMath = tab === "weekly" ? props.weeklyTasks : tab === "monthly" ? props.monthlyTasks : tab === "quarterly" ? props.quarterlyTasks : props.dailyTasks
  const exempt = tab === "weekly" ? props.weeklyExempt : tab === "monthly" ? props.monthlyExempt : tab === "quarterly" ? props.quarterlyExempt : props.dailyExempt
  const percentMap = tab === "weekly" ? props.weeklyPeriodPercent : tab === "monthly" ? props.monthlyPeriodPercent : tab === "quarterly" ? props.quarterlyPeriodPercent : props.dailyWeekPercent
  const columnsForMath = tab === "weekly" ? props.weekPeriods : tab === "monthly" ? props.monthPeriods : tab === "quarterly" ? props.seasonPeriods : []

  const priority = {
    highlightPriorities: props.highlightHabitPriorities,
    ritualIds: props.morningHabitPriorities,
    ritualMultiplier: props.ritualMultiplier,
    showStreakMarks: props.showStreakMarks,
  }
  const onReorder = props.editingFrequency === tab ? (ids: string[]) => props.reorderVisible(tab, ids) : undefined

  const taskPercent = (taskId: string): number | null => {
    const task = tasksForMath.find((row) => row.id === taskId)
    if (!task) return 0
    if (tab === "daily") {
      if (props.weekDates.length > 0 && props.weekDates.every((date) => exempt(task, formatLocalDateKey(date)))) return null
      return percentMap.get(taskId) ?? 0
    }
    if (columnsForMath.length > 0 && columnsForMath.every((period) => exempt(task, period.key))) return null
    return percentMap.get(taskId) ?? 0
  }

  const periodPercent = (period: HabitsPhonePeriod): number | null => {
    if (tab === "daily") {
      if (props.dailyTasks.length > 0 && props.dailyTasks.every((task) => props.dailyExempt(task, period.key))) return null
      const index = props.weekDates.findIndex((date) => formatLocalDateKey(date) === period.key)
      return calculateDayPercentageAV(period.key, props.dailyTasks, props.weeklyData, index >= 0 ? index : 0, props.dailyExempt)
    }
    const column = columnsForMath.find((item) => item.key === period.key)
    if (!column) return 0
    if (tasksForMath.length > 0 && tasksForMath.every((task) => exempt(task, period.key))) return null
    const periodData = tab === "weekly" ? props.weeklyHabitData : tab === "monthly" ? props.monthlyHabitData : props.quarterlyHabitData
    return calculatePeriodColumnPercentage(column, tasksForMath, periodData, exempt)
  }

  const update = (taskId: string, date: Date, completion: TaskCompletion) => {
    if (tab === "weekly") props.updateWeeklyHabitCompletion(taskId, date, completion)
    else if (tab === "monthly") props.updateMonthlyHabitCompletion(taskId, date, completion)
    else if (tab === "quarterly") props.updateQuarterlyHabitCompletion(taskId, date, completion)
    else props.updateCompletion(taskId, date, completion)
  }

  const loading = (
    <div className="habit-grid-wrap" aria-busy="true">
      <p className="text-sm text-muted-foreground p-4">Loading habits…</p>
    </div>
  )

  const columns = !props.hydrated ? (
    loading
  ) : tab === "daily" ? (
    <TaskGrid
      groupByKind={props.groupHabitsByKind}
      tasks={props.dailyRows}
      weeklyData={props.weeklyData}
      weekDates={props.weekDates}
      onUpdateTaskCompletion={props.updateCompletion}
      onEditTask={props.handleEditTask}
      calculateTaskPercentage={taskPercent}
      calculateDayPercentage={(date, index) => {
        const key = formatLocalDateKey(date)
        if (props.dailyTasks.length > 0 && props.dailyTasks.every((task) => props.dailyExempt(task, key))) return null
        return calculateDayPercentageAV(key, props.dailyTasks, props.weeklyData, index, props.dailyExempt)
      }}
      hideCompleted={props.hideCompletedToday}
      exemptionWand={props.exemptionWand}
      missedOpWand={props.missedOpWand}
      hideCompletedAndMissed={props.hideCompletedAndMissed}
      exemptionKindFor={props.dailyKind}
      onSetExempt={(taskId, date, exempted) => props.setHabitExemption("daily", formatLocalDateKey(date), taskId, exempted)}
      viewMode="day"
      dayView={props.habitDayView}
      selectedDate={props.currentDate}
      {...priority}
      onReorder={onReorder}
    />
  ) : (
    <PeriodHabitList
      tasks={rows}
      periods={tab === "weekly" ? props.weekSheetPeriods : tab === "monthly" ? props.monthSheetPeriods : props.seasonSheetPeriods}
      data={data}
      onUpdate={update}
      onEdit={props.handleEditTask}
      hideCompleted={props.hideCompletedToday}
      exemptionWand={props.exemptionWand}
      missedOpWand={props.missedOpWand}
      hideCompletedAndMissed={props.hideCompletedAndMissed}
      exemptionKindFor={kind}
      onSetExempt={(taskId, periodKey, _periodDate, exempted) => props.setHabitExemption(tab, periodKey, taskId, exempted)}
      calculateTaskPercentage={taskPercent}
      calculatePeriodPercentage={(periodKey) => {
        const column = columnsForMath.find((item) => item.key === periodKey)
        if (!column) return 0
        if (tasksForMath.length > 0 && tasksForMath.every((task) => exempt(task, periodKey))) return null
        return calculatePeriodColumnPercentage(column, tasksForMath, data, exempt)
      }}
      completionLabel={tab === "weekly" ? "Weekly completion" : tab === "monthly" ? "Monthly completion" : "Season completion"}
      emptyLabel={
        tab === "weekly"
          ? "No weekly habits yet. Add one to get started."
          : tab === "monthly"
            ? "No monthly habits yet. Add one to get started."
            : "No season habits yet. Add one to get started."
      }
      asOf={props.currentDate}
      frequency={tab}
      detailColumn={tab === "weekly" ? props.habitWeekView : tab === "monthly" ? props.habitMonthView : props.habitSeasonView}
      {...priority}
      onReorder={onReorder}
    />
  )

  const heatmap =
    tab === "daily" && props.habitViewMode === "heatmap" && props.hydrated ? (
      <HabitHeatmap
        tasks={props.dailyRows}
        data={props.weeklyData}
        asOf={props.currentDate}
        frequency="daily"
        onEditTask={props.handleEditTask}
        hideCompleted={props.hideCompletedToday}
        periodPercentFor={(taskId) => props.dailyWeekPercent.get(taskId) ?? 0}
        focusKey={formatLocalDateKey(props.currentDate)}
        exemptionWand={props.exemptionWand}
        exemptionKindFor={props.dailyKind}
        onToggleExempt={(taskId, periodKey, exempted) => props.setHabitExemption("daily", periodKey, taskId, exempted)}
        missedOpWand={props.missedOpWand}
        hideCompletedAndMissed={props.hideCompletedAndMissed}
        onToggleMissed={(taskId, periodKey, missed, missReason) => {
          const date = parseLocalDate(periodKey)
          if (!date) return
          const text = missed ? (missReason?.trim() ?? "") : ""
          props.updateCompletion(taskId, date, { missedOpportunity: missed, missReason: text })
        }}
        {...priority}
      />
    ) : null

  const plan =
    props.hydrated && tab === "daily" && props.habitDayView ? (
      <PhonePlanLog
        period="day"
        periodKey={props.dayPlanKey}
        legend={`Day Plan — ${format(props.currentDate, "MMMM dd, yyyy")}`}
        placeholder="Write your day plan, goals, and objectives..."
        size="day"
      />
    ) : props.hydrated && tab === "weekly" && props.weekPlanColumn ? (
      <PhonePlanLog
        period="week"
        periodKey={props.weekPlanColumn.key}
        legend={`Week Plan — ${format(props.weekPlanColumn.date, "MMM d")} to ${format(addCalendarDays(props.weekPlanColumn.date, 6), "MMM d")}`}
        placeholder="Write your week plan, priorities, and focus areas..."
      />
    ) : props.hydrated && tab === "monthly" && props.monthPlanColumn ? (
      <PhonePlanLog
        period="month"
        periodKey={props.monthPlanColumn.key}
        legend={`Month Plan — ${format(props.monthPlanColumn.date, "MMMM yyyy")}`}
        placeholder="Write your month plan, goals, and objectives..."
      />
    ) : props.hydrated && tab === "quarterly" && props.seasonPlanColumn ? (
      <PhonePlanLog
        period="quarter"
        periodKey={props.seasonPlanColumn.key}
        legend={`Season plan — ${quarterLabel(props.seasonPlanColumn.key)}`}
        placeholder="Write this season's plan — what the quarter is for..."
      />
    ) : null

  const sortId = tab === "weekly" ? "habit-sort-weekly" : tab === "monthly" ? "habit-sort-monthly" : tab === "quarterly" ? "habit-sort-season" : "habit-sort"
  const good =
    tab === "daily"
      ? {
          label: "Good days",
          value: String(props.goodStreak),
          sub: `Last 30 · ${props.goodLast30}/30`,
          onClick: props.openGoodDays,
        }
      : props.periodWells
        ? {
            label: tab === "weekly" ? "Good weeks" : tab === "monthly" ? "Good months" : "Good seasons",
            value: String(props.periodWells.streak),
            sub: `${props.periodWells.countLabel} ${props.periodWells.last30Count}/${props.periodWells.countOf}`,
            onClick: props.periodWells.onClick,
          }
        : null

  const windowLabel =
    tab === "quarterly"
      ? quarterLabel(quarterKey(props.currentQuarter))
      : tab === "weekly"
        ? props.weekWindowRange
        : tab === "monthly"
          ? props.monthPeriods.length === 0
            ? format(props.monthWindowAsOf, "MMMM yyyy")
            : props.monthPeriods.length === 1
              ? format(props.monthPeriods[0].date, "MMMM yyyy")
              : `${format(props.monthPeriods[0].date, "MMM yyyy")} – ${format(props.monthPeriods[props.monthPeriods.length - 1].date, "MMM yyyy")}`
          : formatDateRange(props.currentWeekStart, props.weekEndDate)

  return (
    <HabitsPhone
      hydrated={props.hydrated}
      frequency={tab}
      counts={{
        daily: props.dailyTasks.length,
        weekly: props.weeklyTasks.length,
        monthly: props.monthlyTasks.length,
        quarterly: props.quarterlyTasks.length,
      }}
      onFrequency={props.setHabitTab}
      windowLabel={windowLabel}
      currentLabel={tab === "quarterly" ? "This season" : tab === "weekly" ? "This week" : tab === "monthly" ? "This month" : "Today"}
      isCurrentPeriod={props.viewingCurrentPeriod}
      previousAria={tab === "quarterly" ? "Previous season" : tab === "monthly" ? "Previous Month" : "Previous Week"}
      nextAria={tab === "quarterly" ? "Next season" : tab === "monthly" ? "Next Month" : "Next Week"}
      onPrevious={() => {
        if (tab === "quarterly") props.setQuarterLens(shiftQuarter(props.currentQuarter, -1))
        else if (tab === "monthly") props.setMonthLens(new Date(props.currentMonth.getFullYear(), props.currentMonth.getMonth() - 1, 1))
        else props.setWeekLens(addCalendarDays(props.currentWeekStart, -7))
      }}
      onNext={() => {
        if (tab === "quarterly") props.setQuarterLens(shiftQuarter(props.currentQuarter, 1))
        else if (tab === "monthly") props.setMonthLens(new Date(props.currentMonth.getFullYear(), props.currentMonth.getMonth() + 1, 1))
        else props.setWeekLens(addCalendarDays(props.currentWeekStart, 7))
      }}
      onCurrent={() => {
        if (tab === "quarterly") props.setQuarterLens(null)
        else if (tab === "monthly") props.setMonthLens(null)
        else props.setWeekLens(null)
      }}
      periods={periods}
      spanPeriods={spanPeriods}
      preferredKey={preferredKey}
      hidePeriod={hidePeriod}
      tasks={rows}
      data={data}
      weekDates={props.weekDates}
      asOf={props.currentDate}
      variant={tab === "daily" ? "daily" : "period"}
      spanUnit={tab === "daily" ? "day" : tab === "weekly" ? "week" : tab === "monthly" ? "month" : "season"}
      exemptionNoun={tab === "daily" ? "day" : tab === "weekly" ? "week" : tab === "monthly" ? "month" : "season"}
      exemptionKindFor={kind}
      onUpdate={update}
      onSetExempt={(taskId, periodKey, _date, exempted) => props.setHabitExemption(tab, periodKey, taskId, exempted)}
      onEdit={props.handleEditTask}
      taskPercent={taskPercent}
      periodPercent={periodPercent}
      hideCompleted={props.hideCompletedToday}
      exemptionWand={props.exemptionWand}
      missedOpWand={props.missedOpWand}
      hideCompletedAndMissed={props.hideCompletedAndMissed}
      groupByKind={props.groupHabitsByKind}
      onReorder={onReorder}
      detail={tab === "daily" ? props.habitDayView : tab === "weekly" ? props.habitWeekView : tab === "monthly" ? props.habitMonthView : props.habitSeasonView}
      highlightPriorities={props.highlightHabitPriorities}
      ritualIds={[...props.morningHabitPriorities]}
      ritualMultiplier={props.ritualMultiplier}
      showStreakMarks={props.showStreakMarks}
      grade={{ label: props.gradeLabel, value: props.gradeValueText, onClick: props.openGrade }}
      output={{ label: "Perfect output", value: props.outputValueText, onClick: props.openOutput }}
      good={good}
      through={props.gradeThrough}
      wand={
        <HabitWandBanner view={props.exemptionWand ? "exemption" : props.missedOpWand ? "missed" : null} />
      }
      columns={columns}
      heatmap={heatmap}
      plan={plan}
      tools={
        <HabitsControlPanel stones={props.willpowerStones}>
          <HabitsTabControls
            viewToggles={props.viewToggles(tab)}
            sortTools={props.sortTools(tab, shown, sortId)}
            gradeLabel={props.gradeLabel}
            gradeValueText={props.gradeValueText}
            gradeThrough={props.gradeThrough}
            gradeBarValue={props.gradeBarValue}
            gradeHue={props.gradeHue}
            onGradeClick={props.openGrade}
            outputValueText={props.outputValueText}
            outputBarValue={props.outputBarValue}
            outputHue={props.outputHue}
            onOutputClick={props.openOutput}
            goodDays={
              tab === "daily"
                ? { streak: props.goodStreak, last30Count: props.goodLast30, onClick: props.openGoodDays }
                : props.periodWells
            }
            weekWindow={
              tab === "weekly" ? (
                <HabitWeekWindowControl mode={props.habitWeekWindow} onMode={props.setHabitWeekWindow} />
              ) : undefined
            }
            monthWindow={
              tab === "monthly" ? (
                <HabitMonthWindowControl
                  mode={props.habitMonthWindow}
                  birthday={props.habitBirthday}
                  onMode={props.setHabitMonthWindow}
                  onBirthday={props.setHabitBirthday}
                />
              ) : undefined
            }
            exemptionWand={props.exemptionWand}
            onExemptionWand={props.setExemptionWand}
            missedOpWand={props.missedOpWand}
            onMissedOpWand={props.setMissedOpWand}
            toggles={["loadingBar", "smallLeds"]}
            loadingBarId="loading-bar-phone"
            loadingBar={props.percentLoadingBar}
            onLoadingBar={props.setPercentLoadingBar}
            smallLedsId="small-leds-phone"
            smallLeds={props.habitSmallLeds}
            onSmallLeds={props.setHabitSmallLeds}
            onNewHabit={() => props.openNewHabit(tab)}
          />
        </HabitsControlPanel>
      }
      dialogs={props.dialogs}
      onSettings={props.openSettings}
      onNewHabit={() => props.openNewHabit(tab)}
      emptyLabel={
        tab === "weekly"
          ? "No weekly habits yet. Add one to get started."
          : tab === "monthly"
            ? "No monthly habits yet. Add one to get started."
            : tab === "quarterly"
              ? "No season habits yet. Add one to get started."
              : "No habits yet. Add one to get started."
      }
      clearedLabel={tab === "daily" ? "Nothing left for this day." : "Nothing left for this period."}
    />
  )
}
