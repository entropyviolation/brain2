/**
 * components/Home/Habits/habit-completion-detail.tsx
 *
 * The period-detail column: current / target, then one source line.
 * Shown only on the single-period sheet. Writes nothing.
 */
"use client"

import { habitCompletionDetail } from "@/lib/habit-completion-detail"
import { liveHabitStatEvaluation } from "@/lib/habit-source-square"
import { bindingReadsGradeScale, bindingSelectsLoggedAmount } from "@/lib/habit-stat-pipeline"
import { useTaskStore } from "@/lib/task-store"
import type { TaskCompletion, WeeklyTask } from "@/lib/types"

export function HabitCompletionDetail({
  task,
  completion,
  now,
}: {
  task: WeeklyTask
  completion: TaskCompletion | undefined
  now: Date
}) {
  const items = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const live =
    bindingReadsGradeScale(task) || bindingSelectsLoggedAmount(task) ? liveHabitStatEvaluation(task) : null
  const detail = habitCompletionDetail({
    task,
    completion,
    items,
    lists,
    now,
    liveStat: live && !live.error && live.value != null ? { value: live.value, label: live.label } : null,
  })
  return (
    <div className="habit-detail">
      <span className="habit-detail-amount">{detail.amount}</span>
      <span className="habit-detail-source">{detail.source}</span>
    </div>
  )
}
