import { beforeEach, describe, expect, it } from "vitest"
import { matchCatalog, searchCatalog } from "@/lib/kitchen-catalog"
import { labelDraftPer100g, labelPer100g, parseLabelDraft, parseNutritionLabel } from "@/lib/kitchen-label"
import { gramsFromServings, nutrientsForPlate, plateNutrients, servingsFromGrams, totalsForPlates } from "@/lib/kitchen-plate"
import { foodsForPick, notePantryBuy, resolveKitchenFood, sanitizeKitchen, useKitchenStore } from "@/lib/kitchen-store"
import { assessKeep, daysBetween } from "@/lib/kitchen-safety"
import { nutrientsFrom, scaleNutrients } from "@/lib/kitchen-nutrients"
import { offProductToHit, searchFoodsOnline, searchLocalFoods, usdaFoodToHit } from "@/lib/kitchen-search"
import type { KitchenPlate, KitchenRecipe } from "@/lib/kitchen-types"

function resetKitchen() {
  localStorage.clear()
  useKitchenStore.setState({ foods: [], recipes: [], stock: [], plates: [] })
}

const LABEL = `Nutrition Facts
Serving size 2/3 cup (55g)
Calories 230
Total Fat 8g
Sodium 160mg
Total Carbohydrate 37g
Dietary Fiber 4g
Total Sugars 12g
Protein 3g
Vitamin D 2mcg
Calcium 260mg
Iron 8mg
Potassium 235mg
Vitamin C 10mg`

