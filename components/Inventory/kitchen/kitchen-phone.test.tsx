/**
 * Phone kitchen — room groups and the name filter. No WebGL.
 */
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { resolveKitchenFood, useKitchenStore } from "@/lib/kitchen-store"
import { resetAllStores } from "@/tests/test-utils"
import { KitchenPhone } from "./kitchen-phone"

describe("KitchenPhone", () => {
  beforeEach(() => {
    resetAllStores()
    useKitchenStore.setState({ foods: [], stock: [], plan: [] })
  })

  it("groups living stock and filters by name", async () => {
    useKitchenStore.setState({
      stock: [
        { id: "oats", foodId: "cat_oats", room: "pantry", amount: 400, unit: "g", boughtOn: "2026-10-01" },
        { id: "eggs", foodId: "cat_egg", room: "fridge", amount: 6, unit: "count", boughtOn: "2026-10-01" },
      ],
    })
    const user = userEvent.setup()
    render(<KitchenPhone />)
    expect(screen.getByRole("region", { name: "Pantry" })).toHaveTextContent("Oats, rolled")
    expect(screen.getByRole("region", { name: "Fridge" })).toHaveTextContent("Egg")
    expect(screen.queryByRole("region", { name: "Freezer" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Oats, rolled/ }))
    expect(screen.getByTestId("kitchen-detail")).toHaveTextContent("Oats, rolled · Pantry · 400 g")

    await user.click(within(screen.getByRole("region", { name: "Fridge" })).getByRole("button", { name: "Fridge" }))
    expect(screen.getByTestId("kitchen-detail")).toHaveTextContent("Fridge")
    expect(within(screen.getByRole("form", { name: "Add food" })).getByRole("button", { name: "Fridge" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )

    await user.type(screen.getByRole("textbox", { name: "Filter foods" }), "egg")
    expect(screen.queryByRole("button", { name: /Oats, rolled/ })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Egg/ })).toBeInTheDocument()
  })

  it("stays quiet when the kitchen is empty", () => {
    render(<KitchenPhone />)
    expect(screen.getByTestId("kitchen-phone")).toHaveTextContent("The kitchen is empty.")
    expect(screen.getByRole("group", { name: "Section" })).toBeInTheDocument()
  })

  it("puts a named lot into the section button that is pressed", async () => {
    const user = userEvent.setup()
    render(<KitchenPhone />)
    const form = screen.getByRole("form", { name: "Add food" })
    expect(within(form).getByRole("button", { name: "Add" })).toBeDisabled()

    await user.type(within(form).getByRole("textbox", { name: "Food name" }), "Oats")
    await user.click(within(form).getByRole("button", { name: "Add" }))
    expect(screen.getByRole("region", { name: "Pantry" })).toHaveTextContent("Oats, rolled")
    expect(screen.getByTestId("kitchen-added")).toHaveTextContent("Oats are in the pantry.")
    expect(within(form).getByRole("textbox", { name: "Food name" })).toHaveValue("")
    const pantry = useKitchenStore.getState().stock[0]
    expect(pantry).toMatchObject({ room: "pantry", foodId: "cat_oats", amount: 1, unit: "count" })
    expect(pantry?.finished).toBeUndefined()

    await user.click(within(form).getByRole("button", { name: "Fridge" }))
    await user.type(within(form).getByRole("textbox", { name: "Food name" }), "Yogurt")
    await user.click(within(form).getByRole("button", { name: "Add" }))
    expect(screen.getByRole("region", { name: "Fridge" })).toHaveTextContent("Yogurt")
    expect(screen.getByTestId("kitchen-added")).toHaveTextContent("Yogurt are in the fridge.")
    const fridge = useKitchenStore.getState().stock.find((row) => row.room === "fridge")
    expect(fridge).toMatchObject({ room: "fridge", amount: 1, unit: "count" })
    expect(resolveKitchenFood(fridge!.foodId, useKitchenStore.getState().foods)?.name).toBe("Yogurt")
    expect(fridge?.finished).toBeUndefined()
  })
})