import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { OPERATION_ATTR, OPERATION_TYPE_ID } from "@/lib/operation-types"
import { PART_TASK_ATTR, readPartInstances } from "@/lib/operation-parts"
import type { Task } from "@/lib/types"
import { PartsPanel } from "./PartsPanel"
import { OperationTasksPanel } from "./OperationTasksPanel"
import { addPhase, addPhaseStep } from "./operation-actions"

function seedOperation(): Task {
  const op: Task = {
    id: "op_mag",
    description: "Fashion magazine",
    type: OPERATION_TYPE_ID,
    stage: "clarified",
    createdAt: new Date("2026-01-01"),
    completed: false,
    lists: [],
    attributes: { [OPERATION_ATTR.stage]: "active" },
    links: [],
  }
  useTaskStore.getState().addTask(op)
  return op
}

describe("PartsPanel", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("builds a nested formula, keeps ideas off To do, and lists stage tasks there", async () => {
    const user = userEvent.setup()
    seedOperation()
    const operation = () => useTaskStore.getState().tasks.find((task) => task.id === "op_mag")!

    const { rerender } = render(<PartsPanel operation={operation()} />)

    await user.type(screen.getByLabelText("New kind"), "Issue")
    await user.type(screen.getByLabelText("When finished"), "ordered, printed")
    await user.click(screen.getByRole("button", { name: "Add kind" }))

    rerender(<PartsPanel operation={operation()} />)
    await user.type(screen.getByLabelText("New kind"), "Article")
    await user.selectOptions(screen.getByLabelText("Lives inside"), "Issue")
    await user.type(screen.getByLabelText("Stages"), "drafted, written, formatted")
    await user.click(screen.getByRole("button", { name: "Add kind" }))

    rerender(<PartsPanel operation={operation()} />)
    await user.type(screen.getByLabelText("New Issue"), "Spring")
    await user.click(screen.getByRole("button", { name: "Add" }))

    rerender(<PartsPanel operation={operation()} />)
    await user.click(screen.getByRole("button", { name: "Open Spring" }))

    rerender(<PartsPanel operation={operation()} />)
    expect(screen.getByRole("checkbox", { name: "Toggle ordered" })).toBeInTheDocument()
    await user.type(screen.getByLabelText("New Article"), "Cover story")
    await user.click(screen.getByRole("button", { name: "Add" }))

    rerender(<PartsPanel operation={operation()} />)
    await user.click(screen.getByRole("button", { name: "Open Cover story" }))

    rerender(<PartsPanel operation={operation()} />)
    expect(screen.getByRole("checkbox", { name: "Toggle drafted" })).toBeInTheDocument()
    await user.type(screen.getByLabelText("New idea"), "neon cover")
    await user.click(screen.getByRole("button", { name: "Add idea" }))

    const tasks = useTaskStore.getState().tasks
    expect(tasks.some((task) => task.description === "neon cover")).toBe(false)
    expect(tasks.some((task) => task.description === "Cover story — drafted")).toBe(true)
    const instances = readPartInstances(operation().attributes?.[OPERATION_ATTR.partInstances])
    const cover = instances.find((instance) => instance.title === "Cover story")
    expect(cover?.ideas.map((idea) => idea.text)).toEqual(["neon cover"])
    expect(cover?.parentInstanceId).toBeTruthy()

    const phase = addPhase("op_mag", "Launch")
    addPhaseStep("op_mag", phase!.id, "Call the printer")

    rerender(<OperationTasksPanel operation={operation()} />)
    expect(screen.getByText("Cover story — drafted")).toBeInTheDocument()
    expect(screen.getByText("Call the printer")).toBeInTheDocument()
    expect(screen.queryByText("neon cover")).not.toBeInTheDocument()
    expect(
      useTaskStore.getState().tasks.find((task) => task.description === "Cover story — drafted")?.attributes?.[
        PART_TASK_ATTR.operationId
      ],
    ).toBe("op_mag")
  })
})
