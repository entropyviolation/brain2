/**
 * components/Scheduler/enhanced-scheduler.tsx — Scheduler period funnel (orchestrator)
 *
 * Progressive refinement: a Scheduler inbox plus Always → Year → Month → Week →
 * Day buckets. Dragging a task down a level refines its scheduling fields.
 * Funnel / Gantt / Dependencies are view modes on the toolbar; Always→Day are
 * period folder tabs — different chrome.
 *
 * Spec: §7.1–7.2 (period funnel). Auto-scheduling (§7.6) is deferred.
 * Day dates: Today / Tomorrow store the local calendar date. An unfinished
 * past period rolls up one level, or auto-pushes to the next To Do period
 * when `autoPush` is on (`useDayScheduleRollover`); prior placements
 * stay on `schedulePlacements` for gray past cells. × / drag from a past cell
 * dismisses that placement (and rolls a still-live past assignment) without
 * wiping other history. A card title opens Schedule Card Detail across the
 * board: work at this grain, finer assignments, and Undone still open to
 * push, dismiss, or finish. Open list jumps to that period's To do list in
 * Lists. That queue drops pushed and discarded placements;
 * the record keeps them. Send to Scheduler (`scheduleable`) is membership in
 * this funnel. A dated list, such as a trip itinerary, is scheduled on its
 * own and is not sent here unless that switch is on.
 */
"use client"

import type React from "react"
import { useState, useCallback, useMemo, useEffect } from "react"
import { useTaskStore } from "@/lib/task-store"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Task, SchedulePeriod, SchedulePlacementPeriod, StoredBlockedReason } from "@/lib/types"
import { TaskDetailPopup } from "@/components/ItemDetail/ItemDetailPopup"
import { APP_NAV_KEYS, SCHEDULER_VIEWS, type SchedulerViewMode, readStoredDate, writeStoredDate } from "@/lib/app-navigation"
import { openPeriodTodoList, periodTodoListName } from "@/lib/scheduled-lists-sync"
import { formatLocalDateKey, formatLocalMonthKey } from "@/lib/date-utils"
import { isClearedFromWork } from "@/lib/completion-status"
import { subscribeDayClock } from "@/lib/day-clock"
import {
  findEventuallyList,
  isOnEventuallyList,
  leaveEventuallyList,
  placeTasksOnEventually,
  removeUnscheduledFromEventually,
} from "@/lib/eventually-list"
import { usePersistedTab } from "@/lib/use-persisted-tab"
import { orbFor } from "@/components/Icons"
import {
  scheduleTask as scheduleTaskSvc,
  unscheduleTask as unscheduleTaskSvc,
  dismissTaskFromPeriod as dismissTaskFromPeriodSvc,
  scheduleTaskToTime,
  clearScheduledTime,
  setTaskScheduleable as setTaskScheduleableSvc,
} from "@/lib/services/scheduling-service"
import { completeTask } from "@/lib/services/completion-service"
import { runWithoutCompletionPopup } from "@/lib/completion-events"
import { creditSchedulePlacement, earnsSchedulePoint } from "@/lib/schedule-credit"
import { itemTitle, itemTitleOrUntitled } from "@/lib/item-utils"
import { MissReasonDialog } from "@/components/Reviews/MissReasonDialog"
import {
  getScheduleableCategoryIds,
  getAvailableTasks,
  getTasksForPeriod,
  getCategoryColor,
  getCurrentYear,
  getCurrentMonth,
  getCurrentWeek,
  getNavigationLabel,
  navigateDate,
  getMonths,
  quarterMonthCells,
  getWeeksInMonth,
  getDaysInWeek,
  buildOverviewBoxes,
  assignTasksToOverviewBoxes,
  taskIdsForDragSchedule,
  isPastFunnelPeriod,
  type SchedulerSortBy,
  type SchedulerSortOrder,
} from "./scheduler-utils"
import { SchedulerTaskItem } from "./SchedulerTaskItem"
import { PeriodFunnelTab } from "./PeriodFunnelTab"
import { AlwaysTab } from "./AlwaysTab"
import { DayTab } from "./DayTab"
import { ScheduleCardDetail } from "./ScheduleCardDetail"
import {
  dismissCardWorkingQueue,
  finishCardInPeriod,
  partitionCardDetail,
  pushCardWorkingQueue,
  unscheduleCardWorkingQueue,
  type ScheduleCardDetailTarget,
} from "./schedule-card-detail"
import { GanttView } from "./GanttView"
import { DependencyGraph } from "./DependencyGraph"
import "./scheduler-chrome.css"

