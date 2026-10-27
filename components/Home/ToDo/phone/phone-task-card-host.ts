/**
 * components/Home/ToDo/phone/phone-task-card-host.ts — The object the phone page passes to `TaskCard`.
 */
import type { Task, TodoItem } from "@/lib/types"
import {
  taskIsPrioritized,
  taskIsRequired,
  todoPeriodKey,
  workingHoursLeft,
} from "@/lib/todo-commitment"
import type { TaskCardHost } from "../TaskCard"
import type { useTodoTime } from "../use-todo-time"
import type { TodoPeriod } from "../todo-utils"
import type { TodoTab } from "./phone-constants"

type PeriodTab = Exclude<TodoTab, "other">

/**
 * Phase 12: the task card borrows the panel's handlers for the lens it opened on.
 * Push counts read a ledger period (season reads month); Required and Prioritized
 * follow the lens itself, so the card and the season lid flip the same marks.
 */
export function buildPhoneTaskCardHost(input: {
  periodTab: PeriodTab
  focusedDate: Date
  tasks: Task[]
  morningPriorities: readonly string[]
  handleCommitment: (todoId: string, period: "day" | "week" | "month" | "quarter", flag: "required" | "prioritized") => void
  handleSteps: TaskCardHost["onStepsChange"]
  setJustStartTaskId: (id: string) => void
  setPrereqTaskId: (id: string) => void
  todoTime: Pick<ReturnType<typeof useTodoTime>, "timeOf">
  clockTaskId: string | null
  clockStepId: string | undefined
  onClockStart: TaskCardHost["onClockStart"]
  onClockStop: () => void
  defaultEstimateMin: number
}): TaskCardHost {
  const {
    periodTab,
    focusedDate,
    tasks,
    morningPriorities,
    handleCommitment,
    handleSteps,
    setJustStartTaskId,
    setPrereqTaskId,
    todoTime,
    clockTaskId,
    clockStepId,
    onClockStart,
    onClockStop,
    defaultEstimateMin,
  } = input
  const cardPeriod: TodoPeriod = periodTab === "quarter" ? "month" : periodTab
  const markPeriod = periodTab
  const markKey = todoPeriodKey(markPeriod, focusedDate)
  const taskCardHost: TaskCardHost = {
    period: cardPeriod,
    periodLabel: { day: "This day", week: "This week", month: "This month", quarter: "This season" }[markPeriod],
    focusedDate,
    isRequired: (id) => {
      const t = tasks.find((x) => x.id === id)
      return !!t && taskIsRequired(t, markPeriod, markKey)
    },
    isPrioritized: (id) => {
      const t = tasks.find((x) => x.id === id)
      return !!t && taskIsPrioritized(t, markPeriod, markKey, markPeriod === "day" ? morningPriorities : undefined)
    },
    onToggleRequired: (id) => handleCommitment(id, markPeriod, "required"),
    onTogglePrioritized: (id) => handleCommitment(id, markPeriod, "prioritized"),
    onStepsChange: handleSteps,
    onJustStart: (id) => setJustStartTaskId(id),
    onNeeds: setPrereqTaskId,
    timeOf: (id) => todoTime.timeOf(id),
    clockTaskId,
    clockStepId,
    onClockStart,
    onClockStop,
    defaultEstimateMin,
    hoursLeft: workingHoursLeft("day", new Date()),
  }
  return taskCardHost
}
