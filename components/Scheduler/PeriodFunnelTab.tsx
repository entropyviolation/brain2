/**
 * components/Scheduler/PeriodFunnelTab.tsx — Generic funnel period (year/month/week)
 *
 * Sidebar of tasks at the parent period plus reserved child-period rows.
 * Empty cells stay one-line furniture; occupied rows open to show work.
 */
"use client"

import type React from "react"
import type { Task, SchedulePeriod } from "@/lib/types"
import { PeriodCell } from "./PeriodCell"

export interface FunnelCell {
  value: string
  label: string
}

export function PeriodFunnelTab({
  sidebarTitle,
  sidebarTasks,
  cells,
  gridColsClass,
  cellPeriod,
  cellMaxVisible,
  cellTitlePrefix = "",
  currentKey,
  currentBadgeLabel,
  tasksForCell,
  onDrop,
  onCellClick,
  renderTaskItem,
}: {
  sidebarTitle: string
  sidebarTasks: Task[]
  cells: FunnelCell[]
  gridColsClass: string
  cellPeriod: SchedulePeriod
  cellMaxVisible: number
  cellTitlePrefix?: string
  currentKey: string
  currentBadgeLabel: string
  tasksForCell: (value: string) => Task[]
  onDrop: (e: React.DragEvent, period: SchedulePeriod, value: string) => void
  onCellClick: (period: SchedulePeriod, value: string) => void
  renderTaskItem: (task: Task, opts?: { showCheckbox?: boolean; showUnschedule?: boolean }) => React.ReactNode
}) {
  return (
    <div className="sch-split">
      <aside className="sch-pane">
        <div className="sch-pane-head">{sidebarTitle}</div>
        <div className="sch-pane-body">
          {sidebarTasks.length === 0 ? (
            <p className="sch-vacant">0 at this period</p>
          ) : (
            sidebarTasks.map((task) => renderTaskItem(task, { showCheckbox: true, showUnschedule: true }))
          )}
        </div>
      </aside>

      <div className={`sch-bucket-grid ${gridColsClass}`}>
        {cells.map((cell) => {
          const isCurrent = cell.value === currentKey
          return (
            <PeriodCell
              key={cell.value}
              title={`${cellTitlePrefix}${cell.label}`}
              isCurrent={isCurrent}
              badge={isCurrent ? <span className="sch-bucket-badge">{currentBadgeLabel}</span> : undefined}
              tasks={tasksForCell(cell.value)}
              maxVisible={cellMaxVisible}
              onDrop={(e) => onDrop(e, cellPeriod, cell.value)}
              onClick={() => onCellClick(cellPeriod, cell.value)}
              renderTaskItem={(task) => renderTaskItem(task, { showUnschedule: true })}
            />
          )
        })}
      </div>
    </div>
  )
}
