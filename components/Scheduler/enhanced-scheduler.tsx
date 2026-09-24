/**
 * components/Scheduler/enhanced-scheduler.tsx — Scheduler period funnel (orchestrator)
 *
 * Progressive refinement: a Scheduler inbox plus Always → Year → Month → Week →
 * Day buckets. Dragging a task down a level refines its scheduling fields.
 * Funnel / Gantt / Dependencies are view modes on the toolbar; Always→Day are
 * period folder tabs — different chrome.
 *
 * Spec: §7.1–7.2 (period funnel). Auto-scheduling (§7.6) and carry-over (§7.7)
 * are deferred.
 */
"use client"

import type React from "react"
import { useState, useCallback, useMemo, useEffect } from "react"
import { useTaskStore } from "@/lib/task-store"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Task, SchedulePeriod } from "@/lib/types"
import { TaskDetailPopup } from "@/components/ItemDetail/ItemDetailPopup"
import { APP_NAV_KEYS, SCHEDULER_VIEWS, type SchedulerViewMode, readStoredDate, writeStoredDate, readStoredTab, writeStoredTab } from "@/lib/app-navigation"
import { usePersistedTab } from "@/lib/use-persisted-tab"
import { orbFor } from "@/components/Icons"
import {
  scheduleTask as scheduleTaskSvc,
  unscheduleTask as unscheduleTaskSvc,
  scheduleTaskToTime,
  clearScheduledTime,
  setTaskScheduleable as setTaskScheduleableSvc,
} from "@/lib/services/scheduling-service"
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
  getWeeksInMonth,
  getDaysInWeek,
  buildOverviewBoxes,
  assignTasksToOverviewBoxes,
  type SchedulerSortBy,
  type SchedulerSortOrder,
} from "./scheduler-utils"
import { SchedulerTaskItem } from "./SchedulerTaskItem"
import { PeriodFunnelTab } from "./PeriodFunnelTab"
import { AlwaysTab } from "./AlwaysTab"
import { DayTab } from "./DayTab"
import { GanttView } from "./GanttView"
import { DependencyGraph } from "./DependencyGraph"
import "./scheduler-chrome.css"

