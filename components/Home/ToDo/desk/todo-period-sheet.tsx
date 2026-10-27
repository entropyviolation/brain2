/**
 * components/Home/ToDo/desk/todo-period-sheet.tsx — Day, week, or month sheet
 *
 * Load, morning priorities, B/G/E, Required, Assigned, and the aftermath wells.
 * `is-folding` stays on this `.todo-sheet` only. The scroll ref stays on it too.
 */
import type { RefObject } from "react"
import { WaitingLine } from "@/components/steps/WaitingLine"
import { bgeScore, type BgeEntry } from "@/lib/bge-score"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import {
  daysLeftLabel,
  formatComfortRatio,
  formatMinutesAsHours,
  formatWorkingHours,
  splitByCommitment,
  splitByTier,
  summedEstimate,
  taskIsPrioritized,
  taskIsRequired,
  todoMarkTier,
} from "@/lib/todo-commitment"
import { effectiveDurationMinutes, taskMatchesAssignedQuery } from "@/lib/todo-steps"
import type { StepTier } from "@/lib/types"
import { countInProgress, getTodoDoneTitle, getTodoMissedTitle, getTodoOpenTitle, pinPrioritizedFirst, undonePushTitle, type TodoPeriod } from "../todo-utils"
import { DoneTodoSection } from "../DoneTodoSection"
import { MissedTodoSection } from "../MissedTodoSection"
import { UndoneTodoSection } from "../UndoneTodoSection"
import { TodoLoadPanel } from "../TodoLoadPanel"
import { TodoTable } from "../TodoTable"
import { BGE_SECTIONS } from "./todo-desk-constants"
import { periodLoad } from "./todo-period-figures"
import { periodTableProps } from "./todo-period-table-props"
import { TodoAssignedComposer } from "./todo-assigned-composer"
import { TodoAssignedSearch } from "./todo-assigned-search"
import { TodoBgeScore } from "./todo-bge-score"
import { TodoMorningPriorities } from "./todo-morning-priorities"
import type { TodoDesk } from "./use-todo-desk"

