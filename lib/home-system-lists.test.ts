/**
 * lib/home-system-lists.test.ts — Built-in singleton lists stay on Lists Home
 */
import { beforeEach, describe, expect, it } from "vitest"
import {
  ensureIphoneNotesIngestDestination,
  ensureIphoneNotesStoreDestination,
  IPHONE_NOTES_STORE_LIST_ID,
  NOTES_TO_INGEST_LIST_ID,
} from "@/lib/apple-notes"
import { NA_SMART_COMPLETED, NA_SMART_DAILY, NA_SMART_MISSED, syncNextActionsSmartLists } from "@/lib/scheduled-lists-sync"
import { AFFIRMATIONS_LIST_NAME } from "@/lib/affirmations"
import { ensureEventuallyList } from "@/lib/eventually-list"
import { GLOBAL_ALL_ITEMS_LIST_ID } from "@/lib/folder-all-items"
import { ensureHabitStandingItem, HABIT_STANDING_LIST_ID } from "@/lib/habit-list-item"
import { pinSystemListsToHome, startSystemHomeListPins, systemHomeListIds } from "@/lib/home-system-lists"
import { ensureInventoryList, INVENTORY_LIST_ID } from "@/lib/ingest/apply-inventory"
import { applyNeeded, NEEDED_LIST_NAME } from "@/lib/ingest/apply-needed"
import { buildGridEntries } from "@/lib/lists-grid-entries"
import { useListsUiStore } from "@/lib/lists-ui-store"
import { ensurePeopleIKnowList, PEOPLE_I_KNOW_LIST_ID } from "@/lib/people-i-know"
import { ensureRemindersList, REMINDERS_LIST_ID } from "@/lib/reminders"
import { useTaskStore } from "@/lib/task-store"
import type { Folder, List } from "@/lib/types"
import { TaskType } from "@/lib/types"
import { resetAllStores } from "@/tests/test-utils"

function list(partial: Partial<List> & Pick<List, "id" | "name">): List {
  return { color: "#64748b", createdAt: new Date(), ...partial }
}

let stopPins: () => void = () => {}

beforeEach(() => {
  stopPins()
  stopPins = () => {}
  resetAllStores()
  useListsUiStore.setState({ homePinned: [] })
})

describe("systemHomeListIds", () => {
  it("names each built-in singleton, including one adopted by the feature's own rule", () => {
    const folders: Folder[] = [
      {
        id: "folder-next-actions",
        name: "Next Actions",
        createdAt: new Date(),
        listIds: ["user-done", "user-missed"],
      },
    ]
    const lists: List[] = [
      list({ id: "mine", name: "Reminders" }),
      list({ id: "folks", name: "People I Know" }),
      list({ id: "user-later", name: "Eventually" }),
      list({ id: "user-done", name: "Completed" }),
      list({ id: "user-missed", name: "Missed Opportunities" }),
      list({ id: "my-habits", name: "Habits" }),
      list({ id: INVENTORY_LIST_ID, name: "Inventory" }),
      list({ id: "aff-1", name: AFFIRMATIONS_LIST_NAME }),
      list({ id: "need-1", name: NEEDED_LIST_NAME }),
      list({ id: "notes-user", name: "notes to ingest" }),
      list({ id: "park-user", name: "Parked" }),
      list({ id: "books", name: "Books" }),
      list({ id: "fridge", name: "Fridge" }),
      list({ id: GLOBAL_ALL_ITEMS_LIST_ID, name: "All Items" }),
      list({ id: NA_SMART_DAILY, name: "To Do - Oct 10, 2026" }),
      list({ id: "na-todo-d-2026-08-31", name: "To do 8/31" }),
    ]

    expect(systemHomeListIds(lists, folders).sort()).toEqual(
      [
        "mine",
        "folks",
        "user-later",
        "user-done",
        "user-missed",
        "my-habits",
        INVENTORY_LIST_ID,
        "aff-1",
        "need-1",
        "notes-user",
        "park-user",
      ].sort(),
    )
  })
})

