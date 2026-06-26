/**
 * EnhancedTaskDetail — full-screen task editor.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { EnhancedTaskDetail } from "./enhanced-task-detail"

describe("EnhancedTaskDetail", () => {
  const onBack = vi.fn()

  beforeEach(() => {
    resetLocalStorage()
    onBack.mockClear()
    useTaskStore.getState().clearAllData()
    useTaskStore.getState().addTask({
      id: "task-detail-1",
      description: "Write release notes",
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
  })

  it("shows not found when task id is missing", () => {
    render(<EnhancedTaskDetail taskId="missing" onBack={onBack} />)
    expect(screen.getByText("Task not found")).toBeInTheDocument()
  })

  it("enters edit mode and saves estimated duration to the store", async () => {
    const user = userEvent.setup()
    render(<EnhancedTaskDetail taskId="task-detail-1" onBack={onBack} />)
    await user.click(screen.getByRole("button", { name: /Edit Task/i }))
    const durationInput = screen.getByLabelText(/Estimated Duration/i)
    await user.clear(durationInput)
    await user.type(durationInput, "90")
    await user.click(screen.getByRole("button", { name: /Save Changes/i }))
    expect(useTaskStore.getState().tasks[0].estimatedDuration).toBe(90)
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
})
