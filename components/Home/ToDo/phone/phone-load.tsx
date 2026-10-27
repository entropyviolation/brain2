/**
 * components/Home/ToDo/phone/phone-load.tsx — Load figures, the header phosphor line, and the load sheet element.
 */
import type { Task, TodoItem } from "@/lib/types"
import { effectiveDurationMinutes } from "@/lib/todo-steps"
import {
  comfortBand,
  comfortRatio,
  daysLeftLabel,
  formatComfortRatio,
  formatMinutesAsHours,
  formatWorkingHours,
  hoursLeftInPeriod,
  summedEstimate,
  todoPeriodKey,
  workingHoursLeft,
  type ComfortBand,
  type EstimateScope,
} from "@/lib/todo-commitment"
import { isPastTodoPeriod, type TodoPeriod } from "../todo-utils"
import { TodoLoadPanel, comfortDialT, comfortWord } from "../TodoLoadPanel"
import type { useTodoTime } from "../use-todo-time"
import type { TodoTab } from "./phone-constants"

type PeriodTab = Exclude<TodoTab, "other">

/** Open rows and the load figures for one lens. The header glass and the sheet read the same numbers. */
export function periodLoadFor(input: {
  period: TodoPeriod
  focusedDate: Date
  undoneByPeriod: Record<TodoPeriod, TodoItem[]>
  filteredByPeriod: Record<TodoPeriod, TodoItem[]>
  tasks: Task[]
  morningPriorities: readonly string[]
  estimateScope: EstimateScope
}) {
  const { period, focusedDate, undoneByPeriod, filteredByPeriod, tasks, morningPriorities, estimateScope } = input
  const past = isPastTodoPeriod(period, focusedDate)
  const undoneIds = new Set(undoneByPeriod[period].map((todo) => todo.taskId ?? todo.id))
  const openTodos = past
    ? filteredByPeriod[period].filter((todo) => !undoneIds.has(todo.taskId ?? todo.id))
    : filteredByPeriod[period]
  const periodKey = todoPeriodKey(period, focusedDate)
  const ritualIds = period === "day" ? morningPriorities : undefined
  const estimate = summedEstimate(openTodos, tasks, period, periodKey, estimateScope, ritualIds)
  const hours = workingHoursLeft(period, focusedDate)
  const clockHours = hoursLeftInPeriod(period, focusedDate)
  const ratio = comfortRatio(estimate.minutes, hours)
  const band = comfortBand(ratio)
  return { past, undoneIds, openTodos, periodKey, ritualIds, estimate, hours, clockHours, ratio, band }
}

export type PhoneSeasonLoad = {
  seasonKey: string
  seasonEstimate: { minutes: number; included: number; unestimated: number }
  seasonHours: number
  seasonClockHours: number
  seasonRatio: number
  seasonBand: ComfortBand
}

/** One phosphor line in the header glass: working hours left · estimate · comfort word. */
export function headerLoadFor(input: {
  activeTodoTab: TodoTab
  periodTab: PeriodTab
  season: PhoneSeasonLoad | null
  periodLoad: (period: TodoPeriod) => { estimate: { minutes: number }; hours: number; ratio: number; band: ComfortBand }
  inProgressCount: number
  wipLimit: number
}) {
  const { activeTodoTab, periodTab, season, periodLoad, inProgressCount, wipLimit } = input
  const headerLoad = (() => {
    if (activeTodoTab === "other") return null
    const figures =
      periodTab === "quarter"
        ? season
          ? { minutes: season.seasonEstimate.minutes, hours: season.seasonHours, ratio: season.seasonRatio, band: season.seasonBand }
          : null
        : (() => {
            const load = periodLoad(periodTab)
            return { minutes: load.estimate.minutes, hours: load.hours, ratio: load.ratio, band: load.band }
          })()
    if (!figures) return null
    const t = comfortDialT(figures.ratio)
    return {
      text: `${formatWorkingHours(figures.hours)} left · ${formatMinutesAsHours(figures.minutes)} est · ${comfortWord(figures.band)}`,
      angle: ((-90 + t * 180) * Math.PI) / 180,
      overCap: inProgressCount > wipLimit,
    }
  })()
  return headerLoad
}

