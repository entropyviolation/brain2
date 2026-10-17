import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { LinksHarness } from "@/components/ItemDetail/links/rich-links-test-utils"
import { createListItem } from "@/lib/item-utils"
import { useItemTypeStore } from "@/lib/item-type-store"
import { relationLabel } from "@/lib/links"
import { PERSON_TYPE_ID } from "@/lib/person-types"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import { resetAllStores } from "@/tests/test-utils"

function item(id: string, title: string, type?: string): Task {
  return { ...createListItem(title, []), id, title, ...(type ? { type } : {}) }
}

describe("LinkComposer", () => {
  beforeEach(() => {
    resetAllStores()
    useItemTypeStore.setState({ relations: [] })
    const store = useTaskStore.getState()
    store.addTask(item("elijah", "Elijah", PERSON_TYPE_ID))
    store.addTask(item("oey", "Oey", PERSON_TYPE_ID))
    store.addTask(item("foxtide", "Foxtide"))
  })

  it("creates a new relation and links with it in one flow", async () => {
    const user = userEvent.setup({ delay: null })
    const onDraft = vi.fn()
    render(<LinksHarness initial={item("elijah", "Elijah", PERSON_TYPE_ID)} onDraft={onDraft} />)

    await user.click(screen.getByRole("combobox", { name: "Relation" }))
    await user.type(screen.getByRole("combobox", { name: "Relation" }), "is the drummer for")
    await user.click(screen.getByRole("option", { name: 'Create "is the drummer for"' }))
    const form = screen.getByRole("form", { name: "New relation" })
    await user.type(within(form).getByLabelText("Reverse phrase"), "has drummer")
    await user.selectOptions(within(form).getByLabelText("From type"), "")
    await user.click(within(form).getByRole("button", { name: "Create" }))

    const created = useItemTypeStore.getState().relations
    expect(created).toHaveLength(2)
    expect(created[0]).toMatchObject({ label: "is the drummer for", inverseLabel: "has drummer", custom: true })
    expect(relationLabel(created[0]!.id)).toBe("is the drummer for")

    await user.type(screen.getByRole("combobox", { name: "Search item to link" }), "Fox")
    await user.click(screen.getByRole("option", { name: /Foxtide/ }))
    await user.click(screen.getByRole("button", { name: "Link" }))

    const draft = onDraft.mock.calls.at(-1)?.[0] as Task
    expect(draft.links).toEqual([expect.objectContaining({ relation: created[0]!.id, targetId: "foxtide" })])
    expect(screen.getByRole("region", { name: "is the drummer for" })).toHaveTextContent("Foxtide")
  })

  it("filters targets by a scoped relation's to types", async () => {
    const user = userEvent.setup({ delay: null })
    render(<LinksHarness initial={item("elijah", "Elijah", PERSON_TYPE_ID)} />)
    await user.click(screen.getByRole("combobox", { name: "Relation" }))
    await user.click(screen.getByRole("option", { name: "is friends with" }))

    await user.type(screen.getByRole("combobox", { name: "Search item to link" }), "o")
    const options = screen.getAllByRole("option").map((el) => el.textContent ?? "")
    expect(options.some((text) => text.includes("Oey"))).toBe(true)
    expect(options.some((text) => text.includes("Foxtide"))).toBe(false)
    expect(options.some((text) => text.includes("Elijah"))).toBe(false)
  })

  it("lists this type's relations first", async () => {
    const user = userEvent.setup({ delay: null })
    render(<LinksHarness initial={item("elijah", "Elijah", PERSON_TYPE_ID)} />)
    await user.click(screen.getByRole("combobox", { name: "Relation" }))
    const heads = [...document.querySelectorAll(".rl-menu-head")].map((el) => el.textContent)
    expect(heads[0]).toBe(`For ${PERSON_TYPE_ID}`)
    expect(heads).toContain("Any")
  })

  it("refuses a pair that already exists and flashes its row", async () => {
    const user = userEvent.setup({ delay: null })
    const onDraft = vi.fn()
    const onDuplicate = vi.fn()
    const start = { ...item("elijah", "Elijah", PERSON_TYPE_ID), links: [{ id: "l1", relation: "knows", targetId: "oey" }] }
    render(<LinksHarness initial={start} onDraft={onDraft} onDuplicate={onDuplicate} />)

    // Pick Oey under another relation, then switch to the one already linked.
    await user.click(screen.getByRole("combobox", { name: "Relation" }))
    await user.click(screen.getByRole("option", { name: "is friends with" }))
    await user.type(screen.getByRole("combobox", { name: "Search item to link" }), "Oey")
    await user.click(screen.getByRole("option", { name: /Oey/ }))
    await user.click(screen.getByRole("combobox", { name: "Relation" }))
    await user.type(screen.getByRole("combobox", { name: "Relation" }), "knows")
    await user.keyboard("{Enter}")
    await user.click(screen.getByRole("button", { name: "Link" }))

    expect(onDraft).not.toHaveBeenCalled()
    expect(onDuplicate).toHaveBeenCalledWith("oey|knows")
    expect(screen.getByTestId("link-ledger-row")).toHaveAttribute("data-flash", "true")
  })
})
