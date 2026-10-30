/**
 * Phone scene switch. Kitchen stays the room list.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { beforeEach, describe, expect, it } from "vitest"
import { useKitchenStore } from "@/lib/kitchen-store"
import { resetAllStores } from "@/tests/test-utils"
import type { InventorySceneId } from "../inventory-scenes"
import { InventoryPhone } from "./inventory-phone"

function Harness({ initial }: { initial: InventorySceneId }) {
  const [scene, setScene] = useState(initial)
  return <InventoryPhone scene={scene} onScene={setScene} listId={null} onListId={() => {}} />
}

describe("InventoryPhone scenes", () => {
  beforeEach(() => {
    resetAllStores()
    useKitchenStore.setState({ foods: [], stock: [], plan: [] })
  })

  it("reaches the phone kitchen, the cover shelf, and the closet", async () => {
    const user = userEvent.setup()
    render(<Harness initial="bookshelf" />)
    expect(screen.getByTestId("bookshelf-phone")).toBeInTheDocument()
    expect(screen.queryByTestId("kitchen-phone")).not.toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: "Kitchen" }))
    expect(screen.getByTestId("kitchen-phone")).toHaveTextContent("The kitchen is empty.")
    expect(screen.queryByTestId("bookshelf-phone")).not.toBeInTheDocument()
    expect(screen.queryByTestId("closet-phone")).not.toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: "Closet" }))
    expect(screen.getByTestId("closet-phone")).toBeInTheDocument()
    expect(screen.queryByTestId("kitchen-phone")).not.toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: "Gems and Trinkets" }))
    expect(screen.getByTestId("gems-phone")).toHaveTextContent("No gems or trinkets.")
    expect(screen.queryByTestId("closet-phone")).not.toBeInTheDocument()
  })
})
