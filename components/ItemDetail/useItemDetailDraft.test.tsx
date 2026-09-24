/**
 * Cycle guard on addDependency — Vitest + in-memory task store only.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { resetItemActivity } from "@/lib/item-activity"
import { useTaskStore } from "@/lib/task-store"
import { useItemTypeStore } from "@/lib/item-type-store"
import { useItemDetailDraft } from "@/components/ItemDetail/useItemDetailDraft"

function CycleHarness({ taskId }: { taskId: string }) {
  const { task, addDependency } = useItemDetailDraft(taskId)
  return (
    <div>
      <span data-testid="deps">{(task?.dependencies ?? []).join(",")}</span>
      <button
        type="button"
        onClick={() => {
          const result = addDependency("task-b")
          if (!result.ok) {
            document.getElementById("cycle-out")!.textContent = result.cycleLabel
          }
        }}
      >
        add-b
      </button>
      <button
        type="button"
        onClick={() => {
          addDependency("task-c")
        }}
      >
        add-c
      </button>
      <p id="cycle-out" />
    </div>
  )
}

function seed(partial: { id: string; description: string; dependencies?: string[] }) {
  useTaskStore.getState().addTask({
    id: partial.id,
    description: partial.description,
    type: "task",
    stage: "list",
    createdAt: new Date(),
    completed: false,
    lists: [],
    dependencies: partial.dependencies ?? [],
  })
}

describe("useItemDetailDraft addDependency cycle guard", () => {
  beforeEach(() => {
    resetLocalStorage()
    resetItemActivity()
    useItemTypeStore.getState().resetTypes()
    useTaskStore.getState().clearAllData()
    seed({ id: "task-a", description: "Write" })
    seed({ id: "task-b", description: "Review", dependencies: ["task-a"] })
    seed({ id: "task-c", description: "Ship" })
  })

  it("refuses an edge that would loop and leaves dependencies unchanged", async () => {
    const user = userEvent.setup()
    render(<CycleHarness taskId="task-a" />)
    await user.click(screen.getByRole("button", { name: "add-b" }))
    expect(screen.getByTestId("deps")).toHaveTextContent("")
    expect(screen.getByText(/Write → Review → Write/)).toBeInTheDocument()
    expect(useTaskStore.getState().tasks.find((t) => t.id === "task-a")?.dependencies ?? []).toEqual([])
  })

  it("accepts an acyclic dependency on the draft", async () => {
    const user = userEvent.setup()
    render(<CycleHarness taskId="task-a" />)
    await user.click(screen.getByRole("button", { name: "add-c" }))
    expect(screen.getByTestId("deps")).toHaveTextContent("task-c")
    expect(screen.queryByText(/→/)).not.toBeInTheDocument()
  })
})
