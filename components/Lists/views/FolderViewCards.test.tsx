import { fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"
import type { List, Task } from "@/lib/types"
import type { GridEntry } from "@/components/Lists/types"
import { FolderViewCards } from "./FolderViewCards"

vi.mock("@/components/Lists/lib/icon-utils", () => ({
  FolderGlyph: () => <span data-testid="folder-glyph" />,
  iconFor: () => "/orb.png",
  orbFor: () => "/orb.png",
}))

const list = (id: string, name: string): List => ({
  id,
  name,
  color: "#3B82F6",
  description: "",
  createdAt: new Date(),
  order: 0,
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

const listEntry = (id: string, name: string): GridEntry => ({
  kind: "list",
  id,
  name,
  color: "#3B82F6",
  count: 1,
})

function renderCards(overrides: Partial<ComponentProps<typeof FolderViewCards>> = {}) {
  const work = list("work", "Work")
  const home = list("home", "Home")
  const categoryById = new Map<string, List>([
    ["work", work],
    ["home", home],
  ])
  const tasksByList = new Map<string, Task[]>([
    ["work", [task("t1", "Ship it", "work")]],
    ["home", [task("t2", "Dishes", "home")]],
  ])
  const props: ComponentProps<typeof FolderViewCards> = {
    entries: [listEntry("work", "Work"), listEntry("home", "Home")],
    categoryById,
    selectMode: false,
    selectedCategories: [],
    addingTaskToTarget: null,
    scopeKey: "all",
    getSmartTasks: () => [],
    getTasksForCategory: (id) => tasksByList.get(id) ?? [],
    getCategoryCompletionRate: () => 0,
    itemLabelFor: () => "Item",
    handleDragOver: vi.fn(),
    handleDropOnEntry: vi.fn(),
    handleCategoryDragStart: vi.fn(),
    handleTaskDragStart: vi.fn(),
    clearDrag: vi.fn(),
    openEntry: vi.fn(),
    setSelectedCategories: vi.fn(),
    setSelectedTaskId: vi.fn(),
    setAddingTaskToTarget: vi.fn(),
    setEditingCategory: vi.fn(),
    deleteList: vi.fn(),
    handleAddTaskToCategory: vi.fn(),
    handleCompleteTask: vi.fn(),
    ...overrides,
  }
  return { ...render(<FolderViewCards {...props} />), props }
}

describe("FolderViewCards", () => {
  it("hides a list immediately when delete is clicked", () => {
    const deleteList = vi.fn()
    renderCards({ deleteList })
    expect(screen.getByText("Work")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Delete Work" }))
    expect(screen.queryByText("Work")).not.toBeInTheDocument()
    expect(screen.getByText("Home")).toBeInTheDocument()
    expect(deleteList).toHaveBeenCalledWith("work")
  })

  it("keeps typing inside the add form without requiring parent text state", () => {
    const handleAddTaskToCategory = vi.fn()
    renderCards({ addingTaskToTarget: "work", handleAddTaskToCategory })
    const textarea = screen.getByPlaceholderText(/enter item description/i)
    fireEvent.change(textarea, { target: { value: "New card item" } })
    expect(textarea).toHaveValue("New card item")
    fireEvent.click(screen.getByRole("button", { name: "Add Item" }))
    expect(handleAddTaskToCategory).toHaveBeenCalledWith("work", "New card item")
  })

  it("shows a loading status while revealing many lists", () => {
    const manyLists = Array.from({ length: 16 }, (_, i) => list(`l${i}`, `List ${i}`))
    const categoryById = new Map(manyLists.map((c) => [c.id, c]))
    renderCards({
      entries: manyLists.map((c) => listEntry(c.id, c.name)),
      categoryById,
      getTasksForCategory: () => [],
    })
    expect(screen.getByTestId("fm-cards-status")).toHaveTextContent(/loading lists/i)
    expect(screen.getByText("List 0")).toBeInTheDocument()
    expect(screen.queryByText("List 15")).not.toBeInTheDocument()
  })

  it("caps long lists and offers an open-list control", () => {
    const many = Array.from({ length: 12 }, (_, i) => task(`t${i}`, `Task ${i}`, "work"))
    const openEntry = vi.fn()
    renderCards({
      getTasksForCategory: (id) => (id === "work" ? many : []),
      openEntry,
    })
    expect(screen.getByText("Task 0")).toBeInTheDocument()
    expect(screen.queryByText("Task 11")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /\+ 4 more — open list/i }))
    expect(openEntry).toHaveBeenCalled()
  })
})
