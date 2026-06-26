import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import { TagInput } from "./TagInput"
import { LinkPicker } from "./LinkPicker"
import { RelatedItemsPanel } from "./RelatedItemsPanel"

function makeTask(overrides: Partial<Task> & Pick<Task, "id" | "description">): Task {
  return {
    stage: "clarified",
    createdAt: new Date("2026-06-20T12:00:00"),
    completed: false,
    lists: [],
    urgency: 3,
    importance: 3,
    estimatedDuration: 30,
    cognitiveLoad: 1,
    dependencies: [],
    context: "@home",
    entropy: 0.3,
    rewardValue: 5,
    allowPartialCompletion: false,
    minimumChunkSize: 15,
    ...overrides,
  }
}

describe("TagInput", () => {
  beforeEach(() => resetAllStores())

  it("adds a tag on Enter", async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<TagInput tags={[]} onAdd={onAdd} onRemove={vi.fn()} />)

    await user.type(screen.getByLabelText("Add a tag"), "Focus{Enter}")
    expect(onAdd).toHaveBeenCalledWith("focus")
  })

  it("removes a tag when its chip remove button is clicked", async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    render(<TagInput tags={["alpha"]} onAdd={vi.fn()} onRemove={onRemove} />)

    await user.click(screen.getByLabelText("Remove tag alpha"))
    expect(onRemove).toHaveBeenCalledWith("alpha")
  })
})

describe("LinkPicker", () => {
  beforeEach(() => {
    resetAllStores()
    useTaskStore.getState().setTasks([
      makeTask({ id: "a", description: "Write proposal" }),
      makeTask({ id: "b", description: "Review budget" }),
    ])
  })

  it("adds a link to a searched target item", async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<LinkPicker sourceId="a" onAdd={onAdd} />)

    await user.type(screen.getByLabelText("Search item to link"), "budget")
    await user.click(screen.getByText("Review budget"))
    await user.click(screen.getByRole("button", { name: /add link/i }))

    expect(onAdd).toHaveBeenCalledWith("blocks", "b")
  })
})

describe("RelatedItemsPanel", () => {
  beforeEach(() => resetAllStores())

  it("renders forward links and removes one", async () => {
    const user = userEvent.setup()
    const target = makeTask({ id: "b", description: "Review budget" })
    const task = makeTask({
      id: "a",
      description: "Write proposal",
      links: [{ id: "l1", relation: "blocks", targetId: "b" }],
    })
    useTaskStore.getState().setTasks([task, target])

    const onRemoveLink = vi.fn()
    render(<RelatedItemsPanel task={task} onOpenItem={vi.fn()} onRemoveLink={onRemoveLink} />)

    expect(screen.getByText("Review budget")).toBeInTheDocument()
    expect(screen.getByText("blocks")).toBeInTheDocument()

    await user.click(screen.getByLabelText("Remove link"))
    expect(onRemoveLink).toHaveBeenCalledWith("l1")
  })

  it("renders backlinks labelled with the inverse relation", async () => {
    const user = userEvent.setup()
    // Y blocks X → on X this should surface as "blocked by Y".
    const x = makeTask({ id: "x", description: "Ship release" })
    const y = makeTask({
      id: "y",
      description: "Fix blocker bug",
      links: [{ id: "l1", relation: "blocks", targetId: "x" }],
    })
    useTaskStore.getState().setTasks([x, y])

    const onOpenItem = vi.fn()
    render(<RelatedItemsPanel task={x} onOpenItem={onOpenItem} onRemoveLink={vi.fn()} />)

    expect(screen.getByText("blocked by")).toBeInTheDocument()
    expect(screen.getByText("Fix blocker bug")).toBeInTheDocument()

    await user.click(screen.getByText("Fix blocker bug"))
    expect(onOpenItem).toHaveBeenCalledWith("y")
  })
})
