/**
 * components/Reviews/morning/affirmation-pool.ts — The Affirmations list.
 *
 * Creates that list with the default lines when it is missing, and opens it
 * in Lists. Shuffle and the first seed both read this pool.
 */
import { APP_NAV_KEYS, writeListsNavigation, writeStoredId, writeStoredTab } from "@/lib/app-navigation"
import {
  AFFIRMATIONS_LIST_NAME,
  AFFIRMATIONS_PER_SESSION,
  DEFAULT_AFFIRMATIONS,
  affirmationText,
  findAffirmationsCategory,
  getAffirmationItems,
  pickRandom,
} from "@/lib/affirmations"
import { createListItem } from "@/lib/item-utils"
import { COGS_NAV_RESTORE_EVENT } from "@/lib/screen-location"
import type { List, Task } from "@/lib/types"

export function openListInLists(listId: string) {
  writeListsNavigation({ location: "home", openTarget: { type: "category", id: listId } })
  writeStoredTab(APP_NAV_KEYS.appTab, "categories")
  writeStoredId(APP_NAV_KEYS.appItemId, null)
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(COGS_NAV_RESTORE_EVENT))
}

/** The Affirmations list's lines (created with defaults if missing), and its id. */
export function affirmationPool(lists: List[], tasks: Task[], addList: (l: List) => void, addTask: (t: Task) => void) {
  try {
    let list = findAffirmationsCategory(lists)
    if (!list) {
      list = {
        id: `affirmations-${Date.now()}`,
        name: AFFIRMATIONS_LIST_NAME,
        description: "Spoken morning affirmations",
        createdAt: new Date(),
        scheduleable: false,
        itemLabel: "affirmation",
      } as List
      addList(list)
      for (const line of DEFAULT_AFFIRMATIONS) {
        addTask(createListItem(line, [list.id]) as Task)
      }
    }
    const fromList = getAffirmationItems(tasks, list.id)
      .map((item) => affirmationText(item).trim())
      .filter(Boolean)
    return { pool: fromList.length > 0 ? fromList : DEFAULT_AFFIRMATIONS, listId: list.id as string | undefined }
  } catch {
    return { pool: DEFAULT_AFFIRMATIONS, listId: undefined }
  }
}

export function ensureAffirmationLines(lists: List[], tasks: Task[], addList: (l: List) => void, addTask: (t: Task) => void): string[] {
  return pickRandom(affirmationPool(lists, tasks, addList, addTask).pool, AFFIRMATIONS_PER_SESSION)
}
