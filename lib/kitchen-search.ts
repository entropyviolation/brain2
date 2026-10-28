/**
 * lib/kitchen-search.ts — Food search on this device, then a public food API
 *
 * Local catalog and foods you saved come first. A retired food stays out of
 * this list. USDA FoodData Central is next
 * (`DEMO_KEY`, or `NEXT_PUBLIC_USDA_FDC_API_KEY` when you have a key). If that
 * call fails or comes back empty, Open Food Facts is the second network try.
 * Both are mapped onto the same per-100g record.
 */

import { searchCatalog } from "@/lib/kitchen-catalog"
import { cleanNutrient, hasNutrients, nutrientsFrom, type NutrientKey, type Nutrients } from "@/lib/kitchen-nutrients"
import type { FoodSource, KitchenFood } from "@/lib/kitchen-types"

export interface FoodHit {
  id: string
  name: string
  per100g: Nutrients
  gramsPerUnit: number
  source: FoodSource
}

const USDA_IDS: Record<number, NutrientKey> = {
  1008: "kcal",
  2047: "kcal",
  2048: "kcal",
  208: "kcal",
  1003: "proteinG",
  203: "proteinG",
  1005: "carbG",
  205: "carbG",
  1004: "fatG",
  204: "fatG",
  1079: "fiberG",
  291: "fiberG",
  2000: "sugarG",
  269: "sugarG",
  1093: "sodiumMg",
  307: "sodiumMg",
  1092: "potassiumMg",
  306: "potassiumMg",
  1087: "calciumMg",
  301: "calciumMg",
  1089: "ironMg",
  303: "ironMg",
  1162: "vitCMg",
  401: "vitCMg",
  1114: "vitDMcg",
  324: "vitDMcg",
  328: "vitDMcg",
}

interface UsdaNutrient {
  nutrientId?: number
  nutrientNumber?: string | number
  unitName?: string
  value?: number
}

interface UsdaFood {
  fdcId?: number
  description?: string
  dataType?: string
  servingSize?: number
  servingSizeUnit?: string
  foodNutrients?: UsdaNutrient[]
}

function usdaKey(): string {
  const fromEnv = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_USDA_FDC_API_KEY : ""
  return (fromEnv || "DEMO_KEY").trim() || "DEMO_KEY"
}

function applyUnit(key: NutrientKey, value: number, unitName: string): number {
  const unit = unitName.toUpperCase()
  if (key === "vitDMcg") {
    if (unit === "IU") return value * 0.025
    if (unit === "MG") return value * 1000
    return value
  }
  if (key === "kcal") return value
  if (key.endsWith("G")) {
    if (unit === "MG") return value / 1000
    return value
  }
  if (unit === "UG" || unit === "MCG") return value / 1000
  if (unit === "G") return value * 1000
  return value
}

export function usdaFoodToHit(food: UsdaFood): FoodHit | null {
  const id = food.fdcId
  const name = food.description?.trim()
  if (!id || !name) return null
  const unit = (food.servingSizeUnit || "").toLowerCase()
  const size = Number(food.servingSize)
  const branded = food.dataType === "Branded"
  const scale = branded && size > 0 && (unit === "g" || unit === "ml") ? 100 / size : 1
  const partial: Partial<Nutrients> = {}
  for (const nutrient of food.foodNutrients ?? []) {
    const number = Number(nutrient.nutrientId ?? nutrient.nutrientNumber)
    const key = USDA_IDS[number]
    if (!key || partial[key] != null) continue
    const value = Number(nutrient.value)
    if (!Number.isFinite(value)) continue
    partial[key] = cleanNutrient(applyUnit(key, value, nutrient.unitName || "") * scale)
  }
  const per100g = nutrientsFrom(partial)
  if (!hasNutrients(per100g)) return null
  const gramsPerUnit = branded && size > 0 && (unit === "g" || unit === "ml") ? size : 100
  return { id: `usda_${id}`, name, per100g, gramsPerUnit, source: "usda" }
}

function offMg(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  if (value < 5) return value * 1000
  return value
}

