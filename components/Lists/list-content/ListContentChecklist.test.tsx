import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { Task } from "@/lib/types"
import { ListContentChecklist } from "./ListContentChecklist"

const task = (id: string, description: string, extra: Partial<Task> = {}): Task => ({
  id,
  description,
  lists: ["list-1"],
  stage: "list",
  completed: false,
  createdAt: new Date(),
  ...extra,
})

const handlers = {
  onTaskSelect: vi.fn(),
  onCompleteTask: vi.fn(),
  onMissedOpportunity: vi.fn(),
  onTaskDragStart: vi.fn(),
  onDragEnd: vi.fn(),
}

describe("ListContentChecklist checkbox columns", () => {
  it("defaults to one labeled Completed column", () => {
    render(<ListContentChecklist tasks={[task("a", "item a")]} {...handlers} />)
    expect(screen.getByText("Completed")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Completed" })).toBeInTheDocument()
    expect(screen.queryByText("Missed opportunity")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Missed opportunity/i })).not.toBeInTheDocument()
  })

  it("adds extra columns only when configured", () => {
    render(
      <ListContentChecklist
        tasks={[task("a", "item a")]}
        {...handlers}
        checkboxVars={["completed", "missed"]}
      />,
    )
    expect(screen.getByText("Completed")).toBeInTheDocument()
    expect(screen.getByText("Missed opportunity")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Completed" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Missed opportunity/i })).toBeInTheDocument()
  })

  it("clicking Completed asks the parent to complete (reflection is owned by the completion host)", () => {
    const onCompleteTask = vi.fn()
    render(<ListContentChecklist tasks={[task("a", "item a")]} {...handlers} onCompleteTask={onCompleteTask} />)
    fireEvent.click(screen.getByRole("button", { name: "Completed" }))
    expect(onCompleteTask).toHaveBeenCalledWith("a")
  })
})
