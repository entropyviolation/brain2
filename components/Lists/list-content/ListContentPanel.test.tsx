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
    onFolderAllListHiddenChange: vi.fn(),
    addingTaskToTarget: null,
    openTargetKeyValue: "folder1",
    newTaskDescription: "",
    onNewTaskDescriptionChange: vi.fn(),
    onAddTask: vi.fn(),
    onCancelAddTask: vi.fn(),
    showBulkAdd: false,
    bulkAddText: "",
    onBulkAddTextChange: vi.fn(),
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
  it("renders a checkbox for every list in the folder under bulk add, all selected by default", () => {
    renderPanel()
    expect(screen.getByRole("button", { name: /Bulk add items/i })).toBeInTheDocument()
    const list1 = screen.getByRole("checkbox", { name: "list 1" })
    const list2 = screen.getByRole("checkbox", { name: "list 2" })
    expect(list1).toBeChecked()
    expect(list2).toBeChecked()
    const filter = screen.getByRole("group", { name: "Filter lists" })
    const bulk = screen.getByRole("button", { name: /Bulk add items/i })
    expect(bulk.compareDocumentPosition(filter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("notifies when a list is unselected", () => {
    const { props } = renderPanel()
    fireEvent.click(screen.getByRole("checkbox", { name: "list 1" }))
    expect(props.onFolderAllListHiddenChange).toHaveBeenCalledWith("folder1", "list-1", true)
  })

  it("does not show the list filter in non-default displays", () => {
    renderPanel({ currentDisplay: "checklist" })
    expect(screen.queryByRole("group", { name: "Filter lists" })).not.toBeInTheDocument()
    expect(screen.getByText("item a")).toBeInTheDocument()
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
    fireEvent.click(screen.getByRole("button", { name: "Complete" }))
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
