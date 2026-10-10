/**
 * EnhancedTaskDetail — full-screen task editor.
 */
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { readListsNavigation } from "@/lib/app-navigation"
import { getWeekString } from "@/lib/date-utils"
import { armHabitSettingsReturn, peekHabitSettingsReturn } from "@/lib/habit-list-item"
import { useHabitsStore } from "@/lib/habits-store"
import { listItemActivity, resetItemActivity } from "@/lib/item-activity"
import { useTaskStore } from "@/lib/task-store"
import { useItemTypeStore } from "@/lib/item-type-store"
import { TaskType } from "@/lib/types"
import { EnhancedTaskDetail } from "@/components/ItemDetail/ItemDetailPage"

describe("EnhancedTaskDetail", () => {
  const onBack = vi.fn()

  beforeEach(() => {
    resetLocalStorage()
    resetItemActivity()
    onBack.mockClear()
    useItemTypeStore.getState().resetTypes()
    useTaskStore.getState().clearAllData()
    useTaskStore.getState().addTask({
      id: "task-detail-1",
      description: "Write release notes",
      type: "task",
      stage: "list",
      createdAt: new Date(),
      estimatedDuration: 45,
      cognitiveLoad: 2,
      urgency: 3,
      importance: 4,
      dependencies: [],
      context: "@work",
      entropy: 0.4,
      rewardValue: 20,
      completed: false,
      lists: [],
      allowPartialCompletion: false,
      minimumChunkSize: 15,
    })
  })

  it("renders the task title and tabs", () => {
    render(<EnhancedTaskDetail taskId="task-detail-1" onBack={onBack} />)
    expect(screen.getByRole("heading", { name: "Write release notes" })).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("Saved")
    expect(screen.getByRole("tab", { name: "Details" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Scheduling" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "History" })).toBeInTheDocument()
  })

  it("shows not found when task id is missing", () => {
    render(<EnhancedTaskDetail taskId="missing" onBack={onBack} />)
    expect(screen.getByText("Item not found")).toBeInTheDocument()
  })

  it("enters edit mode and saves estimated duration to the store", async () => {
    const user = userEvent.setup()
    render(<EnhancedTaskDetail taskId="task-detail-1" onBack={onBack} />)
    await user.click(screen.getByRole("button", { name: /^Edit$/i }))
    const durationInput = screen.getByLabelText(/Estimated Duration/i)
    await user.clear(durationInput)
    await user.type(durationInput, "90")
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes")
    await user.click(screen.getByRole("button", { name: /^Save$/i }))
    expect(screen.getByRole("status")).toHaveTextContent("Saved")
    expect(useTaskStore.getState().tasks[0].estimatedDuration).toBe(90)
    const rows = listItemActivity("task-detail-1")
    expect(rows).toHaveLength(1)
    expect(rows[0].changes.some((c) => c.field === "estimatedDuration" && c.to === "90")).toBe(true)
    await user.click(screen.getByRole("tab", { name: "History" }))
    expect(screen.getByText(/Estimated duration/)).toBeInTheDocument()
  })

  it("saves unsaved edits with Ctrl+S", async () => {
    const user = userEvent.setup()
    render(<EnhancedTaskDetail taskId="task-detail-1" onBack={onBack} />)
    await user.click(screen.getByRole("button", { name: /^Edit$/i }))
    const durationInput = screen.getByLabelText(/Estimated Duration/i)
    await user.clear(durationInput)
    await user.type(durationInput, "90")
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes")
    const event = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, cancelable: true })
    await act(async () => {
      window.dispatchEvent(event)
    })
    expect(event.defaultPrevented).toBe(true)
    expect(useTaskStore.getState().tasks[0].estimatedDuration).toBe(90)
    expect(screen.getByRole("status")).toHaveTextContent("Saved")
    expect(screen.getByRole("button", { name: /^Edit$/i })).toBeInTheDocument()
  })

  it("deletes the item from the danger-quiet Delete key", async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true)
    render(<EnhancedTaskDetail taskId="task-detail-1" onBack={onBack} />)

    await user.click(screen.getByRole("button", { name: /^Delete$/i }))

    expect(confirmSpy).toHaveBeenCalledWith('Delete "Write release notes"? This cannot be undone.')
    expect(useTaskStore.getState().tasks).toHaveLength(0)
    expect(onBack).toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it("hides Scheduling and Task Information for a generic item", () => {
    useTaskStore.getState().addTask({
      id: "item-detail-1",
      description: "big area rug",
      type: "furniture",
      stage: "list",
      createdAt: new Date(),
      completed: false,
      lists: [],
    })
    render(<EnhancedTaskDetail taskId="item-detail-1" onBack={onBack} />)
    expect(screen.getByRole("heading", { name: "big area rug" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Details" })).toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "Scheduling" })).not.toBeInTheDocument()
    expect(screen.queryByText("Task Information")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Complete$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Habit completion" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Habit settings" })).not.toBeInTheDocument()
  })

  it("shows notes, a completion summary, and Habit settings for a habit-linked item", async () => {
    const user = userEvent.setup()
    const pastWeek = getWeekString(new Date(2026, 8, 7))
    useHabitsStore.setState({
      tasks: [
        {
          id: "task-h",
          name: "post a tiktok",
          type: TaskType.BOOLEAN,
          frequency: "weekly",
          rewardValue: 10,
          taggedTaskTag: "tiktok",
          trackingLink: { tagIds: ["tag-work"], unit: "minutes", mode: "add", enabled: true },
        },
      ],
      weeklyHabitData: {
        [pastWeek]: { "task-h": { completed: true } },
      },
    })
    useTaskStore.getState().addTask({
      id: "habit-item-1",
      description: "post a tiktok",
      type: "item",
      stage: "list",
      createdAt: new Date(),
      completed: false,
      lists: ["list-habits-standing"],
      notes: "",
      attributes: { sourceHabitId: "task-h" },
    })
    render(<EnhancedTaskDetail taskId="habit-item-1" onBack={onBack} />)

    expect(screen.getByRole("textbox", { name: "Notes" })).toHaveValue("")
    const panel = screen.getByRole("region", { name: "Habit completion" })
    expect(panel).toHaveTextContent("post a tiktok")
    expect(panel).toHaveTextContent("Frequency: Weekly")
    expect(panel).toHaveTextContent("Goal: Yes / No")
    expect(panel).toHaveTextContent("This week: Not done")
    expect(panel).toHaveTextContent(pastWeek.split("_")[0])
    expect(panel).toHaveTextContent("Counts: tiktok")
    expect(panel).toHaveTextContent("Minutes: Work")
    expect(screen.getByRole("button", { name: "Habit settings" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Habit settings" }))
    expect(peekHabitSettingsReturn()).toBe("task-h")
    expect(onBack).toHaveBeenCalled()
  })

  it("opens the item's list from the list chip without returning to habit settings", async () => {
    const user = userEvent.setup()
    sessionStorage.clear()
    useTaskStore.getState().setLists([
      {
        id: "list-habits-standing",
        name: "Habits",
        color: "#000080",
        createdAt: new Date(),
        description: "",
      },
    ])
    useTaskStore.getState().setFolders([
      {
        id: "folder-life",
        name: "Life",
        createdAt: new Date(),
        listIds: ["list-habits-standing"],
      },
    ])
    useTaskStore.getState().addTask({
      id: "habit-item-1",
      description: "post a tiktok",
      type: "item",
      stage: "list",
      createdAt: new Date(),
      completed: false,
      lists: ["list-habits-standing"],
      attributes: { sourceHabitId: "task-h" },
    })
    armHabitSettingsReturn("task-h")
    render(<EnhancedTaskDetail taskId="habit-item-1" onBack={onBack} />)

    await user.dblClick(screen.getByTitle("Double-click to open this list"))
    expect(onBack).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(readListsNavigation()).toEqual({
        location: "folder-life",
        openTarget: { type: "category", id: "list-habits-standing" },
      })
    })
  })

  it("still opens a non-habit list chip through the same list path", async () => {
    const user = userEvent.setup()
    sessionStorage.clear()
    useTaskStore.getState().setLists([
      {
        id: "reading",
        name: "Reading",
        color: "#336699",
        createdAt: new Date(),
        description: "",
      },
    ])
    useTaskStore.getState().setFolders([
      {
        id: "folder-books",
        name: "Books",
        createdAt: new Date(),
        listIds: ["reading"],
      },
    ])
    useTaskStore.getState().addTask({
      id: "book-item",
      description: "Field guide",
      type: "item",
      stage: "list",
      createdAt: new Date(),
      completed: false,
      lists: ["reading"],
    })
    render(<EnhancedTaskDetail taskId="book-item" onBack={onBack} />)
    await user.dblClick(screen.getByTitle("Double-click to open this list"))
    expect(onBack).toHaveBeenCalled()
    await waitFor(() => {
      expect(readListsNavigation().openTarget).toEqual({ type: "category", id: "reading" })
      expect(readListsNavigation().location).toBe("folder-books")
    })
    expect(screen.queryByRole("region", { name: "Habit completion" })).not.toBeInTheDocument()
  })
})
