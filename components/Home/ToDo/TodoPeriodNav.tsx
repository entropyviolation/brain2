/**
 * components/Home/ToDo/TodoPeriodNav.tsx — Date navigation for To-Do periods
 *
 * Prev / Today / Next controls shared by day, week, and month tabs.
 */
"use client"

import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { navigateDate } from "@/components/Scheduler/scheduler-utils"
import { getPeriodNavLabel, isCurrentPeriod, type TodoPeriod } from "./todo-utils"

export function TodoPeriodNav({
  period,
  focusedDate,
  onFocusedDateChange,
}: {
  period: TodoPeriod
  focusedDate: Date
  onFocusedDateChange: (date: Date) => void
}) {
  const atCurrent = isCurrentPeriod(period, focusedDate)

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        title="Previous"
        onClick={() => onFocusedDateChange(navigateDate(focusedDate, period, -1))}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-8"
        disabled={atCurrent}
        onClick={() => onFocusedDateChange(new Date())}
      >
        <Calendar className="h-3.5 w-3.5 mr-1.5" />
        Today
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        title="Next"
        onClick={() => onFocusedDateChange(navigateDate(focusedDate, period, 1))}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <span className="text-sm font-medium text-muted-foreground ml-1">{getPeriodNavLabel(period, focusedDate)}</span>
    </div>
  )
}
