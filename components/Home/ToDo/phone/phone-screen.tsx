/**
 * components/Home/ToDo/phone/phone-screen.tsx — The live phone return: `TodoMobile` and its props.
 */
import { needsNotice, withNoticeAnswer } from "@/lib/notice-dot"
import { isClearedFromWork, isOpen } from "@/lib/completion-status"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { openTaskBlockers } from "@/lib/prereqs"
import { quarterLabel } from "@/lib/seasons"
import { inheritedDue, unlockBreakdown } from "@/lib/unlock-value"
import {
  patchTodoCommitment,
  taskIsPrioritized,
  taskIsRequired,
  todoMarkTier,
  todoPeriodKey,
} from "@/lib/todo-commitment"
import { openPeriodTodoList, periodTodoListName } from "@/lib/scheduled-lists-sync"
import { countInProgress, DEFAULT_TODO_SORT_ORDER, getPeriodNavLabel, getTodoDoneTitle, getTodoMissedTitle, isPastTodoPeriod, todoPeriodValue, undonePushTitle, type TodoPeriod } from "../todo-utils"
import { tasksInRange, todoTitle } from "../todo-ranges"
import { DEFAULT_TODO_PREFS, setTodoPrefs } from "../todo-prefs"
import { PaceSettings } from "../todo-pace"
import { TodoMobile } from "../todo-mobile"
import { buildPhoneLoadPanel, headerLoadFor } from "./phone-load"
import { phoneOtherSlot } from "./phone-other-slot"
import { PhoneOverlays } from "./phone-overlays"
import type { PhonePageModel } from "./use-phone-page"

