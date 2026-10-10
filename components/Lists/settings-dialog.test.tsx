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
    expect(screen.getByRole("region", { name: "Notes and ingest" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Ingest/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /From Notes/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Phone Notes/i })).toBeInTheDocument()
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

  it("calls onClose when Save arrangement is clicked", async () => {
    const user = userEvent.setup()
    render(<NextActionsSettingsDialog open onClose={onClose} />)
    await user.click(screen.getByRole("button", { name: /Save arrangement/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it("filters the library and opens a folder on double-click", async () => {
    useTaskStore.getState().setFolders([
      {
        id: "work",
        name: "Work",
        createdAt: new Date(),
        listIds: ["alpha"],
      },
    ])
    const user = userEvent.setup()
    render(<NextActionsSettingsDialog open onClose={onClose} />)

    expect(screen.getByText("Work")).toBeInTheDocument()
    expect(screen.getByText("Beta List")).toBeInTheDocument()
    expect(screen.queryByText("Alpha List")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Folders" }))
    expect(screen.queryByText("Beta List")).not.toBeInTheDocument()
    expect(screen.getByText("Work")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "All" }))
    await user.type(screen.getByRole("textbox", { name: "Search folders and lists" }), "beta")
    expect(screen.getByText("Beta List")).toBeInTheDocument()
    expect(screen.queryByText("Work")).not.toBeInTheDocument()

    await user.clear(screen.getByRole("textbox", { name: "Search folders and lists" }))
    await user.dblClick(screen.getByText("Work"))
    expect(screen.getByText("Alpha List")).toBeInTheDocument()
    expect(screen.queryByText("Beta List")).not.toBeInTheDocument()
  })

  it("gives the import tab a scroll well", async () => {
    const user = userEvent.setup()
    render(<NextActionsSettingsDialog open onClose={onClose} />)
    await user.click(screen.getByRole("tab", { name: "Import/Export" }))
    const panel = screen.getByTestId("lists-import")
    expect(panel.className).toContain("lst-tab-scroll")
    expect(panel).toHaveTextContent("Total Tasks")
  })
})
