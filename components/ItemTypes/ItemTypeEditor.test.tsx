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
    expect(screen.getAllByText("System").length).toBeGreaterThan(0)

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

  it("opens a catalog Book with layout, panels, and implied-action when", async () => {
    const user = userEvent.setup()
    render(<ItemTypeList />)

    await user.click(screen.getByRole("button", { name: /A reading-list entry/i }))

    const dialog = await screen.findByRole("dialog", { name: /Edit Book/i })
    expect(within(dialog).getByText("Detail panels")).toBeInTheDocument()
    expect(within(dialog).getByText("Hero image attribute")).toBeInTheDocument()
    expect(within(dialog).getAllByText("increased").length).toBeGreaterThan(0)
    expect(within(dialog).getByDisplayValue(/read \{delta\} pages of \{title\}/i)).toBeInTheDocument()
  })

  it("applies a Furniture starter recipe onto a new user type", async () => {
    const user = userEvent.setup()
    render(<ItemTypeList />)

    await user.click(screen.getByRole("button", { name: /New type/i }))

    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: /Starter recipes/i }))
    expect(within(dialog).getByText(/wishlist rug/i)).toBeInTheDocument()

    const furnitureCard = within(dialog).getByText("Furniture").closest("div")
    expect(furnitureCard).toBeTruthy()
    await user.click(within(furnitureCard as HTMLElement).getByRole("button", { name: /Use starter/i }))

    expect(within(dialog).getByDisplayValue("My furniture")).toBeInTheDocument()
    expect(within(dialog).getByText("Detail panels")).toBeInTheDocument()
  })
})
