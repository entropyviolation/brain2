import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { EnhancedCategoryView } from "../enhanced-list-view"

vi.mock("@/components/task-detail-popup", () => ({
  TaskDetailPopup: () => null,
}))

vi.mock("@/components/Lists/settings-dialog", () => ({
  NextActionsSettingsDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="lists-settings">Settings</div> : null,
}))

vi.mock("@/components/Lists/daily-habits-list", () => ({
  DailyHabitsList: () => <div data-testid="daily-habits">Daily habits</div>,
  WeeklyHabitsList: () => <div data-testid="weekly-habits">Weekly habits</div>,
  MonthlyHabitsList: () => <div data-testid="monthly-habits">Monthly habits</div>,
}))

vi.mock("@/components/Lists/objectives-list", () => ({
  ObjectivesList: () => <div data-testid="objectives-list">Objectives</div>,
}))

vi.mock("@/lib/remove-background", () => ({
  removeBackground: vi.fn(),
}))

describe("EnhancedCategoryView Integration", () => {
  beforeEach(() => {
    resetLocalStorage()
    useTaskStore.getState().clearAllData()
    useTaskStore.getState().setLists([
      {
        id: "list-1",
        name: "Work Tasks",
        color: "#ff0000",
        description: "",
        createdAt: new Date(),
        order: 0,
      },
    ])
    useTaskStore.getState().addTask({
      id: "task-1",
      description: "Complete project",
      lists: ["list-1"],
      stage: "list",
      completed: false,
      createdAt: new Date(),
      urgency: 1,
      importance: 1,
    })
  })

  it("displays tasks when a list is opened", async () => {
    render(<EnhancedCategoryView onTaskSelect={vi.fn()} />)
    fireEvent.click(screen.getByText("All"))
    fireEvent.click(screen.getByRole("button", { name: "List" }))
    fireEvent.dblClick(screen.getByText(/Work Tasks/))
    await waitFor(() => {
      expect(screen.getByText("Complete project")).toBeInTheDocument()
    })
  })

  it("filters tasks by search", async () => {
    const user = userEvent.setup()
    render(<EnhancedCategoryView onTaskSelect={vi.fn()} />)
    const searchInput = screen.getByPlaceholderText("Search folders, lists, items…")
    await user.type(searchInput, "project")
    expect(screen.getByText(/Search: project/i)).toBeInTheDocument()
    expect(screen.getByText("Complete project")).toBeInTheDocument()
  })

  it("creates a new task via quick add", async () => {
    const user = userEvent.setup()
    render(<EnhancedCategoryView onTaskSelect={vi.fn()} />)
    fireEvent.click(screen.getByText("All"))
    fireEvent.click(screen.getByRole("button", { name: "List" }))
    fireEvent.dblClick(screen.getByText(/Work Tasks/))
    await waitFor(() => expect(screen.getByText("Complete project")).toBeInTheDocument())
    const addButtons = screen.getAllByRole("button", { name: "Add Item" })
    fireEvent.click(addButtons[addButtons.length - 1])
    const quickAdd = document.querySelector(".fm-quickadd")!
    const textarea = within(quickAdd as HTMLElement).getByPlaceholderText(/enter .* description/i)
    await user.type(textarea, "New test task")
    fireEvent.click(within(quickAdd as HTMLElement).getByRole("button", { name: "Add Item" }))
    await waitFor(() => {
      expect(screen.getByText("New test task")).toBeInTheDocument()
    })
  })

  it("completes a task via checkbox in checklist view", async () => {
    render(<EnhancedCategoryView onTaskSelect={vi.fn()} />)
    fireEvent.click(screen.getByText("All"))
    fireEvent.click(screen.getByRole("button", { name: "List" }))
    fireEvent.dblClick(screen.getByText(/Work Tasks/))
    await waitFor(() => expect(screen.getByText("Complete project")).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "Checklist" }))
    const completeButton = screen.getByRole("button", { name: "Complete" })
    fireEvent.click(completeButton)
    await waitFor(() => {
      expect(useTaskStore.getState().tasks.find((t) => t.id === "task-1")?.completed).toBe(true)
    })
  })
})
