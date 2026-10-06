/**
 * components/Scheduler/PeriodFunnelTab.tsx — Generic funnel period (year/month/week)
 *
 * Sidebar of tasks at the parent period plus reserved child-period rows.
 * Empty cells stay one-line furniture; occupied rows open to show work.
 * Past child periods are grayed (`isPastCell`). The cell title opens that
 * period across this grid. Drop on the sidebar returns the task to the
 * parent period. Shares the orchestrator selection; Deselect / Delete /
 * Mark complete when checked.
 */
"use client"

import type React from "react"
import type { Task, SchedulePeriod, SchedulePlacementPeriod } from "@/lib/types"
import { PeriodCell } from "./PeriodCell"

export interface FunnelCell {
  value: string
  label: string
}

export type SchedulerTaskItemOpts = {
  showCheckbox?: boolean
  showUnschedule?: boolean
  fromPeriod?: SchedulePlacementPeriod
  fromValue?: string
}

export function PeriodFunnelTab({
  sidebarTitle,
  sidebarTasks,
  selectedCount,
  onDeselectAll,
  onDeleteSelected,
  onMarkCompleteSelected,
  cells,
  gridColsClass,
  cellPeriod,
  cellMaxVisible,
  cellTitlePrefix = "",
  currentKey,
  currentBadgeLabel,
  isPastCell,
  tasksForCell,
  onDrop,
  onCellClick,
  onOpenCell,
  detail,
  onSidebarDrop,
  renderTaskItem,
}: {
  sidebarTitle: string
  sidebarTasks: Task[]
  selectedCount: number
  onDeselectAll: () => void
  onDeleteSelected: () => void
  onMarkCompleteSelected: () => void
  cells: FunnelCell[]
  gridColsClass: string
  cellPeriod: SchedulePeriod
  cellMaxVisible: number
  cellTitlePrefix?: string
  currentKey: string
  currentBadgeLabel: string
  /** True when the cell's period is already over (local calendar). */
  isPastCell?: (value: string) => boolean
  tasksForCell: (value: string) => Task[]
  onDrop: (e: React.DragEvent, period: SchedulePeriod, value: string) => void
  onCellClick: (period: SchedulePeriod, value: string) => void
  onOpenCell: (cell: FunnelCell) => void
  detail?: React.ReactNode
  onSidebarDrop?: (e: React.DragEvent) => void
  renderTaskItem: (task: Task, opts?: SchedulerTaskItemOpts) => React.ReactNode
}) {
  return (
    <div className="sch-split">
      <aside
        className="sch-pane"
        onDragOver={detail ? (e) => e.preventDefault() : undefined}
        onDrop={detail ? onSidebarDrop : undefined}
      >
        <div className="sch-pane-head">
          {sidebarTitle}
          {detail && <span>Drop here to return</span>}
          {selectedCount > 0 && <span>{selectedCount} selected</span>}
        </div>
        {selectedCount > 0 && (
          <div className="sch-pane-tools">
            <div className="sch-selection-actions">
              <button type="button" className="sch-btn" onClick={onDeselectAll}>
                Deselect all
              </button>
              <button type="button" className="sch-btn sch-btn-delete" onClick={onDeleteSelected}>
                Delete
              </button>
              <button type="button" className="sch-btn" onClick={onMarkCompleteSelected}>
                Mark complete
              </button>
            </div>
          </div>
        )}
        <div className="sch-pane-body">
          {sidebarTasks.length === 0 ? (
            <p className="sch-vacant">0 at this period</p>
          ) : (
            sidebarTasks.map((task) => renderTaskItem(task, { showCheckbox: true, showUnschedule: true }))
          )}
        </div>
      </aside>

      {detail ?? <div className={`sch-bucket-grid ${gridColsClass}`}>
        {cells.map((cell) => {
          const isCurrent = cell.value === currentKey
          const isPast = isPastCell?.(cell.value) ?? false
          return (
            <PeriodCell
              key={cell.value}
              title={`${cellTitlePrefix}${cell.label}`}
              isCurrent={isCurrent}
              isPast={isPast}
              badge={isCurrent ? <span className="sch-bucket-badge">{currentBadgeLabel}</span> : undefined}
              tasks={tasksForCell(cell.value)}
              maxVisible={cellMaxVisible}
              onDrop={(e) => onDrop(e, cellPeriod, cell.value)}
              onClick={() => onCellClick(cellPeriod, cell.value)}
              onOpenDetail={() => onOpenCell(cell)}
              renderTaskItem={(task) =>
                renderTaskItem(task, {
                  showUnschedule: true,
                  fromPeriod: cellPeriod === "always" ? undefined : (cellPeriod as SchedulePlacementPeriod),
                  fromValue: cell.value,
                })
              }
            />
          )
        })}
      </div>}
    </div>
  )
}
