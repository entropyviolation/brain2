import { beforeEach, describe, expect, it, vi } from "vitest"
import { readListsNavigation } from "@/lib/app-navigation"
import { ROOT_ALL_FOLDER_ID } from "@/components/Lists/constants"
import { useTaskStore } from "@/lib/task-store"
import { resetLocalStorage } from "@/tests/test-utils"
import type { Task } from "@/lib/types"
import { openItemsInLists } from "./open-in-lists"

function task(overrides: Partial<Task>): Task {
  return {
    id: "t1",
    description: "Task",
    stage: "list",
    createdAt: new Date(),
    completed: false,
    lists: [],
    ...overrides,
  }
}

beforeEach(() => {
  resetLocalStorage()
  useTaskStore.setState({
    tasks: [],
    lists: [],
    folders: [{ id: "folder-1", name: "Folder", createdAt: new Date(), listIds: ["list-1"] }],
  })
})

describe("openItemsInLists", () => {
  it("opens the shared list when every item lives there", () => {
    useTaskStore.setState({
      tasks: [
        task({ id: "a", lists: ["list-1"] }),
        task({ id: "b", lists: ["list-1"] }),
      ],
    })
    const handler = vi.fn()
    window.addEventListener("cogs-navigate-to-list", handler)
    openItemsInLists({ taskIds: ["a", "b"] })
    expect(readListsNavigation()).toEqual({
      location: "folder-1",
      openTarget: { type: "category", id: "list-1" },
    })
    expect(handler).toHaveBeenCalledTimes(1)
    window.removeEventListener("cogs-navigate-to-list", handler)
  })

  it("opens All Items when the chart's items span lists", () => {
    useTaskStore.setState({
      tasks: [
        task({ id: "a", lists: ["list-1"] }),
        task({ id: "b", lists: ["list-2"] }),
      ],
    })
    openItemsInLists({ taskIds: ["a", "b"] })
    expect(readListsNavigation()).toEqual({
      location: "all",
      openTarget: { type: "folder-all", folderId: ROOT_ALL_FOLDER_ID },
    })
  })

  it("opens the Habits list from a habit chart", () => {
    openItemsInLists({ habits: true })
    expect(readListsNavigation()).toEqual({
      location: "home",
      openTarget: { type: "habits", id: "habits" },
    })
  })
})
