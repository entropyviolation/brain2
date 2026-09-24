/**
 * lib/operation-lists.ts — Operations ↔ Lists bridge
 *
 * Every operation can own a real `List` (filed in an **Operations** folder in
 * the Lists tab) that backs its **To do** panel. That is what makes an
 * operation's work *items* rather than a bespoke data structure: they are
 * ordinary tasks with `lists: [operationList.id]`, so they inherit the item
 * model (item types, attributes, detail panels, scheduling) and show up in the
 * Lists tab, All Items, search, and the scheduler like anything else.
 *
 * The list is created lazily on the first visit to the Tasks panel and linked
 * from the operation through `OPERATION_ATTR.taskListId`. Phase steps and part
 * tasks are filed here too. Idempotent, and the list is renamed along with the
 * operation.
 */
import { OPERATION_ATTR } from "@/lib/operation-types"
import { useTaskStore } from "@/lib/task-store"
import type { Folder, List, Task } from "@/lib/types"

/** Folder that holds every per-operation list. */
export const OPERATIONS_FOLDER_ID = "folder-operations"
export const OPERATIONS_FOLDER_NAME = "Operations"

/** Deterministic list id for an operation (so re-runs never fork a second list). */
export function operationTaskListId(operationId: string): string {
  return `op-list-${operationId}`
}

/** Display name for an operation's backing list. */
export function operationTaskListName(operationTitle: string): string {
  return operationTitle.trim() || "Operation"
}

function ensureOperationsFolder(): Folder {
  const store = useTaskStore.getState()
  const existing = store.folders.find((f) => f.id === OPERATIONS_FOLDER_ID)
  if (existing) return existing
  const folder: Folder = {
    id: OPERATIONS_FOLDER_ID,
    name: OPERATIONS_FOLDER_NAME,
    createdAt: new Date(),
    listIds: [],
    color: "#0f766e",
    description: "One list per operation. Items here are the operation's Tasks panel.",
    scheduleable: true,
    // Operation work is real work: keep it in the global All directory.
    hiddenFromGlobalAll: false,
  }
  store.addFolder(folder)
  return useTaskStore.getState().folders.find((f) => f.id === OPERATIONS_FOLDER_ID) ?? folder
}

/** The operation's backing list, if it has been created already. */
export function findOperationTaskList(operation: Task, lists: List[]): List | null {
  const linked = String(operation.attributes?.[OPERATION_ATTR.taskListId] ?? "").trim()
  if (linked) {
    const byId = lists.find((l) => l.id === linked)
    if (byId) return byId
  }
  return lists.find((l) => l.id === operationTaskListId(operation.id)) ?? null
}

/**
 * Ensure the operation has a backing list (creating the Operations folder on
 * first use) and that the operation links to it. Returns the list, or `null`
 * when the operation id is unknown.
 */
export function ensureOperationTaskList(operationId: string): List | null {
  const store = useTaskStore.getState()
  const operation = store.tasks.find((t) => t.id === operationId)
  if (!operation) return null

  const existing = findOperationTaskList(operation, store.lists)
  const listId = existing?.id ?? operationTaskListId(operationId)

  if (!existing) {
    const list: List = {
      id: listId,
      name: operationTaskListName(operation.description),
      color: "#0f766e",
      createdAt: new Date(),
      description: `Tasks and items for the "${operationTaskListName(operation.description)}" operation.`,
      itemTypeId: "task",
      itemLabel: "task",
      scheduleable: true,
      hiddenFromGlobalAll: false,
      enabledDisplays: ["default", "checklist", "table", "spreadsheet"],
    }
    store.addList(list)
  }

  const folder = ensureOperationsFolder()
  if (!folder.listIds.includes(listId)) {
    useTaskStore.getState().addListToFolder(OPERATIONS_FOLDER_ID, listId)
  }

  const linked = String(operation.attributes?.[OPERATION_ATTR.taskListId] ?? "").trim()
  if (linked !== listId) {
    const latest = useTaskStore.getState()
    const current = latest.tasks.find((t) => t.id === operationId) ?? operation
    latest.updateTask({
      ...current,
      attributes: { ...(current.attributes ?? {}), [OPERATION_ATTR.taskListId]: listId },
    })
  }

  return useTaskStore.getState().lists.find((l) => l.id === listId) ?? null
}

/** Keep the backing list's name in step with the operation title. */
export function syncOperationTaskListName(operationId: string, title: string): void {
  const store = useTaskStore.getState()
  const operation = store.tasks.find((t) => t.id === operationId)
  if (!operation) return
  const list = findOperationTaskList(operation, store.lists)
  if (!list) return
  const name = operationTaskListName(title)
  if (list.name === name) return
  store.updateList({ ...list, name })
}

/** Tasks filed in the operation's list (excluding the operation itself). */
export function operationListTasks(listId: string, allTasks: Task[]): Task[] {
  return allTasks.filter((t) => (t.lists ?? []).includes(listId))
}
