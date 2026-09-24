import { fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"
import type { Folder, List, Task } from "@/lib/types"
import { ListContentPanel } from "./ListContentPanel"

vi.mock("@/lib/item-type-store", () => ({
  useItemTypeStore: (sel: (s: { types: unknown[] }) => unknown) => sel({ types: [] }),
}))

const list = (id: string, name: string): List => ({
  id,
  name,
  color: "#3B82F6",
  description: "",
  createdAt: new Date(),
  order: 0,
})

const folder1 = (): Folder => ({
  id: "folder1",
  name: "folder1",
  createdAt: new Date(),
  listIds: ["__all-items__folder1", "list-1", "list-2"],
})

const task = (id: string, description: string, listId: string): Task => ({
  id,
  description,
  lists: [listId],
  stage: "list",
  completed: false,
  createdAt: new Date(),
  urgency: 1,
  importance: 1,
})

function renderPanel(overrides: Partial<ComponentProps<typeof ListContentPanel>> = {}) {
  const props: ComponentProps<typeof ListContentPanel> = {
    tasks: [task("a", "item a", "list-1"), task("b", "item b", "list-2"), task("c", "item c", "list-2")],
    currentDisplay: "default",
    categories: [list("list-1", "list 1"), list("list-2", "list 2")],
    folders: [folder1()],
    openCategory: null,
    openFolderAll: true,
    openSmart: false,
    currentFolder: folder1(),
    itemLabel: "Item",
    openIconKey: "",
    folderAllUncategorizedOnly: {},
    onFolderAllUncategorizedOnlyChange: vi.fn(),
    folderAllHiddenListIds: {},
    folderAllHideUncategorized: {},
    addingTaskToTarget: null,
    openTargetKeyValue: "folder1",
    onAddTask: vi.fn(),
    onCancelAddTask: vi.fn(),
    onShowAddTask: vi.fn(),
    showBulkAdd: false,
    onBulkAdd: vi.fn(),
    onShowBulkAdd: vi.fn(),
    onBulkAddCancel: vi.fn(),
    onTaskSelect: vi.fn(),
    onCompleteTask: vi.fn(),
    onTaskDragStart: vi.fn(),
    onDragEnd: vi.fn(),
    onIconPickerOpen: vi.fn(),
    ...overrides,
  }
  return { ...render(<ListContentPanel {...props} />), props }
}

describe("ListContentPanel folder All list filter", () => {
  it("keeps bulk add in the content panel and does not render the list checkbox filter there", () => {
    renderPanel()
    expect(screen.getByRole("button", { name: /Bulk add items/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add Item" })).toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: "Show uncategorized only" })).toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Filter lists" })).not.toBeInTheDocument()
  })

  it("does not show the list filter for a regular list", () => {
    renderPanel({
      openFolderAll: false,
      openCategory: list("list-1", "list 1"),
      currentFolder: folder1(),
      currentDisplay: "default",
    })
    expect(screen.queryByRole("group", { name: "Filter lists" })).not.toBeInTheDocument()
  })
})

describe("ListContentPanel global All folder filter", () => {
  const folder2 = (): Folder => ({
    id: "folder2",
    name: "folder2",
    createdAt: new Date(),
    listIds: ["__all-items__folder2", "list-3"],
  })

  it("does not render folder inclusion checkboxes in the item pane", () => {
    renderPanel({
      isRootAll: true,
      currentFolder: null,
      folders: [folder1(), folder2()],
      categories: [list("list-1", "list 1"), list("list-2", "list 2"), list("list-3", "list 3")],
    })
    expect(screen.queryByRole("group", { name: "Filter folders" })).not.toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Filter lists" })).not.toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: "Show uncategorized only" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Bulk add items/i })).toBeInTheDocument()
  })

  it("renders show uncategorized only and notifies when toggled", () => {
    const onGlobalAllUncategorizedOnlyChange = vi.fn()
    renderPanel({
      isRootAll: true,
      currentFolder: null,
      folders: [folder1(), folder2()],
      onGlobalAllUncategorizedOnlyChange,
    })
    const toggle = screen.getByRole("checkbox", { name: "Show uncategorized only" })
    expect(toggle).not.toBeChecked()
    fireEvent.click(toggle)
    expect(onGlobalAllUncategorizedOnlyChange).toHaveBeenCalledWith(true)
  })
})

describe("ListContentPanel item select mode", () => {
  it("toggles items in default display without opening them", () => {
    const onToggleTaskSelect = vi.fn()
    const onTaskSelect = vi.fn()
    renderPanel({
      selectMode: true,
      selectedTaskIds: ["a"],
      onToggleTaskSelect,
      onTaskSelect,
      openFolderAll: false,
      openCategory: list("list-1", "list 1"),
      currentFolder: folder1(),
      currentDisplay: "default",
      tasks: [task("a", "item a", "list-1"), task("b", "item b", "list-1")],
    })
    expect(screen.getByRole("checkbox", { name: "Select item a" })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: "Select item b" })).not.toBeChecked()
    fireEvent.click(screen.getByText("item b"))
    expect(onToggleTaskSelect).toHaveBeenCalledWith("b")
    expect(onTaskSelect).not.toHaveBeenCalled()
  })

  it("renders reading rows in Default display instead of orbs or a blue hyperlink", () => {
    renderPanel({
      openFolderAll: false,
      openCategory: list("list-1", "list 1"),
      currentFolder: folder1(),
      currentDisplay: "default",
      tasks: [task("a", "item a", "list-1")],
    })
    expect(screen.getByTestId("list-default-read")).toBeInTheDocument()
    expect(document.querySelector(".fm-read-name")?.textContent).toBe("item a")
    expect(document.querySelector(".fm-read-pip")).toBeTruthy()
    expect(document.querySelector(".fm-icon-img")).toBeNull()
    expect(document.querySelector(".fm-link-text")).toBeNull()
    expect(screen.queryByRole("button", { name: "Complete" })).not.toBeInTheDocument()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
  })

  it("never shows item checkboxes in default display unless select mode is on", () => {
    const open = task("a", "item a", "list-1")
    const done = task("b", "item b", "list-1")
    done.completed = true
    const parentish = task("c", "item c", "list-1")
    parentish.status = "done"
    parentish.completed = true
    renderPanel({
      openFolderAll: false,
      openCategory: list("list-1", "list 1"),
      currentFolder: folder1(),
      currentDisplay: "default",
      tasks: [open, done, parentish],
    })
    expect(screen.getByTestId("list-default-read")).toBeInTheDocument()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Complete" })).not.toBeInTheDocument()
    expect(document.querySelectorAll(".fm-checkbox")).toHaveLength(0)
    expect(document.querySelectorAll(".fm-read-pip")).toHaveLength(3)
  })

  it("shows select-mode checkboxes on default rows and still has no complete ticks", () => {
    renderPanel({
      selectMode: true,
      selectedTaskIds: ["a"],
      openFolderAll: false,
      openCategory: list("list-1", "list 1"),
      currentFolder: folder1(),
      currentDisplay: "default",
      tasks: [task("a", "item a", "list-1"), task("b", "item b", "list-1")],
    })
    expect(screen.getByRole("checkbox", { name: "Select item a" })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: "Select item b" })).not.toBeChecked()
    expect(screen.queryByRole("button", { name: "Complete" })).not.toBeInTheDocument()
  })

  it("keeps complete checkboxes in checklist view", () => {
    renderPanel({
      currentDisplay: "checklist",
      openFolderAll: false,
      openCategory: list("list-1", "list 1"),
      tasks: [task("a", "item a", "list-1")],
    })
    expect(screen.getByRole("button", { name: "Completed" })).toBeInTheDocument()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
  })

  it("keeps complete working in checklist select mode", () => {
    const onToggleTaskSelect = vi.fn()
    const onCompleteTask = vi.fn()
    renderPanel({
      selectMode: true,
      selectedTaskIds: [],
      onToggleTaskSelect,
      onCompleteTask,
      currentDisplay: "checklist",
      openFolderAll: false,
      openCategory: list("list-1", "list 1"),
      tasks: [task("a", "item a", "list-1")],
    })
    fireEvent.click(screen.getByRole("button", { name: "Completed" }))
    expect(onCompleteTask).toHaveBeenCalledWith("a")
    fireEvent.click(screen.getByRole("checkbox", { name: "Select item a" }))
    expect(onToggleTaskSelect).toHaveBeenCalledWith("a")
  })

  it("shows select checkboxes in details display", () => {
    const onToggleTaskSelect = vi.fn()
    renderPanel({
      selectMode: true,
      selectedTaskIds: ["a"],
      onToggleTaskSelect,
      currentDisplay: "table",
      openFolderAll: false,
      openCategory: list("list-1", "list 1"),
      tasks: [task("a", "item a", "list-1")],
    })
    expect(screen.getByRole("checkbox", { name: "Select item a" })).toBeChecked()
    expect(screen.getByRole("button", { name: "Open" })).toBeDisabled()
  })

  it("selects icons without opening the item", () => {
    const onToggleTaskSelect = vi.fn()
    const onTaskSelect = vi.fn()
    renderPanel({
      selectMode: true,
      selectedTaskIds: [],
      onToggleTaskSelect,
      onTaskSelect,
      currentDisplay: "icons",
      openFolderAll: false,
      openCategory: list("list-1", "list 1"),
      tasks: [task("a", "item a", "list-1")],
    })
    fireEvent.click(screen.getByText("item a"))
    expect(onToggleTaskSelect).toHaveBeenCalledWith("a")
    expect(onTaskSelect).not.toHaveBeenCalled()
  })
})