/** The node `TodoMobile` receives as `loadPanel`. The element type stays `TodoLoadPanel`. */
export function buildPhoneLoadPanel(input: {
  phoneLens: "period" | "season" | "other"
  season: (PhoneSeasonLoad & {
    seasonEstimate: { minutes: number; unestimated: number; included: number }
  }) | null
  load: ReturnType<typeof periodLoadFor> | null
  phonePeriod: TodoPeriod
  focusedDate: Date
  tasks: Task[]
  todoTime: Pick<ReturnType<typeof useTodoTime>, "spentOf">
  estimateScope: EstimateScope
  setEstimateScope: (scope: EstimateScope) => void
  inProgressCount: number
  wipLimit: number
  setSelectedRowId: (id: string) => void
  setOpenRowId: (id: string) => void
}) {
  const {
    phoneLens,
    season,
    load,
    phonePeriod,
    focusedDate,
    tasks,
    todoTime,
    estimateScope,
    setEstimateScope,
    inProgressCount,
    wipLimit,
    setSelectedRowId,
    setOpenRowId,
  } = input
  const loadPanel =
    phoneLens === "season" && season ? (
      <TodoLoadPanel
        daysLeft={daysLeftLabel("quarter", focusedDate)}
        estimate={formatMinutesAsHours(season.seasonEstimate.minutes)}
        estimateMinutes={season.seasonEstimate.minutes}
        unestimated={season.seasonEstimate.unestimated}
        included={season.seasonEstimate.included}
        scope={estimateScope}
        onScopeChange={setEstimateScope}
        hoursLeft={formatWorkingHours(season.seasonClockHours)}
        workingHours={formatWorkingHours(season.seasonHours)}
        workingHoursValue={season.seasonHours}
        comfortRatioText={formatComfortRatio(season.seasonRatio)}
        comfortRatioValue={season.seasonRatio}
        band={season.seasonBand}
        inProgress={inProgressCount}
        wipLimit={wipLimit}
      />
    ) : load ? (
      <TodoLoadPanel
        isDay={phonePeriod === "day"}
        spentMinutes={load.openTodos.reduce((sum, todo) => sum + todoTime.spentOf(todo.taskId ?? todo.id), 0)}
        requiredMinutes={summedEstimate(load.openTodos, tasks, phonePeriod, load.periodKey, "required", load.ritualIds).minutes}
        allMinutes={summedEstimate(load.openTodos, tasks, phonePeriod, load.periodKey, "all", load.ritualIds).minutes}
        showDaysLeft={phonePeriod !== "day"}
        daysLeft={daysLeftLabel(phonePeriod, focusedDate)}
        estimate={formatMinutesAsHours(load.estimate.minutes)}
        estimateMinutes={load.estimate.minutes}
        unestimated={load.estimate.unestimated}
        included={load.estimate.included}
        scope={estimateScope}
        onScopeChange={setEstimateScope}
        hoursLeft={formatWorkingHours(load.clockHours)}
        workingHours={formatWorkingHours(load.hours)}
        workingHoursValue={load.hours}
        comfortRatioText={formatComfortRatio(load.ratio)}
        comfortRatioValue={load.ratio}
        band={load.band}
        inProgress={inProgressCount}
        wipLimit={wipLimit}
        onUnestimatedClick={() => {
          const target = load.openTodos.find((todo) => {
            const task = tasks.find((row) => row.id === (todo.taskId ?? todo.id))
            return !!task && !(effectiveDurationMinutes(task.estimatedDuration, task.subtasks) > 0)
          })
          if (target) {
            setSelectedRowId(target.id)
            setOpenRowId(target.id)
          }
        }}
      />
    ) : null
  return loadPanel
}
