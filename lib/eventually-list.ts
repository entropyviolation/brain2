/**
 * lib/eventually-list.ts — Next Actions "eventually" holding list
 *
 * The Scheduler's Eventually / Later bucket files a task here and does not
 * set a period. The list is created on first drop, inside Next Actions.
 */
import { clearedScheduleFields } from "@/lib/scheduling"
import { findNextActionsFolder } from "@/lib/scheduled-lists-sync"
import { useTaskStore } from "@/lib/task-store"
import type { Folder, List, Task } from "@/lib/types"

export const NA_EVENTUALLY_LIST_ID = "na-eventually"
export const EVENTUALLY_LIST_NAME = "eventually"
const NEXT_ACTIONS_FOLDER_ID = "folder-next-actions"

function namedEventually(list: List): boolean {
  return list.name.trim().toLowerCase() === EVENTUALLY_LIST_NAME
}

/** The live eventually list: canonical id, then a Next Actions list of that name, then any name match. */
export function findEventuallyList(lists: List[], folders: Folder[]): List | undefined {
  const byId = lists.find((list) => list.id === NA_EVENTUALLY_LIST_ID)
  if (byId) return byId
  const na = findNextActionsFolder(folders)
  if (na) {
    const inFolder = lists.find((list) => na.listIds.includes(list.id) && namedEventually(list))
    if (inFolder) return inFolder
  }
  return lists.find(namedEventually)
}

export function isOnEventuallyList(task: Pick<Task, "lists">, listId: string | undefined): boolean {
  if (!listId) return false
  return task.lists?.includes(listId) ?? false
}

function ensureNextActionsFolder(): Folder {
  const store = useTaskStore.getState()
  const existing = findNextActionsFolder(store.folders)
  if (existing) return existing
  const folder: Folder = {
    id: NEXT_ACTIONS_FOLDER_ID,
    name: "Next Actions",
    createdAt: new Date(),
    listIds: [],
    scheduleable: true,
    color: "#2563eb",
  }
  store.addFolder(folder)
  return findNextActionsFolder(useTaskStore.getState().folders) ?? folder
}

/** Create the eventually list (and Next Actions, if needed) and file the list there. */
export function ensureEventuallyList(): string {
  const existing = findEventuallyList(useTaskStore.getState().lists, useTaskStore.getState().folders)
  const listId = existing?.id ?? NA_EVENTUALLY_LIST_ID
  if (!existing) {
    useTaskStore.getState().addList({
      id: listId,
      name: EVENTUALLY_LIST_NAME,
      color: "#78716c",
      createdAt: new Date(),
      itemLabel: "task",
      scheduleable: true,
      description: "Held for later. No period until you schedule it.",
    })
  }
  const folder = ensureNextActionsFolder()
  if (!folder.listIds.includes(listId)) {
    useTaskStore.getState().addListToFolder(folder.id, listId)
  }
  return listId
}

function taskHasPeriod(task: Task): boolean {
  return !!(task.scheduledDate || task.scheduledWeek || task.scheduledMonth || task.scheduledYear)
}

/** File tasks on eventually and clear any period. */
export function placeTasksOnEventually(taskIds: string[]): void {
  if (taskIds.length === 0) return
  const listId = ensureEventuallyList()
  for (const id of taskIds) {
    const task = useTaskStore.getState().tasks.find((row) => row.id === id)
    if (!task) continue
    const lists = task.lists?.includes(listId) ? task.lists : [...(task.lists ?? []), listId]
    useTaskStore.getState().updateTask({
      ...task,
      ...clearedScheduleFields(),
      lists,
    })
  }
}

/** Drop eventually membership. Used when a held task is given a real period. */
export function leaveEventuallyList(taskId: string): void {
  const state = useTaskStore.getState()
  const list = findEventuallyList(state.lists, state.folders)
  if (!list) return
  const task = state.tasks.find((row) => row.id === taskId)
  if (!task?.lists?.includes(list.id)) return
  useTaskStore.getState().updateTask({
    ...task,
    lists: task.lists.filter((id) => id !== list.id),
  })
}

/**
 * Take an unscheduled eventually task back to the available inbox.
 * A task that still has a period is left on the list (unscheduling it is separate).
 */
export function removeUnscheduledFromEventually(taskId: string): void {
  const state = useTaskStore.getState()
  const list = findEventuallyList(state.lists, state.folders)
  if (!list) return
  const task = state.tasks.find((row) => row.id === taskId)
  if (!task?.lists?.includes(list.id) || taskHasPeriod(task)) return
  useTaskStore.getState().updateTask({
    ...task,
    lists: (task.lists ?? []).filter((id) => id !== list.id),
  })
}
