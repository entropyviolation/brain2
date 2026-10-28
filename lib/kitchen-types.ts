/**
 * lib/kitchen-types.ts — Foods, recipes, stock, and plates for the kitchen
 *
 * A food log line stays an Intake instant. A plate points at that instant and
 * holds the meal or snack math. Stock is what is in the house.
 */

import type { Nutrients } from "@/lib/kitchen-nutrients"

export const KITCHEN_ROOMS = ["fridge", "pantry", "spice", "freezer"] as const

export type KitchenRoom = (typeof KITCHEN_ROOMS)[number]

export const ROOM_LABEL: Record<KitchenRoom, string> = {
  fridge: "Fridge",
  pantry: "Pantry",
  spice: "Spice cabinet",
  freezer: "Freezer",
}

export type StockUnit = "g" | "ml" | "count"

export type FoodSource = "catalog" | "custom" | "usda" | "off" | "label"

export interface KitchenFood {
  id: string
  name: string
  /** Nutrients in 100 g. */
  per100g: Nutrients
  /** Grams in one count, or in 1 ml, when stock is not weighed. */
  gramsPerUnit: number
  source: FoodSource
  room?: KitchenRoom
  keepDays?: Partial<Record<KitchenRoom, number>>
  barcode?: string
  brand?: string
  /** Hidden from search and pick lists. An old plate still resolves it. */
  retired?: boolean
}

export interface RecipeLine {
  foodId: string
  grams: number
}

export interface KitchenRecipe {
  id: string
  name: string
  servings: number
  lines: RecipeLine[]
}

export interface KitchenStock {
  id: string
  foodId: string
  room: KitchenRoom
  amount: number
  unit: StockUnit
  /** YYYY-MM-DD */
  boughtOn: string
  openedOn?: string
  /** Restarts the keep clock. */
  stillGoodOn?: string
  finished?: boolean
}

export type PlateSlot = "meal" | "snack"

export type PlateMode = "single" | "ingredients" | "recipe"

export interface PlateLine {
  foodId: string
  grams: number
}

export interface StockDraw {
  stockId: string
  amount: number
}

export interface KitchenPlate {
  id: string
  entryId: string
  accepted: boolean
  slot: PlateSlot
  mode: PlateMode
  lines: PlateLine[]
  recipeId?: string
  servings?: number
  fromKitchen: boolean
  drawn: StockDraw[]
  /** Nutrients at the accepted save. Absent on plates saved before this. */
  nutrientSnapshot?: Nutrients
}
