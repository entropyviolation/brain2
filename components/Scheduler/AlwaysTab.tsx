/**
 * components/Scheduler/AlwaysTab.tsx — Always period (inbox + reserved buckets)
 *
 * Filterable available-task list on the left; This Year … Tomorrow stay as
 * reserved one-line furniture on the right. Drag into a row still schedules.
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
  onRemoveSelectedFromScheduler,
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
  onCellClick,
  renderTaskItem,
}: {
  availableTasks: Task[]
  selectedCount: number
  onRemoveSelectedFromScheduler: () => void
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
  onCellClick: (period: SchedulePeriod, value: string) => void
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
            <button type="button" className="sch-btn" onClick={onRemoveSelectedFromScheduler}>
              Remove from Scheduler
            </button>
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

      <div className="sch-pane">
        <div className="sch-pane-head">Period buckets</div>
        <div className="sch-pane-body">
          <p className="sch-hint">
            Each task appears once, in its most specific period (day → week → month → year).
          </p>
          <div className="sch-bucket-list">
            {overviewBoxes.map((box) => (
              <PeriodCell
                key={box.label}
                title={box.label}
                tasks={overviewAssignments[box.label] || []}
                maxVisible={3}
                onDrop={(e) => onDrop(e, box.period, box.value)}
                onClick={() => onCellClick(box.period, box.value)}
                renderTaskItem={(task) => renderTaskItem(task, { showUnschedule: true })}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