const SCHEDULER_TABS = ["always", "year", "quarter", "month", "week", "day"] as const
const PERIOD_LABEL: Record<(typeof SCHEDULER_TABS)[number], string> = {
  always: "Always",
  year: "Year",
  quarter: "Season",
  month: "Month",
  week: "Week",
  day: "Day",
}

type SchedulerView = SchedulerViewMode

const VIEW_CAPTION: Record<SchedulerView, string> = {
  funnel: "Scheduler — Funnel",
  gantt: "Scheduler — Gantt",
  graph: "Scheduler — Dependencies",
}

type ScheduleFromCell = { period: SchedulePlacementPeriod; value: string }

function taskHasLivePeriod(task: Task | undefined): boolean {
  return !!(task?.scheduledDate || task?.scheduledWeek || task?.scheduledMonth || task?.scheduledYear)
}

export function EnhancedScheduler() {
  const allTasks = useTaskStore((state) => state.tasks)
  const categories = useTaskStore((state) => state.lists)
  const folders = useTaskStore((state) => state.folders)
  const [wallClock, setWallClock] = useState(() => new Date())

  const [activeTab, setActiveTab] = usePersistedTab(APP_NAV_KEYS.schedulerTab, SCHEDULER_TABS, "always")
  const [schedulerView, setSchedulerView] = usePersistedTab(APP_NAV_KEYS.schedulerView, SCHEDULER_VIEWS, "funnel")
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())
  const [currentDate, setCurrentDate] = useState(() => readStoredDate(APP_NAV_KEYS.schedulerDate) ?? new Date())
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<SchedulerSortBy>("importance")
  const [sortOrder, setSortOrder] = useState<SchedulerSortOrder>("desc")
  const [detail, setDetail] = useState<ScheduleCardDetailTarget | null>(null)

  useEffect(() => subscribeDayClock(() => setWallClock(new Date())), [])

  useEffect(() => {
    setDetail(null)
  }, [activeTab, currentDate])

  useEffect(() => {
    writeStoredDate(APP_NAV_KEYS.schedulerDate, currentDate)
  }, [currentDate])

  const scheduleableCategoryIds = useMemo(() => getScheduleableCategoryIds(categories), [categories])
  const eventuallyListId = useMemo(() => findEventuallyList(categories, folders)?.id, [categories, folders])

  const availableTasks = useMemo(
    () =>
      getAvailableTasks(allTasks, {
        activeTab,
        selectedCategories,
        sortBy,
        sortOrder,
        lists: categories,
        scheduleableCategoryIds,
        eventuallyListId,
      }),
    [allTasks, activeTab, selectedCategories, sortBy, sortOrder, categories, scheduleableCategoryIds, eventuallyListId],
  )

  const tasksFor = useCallback(
    (period: SchedulePeriod, value?: string) =>
      getTasksForPeriod(allTasks, period, value, currentDate, wallClock),
    [allTasks, currentDate, wallClock],
  )

  const scheduleTasksToPeriod = useCallback(
    (taskIds: string[], period: SchedulePeriod, value: string, from?: ScheduleFromCell) => {
      const leave =
        from && isPastFunnelPeriod(from.period, from.value, wallClock)
          ? { period: from.period, value: from.value }
          : undefined
      const snapshot = useTaskStore.getState().tasks
      taskIds.forEach((taskId) => {
        const before = snapshot.find((row) => row.id === taskId)
        if (!before) return
        const earns = earnsSchedulePoint(before, period, value)
        scheduleTaskSvc(taskId, period, value, undefined, leave ? { removePlacement: leave } : undefined)
        leaveEventuallyList(taskId)
        if (earns) creditSchedulePlacement(taskId, itemTitle(before))
      })
      setSelectedTasks(new Set())
    },
    [wallClock],
  )

  const placeOnEventually = useCallback((taskIds: string[]) => {
    placeTasksOnEventually(taskIds)
    setSelectedTasks(new Set())
  }, [])

  const unscheduleTask = useCallback(
    (taskId: string, from?: ScheduleFromCell) => {
      if (from && isPastFunnelPeriod(from.period, from.value, wallClock)) {
        dismissTaskFromPeriodSvc(taskId, from.period, from.value, wallClock)
        const after = useTaskStore.getState().tasks.find((row) => row.id === taskId)
        if (!taskHasLivePeriod(after)) removeUnscheduledFromEventually(taskId)
        return
      }
      const task = useTaskStore.getState().tasks.find((row) => row.id === taskId)
      if (taskHasLivePeriod(task)) unscheduleTaskSvc(taskId)
      else removeUnscheduledFromEventually(taskId)
    },
    [wallClock],
  )

  const removeSelectedFromScheduler = useCallback(() => {
    selectedTasks.forEach((taskId) => setTaskScheduleableSvc(taskId, false))
    setSelectedTasks(new Set())
  }, [selectedTasks])

  const deleteSelected = useCallback(() => {
    const n = selectedTasks.size
    if (n === 0) return
    if (!confirm(`Delete ${n} task${n === 1 ? "" : "s"}?`)) return
    const deleteTask = useTaskStore.getState().deleteTask
    selectedTasks.forEach((taskId) => deleteTask(taskId))
    setSelectedTasks(new Set())
  }, [selectedTasks])

  const markCompleteSelected = useCallback(() => {
    if (selectedTasks.size === 0) return
    runWithoutCompletionPopup(() => {
      selectedTasks.forEach((taskId) => completeTask(taskId))
    })
    setSelectedTasks(new Set())
  }, [selectedTasks])

  const clearSelection = useCallback(() => setSelectedTasks(new Set()), [])

  const toggleTaskSelection = useCallback((taskId: string) => {
    setSelectedTasks((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }, [])

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string, from?: ScheduleFromCell) => {
    e.dataTransfer.setData("taskId", taskId)
    if (from) {
      e.dataTransfer.setData("sourcePeriod", from.period)
      e.dataTransfer.setData("sourceValue", from.value)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, period: SchedulePeriod, value: string) => {
      e.preventDefault()
      const taskId = e.dataTransfer.getData("taskId")
      if (!taskId) return
      const sourcePeriod = e.dataTransfer.getData("sourcePeriod") as SchedulePlacementPeriod | ""
      const sourceValue = e.dataTransfer.getData("sourceValue")
      const from =
        sourcePeriod && sourceValue
          ? { period: sourcePeriod, value: sourceValue }
          : undefined
      scheduleTasksToPeriod(taskIdsForDragSchedule(taskId, selectedTasks), period, value, from)
    },
    [scheduleTasksToPeriod, selectedTasks],
  )

  const handleDropEventually = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const taskId = e.dataTransfer.getData("taskId")
      if (taskId) placeOnEventually(taskIdsForDragSchedule(taskId, selectedTasks))
    },
    [placeOnEventually, selectedTasks],
  )

  const handleDropToParent = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (!detail) return
      const taskId = e.dataTransfer.getData("taskId")
      if (!taskId) return
      const ids = taskIdsForDragSchedule(taskId, selectedTasks)
      if (detail.parent === "always") {
        ids.forEach((id) => {
          unscheduleTaskSvc(id)
          removeUnscheduledFromEventually(id)
        })
        setSelectedTasks(new Set())
        return
      }
      if (!detail.parentValue) return
      scheduleTasksToPeriod(ids, detail.parent, detail.parentValue)
    },
    [detail, scheduleTasksToPeriod, selectedTasks],
  )

  const detailRows = useMemo(() => {
    if (!detail) return null
    if (detail.period === "eventually") {
      return {
        past: false,
        here: allTasks.filter((task) => !isClearedFromWork(task) && isOnEventuallyList(task, eventuallyListId)),
        finer: [] as Task[],
        undone: [] as Task[],
      }
    }
    return partitionCardDetail(allTasks, detail.period, detail.value, wallClock)
  }, [detail, allTasks, eventuallyListId, wallClock])

  const [pushAsk, setPushAsk] = useState<{ taskId: string; subject: string } | null>(null)

  const applyDetailAction = useCallback(
    (taskId: string, kind: "push" | "dismiss" | "done" | "unschedule", missReason?: StoredBlockedReason) => {
      if (!detail || detail.period === "eventually") return
      const task = useTaskStore.getState().tasks.find((row) => row.id === taskId)
      if (!task) return
      const patch =
        kind === "done"
          ? finishCardInPeriod(task, detail.period, detail.value)
          : kind === "push"
            ? pushCardWorkingQueue(task, detail.period, detail.value, wallClock, missReason)
            : kind === "unschedule"
              ? unscheduleCardWorkingQueue(task, detail.period, detail.value, wallClock)
              : dismissCardWorkingQueue(task, detail.period, detail.value, wallClock)
      useTaskStore.getState().updateTask({ ...task, ...patch })
    },
    [detail, wallClock],
  )

  const cellClick = useCallback(
    (period: SchedulePeriod, value: string) => {
      if (selectedTasks.size > 0) scheduleTasksToPeriod(Array.from(selectedTasks), period, value)
    },
    [selectedTasks, scheduleTasksToPeriod],
  )

  const overviewBoxes = useMemo(() => buildOverviewBoxes(wallClock), [wallClock])
  const overviewAssignments = useMemo(
    () => assignTasksToOverviewBoxes(allTasks, overviewBoxes, eventuallyListId),
    [allTasks, overviewBoxes, eventuallyListId],
  )

  const todayKey = formatLocalDateKey(wallClock)
  const currentMonthKey = formatLocalMonthKey(wallClock)
  const currentWeekKey = getCurrentWeek(wallClock)
  const scheduledCount = allTasks.filter(
    (t) => !t.completed && (t.scheduledYear || t.scheduledMonth || t.scheduledWeek || t.scheduledDate),
  ).length

  const addressBase =
    schedulerView === "funnel"
      ? activeTab === "always"
        ? "Funnel \\ Always"
        : `Funnel \\ ${PERIOD_LABEL[activeTab]} \\ ${getNavigationLabel(activeTab, currentDate)}`
      : schedulerView === "gantt"
        ? "Gantt"
        : "Dependencies"
  const address = detail ? `${addressBase} \\ ${detail.title}` : addressBase

  const renderTaskItem = useCallback(
    (
      task: Task,
      opts?: {
        showCheckbox?: boolean
        showUnschedule?: boolean
        fromPeriod?: SchedulePlacementPeriod
        fromValue?: string
      },
    ) => {
      const from =
        opts?.fromPeriod && opts.fromValue
          ? { period: opts.fromPeriod, value: opts.fromValue }
          : undefined
      return (
        <SchedulerTaskItem
          key={task.id}
          task={task}
          color={getCategoryColor(categories, task.lists || [])}
          selected={selectedTasks.has(task.id)}
          showCheckbox={opts?.showCheckbox}
          showUnschedule={opts?.showUnschedule}
          onClick={() => setSelectedTaskId(task.id)}
          onToggleSelect={toggleTaskSelection}
          onUnschedule={() => unscheduleTask(task.id, from)}
          onDragStart={(e, id) => handleDragStart(e, id, from)}
        />
      )
    },
    [categories, selectedTasks, toggleTaskSelection, unscheduleTask, handleDragStart],
  )

  const detailNode =
    detail && detailRows ? (
      <ScheduleCardDetail
        title={detail.title}
        subtitle={
          detail.period === "eventually"
            ? "Held with no period. Dates on a list do not send it here."
            : detailRows.past
              ? "This period is over. Push sends it to the current period. Mark done finishes it here. Dismiss and Unschedule clear this queue and leave it on the Undone list."
              : "Drag here to assign this period. Drop on the list to the left to return it to the broader period."
        }
        rows={detailRows}
        onClose={() => setDetail(null)}
        onDrop={
          detail.period === "eventually"
            ? handleDropEventually
            : (event) => handleDrop(event, detail.period, detail.value)
        }
        renderTaskItem={renderTaskItem}
        grain={detail.period === "eventually" ? undefined : detail.period}
        onPush={(taskId) => {
          const task = useTaskStore.getState().tasks.find((row) => row.id === taskId)
          setPushAsk({ taskId, subject: task ? itemTitleOrUntitled(task) : "Task" })
        }}
        onDismiss={(taskId) => applyDetailAction(taskId, "dismiss")}
        onDone={(taskId) => applyDetailAction(taskId, "done")}
        onUnschedule={(taskId) => applyDetailAction(taskId, "unschedule")}
        listName={detail.period === "eventually" ? undefined : periodTodoListName(detail.period, detail.value)}
        onOpenList={
          detail.period === "eventually"
            ? undefined
            : () => openPeriodTodoList(detail.period, detail.value)
        }
      />
    ) : null

  return (
    <div className="sch95">
      <div className="sch-window">
        <div className="sch-title-bar">
          <div className="sch-mark">
            <img src={orbFor("scheduler")} alt="" className="sch-title-orb" width={22} height={22} />
            <h2>{VIEW_CAPTION[schedulerView]}</h2>
          </div>
          <div className="sch-title-bar-controls" aria-hidden>
            <span className="sch-title-btn">_</span>
            <span className="sch-title-btn">□</span>
          </div>
        </div>

        <div className="sch-toolbar" role="toolbar" aria-label="Scheduler view">
          <span className="sch-label">View</span>
          <div className="sch-view-keys" role="group" aria-label="View mode">
            <button
              type="button"
              className="sch-btn"
              aria-pressed={schedulerView === "funnel"}
              onClick={() => setSchedulerView("funnel")}
            >
              Funnel
            </button>
            <button
              type="button"
              className="sch-btn"
              aria-pressed={schedulerView === "gantt"}
              onClick={() => setSchedulerView("gantt")}
            >
              Gantt
            </button>
            <button
              type="button"
              className="sch-btn"
              aria-pressed={schedulerView === "graph"}
              onClick={() => setSchedulerView("graph")}
            >
              Dependencies
            </button>
          </div>

          {schedulerView === "funnel" && activeTab !== "always" && (
            <div className="sch-period-nav">
              <span className="sch-toolbar-split" aria-hidden />
              <span className="sch-label">Period</span>
              <button
                type="button"
                className="sch-btn sch-btn-icon"
                aria-label="Previous period"
                onClick={() => setCurrentDate(navigateDate(currentDate, activeTab, -1))}
              >
                ◀
              </button>
              <span className="sch-period-nav-label">{getNavigationLabel(activeTab, currentDate)}</span>
              <button
                type="button"
                className="sch-btn sch-btn-icon"
                aria-label="Next period"
                onClick={() => setCurrentDate(navigateDate(currentDate, activeTab, 1))}
              >
                ▶
              </button>
              <button type="button" className="sch-btn" onClick={() => setCurrentDate(new Date())}>
                Today
              </button>
            </div>
          )}
        </div>

        <div className="sch-address">
          <span className="sch-label">Address</span>
          <div className="sch-address-field">{address}</div>
        </div>

        {schedulerView === "funnel" ? (
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as SchedulePeriod)}
            className="sch-funnel"
          >
            <TabsList className="sch-period-tabs">
              <TabsTrigger value="always">Always</TabsTrigger>
              <TabsTrigger value="year">Year</TabsTrigger>
              <TabsTrigger value="quarter">Season</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="day">Day</TabsTrigger>
            </TabsList>

            <div className="sch-body">
              <TabsContent value="always" className="sch-funnel">
                <AlwaysTab
                  availableTasks={availableTasks}
                  selectedCount={selectedTasks.size}
                  onDeselectAll={clearSelection}
                  onRemoveSelectedFromScheduler={removeSelectedFromScheduler}
                  onDeleteSelected={deleteSelected}
                  onMarkCompleteSelected={markCompleteSelected}
                  categories={categories}
                  scheduleableCategoryIds={scheduleableCategoryIds}
                  selectedCategories={selectedCategories}
                  setSelectedCategories={setSelectedCategories}
                  sortBy={sortBy}
                  setSortBy={setSortBy}
                  sortOrder={sortOrder}
                  setSortOrder={setSortOrder}
                  overviewBoxes={overviewBoxes}
                  overviewAssignments={overviewAssignments}
                  onDrop={handleDrop}
                  onDropEventually={handleDropEventually}
                  onCellClick={cellClick}
                  onEventuallyClick={() => {
                    if (selectedTasks.size > 0) placeOnEventually(Array.from(selectedTasks))
                  }}
                  onOpenBox={(box) => {
                    if (box.kind === "eventually") {
                      setDetail({
                        title: box.label,
                        detail: box.detail,
                        period: "eventually",
                        value: "eventually",
                        parent: "always",
                      })
                      return
                    }
                    if (box.period === "always") return
                    setDetail({
                      title: box.label,
                      detail: box.detail,
                      period: box.period,
                      value: box.value,
                      parent: "always",
                    })
                  }}
                  detail={activeTab === "always" ? detailNode : null}
                  onSidebarDrop={handleDropToParent}
                  renderTaskItem={renderTaskItem}
                />
              </TabsContent>

              <TabsContent value="year" className="sch-funnel">
                <PeriodFunnelTab
                  sidebarTitle={`Year ${getCurrentYear(currentDate)}`}
                  sidebarTasks={tasksFor("year", getCurrentYear(currentDate))}
                  selectedCount={selectedTasks.size}
                  onDeselectAll={clearSelection}
                  onDeleteSelected={deleteSelected}
                  onMarkCompleteSelected={markCompleteSelected}
                  cells={getMonths(currentDate)}
                  gridColsClass="cols-3"
                  cellPeriod="month"
                  cellMaxVisible={2}
                  currentKey={currentMonthKey}
                  currentBadgeLabel="Current"
                  isPastCell={(value) => isPastFunnelPeriod("month", value, wallClock)}
                  tasksForCell={(value) => tasksFor("month", value)}
                  onDrop={handleDrop}
                  onCellClick={cellClick}
                  onOpenCell={(cell) =>
                    setDetail({
                      title: cell.label,
                      period: "month",
                      value: cell.value,
                      parent: "year",
                      parentValue: getCurrentYear(currentDate),
                    })
                  }
                  detail={activeTab === "year" ? detailNode : null}
                  onSidebarDrop={handleDropToParent}
                  renderTaskItem={renderTaskItem}
                />
              </TabsContent>

              <TabsContent value="quarter" className="sch-funnel">
                <PeriodFunnelTab
                  sidebarTitle={getNavigationLabel("quarter", currentDate)}
                  sidebarTasks={tasksFor("year", getCurrentYear(currentDate))}
                  selectedCount={selectedTasks.size}
                  onDeselectAll={clearSelection}
                  onDeleteSelected={deleteSelected}
                  onMarkCompleteSelected={markCompleteSelected}
                  cells={quarterMonthCells(currentDate)}
                  gridColsClass="cols-3"
                  cellPeriod="month"
                  cellMaxVisible={3}
                  currentKey={currentMonthKey}
                  currentBadgeLabel="This month"
                  isPastCell={(value) => isPastFunnelPeriod("month", value, wallClock)}
                  tasksForCell={(value) => tasksFor("month", value)}
                  onDrop={handleDrop}
                  onCellClick={cellClick}
                  onOpenCell={(cell) =>
                    setDetail({
                      title: cell.label,
                      period: "month",
                      value: cell.value,
                      parent: "year",
                      parentValue: getCurrentYear(currentDate),
                    })
                  }
                  detail={activeTab === "quarter" ? detailNode : null}
                  onSidebarDrop={handleDropToParent}
                  renderTaskItem={renderTaskItem}
                />
              </TabsContent>

              <TabsContent value="month" className="sch-funnel">
                <PeriodFunnelTab
                  sidebarTitle="Month Tasks"
                  sidebarTasks={tasksFor("month", getCurrentMonth(currentDate))}
                  selectedCount={selectedTasks.size}
                  onDeselectAll={clearSelection}
                  onDeleteSelected={deleteSelected}
                  onMarkCompleteSelected={markCompleteSelected}
                  cells={getWeeksInMonth(getCurrentMonth(currentDate))}
                  gridColsClass="cols-2"
                  cellPeriod="week"
                  cellMaxVisible={2}
                  cellTitlePrefix="Week "
                  currentKey={currentWeekKey}
                  currentBadgeLabel="This Week"
                  isPastCell={(value) => isPastFunnelPeriod("week", value, wallClock)}
                  tasksForCell={(value) => tasksFor("week", value)}
                  onDrop={handleDrop}
                  onCellClick={cellClick}
                  onOpenCell={(cell) =>
                    setDetail({
                      title: `Week ${cell.label}`,
                      period: "week",
                      value: cell.value,
                      parent: "month",
                      parentValue: getCurrentMonth(currentDate),
                    })
                  }
                  detail={activeTab === "month" ? detailNode : null}
                  onSidebarDrop={handleDropToParent}
                  renderTaskItem={renderTaskItem}
                />
              </TabsContent>

              <TabsContent value="week" className="sch-funnel">
                <PeriodFunnelTab
                  sidebarTitle="Week Tasks"
                  sidebarTasks={tasksFor("week", getCurrentWeek(currentDate))}
                  selectedCount={selectedTasks.size}
                  onDeselectAll={clearSelection}
                  onDeleteSelected={deleteSelected}
                  onMarkCompleteSelected={markCompleteSelected}
                  cells={getDaysInWeek(getCurrentWeek(currentDate))}
                  gridColsClass="cols-2"
                  cellPeriod="day"
                  cellMaxVisible={3}
                  currentKey={todayKey}
                  currentBadgeLabel="Today"
                  isPastCell={(value) => isPastFunnelPeriod("day", value, wallClock)}
                  tasksForCell={(value) => tasksFor("day", value)}
                  onDrop={handleDrop}
                  onCellClick={cellClick}
                  onOpenCell={(cell) =>
                    setDetail({
                      title: cell.label,
                      period: "day",
                      value: cell.value,
                      parent: "week",
                      parentValue: getCurrentWeek(currentDate),
                    })
                  }
                  detail={activeTab === "week" ? detailNode : null}
                  onSidebarDrop={handleDropToParent}
                  renderTaskItem={renderTaskItem}
                />
              </TabsContent>

              <TabsContent value="day" className="sch-funnel">
                <DayTab
                  currentDate={currentDate}
                  allTasks={allTasks}
                  dayTasks={tasksFor("day", formatLocalDateKey(currentDate))}
                  onDropHour={(taskId, hour) => scheduleTaskToTime(taskId, currentDate, hour)}
                  onClearTime={clearScheduledTime}
                  onDragStart={handleDragStart}
                  onTaskClick={setSelectedTaskId}
                  onOpenDay={() =>
                    setDetail({
                      title: getNavigationLabel("day", currentDate),
                      period: "day",
                      value: formatLocalDateKey(currentDate),
                      parent: "day",
                      parentValue: formatLocalDateKey(currentDate),
                    })
                  }
                  detail={activeTab === "day" ? detailNode : null}
                  onSidebarDrop={handleDropToParent}
                  renderTaskItem={renderTaskItem}
                />
              </TabsContent>
            </div>
          </Tabs>
        ) : (
          <div className="sch-body">
            {schedulerView === "gantt" && <GanttView tasks={allTasks} onSelectTask={setSelectedTaskId} />}
            {schedulerView === "graph" && <DependencyGraph tasks={allTasks} onSelectTask={setSelectedTaskId} />}
          </div>
        )}

        <div className="sch-status">
          <span>
            {availableTasks.length} available · {scheduledCount} scheduled
          </span>
          <span>
            {schedulerView === "funnel"
              ? detail
                ? `Schedule card · ${detail.title}`
                : `${PERIOD_LABEL[activeTab]} · ${overviewBoxes.length} reserved bucket(s)`
              : schedulerView === "gantt"
                ? "Gantt document"
                : "Dependency document"}
          </span>
        </div>
      </div>

      <TaskDetailPopup taskId={selectedTaskId} open={!!selectedTaskId} onClose={() => setSelectedTaskId(null)} />
      <MissReasonDialog
        open={pushAsk !== null}
        subject={pushAsk?.subject ?? ""}
        onResolve={(reason) => {
          const taskId = pushAsk?.taskId
          setPushAsk(null)
          if (taskId) applyDetailAction(taskId, "push", reason)
        }}
      />
    </div>
  )
}
