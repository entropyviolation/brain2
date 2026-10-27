import { useState } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { LinkLedger, visibleEdges } from "@/components/ItemDetail/tabs/links/LinkLedger"
import { LinksHarness } from "@/components/ItemDetail/tabs/links/rich-links-test-utils"
import { commitItemDraft } from "@/lib/commit-item-edit"
import { createListItem } from "@/lib/item-utils"
import { egoEdges, type EgoEdge } from "@/lib/link-graph"
import { PERSON_TYPE_ID } from "@/lib/person-types"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import { resetAllStores } from "@/tests/test-utils"

function person(id: string, title: string, extra: Partial<Task> = {}): Task {
  return { ...createListItem(title, []), id, title, type: PERSON_TYPE_ID, ...extra }
}

describe("LinkLedger", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("confirms an incoming-only row so the draft makes it mutual", async () => {
    const user = userEvent.setup({ delay: null })
    const onDraft = vi.fn()
    const store = useTaskStore.getState()
    store.addTask(person("oey", "Oey"))
    store.addTask(person("linda", "Linda", { links: [{ id: "in1", relation: "mother-of", targetId: "oey" }] }))
    render(<LinksHarness initial={person("oey", "Oey")} onDraft={onDraft} />)

    const row = screen.getByTestId("link-ledger-row")
    expect(row).toHaveAttribute("data-direction", "in")
    expect(within(row).getByLabelText("incoming")).toHaveTextContent("←")
    await user.click(within(row).getByRole("button", { name: "Confirm link to Linda" }))

    const draft = onDraft.mock.calls.at(-1)?.[0] as Task
    expect(draft.links).toEqual([expect.objectContaining({ relation: "child-of", targetId: "linda" })])
    expect(screen.getByTestId("link-ledger-row")).toHaveAttribute("data-direction", "mutual")
  })

  it("removes only this item's own link", async () => {
    const user = userEvent.setup({ delay: null })
    const onDraft = vi.fn()
    const store = useTaskStore.getState()
    store.addTask(person("oey", "Oey"))
    store.addTask(person("sam", "Sam", { links: [{ id: "theirs", relation: "friends-with", targetId: "oey" }] }))
    const start = person("oey", "Oey", { links: [{ id: "mine", relation: "friends-with", targetId: "sam" }] })
    render(<LinksHarness initial={start} onDraft={onDraft} />)

    expect(screen.getByTestId("link-ledger-row")).toHaveAttribute("data-direction", "mutual")
    await user.click(screen.getByRole("button", { name: "Remove link to Sam" }))
    expect((onDraft.mock.calls.at(-1)?.[0] as Task).links).toEqual([])
    expect(useTaskStore.getState().tasks.find((t) => t.id === "sam")?.links).toHaveLength(1)
    expect(screen.getByTestId("link-ledger-row")).toHaveAttribute("data-direction", "in")
  })

  it("dismisses a derived row, and the dismissal survives Save", async () => {
    const user = userEvent.setup({ delay: null })
    const store = useTaskStore.getState()
    const oey = person("oey", "Oey")
    store.addTask(oey)
    store.addTask(person("ana", "Ana"))
    const derived: EgoEdge = { key: "ana|knows", otherId: "ana", relation: "knows", direction: "derived", family: "friend" }
    function Host() {
      const [draft, setDraft] = useState(oey)
      const edges = visibleEdges(egoEdges(draft, useTaskStore.getState().tasks, [derived]), draft.dismissedLinkSuggestions)
      return (
        <>
          <LinkLedger
            edges={edges}
            factsFor={(id) => ({ id, title: id === "ana" ? "Ana" : id, typeIds: [] })}
            onRemove={vi.fn()}
            onConfirm={vi.fn()}
            onPin={vi.fn()}
            onDismiss={(key) => setDraft((d) => ({ ...d, dismissedLinkSuggestions: [...(d.dismissedLinkSuggestions ?? []), key] }))}
          />
          <button type="button" onClick={() => commitItemDraft(oey, draft, "test")}>
            Save
          </button>
        </>
      )
    }
    render(<Host />)
    expect(screen.getByTestId("link-ledger-row")).toHaveAttribute("data-direction", "derived")
    await user.click(screen.getByRole("button", { name: "Dismiss suggestion Ana" }))
    expect(screen.queryByTestId("link-ledger-row")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(useTaskStore.getState().tasks.find((t) => t.id === "oey")?.dismissedLinkSuggestions).toEqual(["ana|knows"])
  })

  it("hides dismissed derived rows and shows one muted line when empty", () => {
    const { container } = render(
      <LinkLedger edges={[]} factsFor={() => null} onRemove={vi.fn()} onConfirm={vi.fn()} onPin={vi.fn()} onDismiss={vi.fn()} />,
    )
    expect(container).toHaveTextContent("No links yet.")
  })
})