function offVitD(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  if (value < 0.0002) return value * 1_000_000
  if (value < 0.05) return value * 1000
  return value
}

export function offProductToHit(product: {
  code?: string
  product_name?: string
  nutriments?: Record<string, number>
}): FoodHit | null {
  const name = product.product_name?.trim()
  const code = product.code?.trim()
  const n = product.nutriments
  if (!name || !code || !n) return null
  const per100g = nutrientsFrom({
    kcal: n["energy-kcal_100g"],
    proteinG: n.proteins_100g,
    carbG: n.carbohydrates_100g,
    fatG: n.fat_100g,
    fiberG: n.fiber_100g,
    sugarG: n.sugars_100g,
    sodiumMg: offMg(Number(n.sodium_100g)),
    potassiumMg: offMg(Number(n.potassium_100g)),
    calciumMg: offMg(Number(n.calcium_100g)),
    ironMg: offMg(Number(n.iron_100g)),
    vitCMg: offMg(Number(n["vitamin-c_100g"])),
    vitDMcg: offVitD(Number(n["vitamin-d_100g"])),
  })
  if (!hasNutrients(per100g)) return null
  return { id: `off_${code}`, name, per100g, gramsPerUnit: 100, source: "off" }
}

async function searchUsda(query: string): Promise<FoodHit[]> {
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search")
  url.searchParams.set("query", query)
  url.searchParams.set("pageSize", "8")
  url.searchParams.set("api_key", usdaKey())
  url.searchParams.set("dataType", "Foundation,SR Legacy,Branded")
  const response = await fetch(url)
  if (!response.ok) throw new Error(String(response.status))
  const body = (await response.json()) as { foods?: UsdaFood[] }
  const hits: FoodHit[] = []
  for (const food of body.foods ?? []) {
    const hit = usdaFoodToHit(food)
    if (hit) hits.push(hit)
  }
  return hits
}

async function searchOff(query: string): Promise<FoodHit[]> {
  const url = new URL("https://world.openfoodfacts.org/cgi/search.pl")
  url.searchParams.set("search_terms", query)
  url.searchParams.set("search_simple", "1")
  url.searchParams.set("action", "process")
  url.searchParams.set("json", "1")
  url.searchParams.set("page_size", "6")
  url.searchParams.set("fields", "code,product_name,nutriments")
  const response = await fetch(url)
  if (!response.ok) throw new Error(String(response.status))
  const body = (await response.json()) as { products?: { code?: string; product_name?: string; nutriments?: Record<string, number> }[] }
  const hits: FoodHit[] = []
  for (const product of body.products ?? []) {
    const hit = offProductToHit(product)
    if (hit) hits.push(hit)
  }
  return hits
}

export function searchLocalFoods(query: string, custom: readonly KitchenFood[]): FoodHit[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const yours = custom
    .filter((food) => !food.retired && food.name.toLowerCase().includes(q))
    .slice(0, 8)
    .map((food) => ({
      id: food.id,
      name: food.name,
      per100g: food.per100g,
      gramsPerUnit: food.gramsPerUnit,
      source: food.source,
    }))
  const catalog = searchCatalog(q).map((food) => ({
    id: food.id,
    name: food.name,
    per100g: food.per100g,
    gramsPerUnit: food.gramsPerUnit,
    source: "catalog" as const,
  }))
  const seen = new Set(yours.map((hit) => hit.name.toLowerCase()))
  return [...yours, ...catalog.filter((hit) => !seen.has(hit.name.toLowerCase()))].slice(0, 12)
}

/** Network search. Empty when both APIs are quiet. Local rows are separate. */
export async function searchFoodsOnline(query: string): Promise<FoodHit[]> {
  const q = query.trim()
  if (q.length < 2) return []
  if (process.env.VITEST) return []
  try {
    const usda = await searchUsda(q)
    if (usda.length) return usda
  } catch {
    /* Open Food Facts is the other door. */
  }
  try {
    return await searchOff(q)
  } catch {
    return []
  }
}
