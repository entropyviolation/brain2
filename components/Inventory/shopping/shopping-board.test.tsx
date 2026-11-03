/**
 * Shopping board — several source lists, a row that opens, a key that finishes.
 */
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { openItemDetailPopup } from "@/lib/points-ledger-nav"
import { useTaskStore } from "@/lib/task-store"
import { resetAllStores } from "@/tests/test-utils"
import { readShopBindings, writeShopBindings } from "./shop-bindings"
import { ShoppingBoard } from "./shopping-board"

vi.mock("@/lib/points-ledger-nav", () => ({
  openItemDetailPopup: vi.fn(),
}))

const views = [
  { id: "grocery", name: "Grocery", listIds: ["a"] },
  { id: "shopping", name: "Shopping", listIds: [] as string[] },
  { id: "wish", name: "Wish list", listIds: [] as string[] },
  { id: "wanted", name: "Wanted", listIds: [] as string[] },
]

describe("ShoppingBoard", () => {
  beforeEach(() => {
    resetAllStores()
    vi.mocked(openItemDetailPopup).mockClear()
    writeShopBindings(views)
    useTaskStore.setState({
      lists: [
        { id: "a", name: "Grocery aisle", color: "#6b8f71", createdAt: new Date() },
        { id: "b", name: "Costco", color: "#3d6b8a", createdAt: new Date() },
        { id: "c", name: "Hardware", color: "#8a623d", createdAt: new Date() },
      ],
      folders: [],
      tasks: [
        { id: "milk", title: "Milk", description: "Milk", lists: ["a", "b"], completed: false, createdAt: new Date() },
        { id: "soap", title: "Soap", description: "Soap", lists: ["b"], completed: false, createdAt: new Date() },
      ] as never,
    })
  })

  it("aggregates source lists once, opens on the row, and finishes only from the checkbox", async () => {
    const user = userEvent.setup()
    render(<ShoppingBoard testId="shopping-scene" />)
    expect(screen.getAllByTestId("shop-row")).toHaveLength(1)
    expect(screen.getByRole("button", { name: "Milk" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Soap" })).not.toBeInTheDocument()

    const search = screen.getByRole("textbox", { name: "Search lists for Grocery" })
    await user.type(search, "hard")
    expect(screen.queryByRole("checkbox", { name: "Add to Costco" })).not.toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: "Add to Hardware" })).toBeInTheDocument()
    await user.clear(search)

    await user.click(screen.getByRole("checkbox", { name: "Add to Costco" }))
    expect(screen.getAllByTestId("shop-row")).toHaveLength(2)
    expect(screen.getAllByRole("button", { name: "Milk" })).toHaveLength(1)

    await user.click(screen.getByRole("button", { name: "Milk" }))
    expect(openItemDetailPopup).toHaveBeenCalledWith("milk")

    await user.click(screen.getByRole("checkbox", { name: "Done Soap" }))
    expect(openItemDetailPopup).toHaveBeenCalledTimes(1)
    expect(useTaskStore.getState().tasks.find((task) => task.id === "soap")?.completed).toBe(true)
    expect(useTaskStore.getState().tasks.find((task) => task.id === "milk")?.completed).toBe(false)
  })

  it("presses the active key and adds a shopping list", async () => {
    const user = userEvent.setup()
    render(<ShoppingBoard testId="shopping-scene" />)
    const keys = screen.getByRole("group", { name: "Shopping lists" })
    expect(within(keys).getByRole("button", { name: "Grocery" })).toHaveAttribute("aria-pressed", "true")
    expect(within(keys).getByRole("button", { name: "Grocery" })).toHaveClass("todo-cap")
    expect(within(keys).getByRole("button", { name: "Shopping" })).toHaveAttribute("aria-pressed", "false")

    await user.click(within(keys).getByRole("button", { name: "Add shopping list" }))
    await user.type(within(keys).getByRole("textbox", { name: "New shopping list" }), "Travel")
    await user.click(within(keys).getByRole("button", { name: "Add" }))
    expect(within(keys).getByRole("button", { name: "Travel" })).toHaveAttribute("aria-pressed", "true")
    expect(within(keys).getByRole("button", { name: "Grocery" })).toHaveAttribute("aria-pressed", "false")
    expect(readShopBindings()?.some((view) => view.name === "Travel")).toBe(true)
  })
})
