/**
 * lib/kitchen-recipe-clip.ts — A schema.org Recipe page, for the Save door
 *
 * The clip fills a recipe. It does not create an intake. Published nutrition
 * is what the page printed. Line nutrients are summed separately.
 */

import { nutrientsFrom, type Nutrients } from "@/lib/kitchen-nutrients"

export interface RecipeClip {
  name: string
  servings: number
  ingredients: string[]
  published?: Nutrients
  sourceUrl?: string
}

function asList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  return value == null ? [] : [value]
}

function typeNames(node: Record<string, unknown>): string[] {
  return asList(node["@type"]).map((item) => String(item).toLowerCase())
}

function numberFrom(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string") return null
  const match = value.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/)
  if (!match) return null
  const n = Number(match[1])
  return Number.isFinite(n) ? n : null
}

function servingsFrom(value: unknown): number {
  const n = numberFrom(value)
  return n != null && n > 0 ? n : 1
}

function publishedFrom(nutrition: unknown): Nutrients | undefined {
  if (!nutrition || typeof nutrition !== "object") return undefined
  const row = nutrition as Record<string, unknown>
  const seen: Partial<Nutrients> = {}
  const kcal = numberFrom(row.calories)
  const protein = numberFrom(row.proteinContent)
  const fat = numberFrom(row.fatContent)
  const carb = numberFrom(row.carbohydrateContent)
  const fiber = numberFrom(row.fiberContent)
  const sodium = numberFrom(row.sodiumContent)
  if (kcal != null) seen.kcal = kcal
  if (protein != null) seen.proteinG = protein
  if (fat != null) seen.fatG = fat
  if (carb != null) seen.carbG = carb
  if (fiber != null) seen.fiberG = fiber
  if (sodium != null) seen.sodiumMg = sodium
  return Object.keys(seen).length ? nutrientsFrom(seen) : undefined
}

function recipeNode(node: unknown): RecipeClip | null {
  if (!node || typeof node !== "object") return null
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = recipeNode(item)
      if (found) return found
    }
    return null
  }
  const body = node as Record<string, unknown>
  if (Array.isArray(body["@graph"])) return recipeNode(body["@graph"])
  if (!typeNames(body).some((name) => name === "recipe" || name.endsWith("/recipe"))) return null
  const name = typeof body.name === "string" ? body.name.trim() : ""
  if (!name) return null
  const ingredients = asList(body.recipeIngredient)
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
  const published = publishedFrom(body.nutrition)
  return {
    name,
    servings: servingsFrom(body.recipeYield),
    ingredients,
    ...(published ? { published } : {}),
  }
}

/** The first Recipe in JSON-LD. Null when the page has none. */
export function recipeFromHtml(html: string): RecipeClip | null {
  const blocks = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const block of blocks) {
    try {
      const found = recipeNode(JSON.parse(block[1]))
      if (found) return found
    } catch {
      /* The next script may still be a recipe. */
    }
  }
  return null
}
