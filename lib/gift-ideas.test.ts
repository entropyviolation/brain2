import { beforeEach, describe, expect, it } from "vitest"
import {
  addGiftIdeaOnList,
  ensureCloseGiftIdeas,
  ensureGiftIdeasForPerson,
  findGiftIdeasFolder,
  findGiftIdeasList,
  noteSavedPeople,
} from "@/lib/gift-ideas"
import { planDuplicateList } from "@/lib/lists-duplicate"
import { createListItem } from "@/lib/item-utils"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import { resetAllStores } from "@/tests/test-utils"

function person(id: string, title: string, close?: boolean): Task {
  return {
    ...createListItem(title, []),
    id,
    title,
    type: "person",
    personProfile: close ? { close: true } : undefined,
  }
}

describe("gift ideas", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("creates one folder and a list named for the person when close is true", () => {
    useTaskStore.getState().addTask(person("ada", "Ada", true))
    ensureCloseGiftIdeas()

    const folder = findGiftIdeasFolder(useTaskStore.getState().folders)
    const list = findGiftIdeasList(useTaskStore.getState().lists, "ada")
    expect(folder?.name).toBe("Gift ideas")
    expect(folder?.giftIdeasFolder).toBe(true)
    expect(list?.name).toBe("Gift ideas for Ada")
    expect(list?.giftIdeasPersonId).toBe("ada")
    expect(folder?.listIds).toContain(list?.id)
  })

  it("adopts a folder already named Gift ideas", () => {
    useTaskStore.getState().addFolder({
      id: "mine",
      name: "Gift ideas",
      createdAt: new Date(),
      listIds: [],
    })
    ensureGiftIdeasForPerson(person("ada", "Ada"))
    const folders = useTaskStore.getState().folders.filter((folder) => folder.giftIdeasFolder)
    expect(folders).toHaveLength(1)
    expect(folders[0]?.id).toBe("mine")
  })

  it("gives two people with the same title two lists, and a rename updates the name", () => {
    const ada = person("ada", "Ada", true)
    const other = person("other", "Ada", true)
    useTaskStore.getState().addTask(ada)
    useTaskStore.getState().addTask(other)
    ensureCloseGiftIdeas()

    const first = findGiftIdeasList(useTaskStore.getState().lists, "ada")
    const second = findGiftIdeasList(useTaskStore.getState().lists, "other")
    expect(first?.id).not.toBe(second?.id)
    expect(first?.name).toBe("Gift ideas for Ada")
    expect(second?.name).toBe("Gift ideas for Ada")

    const renamed = { ...ada, title: "Augusta", description: "Augusta" }
    noteSavedPeople([ada, other], [renamed, other])
    expect(findGiftIdeasList(useTaskStore.getState().lists, "ada")?.name).toBe("Gift ideas for Augusta")
    expect(findGiftIdeasList(useTaskStore.getState().lists, "other")?.name).toBe("Gift ideas for Ada")
  })

  it("does not create a list when close is off, and does not delete one that exists", () => {
    useTaskStore.getState().addTask(person("ada", "Ada"))
    ensureCloseGiftIdeas()
    expect(findGiftIdeasList(useTaskStore.getState().lists, "ada")).toBeUndefined()
    expect(findGiftIdeasFolder(useTaskStore.getState().folders)).toBeUndefined()

    ensureGiftIdeasForPerson(person("ada", "Ada"))
    const listId = findGiftIdeasList(useTaskStore.getState().lists, "ada")?.id
    ensureCloseGiftIdeas()
    expect(findGiftIdeasList(useTaskStore.getState().lists, "ada")?.id).toBe(listId)

    const folderId = findGiftIdeasFolder(useTaskStore.getState().folders)?.id
    useTaskStore.getState().deleteFolder(folderId!)
    useTaskStore.getState().deleteList(listId!)
    expect(findGiftIdeasFolder(useTaskStore.getState().folders)).toBeUndefined()
    expect(findGiftIdeasList(useTaskStore.getState().lists, "ada")).toBeUndefined()

    useTaskStore.getState().addList({
      id: "books",
      name: "Books",
      color: "#111",
      createdAt: new Date(),
    })
    useTaskStore.getState().deleteList("books")
    expect(useTaskStore.getState().lists.some((list) => list.id === "books")).toBe(false)
  })

  it("adds an item only when that person's list exists, and a duplicate drops the person id", () => {
    expect(addGiftIdeaOnList("ada", "Scarf")).toBeNull()
    ensureGiftIdeasForPerson(person("ada", "Ada"))
    const added = addGiftIdeaOnList("ada", "  Scarf ")
    const listId = findGiftIdeasList(useTaskStore.getState().lists, "ada")?.id
    expect(added?.title).toBe("Scarf")
    expect(added?.lists).toEqual([listId])
    expect(addGiftIdeaOnList("ada", "   ")).toBeNull()

    const source = findGiftIdeasList(useTaskStore.getState().lists, "ada")!
    const plan = planDuplicateList(source, {
      scope: "settings",
      lists: useTaskStore.getState().lists,
      folders: useTaskStore.getState().folders,
      tasks: [],
    })
    expect(plan.list.giftIdeasPersonId).toBeUndefined()
    expect(plan.list.id).not.toBe(source.id)
  })
})