export function TodoPeriodSheet({
  period,
  desk,
  ref,
}: {
  period: TodoPeriod
  desk: TodoDesk
  ref: RefObject<HTMLDivElement | null>
}) {
  const { past, openTodos, periodKey, ritualIds, estimate, hours, clockHours, ratio, band } = periodLoad({
    period,
    focusedDate: desk.focusedDate,
    undoneTodos: desk.undoneByPeriod[period],
    filteredTodos: desk.filteredByPeriod[period],
    tasks: desk.tasks,
    morningPriorities: desk.morningPriorities,
    estimateScope: desk.estimateScope,
  })
  const taskFor = (todoId: string) => desk.tasks.find((task) => task.id === todoId)
  const requiredOf = (todoId: string) => {
    const task = taskFor(todoId)
    return !!task && taskIsRequired(task, period, periodKey)
  }
  const prioritizedOf = (todoId: string) => {
    const task = taskFor(todoId)
    return !!task && taskIsPrioritized(task, period, periodKey, ritualIds)
  }
  const { required, assigned } = splitByCommitment(openTodos, (todo) => requiredOf(todo.taskId ?? todo.id))
  const assignedPinned = pinPrioritizedFirst(assigned, (todo) => prioritizedOf(todo.taskId ?? todo.id))
  const visibleAssigned = assignedPinned.filter((todo) => {
    const task = taskFor(todo.taskId ?? todo.id)
    return taskMatchesAssignedQuery(itemTitleOrUntitled(task ?? todo), task?.subtasks, desk.assignedQuery)
  })
  const bgeTierOf = (todoId: string): StepTier => {
    const task = taskFor(todoId)
    return task ? todoMarkTier(task, period, periodKey) : "goal"
  }
  const bgeSections = desk.bgeTiers
    ? splitByTier(pinPrioritizedFirst([...required, ...assigned], (todo) => prioritizedOf(todo.taskId ?? todo.id)).filter((todo) => {
        const task = taskFor(todo.taskId ?? todo.id)
        return taskMatchesAssignedQuery(itemTitleOrUntitled(task ?? todo), task?.subtasks, desk.assignedQuery)
      }), (todo) => bgeTierOf(todo.taskId ?? todo.id))
    : null
  // Score reads every real task on this list: open, done and missed. Rites are derived rows, not tasks, so they stay out.
  const bgeEntries: BgeEntry[] = desk.bgeTiers
    ? [
        ...openTodos.map((todo) => ({ todo, done: false })),
        ...desk.doneByPeriod[period].map((todo) => ({ todo, done: true })),
        ...desk.missedByPeriod[period].map((todo) => ({ todo, done: false })),
      ].flatMap(({ todo, done }) => (taskFor(todo.taskId ?? todo.id) ? [{ tier: bgeTierOf(todo.taskId ?? todo.id), done }] : []))
    : []
  const bge = desk.bgeTiers ? bgeScore(bgeEntries) : null
  const tableProps = periodTableProps({
    desk,
    period,
    periodKey,
    taskFor,
    requiredOf,
    prioritizedOf,
    bgeTierOf,
  })
  const inProgress = countInProgress(desk.tasks)
  const openUnestimated = () => {
    const target = [...required, ...visibleAssigned].find((todo) => {
      const task = taskFor(todo.taskId ?? todo.id)
      if (!task) return false
      return !(effectiveDurationMinutes(task.estimatedDuration, task.subtasks) > 0)
    })
    if (!target) return
    desk.setSelectedRowId(target.id)
    desk.setOpenRowId(target.id)
  }
  const aftermathCount = [
    past ? desk.undoneByPeriod[period].length > 0 : false,
    desk.doneByPeriod[period].length > 0,
    desk.missedByPeriod[period].length > 0,
  ].filter(Boolean).length
  return (
    <div
      className={`todo-sheet${desk.periodFolding ? " is-folding" : ""}`}
      ref={ref}
      data-ui-name="Period sheet"
      data-ui-help="Load, Required, Assigned, and the Done, Missed, and Undone wells."
      data-ui-docs="components/Home/ToDo/README.md"
      data-ui-docs-anchor="instrument-layout"
    >
      <h3 className="todo-sheet-title">{getTodoOpenTitle(period, desk.focusedDate)}</h3>
      {desk.loadOpen && (
      <TodoLoadPanel
        isDay={period === "day"}
        spentMinutes={openTodos.reduce((sum, todo) => sum + desk.todoTime.spentOf(todo.taskId ?? todo.id), 0)}
        requiredMinutes={summedEstimate(openTodos, desk.tasks, period, periodKey, "required", ritualIds).minutes}
        allMinutes={summedEstimate(openTodos, desk.tasks, period, periodKey, "all", ritualIds).minutes}
        showDaysLeft={period !== "day"}
        daysLeft={daysLeftLabel(period, desk.focusedDate)}
        estimate={formatMinutesAsHours(estimate.minutes)}
        estimateMinutes={estimate.minutes}
        unestimated={estimate.unestimated}
        included={estimate.included}
        scope={desk.estimateScope}
        onScopeChange={desk.setEstimateScope}
        hoursLeft={formatWorkingHours(clockHours)}
        workingHours={formatWorkingHours(hours)}
        workingHoursValue={hours}
        comfortRatioText={formatComfortRatio(ratio)}
        comfortRatioValue={ratio}
        band={band}
        inProgress={inProgress}
        wipLimit={desk.wipLimit}
        onUnestimatedClick={openUnestimated}
      />
      )}
      {period === "day" && desk.morningTasks.length > 0 && (
        <TodoMorningPriorities morningTasks={desk.morningTasks} onOpen={(id) => desk.setSelectedTaskId(id)} />
      )}
      {bge && bgeEntries.length > 0 && (
        <TodoBgeScore period={period} bge={bge} bgeEntries={bgeEntries} />
      )}
      <div className="todo-ledger">
        {/* Hidden while empty (dead instruments are hidden); it appears when a row's Required gem lights. */}
        {required.length > 0 && !desk.bgeTiers && (
        <section
          className="todo-band is-required"
          role="region"
          aria-label="Required"
          data-ui-name="Required"
          data-ui-help="Marked required for this period."
          data-ui-docs="components/Home/ToDo/README.md"
          data-ui-docs-anchor="required-prioritized-assigned"
        >
          <h4 className="todo-list-title is-required">
            Required <span className="todo-list-count">{required.length}</span>
          </h4>
          <TodoTable
              {...tableProps}
              todos={required}
              isExpanded={!!desk.expandedPeriods[`required-${period}`]}
              onToggleExpand={() =>
                desk.setExpandedPeriods((prev) => ({ ...prev, [`required-${period}`]: !prev[`required-${period}`] }))
              }
            />
        </section>
        )}
        <section
          className="todo-band is-assigned"
          role="region"
          aria-label="Assigned"
          data-ui-name="Assigned"
          data-ui-help="Everything else scheduled here. Prioritized rows lead."
          data-ui-docs="components/Home/ToDo/README.md"
          data-ui-docs-anchor="required-prioritized-assigned"
        >
          <div className="todo-assigned-bar">
            <h4 className="todo-list-title">
              Assigned <span className="todo-list-count">{assigned.length}</span>
            </h4>
            <TodoAssignedSearch
              value={desk.assignedQuery}
              onChange={(event) => desk.setAssignedQuery(event.target.value)}
            />
          </div>
          {bgeSections ? (
            BGE_SECTIONS.map(({ tier, title }) => (
              <div key={tier} className={`todo-bge-band is-${tier}`} role="group" aria-label={title} data-ui-name={`${title} tier`}>
                <h5 className="todo-bge-title">
                  {title} <span className="todo-list-count">{bgeSections[tier].length}</span>
                </h5>
                <TodoTable
                  {...tableProps}
                  todos={bgeSections[tier]}
                  emptyLabel={desk.assignedQuery.trim() ? "Nothing matches." : `Nothing at ${title} yet.`}
                  isExpanded={!!desk.expandedPeriods[`${tier}-${period}`]}
                  onToggleExpand={() => desk.setExpandedPeriods((prev) => ({ ...prev, [`${tier}-${period}`]: !prev[`${tier}-${period}`] }))}
                />
              </div>
            ))
          ) : (
          <TodoTable
            {...tableProps}
            todos={visibleAssigned}
            emptyLabel={
              desk.assignedQuery.trim()
                ? "Nothing matches."
                : required.length > 0
                  ? "Nothing else assigned."
                  : undefined
            }
            isExpanded={!!desk.expandedPeriods[period]}
            onToggleExpand={() => desk.setExpandedPeriods((prev) => ({ ...prev, [period]: !prev[period] }))}
          />
          )}
          <WaitingLine
            hidden={desk.lockedHiddenByPeriod[period] + (period === "day" ? desk.sunHiddenCount : 0)}
            peeking={desk.peekHidden}
            onPeek={() => desk.setPeekHidden((on) => !on)}
          />
          <TodoAssignedComposer
            period={period}
            focusedDate={desk.focusedDate}
            tasks={desk.tasks}
            addTask={desk.addTask}
            required={required}
            visibleAssigned={visibleAssigned}
            composerName={desk.composerName}
            setComposerName={desk.setComposerName}
            composerTier={desk.composerTier}
            setComposerTier={desk.setComposerTier}
            setSelectedRowId={desk.setSelectedRowId}
            setOpenRowId={desk.setOpenRowId}
            onAddDone={desk.handleAddDone}
          />
        </section>
      </div>
      <div
        className={`todo-aftermath${aftermathCount > 1 ? " is-columns" : ""}`}
        style={aftermathCount > 1 ? { ["--todo-aftermath-cols" as string]: String(aftermathCount) } : undefined}
      >
      {past && desk.undoneByPeriod[period].length > 0 && (
        <UndoneTodoSection
          todos={desk.undoneByPeriod[period]}
          tasks={desk.tasks}
          period={period}
          pushTitle={undonePushTitle(period, desk.focusedDate)}
          open={desk.undoneSectionsOpen[period]}
          onOpenChange={(open) => desk.setUndoneSectionsOpen((prev) => ({ ...prev, [period]: open }))}
          onTaskClick={desk.openTask}
          onAssimilate={(taskId) => desk.resolveUndone(taskId, period, "assimilate")}
          onPush={(taskId) => desk.resolveUndone(taskId, period, "push")}
          onDiscard={(taskId) => desk.resolveUndone(taskId, period, "discard")}
        />
      )}
      {desk.doneByPeriod[period].length > 0 && (
      <DoneTodoSection
        title={getTodoDoneTitle(period, desk.focusedDate)}
        todos={desk.doneByPeriod[period]}
        tasks={desk.tasks}
        period={period}
        open={desk.doneSectionsOpen[period]}
        onOpenChange={(open) => desk.setDoneSectionsOpen((prev) => ({ ...prev, [period]: open }))}
        onTaskClick={desk.openTask}
        onAddDone={desk.handleAddDone}
        onConfirmTimes={desk.handleConfirmTimes}
        refDate={desk.focusedDate}
      />
      )}
      {desk.missedByPeriod[period].length > 0 && (
      <MissedTodoSection
        title={getTodoMissedTitle(period, desk.focusedDate)}
        todos={desk.missedByPeriod[period]}
        tasks={desk.tasks}
        period={period}
        open={desk.missedSectionsOpen[period]}
        onOpenChange={(open) => desk.setMissedSectionsOpen((prev) => ({ ...prev, [period]: open }))}
        onTaskClick={desk.openTask}
      />
      )}
      </div>
    </div>
  )
}
