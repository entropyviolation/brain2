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
import { addPhase, addPhaseStep } from "../operation-actions"
import { pickOption } from "@/tests/native-select"

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

  it("builds a nested formula, stores stage and notes on the part, and files a real to-do", async () => {
    const user = userEvent.setup()
    seedOperation()
    const operation = () => useTaskStore.getState().tasks.find((task) => task.id === "op_mag")!

    const { rerender } = render(<PartsPanel operation={operation()} />)

    await user.type(screen.getByLabelText("New kind"), "Issue")
    await user.type(screen.getByLabelText("When finished"), "ordered, printed")
    await user.click(screen.getByRole("button", { name: "Add kind" }))

    rerender(<PartsPanel operation={operation()} />)
    await user.type(screen.getByLabelText("New kind"), "Article")
    pickOption(screen.getByLabelText("Lives inside"), "Issue")
    await user.type(screen.getByLabelText("Stages"), "drafted, written, formatted")
    await user.click(screen.getByRole("button", { name: "Add kind" }))

    rerender(<PartsPanel operation={operation()} />)
    await user.type(screen.getByLabelText("New Issue"), "Spring")
    await user.click(screen.getByRole("button", { name: "Add" }))

    rerender(<PartsPanel operation={operation()} />)
    await user.click(screen.getByRole("button", { name: "Open Spring" }))

    rerender(<PartsPanel operation={operation()} />)
    expect(screen.getByRole("checkbox", { name: "Toggle ordered" })).toBeInTheDocument()
    await user.click(screen.getByRole("checkbox", { name: "Toggle ordered" }))
    expect(useTaskStore.getState().tasks.some((task) => task.description === "Spring — ordered")).toBe(false)
    const spring = readPartInstances(operation().attributes?.[OPERATION_ATTR.partInstances]).find(
      (instance) => instance.title === "Spring",
    )
    expect(spring?.completedFinish).toEqual(["ordered"])

    rerender(<PartsPanel operation={operation()} />)
    await user.type(screen.getByLabelText("New Article"), "Cover story")
    await user.click(screen.getByRole("button", { name: "Add" }))

    rerender(<PartsPanel operation={operation()} />)
    await user.click(screen.getByRole("button", { name: "Open Cover story" }))

    rerender(<PartsPanel operation={operation()} />)
    const name = screen.getByLabelText("Name")
    const stage = screen.getByText("Current stage")
    const report = screen.getByLabelText("Latest status report")
    const todo = screen.getByLabelText("New to-do")
    const note = screen.getByLabelText("New note")
    expect(name.compareDocumentPosition(stage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(stage.compareDocumentPosition(report) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(report.compareDocumentPosition(todo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(todo.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole("checkbox", { name: "Toggle drafted" })).toBeInTheDocument()
    expect(screen.getByText("Tasks for this part")).toBeInTheDocument()
    expect(screen.getByText("Notes for this part.")).toBeInTheDocument()

    await user.click(screen.getByRole("checkbox", { name: "Toggle drafted" }))
    await user.click(screen.getByRole("checkbox", { name: "Toggle written" }))
    await user.type(screen.getByLabelText("Latest status report"), "Waiting on the scan.")
    await user.tab()
    await user.type(screen.getByLabelText("New note"), "neon cover")
    await user.click(screen.getByRole("button", { name: "Add note" }))
    await user.type(screen.getByLabelText("New to-do"), "Scan the art")
    await user.click(screen.getByRole("button", { name: "Add task" }))

    const tasks = useTaskStore.getState().tasks
    expect(tasks.some((task) => task.description === "neon cover")).toBe(false)
    expect(tasks.some((task) => task.description === "Cover story — drafted")).toBe(false)
    expect(tasks.some((task) => task.description === "Cover story — written")).toBe(false)
    const instances = readPartInstances(operation().attributes?.[OPERATION_ATTR.partInstances])
    const cover = instances.find((instance) => instance.title === "Cover story")
    expect(cover?.currentStage).toBe("written")
    expect(cover?.statusReport).toBe("Waiting on the scan.")
    expect(cover?.ideas.map((idea) => idea.text)).toEqual(["neon cover"])
    expect(cover?.parentInstanceId).toBeTruthy()
    const scan = tasks.find((task) => task.description === "Scan the art")
    expect(scan?.attributes?.[PART_TASK_ATTR.instanceId]).toBe(cover?.id)
    expect(scan?.attributes?.[PART_TASK_ATTR.role]).toBeUndefined()

    const phase = addPhase("op_mag", "Launch")
    addPhaseStep("op_mag", phase!.id, "Call the printer")

    rerender(<OperationTasksPanel operation={operation()} />)
    expect(screen.getByText("Scan the art")).toBeInTheDocument()
    expect(screen.getByText("Call the printer")).toBeInTheDocument()
    expect(screen.queryByText("neon cover")).not.toBeInTheDocument()
    expect(screen.queryByText("Cover story — drafted")).not.toBeInTheDocument()
  })
})