export function PhoneScreen({ model }: { model: PhonePageModel }) {
  const {
    activeTodoTab,
    setActiveTodoTab,
    periodTab,
    focusedDate,
    setFocusedDate,
    tasks,
    updateTask,
    ritualBoard,
    morningPriorities,
    morningTasks,
    filteredByPeriod,
    lockedHiddenByPeriod,
    doneByPeriod,
    missedByPeriod,
    undoneByPeriod,
    sunHiddenCount,
    peekHidden,
    setPeekHidden,
    availableNow,
    wipLimit,
    hideLocked,
    showAllTasks,
    statusFilter,
    sortMode,
    sortOrder,
    bgeTiers,
    showNextOnly,
    tierView,
    defaultEstimateMin,
    setShowFormula,
    todoPrefs,
    todoRanges,
    todoTime,
    estimateScope,
    setEstimateScope,
    openRowId,
    setOpenRowId,
    setSelectedRowId,
    setAssignedQuery,
    setPrereqTaskId,
    setSessionOpen,
    setJustStartTaskId,
    flockingId,
    doneSectionsOpen,
    setDoneSectionsOpen,
    missedSectionsOpen,
    setMissedSectionsOpen,
    undoneSectionsOpen,
    setUndoneSectionsOpen,
    clockTaskId,
    taskClock,
    clockStop,
    season,
    periodLoad,
    openRitual,
    handleComplete,
    handleMissed,
    handlePush,
    handleDelete,
    handleEstimate,
    handleSteps,
    handleTierChange,
    handleStatusChange,
    handleCommitment,
    handleRename,
    openTask,
    getStatus,
    resolveUndone,
    handleAddDone,
    handleConfirmTimes,
    handleAddTodo,
    searchExistingTasks,
    pickExistingTask,
    onQuickAdd,
  } = model

  const seasonLabel = season ? quarterLabel(season.seasonKey) : ""
  const activeRange = todoRanges.find((r) => r.range.id === todoPrefs.activeRangeId) ?? todoRanges[0]
  const todoHeading = todoTitle(activeTodoTab, focusedDate, todoPrefs, activeRange?.name)
  const periodLabel =
    periodTab === "quarter"
      ? "Season view"
      : periodTab === "day"
        ? "Day view"
        : periodTab === "week"
          ? "Week view"
          : "Month view"
  const viewingPast = periodTab === "quarter" ? false : isPastTodoPeriod(periodTab, focusedDate)
  const undoneIds =
    periodTab === "quarter"
      ? new Set<string>()
      : new Set(undoneByPeriod[periodTab].map((todo) => todo.taskId ?? todo.id))
  const openCount =
    activeTodoTab === "other"
      ? activeRange ? tasksInRange(tasks, activeRange.range.id).filter((t) => isOpen(t) && !isClearedFromWork(t)).length : 0
      : periodTab === "quarter"
      ? (season?.seasonOpen.length ?? 0)
      : viewingPast
        ? filteredByPeriod[periodTab].filter((todo) => !undoneIds.has(todo.taskId ?? todo.id)).length
        : filteredByPeriod[periodTab].length
  const undoneCount = periodTab === "quarter" ? 0 : undoneByPeriod[periodTab].length
  const inProgressCount = countInProgress(tasks)
  const stripShown = activeTodoTab !== "other" && periodTab !== "quarter"
  const activeFilterCount = [
    availableNow,
    showAllTasks,
    hideLocked,
    showNextOnly,
    tierView !== "all",
    statusFilter !== DEFAULT_TODO_PREFS.statusFilter,
  ].filter(Boolean).length
  const headerLoad = headerLoadFor({
    activeTodoTab,
    periodTab,
    season,
    periodLoad,
    inProgressCount,
    wipLimit,
  })
  const phoneLens = activeTodoTab === "other" ? "other" : periodTab === "quarter" ? "season" : "period"
  const phonePeriod: TodoPeriod = periodTab === "quarter" ? "month" : periodTab
  const load = phoneLens === "period" ? periodLoad(phonePeriod) : null
  const markPeriod = periodTab
  const markKey = todoPeriodKey(markPeriod, focusedDate)
  const ritualIds = markPeriod === "day" ? morningPriorities : undefined
  const loadPanel = buildPhoneLoadPanel({
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
  })

  return (
    <TodoMobile
      activeTab={activeTodoTab}
      onTab={(next) => {
        if (next === activeTodoTab) return
        setActiveTodoTab(next)
        setOpenRowId(null)
        setSelectedRowId(null)
        setAssignedQuery("")
        setShowFormula(false)
      }}
      focusedDate={focusedDate}
      onFocusedDate={setFocusedDate}
      heading={todoHeading}
      dateLabel={
        activeTodoTab === "other"
          ? activeRange?.name ?? "Other"
          : periodTab === "quarter"
            ? seasonLabel
            : getPeriodNavLabel(periodTab, focusedDate)
      }
      periodLabel={periodLabel}
      openCount={openCount}
      undoneCount={phoneLens === "period" ? undoneCount : 0}
      viewingPast={phoneLens === "period" && viewingPast}
      headerLoad={headerLoad ? { text: headerLoad.text, overCap: headerLoad.overCap } : null}
      inProgressCount={inProgressCount}
      wipLimit={wipLimit}
      loadPanel={loadPanel}
      lens={phoneLens}
      period={phonePeriod}
      openTodos={load?.openTodos ?? []}
      tasks={tasks}
      taskFor={(id) => tasks.find((task) => task.id === id) ?? ritualBoard.tasks.find((task) => task.id === id)}
      isStoredTask={(id) => tasks.some((task) => task.id === id)}
      seasonRequired={season?.seasonRequired ?? []}
      seasonAssigned={season?.seasonAssigned ?? []}
      seasonHint={season ? `Tasks scheduled on a day, week, or month in ${quarterLabel(season.seasonKey)}.` : ""}
      other={phoneOtherSlot(openTask)}
      stripShown={stripShown}
      filterCount={activeFilterCount}
      availableNow={availableNow}
      onAvailableNowChange={(value) => setTodoPrefs({ availableNow: value })}
      showAllTasks={showAllTasks}
      onShowAllTasksChange={(value) => setTodoPrefs({ showAllTasks: value })}
      statusFilter={statusFilter}
      onStatusFilterChange={(value) => setTodoPrefs({ statusFilter: value })}
      onShowFormula={setShowFormula}
      listName={stripShown ? periodTodoListName(phonePeriod, todoPeriodValue(phonePeriod, focusedDate)) : undefined}
      onOpenList={
        stripShown
          ? () => openPeriodTodoList(phonePeriod, todoPeriodValue(phonePeriod, focusedDate))
          : undefined
      }
      sortMode={sortMode}
      onSortModeChange={(mode) => setTodoPrefs({ sortMode: mode, sortOrder: DEFAULT_TODO_SORT_ORDER[mode] })}
      sortOrder={sortOrder}
      onSortOrderChange={(order) => setTodoPrefs({ sortOrder: order })}
      bgeTiers={bgeTiers}
      morningTasks={morningTasks}
      onComplete={handleComplete}
      onMissed={handleMissed}
      onPush={(id) => {
        if (markPeriod === "quarter") return
        handlePush(id, markPeriod)
      }}
      onDelete={handleDelete}
      onEstimate={handleEstimate}
      onSteps={handleSteps}
      onTier={handleTierChange}
      onJustStart={(id) => {
        if (openRitual(id)) return
        setJustStartTaskId(id)
      }}
      onStatus={handleStatusChange}
      onToggleRequired={(id) => handleCommitment(id, markPeriod, "required")}
      onTogglePrioritized={(id) => handleCommitment(id, markPeriod, "prioritized")}
      onBgeTier={(id, tier) => {
        if (markPeriod === "quarter") return
        const task = tasks.find((row) => row.id === id)
        if (task) updateTask(patchTodoCommitment(task, markPeriod, markKey, { tier }))
      }}
      bgeTierOf={(id) => {
        const task = tasks.find((row) => row.id === id)
        return task && markPeriod !== "quarter" ? todoMarkTier(task, markPeriod, markKey) : "goal"
      }}
      onRename={handleRename}
      onTaskClick={openTask}
      onNeeds={setPrereqTaskId}
      onClockStart={taskClock.start}
      onClockStop={() => clockStop.request()}
      clockTaskId={clockTaskId}
      getStatus={getStatus}
      isRequired={(id) => {
        const task = tasks.find((row) => row.id === id)
        return !!task && taskIsRequired(task, markPeriod, markKey)
      }}
      isPrioritized={(id) => {
        const task = tasks.find((row) => row.id === id)
        return !!task && taskIsPrioritized(task, markPeriod, markKey, ritualIds)
      }}
      defaultEstimateMin={defaultEstimateMin}
      spentOf={(id) => todoTime.spentOf(id)}
      timeOf={(id) => todoTime.timeOf(id)}
      noticeOf={(id) => {
        const task = tasks.find((row) => row.id === id)
        return task ? needsNotice(task) : false
      }}
      onNotice={(id, text) => {
        const task = tasks.find((row) => row.id === id)
        if (task) updateTask(withNoticeAnswer(task, text))
      }}
      blockersOf={(id) => {
        const task = tasks.find((row) => row.id === id)
        return task ? openTaskBlockers(task, tasks).map((row) => itemTitleOrUntitled(row)) : []
      }}
      unlockOf={(id) => {
        const breakdown = unlockBreakdown({ id }, tasks)
        if (!breakdown.count) return null
        const due = inheritedDue(id, tasks, focusedDate)
        return {
          count: breakdown.count,
          title: breakdown.label,
          due: due
            ? `due ${due.due.toLocaleDateString(undefined, { weekday: "short" })} for ${itemTitleOrUntitled(due.forTask)}`
            : undefined,
        }
      }}
      flockingId={flockingId}
      openRowId={openRowId}
      onOpenRow={(id) => {
        setOpenRowId(id)
        setSelectedRowId(id)
      }}
      doneTodos={phoneLens === "period" ? doneByPeriod[phonePeriod] : []}
      missedTodos={phoneLens === "period" ? missedByPeriod[phonePeriod] : []}
      undoneTodos={phoneLens === "period" ? undoneByPeriod[phonePeriod] : []}
      doneOpen={doneSectionsOpen[phonePeriod]}
      missedOpen={missedSectionsOpen[phonePeriod]}
      undoneOpen={undoneSectionsOpen[phonePeriod]}
      onDoneOpen={(open) => setDoneSectionsOpen((prev) => ({ ...prev, [phonePeriod]: open }))}
      onMissedOpen={(open) => setMissedSectionsOpen((prev) => ({ ...prev, [phonePeriod]: open }))}
      onUndoneOpen={(open) => setUndoneSectionsOpen((prev) => ({ ...prev, [phonePeriod]: open }))}
      doneTitle={getTodoDoneTitle(phonePeriod, focusedDate)}
      missedTitle={getTodoMissedTitle(phonePeriod, focusedDate)}
      pushTitle={undonePushTitle(phonePeriod, focusedDate)}
      onAssimilate={(id) => resolveUndone(id, phonePeriod, "assimilate")}
      onUndonePush={(id) => resolveUndone(id, phonePeriod, "push")}
      onDiscard={(id) => resolveUndone(id, phonePeriod, "discard")}
      onAddDone={handleAddDone}
      onConfirmTimes={handleConfirmTimes}
      onAdd={handleAddTodo}
      searchExisting={searchExistingTasks}
      onPickExisting={pickExistingTask}
      onOpenPickList={() => setSessionOpen("list")}
      onOpenSession={() => setSessionOpen("session")}
      onOpenSessions={() => setSessionOpen("shelves")}
      paceSlot={
        <PaceSettings
          samples={todoTime.samples}
          overrides={todoTime.paceOverrides}
          ghosts={todoTime.paceGhosts}
          scopes={todoTime.scopes}
        />
      }
      hiddenWaiting={
        phoneLens === "period" ? lockedHiddenByPeriod[phonePeriod] + (phonePeriod === "day" ? sunHiddenCount : 0) : 0
      }
      peeking={peekHidden}
      onPeek={() => setPeekHidden((on) => !on)}
      onQuickAdd={onQuickAdd}
    >
      <PhoneOverlays model={model} />
    </TodoMobile>
  )
}
