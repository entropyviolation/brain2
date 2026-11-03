/**
 * Desktop kitchen scene — list, filter, and selection. The stage is mocked.
 */
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { formatLocalDateKey } from "@/lib/date-utils"
import { resolveKitchenFood, useKitchenStore } from "@/lib/kitchen-store"
import type { KitchenRoom } from "@/lib/kitchen-types"
import { resetAllStores } from "@/tests/test-utils"
import { KitchenScene } from "./kitchen-scene"

vi.mock("@/components/Home/Tracking/tracking-log/food/kitchen-stage", () => ({
  KitchenStage: ({
    lots,
    active,
    onLot,
    onRoom,
  }: {
    lots: readonly { id?: string; name: string; room: string }[]
    active: KitchenRoom | "all"
    onLot?: (id: string) => void
    onRoom: (room: KitchenRoom) => void
  }) => (
    <div role="img" aria-label="Kitchen stage" data-lots={lots.map((lot) => lot.name).join("|")} data-active={active}>
      <button type="button" onClick={() => onRoom("pantry")}>
        Open pantry
      </button>
      {lots.map((lot) =>
        lot.id ? (
          <button key={lot.id} type="button" onClick={() => onLot?.(lot.id as string)}>
            Jar {lot.name}
          </button>
        ) : null,
      )}
    </div>
  ),
}))

describe("KitchenScene", () => {
  beforeEach(() => {
    resetAllStores()
    useKitchenStore.setState({ foods: [], stock: [], plan: [] })
  })

  it("shows an empty kitchen", () => {
    render(<KitchenScene />)
    expect(screen.getByTestId("kitchen-scene")).toHaveTextContent("The kitchen is empty.")
    expect(screen.getByRole("img", { name: "Kitchen stage" })).toHaveAttribute("data-lots", "")
  })

  it("lists stock, filters the stage, and selects a lot or room", async () => {
    useKitchenStore.setState({
      stock: [
        { id: "oats", foodId: "cat_oats", room: "pantry", amount: 400, unit: "g", boughtOn: "2026-10-01" },
        { id: "eggs", foodId: "cat_egg", room: "fridge", amount: 6, unit: "count", boughtOn: "2026-10-01" },
      ],
      plan: [{ id: "p1", date: "2026-10-28", meal: "dinner", kind: "recipe", refId: "r", servings: 1 }],
    })
    const user = userEvent.setup()
    render(<KitchenScene />)
    expect(screen.getByText("1 meal on the plan")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Oats, rolled/ })).toHaveTextContent("Pantry")
    expect(screen.getByRole("button", { name: /^Oats, rolled/ })).toHaveTextContent("400 g")

    await user.click(screen.getByRole("button", { name: "Jar Oats, rolled" }))
    expect(screen.getByTestId("kitchen-detail")).toHaveTextContent("Oats, rolled · Pantry · 400 g")
    expect(screen.getByRole("img", { name: "Kitchen stage" })).toHaveAttribute("data-active", "pantry")

    await user.click(screen.getByRole("button", { name: "Open pantry" }))
    expect(screen.getByTestId("kitchen-detail")).toHaveTextContent("Pantry")

    await user.type(screen.getByRole("textbox", { name: "Filter foods" }), "egg")
    expect(screen.queryByRole("button", { name: /^Oats, rolled/ })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Egg/ })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Kitchen stage" })).toHaveAttribute("data-lots", "Egg")
  })

  it("puts a named lot into the chosen section", async () => {
    const user = userEvent.setup()
    render(<KitchenScene />)
    const form = screen.getByRole("form", { name: "Add food" })
    expect(within(form).getByRole("button", { name: "Pantry" })).toHaveAttribute("aria-pressed", "true")
    expect(within(form).getByRole("button", { name: "Spice cabinet" })).toBeInTheDocument()
    expect(within(form).getByRole("button", { name: "Add" })).toBeDisabled()

    await user.type(within(form).getByRole("textbox", { name: "Food name" }), "   ")
    expect(within(form).getByRole("button", { name: "Add" })).toBeDisabled()

    await user.clear(within(form).getByRole("textbox", { name: "Food name" }))
    await user.type(within(form).getByRole("textbox", { name: "Food name" }), "Oats")
    await user.click(within(form).getByRole("button", { name: "Add" }))

    const lot = useKitchenStore.getState().stock[0]
    expect(lot).toMatchObject({
      room: "pantry",
      foodId: "cat_oats",
      amount: 1,
      unit: "count",
      boughtOn: formatLocalDateKey(new Date()),
    })
    expect(lot?.finished).toBeUndefined()
    expect(resolveKitchenFood(lot!.foodId, useKitchenStore.getState().foods)?.name).toBe("Oats, rolled")
    expect(screen.getByRole("button", { name: /^Oats, rolled/ })).toHaveTextContent("Pantry")
    expect(screen.getByRole("button", { name: /^Oats, rolled/ })).toHaveTextContent("1")
    expect(screen.getByRole("img", { name: "Kitchen stage" })).toHaveAttribute("data-lots", "Oats, rolled")
    expect(screen.getByRole("img", { name: "Kitchen stage" })).toHaveAttribute("data-active", "pantry")
    expect(screen.getByTestId("kitchen-added")).toHaveTextContent("Oats are in the pantry.")
    expect(within(form).getByRole("textbox", { name: "Food name" })).toHaveValue("")
    expect(within(form).getByRole("button", { name: "Pantry" })).toHaveAttribute("aria-pressed", "true")

    await user.click(within(form).getByRole("button", { name: "Fridge" }))
    await user.type(within(form).getByRole("textbox", { name: "Food name" }), "Yogurt")
    await user.clear(within(form).getByRole("textbox", { name: "Amount" }))
    await user.type(within(form).getByRole("textbox", { name: "Amount" }), "2")
    await user.click(within(form).getByRole("button", { name: "Add" }))

    const fridge = useKitchenStore.getState().stock.find((row) => row.room === "fridge")
    expect(fridge).toMatchObject({ room: "fridge", amount: 2, unit: "count" })
    expect(fridge?.finished).toBeUndefined()
    expect(resolveKitchenFood(fridge!.foodId, useKitchenStore.getState().foods)?.name).toBe("Yogurt")
    expect(screen.getByRole("button", { name: /^Yogurt/ })).toHaveTextContent("Fridge")
    expect(screen.getByTestId("kitchen-added")).toHaveTextContent("Yogurt are in the fridge.")
    expect(screen.getByRole("img", { name: "Kitchen stage" }).getAttribute("data-lots")).toContain("Yogurt")
  })
})
