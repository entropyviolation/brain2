import { describe, expect, it } from "vitest"
import {
  closeCatalogFoods,
  gramsFromMeasure,
  ingredientHits,
  lookupQueries,
  measurePhrase,
  parseIngredientList,
} from "@/lib/kitchen-ingredient-list"

const SANDWICH = `2 slices of bacon
brioche hamburger bun
kewpie
glaze
mozzerella
butter`

describe("parseIngredientList", () => {
  it("splits a sandwich into foods and keeps a count that is not grams", () => {
    const rows = parseIngredientList(SANDWICH)
    expect(rows.map((row) => row.query)).toEqual([
      "bacon",
      "brioche hamburger bun",
      "kewpie",
      "glaze",
      "mozzerella",
      "butter",
    ])
    expect(rows[0]).toMatchObject({ quantity: 2, unit: "slice" })
    expect(gramsFromMeasure(rows[0].quantity, rows[0].unit)).toBeNull()
    expect(measurePhrase(rows[0].quantity, rows[0].unit)).toBe("2 slices")
    expect(rows.slice(1).every((row) => row.quantity == null)).toBe(true)
  })

  it("turns a weight or a spoon into grams and leaves a percent name alone", () => {
    const rows = parseIngredientList("100g cheddar\n1/2 cup milk\n1 1/2 tbsp butter\n2% milk\n• two eggs\n")
    expect(rows[0]).toMatchObject({ query: "cheddar", quantity: 100, unit: "g" })
    expect(gramsFromMeasure(100, "g")).toBe(100)
    expect(rows[1]).toMatchObject({ query: "milk", quantity: 0.5, unit: "cup" })
    expect(gramsFromMeasure(0.5, "cup")).toBe(120)
    expect(rows[2]).toMatchObject({ query: "butter", quantity: 1.5, unit: "tbsp" })
    expect(gramsFromMeasure(1.5, "tbsp")).toBe(22.5)
    expect(rows[3]).toMatchObject({ query: "2% milk", quantity: null, unit: null })
    expect(rows[4]).toMatchObject({ query: "eggs", quantity: 2, unit: "count" })
  })

  it("guesses a splash and a clove, and leaves a slice without grams", () => {
    const splash = parseIngredientList("a splash of soy")[0]
    const clove = parseIngredientList("2 cloves garlic")[0]
    const slice = parseIngredientList("2 slices of bacon")[0]
    expect(splash).toMatchObject({ query: "soy", gramsGuess: 5 })
    expect(gramsFromMeasure(splash?.quantity ?? null, splash?.unit ?? null)).toBeNull()
    expect(clove).toMatchObject({ query: "garlic", quantity: 2, unit: "count", gramsGuess: 6 })
    expect(gramsFromMeasure(clove?.quantity ?? null, clove?.unit ?? null)).toBeNull()
    expect(slice?.gramsGuess).toBeNull()
    expect(gramsFromMeasure(slice?.quantity ?? null, slice?.unit ?? null)).toBeNull()
  })

  it("reads a spoon after the food, including tbs in parentheses", () => {
    const spoon = parseIngredientList("butter (1 tbs)")[0]
    expect(spoon).toMatchObject({ query: "butter", quantity: 1, unit: "tbsp" })
    expect(gramsFromMeasure(spoon?.quantity ?? null, spoon?.unit ?? null)).toBe(15)
    expect(parseIngredientList("1 tbs butter")[0]).toMatchObject({ query: "butter", quantity: 1, unit: "tbsp" })
    expect(parseIngredientList("glaze")[0]?.query).toBe("glaze")
  })

  it("finds mozzarella from a doubled z and looks that name up too", () => {
    expect(closeCatalogFoods("mozzerella").map((food) => food.name)).toEqual(["Mozzarella"])
    expect(ingredientHits("mozzerella", [])[0]?.id).toBe("cat_mozzarella")
    expect(lookupQueries("mozzerella")).toEqual(["mozzerella", "Mozzarella"])
    expect(ingredientHits("butter", [])[0]?.name).toBe("Butter")
    expect(lookupQueries("butter")).toEqual(["butter"])
  })

  it("matches kewpie, a brioche bun, bacon, and glaze with calories", () => {
    const kewpie = ingredientHits("kewpie", [])[0]
    const bun = ingredientHits("brioche hamburger bun", [])[0]
    const bacon = ingredientHits("bacon", [])[0]
    const glaze = ingredientHits("glaze", [])[0]
    expect(kewpie?.name).toBe("Kewpie")
    expect(kewpie?.per100g.kcal).toBeGreaterThan(0)
    expect(kewpie?.per100g.fatG).toBeGreaterThan(0)
    expect(bun?.name).toBe("Brioche hamburger bun")
    expect(bun?.per100g.kcal).toBeGreaterThan(0)
    expect(bun?.per100g.carbG).toBeGreaterThan(0)
    expect(bacon?.id).toBe("cat_bacon")
    expect(bacon?.per100g.proteinG).toBeGreaterThan(0)
    expect(glaze?.name).toBe("Glaze")
    expect(glaze?.per100g.kcal).toBeGreaterThan(0)
    expect(closeCatalogFoods("kewpie").map((food) => food.id)).toEqual(["cat_kewpie"])
    expect(closeCatalogFoods("glaze").map((food) => food.id)).toEqual(["cat_glaze"])
  })
})
