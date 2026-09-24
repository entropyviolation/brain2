/**
 * EnhancedTaskDetail — full-screen task editor.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { listItemActivity, resetItemActivity } from "@/lib/item-activity"
import { useTaskStore } from "@/lib/task-store"
import { useItemTypeStore } from "@/lib/item-type-store"
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
    await user.click(screen.getByRole("button", { name: /Save Changes/i }))
    expect(useTaskStore.getState().tasks[0].estimatedDuration).toBe(90)
    const rows = listItemActivity("task-detail-1")
    expect(rows).toHaveLength(1)
    expect(rows[0].changes.some((c) => c.field === "estimatedDuration" && c.to === "90")).toBe(true)
    await user.click(screen.getByRole("tab", { name: "History" }))
    expect(screen.getByText(/Estimated duration/)).toBeInTheDocument()
  })

  it("deletes the item from the more-actions menu", async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true)
    render(<EnhancedTaskDetail taskId="task-detail-1" onBack={onBack} />)

    await user.click(screen.getByRole("button", { name: "More actions" }))
    await user.click(screen.getByRole("menuitem", { name: /Delete Item/i }))

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
  })
})
