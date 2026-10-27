import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { OperationHome } from "./OperationHome"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { OPERATION_ATTR, OPERATION_TYPE_ID } from "@/lib/operation-types"
import type { List, Task } from "@/lib/types"

vi.mock("@/components/ItemDetail/ItemDetailPopup", () => ({
  TaskDetailPopup: ({
    taskId,
    open,
    onClose,
  }: {
    taskId: string | null
    open: boolean
    onClose: () => void
  }) =>
    open ? (
      <div role="dialog" aria-label="Item detail">
        <span>detail:{taskId}</span>
        <button type="button" onClick={onClose}>
          Close item detail
        </button>
      </div>
    ) : null,
}))

function operation(partial: Partial<Task> = {}): Task {
  return {
    id: "op-1",
    description: "Kiln",
    stage: "clarified",
    type: OPERATION_TYPE_ID,
    createdAt: new Date("2026-06-01T15:00:00"),
    completed: false,
    lists: [],
    attributes: {
      [OPERATION_ATTR.stage]: "active",
      [OPERATION_ATTR.homeNotes]: "Controller board is on order.",
    },
    ...partial,
  }
}

describe("OperationHome notes", () => {
  beforeEach(() => resetAllStores())

  it("folds legacy notes into the item log, appends an entry, and opens item detail", async () => {
    const user = userEvent.setup()
    const op = operation()
    useTaskStore.setState({ tasks: [op], lists: [], folders: [] })
    render(<OperationHome operation={op} />)

    expect(screen.getByText("0/0 phases · 0/0 to-dos · 0%")).toBeInTheDocument()
    const openDetail = screen.getByRole("button", { name: "Open item detail" })
    expect(openDetail).toHaveClass("ops-keycap")

    expect(await screen.findByText("Controller board is on order.")).toBeInTheDocument()
    await waitFor(() => {
      const saved = useTaskStore.getState().tasks.find((row) => row.id === op.id)
      expect(saved?.attributes?.[OPERATION_ATTR.homeNotes]).toBeUndefined()
      expect(saved?.noteLog?.some((entry) => entry.text === "Controller board is on order.")).toBe(true)
    })

    await user.type(screen.getByLabelText("New note"), "Logged from home")
    await user.click(screen.getByRole("button", { name: "Add entry" }))
    await waitFor(() => {
      const saved = useTaskStore.getState().tasks.find((row) => row.id === op.id)
      expect(saved?.noteLog?.map((entry) => entry.text)).toEqual([
        "Controller board is on order.",
        "Logged from home",
      ])
    })

    await user.click(openDetail)
    expect(screen.getByRole("dialog", { name: "Item detail" })).toBeInTheDocument()
    expect(screen.getByText("detail:op-1")).toBeInTheDocument()
    expect(screen.getByLabelText("Mission")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Close item detail" }))
    expect(screen.queryByRole("dialog", { name: "Item detail" })).not.toBeInTheDocument()
    expect(screen.getByLabelText("Mission")).toBeInTheDocument()
  })

  it("shows phase and to-do counts, and averages their fractions", () => {
    const op = operation({
      attributes: {
        [OPERATION_ATTR.stage]: "active",
        [OPERATION_ATTR.taskListId]: "op-list-op-1",
      },
      links: [
        { id: "a", relation: "has-phase", targetId: "ph1" },
        { id: "b", relation: "has-phase", targetId: "ph2" },
        { id: "d", relation: "has-part", targetId: "todo-linked" },
      ],
    })
    const ph1: Task = {
      id: "ph1",
      description: "Glaze",
      stage: "clarified",
      createdAt: new Date("2026-06-01T15:00:00"),
      completed: false,
      lists: [],
      links: [{ id: "c", relation: "has-part", targetId: "step-done" }],
    }
    const ph2: Task = {
      id: "ph2",
      description: "Fire",
      stage: "clarified",
      createdAt: new Date("2026-06-01T15:00:00"),
      completed: false,
      lists: [],
      links: [{ id: "e", relation: "has-part", targetId: "step-open" }],
    }
    const stepDone: Task = {
      id: "step-done",
      description: "Mix",
      stage: "clarified",
      createdAt: new Date("2026-06-01T15:00:00"),
      completed: true,
      lists: [],
    }
    const stepOpen: Task = {
      id: "step-open",
      description: "Load",
      stage: "clarified",
      createdAt: new Date("2026-06-01T15:00:00"),
      completed: false,
      lists: [],
    }
    const linked: Task = {
      id: "todo-linked",
      description: "Order kiln",
      stage: "clarified",
      createdAt: new Date("2026-06-01T15:00:00"),
      completed: false,
      lists: [],
    }
    const listed: Task = {
      id: "todo-listed",
      description: "Buy cones",
      stage: "clarified",
      createdAt: new Date("2026-06-01T15:00:00"),
      completed: true,
      lists: ["op-list-op-1"],
    }
    const list: List = {
      id: "op-list-op-1",
      name: "Kiln",
      color: "#0f766e",
      createdAt: new Date("2026-06-01T15:00:00"),
    }
    useTaskStore.setState({
      tasks: [op, ph1, ph2, stepDone, stepOpen, linked, listed],
      lists: [list],
      folders: [],
    })
    render(<OperationHome operation={op} />)

    // Phases: 1/2 complete. To-dos: step-done, step-open, linked part, listed item → 2/4.
    // Mean of 1/2 and 2/4 is 50%.
    expect(screen.getByText("1/2 phases · 2/4 to-dos · 50%")).toBeInTheDocument()
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50")
  })

  it("grows the mission field and keeps the saved string", async () => {
    const user = userEvent.setup()
    const mission =
      "Create properly packaged design files for cds to be made for Entropy and Chaos (foxtide albums)"
    const op = operation({
      attributes: {
        [OPERATION_ATTR.stage]: "active",
        [OPERATION_ATTR.mission]: mission,
      },
    })
    useTaskStore.setState({ tasks: [op], lists: [], folders: [] })
    render(<OperationHome operation={op} />)

    const field = screen.getByLabelText("Mission")
    expect(field.tagName).toBe("TEXTAREA")
    expect(field).toHaveValue(mission)
    expect(field).toHaveAttribute("rows", "1")

    await user.clear(field)
    await user.type(field, "A shorter aim")
    await user.click(screen.getByLabelText("Stage"))
    await waitFor(() => {
      expect(useTaskStore.getState().tasks.find((row) => row.id === op.id)?.attributes?.[OPERATION_ATTR.mission]).toBe(
        "A shorter aim",
      )
    })
  })
})
