import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { OPERATION_ATTR, OPERATION_TYPE_ID } from "@/lib/operation-types"
import type { Task } from "@/lib/types"
import { OperationsView } from "./OperationsView"

vi.mock("./OperationWorkspace", () => ({
  OperationWorkspace: ({ operationId, onBack }: { operationId: string; onBack?: () => void }) => (
    <div>
      <p>Workspace {operationId}</p>
      <button type="button" onClick={onBack}>
        Board
      </button>
    </div>
  ),
}))

function seedOperation(id: string, description: string, categories?: string[], stage = "active") {
  const op: Task = {
    id,
    description,
    type: OPERATION_TYPE_ID,
    stage: "clarified",
    createdAt: new Date("2026-01-01"),
    completed: false,
    lists: [],
    attributes: {
      [OPERATION_ATTR.stage]: stage,
      ...(categories ? { [OPERATION_ATTR.categories]: categories } : {}),
    },
    links: [],
  }
  useTaskStore.getState().addTask(op)
  return op
}

describe("OperationsView", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("renders command-center chrome, the preset picker, and the create control", () => {
    render(<OperationsView />)
    expect(screen.getByRole("heading", { name: "Operations — Command Center" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "New Operation" })).toBeDisabled()
    expect(screen.getByLabelText("Shape")).toBeInTheDocument()
    expect(screen.getByText(/No operations yet/i)).toBeInTheDocument()
  })

  it("creates an operation from a preset and opens the workspace", async () => {
    const user = userEvent.setup()
    render(<OperationsView />)
    await user.type(screen.getByLabelText("New operation name"), "Moonshot")
    await user.selectOptions(screen.getByLabelText("Shape"), "trip")
    await user.click(screen.getByRole("button", { name: "New Operation" }))
    expect(screen.getByText(/^Workspace /)).toBeInTheDocument()

    const created = useTaskStore.getState().tasks.find((t) => t.description === "Moonshot")
    expect(created?.attributes?.[OPERATION_ATTR.panels]).toContain("locations")
    expect(created?.attributes?.[OPERATION_ATTR.categories]).toEqual(["trip"])
  })

  it("groups operations by category, listing a multi-category op in each group", () => {
    seedOperation("op_fox", "Foxtide rebuild", ["paid", "foxtide job"])
    seedOperation("op_trip", "Iceland", ["trip"])
    seedOperation("op_loose", "Inbox zero")
    render(<OperationsView />)

    const groups = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)
    expect(groups?.[0]).toContain("foxtide job")
    expect(groups?.[groups.length - 1]).toContain("Uncategorized")
    // Filed under both "paid" and "foxtide job".
    expect(screen.getAllByRole("button", { name: /Foxtide rebuild/ })).toHaveLength(2)
    expect(screen.getAllByRole("button", { name: /Inbox zero/ })).toHaveLength(1)
  })

  it("filters by category checkbox and can hide the uncategorized bucket", async () => {
    const user = userEvent.setup()
    seedOperation("op_trip", "Iceland", ["trip"])
    seedOperation("op_loose", "Inbox zero")
    render(<OperationsView />)

    const filter = screen.getByRole("group", { name: "Filter categories" })
    await user.click(within(filter).getByRole("checkbox", { name: "Uncategorized" }))
    expect(screen.queryByRole("button", { name: /Inbox zero/ })).not.toBeInTheDocument()

    await user.click(within(filter).getByRole("checkbox", { name: "trip" }))
    expect(screen.getByText(/No operations match the selected categories/i)).toBeInTheDocument()
  })

  it("can switch grouping off for a flat sorted board", async () => {
    const user = userEvent.setup()
    seedOperation("op_fox", "Foxtide rebuild", ["paid", "foxtide job"])
    render(<OperationsView />)

    await user.click(screen.getByRole("checkbox", { name: /Group by category/ }))
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /Foxtide rebuild/ })).toHaveLength(1)
  })

  it("hides completed and inactive operations until Show archived", async () => {
    const user = userEvent.setup()
    seedOperation("op_live", "Fashion magazine", ["paid"])
    seedOperation("op_done", "Old catalog", ["paid"], "done")
    seedOperation("op_paused", "Winter pause", undefined, "paused")
    render(<OperationsView />)

    expect(screen.getByRole("button", { name: /Fashion magazine/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Old catalog/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Winter pause/ })).not.toBeInTheDocument()
    expect(screen.getByText(/2 archived hidden/)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Show archived" }))
    expect(screen.getByRole("button", { name: /Old catalog/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Winter pause/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Hide archived" })).toBeInTheDocument()
  })

  it("reopens the last operation after remount", async () => {
    const user = userEvent.setup()
    seedOperation("op_keep", "Keep this mission", ["paid"])
    const { unmount } = render(<OperationsView />)
    await user.click(screen.getAllByRole("button", { name: /Keep this mission/ })[0])
    expect(screen.getByText("Workspace op_keep")).toBeInTheDocument()
    unmount()
    render(<OperationsView />)
    expect(screen.getByText("Workspace op_keep")).toBeInTheDocument()
  })
})
