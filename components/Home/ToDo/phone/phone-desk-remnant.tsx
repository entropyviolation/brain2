/**
 * components/Home/ToDo/phone/phone-desk-remnant.tsx — The old desk sheet, left uncalled.
 *
 * `renderTab` and `renderSeasonRow` are the desktop period sheet. The phone page
 * builds these closures and does not call them. Mounting them would paint
 * `.todo-sheet` and `.todo-season-row` on the phone.
 */
import { type Dispatch, type SetStateAction, type RefObject } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { orbFor } from "@/components/Icons"
import { NativeSelect } from "@/components/ui/native-select"
import { bgeScore, type BgeEntry } from "@/lib/bge-score"
import { needsNotice, withNoticeAnswer } from "@/lib/notice-dot"
import { openTaskBlockers } from "@/lib/prereqs"
import { seasonOfDate } from "@/lib/seasons"
import { openStepItem } from "@/lib/step-item-stack"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { isRitualTodoId } from "@/lib/ritual-todo"
import { flattenSteps, taskMatchesAssignedQuery, effectiveDurationMinutes } from "@/lib/todo-steps"
import {
  daysLeftLabel,
  formatComfortRatio,
  formatMinutesAsHours,
  formatWorkingHours,
  patchTodoCommitment,
  splitByCommitment,
  splitByTier,
  summedEstimate,
  taskIsPrioritized,
  taskIsRequired,
  todoMarkTier,
  type ComfortBand,
} from "@/lib/todo-commitment"
import { inheritedDue, unlockBreakdown } from "@/lib/unlock-value"
import { WaitingLine } from "@/components/steps/WaitingLine"
import type { CompletionStatus, StepTier, Task, TodoItem } from "@/lib/types"
import { useTaskClockStarter } from "@/components/Focus/TaskClockStarter"
import { useUnfinishedStop } from "@/components/Home/Tracking/save-unfinished-dialog"
import { AddDoneDialog } from "../AddDoneDialog"
import { DoneTodoSection } from "../DoneTodoSection"
import { MissedTodoSection } from "../MissedTodoSection"
import { PickListKey, SessionKey, SessionsKey } from "../SessionPlanner"
import { PriorityFormulaPanel } from "../PriorityFormulaPanel"
import { TodoBreakdown, TodoDeleteButton, TodoLidSection } from "../TodoBreakdown"
import { TodoFilters, TodoSortKeys } from "../todo-filters"
import { TodoLoadPanel } from "../TodoLoadPanel"
import { TodoPeriodNav } from "../TodoPeriodNav"
import { TodoSettingsDialog } from "../TodoSettingsDialog"
import { TodoTable } from "../TodoTable"
import { UndoneTodoSection } from "../UndoneTodoSection"
import { useTodoTime } from "../use-todo-time"
import {
  createScheduledTodoTask,
  getPeriodNavLabel,
  pinPrioritizedFirst,
  getTodoDoneTitle,
  getTodoMissedTitle,
  getTodoOpenTitle,
  undonePushTitle,
  type TodoPeriod,
} from "../todo-utils"
import type { TodoTab } from "./phone-constants"
import { periodLoadFor } from "./phone-load"

/** Span keys (Tek time-base keys): the word, and under it the span it covers. */
const SPAN_KEYS: { value: TodoTab; word: string }[] = [
  { value: "day", word: "Day" },
  { value: "week", word: "Week" },
  { value: "month", word: "Month" },
  { value: "quarter", word: "Season" },
  { value: "other", word: "Other" },
]

function spanSubLabel(tab: TodoTab, date: Date): string {
  if (tab === "day") return date.toLocaleDateString("en-US", { weekday: "short", day: "numeric" })
  if (tab === "week") return getPeriodNavLabel("week", date)
  if (tab === "month") return date.toLocaleDateString("en-US", { month: "long" })
  if (tab === "quarter") return seasonOfDate(date).replace(/^./, (c) => c.toUpperCase())
  return "named ranges"
}

