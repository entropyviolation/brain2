/**
 * lib/kitchen-plan.ts — Meal plan math and the grocery remainder
 *
 * A planned slot is not an intake. The grocery list is planned ingredients
 * minus what is still in stock, plus rows the person typed. Checking a row
 * is a separate put-away.
 */

import type { KitchenFood, KitchenOrder, KitchenRecipe, KitchenStock, MealPlanSlot } from "@/lib/kitchen-types"
import { whereOf } from "@/lib/kitchen-types"

export interface GroceryNeed {
  foodId: string
  name: string
  grams: number
  room: KitchenFood["room"]
}

function stockGrams(stock: readonly KitchenStock[], foodId: string, foods: readonly KitchenFood[]): number {
  let grams = 0
  for (const lot of stock) {
    if (lot.foodId !== foodId || lot.finished || lot.amount <= 0) continue
    if (lot.unit === "g") grams += lot.amount
    else {
      const food = foods.find((row) => row.id === foodId)
      const per = food && food.gramsPerUnit > 0 ? food.gramsPerUnit : 1
      grams += lot.amount * per
    }
  }
  return grams
}

/** Planned recipe and order lines, summed, minus stock. Eating-out orders are not a shop row. */
export function groceryFromPlan(
  plan: readonly MealPlanSlot[],
  recipes: readonly KitchenRecipe[],
  orders: readonly KitchenOrder[],
  stock: readonly KitchenStock[],
  foods: readonly KitchenFood[],
): GroceryNeed[] {
  const grams = new Map<string, number>()
  const add = (foodId: string, next: number) => {
    if (!foodId || !(next > 0)) return
    grams.set(foodId, (grams.get(foodId) ?? 0) + next)
  }
  for (const slot of plan) {
    if (slot.kind === "recipe") {
      const recipe = recipes.find((row) => row.id === slot.refId && !row.draft)
      if (!recipe) continue
      const scale = (slot.servings > 0 ? slot.servings : 1) / (recipe.servings > 0 ? recipe.servings : 1)
      for (const line of recipe.lines) add(line.foodId, line.grams * scale)
    } else {
      const order = orders.find((row) => row.id === slot.refId)
      if (!order || whereOf(order) === "out") continue
      const scale = slot.servings > 0 ? slot.servings : 1
      for (const line of order.lines) add(line.foodId, line.grams * scale)
    }
  }
  const needs: GroceryNeed[] = []
  for (const [foodId, need] of grams) {
    const left = need - stockGrams(stock, foodId, foods)
    if (left <= 0) continue
    const food = foods.find((row) => row.id === foodId)
    needs.push({
      foodId,
      name: food?.name || foodId,
      grams: Math.round(left * 10) / 10,
      room: food?.room,
    })
  }
  needs.sort((a, b) => a.name.localeCompare(b.name))
  return needs
}
