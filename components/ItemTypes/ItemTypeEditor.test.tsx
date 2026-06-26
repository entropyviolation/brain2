/**
 * ItemTypes manager + editor — smoke + create/delete flow.
 *
 * Drives the real `useItemTypeStore` (reset to its built-ins per test) the same
 * way the other component tests drive their stores.
 */
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useItemTypeStore } from "@/lib/item-type-store"
import { ItemTypeList } from "./ItemTypeList"

describe("ItemTypeList + ItemTypeEditor", () => {
  beforeEach(() => {
    resetLocalStorage()
    useItemTypeStore.getState().resetTypes()
  })

  it("lists built-in types with a built-in badge and a disabled delete", () => {
    render(<ItemTypeList />)

    expect(screen.getByRole("heading", { name: "Item Types" })).toBeInTheDocument()
    expect(screen.getByText("Task")).toBeInTheDocument()
    // Book + Flight are registered as built-ins app-wide.
    expect(screen.getByText("Book")).toBeInTheDocument()
    expect(screen.getByText("Flight")).toBeInTheDocument()
    expect(screen.getAllByText("Built-in").length).toBeGreaterThan(0)

    const deleteTask = screen.getByRole("button", { name: "Delete Task" })
    expect(deleteTask).toBeDisabled()
  })

  it("creates a new user type through the editor", async () => {
    const user = userEvent.setup()
    render(<ItemTypeList />)

    await user.click(screen.getByRole("button", { name: /New type/i }))

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("New item type")).toBeInTheDocument()

    // The Name field is the first textbox in the editor form.
    const nameInput = within(dialog).getAllByRole("textbox")[0]
    await user.type(nameInput, "Recipe")

    await user.click(within(dialog).getByRole("button", { name: /Create type/i }))

    const created = useItemTypeStore.getState().types.find((t) => t.id === "recipe")
    expect(created).toBeDefined()
    expect(created?.name).toBe("Recipe")
    expect(created?.builtin).toBeFalsy()
  })

  it("deletes a user type", async () => {
    const user = userEvent.setup()
    vi.spyOn(window, "confirm").mockReturnValue(true)
    useItemTypeStore.getState().addType({
      id: "friend",
      name: "Friend",
      attributes: [],
    })

    render(<ItemTypeList />)
    expect(screen.getByText("Friend")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Delete Friend" }))

    expect(useItemTypeStore.getState().types.find((t) => t.id === "friend")).toBeUndefined()
  })
})
