/**
 * Smart-parse chips on the walk sheet and on each inbox row.
 * Date, time, duration, priority, and list stay visible while clarifying.
 */
"use client"

import { Badge } from "@/components/ui/badge"
import { useTaskStore } from "@/lib/task-store"
import { safeToDate } from "@/lib/date-utils"
import type { Task } from "@/lib/types"
import { format } from "date-fns"
import { CalendarDays, Clock, Flag, Tag, Timer } from "lucide-react"
import { asDate } from "./time"

/**
 * Chips for the fields smart-parse pulled out of a captured idea (date/time/
 * duration/priority/list), so the parse is visible during clarification.
 */
export function CaptureChips({ task }: { task: Task }) {
  const categories = useTaskStore((state) => state.lists)
  const chips: { key: string; icon: React.ReactNode; label: string }[] = []

  const categoryName =
    task.lists
      ?.map((cid) => categories.find((c) => c.id === cid)?.name)
      .find(Boolean) || task.tags?.[0]
  if (categoryName) chips.push({ key: "cat", icon: <Tag className="h-3 w-3" />, label: categoryName })

  const scheduled = safeToDate(task.scheduledDate)
  if (scheduled) chips.push({ key: "date", icon: <CalendarDays className="h-3 w-3" />, label: format(scheduled, "EEE MMM d") })
  if (task.scheduledTime) chips.push({ key: "time", icon: <Clock className="h-3 w-3" />, label: task.scheduledTime })
  if (task.estimatedDuration && task.estimatedDuration > 1)
    chips.push({ key: "dur", icon: <Timer className="h-3 w-3" />, label: `${task.estimatedDuration}m` })
  if (task.urgency && task.urgency >= 4)
    chips.push({ key: "urg", icon: <Flag className="h-3 w-3" />, label: `urgency ${task.urgency}` })
  if (task.importance && task.importance >= 4)
    chips.push({ key: "imp", icon: <Flag className="h-3 w-3" />, label: `importance ${task.importance}` })
  const deadline = asDate(task.deadline)
  if (deadline) chips.push({ key: "due", icon: <CalendarDays className="h-3 w-3" />, label: `due ${format(deadline, "EEE MMM d")}` })

  if (chips.length === 0) return null
  return (
    <div className="inbox-clarify-parse">
      {chips.map((c) => (
        <Badge key={c.key} variant="secondary" className="inbox-clarify-parse-chip">
          {c.icon}
          {c.label}
        </Badge>
      ))}
    </div>
  )
}
