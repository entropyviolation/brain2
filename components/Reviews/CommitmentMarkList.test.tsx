import { render, screen, fireEvent } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { Task } from "@/lib/types"
import { CommitmentMarkList } from "./CommitmentMarkList"

function task(id: string, title: string): Task {
  return { id, title, description: title, completed: false } as Task
}

const tasks = [task("a", "Alpha"), task("b", "Beta")]

describe("CommitmentMarkList", () => {
  it("renders one required checkbox left of each title", () => {
    const onToggle = vi.fn()
    render(
      <CommitmentMarkList
        tasks={tasks}
        requiredIds={["a"]}
        marks="required"
        onToggle={onToggle}
      />,
    )

    const boxes = screen.getAllByRole("checkbox")
    expect(boxes).toHaveLength(2)
    expect(boxes[0]).toBeChecked()
    expect(boxes[1]).not.toBeChecked()
    expect(screen.getByText("Alpha")).toBeTruthy()
    expect(screen.queryByText("Required")).toBeNull()

    fireEvent.click(boxes[1])
    expect(onToggle).toHaveBeenCalledWith("required", "b")
  })

  it("renders one prioritized checkbox left of each title", () => {
    const onToggle = vi.fn()
    render(
      <CommitmentMarkList
        tasks={tasks}
        requiredIds={[]}
        prioritizedIds={["b"]}
        marks="prioritized"
        onToggle={onToggle}
      />,
    )

    const boxes = screen.getAllByRole("checkbox")
    expect(boxes[0]).not.toBeChecked()
    expect(boxes[1]).toBeChecked()

    fireEvent.click(boxes[0])
    expect(onToggle).toHaveBeenCalledWith("prioritized", "a")
  })

  it("renders Required and Prioritized labels on each row", () => {
    const onToggle = vi.fn()
    render(
      <CommitmentMarkList
        tasks={tasks}
        requiredIds={["a"]}
        prioritizedIds={["b"]}
        marks="both"
        onToggle={onToggle}
      />,
    )

    expect(screen.getAllByText("Required")).toHaveLength(2)
    expect(screen.getAllByText("Prioritized")).toHaveLength(2)

    const boxes = screen.getAllByRole("checkbox")
    expect(boxes).toHaveLength(4)
    fireEvent.click(boxes[1]) // Alpha Prioritized
    expect(onToggle).toHaveBeenCalledWith("prioritized", "a")
    fireEvent.click(boxes[2]) // Beta Required
    expect(onToggle).toHaveBeenCalledWith("required", "b")
  })
})
