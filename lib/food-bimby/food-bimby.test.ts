import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useKitchenStore } from "@/lib/kitchen-store"
import { nutrientsFrom } from "@/lib/kitchen-nutrients"
import type { FoodHit } from "@/lib/kitchen-search"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { resetFoodApplyForTests, undoLastFood } from "./apply"
import { guessPer100, looksLikeFoodLog, readMealsReply } from "./read"
import { forgetFoodSearches, kcalFits, pickHit } from "./research"
import { tryFood } from "./run"

const NOW = new Date(2026, 10, 22, 18, 14)

const PASTED =
  "everything I've eaten today yesterday and the day before. soup which was 1 can of corn 3 smallish medium yukon gold potatoes, a splish or two of heavy whipping cream, chicken broth (maybe like half a boxy little container), 4 thick strips of bacon, some water. (turned out really good would make again maybe save the recipe and create a recipe card). Ate the whole thing over several sittings as well as a BIG container of POM juice 100% pomegranate juice maybe look up the calorie and nutrition info for that. next day had a whole container of pumpkin goat cheese ravioli from target in sauce with shredded cheddar cheese, olive oil (from garlic confit), and splish heavy cream. Also had 2 apple redbulls and 2 mexican cokes (150 calorie ones). Now the plan with this rice is eat it with some fishwife tinned fish, kewpie, sauce. PLEASE LOG ALL THIS FOOD IN FOOD TRACKING INCLUDING RESEARCHING AND LOGGING ALL NUTRITIONAL INFO!!!!"

const g = (kcal: number, proteinG = 0, carbG = 0, fatG = 0, sugarG = 0) => ({ kcal, proteinG, carbG, fatG, sugarG, fiberG: 0, sodiumMg: 0 })
/** A part as the model gives it: the guess is per 100 g here for reading ease, sent as the total eaten. */
const part = (name: string, search: string, amount: string, grams: number, per100g: ReturnType<typeof g>, statedKcal = 0) => ({
  name,
  search,
  amount,
  grams,
  total: Object.fromEntries(Object.entries(per100g).map(([k, v]) => [k, (v * grams) / 100])),
  statedKcal,
})

/** What the local model says for the pasted line. */
const MODEL_READING = {
  eaten: [
    {
      title: "Corn potato bacon soup",
      dayOffset: -2,
      minute: null,
      kind: "meal",
      homemade: true,
      batchServings: 4,
      servingsEaten: 4,
      note: "turned out really good, would make again",
      parts: [
        part("canned corn", "corn sweet yellow canned", "1 can", 432, g(64, 2, 14, 1, 3)),
        part("yukon gold potatoes", "potatoes raw", "3 smallish medium", 450, g(77, 2, 17, 0.1, 1)),
        part("heavy whipping cream", "heavy whipping cream", "a splish or two", 30, g(340, 3, 3, 36, 3)),
        part("chicken broth", "chicken broth", "half a container", 480, g(6, 1, 0.5, 0.2, 0.3)),
        part("bacon", "bacon raw", "4 thick strips", 112, g(417, 13, 1, 40, 0)),
      ],
    },
    { title: "POM 100% pomegranate juice", dayOffset: -2, minute: null, kind: "drink", homemade: false, batchServings: 1, servingsEaten: 1, note: "", parts: [part("POM pomegranate juice", "POM Wonderful 100% pomegranate juice", "a big bottle", 1420, g(66, 0, 16, 0, 15))] },
    { title: "Mexican Coke", dayOffset: -1, minute: null, kind: "drink", homemade: false, batchServings: 1, servingsEaten: 1, note: "", parts: [part("Mexican Coca-Cola", "Mexican Coca-Cola", "2 bottles", 710, g(150, 0, 39, 0, 39), 300)] },
  ],
  planned: ["rice with Fishwife tinned fish, kewpie and sauce"],
}

/** A pretend USDA: one fitting record per search, plus a wrong one with the same word. */
const DB: Record<string, FoodHit[]> = {
  "corn sweet yellow canned": [
    { id: "usda_1", name: "Corn syrup, light", per100g: nutrientsFrom({ kcal: 283, carbG: 77 }), gramsPerUnit: 100, source: "usda" },
    { id: "usda_2", name: "Corn, sweet, yellow, canned, whole kernel, drained solids", per100g: nutrientsFrom({ kcal: 67, proteinG: 2.3, carbG: 14, fatG: 1, sugarG: 3 }), gramsPerUnit: 100, source: "usda" },
  ],
  "POM Wonderful 100% pomegranate juice": [{ id: "usda_3", name: "POM WONDERFUL, 100% POMEGRANATE JUICE", per100g: nutrientsFrom({ kcal: 67, carbG: 16, sugarG: 14 }), gramsPerUnit: 240, source: "usda" }],
}
const search = async (q: string) => DB[q] ?? []

beforeEach(() => {
  resetAllStores()
  useKitchenStore.setState({ foods: [], recipes: [], plates: [], stock: [] })
  resetFoodApplyForTests()
  forgetFoodSearches()
})

