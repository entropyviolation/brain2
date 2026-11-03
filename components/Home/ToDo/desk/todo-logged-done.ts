/**
 * components/Home/ToDo/desk/todo-logged-done.ts — The task Log done builds
 *
 * Called once inside `handleAddDone`. That handler still schedules the task,
 * adds it, pays points, emits the completion, and opens the Done well.
 */
import type { Task } from "@/lib/types"
import type { CompletionWindow } from "@/lib/completion-window"
import { makeEstimate } from "@/lib/estimated-values"
import { DEFAULT_LOGGED_DONE_MINUTES } from "./todo-desk-constants"

export function loggedDoneTask(description: string, refDate: Date, window: CompletionWindow): Task {
  const id = `done-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const task: Task = {
    id,
    description,
    stage: "completed",
    createdAt: refDate,
    completed: true,
    status: "done",
    completedDate: window.completedAt,
    startedAt: window.startedAt,
    actualDuration: DEFAULT_LOGGED_DONE_MINUTES,
    estimates: [
      ...window.estimatedFields.map((field) => makeEstimate(field, window.kind, window.basis)),
      makeEstimate(
        "actualDuration",
        "flat",
        `${DEFAULT_LOGGED_DONE_MINUTES}m assumed for work logged after the fact`,
      ),
    ],
    lists: [],
    scheduleable: true,
    urgency: 3,
    importance: 3,
    estimatedDuration: DEFAULT_LOGGED_DONE_MINUTES,
    cognitiveLoad: 2,
    dependencies: [],
    context: "@general",
    entropy: 0.5,
    rewardValue: 1,
    allowPartialCompletion: false,
    minimumChunkSize: 15,
  }
  return task
}
