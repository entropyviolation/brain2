/**
 * components/Home/Tracking/tracking-log/food/food-kitchen-panel.test.tsx
 */
import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { FoodKitchenPanel } from "@/components/Home/Tracking/tracking-log/food/food-kitchen-panel"
import { nutrientsFrom } from "@/lib/kitchen-nutrients"
import { useKitchenStore } from "@/lib/kitchen-store"
import { resetAllStores } from "@/tests/test-utils"

vi.mock("@/components/Home/Tracking/tracking-log/food/kitchen-stage", () => ({
  KitchenStage: () => <div role="img" aria-label="Kitchen. Fridge, pantry, spice cabinet, and freezer." />,
}))

describe("Food kitchen panel", () => {
  beforeEach(() => {
    resetAllStores()
    useKitchenStore.setState({ foods: [], recipes: [], stock: [], plates: [] })
  })

  it("edits a saved food and leaves catalog rows off the list", () => {
    useKitchenStore.setState({
      foods: [
        {
          id: "food_oats",
          name: "Rolled oats",
          per100g: nutrientsFrom({ kcal: 379, proteinG: 13.2 }),
          gramsPerUnit: 40,
          source: "custom",
          room: "pantry",
          keepDays: { pantry: 180 },
        },
      ],
    })
    render(<FoodKitchenPanel />)
    expect(screen.getByRole("img", { name: /Kitchen/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Put away" })).toBeInTheDocument()
    const row = screen.getByRole("button", { name: /Rolled oats/ })
    expect(row).toHaveTextContent("379 kcal per 100 g")
    expect(screen.queryByRole("button", { name: /Banana/ })).toBeNull()

    fireEvent.click(row)
    fireEvent.change(screen.getByLabelText("Saved food name"), { target: { value: "Steel oats" } })
    fireEvent.change(screen.getByLabelText("Grams per serving"), { target: { value: "50" } })
    fireEvent.change(screen.getByLabelText("Calories per 100 g"), { target: { value: "380" } })
    fireEvent.click(screen.getByRole("button", { name: "Save food" }))

    const saved = useKitchenStore.getState().foods.find((food) => food.id === "food_oats")
    expect(saved?.name).toBe("Steel oats")
    expect(saved?.gramsPerUnit).toBe(50)
    expect(saved?.per100g.kcal).toBe(380)
    expect(saved?.per100g.proteinG).toBe(13.2)
    expect(saved?.source).toBe("custom")
    expect(saved?.room).toBe("pantry")
    expect(saved?.keepDays).toEqual({ pantry: 180 })
    expect(screen.getByRole("button", { name: /Steel oats/ })).toHaveTextContent("380 kcal per 100 g")
  })

  it("retires a food without rewriting a logged plate until refresh", () => {
    useKitchenStore.setState({
      foods: [
        {
          id: "food_oats",
          name: "Rolled oats",
          per100g: nutrientsFrom({ kcal: 379 }),
          gramsPerUnit: 40,
          source: "custom",
          barcode: "001",
          brand: "Mill",
        },
      ],
      plates: [
        {
          id: "p1",
          entryId: "e1",
          accepted: true,
          slot: "meal",
          mode: "single",
          lines: [{ foodId: "food_oats", grams: 40 }],
          fromKitchen: false,
          drawn: [],
          nutrientSnapshot: nutrientsFrom({ kcal: 10 }),
        },
      ],
    })
    render(<FoodKitchenPanel />)
    fireEvent.click(screen.getByRole("button", { name: /Rolled oats/ }))
    const editor = screen.getByRole("form", { name: "Edit Rolled oats" })
    fireEvent.change(within(editor).getByLabelText("Brand"), { target: { value: "Stone" } })
    fireEvent.change(within(editor).getByLabelText("Barcode"), { target: { value: "009" } })
    fireEvent.click(screen.getByRole("button", { name: "Save food" }))
    expect(useKitchenStore.getState().foods[0]?.brand).toBe("Stone")
    expect(useKitchenStore.getState().foods[0]?.barcode).toBe("009")
    expect(useKitchenStore.getState().plates[0]?.nutrientSnapshot?.kcal).toBe(10)

    fireEvent.click(screen.getByRole("button", { name: "Refresh logged plates" }))
    expect(useKitchenStore.getState().plates[0]?.nutrientSnapshot?.kcal).toBeCloseTo(151.6)

    fireEvent.click(screen.getByRole("button", { name: "Retire" }))
    expect(screen.queryByRole("button", { name: /Rolled oats/ })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Retired" }))
    expect(screen.getByRole("button", { name: /Rolled oats/ })).toBeInTheDocument()
    expect(useKitchenStore.getState().foods[0]?.retired).toBe(true)
  })

  it("says when nothing is saved", () => {
    render(<FoodKitchenPanel />)
    expect(screen.getByRole("region", { name: "Saved foods" })).toHaveTextContent("Nothing saved.")
  })
})
