/**
 * components/Scheduler/PeriodFunnelTab.tsx — Generic funnel tab (year/month/week)
 *
 * The shared layout for the Year/Month/Week tabs: a sidebar list of tasks at the
 * parent period plus a grid of droppable child-period cells. The Always and Day
 * tabs are bespoke and live in the orchestrator.
 */
"use client"

import type React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
    <div className="grid grid-cols-4 gap-6">
      <div className="col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>{sidebarTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {sidebarTasks.map((task) => renderTaskItem(task, { showCheckbox: true, showUnschedule: true }))}
          </CardContent>
        </Card>
      </div>

      <div className="col-span-3">
        <div className={`grid ${gridColsClass} gap-4`}>
          {cells.map((cell) => {
            const isCurrent = cell.value === currentKey
            return (
              <PeriodCell
                key={cell.value}
                title={`${cellTitlePrefix}${cell.label}`}
                isCurrent={isCurrent}
                badge={
                  isCurrent ? (
                    <Badge variant="default" className="text-[10px] px-1.5 py-0">
                      {currentBadgeLabel}
                    </Badge>
                  ) : undefined
                }
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
    </div>
  )
}