const SCHEDULER_TABS = ["always", "year", "month", "week", "day"] as const
const PERIOD_LABEL: Record<(typeof SCHEDULER_TABS)[number], string> = {
  always: "Always",
  year: "Year",
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

export function EnhancedScheduler() {
  const allTasks = useTaskStore((state) => state.tasks)
  const categories = useTaskStore((state) => state.lists)

  const [activeTab, setActiveTab] = usePersistedTab(APP_NAV_KEYS.schedulerTab, SCHEDULER_TABS, "always")
  const [schedulerView, setSchedulerView] = useState<SchedulerView>(() =>
    readStoredTab(APP_NAV_KEYS.schedulerView, SCHEDULER_VIEWS, "funnel"),
  )
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())
  const [currentDate, setCurrentDate] = useState(() => readStoredDate(APP_NAV_KEYS.schedulerDate) ?? new Date())
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<SchedulerSortBy>("importance")
  const [sortOrder, setSortOrder] = useState<SchedulerSortOrder>("desc")

  useEffect(() => {
    writeStoredTab(APP_NAV_KEYS.schedulerView, schedulerView)
  }, [schedulerView])

  useEffect(() => {
    writeStoredDate(APP_NAV_KEYS.schedulerDate, currentDate)
  }, [currentDate])

  const scheduleableCategoryIds = useMemo(() => getScheduleableCategoryIds(categories), [categories])

  const availableTasks = useMemo(
    () =>
      getAvailableTasks(allTasks, {
        activeTab,
        selectedCategories,
        sortBy,
        sortOrder,
        lists: categories,
        scheduleableCategoryIds,
      }),
    [allTasks, activeTab, selectedCategories, sortBy, sortOrder, categories, scheduleableCategoryIds],
  )

  const tasksFor = useCallback(
    (period: SchedulePeriod, value?: string) => getTasksForPeriod(allTasks, period, value, currentDate),
    [allTasks, currentDate],
  )

  const scheduleTasksToPeriod = useCallback((taskIds: string[], period: SchedulePeriod, value: string) => {
    taskIds.forEach((taskId) => scheduleTaskSvc(taskId, period, value))
    setSelectedTasks(new Set())
  }, [])

  const unscheduleTask = useCallback((taskId: string) => {
    unscheduleTaskSvc(taskId)
  }, [])

  const removeSelectedFromScheduler = useCallback(() => {
    selectedTasks.forEach((taskId) => setTaskScheduleableSvc(taskId, false))
    setSelectedTasks(new Set())
  }, [selectedTasks])

  const toggleTaskSelection = useCallback((taskId: string) => {
    setSelectedTasks((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }, [])

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("taskId", taskId)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, period: SchedulePeriod, value: string) => {
      e.preventDefault()
      const taskId = e.dataTransfer.getData("taskId")
      if (taskId) scheduleTasksToPeriod([taskId], period, value)
    },
    [scheduleTasksToPeriod],
  )

  const cellClick = useCallback(
    (period: SchedulePeriod, value: string) => {
      if (selectedTasks.size > 0) scheduleTasksToPeriod(Array.from(selectedTasks), period, value)
    },
    [selectedTasks, scheduleTasksToPeriod],
  )

  const overviewBoxes = useMemo(() => buildOverviewBoxes(currentDate), [currentDate])
  const overviewAssignments = useMemo(
    () => assignTasksToOverviewBoxes(allTasks, overviewBoxes),
    [allTasks, overviewBoxes],
  )

  const todayKey = new Date().toISOString().slice(0, 10)
  const currentMonthKey = new Date().toISOString().slice(0, 7)
  const currentWeekKey = getCurrentWeek(new Date())
  const scheduledCount = allTasks.filter(
    (t) => !t.completed && (t.scheduledYear || t.scheduledMonth || t.scheduledWeek || t.scheduledDate),
  ).length

  const address =
    schedulerView === "funnel"
      ? activeTab === "always"
        ? "Funnel \\ Always"
        : `Funnel \\ ${PERIOD_LABEL[activeTab]} \\ ${getNavigationLabel(activeTab, currentDate)}`
      : schedulerView === "gantt"
        ? "Gantt"
        : "Dependencies"

  const renderTaskItem = useCallback(
    (task: Task, opts?: { showCheckbox?: boolean; showUnschedule?: boolean }) => (
      <SchedulerTaskItem
        key={task.id}
        task={task}
        color={getCategoryColor(categories, task.lists || [])}
        selected={selectedTasks.has(task.id)}
        showCheckbox={opts?.showCheckbox}
        showUnschedule={opts?.showUnschedule}
        onClick={() => setSelectedTaskId(task.id)}
        onToggleSelect={toggleTaskSelection}
        onUnschedule={unscheduleTask}
        onDragStart={handleDragStart}
      />
    ),
    [categories, selectedTasks, toggleTaskSelection, unscheduleTask, handleDragStart],
  )

  return (
    <div className="sch95">
      <div className="sch-window">
        <div className="sch-title-bar">
          <img src={orbFor("scheduler")} alt="" className="sch-title-orb" width={16} height={16} />
          <h2>{VIEW_CAPTION[schedulerView]}</h2>
          <div className="sch-title-bar-controls" aria-hidden>
            <span className="sch-title-btn">_</span>
            <span className="sch-title-btn">□</span>
          </div>
        </div>

        <div className="sch-toolbar" role="toolbar" aria-label="Scheduler view">
          <span className="sch-label">View</span>
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
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="day">Day</TabsTrigger>
            </TabsList>

            <div className="sch-body">
              <TabsContent value="always" className="sch-funnel">
                <AlwaysTab
                  availableTasks={availableTasks}
                  selectedCount={selectedTasks.size}
                  onRemoveSelectedFromScheduler={removeSelectedFromScheduler}
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
                  onCellClick={cellClick}
                  renderTaskItem={renderTaskItem}
                />
              </TabsContent>

              <TabsContent value="year" className="sch-funnel">
                <PeriodFunnelTab
                  sidebarTitle={`Year ${getCurrentYear(currentDate)}`}
                  sidebarTasks={tasksFor("year", getCurrentYear(currentDate))}
                  cells={getMonths(currentDate)}
                  gridColsClass="cols-3"
                  cellPeriod="month"
                  cellMaxVisible={2}
                  currentKey={currentMonthKey}
                  currentBadgeLabel="Current"
                  tasksForCell={(value) => tasksFor("month", value)}
                  onDrop={handleDrop}
                  onCellClick={cellClick}
                  renderTaskItem={renderTaskItem}
                />
              </TabsContent>

              <TabsContent value="month" className="sch-funnel">
                <PeriodFunnelTab
                  sidebarTitle="Month Tasks"
                  sidebarTasks={tasksFor("month", getCurrentMonth(currentDate))}
                  cells={getWeeksInMonth(getCurrentMonth(currentDate))}
                  gridColsClass="cols-2"
                  cellPeriod="week"
                  cellMaxVisible={2}
                  cellTitlePrefix="Week "
                  currentKey={currentWeekKey}
                  currentBadgeLabel="This Week"
                  tasksForCell={(value) => tasksFor("week", value)}
                  onDrop={handleDrop}
                  onCellClick={cellClick}
                  renderTaskItem={renderTaskItem}
                />
              </TabsContent>

              <TabsContent value="week" className="sch-funnel">
                <PeriodFunnelTab
                  sidebarTitle="Week Tasks"
                  sidebarTasks={tasksFor("week", getCurrentWeek(currentDate))}
                  cells={getDaysInWeek(getCurrentWeek(currentDate))}
                  gridColsClass="cols-2"
                  cellPeriod="day"
                  cellMaxVisible={3}
                  currentKey={todayKey}
                  currentBadgeLabel="Today"
                  tasksForCell={(value) => tasksFor("day", value)}
                  onDrop={handleDrop}
                  onCellClick={cellClick}
                  renderTaskItem={renderTaskItem}
                />
              </TabsContent>

              <TabsContent value="day" className="sch-funnel">
                <DayTab
                  currentDate={currentDate}
                  allTasks={allTasks}
                  dayTasks={tasksFor("day", currentDate.toISOString().slice(0, 10))}
                  onDropHour={(taskId, hour) => scheduleTaskToTime(taskId, currentDate, hour)}
                  onClearTime={clearScheduledTime}
                  onDragStart={handleDragStart}
                  onTaskClick={setSelectedTaskId}
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
              ? `${PERIOD_LABEL[activeTab]} · ${overviewBoxes.length} reserved bucket(s)`
              : schedulerView === "gantt"
                ? "Gantt document"
                : "Dependency document"}
          </span>
        </div>
      </div>

      <TaskDetailPopup taskId={selectedTaskId} open={!!selectedTaskId} onClose={() => setSelectedTaskId(null)} />
    </div>
  )
}
