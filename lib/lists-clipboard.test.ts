import { describe, expect, it, vi } from "vitest"
import type { Folder, List, Task } from "@/lib/types"
import {
  applyListsClipboardPaste,
  buildListsClipboardPayload,
  isListsClipboardKeyboardBlocked,
  isListsClipboardSurfaceActive,
  listsClipboardIsEmpty,
} from "@/lib/lists-clipboard"

const folder = (partial: Partial<Folder> & Pick<Folder, "id" | "name">): Folder => ({
  createdAt: new Date(),
  listIds: [],
  ...partial,
})

const list = (id: string, name: string): List => ({
  id,
  name,
  createdAt: new Date(),
  order: 0,
})

describe("lists clipboard payload", () => {
  it("treats empty payloads as empty", () => {
    expect(listsClipboardIsEmpty(null)).toBe(true)
    expect(listsClipboardIsEmpty({ listIds: [], folderIds: [] })).toBe(true)
    expect(listsClipboardIsEmpty({ listIds: ["a"], folderIds: [] })).toBe(false)
  })

  it("drops All Items lists and scheduled folders from the payload", () => {
    expect(
      buildListsClipboardPayload({
        listIds: ["books", "__all-items__root"],
        folderIds: ["kitchen", "na-sched-d-2026-08-25"],
      }),
    ).toEqual({ listIds: ["books"], folderIds: ["kitchen"] })
  })
})

describe("isListsClipboardKeyboardBlocked", () => {
  it("blocks text fields and dialogs, not select-mode checkboxes/radios", () => {
    const text = document.createElement("input")
    text.type = "text"
    expect(isListsClipboardKeyboardBlocked(text)).toBe(true)
    const search = document.createElement("input")
    search.type = "search"
    expect(isListsClipboardKeyboardBlocked(search)).toBe(true)
    expect(isListsClipboardKeyboardBlocked(document.createElement("textarea"))).toBe(true)

    const checkbox = document.createElement("input")
    checkbox.type = "checkbox"
    expect(isListsClipboardKeyboardBlocked(checkbox)).toBe(false)
    const radio = document.createElement("input")
    radio.type = "radio"
    expect(isListsClipboardKeyboardBlocked(radio)).toBe(false)
    expect(isListsClipboardKeyboardBlocked(document.createElement("button"))).toBe(false)
    expect(isListsClipboardKeyboardBlocked(document.createElement("div"))).toBe(false)

    const dialog = document.createElement("div")
    dialog.setAttribute("role", "dialog")
    const dialogCheckbox = document.createElement("input")
    dialogCheckbox.type = "checkbox"
    dialog.appendChild(dialogCheckbox)
    expect(isListsClipboardKeyboardBlocked(dialogCheckbox)).toBe(true)
  })
})

describe("isListsClipboardSurfaceActive", () => {
  it("is false when the Lists root sits under a hidden warm tab", () => {
    const host = document.createElement("div")
    host.hidden = true
    const root = document.createElement("div")
    host.appendChild(root)
    document.body.appendChild(host)
    expect(isListsClipboardSurfaceActive(root)).toBe(false)
    host.hidden = false
    expect(isListsClipboardSurfaceActive(root)).toBe(true)
    host.remove()
    expect(isListsClipboardSurfaceActive(null)).toBe(false)
  })
})

describe("applyListsClipboardPaste", () => {
  it("Same identity files lists into the destination without cloning", () => {
    const folders = [
      folder({ id: "a", name: "A", listIds: ["books"] }),
      folder({ id: "b", name: "B", listIds: [] }),
    ]
    const lists = [list("books", "Books")]
    const addListToFolder = vi.fn()
    applyListsClipboardPaste(
      { listIds: ["books"], folderIds: ["a"] },
      "same",
      {
        destinationFolderId: "b",
        getSnapshot: () => ({ folders, lists, tasks: [] as Task[] }),
      },
      {
        addFolder: vi.fn(),
        addList: vi.fn(),
        addListToFolder,
        addTask: vi.fn(),
      },
    )
    expect(addListToFolder).toHaveBeenCalledWith("b", "books")
    expect(addListToFolder).toHaveBeenCalledTimes(1)
  })

  it("Same identity skips folders (single parentFolderId)", () => {
    const folders = [folder({ id: "a", name: "A" }), folder({ id: "b", name: "B" })]
    const addListToFolder = vi.fn()
    const addFolder = vi.fn()
    applyListsClipboardPaste(
      { listIds: [], folderIds: ["a"] },
      "same",
      {
        destinationFolderId: "b",
        getSnapshot: () => ({ folders, lists: [], tasks: [] }),
      },
      {
        addFolder,
        addList: vi.fn(),
        addListToFolder,
        addTask: vi.fn(),
      },
    )
    expect(addListToFolder).not.toHaveBeenCalled()
    expect(addFolder).not.toHaveBeenCalled()
  })

  it("Copies creates a new list filed in the destination", () => {
    const folders = [folder({ id: "dest", name: "Dest", listIds: [] })]
    const lists = [list("books", "Books")]
    const addList = vi.fn()
    const addListToFolder = vi.fn()
    applyListsClipboardPaste(
      { listIds: ["books"], folderIds: [] },
      "copies",
      {
        destinationFolderId: "dest",
        getSnapshot: () => ({ folders, lists, tasks: [] }),
      },
      {
        addFolder: vi.fn(),
        addList,
        addListToFolder,
        addTask: vi.fn(),
      },
    )
    expect(addList).toHaveBeenCalledTimes(1)
    const created = addList.mock.calls[0][0] as List
    expect(created.id).not.toBe("books")
    expect(created.name).toBe("Books copy")
    expect(addListToFolder).toHaveBeenCalledWith("dest", created.id)
  })
})
