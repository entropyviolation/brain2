/**
 * components/Scheduler/AlwaysTab.tsx — "Always" tab (inbox + overview)
 *
 * The default Scheduler view: a filterable/sortable list of available (to-
 * schedule) tasks on the left and the period overview boxes (This Year …
 * Tomorrow) on the right, each a droppable bucket showing its most-specific
 * tasks.
 */
"use client"

import type React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CalendarOff } from "lucide-react"
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
    <div className="grid grid-cols-4 gap-6">
      <div className="col-span-1">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Available Tasks
              {selectedCount > 0 && <Badge variant="secondary">{selectedCount} selected</Badge>}
            </CardTitle>
            {selectedCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={onRemoveSelectedFromScheduler}
              >
                <CalendarOff className="h-4 w-4 mr-2" />
                Remove from Scheduler
              </Button>
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
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {availableTasks.map((task) => renderTaskItem(task, { showCheckbox: true }))}
          </CardContent>
        </Card>
      </div>

      <div className="col-span-3">
        <p className="text-xs text-muted-foreground mb-2">
          Each task appears once, in its most specific period (day → week → month → year).
        </p>
        <div className="grid grid-cols-2 gap-4">
          {overviewBoxes.map((box) => (
            <PeriodCell
              key={box.label}
              title={box.label}
              badge={
                <Badge variant="outline" className="text-xs font-normal">
                  {(overviewAssignments[box.label] || []).length}
                </Badge>
              }
              tasks={overviewAssignments[box.label] || []}
              maxVisible={3}
              emptyText="Empty"
              onDrop={(e) => onDrop(e, box.period, box.value)}
              onClick={() => onCellClick(box.period, box.value)}
              renderTaskItem={(task) => renderTaskItem(task, { showUnschedule: true })}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
