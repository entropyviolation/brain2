/**
 * components/Home/Tracking/tracking-log/food/food-ingredient-list.test.tsx
 */
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { FoodRecipesPanel } from "@/components/Home/Tracking/tracking-log/food/food-recipes-panel"
import { useKitchenStore } from "@/lib/kitchen-store"
import { resetAllStores } from "@/tests/test-utils"

const SANDWICH = `2 slices of bacon
brioche hamburger bun
kewpie
glaze
mozzerella
butter`

async function readTheList() {
  fireEvent.click(screen.getByRole("button", { name: "Read the list" }))
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe("Food ingredient list", () => {
  beforeEach(() => {
    resetAllStores()
    useKitchenStore.setState({ foods: [], recipes: [], stock: [], plates: [] })
  })

  it("reads a breakfast sandwich, matches a misspelling, and waits for grams", async () => {
    render(<FoodRecipesPanel />)
    fireEvent.change(screen.getByLabelText("Recipe name"), { target: { value: "breakfast sandwich" } })
    fireEvent.change(screen.getByLabelText("Ingredients"), { target: { value: SANDWICH } })
    await readTheList()

    expect(screen.getByText("2 slices")).toBeTruthy()
    expect((screen.getByLabelText("Match for mozzerella") as HTMLSelectElement).value).toBe("cat_mozzarella")
    expect((screen.getByLabelText("Match for butter") as HTMLSelectElement).value).toBe("cat_butter")
    expect((screen.getByLabelText("Match for kewpie") as HTMLSelectElement).value).toBe("cat_kewpie")
    expect((screen.getByLabelText("Match for brioche hamburger bun") as HTMLSelectElement).value).toBe("cat_brioche-bun")
    expect((screen.getByLabelText("Match for glaze") as HTMLSelectElement).value).toBe("cat_glaze")
    expect((screen.getByLabelText("Match for 2 slices of bacon") as HTMLSelectElement).value).toBe("cat_bacon")
    expect((screen.getByLabelText("Grams of butter") as HTMLInputElement).value).toBe("")
    expect((screen.getByLabelText("Grams of 2 slices of bacon") as HTMLInputElement).value).toBe("")
    expect(screen.getByRole("button", { name: "Use 16 g" })).toBeTruthy()
    expect(screen.queryByText("Nothing matched.")).toBeNull()
    expect(screen.getByRole("button", { name: "Add to the recipe" })).toBeDisabled()
  })

  it("fills grams when butter is written as one tablespoon", async () => {
    render(<FoodRecipesPanel />)
    fireEvent.change(screen.getByLabelText("Ingredients"), { target: { value: "butter (1 tbs)" } })
    await readTheList()
    expect((screen.getByLabelText("Match for butter (1 tbs)") as HTMLSelectElement).value).toBe("cat_butter")
    expect((screen.getByLabelText("Grams of butter (1 tbs)") as HTMLInputElement).value).toBe("15")
    expect(screen.getByText("1 tbsp, about 15 g")).toBeTruthy()
  })

  it("adds looked-up foods once each line has grams", async () => {
    render(<FoodRecipesPanel />)
    fireEvent.change(screen.getByLabelText("Recipe name"), { target: { value: "breakfast sandwich" } })
    fireEvent.change(screen.getByLabelText("Servings"), { target: { value: "1" } })
    fireEvent.change(screen.getByLabelText("Ingredients"), { target: { value: "butter\nmozzerella" } })
    await readTheList()
    fireEvent.click(screen.getByRole("button", { name: "Use 14 g" }))
    fireEvent.click(screen.getByRole("button", { name: "Use 28 g" }))
    fireEvent.click(screen.getByRole("button", { name: "Add to the recipe" }))

    expect(screen.getByLabelText("Grams of Butter").value).toBe("14")
    expect(screen.getByLabelText("Grams of Mozzarella").value).toBe("28")
    fireEvent.click(screen.getByRole("button", { name: "Save recipe" }))
    expect(within(document.querySelector(".trk-food-recipe-list") as HTMLElement).getByText("breakfast sandwich")).toBeTruthy()
    const saved = useKitchenStore.getState().recipes.find((recipe) => recipe.name === "breakfast sandwich")
    expect(saved?.servings).toBe(1)
    expect(saved?.lines).toEqual([
      { foodId: "cat_butter", grams: 14 },
      { foodId: "cat_mozzarella", grams: 28 },
    ])
    expect(saved?.analysis?.kcal).toBeGreaterThan(0)
  })

  it("adds up the lines on the form, and does not keep an empty recipe at zero", async () => {
    useKitchenStore.setState({
      recipes: [{ id: "rcp_empty", name: "Breakfast Sandwich", servings: 2, lines: [] }],
    })
    render(<FoodRecipesPanel />)
    expect(screen.getByText("No ingredients")).toBeTruthy()
    expect(screen.queryByText("0 kcal")).toBeNull()
    expect(screen.getByRole("button", { name: "Save recipe" })).toBeDisabled()

    fireEvent.change(screen.getByLabelText("Servings"), { target: { value: "1" } })
    fireEvent.change(screen.getByLabelText("Ingredients"), { target: { value: "butter (1 tbs)" } })
    await readTheList()
    fireEvent.click(screen.getByRole("button", { name: "Add to the recipe" }))

    expect(screen.getAllByText("108 kcal").length).toBeGreaterThan(0)
    expect(useKitchenStore.getState().recipes).toHaveLength(1)
    expect(useKitchenStore.getState().recipes[0]?.lines).toEqual([])

    fireEvent.change(screen.getByLabelText("Recipe name"), { target: { value: "Breakfast Sandwich" } })
    fireEvent.click(screen.getByRole("button", { name: "Save recipe" }))

    const recipes = useKitchenStore.getState().recipes
    expect(recipes).toHaveLength(1)
    expect(recipes[0]?.id).toBe("rcp_empty")
    expect(recipes[0]?.lines).toEqual([{ foodId: "cat_butter", grams: 15 }])
    expect(recipes[0]?.analysis?.kcal).toBeGreaterThan(0)
    expect(screen.queryByText("No ingredients")).toBeNull()
    expect(screen.getAllByText("108 kcal").length).toBeGreaterThan(0)
  })
})