describe("kitchen nutrients and keep time", () => {
  beforeEach(resetKitchen)

  it("scales a catalog food and sums a meal and a snack", () => {
    const banana = resolveKitchenFood("cat_banana", [])!
    expect(scaleNutrients(banana.per100g, 100).kcal).toBe(89)
    const meal: KitchenPlate = {
      id: "p1",
      entryId: "e1",
      accepted: true,
      slot: "meal",
      mode: "single",
      lines: [{ foodId: "cat_banana", grams: 100 }],
      fromKitchen: false,
      drawn: [],
    }
    const snack: KitchenPlate = {
      id: "p2",
      entryId: "e2",
      accepted: true,
      slot: "snack",
      mode: "ingredients",
      lines: [{ foodId: "cat_apple", grams: 100 }],
      fromKitchen: false,
      drawn: [],
    }
    const bare: KitchenPlate = { ...meal, id: "p3", entryId: "e3", accepted: false }
    const totals = totalsForPlates([meal, snack, bare], (id) => resolveKitchenFood(id, []), [])
    expect(totals.meals.kcal).toBe(89)
    expect(totals.snacks.kcal).toBe(52)
    expect(totals.day.kcal).toBe(141)
    expect(totals.day.proteinG).toBeGreaterThan(0)
    expect(totals.day.vitCMg).toBeGreaterThan(0)
  })

  it("divides a recipe into servings", () => {
    const recipe: KitchenRecipe = {
      id: "r1",
      name: "Oats",
      servings: 2,
      lines: [{ foodId: "cat_oats", grams: 80 }],
    }
    const plate: KitchenPlate = {
      id: "p1",
      entryId: "e1",
      accepted: true,
      slot: "meal",
      mode: "recipe",
      lines: [],
      recipeId: "r1",
      servings: 1,
      fromKitchen: false,
      drawn: [],
    }
    const one = plateNutrients(plate, (id) => resolveKitchenFood(id, []), recipe)
    const two = plateNutrients({ ...plate, servings: 2 }, (id) => resolveKitchenFood(id, []), recipe)
    expect(one.kcal * 2).toBeCloseTo(two.kcal, 5)
    expect(one.kcal).toBeCloseTo(scaleNutrients(resolveKitchenFood("cat_oats", [])!.per100g, 40).kcal, 5)
  })

  it("misses a name that is not in the catalog", () => {
    expect(matchCatalog("zzzz-no-such-food")).toBeNull()
    expect(searchCatalog("zzzz-no-such-food")).toEqual([])
    expect(matchCatalog("oats")?.id).toBe("cat_oats")
    expect(matchCatalog("rice")).toBeNull()
  })

  it("reads a nutrition label into per-100g numbers", () => {
    const read = parseNutritionLabel(LABEL)
    expect(read?.servingG).toBe(55)
    expect(read?.perServing.kcal).toBe(230)
    expect(read?.perServing.proteinG).toBe(3)
    expect(read?.perServing.vitDMcg).toBe(2)
    const per = labelPer100g(read!, 55)!
    expect(per.kcal).toBeCloseTo((230 * 100) / 55, 3)
    expect(parseNutritionLabel("just a shopping list")).toBeNull()
  })

  it("maps a USDA row and an Open Food Facts product", () => {
    const hit = usdaFoodToHit({
      fdcId: 171688,
      description: "Apples, raw",
      dataType: "Foundation",
      foodNutrients: [
        { nutrientId: 1008, nutrientName: "Energy", unitName: "KCAL", value: 52 },
        { nutrientId: 1003, unitName: "G", value: 0.3 },
      ],
    })
    expect(hit?.id).toBe("usda_171688")
    expect(hit?.per100g.kcal).toBe(52)
    const branded = usdaFoodToHit({
      fdcId: 9,
      description: "Crackers",
      dataType: "Branded",
      servingSize: 50,
      servingSizeUnit: "g",
      foodNutrients: [{ nutrientId: 1008, unitName: "KCAL", value: 100 }],
    })
    expect(branded?.per100g.kcal).toBe(200)
    const off = offProductToHit({
      code: "1",
      product_name: "Oat milk",
      nutriments: { "energy-kcal_100g": 40, proteins_100g: 1, sodium_100g: 0.04 },
    })
    expect(off?.per100g.sodiumMg).toBe(40)
    expect(usdaFoodToHit({ fdcId: 1, description: "Empty", foodNutrients: [] })).toBeNull()
  })

  it("does not call the network under vitest", async () => {
    await expect(searchFoodsOnline("banana")).resolves.toEqual([])
  })

  it("guesses keep time from the bought date, and a still-good mark restarts it", () => {
    expect(daysBetween("2026-10-01", "2026-10-11")).toBe(10)
    const food = resolveKitchenFood("cat_chicken", [])!
    const past = assessKeep(
      { room: "fridge", boughtOn: "2026-10-01", amount: 1, finished: false },
      food,
      "2026-10-11",
    )
    expect(past.guess).toBe("past")
    expect(past.daysHeld).toBe(10)
    const fresh = assessKeep(
      { room: "fridge", boughtOn: "2026-10-01", stillGoodOn: "2026-10-11", amount: 1 },
      food,
      "2026-10-11",
    )
    expect(fresh.guess).toBe("fine")
    expect(fresh.daysHeld).toBe(0)
    const soon = assessKeep(
      { room: "fridge", boughtOn: "2026-10-10", amount: 1 },
      food,
      "2026-10-11",
    )
    expect(soon.guess).toBe("soon")
  })

  it("draws the oldest lot once, and a second save does not draw again", () => {
    const lot = useKitchenStore.getState().putAway({
      name: "Banana",
      foodId: "cat_banana",
      room: "fridge",
      amount: 500,
      unit: "g",
      boughtOn: "2026-10-01",
    })
    useKitchenStore.getState().putAway({
      name: "Banana",
      foodId: "cat_banana",
      room: "pantry",
      amount: 200,
      unit: "g",
      boughtOn: "2026-10-20",
    })
    const draft = {
      entryId: "e1",
      accepted: true,
      slot: "meal" as const,
      mode: "single" as const,
      lines: [{ foodId: "cat_banana", grams: 100 }],
      fromKitchen: true,
    }
    useKitchenStore.getState().savePlate(draft)
    expect(useKitchenStore.getState().stock.find((row) => row.id === lot!.id)?.amount).toBe(400)
    useKitchenStore.getState().savePlate({ ...draft, lines: [{ foodId: "cat_banana", grams: 100 }] })
    expect(useKitchenStore.getState().stock.find((row) => row.id === lot!.id)?.amount).toBe(400)
    useKitchenStore.getState().savePlate({ ...draft, fromKitchen: false })
    expect(useKitchenStore.getState().stock.find((row) => row.id === lot!.id)?.amount).toBe(500)
  })

  it("keeps accepted nutrients when a food changes, and refreshes only on purpose", () => {
    const food = useKitchenStore.getState().saveFood({
      name: "Oat",
      per100g: nutrientsFrom({ kcal: 100, proteinG: 10 }),
      gramsPerUnit: 40,
      source: "custom",
    })
    const draft = {
      entryId: "e1",
      accepted: true,
      slot: "meal" as const,
      mode: "single" as const,
      lines: [{ foodId: food.id, grams: 100 }],
      fromKitchen: false,
    }
    useKitchenStore.getState().savePlate({ ...draft, accepted: false })
    expect(useKitchenStore.getState().plates[0]?.nutrientSnapshot).toBeUndefined()
    useKitchenStore.getState().savePlate(draft)
    const saved = useKitchenStore.getState().plates[0]!
    expect(saved.nutrientSnapshot?.kcal).toBe(100)
    expect(saved.nutrientSnapshot?.proteinG).toBe(10)
    useKitchenStore.getState().saveFood({
      id: food.id,
      name: food.name,
      per100g: nutrientsFrom({ kcal: 500, proteinG: 1 }),
      gramsPerUnit: food.gramsPerUnit,
      source: food.source,
    })
    const foods = useKitchenStore.getState().foods
    const resolve = (id: string) => resolveKitchenFood(id, foods)
    const totals = totalsForPlates(useKitchenStore.getState().plates, resolve, [])
    expect(totals.meals.kcal).toBe(100)
    expect(totals.day.proteinG).toBe(10)
    expect(plateNutrients(saved, resolve, null).kcal).toBe(500)
    expect(nutrientsForPlate(useKitchenStore.getState().plates[0]!, resolve, null).kcal).toBe(100)
    const legacy = { ...saved, id: "old", entryId: "e-old", nutrientSnapshot: undefined }
    expect(totalsForPlates([legacy], resolve, []).day.kcal).toBe(500)
    const refreshed = useKitchenStore.getState().refreshPlateSnapshot("e1")
    expect(refreshed?.nutrientSnapshot?.kcal).toBe(500)
    expect(refreshed?.nutrientSnapshot?.proteinG).toBe(1)
    expect(useKitchenStore.getState().stock).toHaveLength(0)
    expect(useKitchenStore.getState().refreshPlateSnapshot("missing")).toBeNull()
  })

  it("converts servings and grams only when the food has a gram weight", () => {
    expect(gramsFromServings(50, 2)).toBe(100)
    expect(servingsFromGrams(50, 100)).toBe(2)
    expect(gramsFromServings(50, 0)).toBe(0)
    expect(servingsFromGrams(50, 0)).toBe(0)
    expect(gramsFromServings(118, 1)).toBe(118)
    expect(gramsFromServings(0, 1)).toBeNull()
    expect(gramsFromServings(-4, 1)).toBeNull()
    expect(gramsFromServings(Number.NaN, 1)).toBeNull()
    expect(gramsFromServings(undefined, 1)).toBeNull()
    expect(servingsFromGrams(Infinity, 10)).toBeNull()
    expect(servingsFromGrams(40, Number.NaN)).toBeNull()
  })

  it("keeps barcode, brand, and retired on an old save, and hides retired from search", () => {
    const food = useKitchenStore.getState().saveFood({
      name: "Secret oats",
      per100g: nutrientsFrom({ kcal: 1 }),
      gramsPerUnit: 40,
      source: "custom",
      barcode: "0 012345 678905",
      brand: "  Mill  ",
      retired: true,
    })
    expect(food.barcode).toBe("0012345678905")
    expect(food.brand).toBe("Mill")
    expect(food.retired).toBe(true)
    expect(resolveKitchenFood(food.id, useKitchenStore.getState().foods)?.brand).toBe("Mill")
    expect(foodsForPick(useKitchenStore.getState().foods)).toEqual([])
    const hits = searchLocalFoods("oats", useKitchenStore.getState().foods)
    expect(hits.some((hit) => hit.id === food.id)).toBe(false)
    expect(hits.some((hit) => hit.id === "cat_oats")).toBe(true)
    const lot = useKitchenStore.getState().putAway({
      name: "Secret oats",
      room: "pantry",
      amount: 1,
      unit: "count",
      boughtOn: "2026-10-01",
    })
    expect(lot?.foodId).not.toBe(food.id)
    expect(resolveKitchenFood(food.id, useKitchenStore.getState().foods)?.retired).toBe(true)
    const opened = useKitchenStore.getState().saveFood({ ...food, retired: false })
    expect(opened.retired).toBeUndefined()
    expect(opened.barcode).toBe("0012345678905")

    const kept = sanitizeKitchen({
      foods: [{ id: "f1", name: "Secret oats", per100g: { kcal: 1 }, gramsPerUnit: 40, source: "label", barcode: "0012345678905", brand: "Mill", retired: true }],
      plates: [{
        id: "p1",
        entryId: "e9",
        accepted: true,
        slot: "snack",
        mode: "single",
        lines: [{ foodId: "f1", grams: 40 }],
        fromKitchen: false,
        drawn: [],
        nutrientSnapshot: { kcal: 0.4, proteinG: 0 },
      }],
    })
    expect(kept.foods[0]?.barcode).toBe("0012345678905")
    expect(kept.foods[0]?.brand).toBe("Mill")
    expect(kept.foods[0]?.retired).toBe(true)
    expect(kept.plates[0]?.nutrientSnapshot?.kcal).toBe(0.4)
    expect(kept.plates[0]?.nutrientSnapshot?.carbG).toBe(0)

    const old = sanitizeKitchen({
      foods: [{ id: "f-old", name: "Bread", per100g: { kcal: 250 }, gramsPerUnit: 30, source: "custom" }],
      plates: [{ entryId: "e-old", accepted: true, slot: "meal", mode: "single", lines: [{ foodId: "f-old", grams: 30 }], fromKitchen: false }],
    })
    expect(old.foods[0]?.barcode).toBeUndefined()
    expect(old.foods[0]?.brand).toBeUndefined()
    expect(old.foods[0]?.retired).toBeUndefined()
    expect(old.foods[0]?.gramsPerUnit).toBe(30)
    expect(old.plates[0]?.nutrientSnapshot).toBeUndefined()
  })

  it("reads a pasted label without filling blanks or adding the per-container column", () => {
    const draft = parseLabelDraft(LABEL)
    expect(draft?.name).toBeNull()
    expect(draft?.basis).toBe("serving")
    expect(draft?.servingGrams).toBe(55)
    expect(draft?.servingLabel).toBe("2/3 cup (55g)")
    expect(draft?.nutrients.kcal).toBe(230)
    expect(draft?.nutrients.proteinG).toBe(3)
    expect(draft?.nutrients.fatG).toBe(8)
    expect(draft?.nutrients.fiberG).toBe(4)
    expect(draft?.nutrients.vitDMcg).toBe(2)
    expect(labelDraftPer100g(draft!)!.kcal).toBeCloseTo((230 * 100) / 55, 3)

    const partial = `Nutrition Facts
Serving size 1 cup (240g)
Calories 0
Total Fat 0g
Protein 0g`
    const old = parseNutritionLabel(partial)
    expect(old?.perServing.kcal).toBe(0)
    expect(old?.perServing.proteinG).toBe(0)
    expect(old?.perServing.fatG).toBe(0)
    expect(old?.perServing.sodiumMg).toBe(0)
    const zeros = parseLabelDraft(partial)!
    expect(zeros.nutrients.kcal).toBe(0)
    expect(zeros.nutrients.fatG).toBe(0)
    expect(zeros.nutrients.proteinG).toBe(0)
    expect(zeros.nutrients.sodiumMg).toBeUndefined()
    expect(zeros.nutrients.carbG).toBeUndefined()
    expect(zeros.servingGrams).toBe(240)

    const percent = `Nutrition Facts
Serving size 2/3 cup (55g)
Calories 230
Total Fat 8g 10%
Sodium 160mg 7%
Protein 3g`
    const checked = parseLabelDraft(percent)!
    expect(checked.nutrients.fatG).toBe(8)
    expect(checked.nutrients.sodiumMg).toBe(160)
    expect(checked.nutrients.kcal).toBe(230)

    const dual = `Nutrition Facts
2 servings per container
Serving size 1 cup (228g)
Per serving Per container
Calories 250 500
Total Fat 12g 24g
Sodium 470mg 940mg
Total Carbohydrate 31g 62g
Protein 5g 10g`
    expect(parseNutritionLabel(dual)?.perServing.kcal).toBe(250)
    expect(parseNutritionLabel(dual)?.perServing.fatG).toBe(12)
    const columns = parseLabelDraft(dual)!
    expect(columns.basis).toBe("serving")
    expect(columns.servingGrams).toBe(228)
    expect(columns.nutrients.kcal).toBe(250)
    expect(columns.nutrients.fatG).toBe(12)
    expect(columns.nutrients.sodiumMg).toBe(470)
    expect(columns.nutrients.carbG).toBe(31)
    expect(columns.nutrients.proteinG).toBe(5)

    const flipped = `Nutrition Facts
Serving size 1 cup (228g)
Per container Per serving
Calories 500 250
Total Fat 24g 12g
Protein 10g 5g`
    const flippedDraft = parseLabelDraft(flipped)!
    expect(flippedDraft.nutrients.kcal).toBe(250)
    expect(flippedDraft.nutrients.fatG).toBe(12)
    expect(flippedDraft.nutrients.proteinG).toBe(5)

    const sections = `Nutrition Facts
Serving size 2/3 cup (55g)
Amount per serving
Calories 230
Total Fat 8g
Protein 3g
Amount per container
Calories 460
Total Fat 16g
Protein 6g`
    const firstColumn = parseLabelDraft(sections)!
    expect(firstColumn.basis).toBe("serving")
    expect(firstColumn.nutrients.kcal).toBe(230)
    expect(firstColumn.nutrients.fatG).toBe(8)
    expect(firstColumn.nutrients.proteinG).toBe(3)

    const per100 = `Nutrition Facts
Serving size 50g
Per 100g
Calories 364
Total Fat 1.9g
Protein 11g`
    const hundred = parseLabelDraft(per100)!
    expect(hundred.basis).toBe("100g")
    expect(hundred.servingGrams).toBe(50)
    expect(hundred.nutrients.kcal).toBe(364)
    expect(hundred.nutrients.fatG).toBe(1.9)
    expect(hundred.nutrients.proteinG).toBe(11)
    expect(hundred.nutrients.carbG).toBeUndefined()
    expect(labelDraftPer100g(hundred)!.kcal).toBe(364)
    expect(labelDraftPer100g(hundred)!.proteinG).toBe(11)

    const box = `Nutrition Facts
Serving size 1 container (255g)
Amount per container
Calories 440
Total Fat 10g
Protein 9g`
    const container = parseLabelDraft(box)!
    expect(container.basis).toBe("container")
    expect(container.servingGrams).toBe(255)
    expect(container.nutrients.kcal).toBe(440)
    expect(container.nutrients.fatG).toBe(10)
    expect(labelDraftPer100g(container)!.kcal).toBeCloseTo((440 * 100) / 255, 3)

    const named = `Whole Milk
Nutrition Facts
Serving size 1 cup (240g)
Calories 150
Protein 8g`
    const milk = parseLabelDraft(named)!
    expect(milk.name).toBe("Whole Milk")
    expect(milk.basis).toBe("serving")
    expect(milk.servingGrams).toBe(240)
    expect(milk.nutrients.kcal).toBe(150)
    expect(milk.nutrients.proteinG).toBe(8)
    expect(milk.nutrients.fatG).toBeUndefined()

    expect(parseLabelDraft("just a shopping list")).toBeNull()
    expect(parseLabelDraft("")).toBeNull()
  })

  it("puts a grocery bump in the pantry on the catalog food", () => {
    const lot = notePantryBuy("oats", 2, new Date(2026, 9, 27))
    expect(lot?.foodId).toBe("cat_oats")
    expect(lot?.room).toBe("pantry")
    expect(lot?.amount).toBe(2)
    notePantryBuy("oats", 1, new Date(2026, 9, 27))
    expect(useKitchenStore.getState().stock).toHaveLength(1)
    expect(useKitchenStore.getState().stock[0]?.amount).toBe(3)
  })
})
