/**
 * TaskDetailPopup — compact inline task detail modal.
 */
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { TaskDetailPopup } from "./task-detail-popup"

describe("TaskDetailPopup", () => {
  const onClose = vi.fn()

  beforeEach(() => {
    resetLocalStorage()
    onClose.mockClear()
    useTaskStore.getState().clearAllData()
    useTaskStore.getState().setLists([
      {
        id: "na-list",
        name: "Work Tasks",
        color: "#3B82F6",
        description: "",
        createdAt: new Date(),
        order: 0,
        scheduleable: true,
      },
    ])
    useTaskStore.getState().setFolders([
      {
        id: "folder-na",
        name: "Next Actions",
        color: "#3B82F6",
        listIds: ["na-list"],
        createdAt: new Date(),
      },
    ])
    useTaskStore.getState().addTask({
      id: "popup-task",
      description: "Plan sprint demo",
      stage: "list",
      createdAt: new Date(),
      estimatedDuration: 30,
      cognitiveLoad: 2,
      urgency: 4,
      importance: 4,
      dependencies: [],
      context: "@work",
      entropy: 0.3,
      rewardValue: 25,
      completed: false,
      lists: ["na-list"],
      allowPartialCompletion: false,
      minimumChunkSize: 15,
    })
  })

  it("renders nothing meaningful when closed", () => {
    render(<TaskDetailPopup taskId="popup-task" open={false} onClose={onClose} />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("renders key sections when open", () => {
    render(<TaskDetailPopup taskId="popup-task" open onClose={onClose} />)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Plan sprint demo")).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /Details/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /Scheduling/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Complete Task/i })).toBeInTheDocument()
  })

  it("shows Save Changes after editing description and persists to store", async () => {
    const user = userEvent.setup({ delay: null })
    render(<TaskDetailPopup taskId="popup-task" open onClose={onClose} />)
    const nameInput = screen.getByDisplayValue("Plan sprint demo")
    fireEvent.change(nameInput, { target: { value: "Plan team demo" } })
    await user.click(screen.getByRole("button", { name: /Save Changes/i }))
    expect(useTaskStore.getState().tasks[0].description).toBe("Plan team demo")
  })

  it("opens the item type editor when a type badge is double-clicked", async () => {
    const user = userEvent.setup()
    render(<TaskDetailPopup taskId="popup-task" open onClose={onClose} />)
    await user.dblClick(screen.getByTitle("Double-click to view or edit this type"))
    expect(await screen.findByRole("dialog", { name: /Task \(built-in\)/i })).toBeInTheDocument()
    expect(screen.getByText(/Items of this type/i)).toBeInTheDocument()
  })

  it("navigates to a list when its badge is double-clicked", async () => {
    const user = userEvent.setup()
    render(<TaskDetailPopup taskId="popup-task" open onClose={onClose} />)
    await user.dblClick(screen.getByTitle("Double-click to open this list"))
    expect(onClose).toHaveBeenCalled()
    expect(localStorage.getItem("cogs-lists-navigation")).toContain("na-list")
  })
})