const BGE_SECTIONS: { tier: StepTier; title: string }[] = [
  { tier: "min", title: "Bare minimum" },
  { tier: "goal", title: "Goal" },
  { tier: "exceptional", title: "Exceptional" },
]


export type PhoneDeskRemnantBag = {
  periodLoad: (period: TodoPeriod) => ReturnType<typeof periodLoadFor>
  tasks: Task[]
  updateTask: (task: Task) => void
  addTask: (task: Task) => void
  bgeTiers: boolean
  doneByPeriod: Record<TodoPeriod, import("@/lib/types").TodoItem[]>
  missedByPeriod: Record<TodoPeriod, import("@/lib/types").TodoItem[]>
  undoneByPeriod: Record<TodoPeriod, import("@/lib/types").TodoItem[]>
  assignedQuery: string
  setAssignedQuery: Dispatch<SetStateAction<string>>
  defaultEstimateMin: number
  handleComplete: (todoId: string, level?: StepTier) => void
  handleMissed: (todoId: string) => void
  handlePush: (todoId: string, period: TodoPeriod) => void
  handleDelete: (todoId: string) => void
  handleEstimate: (todoId: string, minutes: number | undefined) => void
  handleSteps: (todoId: string, subtasks: import("@/lib/types").Subtask[]) => void
  todoTime: ReturnType<typeof useTodoTime>
  openTask: (todoId: string) => void
  handleTierChange: (todoId: string, tier: TodoItem["tier"]) => void
  openRitual: (todoId: string) => boolean
  setJustStartTaskId: Dispatch<SetStateAction<string | null>>
  getStatus: (todoId: string) => CompletionStatus
  handleStatusChange: (todoId: string, status: CompletionStatus) => void
  handleCommitment: (todoId: string, period: "day" | "week" | "month" | "quarter", flag: "required" | "prioritized") => void
  handleRename: (todoId: string, description: string) => void
  openRowId: string | null
  setOpenRowId: Dispatch<SetStateAction<string | null>>
  selectedRowId: string | null
  setSelectedRowId: Dispatch<SetStateAction<string | null>>
  flockingId: string | null
  clockTaskId: string | null
  clockStepId: string | undefined
  taskClock: ReturnType<typeof useTaskClockStarter>
  clockStop: ReturnType<typeof useUnfinishedStop>
  focusedDate: Date
  setPrereqTaskId: Dispatch<SetStateAction<string | null>>
  estimateScope: import("@/lib/todo-commitment").EstimateScope
  setEstimateScope: Dispatch<SetStateAction<import("@/lib/todo-commitment").EstimateScope>>
  wipLimit: number
  composerName: string
  setComposerName: Dispatch<SetStateAction<string>>
  composerTier: TodoItem["tier"]
  setComposerTier: Dispatch<SetStateAction<TodoItem["tier"]>>
  expandedPeriods: Record<string, boolean>
  setExpandedPeriods: Dispatch<SetStateAction<Record<string, boolean>>>
  morningTasks: Task[]
  setSelectedTaskId: Dispatch<SetStateAction<string | null>>
  lockedHiddenByPeriod: Record<TodoPeriod, number>
  sunHiddenCount: number
  peekHidden: boolean
  setPeekHidden: Dispatch<SetStateAction<boolean>>
  doneSectionsOpen: Record<TodoPeriod, boolean>
  setDoneSectionsOpen: Dispatch<SetStateAction<Record<TodoPeriod, boolean>>>
  missedSectionsOpen: Record<TodoPeriod, boolean>
  setMissedSectionsOpen: Dispatch<SetStateAction<Record<TodoPeriod, boolean>>>
  undoneSectionsOpen: Record<TodoPeriod, boolean>
  setUndoneSectionsOpen: Dispatch<SetStateAction<Record<TodoPeriod, boolean>>>
  handleAddDone: (description: string) => void
  handleConfirmTimes: (taskId: string, values: import("@/lib/services/completion-time-service").ConfirmedTimes) => void
  periodFolding: boolean
  setPeriodFolding: Dispatch<SetStateAction<boolean>>
  sheetScrollRef: RefObject<HTMLDivElement | null>
  loadOpen: boolean
  showTrayOpen: boolean
  season: {
    seasonKey: string
    seasonOpen: Task[]
    seasonRequired: Task[]
    seasonAssigned: Task[]
    seasonEstimate: { minutes: number; included: number; unestimated: number }
    seasonHours: number
    seasonClockHours: number
    seasonRatio: number
    seasonBand: ComfortBand
    seasonAssignedVisible: Task[]
  } | null
}

