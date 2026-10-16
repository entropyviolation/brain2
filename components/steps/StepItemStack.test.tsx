import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Subtask, Task } from "@/lib/types"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { clearItemLayers, itemLayers, openStepItem, pushItemLayer } from "@/lib/step-item-stack"
import { findStepItem } from "@/lib/step-items"
import { StepItemStack } from "./StepItemStack"
import { StepTree } from "./StepTree"
import { resetStepFoldsForTests } from "./step-folds"

const steps: Subtask[] = [
  { id: "insert", description: "insert", completed: false, subtasks: [{ id: "disc", description: "disc", completed: false }] },
]

function seed() {
  useTaskStore.setState({
    tasks: [
      {
        id: "cds",
        type: "task",
        description: "Finish CDs",
        stage: "list",
        createdAt: new Date("2026-10-01T09:00:00"),
        completed: false,
        lists: [],
        subtasks: steps,
      } as Task,
    ],
    removedTaskIds: [],
  })
}

beforeEach(() => {
  resetAllStores()
  resetStepFoldsForTests()
  clearItemLayers()
  seed()
})

describe("StepTree open on top", () => {
  it("the dot and ↗ open the step; no ↗ without a host handler", () => {
    const open = vi.fn()
    const { rerender, container } = render(<StepTree steps={steps} onChange={() => {}} onOpenStep={open} />)
    fireEvent.click(screen.getByRole("button", { name: "Open disc" }))
    expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ id: "disc" }))
    fireEvent.click(container.querySelector(".step-tree-dot.is-parent")!)
    expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ id: "insert" }))
    rerender(<StepTree steps={steps} onChange={() => {}} />)
    expect(screen.queryByRole("button", { name: "Open disc" })).toBeNull()
  })
})

describe("StepItemStack", () => {
  it("shows the breadcrumb; Back and Esc close only the top; state underneath survives", { timeout: 15000 }, async () => {
    function Under() {
      const [n, setN] = useState(0)
      return (
        <button type="button" onClick={() => setN(n + 1)}>
          under {n}
        </button>
      )
    }
    render(
      <>
        <Under />
        <StepItemStack />
      </>,
    )
    fireEvent.click(screen.getByRole("button", { name: "under 0" }))
    act(() => {
      pushItemLayer("cds")
      openStepItem("cds", "disc")
    })
    await waitFor(() => expect(document.querySelectorAll("[role=dialog]")).toHaveLength(2), { timeout: 8000 })
    const crumbs = screen.getByRole("navigation", { name: "Where this step sits", hidden: true })
    expect(crumbs.textContent).toContain("Finish CDs")
    expect(crumbs.textContent).toContain("insert")
    expect(crumbs.textContent).toContain("disc")
    expect(screen.getByText("Parent")).toBeTruthy()

    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" })
    await waitFor(() => expect(itemLayers()).toHaveLength(1))
    expect(itemLayers()[0].taskId).toBe("cds")

    act(() => {
      openStepItem("cds", "insert")
    })
    await waitFor(() => expect(itemLayers()).toHaveLength(2))
    const backs = await screen.findAllByRole("button", { name: "‹ Back", hidden: true })
    fireEvent.click(backs[backs.length - 1])
    await waitFor(() => expect(itemLayers()).toHaveLength(1))
    expect(screen.getByText("under 1", { selector: "button" })).toBeTruthy()
    expect(findStepItem(useTaskStore.getState().tasks, "cds", "insert")).toBeTruthy()
  })
})
