/**
 * Inventory room — scene switch and bookshelf list persistence.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { APP_NAV_KEYS, readStoredId, readStoredTab } from "@/lib/app-navigation"
import { useTaskStore } from "@/lib/task-store"
import { useWardrobeStore } from "@/lib/wardrobe"
import { resetAllStores } from "@/tests/test-utils"
import { InventoryView } from "./InventoryView"
import { INVENTORY_SCENE_IDS } from "./inventory-scenes"

vi.mock("@/components/Home/Tracking/tracking-log/food/kitchen-stage", () => ({
  KitchenStage: () => <div role="img" aria-label="Kitchen stage" />,
}))

describe("InventoryView", () => {
  beforeEach(() => {
    resetAllStores()
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: false,
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
          onchange: null,
        }) as MediaQueryList,
    )
    useTaskStore.setState({
      lists: [
        { id: "novels", name: "Novels", color: "#888888", createdAt: new Date() },
        { id: "essays", name: "Essays", color: "#888888", createdAt: new Date() },
      ],
      tasks: [
        { id: "b1", title: "Middlemarch", description: "Middlemarch", lists: ["novels"] },
        { id: "b2", title: "Outline", description: "Outline", lists: ["essays"] },
      ] as never,
      folders: [],
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("switches scene and keeps the choice", async () => {
    const user = userEvent.setup()
    const view = render(<InventoryView />)
    expect(screen.getByTestId("bookshelf-scene")).toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: "Closet" }))
    expect(screen.getByTestId("closet-scene")).toBeInTheDocument()
    expect(screen.queryByTestId("bookshelf-scene")).not.toBeInTheDocument()
    expect(readStoredTab(APP_NAV_KEYS.inventoryScene, INVENTORY_SCENE_IDS, "bookshelf")).toBe("closet")

    view.unmount()
    render(<InventoryView />)
    expect(screen.getByTestId("closet-scene")).toBeInTheDocument()
  })

  it("persists the shelf list and shows that list's titles", async () => {
    const user = userEvent.setup()
    const view = render(<InventoryView />)
    expect(screen.getByTestId("bookshelf-scene")).toHaveTextContent("No list")

    await user.click(screen.getByRole("button", { name: "Novels" }))
    const stage = screen.getByTestId("bookshelf-scene")
    expect(stage).toHaveAttribute("data-list-id", "novels")
    expect(stage).toHaveTextContent("1 item")
    expect(stage).toHaveTextContent("Middlemarch")
    expect(stage).not.toHaveTextContent("Outline")
    expect(readStoredId(APP_NAV_KEYS.inventoryBookshelfList)).toBe("novels")

    view.unmount()
    render(<InventoryView />)
    expect(screen.getByTestId("bookshelf-scene")).toHaveTextContent("Middlemarch")
    expect(screen.getByTestId("bookshelf-scene")).not.toHaveTextContent("Outline")
  })

  it("kitchen is a scene beside the shelf and the closet", async () => {
    const user = userEvent.setup()
    const view = render(<InventoryView />)
    expect(screen.getByRole("tab", { name: "Kitchen" })).toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: "Kitchen" }))
    expect(screen.getByTestId("kitchen-scene")).toBeInTheDocument()
    expect(screen.queryByTestId("bookshelf-scene")).not.toBeInTheDocument()
    expect(screen.queryByTestId("closet-scene")).not.toBeInTheDocument()
    expect(readStoredTab(APP_NAV_KEYS.inventoryScene, INVENTORY_SCENE_IDS, "bookshelf")).toBe("kitchen")

    view.unmount()
    render(<InventoryView />)
    expect(screen.getByTestId("kitchen-scene")).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Bookshelf" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Closet" })).toBeInTheDocument()
  })

  it("closet stage reads wardrobe pieces", async () => {
    useWardrobeStore.getState().addPiece({ name: "Wool coat", category: "layer" })
    const user = userEvent.setup()
    render(<InventoryView />)
    await user.click(screen.getByRole("tab", { name: "Closet" }))
    expect(screen.getByTestId("closet-scene")).toHaveTextContent("1 piece")
  })
})
