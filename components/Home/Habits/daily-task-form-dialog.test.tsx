import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TaskType } from "@/lib/types"
import { TaskFormDialog } from "./daily-task-form-dialog"

vi.mock("@/components/Home/Habits/daily-task-form", () => ({
  TaskForm: ({ onSubmit, onCancel }: { onSubmit: (task: unknown) => void; onCancel: () => void }) => (
    <div data-testid="task-form">
      <button onClick={() => onSubmit({ name: "Mock habit" })}>Submit mock</button>
      <button onClick={onCancel}>Cancel mock</button>
    </div>
  ),
}))

describe("TaskFormDialog", () => {
  it("renders add title when creating a habit", () => {
    render(
      <TaskFormDialog
        open
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        initialTask={null}
      />,
    )
    expect(screen.getByText("Add New Habit")).toBeInTheDocument()
    expect(screen.getByTestId("task-form")).toBeInTheDocument()
  })

  it("renders edit title when editing a habit", () => {
    render(
      <TaskFormDialog
        open
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        initialTask={{ id: "h1", name: "Existing", type: TaskType.BOOLEAN, rewardValue: 10 }}
      />,
    )
    expect(screen.getByText("Edit Habit")).toBeInTheDocument()
  })
})
