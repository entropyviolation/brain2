import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { COMPUTER_PROJECT_ATTR, COMPUTER_PROJECT_TYPE_ID } from "@/lib/computer-project-types"
import { OPERATION_ATTR } from "@/lib/operation-types"
import { OP_REL } from "@/lib/operations"
import type { Task } from "@/lib/types"
import { ComputerProjectDetail } from "./ComputerProjectDetail"

function task(partial: Partial<Task> & Pick<Task, "id" | "description">): Task {
  return {
    stage: "clarified",
    createdAt: new Date("2026-06-01"),
    completed: false,
    lists: [],
    links: [],
    ...partial,
  }
}

describe("ComputerProjectDetail", () => {
  beforeEach(() => resetAllStores())

  it("shows status, the repository, a linked next action, and adds a milestone", async () => {
    const user = userEvent.setup()
    const project = task({
      id: "proj",
      description: "Brain2",
      type: COMPUTER_PROJECT_TYPE_ID,
      attributes: {
        [OPERATION_ATTR.stage]: "active",
        [OPERATION_ATTR.mission]: "Ship the desk",
        [COMPUTER_PROJECT_ATTR.repo]: "https://example.com/brain2",
      },
      links: [{ id: "l1", relation: OP_REL.hasPart, targetId: "next-1" }],
    })
    const action = task({ id: "next-1", description: "Wire the type lists" })
    useTaskStore.setState({ tasks: [project, action], lists: [], folders: [] })
    const onCommitAttr = vi.fn()
    const onPatch = vi.fn()
    const onOpenItem = vi.fn()

    render(
      <ComputerProjectDetail
        task={project}
        onLiveAttr={vi.fn()}
        onCommitAttr={onCommitAttr}
        onPatch={onPatch}
        onOpenItem={onOpenItem}
      />,
    )

    expect(screen.getByLabelText("Computer project")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Ship the desk")).toBeInTheDocument()
    expect(screen.getByDisplayValue("https://example.com/brain2")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open repository" })).toHaveAttribute("href", "https://example.com/brain2")
    expect(screen.getByRole("button", { name: "Wire the type lists" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Wire the type lists" }))
    expect(onOpenItem).toHaveBeenCalledWith("next-1")

    await user.type(screen.getByLabelText("New milestone"), "Alpha")
    await user.click(screen.getByRole("button", { name: "Add milestone" }))
    const stored = useTaskStore.getState().tasks
    expect(stored.some((row) => row.description === "Alpha")).toBe(true)
    expect(onPatch).toHaveBeenCalled()
    // A milestone is a phase, not a next action.
    expect(screen.getAllByRole("button", { name: /^Alpha/ })).toHaveLength(1)
  })
})
