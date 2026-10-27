/**
 * components/Home/ToDo/desk/todo-desk-panel.tsx — Desktop To Do
 *
 * The milled fascia from 768px up. Not mounted on a phone. Composes the fascia,
 * the period sheets, the season list, the status bar, and the dove plate.
 * `todo-chrome.css` loads with this module. The door imports it statically.
 */
"use client"

import { orbFor } from "@/components/Icons"
import { seasonOfDate, seasonSlug, quarterLabel } from "@/lib/seasons"
import { completeTask } from "@/lib/services/completion-service"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { isPastTodoPeriod, countInProgress } from "../todo-utils"
import { todoTitle } from "../ranges/todo-ranges"
import { PriorityFormulaPanel } from "../fascia/PriorityFormulaPanel"
import { TodoRangeSheet } from "../ranges/TodoRangeSheet"
import "../todo-chrome.css"
import type { TodoTab } from "./todo-desk-constants"
import { useTodoDesk } from "./use-todo-desk"
import { TodoDeskFascia } from "./todo-desk-fascia"
import { TodoPeriodSheet } from "./todo-period-sheet"
import { TodoSeasonSheet } from "./todo-season-sheet"
import { TodoDeskStatus } from "./todo-desk-status"
import { TodoDeskOverlays } from "./todo-desk-overlays"
import { activeFilterCount, headerLoadReadout, openTodoCount, periodLoad } from "./todo-period-figures"

