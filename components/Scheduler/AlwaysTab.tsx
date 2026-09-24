/**
 * components/Scheduler/AlwaysTab.tsx — Always period (inbox + drop cards)
 *
 * Filterable available-task list on the left. The right side is two columns
 * of drop cards (This Year … Tomorrow, plus Eventually / Later). Today and
 * Tomorrow show the real calendar date. Drag or click still schedules.
 * Selection tools: Deselect all, Remove from Scheduler, Delete, Mark complete.
 */
"use client"

import type React from "react"
import type { Task, SchedulePeriod, List } from "@/lib/types"
import { PeriodCell } from "./PeriodCell"
import { SchedulerFilters } from "./SchedulerFilters"
import type { OverviewBox, SchedulerSortBy, SchedulerSortOrder } from "./scheduler-utils"

export function AlwaysTab({
  availableTasks,
  selectedCount,
  onDeselectAll,
  onRemoveSelectedFromScheduler,
  onDeleteSelected,
  onMarkCompleteSelected,
  categories,
  scheduleableCategoryIds,
  selectedCategories,
  setSelectedCategories,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  overviewBoxes,
  overviewAssignments,
  onDrop,
  onDropEventually,
  onCellClick,
  onEventuallyClick,
  renderTaskItem,
}: {
  availableTasks: Task[]
  selectedCount: number
  onDeselectAll: () => void
  onRemoveSelectedFromScheduler: () => void
  onDeleteSelected: () => void
  onMarkCompleteSelected: () => void
  categories: List[]
  scheduleableCategoryIds: Set<string>
  selectedCategories: string[]
  setSelectedCategories: (ids: string[]) => void
  sortBy: SchedulerSortBy
  setSortBy: (v: SchedulerSortBy) => void
  sortOrder: SchedulerSortOrder
  setSortOrder: (v: SchedulerSortOrder) => void
  overviewBoxes: OverviewBox[]
  overviewAssignments: Record<string, Task[]>
  onDrop: (e: React.DragEvent, period: SchedulePeriod, value: string) => void
  onDropEventually: (e: React.DragEvent) => void
  onCellClick: (period: SchedulePeriod, value: string) => void
  onEventuallyClick: () => void
  renderTaskItem: (task: Task, opts?: { showCheckbox?: boolean; showUnschedule?: boolean }) => React.ReactNode
}) {
  return (
    <div className="sch-split">
      <aside className="sch-pane">
        <div className="sch-pane-head">
          Available Tasks
          {selectedCount > 0 && <span>{selectedCount} selected</span>}
        </div>
        <div className="sch-pane-tools">
          {selectedCount > 0 && (
            <div className="sch-selection-actions">
              <button type="button" className="sch-btn" onClick={onDeselectAll}>
                Deselect all
              </button>
              <button type="button" className="sch-btn" onClick={onRemoveSelectedFromScheduler}>
                Remove from Scheduler
              </button>
              <button type="button" className="sch-btn sch-btn-delete" onClick={onDeleteSelected}>
                Delete
              </button>
              <button type="button" className="sch-btn" onClick={onMarkCompleteSelected}>
                Mark complete
              </button>
            </div>
          )}
          <SchedulerFilters
            categories={categories}
            scheduleableCategoryIds={scheduleableCategoryIds}
            selectedCategories={selectedCategories}
            setSelectedCategories={setSelectedCategories}
            sortBy={sortBy}
            setSortBy={setSortBy}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
          />
        </div>
        <div className="sch-pane-body">
          {availableTasks.length === 0 ? (
            <p className="sch-vacant">0 available</p>
          ) : (
            availableTasks.map((task) => renderTaskItem(task, { showCheckbox: true }))
          )}
        </div>
      </aside>

      <div className="sch-always-board">
        <p className="sch-hint">
          Drag onto a card. Today and Tomorrow use the real date. An unfinished Today returns here the next day
          unless you push it forward. Eventually / Later files it on the eventually list, with no period.
        </p>
        <div className="sch-bucket-grid cols-2 sch-always-cards">
          {overviewBoxes.map((box) => {
            const eventually = box.kind === "eventually"
            return (
              <PeriodCell
                key={box.label}
                variant="card"
                title={box.label}
                detail={box.detail}
                hint={
                  eventually
                    ? "Adds the task to the Next Actions list “eventually”. No year, month, week, or day is set."
                    : box.period === "day"
                      ? `Schedules this task for ${box.detail ?? box.value}.`
                      : `Schedules this task for ${box.label}.`
                }
                tasks={overviewAssignments[box.label] || []}
                maxVisible={3}
                emptyText="Empty"
                onDrop={(e) => (eventually ? onDropEventually(e) : onDrop(e, box.period, box.value))}
                onClick={() => (eventually ? onEventuallyClick() : onCellClick(box.period, box.value))}
                renderTaskItem={(task) => renderTaskItem(task, { showUnschedule: true })}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
