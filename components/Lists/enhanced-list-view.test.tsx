/**
 * EnhancedCategoryView — Lists file manager board.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { EnhancedCategoryView } from "./enhanced-list-view"

vi.mock("@/components/ItemDetail/ItemDetailPopup", () => ({
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

describe("EnhancedCategoryView", () => {
  beforeEach(() => {
    resetLocalStorage()
    useTaskStore.getState().clearAllData()
    useTaskStore.getState().setLists([
      {
        id: "demo-list",
        name: "Demo List",
        color: "#3B82F6",
        description: "",
        createdAt: new Date(),
        order: 0,
      },
    ])
  })

  it("renders the file manager title bar", () => {
    render(<EnhancedCategoryView onTaskSelect={vi.fn()} />)
    expect(screen.getByText("Lists — File Manager")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "New List" })).toBeInTheDocument()
  })

  it("clears search when navigating via Quick Access", async () => {
    const user = userEvent.setup()
    render(<EnhancedCategoryView onTaskSelect={vi.fn()} />)
    await user.type(screen.getByPlaceholderText("Search folders, lists, items…"), "Demo")
    expect(await screen.findByText(/Search: Demo/)).toBeInTheDocument()
    expect(screen.getByText(/Lists \(1\)/)).toBeInTheDocument()
    await user.click(screen.getByText("All"))
    expect(screen.queryByText(/Search: Demo/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Lists \(1\)/)).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText("Search folders, lists, items…")).toHaveValue("")
  })

  it("clears search when the folder tree chooses a location", async () => {
    const user = userEvent.setup()
    useTaskStore.getState().setFolders([
      { id: "folder-desk", name: "Work Desk", createdAt: new Date(), listIds: [] },
    ])
    render(<EnhancedCategoryView onTaskSelect={vi.fn()} />)
    await user.type(screen.getByPlaceholderText("Search folders, lists, items…"), "Demo")
    expect(await screen.findByText(/Search: Demo/)).toBeInTheDocument()
    await user.click(screen.getByText("Work Desk"))
    expect(screen.queryByText(/Search: Demo/)).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText("Search folders, lists, items…")).toHaveValue("")
  })

  it("opens settings dialog from toolbar", async () => {
    const user = userEvent.setup()
    render(<EnhancedCategoryView onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: "Settings" }))
    expect(screen.getByTestId("lists-settings")).toBeInTheDocument()
  })

  it("labels the two status counts as this folder vs tree", () => {
    render(<EnhancedCategoryView onTaskSelect={vi.fn()} />)
    expect(screen.getByTestId("fm-status-here")).toHaveTextContent(/This folder:/)
    expect(screen.getByTestId("fm-status-tree")).toHaveTextContent(/Tree:/)
  })

  it("groups the toolbar with Explorer separators", () => {
    render(<EnhancedCategoryView onTaskSelect={vi.fn()} />)
    expect(screen.getByRole("separator", { name: "New" })).toBeInTheDocument()
    expect(screen.getByRole("separator", { name: "View" })).toBeInTheDocument()
    expect(screen.getByRole("separator", { name: "Organize" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Completed" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Missed Opportunities" })).not.toBeInTheDocument()
  })
})