describe("looksLikeFoodLog", () => {
  it("takes the pasted day of food and plain eating lines", () => {
    expect(looksLikeFoodLog(PASTED)).toBe(true)
    expect(looksLikeFoodLog("had ravioli and 2 red bulls")).toBe(true)
    expect(looksLikeFoodLog("log all this food: toast")).toBe(true)
  })

  it("leaves lines that are not food eaten", () => {
    expect(looksLikeFoodLog("had a call with shelby")).toBe(false)
    expect(looksLikeFoodLog("can you track calories?")).toBe(false)
    expect(looksLikeFoodLog("starting dishes")).toBe(false)
    expect(looksLikeFoodLog("spent 12 on coffee")).toBe(false)
  })
})

describe("readMealsReply", () => {
  it("cleans the model's meals and keeps the plan apart", () => {
    const r = readMealsReply(MODEL_READING)
    expect(r.eaten).toHaveLength(3)
    expect(r.eaten[0]).toMatchObject({ homemade: true, batchServings: 4, servingsEaten: 4, dayOffset: -2 })
    expect(r.planned).toEqual(["rice with Fishwife tinned fish, kewpie and sauce"])
  })

  it("drops a part with no grams and a whole-portion calorie guess", () => {
    const r = readMealsReply({ eaten: [{ title: "x", dayOffset: 0, kind: "meal", parts: [part("a", "a", "", 0, g(10)), part("b", "b", "", 50, g(1200))] }], planned: [] })
    expect(r.eaten[0]!.parts).toHaveLength(1)
    expect(r.eaten[0]!.parts[0]!.guess).toBeNull()
  })
})

describe("guessPer100", () => {
  it("turns a total into per 100 g, and stated calories win", () => {
    expect(guessPer100({ kcal: 220, sugarG: 54 }, 500)).toMatchObject({ kcal: 44, sugarG: 10.8 })
    expect(guessPer100({ kcal: 1065, sugarG: 249 }, 710, 300)!.kcal).toBeCloseTo(42.25)
    expect(guessPer100({ kcal: 1065, sugarG: 249 }, 710, 300)!.sugarG).toBeCloseTo(9.9, 1)
  })
})

describe("picking a hit", () => {
  it("refuses a name that shares only a generic word", () => {
    const pom = readMealsReply(MODEL_READING).eaten[1]!.parts[0]!
    expect(pickHit(pom, [{ id: "cat_lemon", name: "Lemon juice", per100g: nutrientsFrom({ kcal: 22 }), gramsPerUnit: 100, source: "catalog" }])).toBeNull()
  })

  it("refuses a record whose calories are far from the guess", () => {
    const corn = readMealsReply(MODEL_READING).eaten[0]!.parts[0]!
    expect(pickHit(corn, DB["corn sweet yellow canned"]!)?.id).toBe("usda_2")
    expect(kcalFits(283, corn.guess)).toBe(false)
  })
})

describe("tryFood", () => {
  it("files the pasted line: a recipe card, plates on the right days, nothing for the plan", async () => {
    const reply = await tryFood(PASTED, NOW, { call: async () => MODEL_READING, search })
    expect(reply?.route).toBe("FOOD · logged · model")
    const entries = useTimeTrackingStore.getState().entries
    expect(entries).toHaveLength(3)
    expect(entries.map((e) => e.date).sort()).toEqual(["2026-11-20", "2026-11-20", "2026-11-21"])
    expect(entries.every((e) => e.intakeClass === "food")).toBe(true)

    const kitchen = useKitchenStore.getState()
    expect(kitchen.recipes).toHaveLength(1)
    expect(kitchen.recipes[0]).toMatchObject({ name: "Corn potato bacon soup", servings: 4 })
    expect(kitchen.plates).toHaveLength(3)
    expect(kitchen.plates.every((p) => p.accepted && p.nutrientSnapshot && p.nutrientSnapshot.kcal > 0)).toBe(true)

    // POM: 1420 g at 67 kcal / 100 g from the USDA record.
    const pom = kitchen.plates.find((p) => p.lines[0]?.foodId === "usda_3")!
    expect(Math.round(pom.nutrientSnapshot!.kcal)).toBe(951)
    expect(reply!.text).toContain("USDA: POM WONDERFUL")
    expect(reply!.text).toContain("recipe card saved")
    expect(reply!.text).toContain("Not logged (not eaten yet): rice")
    // Mexican Coke had no record, so the guess stands, marked, held to the 2 × 150 kcal they said.
    expect(reply!.text).toMatch(/Mexican Coca-Cola .*: 300 kcal · estimate/)
  })

  it("undo takes back the entries, plates and recipe card", async () => {
    await tryFood(PASTED, NOW, { call: async () => MODEL_READING, search })
    expect(undoLastFood(NOW)).toBe("Undone: 3 food entries.")
    expect(useTimeTrackingStore.getState().entries).toHaveLength(0)
    expect(useKitchenStore.getState().plates).toHaveLength(0)
    expect(useKitchenStore.getState().recipes).toHaveLength(0)
  })

  it("with no model, reads the foods in code and still looks them up", async () => {
    const reply = await tryFood("yesterday I ate toast and 2 eggs", NOW, { call: null, search: async () => [] })
    expect(reply?.route).toBe("FOOD · logged · code")
    expect(useTimeTrackingStore.getState().entries[0]?.date).toBe("2026-11-21")
  })

  it("leaves a line that is not food", async () => {
    expect(await tryFood("had a call with shelby", NOW, { call: null })).toBeNull()
  })
})
