/**
 * components/Home/Tracking/tracking-log/food/food-detail.test.tsx
 */
import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { FoodDetailDialog } from "@/components/Home/Tracking/tracking-log/food/food-detail-dialog"
import { classifyLogBookRow, type LogBookEntry } from "@/components/Home/Tracking/tracking-log-model"
import { bumpInventory, inventoryOffers } from "@/lib/ingest/apply-inventory"
import { readDayNote, resetKitchenDayNotes } from "@/lib/kitchen-day-note"
import { useKitchenStore } from "@/lib/kitchen-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { resetAllStores } from "@/tests/test-utils"

const entry = {
  id: "e1",
  title: "lunch",
  date: "2026-10-27",
  startMin: 12 * 60,
  kind: "instant",
  list: "food",
  kindKey: "intake.food",
} as LogBookEntry

function acceptPlate() {
  const buttons = screen.getAllByRole("button", { name: "Accept" })
  fireEvent.click(buttons[buttons.length - 1]!)
}

function LiveFood({ anchor = new Date(2026, 9, 27, 15) }: { anchor?: Date }) {
  const entries = useTimeTrackingStore((s) => s.entries)
  const food = entries
    .map((row) => classifyLogBookRow(row))
    .filter((row): row is LogBookEntry => row?.list === "food")
  return (
    <FoodDetailDialog
      open
      onOpenChange={() => {}}
      anchor={anchor}
      entries={food}
      onOpenEntry={() => {}}
    />
  )
}

