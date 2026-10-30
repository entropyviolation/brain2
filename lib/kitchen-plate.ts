/**
 * lib/kitchen-plate.ts — What a plate or a recipe adds up to
 *
 * A single food or a list of ingredients is grams times per 100 g. A recipe
 * is the whole pot divided by its servings, then multiplied by the servings
 * on the plate. Only an accepted plate counts toward the day. An accepted
 * plate keeps the nutrients from that save. Older plates, with no snapshot,
 * still add up from the foods as they are now.
 */

import type { KitchenFood, KitchenPlate, KitchenRecipe, PlateLine } from "@/lib/kitchen-types"
import { nutrientsFrom, scaleNutrients, sumNutrients, type Nutrients, ZERO_NUTRIENTS } from "@/lib/kitchen-nutrients"

function usableGrams(gramsPerUnit: number | null | undefined): gramsPerUnit is number {
  return typeof gramsPerUnit === "number" && Number.isFinite(gramsPerUnit) && gramsPerUnit > 0
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

/** Grams for a number of servings. Null when the food has no gram weight. No cup math. */
export function gramsFromServings(gramsPerUnit: number | null | undefined, servings: number): number | null {
  if (!usableGrams(gramsPerUnit) || !Number.isFinite(servings) || servings < 0) return null
  return round3(gramsPerUnit * servings)
}

/** Servings for a gram weight. Null when the food has no gram weight. */
export function servingsFromGrams(gramsPerUnit: number | null | undefined, grams: number): number | null {
  if (!usableGrams(gramsPerUnit) || !Number.isFinite(grams) || grams < 0) return null
  return round3(grams / gramsPerUnit)
}

export function linesNutrients(lines: readonly PlateLine[], resolve: (id: string) => KitchenFood | null): Nutrients {
  return sumNutrients(
    lines.map((line) => {
      const food = resolve(line.foodId)
      if (!food) return { ...ZERO_NUTRIENTS }
      return scaleNutrients(food.per100g, line.grams)
    }),
  )
}

export function recipeNutrients(recipe: KitchenRecipe, resolve: (id: string) => KitchenFood | null): Nutrients {
  return linesNutrients(recipe.lines, resolve)
}

export function plateGramLines(plate: Pick<KitchenPlate, "mode" | "lines" | "recipeId" | "servings">, recipe: KitchenRecipe | null): PlateLine[] {
  const own = plate.lines.filter((line) => line.foodId && line.grams > 0)
  if (plate.mode === "recipe" && recipe && own.length === 0) {
    const scale = (plate.servings && plate.servings > 0 ? plate.servings : 1) / (recipe.servings > 0 ? recipe.servings : 1)
    return recipe.lines.map((line) => ({ foodId: line.foodId, grams: line.grams * scale, origin: "recipe" as const, recipeId: recipe.id }))
  }
  if (plate.mode === "recipe" && recipe) {
    const scale = (plate.servings && plate.servings > 0 ? plate.servings : 1) / (recipe.servings > 0 ? recipe.servings : 1)
    const scaled = recipe.lines.map((line) => ({ foodId: line.foodId, grams: line.grams * scale, origin: "recipe" as const, recipeId: recipe.id }))
    const extra = own.filter((line) => line.origin !== "recipe")
    return [...scaled, ...extra]
  }
  return own
}

/** Live math from the foods as they are now. Ignores a saved snapshot. */
export function plateNutrients(
  plate: Pick<KitchenPlate, "mode" | "lines" | "recipeId" | "servings">,
  resolve: (id: string) => KitchenFood | null,
  recipe: KitchenRecipe | null,
): Nutrients {
  return linesNutrients(plateGramLines(plate, recipe), resolve)
}

/** The accepted snapshot, or live math when an older plate has none. */
export function nutrientsForPlate(
  plate: Pick<KitchenPlate, "mode" | "lines" | "recipeId" | "servings"> & { nutrientSnapshot?: Nutrients | null },
  resolve: (id: string) => KitchenFood | null,
  recipe: KitchenRecipe | null,
): Nutrients {
  if (plate.nutrientSnapshot) return nutrientsFrom(plate.nutrientSnapshot)
  return plateNutrients(plate, resolve, recipe)
}

/** Copy today's food numbers onto this plate. Saving a food does not do this. */
export function refreshNutrientSnapshot(
  plate: KitchenPlate,
  resolve: (id: string) => KitchenFood | null,
  recipe: KitchenRecipe | null,
): KitchenPlate {
  return { ...plate, nutrientSnapshot: plateNutrients(plate, resolve, recipe) }
}

export interface SlotTotals {
  meals: Nutrients
  snacks: Nutrients
  day: Nutrients
}

export function totalsForPlates(
  plates: readonly KitchenPlate[],
  resolve: (id: string) => KitchenFood | null,
  recipes: readonly KitchenRecipe[],
): SlotTotals {
  const meals: Nutrients[] = []
  const snacks: Nutrients[] = []
  for (const plate of plates) {
    if (!plate.accepted) continue
    const recipe = plate.recipeId ? recipes.find((row) => row.id === plate.recipeId) ?? null : null
    const row = nutrientsForPlate(plate, resolve, recipe)
    ;(plate.slot === "snack" ? snacks : meals).push(row)
  }
  const mealSum = sumNutrients(meals)
  const snackSum = sumNutrients(snacks)
  return { meals: mealSum, snacks: snackSum, day: sumNutrients([mealSum, snackSum]) }
}
