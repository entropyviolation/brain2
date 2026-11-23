/**
 * lib/food-bimby/apply.ts — Meals onto the Food book
 *
 * Each meal is one Intake instant (class food, so the Food book counts it) on its day, with an accepted
 * kitchen plate carrying the grams and the nutrient snapshot. A drink with calories is filed the same way so
 * the day's numbers are whole. A homemade dish is saved as a recipe card first (the whole batch), and its
 * plate is the servings eaten. Foods found by a lookup are saved, so the next "red bull" is found on this
 * device. The last run can be undone for 30 minutes (`undoLastFood`); saved foods stay.
 */

import { submitTrackingLog } from "@/components/Home/Tracking/tracking-log-model"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useKitchenStore } from "@/lib/kitchen-store"
import { ZERO_NUTRIENTS, nutrientsFrom, type Nutrients } from "@/lib/kitchen-nutrients"
import type { FoodHit } from "@/lib/kitchen-search"
import type { LineOrigin, PlateLine } from "@/lib/kitchen-types"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { EatenMeal } from "./read"
import type { FoundBy, Researched } from "./research"

export interface FiledMeal {
  meal: EatenMeal
  date: string
  entryId: string
  recipeId?: string
  nutrients: Nutrients
  parts: Researched[]
  /** Parts no tool and no guess could price. They are named in the reply, not filed. */
  missing: string[]
}

const UNDO_TTL_MS = 30 * 60 * 1000
let last: { at: number; entryIds: string[]; recipeIds: string[]; label: string } | null = null

export function resetFoodApplyForTests(): void {
  last = null
}

function ensureFood(hit: FoodHit): string {
  if (hit.id.startsWith("cat_")) return hit.id
  const kitchen = useKitchenStore.getState()
  if (kitchen.foods.some((food) => food.id === hit.id)) return hit.id
  return kitchen.saveFood({
    id: hit.id,
    name: hit.name,
    per100g: hit.per100g,
    gramsPerUnit: hit.gramsPerUnit || 100,
    source: hit.source === "catalog" ? "custom" : hit.source,
  }).id
}

function originOf(by: FoundBy): LineOrigin | undefined {
  if (by === "usda" || by === "off") return "api"
  if (by === "catalog" || by === "saved") return "catalog"
  return undefined
}

function dayKey(now: Date, offset: number): string {
  const d = new Date(now)
  d.setDate(d.getDate() + offset)
  return formatLocalDateKey(d)
}

/** One meal: the instant, the recipe card when homemade, the accepted plate. Null when nothing was found for it. */
function fileMeal(meal: EatenMeal, found: (Researched | null)[], now: Date): FiledMeal | null {
  const parts = found.filter((r): r is Researched => !!r)
  const missing = meal.parts.filter((_, i) => !found[i]).map((p) => p.name)
  if (!parts.length) return null
  const lines: PlateLine[] = parts.map((r) => {
    const origin = originOf(r.by)
    return { foodId: ensureFood(r.hit), grams: r.part.grams, ...(origin ? { origin } : {}) }
  })
  const kitchen = useKitchenStore.getState()
  const date = dayKey(now, meal.dayOffset)
  const today = meal.dayOffset === 0
  const clock = meal.minute !== null ? "estimated" : today ? "estimated" : "unknown"
  const minute = meal.minute ?? (today ? now.getHours() * 60 + now.getMinutes() : 0)
  const entryId = submitTrackingLog({ date, title: meal.title, mode: "intake", intakeClass: "food", clock, minute, logSource: "bim" })
  if (!entryId) return null

  let recipeId: string | undefined
  if (meal.homemade) {
    const words = parts.map((r) => `${r.part.amount || `${r.part.grams} g`} ${r.part.name}`.trim())
    const rough = [meal.note, `From BIM chat: ${words.join(", ")}.`].filter(Boolean).join("\n")
    recipeId = kitchen.saveRecipe({ name: meal.title, servings: meal.batchServings, lines: lines.map((l) => ({ ...l })), roughText: rough })?.id
  }
  const plate = kitchen.savePlate({
    entryId,
    accepted: true,
    slot: meal.kind === "meal" ? "meal" : "snack",
    mode: recipeId ? "recipe" : lines.length === 1 ? "single" : "ingredients",
    lines: recipeId ? [] : lines,
    ...(recipeId ? { recipeId, servings: meal.servingsEaten } : {}),
    fromKitchen: false,
    where: "home",
    ...(meal.note ? { roughText: meal.note } : {}),
  })
  if (!plate) {
    useTimeTrackingStore.getState().removeEntry(entryId)
    if (recipeId) kitchen.removeRecipe(recipeId)
    return null
  }
  return { meal, date, entryId, ...(recipeId ? { recipeId } : {}), nutrients: nutrientsFrom(plate.nutrientSnapshot ?? ZERO_NUTRIENTS), parts, missing }
}

/** Every meal, in order. Remembers the run for `undoLastFood`. */
export function fileMeals(meals: { meal: EatenMeal; found: (Researched | null)[] }[], now: Date): FiledMeal[] {
  const filed = meals.map(({ meal, found }) => fileMeal(meal, found, now)).filter((m): m is FiledMeal => !!m)
  if (filed.length) {
    last = {
      at: now.getTime(),
      entryIds: filed.map((m) => m.entryId),
      recipeIds: filed.map((m) => m.recipeId).filter((id): id is string => !!id),
      label: filed.length === 1 ? filed[0]!.meal.title : `${filed.length} food entries`,
    }
  }
  return filed
}

/** Takes back the last run's entries, plates and recipe cards. Null when there is nothing fresh to undo. */
export function undoLastFood(now = new Date()): string | null {
  if (!last || now.getTime() - last.at > UNDO_TTL_MS) return null
  const run = last
  last = null
  const kitchen = useKitchenStore.getState()
  for (const id of run.entryIds) {
    kitchen.removePlate(id)
    useTimeTrackingStore.getState().removeEntry(id)
  }
  for (const id of run.recipeIds) kitchen.removeRecipe(id)
  return `Undone: ${run.label}.`
}