describe("ListContentPanel bulk add", () => {
  it("keeps typed text in the field and submits it on Add all", () => {
    const onBulkAdd = vi.fn()
    renderPanel({
      showBulkAdd: true,
      onBulkAdd,
      openFolderAll: false,
      openCategory: list("list-1", "list 1"),
      currentDisplay: "default",
      tasks: [task("a", "item a", "list-1")],
    })
    const textarea = screen.getByPlaceholderText(/Paste one item per line/i)
    fireEvent.change(textarea, { target: { value: "alpha\nbeta" } })
    expect(textarea).toHaveValue("alpha\nbeta")
    fireEvent.click(screen.getByRole("button", { name: /Add all/i }))
    expect(onBulkAdd).toHaveBeenCalledWith("alpha\nbeta")
  })
})

describe("ListContentPanel single add", () => {
  it("shows Add Item beside Bulk add items and starts add without moving bulk add", () => {
    const onShowAddTask = vi.fn()
    renderPanel({
      onShowAddTask,
      openFolderAll: false,
      openCategory: list("list-1", "list 1"),
      currentDisplay: "default",
      tasks: [task("a", "item a", "list-1")],
    })
    const bulk = screen.getByRole("button", { name: /Bulk add items/i })
    const add = screen.getByRole("button", { name: /^Add Item$/i })
    expect(bulk.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.click(add)
    expect(onShowAddTask).toHaveBeenCalled()
  })

  it("keeps typed text in the field and submits it on Add Item", () => {
    const onAddTask = vi.fn()
    renderPanel({
      addingTaskToTarget: "folder1",
      openTargetKeyValue: "folder1",
      onAddTask,
      openFolderAll: false,
      openCategory: list("list-1", "list 1"),
      currentDisplay: "default",
      tasks: [task("a", "item a", "list-1")],
    })
    const field = screen.getByPlaceholderText(/Enter item description/i)
    fireEvent.change(field, { target: { value: "New grocery item" } })
    expect(field).toHaveValue("New grocery item")
    expect(onAddTask).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Add Item" }))
    expect(onAddTask).toHaveBeenCalledWith("New grocery item")
  })

  it("submits a single item on Enter without pressing the button", () => {
    const onAddTask = vi.fn()
    renderPanel({
      addingTaskToTarget: "folder1",
      openTargetKeyValue: "folder1",
      onAddTask,
      openFolderAll: false,
      openCategory: list("list-1", "list 1"),
      currentDisplay: "default",
      tasks: [task("a", "item a", "list-1")],
    })
    const field = screen.getByPlaceholderText(/Enter item description/i)
    fireEvent.change(field, { target: { value: "From enter key" } })
    fireEvent.keyDown(field, { key: "Enter" })
    expect(onAddTask).toHaveBeenCalledWith("From enter key")
  })
})