describe("Food detail", () => {
  beforeEach(() => {
    resetAllStores()
    resetKitchenDayNotes()
    useKitchenStore.setState({ foods: [], recipes: [], orders: [], stock: [], plates: [], plan: [], grocery: [], pinnedIds: [] })
  })

  it("accepts a searched food as a meal and adds the calories", () => {
    render(
      <FoodDetailDialog
        open
        onOpenChange={() => {}}
        anchor={new Date(2026, 9, 27, 12)}
        entries={[entry]}
        onOpenEntry={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /lunch/ }))
    fireEvent.change(screen.getByLabelText("Search foods"), { target: { value: "banana" } })
    fireEvent.click(screen.getByRole("button", { name: /Banana/ }))
    fireEvent.change(screen.getByLabelText("Grams of Banana"), { target: { value: "100" } })
    acceptPlate()
    const dialog = screen.getByRole("dialog", { name: "Food" })
    expect(within(dialog).getByRole("region", { name: "Meals" })).toHaveTextContent("89 kcal")
    expect(dialog).toHaveTextContent("89 kcal")
    expect(useKitchenStore.getState().plates[0]?.slot).toBe("meal")
    expect(useKitchenStore.getState().plates[0]?.accepted).toBe(true)
  })

  it("files a snack apart from meals", () => {
    render(<LiveFood />)
    fireEvent.click(screen.getByRole("button", { name: "Add a snack" }))
    fireEvent.change(screen.getByLabelText("Search foods"), { target: { value: "apple" } })
    fireEvent.click(screen.getByRole("button", { name: /^Apple/ }))
    fireEvent.change(screen.getByLabelText("Grams of Apple"), { target: { value: "100" } })
    acceptPlate()
    expect(useKitchenStore.getState().plates[0]?.slot).toBe("snack")
    expect(useKitchenStore.getState().plates[0]?.accepted).toBe(true)
    expect(screen.getByLabelText("Calories")).toHaveTextContent("52 kcal")
  })

  it("names a week range and keeps a single nutrient grid", () => {
    render(
      <FoodDetailDialog
        open
        onOpenChange={() => {}}
        anchor={new Date(2026, 9, 27, 12)}
        entries={[entry]}
        onOpenEntry={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "This week" }))
    const calories = screen.getByLabelText("Calories")
    expect(within(calories).getByText("This week")).toBeInTheDocument()
    expect(within(calories).queryByText("Day")).not.toBeInTheDocument()
    expect(screen.getAllByRole("heading", { name: "This week" })).toHaveLength(1)
    expect(screen.queryByRole("heading", { name: "Day" })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Day total" })).not.toBeInTheDocument()
    expect(document.querySelectorAll(".trk-food-nuts")).toHaveLength(1)
  })

  it("keeps a day note off the calorie totals", () => {
    render(
      <FoodDetailDialog
        open
        onOpenChange={() => {}}
        anchor={new Date(2026, 9, 27, 12)}
        entries={[entry]}
        onOpenEntry={() => {}}
      />,
    )
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "late soup" } })
    fireEvent.blur(screen.getByLabelText("Note"))
    expect(readDayNote("2026-10-27")).toBe("late soup")
    expect(screen.getByLabelText("Calories")).not.toHaveTextContent("late soup")
  })

  it("edits servings and grams as the same amount", () => {
    render(
      <FoodDetailDialog
        open
        onOpenChange={() => {}}
        anchor={new Date(2026, 9, 27, 12)}
        entries={[entry]}
        onOpenEntry={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /lunch/ }))
    fireEvent.change(screen.getByLabelText("Search foods"), { target: { value: "banana" } })
    fireEvent.click(screen.getByRole("button", { name: /Banana/ }))
    expect(screen.getByText("× 118 g")).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Servings of Banana"), { target: { value: "2" } })
    expect(screen.getByLabelText("Grams of Banana")).toHaveValue("236")
    fireEvent.change(screen.getByLabelText("Grams of Banana"), { target: { value: "59" } })
    expect(screen.getByLabelText("Servings of Banana")).toHaveValue("0.5")
  })

  it("files sometime this week on Monday with an unknown clock", () => {
    render(<LiveFood />)
    fireEvent.click(screen.getByRole("button", { name: "Add a meal" }))
    fireEvent.click(screen.getByRole("button", { name: "Sometime this week" }))
    const food = useTimeTrackingStore.getState().entries.filter((row) => row.intakeClass === "food")
    expect(food).toHaveLength(1)
    expect(food[0]?.date).toBe("2026-10-26")
    expect(food[0]?.clockCertainty).toBe("unknown")
    expect(food[0]?.startMin).toBe(12 * 60)
  })

  it("copies a plate onto another day", () => {
    render(<LiveFood />)
    fireEvent.click(screen.getByRole("button", { name: "Add a meal" }))
    acceptPlate()
    fireEvent.change(screen.getByLabelText("Day"), { target: { value: "2026-10-20" } })
    fireEvent.click(screen.getByRole("button", { name: "Copy" }))
    const dates = useTimeTrackingStore
      .getState()
      .entries.filter((row) => row.intakeClass === "food")
      .map((row) => row.date)
      .sort()
    expect(dates).toEqual(["2026-10-20", "2026-10-27"])
    expect(useKitchenStore.getState().plates).toHaveLength(2)
    expect(useKitchenStore.getState().plates.every((plate) => plate.accepted)).toBe(true)
  })

  it("leaves a missing label line blank and keeps a per-100g panel", () => {
    render(<LiveFood />)
    fireEvent.click(screen.getByRole("button", { name: "Add a meal" }))
    fireEvent.change(screen.getByLabelText("Label text"), {
      target: {
        value: `Nutrition Facts
Serving size 50g
Per 100g
Calories 364
Total Fat 1.9g
Protein 11g`,
      },
    })
    fireEvent.click(screen.getByRole("button", { name: "Read label" }))
    expect(screen.getByRole("heading", { name: "Per 100 g" })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Calories" })).toHaveValue("364")
    expect(screen.getByRole("textbox", { name: "Fiber" })).toHaveValue("")
    expect(screen.getByLabelText("Serving grams")).toHaveValue("50")
    fireEvent.change(screen.getByLabelText("Label food name"), { target: { value: "Oat flour" } })
    fireEvent.click(screen.getByRole("button", { name: "Use these numbers" }))
    const saved = useKitchenStore.getState().foods.find((food) => food.name === "Oat flour")
    expect(saved?.per100g.kcal).toBe(364)
    expect(saved?.per100g.fiberG).toBe(0)
    expect(saved?.gramsPerUnit).toBe(50)
  })

  it("plans a recipe without logging it until the plate is accepted", () => {
    const recipe = useKitchenStore.getState().saveRecipe({
      name: "Oats",
      servings: 1,
      lines: [{ foodId: "cat_oats", grams: 40 }],
    })
    render(<LiveFood />)
    fireEvent.click(screen.getByRole("tab", { name: "Recipes" }))
    fireEvent.change(screen.getByLabelText("Breakfast on 2026-10-27"), { target: { value: `recipe:${recipe!.id}` } })
    expect(useKitchenStore.getState().plates).toHaveLength(0)
    expect(useTimeTrackingStore.getState().entries.filter((row) => row.intakeClass === "food")).toHaveLength(0)
    expect(screen.getByText("1 to buy")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Grocery list" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Log this" }))
    expect(useKitchenStore.getState().plates).toHaveLength(0)
    expect(useKitchenStore.getState().plan).toHaveLength(1)
    acceptPlate()
    expect(useKitchenStore.getState().plates).toHaveLength(1)
    expect(useKitchenStore.getState().plates[0]?.accepted).toBe(true)
    expect(useKitchenStore.getState().plates[0]?.recipeId).toBe(recipe!.id)
  })

  it("shows a meal photo on the journal row", () => {
    useKitchenStore.getState().savePlate({
      entryId: "e1",
      accepted: true,
      slot: "meal",
      mode: "single",
      lines: [{ foodId: "cat_banana", grams: 100 }],
      fromKitchen: false,
      photoId: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    })
    render(
      <FoodDetailDialog
        open
        onOpenChange={() => {}}
        anchor={new Date(2026, 9, 27, 12)}
        entries={[entry]}
        onOpenEntry={() => {}}
      />,
    )
    expect(screen.getByAltText("Meal photo")).toBeInTheDocument()
    expect(screen.getByText("Days logged")).toBeInTheDocument()
  })

  it("keeps an inventory name off the offer once it is in the pantry", () => {
    bumpInventory("oats", 2, new Date(2026, 9, 27))
    expect(useKitchenStore.getState().stock[0]?.foodId).toBe("cat_oats")
    expect(useKitchenStore.getState().stock[0]?.amount).toBe(2)
    expect(inventoryOffers().map((row) => row.name)).not.toContain("oats")
  })
})
