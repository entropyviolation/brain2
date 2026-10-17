import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { Task } from "@/lib/types"
import { TagInput } from "./TagInput"
import { RichLinksPanel } from "./links/RichLinksPanel"
import { PEOPLE_I_KNOW_LIST_ID } from "@/lib/people-i-know"
import { useItemTypeStore } from "@/lib/item-type-store"
import { registerCustomRelations } from "@/lib/relation-registry"
import { TagSettingsHost } from "@/components/Home/Tracking/tag-settings-host"

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

  it("shows a catalog bead when the item tag name matches a Tracking tag", () => {
    const work = useTimeTrackingStore.getState().tags.find((t) => t.name === "Work")!
    render(<TagInput tags={["Work"]} onAdd={vi.fn()} onRemove={vi.fn()} />)
    const bead = document.querySelector(".id-tag-bead") as HTMLElement | null
    expect(bead).toBeTruthy()
    expect(bead?.style.backgroundColor || bead?.style.background).toBeTruthy()
    expect(work.color).toBeTruthy()
  })

  it("keeps a plain chip when the item tag is not in the catalog", () => {
    render(<TagInput tags={["only-on-item"]} onAdd={vi.fn()} onRemove={vi.fn()} />)
    expect(document.querySelector(".id-tag-bead")).toBeNull()
    expect(screen.getByText("only-on-item")).toBeInTheDocument()
  })

  it("opens tag settings on double-click for a catalog match", async () => {
    render(
      <>
        <TagSettingsHost />
        <TagInput tags={["Work"]} onAdd={vi.fn()} onRemove={vi.fn()} />
      </>,
    )
    const chip = screen.getByText("Work").closest(".id-tag-chip") ?? screen.getByText("Work")
    fireEvent.doubleClick(chip)
    await waitFor(() => {
      expect(screen.getByText(/Tag · Work/)).toBeInTheDocument()
    })
  })

  it("opens create-from-name settings when the item tag is not in the catalog", async () => {
    render(
      <>
        <TagSettingsHost />
        <TagInput tags={["only-on-item"]} onAdd={vi.fn()} onRemove={vi.fn()} />
      </>,
    )
    fireEvent.doubleClick(screen.getByText("only-on-item"))
    await waitFor(() => {
      expect(screen.getByText("Item tag only")).toBeInTheDocument()
    })
  })
})

function panel(task: Task, overrides: Partial<Parameters<typeof RichLinksPanel>[0]> = {}) {
  const props = {
    task,
    addLink: vi.fn(),
    removeLink: vi.fn(),
    writeDraft: vi.fn(),
    onOpenItem: vi.fn(),
    ...overrides,
  }
  render(<RichLinksPanel {...props} />)
  return props
}

describe("RichLinksPanel", () => {
  beforeEach(() => {
    resetAllStores()
    registerCustomRelations([])
    useItemTypeStore.setState({ relations: [] })
  })

  it("adds a link to a searched target item as a sentence", async () => {
    const user = userEvent.setup()
    const a = makeTask({ id: "a", description: "Write proposal", title: "Write proposal" })
    useTaskStore.getState().setTasks([a, makeTask({ id: "b", description: "Review budget", title: "Review budget" })])
    const props = panel(a)
    await user.click(screen.getByRole("combobox", { name: "Relation" }))
    await user.click(screen.getByRole("option", { name: /^blocks/ }))
    await user.type(screen.getByLabelText("Search item to link"), "budget")
    await user.click(screen.getByRole("option", { name: /Review budget/ }))
    await user.click(screen.getByRole("button", { name: /^Link$/ }))
    expect(props.addLink).toHaveBeenCalledWith("blocks", "b")
  })

  it("lists forward links and removes one", async () => {
    const user = userEvent.setup()
    const task = makeTask({
      id: "a",
      description: "Write proposal",
      links: [{ id: "l1", relation: "blocks", targetId: "b" }],
    })
    useTaskStore.getState().setTasks([task, makeTask({ id: "b", description: "Review budget", title: "Review budget" })])
    const props = panel(task)
    const row = screen.getAllByTestId("link-ledger-row")[0]
    expect(row).toHaveTextContent("Review budget")
    expect(screen.getByRole("heading", { name: "blocks" })).toBeInTheDocument()
    await user.click(screen.getByLabelText("Remove link to Review budget"))
    expect(props.removeLink).toHaveBeenCalledWith("l1")
  })

  it("reads a link pointing here with the inverse relation, opens it, and confirms the reciprocal", async () => {
    const user = userEvent.setup()
    const x = makeTask({ id: "x", description: "Ship release" })
    const y = makeTask({
      id: "y",
      description: "Fix blocker bug",
      title: "Fix blocker bug",
      links: [{ id: "l1", relation: "blocks", targetId: "x" }],
    })
    useTaskStore.getState().setTasks([x, y])
    const props = panel(x)
    expect(screen.getByRole("heading", { name: "blocked by" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Open Fix blocker bug" }))
    expect(props.onOpenItem).toHaveBeenCalledWith("y")
    await user.click(screen.getByRole("button", { name: "Confirm link to Fix blocker bug" }))
    expect(props.addLink).toHaveBeenCalledWith("blocked-by", "y")
  })

  it("shows both sides as one mutual row", () => {
    const a = makeTask({ id: "a", description: "Elijah", type: "person", links: [{ id: "1", relation: "friends-with", targetId: "b" }] })
    const b = makeTask({ id: "b", description: "Oey", title: "Oey", type: "person", links: [{ id: "2", relation: "friends-with", targetId: "a" }] })
    useTaskStore.getState().setTasks([a, b])
    panel(a)
    const rows = screen.getAllByTestId("link-ledger-row")
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveAttribute("data-direction", "mutual")
  })

  it("creates a new relation from the composer and selects it", async () => {
    const user = userEvent.setup()
    const a = makeTask({ id: "a", description: "Elijah", type: "person" })
    useTaskStore.getState().setTasks([a])
    panel(a)
    await user.click(screen.getByRole("combobox", { name: "Relation" }))
    await user.type(screen.getByRole("combobox", { name: "Relation" }), "is the drummer of")
    await user.click(screen.getByRole("option", { name: /Create "is the drummer of"/ }))
    await user.clear(screen.getByLabelText("Reverse phrase"))
    await user.type(screen.getByLabelText("Reverse phrase"), "has drummer")
    await user.click(screen.getByRole("button", { name: "Create" }))
    const relations = useItemTypeStore.getState().relations
    expect(relations.map((r) => r.label).sort()).toEqual(["has drummer", "is the drummer of"])
    expect(screen.getByRole("combobox", { name: "Relation" })).toHaveValue("is the drummer of")
  })

  it("suggests self's link from a Relation word on a person, and Dismiss writes the draft", async () => {
    const user = userEvent.setup()
    const self = makeTask({ id: "person-self", description: "self", title: "self", type: "person", personProfile: { self: true } })
    const oey = makeTask({ id: "oey", description: "Oey", type: "person", lists: [PEOPLE_I_KNOW_LIST_ID], personProfile: { relation: "sister" } })
    useTaskStore.getState().setTasks([self, oey])
    const props = panel(oey)
    const row = screen.getAllByTestId("link-ledger-row")[0]
    expect(row).toHaveAttribute("data-direction", "derived")
    expect(row).toHaveTextContent("self")
    await user.click(screen.getByRole("button", { name: /^Dismiss suggestion/ }))
    expect(props.writeDraft).toHaveBeenCalledWith({ dismissedLinkSuggestions: ["person-self|sibling-of"] })
  })
})
