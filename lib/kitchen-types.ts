/**
 * lib/kitchen-types.ts — Foods, recipes, stock, plates, orders, and a meal plan
 *
 * A food log line stays an Intake instant. A plate points at that instant and
 * holds the meal or snack math. Stock is what is in the house. An order is a
 * meal you save yourself. A plan slot is not an intake.
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

export type EatWhere = "home" | "out"

export type LineOrigin = "order" | "recipe" | "api" | "label" | "catalog" | "stock"

export type PlanMeal = "breakfast" | "lunch" | "dinner" | "snack"

export interface FoodPortion {
  label: string
  grams: number
}

/** One name from a printed ingredient statement. Nutrients are set only after a match. */
export interface IngredientPart {
  name: string
  amount?: string
  grams?: number
  foodId?: string
  /** Per 100 g of the matched food. Absent when the name has not been matched. */
  per100g?: Nutrients
}

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
  pinned?: boolean
  portions?: FoodPortion[]
  sourceUrl?: string
  /** The ingredient list as printed. */
  ingredientStatement?: string
  /** Parsed names. Unmatched rows have no per100g. */
  ingredients?: IngredientPart[]
}

export interface RecipeLine {
  foodId: string
  grams: number
  origin?: LineOrigin
}

export interface KitchenRecipe {
  id: string
  name: string
  servings: number
  lines: RecipeLine[]
  sourceUrl?: string
  roughText?: string
  /** Per serving, from the lines. Whole recipe is this times servings. */
  analysis?: Nutrients
  /** Nutrition the page published, when a clip had it. Per serving when the page said so. */
  published?: Nutrients
  /** A draft stays out of the cookbook until it is saved. */
  draft?: boolean
}

export interface KitchenOrder {
  id: string
  name: string
  place: string
  where: EatWhere
  lines: PlateLine[]
  pinned?: boolean
  recipeId?: string
  roughText?: string
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

export type PlateMode = "single" | "ingredients" | "recipe" | "combination"

export interface PlateLine {
  foodId: string
  grams: number
  /** Household amount beside the gram weight. Grams stay the stored amount. */
  amount?: number
  unit?: string
  origin?: LineOrigin
  orderId?: string
  recipeId?: string
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
  where?: EatWhere
  photoId?: string
  roughText?: string
  orderId?: string
  /** Lines changed after accept. Update past logs skips this plate. */
  editedAfterAccept?: boolean
}

export interface MealPlanSlot {
  id: string
  /** YYYY-MM-DD */
  date: string
  meal: PlanMeal
  kind: "recipe" | "order"
  refId: string
  servings: number
}

export interface GroceryRow {
  id: string
  name: string
  foodId?: string
  room: KitchenRoom
  amount: number
  unit: StockUnit
  /** Set when the row came from a typed line rather than the plan. */
  typed?: boolean
}

export function whereOf(plate: { where?: EatWhere | null } | null | undefined): EatWhere {
  return plate?.where === "out" ? "out" : "home"
}
