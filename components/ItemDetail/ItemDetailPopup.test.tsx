/**
 * TaskDetailPopup — compact inline task detail modal.
 */
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { listItemActivity, resetItemActivity } from "@/lib/item-activity"
import { useTaskStore } from "@/lib/task-store"
import { useItemTypeStore } from "@/lib/item-type-store"
import { TaskDetailPopup } from "@/components/ItemDetail/ItemDetailPopup"

describe("TaskDetailPopup", () => {
  const onClose = vi.fn()

  beforeEach(() => {
    resetLocalStorage()
    resetItemActivity()
    onClose.mockClear()
    useItemTypeStore.getState().resetTypes()
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
    expect(screen.getByRole("tab", { name: /History/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Complete/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Sent" })).not.toBeInTheDocument()
  })

  it("hides Sent when the list has not opted in, and shows it when Sent this week is on", () => {
    const { rerender } = render(<TaskDetailPopup taskId="popup-task" open onClose={onClose} />)
    expect(screen.queryByRole("button", { name: "Sent" })).not.toBeInTheDocument()

    act(() => {
      useTaskStore.getState().updateList({
        ...useTaskStore.getState().lists[0],
        sentThisWeek: true,
      })
    })
    rerender(<TaskDetailPopup taskId="popup-task" open onClose={onClose} />)
    expect(screen.getByRole("button", { name: "Sent" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Delete/i })).toBeInTheDocument()
  })

  it("shows Send to Scheduler on the Scheduling tab with inherit-on for lists sent there", async () => {
    const user = userEvent.setup()
    render(<TaskDetailPopup taskId="popup-task" open onClose={onClose} />)
    await user.click(screen.getByRole("tab", { name: /Scheduling/i }))
    expect(screen.getByText("Send to Scheduler")).toBeInTheDocument()
    const toggle = screen.getByRole("switch", { name: "Send to Scheduler" })
    expect(toggle).toBeChecked()
    await user.click(toggle)
    expect(toggle).not.toBeChecked()
    await user.click(screen.getByRole("button", { name: /Save Changes/i }))
    expect(useTaskStore.getState().tasks.find((t) => t.id === "popup-task")?.scheduleable).toBe(false)
  })

  it("leaves Auto-push off until the Scheduling switch is turned on", async () => {
    const user = userEvent.setup()
    render(<TaskDetailPopup taskId="popup-task" open onClose={onClose} />)
    await user.click(screen.getByRole("tab", { name: /Scheduling/i }))
    const auto = screen.getByRole("switch", { name: "Auto-push" })
    expect(auto).not.toBeChecked()
    await user.click(auto)
    await user.click(screen.getByRole("button", { name: /Save Changes/i }))
    const saved = useTaskStore.getState().tasks.find((t) => t.id === "popup-task")
    expect(saved?.autoPush).toBe(true)
    expect(saved?.scheduleable).toBeUndefined()
  })

  it("shows Save Changes after editing description and persists to store", async () => {
    const user = userEvent.setup({ delay: null })
    render(<TaskDetailPopup taskId="popup-task" open onClose={onClose} />)
    const nameInput = screen.getByDisplayValue("Plan sprint demo")
    fireEvent.change(nameInput, { target: { value: "Plan team demo" } })
    await user.click(screen.getByRole("button", { name: /Save Changes/i }))
    expect(useTaskStore.getState().tasks[0].description).toBe("Plan team demo")
    const rows = listItemActivity("popup-task")
    expect(rows[0]?.changes.some((c) => c.field === "title" && c.to === "Plan team demo")).toBe(true)
    await user.click(screen.getByRole("tab", { name: /History/i }))
    expect(screen.getByText(/Plan team demo/)).toBeInTheDocument()
  })

  it("opens the item type editor when a type badge is double-clicked", async () => {
    const user = userEvent.setup()
    render(<TaskDetailPopup taskId="popup-task" open onClose={onClose} />)
    await user.dblClick(screen.getByTitle("Double-click to view or edit this type"))
    expect(await screen.findByRole("dialog", { name: /Task \(system\)/i })).toBeInTheDocument()
    expect(screen.getByText(/Items of this type/i)).toBeInTheDocument()
  })

  it("navigates to a list when its badge is double-clicked", async () => {
    const user = userEvent.setup()
    render(<TaskDetailPopup taskId="popup-task" open onClose={onClose} />)
    await user.dblClick(screen.getByTitle("Double-click to open this list"))
    expect(onClose).toHaveBeenCalled()
    await waitFor(() => {
      expect(localStorage.getItem("brain2-lists-navigation")).toContain("na-list")
    })
  })

  it("hides Scheduling and Complete for a non-scheduleable furniture item", () => {
    useTaskStore.getState().setLists([
      {
        id: "wishlist",
        name: "Wishlist",
        color: "#78716c",
        description: "",
        createdAt: new Date(),
        order: 0,
        scheduleable: false,
        itemTypeId: "furniture",
      },
    ])
    useTaskStore.getState().setFolders([
      {
        id: "folder-stuff",
        name: "Stuff",
        color: "#78716c",
        listIds: ["wishlist"],
        createdAt: new Date(),
      },
    ])
    useTaskStore.getState().addTask({
      id: "rug-1",
      description: "big area rug",
      type: "furniture",
      stage: "list",
      createdAt: new Date(),
      completed: false,
      lists: ["wishlist"],
    })
    render(<TaskDetailPopup taskId="rug-1" open onClose={onClose} />)
    expect(screen.getByDisplayValue("big area rug")).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /Details/i })).toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: /Scheduling/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: /Subtasks/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: /Analysis/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Complete$/i })).not.toBeInTheDocument()
    expect(screen.getByText(/No photo yet/i)).toBeInTheDocument()
    expect(screen.queryByText("Send to Scheduler")).not.toBeInTheDocument()
    expect(screen.queryByText("Show in Scheduler")).not.toBeInTheDocument()
    expect(screen.queryByText("Repeated Task Settings")).not.toBeInTheDocument()
  })

  it("shows a Book cover hero and featured pages-read without Scheduling", () => {
    useTaskStore.getState().setLists([
      {
        id: "reading",
        name: "Reading",
        color: "#b45309",
        description: "",
        createdAt: new Date(),
        order: 0,
        itemTypeId: "book",
      },
    ])
    useTaskStore.getState().setFolders([
      {
        id: "folder-books",
        name: "Books",
        color: "#b45309",
        listIds: ["reading"],
        createdAt: new Date(),
      },
    ])
    useTaskStore.getState().addTask({
      id: "book-1",
      description: "Dune",
      type: "book",
      stage: "list",
      createdAt: new Date(),
      completed: false,
      lists: ["reading"],
      attributes: { pagesRead: 0, pageCount: 500, status: "reading" },
    })
    render(<TaskDetailPopup taskId="book-1" open onClose={onClose} />)
    expect(screen.getByText(/No cover yet/i)).toBeInTheDocument()
    expect(screen.getByText(/Pages read/i)).toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: /Scheduling/i })).not.toBeInTheDocument()
  })
})
