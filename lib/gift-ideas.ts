/**
 * lib/gift-ideas.ts — Gift ideas folder and one list per Close person
 *
 * Close lives on `Task.personProfile.close`. When it is saved true, this
 * creates one Lists folder named Gift ideas (adopted by id, by
 * `giftIdeasFolder`, or by that name) and a list inside it named
 * "Gift ideas for {item title}". The list is tied with `giftIdeasPersonId`,
 * so a rename follows the person and two people with the same title do not
 * share a list.
 *
 * Turning Close off does not delete the list. Deleting the folder or a
 * person's list is allowed: they are ordinary Lists records, not a second
 * folder system and not a protected singleton like People I Know. A person
 * who is still Close gets a missing list back the next time the vault
 * hydrates. A duplicate of the list does not keep `giftIdeasPersonId`.
 *
 * Quick notes in `personProfile.giftIdeas` are separate and are not cleared.
 */
import { createListItem, itemTitle, itemTitleOrUntitled } from "@/lib/item-utils"
import { useTaskStore } from "@/lib/task-store"
import type { Folder, List, Task } from "@/lib/types"

export const GIFT_IDEAS_FOLDER_ID = "gift-ideas"
export const GIFT_IDEAS_FOLDER_NAME = "Gift ideas"

export function giftIdeasListId(personId: string): string {
  return `gift-ideas-for-${personId}`
}

export function giftIdeasListTitle(personName: string): string {
  const name = personName.trim() || "Untitled"
  return `Gift ideas for ${name}`
}

function folderNameIsGiftIdeas(name: string | undefined): boolean {
  return (name ?? "").trim().toLowerCase() === GIFT_IDEAS_FOLDER_NAME.toLowerCase()
}

/** Canonical id, then the flagged folder, then a folder already named Gift ideas. */
export function findGiftIdeasFolder(folders: Folder[]): Folder | undefined {
  return (
    folders.find((folder) => folder.id === GIFT_IDEAS_FOLDER_ID) ??
    folders.find((folder) => folder.giftIdeasFolder) ??
    folders.find((folder) => folderNameIsGiftIdeas(folder.name))
  )
}

/** The list tied to this person. Title is not an identity. */
export function findGiftIdeasList(lists: List[], personId: string): List | undefined {
  if (!personId) return undefined
  return (
    lists.find((list) => list.giftIdeasPersonId === personId) ??
    lists.find((list) => list.id === giftIdeasListId(personId))
  )
}

function ensureGiftIdeasFolder(): string {
  const store = useTaskStore.getState()
  const existing = findGiftIdeasFolder(store.folders)
  if (existing) {
    if (!existing.giftIdeasFolder) store.updateFolder({ ...existing, giftIdeasFolder: true })
    return existing.id
  }
  store.addFolder({
    id: GIFT_IDEAS_FOLDER_ID,
    name: GIFT_IDEAS_FOLDER_NAME,
    createdAt: new Date(),
    listIds: [],
    scheduleable: false,
    giftIdeasFolder: true,
    description:
      "Gift ideas for people marked Close. One list per person. Deleting this folder is allowed and does not delete the lists. It is an ordinary folder, found again by giftIdeasFolder or by the name Gift ideas.",
  })
  return GIFT_IDEAS_FOLDER_ID
}

function fileListInFolder(folderId: string, listId: string): void {
  const store = useTaskStore.getState()
  const folder = store.folders.find((row) => row.id === folderId)
  if (!folder || folder.listIds.includes(listId)) return
  store.addListToFolder(folderId, listId)
}

/**
 * Create or refresh this person's Gift ideas list and file it in the folder.
 * Safe to call again. Does not read or write `personProfile.giftIdeas`.
 */
export function ensureGiftIdeasForPerson(person: Pick<Task, "id" | "title" | "description">): string {
  const store = useTaskStore.getState()
  const folderId = ensureGiftIdeasFolder()
  const title = giftIdeasListTitle(itemTitleOrUntitled(person))
  const existing = findGiftIdeasList(store.lists, person.id)
  let listId: string
  if (existing) {
    listId = existing.id
    if (existing.name !== title || existing.giftIdeasPersonId !== person.id) {
      store.updateList({ ...existing, name: title, giftIdeasPersonId: person.id })
    }
  } else {
    listId = giftIdeasListId(person.id)
    store.addList({
      id: listId,
      name: title,
      color: "#b45309",
      createdAt: new Date(),
      itemLabel: "gift",
      scheduleable: false,
      giftIdeasPersonId: person.id,
      detailPanels: ["details"],
      description:
        "Gift ideas for this person. Close created this list. Turning Close off leaves it here. A copy of this list does not stay tied to the person.",
    })
  }
  fileListInFolder(folderId, listId)
  return listId
}

/** Rename an existing list after the person's item title changes. Does not create one. */
export function renameGiftIdeasList(person: Pick<Task, "id" | "title" | "description">): void {
  const store = useTaskStore.getState()
  const existing = findGiftIdeasList(store.lists, person.id)
  if (!existing) return
  const title = giftIdeasListTitle(itemTitleOrUntitled(person))
  if (existing.name === title) return
  store.updateList({ ...existing, name: title })
}

/**
 * After hydrate: people already Close get a folder and a list. Anyone who
 * already has a list gets a rename. Close off does not delete.
 */
export function ensureCloseGiftIdeas(): void {
  const tasks = useTaskStore.getState().tasks
  for (const task of tasks) {
    if (task.personProfile?.close === true) ensureGiftIdeasForPerson(task)
    else renameGiftIdeasList(task)
  }
}

/**
 * When a save turns Close on, create the list. A title change renames a list
 * that already exists. Close turning off does not delete.
 */
export function noteSavedPeople(prev: Task[], next: Task[]): void {
  const before = new Map(prev.map((task) => [task.id, task]))
  for (const task of next) {
    const prior = before.get(task.id)
    const becameClose = task.personProfile?.close === true && prior?.personProfile?.close !== true
    if (becameClose) {
      ensureGiftIdeasForPerson(task)
      continue
    }
    if (itemTitle(task) !== itemTitle(prior)) renameGiftIdeasList(task)
  }
}

/** Add one item on this person's Gift ideas list. No list means no item. */
export function addGiftIdeaOnList(personId: string, text: string): Task | null {
  const trimmed = text.trim()
  if (!trimmed || !personId) return null
  const list = findGiftIdeasList(useTaskStore.getState().lists, personId)
  if (!list) return null
  const item = createListItem(trimmed, [list.id])
  useTaskStore.getState().addTask(item)
  return item
}