/** The milled fascia. Not mounted on a phone. */
export function TodoDeskPanel({
  currentDate: controlledDate,
  setCurrentDate: setControlledDate,
}: {
  currentDate?: Date
  setCurrentDate?: (date: Date) => void
} = {}) {
  const desk = useTodoDesk(controlledDate, setControlledDate)
  const seasonLabel = desk.season ? quarterLabel(desk.season.seasonKey) : ""
  const activeRange = desk.todoRanges.find((r) => r.range.id === desk.todoPrefs.activeRangeId) ?? desk.todoRanges[0]
  const todoHeading = todoTitle(desk.activeTodoTab, desk.focusedDate, desk.todoPrefs, activeRange?.name)
  const periodLabel =
    desk.periodTab === "quarter"
      ? "Season view"
      : desk.periodTab === "day"
        ? "Day view"
        : desk.periodTab === "week"
          ? "Week view"
          : "Month view"
  const viewingPast = desk.periodTab === "quarter" ? false : isPastTodoPeriod(desk.periodTab, desk.focusedDate)
  const undoneIds =
    desk.periodTab === "quarter"
      ? new Set<string>()
      : new Set(desk.undoneByPeriod[desk.periodTab].map((todo) => todo.taskId ?? todo.id))
  const openCount = openTodoCount({
    activeTodoTab: desk.activeTodoTab,
    periodTab: desk.periodTab,
    activeRange,
    tasks: desk.tasks,
    seasonOpenLength: desk.season?.seasonOpen.length ?? 0,
    viewingPast,
    filtered: desk.periodTab === "quarter" ? [] : desk.filteredByPeriod[desk.periodTab],
    undoneIds,
  })
  const undoneCount = desk.periodTab === "quarter" ? 0 : desk.undoneByPeriod[desk.periodTab].length
  const inProgressCount = countInProgress(desk.tasks)
  const stripShown = desk.activeTodoTab !== "other" && desk.periodTab !== "quarter"
  const filtersOn = activeFilterCount({
    availableNow: desk.availableNow,
    showAllTasks: desk.showAllTasks,
    hideLocked: desk.hideLocked,
    showNextOnly: desk.showNextOnly,
    tierView: desk.tierView,
    statusFilter: desk.statusFilter,
  })
  // One phosphor line in the header glass: working hours left · estimate · comfort word.
  const headerLoad = (() => {
    if (desk.activeTodoTab === "other") return null
    const figures =
      desk.periodTab === "quarter"
        ? desk.season
          ? { minutes: desk.season.seasonEstimate.minutes, hours: desk.season.seasonHours, ratio: desk.season.seasonRatio, band: desk.season.seasonBand }
          : null
        : (() => {
            const load = periodLoad({
              period: desk.periodTab,
              focusedDate: desk.focusedDate,
              undoneTodos: desk.undoneByPeriod[desk.periodTab],
              filteredTodos: desk.filteredByPeriod[desk.periodTab],
              tasks: desk.tasks,
              morningPriorities: desk.morningPriorities,
              estimateScope: desk.estimateScope,
            })
            return { minutes: load.estimate.minutes, hours: load.hours, ratio: load.ratio, band: load.band }
          })()
    return headerLoadReadout(figures, inProgressCount, desk.wipLimit)
  })()

  return (
    <div
      className="todo95"
      data-ui-name="To Do"
      data-ui-help="Day, week, month, and season tasks. Season lists work scheduled in that quarter."
      data-season={desk.periodTab === "quarter" ? seasonSlug(seasonOfDate(desk.focusedDate)) : undefined}
      data-ui-docs="components/Home/ToDo/README.md"
    >
      {desk.clockStop.dialog}
      <div className="todo-window">
        <Tabs
          value={desk.activeTodoTab}
          className="todo-tabs"
          onValueChange={(v) => {
            const next = v as TodoTab
            if (next === desk.activeTodoTab) return
            desk.setActiveTodoTab(next)
            desk.setOpenRowId(null)
            desk.setSelectedRowId(null)
            // One search box and one formula panel serve every lens; neither follows you to the next one.
            desk.setAssignedQuery("")
            desk.setShowFormula(false)
            if (desk.prefersReduced()) return
            desk.setPeriodFolding(true)
            desk.later(() => desk.setPeriodFolding(false), 180)
          }}
        >
          <TodoDeskFascia
            desk={desk}
            todoHeading={todoHeading}
            openCount={openCount}
            headerLoad={headerLoad}
            inProgressCount={inProgressCount}
            seasonLabel={seasonLabel}
            activeFilterCount={filtersOn}
            stripShown={stripShown}
          />

          {desk.showFormula && desk.activeTodoTab !== "other" && desk.periodTab !== "quarter" && <PriorityFormulaPanel />}

          <div className="todo-stage">
            <div className="todo-body">
              <TabsContent value="day">{desk.periodTab === "day" ? <TodoPeriodSheet period="day" desk={desk} ref={desk.sheetScrollRef} /> : null}</TabsContent>
              <TabsContent value="week">{desk.periodTab === "week" ? <TodoPeriodSheet period="week" desk={desk} ref={desk.sheetScrollRef} /> : null}</TabsContent>
              <TabsContent value="month">{desk.periodTab === "month" ? <TodoPeriodSheet period="month" desk={desk} ref={desk.sheetScrollRef} /> : null}</TabsContent>
              <TabsContent value="other">
                {desk.activeTodoTab === "other" ? (
                  <TodoRangeSheet onOpenTask={desk.openTask} onComplete={(id) => completeTask(id)} />
                ) : null}
              </TabsContent>
              <TabsContent value="quarter">
                {desk.season ? <TodoSeasonSheet desk={desk} /> : null}
              </TabsContent>
            </div>
          </div>
        </Tabs>

        <TodoDeskStatus
          desk={desk}
          periodLabel={periodLabel}
          seasonLabel={seasonLabel}
          activeRangeName={activeRange?.name}
          openCount={openCount}
          viewingPast={viewingPast}
          undoneCount={undoneCount}
        />
      </div>

      <div
        className="todo-desk-plate"
        data-desk-plate="todo"
        aria-hidden="true"
        data-ui-name="To Do plate"
        data-ui-help="The dove under the window."
        data-ui-docs="components/Home/ToDo/README.md"
        data-ui-docs-anchor="instrument-layout"
      >
        <img src={orbFor("home-todo")} alt="" draggable={false} />
      </div>

      <TodoDeskOverlays desk={desk} />
    </div>
  )
}
