/**
 * NextActionsSettingsDialog — list settings and import/export.
 */
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { NextActionsSettingsDialog } from "./settings-dialog"

describe("NextActionsSettingsDialog", () => {
  const onClose = vi.fn()

  beforeEach(() => {
    resetLocalStorage()
    onClose.mockClear()
    useTaskStore.getState().clearAllData()
    useTaskStore.getState().setLists([
      {
        id: "alpha",
        name: "Alpha List",
        color: "#3B82F6",
        description: "",
        createdAt: new Date(),
        order: 0,
      },
      {
        id: "beta",
        name: "Beta List",
        color: "#EF4444",
        description: "",
        createdAt: new Date(),
        order: 1,
      },
    ])
  })

  it("renders when open with lists from the store", () => {
    render(<NextActionsSettingsDialog open onClose={onClose} />)
    expect(screen.getByText("Lists Settings")).toBeInTheDocument()
    expect(screen.getByText("Alpha List")).toBeInTheDocument()
    expect(screen.getByText("Beta List")).toBeInTheDocument()
  })

  it("shows import/export tab with data summary", async () => {
    const user = userEvent.setup()
    render(<NextActionsSettingsDialog open onClose={onClose} />)
    await user.click(screen.getByRole("tab", { name: "Import/Export" }))
    expect(screen.getByText("Total Tasks")).toBeInTheDocument()
    expect(within(screen.getByRole("tabpanel")).getByText("2")).toBeInTheDocument()
  })

  it("calls onClose when Save Order is clicked", async () => {
    const user = userEvent.setup()
    render(<NextActionsSettingsDialog open onClose={onClose} />)
    await user.click(screen.getByRole("button", { name: /Save Order/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