/** Builds the desk sheet closures. The caller discards them. Do not call `renderTab` or `renderSeasonRow`. */
export function bindPhoneDeskRemnant(bag: PhoneDeskRemnantBag) {
  const {
    periodLoad,
    tasks,
    updateTask,
    addTask,
    bgeTiers,
    doneByPeriod,
    missedByPeriod,
    undoneByPeriod,
    assignedQuery,
    setAssignedQuery,
    defaultEstimateMin,
    handleComplete,
    handleMissed,
    handlePush,
    handleDelete,
    handleEstimate,
    handleSteps,
    todoTime,
    openTask,
    handleTierChange,
    openRitual,
    setJustStartTaskId,
    getStatus,
    handleStatusChange,
    handleCommitment,
    handleRename,
    openRowId,
    setOpenRowId,
    selectedRowId,
    setSelectedRowId,
    flockingId,
    clockTaskId,
    clockStepId,
    taskClock,
    clockStop,
    focusedDate,
    setPrereqTaskId,
    estimateScope,
    setEstimateScope,
    wipLimit,
    composerName,
    setComposerName,
    composerTier,
    setComposerTier,
    expandedPeriods,
    setExpandedPeriods,
    morningTasks,
    setSelectedTaskId,
    lockedHiddenByPeriod,
    sunHiddenCount,
    peekHidden,
    setPeekHidden,
    doneSectionsOpen,
    setDoneSectionsOpen,
    missedSectionsOpen,
    setMissedSectionsOpen,
    undoneSectionsOpen,
    setUndoneSectionsOpen,
    handleAddDone,
    handleConfirmTimes,
    periodFolding,
    setPeriodFolding,
    sheetScrollRef,
    loadOpen,
    showTrayOpen,
    season,
  } = bag
  // Read so the unread desk prefs stay in the closure. Neither paints.
  void showTrayOpen
  void setPeriodFolding
  void SPAN_KEYS
  void spanSubLabel
  void Tabs
  void TabsContent
  void TabsList
  void TabsTrigger
  void orbFor
  void PickListKey
  void SessionKey
  void SessionsKey
  void TodoPeriodNav
  void TodoFilters
  void TodoSortKeys
  void TodoSettingsDialog
  void PriorityFormulaPanel

  const renderTab = (period: TodoPeriod) => {
    const { past, openTodos, periodKey, ritualIds, estimate, hours, clockHours, ratio, band } = periodLoad(period)
    const taskFor = (todoId: string) => tasks.find((task) => task.id === todoId)
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
      return taskMatchesAssignedQuery(itemTitleOrUntitled(task ?? todo), task?.subtasks, assignedQuery)
    })
    const bgeTierOf = (todoId: string): StepTier => {
      const task = taskFor(todoId)
      return task ? todoMarkTier(task, period, periodKey) : "goal"
    }
    const bgeSections = bgeTiers
      ? splitByTier(pinPrioritizedFirst([...required, ...assigned], (todo) => prioritizedOf(todo.taskId ?? todo.id)).filter((todo) => {
          const task = taskFor(todo.taskId ?? todo.id)
          return taskMatchesAssignedQuery(itemTitleOrUntitled(task ?? todo), task?.subtasks, assignedQuery)
        }), (todo) => bgeTierOf(todo.taskId ?? todo.id))
      : null
    // Score reads every real task on this list: open, done and missed. Rites are derived rows, not tasks, so they stay out.
    const bgeEntries: BgeEntry[] = bgeTiers
      ? [
          ...openTodos.map((todo) => ({ todo, done: false })),
          ...doneByPeriod[period].map((todo) => ({ todo, done: true })),
          ...missedByPeriod[period].map((todo) => ({ todo, done: false })),
        ].flatMap(({ todo, done }) => (taskFor(todo.taskId ?? todo.id) ? [{ tier: bgeTierOf(todo.taskId ?? todo.id), done }] : []))
      : []
    const bge = bgeTiers ? bgeScore(bgeEntries) : null
    const tableProps = {
      period,
      bgeTierOf: bgeTiers ? bgeTierOf : undefined,
      onBgeTierChange: bgeTiers
        ? (todoId: string, tier: StepTier) => {
            const task = taskFor(todoId)
            if (task) updateTask(patchTodoCommitment(task, period, periodKey, { tier }))
          }
        : undefined,
      onComplete: handleComplete,
      onMissed: handleMissed,
      onPush: handlePush,
      onDelete: handleDelete,
      onEstimateChange: handleEstimate,
      onStepsChange: handleSteps,
      stepsOf: (todoId: string) => taskFor(todoId)?.subtasks,
      estimateOf: (todoId: string) => taskFor(todoId)?.estimatedDuration,
      defaultEstimateMin,
      spentOf: (todoId: string) => todoTime.spentOf(taskFor(todoId)?.id ?? todoId),
      timeOf: (todoId: string) => todoTime.timeOf(taskFor(todoId)?.id ?? todoId),
      onTaskClick: openTask,
      onTierChange: handleTierChange,
      onJustStart: (taskId: string) => {
        if (openRitual(taskId)) return
        setJustStartTaskId(taskId)
      },
      isWalkRow: isRitualTodoId,
      getStatus,
      onStatusChange: handleStatusChange,
      isRequired: requiredOf,
      isPrioritized: prioritizedOf,
      onToggleRequired: (todoId: string) => handleCommitment(todoId, period, "required"),
      onTogglePrioritized: (todoId: string) => handleCommitment(todoId, period, "prioritized"),
      onRename: handleRename,
      openRowId,
      onOpenRowIdChange: setOpenRowId,
      selectedRowId,
      onSelectedRowIdChange: setSelectedRowId,
      flockingId,
      clockTaskId,
      clockStepId,
      onClockStart: taskClock.start,
      onClockStop: () => clockStop.request(),
      unlockOf: (taskId: string) => {
        const breakdown = unlockBreakdown({ id: taskId }, tasks)
        if (!breakdown.count) return null
        const due = inheritedDue(taskId, tasks, focusedDate)
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
        return task ? openTaskBlockers(task, tasks).map((t) => itemTitleOrUntitled(t)) : []
      },
      onNeeds: setPrereqTaskId,
      noticeOf: (todoId: string) => {
        const task = taskFor(todoId)
        return task ? needsNotice(task) : false
      },
      onNotice: (todoId: string, text: string) => {
        const task = taskFor(todoId)
        if (task) updateTask(withNoticeAnswer(task, text))
      },
    }
    const inProgress = countInProgress(tasks)
    const openUnestimated = () => {
      const target = [...required, ...visibleAssigned].find((todo) => {
        const task = taskFor(todo.taskId ?? todo.id)
        if (!task) return false
        return !(effectiveDurationMinutes(task.estimatedDuration, task.subtasks) > 0)
      })
      if (!target) return
      setSelectedRowId(target.id)
      setOpenRowId(target.id)
    }
    const composerMatch = composerName.trim()
      ? [...required, ...visibleAssigned].find(
          (todo) => itemTitleOrUntitled(taskFor(todo.taskId ?? todo.id) ?? todo).toLowerCase() === composerName.trim().toLowerCase(),
        )
      : undefined
    const submitComposer = (focusFirstStep: boolean) => {
      const description = composerName.trim()
      if (!description) return
      if (composerMatch) {
        setSelectedRowId(composerMatch.id)
        setOpenRowId(composerMatch.id)
        setComposerName("")
        return
      }
      const created = createScheduledTodoTask({
        description,
        tier: composerTier,
        period,
        date: focusedDate,
      })
      addTask(created)
      setComposerName("")
      if (focusFirstStep) {
        window.setTimeout(() => {
          setSelectedRowId(created.id)
          setOpenRowId(created.id)
        }, 0)
      }
    }
    const aftermathCount = [
      past ? undoneByPeriod[period].length > 0 : false,
      doneByPeriod[period].length > 0,
      missedByPeriod[period].length > 0,
    ].filter(Boolean).length
    return (
    <div
      className={`todo-sheet${periodFolding ? " is-folding" : ""}`}
      ref={sheetScrollRef}
      data-ui-name="Period sheet"
      data-ui-help="Load, Required, Assigned, and the Done, Missed, and Undone wells."
      data-ui-docs="components/Home/ToDo/README.md"
      data-ui-docs-anchor="instrument-layout"
    >
      <h3 className="todo-sheet-title">{getTodoOpenTitle(period, focusedDate)}</h3>
      {loadOpen && (
      <TodoLoadPanel
        isDay={period === "day"}
        spentMinutes={openTodos.reduce((sum, todo) => sum + todoTime.spentOf(todo.taskId ?? todo.id), 0)}
        requiredMinutes={summedEstimate(openTodos, tasks, period, periodKey, "required", ritualIds).minutes}
        allMinutes={summedEstimate(openTodos, tasks, period, periodKey, "all", ritualIds).minutes}
        showDaysLeft={period !== "day"}
        daysLeft={daysLeftLabel(period, focusedDate)}
        estimate={formatMinutesAsHours(estimate.minutes)}
        estimateMinutes={estimate.minutes}
        unestimated={estimate.unestimated}
        included={estimate.included}
        scope={estimateScope}
        onScopeChange={setEstimateScope}
        hoursLeft={formatWorkingHours(clockHours)}
        workingHours={formatWorkingHours(hours)}
        workingHoursValue={hours}
        comfortRatioText={formatComfortRatio(ratio)}
        comfortRatioValue={ratio}
        band={band}
        inProgress={inProgress}
        wipLimit={wipLimit}
        onUnestimatedClick={openUnestimated}
      />
      )}
      {period === "day" && morningTasks.length > 0 && (
        <div
          className="todo-morning-priorities"
          data-ui-name="Morning priorities"
          data-ui-help="Tasks marked in today's morning review."
          data-ui-docs="components/Home/ToDo/README.md"
        >
          <p className="todo-morning-label">Morning priorities</p>
          <ol className="todo-morning-list">
            {morningTasks.map((task) => (
              <li key={task.id} className={task.completed ? "is-done" : undefined}>
                <button type="button" className="todo-btn" onClick={() => setSelectedTaskId(task.id)}>
                  {itemTitleOrUntitled(task)}
                </button>
                {task.completed ? <span className="todo-visually-hidden"> (done)</span> : null}
              </li>
            ))}
          </ol>
        </div>
      )}
      {bge && bgeEntries.length > 0 && (
        <div
          className="todo-bge-score"
          data-ui-name="B/G/E score"
          data-ui-help="Bare minimum 70%, Goal 30%, Exceptional done adds what a Goal task is worth."
          data-ui-docs="components/Home/ToDo/README.md"
          data-ui-docs-anchor="bge-tiers"
        >
          <span className="todo-bge-score-num" title="Bare minimum is 70%, Goal 30%. Each Exceptional done adds one Goal task's share on top.">
            {Math.round(bge.points)}
            <small>%</small>
          </span>
          <span className="todo-bge-score-label">B/G/E {period} score</span>
          <span className="todo-bge-score-parts">
            B {bge.min.done}/{bge.min.total} · G {bge.goal.done}/{bge.goal.total} · E {bge.exceptional.done}/{bge.exceptional.total}
            {bge.bonus > 0 ? ` · +${Math.round(bge.bonus)} bonus` : ""}
          </span>
          <span className="todo-bge-score-plain">
            {bgeEntries.filter((e) => e.done).length} of {bgeEntries.length} tasks done
          </span>
        </div>
      )}
      <div className="todo-ledger">
        {/* Hidden while empty (dead instruments are hidden); it appears when a row's Required gem lights. */}
        {required.length > 0 && !bgeTiers && (
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
              isExpanded={!!expandedPeriods[`required-${period}`]}
              onToggleExpand={() =>
                setExpandedPeriods((prev) => ({ ...prev, [`required-${period}`]: !prev[`required-${period}`] }))
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
            <label className="todo-search">
              <span className="todo-visually-hidden">Search</span>
              <input
                type="search"
                value={assignedQuery}
                placeholder="Search assigned tasks"
                aria-label="Search assigned tasks"
                onChange={(event) => setAssignedQuery(event.target.value)}
              />
            </label>
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
                  emptyLabel={assignedQuery.trim() ? "Nothing matches." : `Nothing at ${title} yet.`}
                  isExpanded={!!expandedPeriods[`${tier}-${period}`]}
                  onToggleExpand={() => setExpandedPeriods((prev) => ({ ...prev, [`${tier}-${period}`]: !prev[`${tier}-${period}`] }))}
                />
              </div>
            ))
          ) : (
          <TodoTable
            {...tableProps}
            todos={visibleAssigned}
            emptyLabel={
              assignedQuery.trim()
                ? "Nothing matches."
                : required.length > 0
                  ? "Nothing else assigned."
                  : undefined
            }
            isExpanded={!!expandedPeriods[period]}
            onToggleExpand={() => setExpandedPeriods((prev) => ({ ...prev, [period]: !prev[period] }))}
          />
          )}
          <WaitingLine
            hidden={lockedHiddenByPeriod[period] + (period === "day" ? sunHiddenCount : 0)}
            peeking={peekHidden}
            onPeek={() => setPeekHidden((on) => !on)}
          />
          <div
            className="todo-composer"
            data-ui-name="Assigned composer"
            data-ui-help="Adds a task on this period, or opens a name that already exists."
            data-ui-docs="components/Home/ToDo/README.md"
            data-ui-docs-anchor="required-prioritized-assigned"
          >
            <input
              type="text"
              className="todo-composer-name"
              value={composerName}
              placeholder="Add a task…"
              aria-label="Add a task"
              onChange={(e) => setComposerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  submitComposer(e.shiftKey)
                }
              }}
            />
            <NativeSelect
              className="todo-nixie"
              aria-label="Composer tier"
              title={`Tier ${composerTier}`}
              value={composerTier}
              onChange={(e) => setComposerTier(e.target.value as TodoItem["tier"])}
            >
              {(["A+", "A", "A/B", "B", "C", "D"] as const).map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </NativeSelect>
            {composerMatch ? (
              <button
                type="button"
                className="todo-btn"
                onClick={() => {
                  setSelectedRowId(composerMatch.id)
                  setOpenRowId(composerMatch.id)
                  setComposerName("")
                }}
              >
                Open existing
              </button>
            ) : null}
            <button
              type="button"
              className="todo-btn todo-composer-add"
              onClick={() => submitComposer(false)}
            >
              Add
            </button>
            {/* Log done lives here too, so it stays reachable while the Done well is hidden. */}
            <AddDoneDialog onAdd={handleAddDone} />
          </div>
        </section>
      </div>
      <div
        className={`todo-aftermath${aftermathCount > 1 ? " is-columns" : ""}`}
        style={aftermathCount > 1 ? { ["--todo-aftermath-cols" as string]: String(aftermathCount) } : undefined}
      >
      {past && undoneByPeriod[period].length > 0 && (
        <UndoneTodoSection
          todos={undoneByPeriod[period]}
          tasks={tasks}
          period={period}
          pushTitle={undonePushTitle(period, focusedDate)}
          open={undoneSectionsOpen[period]}
          onOpenChange={(open) => setUndoneSectionsOpen((prev) => ({ ...prev, [period]: open }))}
          onTaskClick={openTask}
          onAssimilate={(taskId) => resolveUndone(taskId, period, "assimilate")}
          onPush={(taskId) => resolveUndone(taskId, period, "push")}
          onDiscard={(taskId) => resolveUndone(taskId, period, "discard")}
        />
      )}
      {doneByPeriod[period].length > 0 && (
      <DoneTodoSection
        title={getTodoDoneTitle(period, focusedDate)}
        todos={doneByPeriod[period]}
        tasks={tasks}
        period={period}
        open={doneSectionsOpen[period]}
        onOpenChange={(open) => setDoneSectionsOpen((prev) => ({ ...prev, [period]: open }))}
        onTaskClick={openTask}
        onAddDone={handleAddDone}
        onConfirmTimes={handleConfirmTimes}
        refDate={focusedDate}
      />
      )}
      {missedByPeriod[period].length > 0 && (
      <MissedTodoSection
        title={getTodoMissedTitle(period, focusedDate)}
        todos={missedByPeriod[period]}
        tasks={tasks}
        period={period}
        open={missedSectionsOpen[period]}
        onOpenChange={(open) => setMissedSectionsOpen((prev) => ({ ...prev, [period]: open }))}
        onTaskClick={openTask}
      />
      )}
      </div>
    </div>
    )
  }

  const renderSeasonRow = (task: Task) => {
    if (!season) return null
    const { seasonKey } = season
    const prioritized = taskIsPrioritized(task, "quarter", seasonKey)
    const required = taskIsRequired(task, "quarter", seasonKey)
    const name = itemTitleOrUntitled(task)
    const stepCount = flattenSteps(task.subtasks).length
    const open = openRowId === task.id
    return (
      <li key={task.id} className={`todo-season-row${open ? " is-open" : ""}`}>
        <div className="todo-row-closed">
          <button
            type="button"
            className="todo-row-nameplate"
            data-no95
            title={name}
            onClick={() => {
              setSelectedRowId(task.id)
              setOpenRowId(open ? null : task.id)
            }}
          >
            <span className="todo-row-name">{name}</span>
          </button>
          <div className="todo-row-verbs" role="toolbar" aria-label="Task actions">
            <TodoDeleteButton
              prompt={stepCount > 0 ? `Delete "${name}" and its ${stepCount} steps?` : `Delete "${name}"?`}
              onDelete={() => handleDelete(task.id)}
            />
          </div>
        </div>
        {open ? (
          <div className="todo-lid">
            <TodoLidSection id="flags" label="Flags" layout="flags">
              <button
                type="button"
                className="todo-jewel is-required"
                aria-pressed={required}
                aria-label="Required"
                title="Required — you marked this one for this season"
                onClick={() => handleCommitment(task.id, "quarter", "required")}
              >
                <span className="todo-jewel-glass" aria-hidden />
                <span className="todo-jewel-word">Required</span>
              </button>
              <button
                type="button"
                className="todo-jewel is-prioritized"
                aria-pressed={prioritized}
                aria-label="Prioritized"
                title="Prioritized — stays on Assigned, marked"
                onClick={() => handleCommitment(task.id, "quarter", "prioritized")}
              >
                <span className="todo-jewel-glass" aria-hidden />
                <span className="todo-jewel-word">Prioritized</span>
              </button>
              <button type="button" className="todo-verb" onClick={() => setSelectedTaskId(task.id)}>
                View
              </button>
            </TodoLidSection>
            <TodoBreakdown
              estimate={task.estimatedDuration}
              steps={task.subtasks}
              onEstimateChange={(minutes) => handleEstimate(task.id, minutes)}
              onStepsChange={(subtasks) => handleSteps(task.id, subtasks)}
              onOpenStep={(step) => openStepItem(task.id, step.id)}
              time={todoTime.timeOf(task.id)}
            />
          </div>
        ) : null}
      </li>
    )
  }

  return { renderTab, renderSeasonRow }
}
