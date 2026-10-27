/**
 * components/Home/ToDo/desk/todo-period-table-props.ts — Props for one TodoTable
 *
 * The object `renderTab` used to build inline. Not a component, and not memoized.
 * Season rows do not use this. They keep their own lid.
 */
import { needsNotice, withNoticeAnswer } from "@/lib/notice-dot"
import { openTaskBlockers } from "@/lib/prereqs"
import { inheritedDue, unlockBreakdown } from "@/lib/unlock-value"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { isRitualTodoId } from "@/lib/ritual-todo"
import { patchTodoCommitment } from "@/lib/todo-commitment"
import type { StepTier, Task, TodoItem } from "@/lib/types"
import type { TodoPeriod } from "../todo-utils"
import type { TodoDesk } from "./use-todo-desk"

export function periodTableProps(input: {
  desk: TodoDesk
  period: TodoPeriod
  periodKey: string
  taskFor: (todoId: string) => Task | undefined
  requiredOf: (todoId: string) => boolean
  prioritizedOf: (todoId: string) => boolean
  bgeTierOf: (todoId: string) => StepTier
}) {
  const { desk, period, periodKey, taskFor, requiredOf, prioritizedOf, bgeTierOf } = input
  const bgeTiers = desk.bgeTiers
  return {
    period,
    bgeTierOf: bgeTiers ? bgeTierOf : undefined,
    onBgeTierChange: bgeTiers
      ? (todoId: string, tier: StepTier) => {
          const task = taskFor(todoId)
          if (task) desk.updateTask(patchTodoCommitment(task, period, periodKey, { tier }))
        }
      : undefined,
    onComplete: desk.handleComplete,
    onMissed: desk.handleMissed,
    onPush: desk.handlePush,
    onDelete: desk.handleDelete,
    onEstimateChange: desk.handleEstimate,
    onStepsChange: desk.handleSteps,
    stepsOf: (todoId: string) => taskFor(todoId)?.subtasks,
    estimateOf: (todoId: string) => taskFor(todoId)?.estimatedDuration,
    defaultEstimateMin: desk.defaultEstimateMin,
    spentOf: (todoId: string) => desk.todoTime.spentOf(taskFor(todoId)?.id ?? todoId),
    timeOf: (todoId: string) => desk.todoTime.timeOf(taskFor(todoId)?.id ?? todoId),
    onTaskClick: desk.openTask,
    onTierChange: desk.handleTierChange,
    onJustStart: (taskId: string) => {
      if (desk.openRitual(taskId)) return
      desk.setJustStartTaskId(taskId)
    },
    isWalkRow: isRitualTodoId,
    getStatus: desk.getStatus,
    onStatusChange: desk.handleStatusChange,
    isRequired: requiredOf,
    isPrioritized: prioritizedOf,
    onToggleRequired: (todoId: string) => desk.handleCommitment(todoId, period, "required"),
    onTogglePrioritized: (todoId: string) => desk.handleCommitment(todoId, period, "prioritized"),
    onRename: desk.handleRename,
    openRowId: desk.openRowId,
    onOpenRowIdChange: desk.setOpenRowId,
    selectedRowId: desk.selectedRowId,
    onSelectedRowIdChange: desk.setSelectedRowId,
    flockingId: desk.flockingId,
    clockTaskId: desk.clockTaskId,
    clockStepId: desk.clockStepId,
    onClockStart: desk.taskClock.start,
    onClockStop: () => desk.clockStop.request(),
    unlockOf: (taskId: string) => {
      const breakdown = unlockBreakdown({ id: taskId }, desk.tasks)
      if (!breakdown.count) return null
      const due = inheritedDue(taskId, desk.tasks, desk.focusedDate)
      return {
        count: breakdown.count,
        title: breakdown.label,
        due: due
          ? `due ${due.due.toLocaleDateString(undefined, { weekday: "short" })} for ${itemTitleOrUntitled(due.forTask)}`
          : undefined,
        overdue: due?.overdue,
      }
    },
    blockersOf: (taskId: string) => {
      const task = taskFor(taskId)
      return task ? openTaskBlockers(task, desk.tasks).map((t) => itemTitleOrUntitled(t)) : []
    },
    onNeeds: desk.setPrereqTaskId,
    noticeOf: (todoId: string) => {
      const task = taskFor(todoId)
      return task ? needsNotice(task) : false
    },
    onNotice: (todoId: string, text: string) => {
      const task = taskFor(todoId)
      if (task) desk.updateTask(withNoticeAnswer(task, text))
    },
  }
}
