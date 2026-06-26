/**
 * components/Scheduler/enhanced-scheduler.tsx — Scheduler period funnel (orchestrator)
 *
 * The progressive-refinement scheduler: a "Scheduler Inbox" of to-schedule tasks
 * plus period buckets (Always → Year → Month → Week → Day). Dragging a task down
 * a level refines its scheduling fields on the task store.
 *
 * Composition:
 *   - scheduler-utils.ts     pure period/filter/grid/overview logic
 *   - SchedulerTaskItem.tsx  draggable task card
 *   - PeriodCell.tsx         droppable bucket cell
 *   - SchedulerFilters.tsx   "Always" filters & sort
 *   - DayAgenda.tsx          24-hour day agenda
 *
 * Spec: §7.1–7.2 (period funnel). Auto-scheduling (§7.6) and carry-over (§7.7)
 * are deferred/not built — see docs/SPEC_MAPPING.md §7.
 */
"use client"

import type React from "react"
import { useState, useCallback, useMemo, useEffect } from "react"
import { useTaskStore } from "@/lib/task-store"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronLeft, ChevronRight, Home, CalendarRange, GanttChartSquare, Workflow } from "lucide-react"
import type { Task, SchedulePeriod } from "@/lib/types"
import { TaskDetailPopup } from "@/components/task-detail-popup"
import { APP_NAV_KEYS, readStoredTab, writeStoredTab } from "@/lib/app-navigation"
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

const SCHEDULER_TABS = ["always", "year", "month", "week", "day"] as const

type SchedulerView = "funnel" | "gantt" | "graph"

export function EnhancedScheduler() {
  const allTasks = useTaskStore((state) => state.tasks)
  const categories = useTaskStore((state) => state.lists)

  const [activeTab, setActiveTab] = useState<SchedulePeriod>(() =>
    readStoredTab(APP_NAV_KEYS.schedulerTab, SCHEDULER_TABS, "always"),
  )
  const [schedulerView, setSchedulerView] = useState<SchedulerView>("funnel")
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<SchedulerSortBy>("importance")
  const [sortOrder, setSortOrder] = useState<SchedulerSortOrder>("desc")

  useEffect(() => {
    writeStoredTab(APP_NAV_KEYS.schedulerTab, activeTab)
  }, [activeTab])

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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Enhanced Scheduler</h2>

        {schedulerView === "funnel" && activeTab !== "always" && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCurrentDate(navigateDate(currentDate, activeTab, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium min-w-[120px] text-center">{getNavigationLabel(activeTab, currentDate)}</span>
            <Button variant="outline" size="icon" onClick={() => setCurrentDate(navigateDate(currentDate, activeTab, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
              <Home className="h-4 w-4 mr-1" />
              Today
            </Button>
          </div>
        )}
      </div>

      <div className="flex gap-1 rounded-md border border-border p-1 w-fit">
        <Button
          variant={schedulerView === "funnel" ? "default" : "ghost"}
          size="sm"
          onClick={() => setSchedulerView("funnel")}
        >
          <CalendarRange className="h-4 w-4 mr-1.5" />
          Funnel
        </Button>
        <Button
          variant={schedulerView === "gantt" ? "default" : "ghost"}
          size="sm"
          onClick={() => setSchedulerView("gantt")}
        >
          <GanttChartSquare className="h-4 w-4 mr-1.5" />
          Gantt
        </Button>
        <Button
          variant={schedulerView === "graph" ? "default" : "ghost"}
          size="sm"
          onClick={() => setSchedulerView("graph")}
        >
          <Workflow className="h-4 w-4 mr-1.5" />
          Dependencies
        </Button>
      </div>

      {schedulerView === "gantt" && <GanttView tasks={allTasks} onSelectTask={setSelectedTaskId} />}
      {schedulerView === "graph" && <DependencyGraph tasks={allTasks} onSelectTask={setSelectedTaskId} />}

      {schedulerView === "funnel" && (
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SchedulePeriod)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="always">Always</TabsTrigger>
          <TabsTrigger value="year">Year</TabsTrigger>
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="day">Day</TabsTrigger>
        </TabsList>

        <TabsContent value="always" className="space-y-4">
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

        <TabsContent value="year" className="space-y-4">
          <PeriodFunnelTab
            sidebarTitle={`Year ${getCurrentYear(currentDate)}`}
            sidebarTasks={tasksFor("year", getCurrentYear(currentDate))}
            cells={getMonths(currentDate)}
            gridColsClass="grid-cols-3"
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

        <TabsContent value="month" className="space-y-4">
          <PeriodFunnelTab
            sidebarTitle="Month Tasks"
            sidebarTasks={tasksFor("month", getCurrentMonth(currentDate))}
            cells={getWeeksInMonth(getCurrentMonth(currentDate))}
            gridColsClass="grid-cols-2"
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

        <TabsContent value="week" className="space-y-4">
          <PeriodFunnelTab
            sidebarTitle="Week Tasks"
            sidebarTasks={tasksFor("week", getCurrentWeek(currentDate))}
            cells={getDaysInWeek(getCurrentWeek(currentDate))}
            gridColsClass="grid-cols-2"
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

        <TabsContent value="day" className="space-y-4">
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
      </Tabs>
      )}

      <TaskDetailPopup taskId={selectedTaskId} open={!!selectedTaskId} onClose={() => setSelectedTaskId(null)} />
    </div>
  )
}
