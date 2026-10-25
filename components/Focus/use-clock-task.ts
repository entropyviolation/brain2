/**
 * components/Focus/use-clock-task.ts — The task riding the live pen clock
 *
 * For any surface that shows the pen clock (header Now well, Tracking NOW
 * row, the focus bar): the task and step on it, a `Task › step` label, the
 * open steps an objective can be tied to, and the tie handler.
 */
"use client"

import { useMemo } from "react"
import type { PenColorSession } from "@/lib/pen-color-session-store"
import { useTaskStore } from "@/lib/task-store"
import { setPenColorNowObjectiveCompletes, tiePenColorNowObjective } from "@/lib/pen-color-session"
import { findPlacedStep, placeSteps } from "@/lib/next-step"
import { clockPathLabel } from "@/lib/task-clock-log"

export function useClockTask(session: Pick<PenColorSession, "taskId" | "stepId"> | null | undefined) {
  const taskId = session?.taskId
  const stepId = session?.stepId
  const task = useTaskStore((s) => (taskId ? s.tasks.find((t) => t.id === taskId) : undefined))
  return useMemo(() => {
    if (!task) return { task: undefined, step: undefined, path: "", stepChoices: undefined, onTieStep: undefined, onSetCompletes: undefined }
    const step = stepId ? findPlacedStep(task.subtasks, stepId)?.step : undefined
    const stepChoices = placeSteps(task.subtasks)
      .filter((p) => !p.step.completed)
      .map((p) => ({ id: p.step.id, label: [...p.path.map((s) => s.description), p.step.description].join(" › ") }))
    return {
      task,
      step,
      path: clockPathLabel(task, stepId),
      stepChoices,
      onTieStep: (id: string, target: string | "new" | undefined) => {
        tiePenColorNowObjective(id, target)
      },
      onSetCompletes: (id: string, completes: boolean) => {
        setPenColorNowObjectiveCompletes(id, completes)
      },
    }
  }, [task, stepId])
}