describe("pinning on the Lists UI store", () => {
  it("pins Reminders and each sibling when the app creates them", () => {
    stopPins = startSystemHomeListPins()

    expect(ensureRemindersList()).toBe(REMINDERS_LIST_ID)
    expect(ensurePeopleIKnowList()).toBe(PEOPLE_I_KNOW_LIST_ID)
    expect(ensureEventuallyList()).toBe("na-eventually")
    ensureHabitStandingItem({
      id: "h1",
      name: "Study",
      type: TaskType.GOAL,
      goal: 20,
      unit: "min",
      rewardValue: 10,
      frequency: "daily",
    })
    expect(ensureInventoryList().id).toBe(INVENTORY_LIST_ID)

    const store = useTaskStore.getState()
    syncNextActionsSmartLists({
      get lists() {
        return useTaskStore.getState().lists
      },
      get folders() {
        return useTaskStore.getState().folders
      },
      addList: (row) => useTaskStore.getState().addList(row),
      updateList: (row) => useTaskStore.getState().updateList(row),
      addFolder: (folder) => useTaskStore.getState().addFolder(folder),
      updateFolder: (folder) => useTaskStore.getState().updateFolder(folder),
    })

    const notes = ensureIphoneNotesIngestDestination({
      lists: useTaskStore.getState().lists,
      folders: useTaskStore.getState().folders,
      addList: (row) => useTaskStore.getState().addList(row),
      addFolder: (folder) => useTaskStore.getState().addFolder(folder),
      addListToFolder: (folderId, listId) => useTaskStore.getState().addListToFolder(folderId, listId),
    })
    const parked = ensureIphoneNotesStoreDestination({
      lists: useTaskStore.getState().lists,
      folders: useTaskStore.getState().folders,
      addList: (row) => useTaskStore.getState().addList(row),
      addFolder: (folder) => useTaskStore.getState().addFolder(folder),
      addListToFolder: (folderId, listId) => useTaskStore.getState().addListToFolder(folderId, listId),
    })
    expect(notes.list.id).toBe(NOTES_TO_INGEST_LIST_ID)
    expect(parked.list.id).toBe(IPHONE_NOTES_STORE_LIST_ID)

    useTaskStore.getState().addList(
      list({ id: `affirmations-${Date.now().toString(36)}`, name: AFFIRMATIONS_LIST_NAME }),
    )
    applyNeeded("batteries")

    const pinned = useListsUiStore.getState().homePinned
    for (const id of [
      REMINDERS_LIST_ID,
      PEOPLE_I_KNOW_LIST_ID,
      "na-eventually",
      HABIT_STANDING_LIST_ID,
      INVENTORY_LIST_ID,
      NA_SMART_COMPLETED,
      NA_SMART_MISSED,
      NOTES_TO_INGEST_LIST_ID,
      IPHONE_NOTES_STORE_LIST_ID,
    ]) {
      expect(pinned, id).toContain(id)
    }
    const affirmations = useTaskStore.getState().lists.find((row) => row.name === AFFIRMATIONS_LIST_NAME)
    const needed = useTaskStore.getState().lists.find((row) => row.name === NEEDED_LIST_NAME)
    expect(pinned).toContain(affirmations?.id)
    expect(pinned).toContain(needed?.id)
    expect(pinned).not.toContain(NA_SMART_DAILY)
    expect(store.lists.find((row) => row.id === REMINDERS_LIST_ID)?.scheduleable).toBe(false)
    expect(useTaskStore.getState().lists.find((row) => row.id === "na-eventually")?.scheduleable).toBe(true)
  })

  it("pins lists that already exist, including an adopted Reminders list", () => {
    useTaskStore.getState().addList(list({ id: "mine", name: "Reminders" }))
    useTaskStore.getState().addList(list({ id: "folks", name: "People I Know" }))
    useTaskStore.getState().addList(list({ id: "books", name: "Books" }))
    useListsUiStore.getState().toggleHomePin("books")

    stopPins = startSystemHomeListPins()

    expect(ensureRemindersList()).toBe("mine")
    expect(ensurePeopleIKnowList()).toBe("folks")
    const pinned = useListsUiStore.getState().homePinned
    expect(pinned).toContain("mine")
    expect(pinned).toContain("folks")
    expect(pinned).toContain("books")
    expect(pinned).not.toContain(REMINDERS_LIST_ID)
    expect(pinned).not.toContain(PEOPLE_I_KNOW_LIST_ID)
  })

  it("puts a built-in list back on Home and still lets a person unpin their own list", () => {
    stopPins = startSystemHomeListPins()
    ensureRemindersList()
    useTaskStore.getState().addList(list({ id: "books", name: "Books" }))
    useListsUiStore.getState().toggleHomePin("books")
    expect(useListsUiStore.getState().homePinned).toContain("books")

    useListsUiStore.getState().toggleHomePin(REMINDERS_LIST_ID)
    useListsUiStore.getState().toggleHomePin("books")

    const pinned = useListsUiStore.getState().homePinned
    expect(pinned).toContain(REMINDERS_LIST_ID)
    expect(pinned).not.toContain("books")
  })

  it("leaves a user pantry off Home and shows the pinned system lists on the Home grid", () => {
    useTaskStore.getState().addList(list({ id: "fridge", name: "Fridge" }))
    useTaskStore.getState().addList(list({ id: "books", name: "Books" }))
    ensureRemindersList()
    ensurePeopleIKnowList()
    pinSystemListsToHome()

    const { lists, folders } = useTaskStore.getState()
    expect(systemHomeListIds(lists, folders)).not.toContain("fridge")
    expect(systemHomeListIds(lists, folders)).not.toContain("books")

    const home = buildGridEntries({
      isHome: true,
      isAll: false,
      currentFolder: null,
      folders,
      categories: lists,
      homePinned: useListsUiStore.getState().homePinned,
      showSmartLists: false,
      allTasks: [],
      getSmartTasks: () => [],
      getTasksForCategory: () => [],
      countForFolder: () => 0,
    }).map((entry) => entry.id)

    expect(home).toContain(REMINDERS_LIST_ID)
    expect(home).toContain(PEOPLE_I_KNOW_LIST_ID)
    expect(home).not.toContain("books")
    expect(home).not.toContain("fridge")
  })
})
