/**
 * lib/kitchen-dish.ts — A dish name, searched after the person confirms it
 *
 * A photo does not name itself. OCR may suggest a line. Search is USDA, then
 * Open Food Facts, then Nutritionix only when both public keys are already set.
 * No hosted vision API. Vitest does not call the network.
 */

import { nutrientsFrom } from "@/lib/kitchen-nutrients"
import { searchFoodsOnline, type FoodHit } from "@/lib/kitchen-search"

type Env = Record<string, string | undefined>

export function nutritionixConfigured(env: Env = process.env): boolean {
  return Boolean(env.NEXT_PUBLIC_NUTRITIONIX_APP_ID?.trim() && env.NEXT_PUBLIC_NUTRITIONIX_APP_KEY?.trim())
}

/** The first readable line of an OCR pass. Empty when the photo had no words. */
export function dishQueryFromOcr(text: string): string {
  const line = text
    .split(/\r?\n/)
    .map((row) => row.replace(/\s+/g, " ").trim())
    .find((row) => row.length >= 2 && row.length <= 80)
  return line ?? ""
}

/** USDA, then Open Food Facts. Nutritionix is last, and only with keys. */
export async function searchDish(query: string, env: Env = process.env): Promise<FoodHit[]> {
  const q = query.trim()
  if (q.length < 2) return []
  if (process.env.VITEST) return []
  const hits = await searchFoodsOnline(q)
  if (hits.length || !nutritionixConfigured(env)) return hits
  try {
    return await searchNutritionix(q, env)
  } catch {
    return []
  }
}

async function searchNutritionix(query: string, env: Env): Promise<FoodHit[]> {
  const id = env.NEXT_PUBLIC_NUTRITIONIX_APP_ID?.trim()
  const key = env.NEXT_PUBLIC_NUTRITIONIX_APP_KEY?.trim()
  if (!id || !key) return []
  const response = await fetch("https://trackapi.nutritionix.com/v2/natural/nutrients", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-app-id": id,
      "x-app-key": key,
    },
    body: JSON.stringify({ query }),
  })
  if (!response.ok) return []
  const body = (await response.json()) as { foods?: { food_name?: string; nf_calories?: number; serving_weight_grams?: number }[] }
  return (body.foods ?? []).slice(0, 6).flatMap((food) => {
    const name = food.food_name?.trim()
    if (!name) return []
    const grams = food.serving_weight_grams && food.serving_weight_grams > 0 ? food.serving_weight_grams : 100
    const kcal = typeof food.nf_calories === "number" ? (food.nf_calories * 100) / grams : 0
    return [{
      id: `nix_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
      name,
      per100g: nutrientsFrom({ kcal }),
      gramsPerUnit: grams,
      source: "custom" as const,
      ...(kcal > 0 ? { present: ["kcal" as const] } : {}),
    }]
  })
}
