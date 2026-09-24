/**
 * components/Analytics/open-in-lists.ts — Chart → Lists jump
 *
 * From a chart, open the underlying items in Lists. A single shared list
 * opens that list; mixed membership opens All Items. Habits jump to the
 * Habits smart list. The shell already listens for `cogs-navigate-to-list`.
 */
import {
  COGS_NAVIGATE_TO_LIST_EVENT,
  requestNavigateToList,
  writeListsNavigation,
} from "@/lib/app-navigation"
import { ROOT_ALL_FOLDER_ID } from "@/components/Lists/constants"
import { useTaskStore } from "@/lib/task-store"

export function openItemsInLists(opts: { taskIds?: string[]; habits?: boolean }): void {
  if (opts.habits) {
    writeListsNavigation({ location: "home", openTarget: { type: "habits", id: "habits" } })
    dispatchListJump("habits")
    return
  }

  const taskIds = opts.taskIds ?? []
  if (taskIds.length === 0) return

  const { tasks, folders } = useTaskStore.getState()
  const wanted = new Set(taskIds)
  const matching = tasks.filter((t) => wanted.has(t.id))
  const counts = new Map<string, number>()
  for (const task of matching) {
    for (const listId of task.lists ?? []) {
      counts.set(listId, (counts.get(listId) ?? 0) + 1)
    }
  }

  let shared: string | null = null
  for (const [listId, n] of counts) {
    if (n === matching.length) {
      shared = listId
      break
    }
  }

  if (shared) {
    requestNavigateToList(shared, folders)
    return
  }

  writeListsNavigation({
    location: "all",
    openTarget: { type: "folder-all", folderId: ROOT_ALL_FOLDER_ID },
  })
  dispatchListJump(ROOT_ALL_FOLDER_ID)
}

function dispatchListJump(listId: string): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(COGS_NAVIGATE_TO_LIST_EVENT, { detail: { listId } }))
}
