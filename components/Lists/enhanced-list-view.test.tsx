/**
 * EnhancedCategoryView — Lists file manager board.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { EnhancedCategoryView } from "./enhanced-list-view"

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

  it("filters entries when searching", async () => {
    const user = userEvent.setup()
    render(<EnhancedCategoryView onTaskSelect={vi.fn()} />)
    await user.type(screen.getByPlaceholderText("Search folders, lists, items…"), "Demo")
    expect(screen.getByText(/Search: Demo/)).toBeInTheDocument()
  })

  it("opens settings dialog from toolbar", async () => {
    const user = userEvent.setup()
    render(<EnhancedCategoryView onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: "Settings" }))
    expect(screen.getByTestId("lists-settings")).toBeInTheDocument()
  })
})
