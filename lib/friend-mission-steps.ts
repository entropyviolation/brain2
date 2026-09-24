/**
 * lib/friend-mission-steps.ts — Smaller-task and first-step writes
 *
 * The mission sheet and the friend instrument both use these, so “something
 * smaller” changes the item the same way in both places.
 */

import { friendBreakdownSteps, friendFirstStep, friendMissionItemId } from "@/lib/friend-mission"
import { addStepsAsSubtasks, nextMolecularStep } from "@/lib/molecular"
import { useTaskStore } from "@/lib/task-store"

export function splitFriendTask(taskId: string | null, title: string): string[] {
  const itemId = friendMissionItemId(taskId)
  if (!itemId) return []
  const task = useTaskStore.getState().tasks.find((row) => row.id === itemId)
  if (!task) return []
  const open = (task.subtasks ?? []).filter((step) => !step.completed)
  if (open.length >= 2) return open.map((step) => step.description)
  const steps = friendBreakdownSteps(title)
  useTaskStore.getState().updateTask({ ...task, subtasks: addStepsAsSubtasks(task.subtasks, steps) })
  return steps.map((step) => step.description)
}

export function ensureFriendFirstStep(taskId: string | null, title: string): { stepId: string; stepTitle: string } | null {
  const itemId = friendMissionItemId(taskId)
  if (!itemId) return null
  const task = useTaskStore.getState().tasks.find((row) => row.id === itemId)
  if (!task) return null
  const existing = nextMolecularStep(task)
  if (existing) return { stepId: existing.id, stepTitle: existing.description }
  const step = friendFirstStep(title)
  const subtasks = addStepsAsSubtasks(task.subtasks, [step])
  const made = subtasks[subtasks.length - 1]
  useTaskStore.getState().updateTask({ ...task, subtasks })
  if (!made) return null
  return { stepId: made.id, stepTitle: made.description }
}
