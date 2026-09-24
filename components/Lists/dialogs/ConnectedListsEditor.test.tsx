/**
 * ConnectedListsEditor — connect two lists; mirror on the other side.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { createListItem } from "@/lib/item-utils"
import { linksForList } from "@/lib/list-links"
import { useTaskStore } from "@/lib/task-store"
import type { List } from "@/lib/types"
import { ConnectedListsEditor } from "./ConnectedListsEditor"

const cat = (id: string, name: string): List => ({
  id,
  name,
  color: "#3B82F6",
  description: "",
  createdAt: new Date("2026-01-01"),
  order: 0,
})

describe("ConnectedListsEditor", () => {
  beforeEach(() => {
    resetAllStores()
    useTaskStore.getState().setLists([cat("a", "Alpha"), cat("b", "Beta")])
    useTaskStore.getState().addTask({ ...createListItem("Alpha item", ["a"]), id: "item-a" })
  })

  it("connects A→B from Alpha settings and shows the receive side on Beta", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<ConnectedListsEditor listId="a" />)
    await user.click(screen.getByText("Beta"))
    await user.click(screen.getByRole("button", { name: "Connect" }))
    expect(screen.getByText("Also shows these items on Beta")).toBeInTheDocument()
    expect(useTaskStore.getState().tasks.find((t) => t.id === "item-a")?.lists).toEqual(["a", "b"])

    rerender(<ConnectedListsEditor listId="b" />)
    expect(screen.getByText("Receives all items from Alpha")).toBeInTheDocument()
    expect(linksForList(useTaskStore.getState().lists, "b")[0]?.role).toBe("receive")
  })

  it("can connect from the receive side (B settings writes A→B)", async () => {
    const user = userEvent.setup()
    render(<ConnectedListsEditor listId="b" />)
    await user.click(screen.getByRole("radio", { name: /Every item on that list also appears here/i }))
    await user.click(screen.getByText("Alpha"))
    await user.click(screen.getByRole("button", { name: "Connect" }))
    expect(screen.getByText("Receives all items from Alpha")).toBeInTheDocument()
    expect(useTaskStore.getState().lists.find((l) => l.id === "a")?.linkedTargetListIds).toEqual(["b"])
  })

  it("removes the link without deleting items already on both lists", async () => {
    const user = userEvent.setup()
    useTaskStore.getState().addListLink("a", "b")
    expect(useTaskStore.getState().tasks.find((t) => t.id === "item-a")?.lists).toEqual(["a", "b"])
    render(<ConnectedListsEditor listId="a" />)
    await user.click(screen.getByRole("button", { name: "Remove connection with Beta" }))
    expect(screen.queryByText("Also shows these items on Beta")).not.toBeInTheDocument()
    expect(useTaskStore.getState().tasks.find((t) => t.id === "item-a")?.lists).toEqual(["a", "b"])
    expect(useTaskStore.getState().lists.find((l) => l.id === "a")?.linkedTargetListIds).toBeUndefined()
  })

  it("renders a searchable row picker and chips the pending target", async () => {
    const user = userEvent.setup()
    useTaskStore.getState().setLists([cat("a", "Alpha"), cat("b", "Beta"), cat("c", "Gamma")])
    render(<ConnectedListsEditor listId="a" />)
    expect(screen.getByRole("textbox", { name: "Search lists" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Beta" })).toHaveClass("list-picker-row")
    expect(screen.getByRole("button", { name: "Gamma" })).toHaveClass("list-picker-row")
    expect(screen.queryByRole("button", { name: "Alpha" })).not.toBeInTheDocument()

    await user.type(screen.getByRole("textbox", { name: "Search lists" }), "gam")
    expect(screen.getByRole("button", { name: "Gamma" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Beta" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Gamma" }))
    expect(screen.getByRole("button", { name: "Remove Gamma" })).toBeInTheDocument()
    expect(screen.getByText("Selected (1)")).toBeInTheDocument()
  })
})
