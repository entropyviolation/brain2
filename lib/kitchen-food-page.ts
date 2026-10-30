/**
 * lib/kitchen-food-page.ts — A nutrition-facts link into a saved food
 *
 * A MyFoodData `/nutrition-facts/{id}/` link is a USDA FDC id. The detail
 * endpoint is the same key as food search. The page itself is the other
 * reading when that call is missing or thin. Nothing is logged, and nothing
 * is taken from the kitchen. Vitest does not call the network.
 */

import { nutrientsFrom, type NutrientKey, type Nutrients } from "@/lib/kitchen-nutrients"
import { usdaApiKey, usdaFoodToHit } from "@/lib/kitchen-search"
import { searchLocalFoods } from "@/lib/kitchen-search"
import type { IngredientPart, KitchenFood } from "@/lib/kitchen-types"

export interface SavedFoodDraft {
  name: string
  /** Keys the source printed, already per 100 g. */
  seen: Partial<Nutrients>
  gramsPerUnit: number
  sourceUrl?: string
  ingredientStatement?: string
  ingredients: IngredientPart[]
}

export type NutritionRead = { ok: true; draft: SavedFoodDraft } | { ok: false; reason: string }

const HTML_KEYS: { key: NutrientKey; test: RegExp }[] = [
  { key: "kcal", test: /^calories$|^energy$/i },
  { key: "proteinG", test: /^protein$/i },
  { key: "carbG", test: /^carbohydrates?$/i },
  { key: "fatG", test: /^(?:total\s+)?fat$/i },
  { key: "fiberG", test: /^fib(?:re|er)$/i },
  { key: "sugarG", test: /^(?:total\s+)?sugars?$/i },
  { key: "sodiumMg", test: /^sodium$/i },
  { key: "satFatG", test: /^saturated(?:\s+fat)?$/i },
  { key: "monoFatG", test: /^monounsaturated(?:\s+fat)?$/i },
  { key: "polyFatG", test: /^polyunsaturated(?:\s+fat)?$/i },
  { key: "omega3G", test: /^omega-3$/i },
  { key: "omega6G", test: /^omega-6$/i },
  { key: "transFatG", test: /^trans(?:\s+fat)?$/i },
  { key: "cholesterolMg", test: /^cholesterol$/i },
  { key: "starchG", test: /^starch$/i },
  { key: "addedSugarG", test: /^added sugars?$/i },
  { key: "sugarAlcoholG", test: /^sugar alcohols?$/i },
  { key: "glutamicG", test: /^glutamic acid$/i },
  { key: "leucineG", test: /^leucine$/i },
]

/** The number in `/nutrition-facts/{id}/`, when it is a USDA FDC id. */
export function fdcIdFromNutritionUrl(raw: string): string | null {
  const text = raw.trim()
  if (!text) return null
  const facts = text.match(/nutrition-facts\/(\d+)(?:\/|$|\?|#)/i)
  if (facts) return facts[1]
  const detail = text.match(/food-details\/(\d+)/i) || text.match(/\/food\/(\d+)(?:\/|$|\?)/i)
  return detail ? detail[1] : null
}

export function namesFromIngredientStatement(statement: string): string[] {
  const text = statement.replace(/\s+/g, " ").trim().replace(/\.$/, "")
  if (!text) return []
  const parts: string[] = []
  let depth = 0
  let cur = ""
  for (const ch of text) {
    if (ch === "(") depth += 1
    else if (ch === ")") depth = Math.max(0, depth - 1)
    if (ch === "," && depth === 0) {
      parts.push(cur)
      cur = ""
    } else cur += ch
  }
  if (cur.trim()) parts.push(cur)
  const names: string[] = []
  for (const part of parts) {
    const name = part
      .replace(/\([^)]*\)/g, " ")
      .replace(/\d+(?:\.\d+)?\s*%/g, " ")
      .replace(/\s+/g, " ")
      .trim()
    if (name.length > 1) names.push(name)
  }
  return names
}

/** Match names already on this device. A miss stays a name with no nutrients. */
export function matchIngredientNames(names: readonly string[], foods: readonly KitchenFood[]): IngredientPart[] {
  return names.map((name) => {
    const hit = searchLocalFoods(name, foods)[0]
    if (!hit) return { name }
    return { name, foodId: hit.id, per100g: hit.per100g }
  })
}

export function draftFromUsdaFood(food: unknown, sourceUrl?: string): SavedFoodDraft | null {
  if (!food || typeof food !== "object") return null
  const body = food as {
    description?: string
    ingredients?: string
    inputFoods?: { foodDescription?: string; ingredientDescription?: string }[]
  }
  const hit = usdaFoodToHit(food as Parameters<typeof usdaFoodToHit>[0])
  const statement = typeof body.ingredients === "string" ? body.ingredients.trim() : ""
  const listed = [
    ...namesFromIngredientStatement(statement),
    ...(body.inputFoods ?? []).map((row) => (row.foodDescription || row.ingredientDescription || "").trim()).filter(Boolean),
  ]
  const names = [...new Set(listed)]
  if (!hit && !statement && names.length === 0) return null
  const seen: Partial<Nutrients> = {}
  for (const key of hit?.present ?? []) seen[key] = hit!.per100g[key]
  const name = hit?.name || body.description?.trim() || ""
  if (!name) return null
  return {
    name,
    seen,
    gramsPerUnit: hit?.gramsPerUnit || 100,
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(statement ? { ingredientStatement: statement } : {}),
    ingredients: names.map((row) => ({ name: row })),
  }
}

function decode(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

function cellNumber(cell: string): number | null {
  if (!cell || /^\d+(?:\.\d+)?\s*%$/.test(cell)) return null
  const match = cell.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/)
  if (!match) return null
  const n = Number(match[1])
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function draftFromNutritionHtml(html: string, sourceUrl?: string): SavedFoodDraft | null {
  if (!html.trim()) return null
  const title = decode(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "")
  const name = title.replace(/\s*[-|].*$/, "").trim()
  const rows = [...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((row) =>
    [...row[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => decode(cell[1])),
  )
  let per100 = -1
  const seen: Partial<Nutrients> = {}
  for (const cells of rows) {
    if (!cells.length) continue
    const header = cells.join(" ").toLowerCase()
    if (/100\s*g/.test(header) && cells.length > 1) {
      per100 = cells.findIndex((cell) => /100\s*g/i.test(cell))
      continue
    }
    const label = cells[0] || ""
    const spec = HTML_KEYS.find((row) => row.test.test(label))
    if (!spec || seen[spec.key] != null) continue
    const value = cellNumber(per100 > 0 ? cells[per100] || "" : cells[1] || "")
    if (value == null) continue
    seen[spec.key] = value
  }
  const plain = decode(html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<\/h[1-6]>/gi, "\n"))
  const ingredients = plain.match(/ingredients?\s*[:\-]?\s*([^\n]+)/i)?.[1]?.trim() || ""
  const names = namesFromIngredientStatement(ingredients)
  if (!name && !Object.keys(seen).length && !ingredients) return null
  return {
    name: name || "Food",
    seen,
    gramsPerUnit: 100,
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(ingredients ? { ingredientStatement: ingredients } : {}),
    ingredients: names.map((row) => ({ name: row })),
  }
}

/** USDA numbers win. The page fills a key the record did not have. */
export function mergeNutritionDrafts(usda: SavedFoodDraft | null, page: SavedFoodDraft | null, sourceUrl?: string): SavedFoodDraft | null {
  if (!usda && !page) return null
  const seen: Partial<Nutrients> = { ...(page?.seen ?? {}), ...(usda?.seen ?? {}) }
  const statement = usda?.ingredientStatement || page?.ingredientStatement
  const ingredients = usda?.ingredients.length ? usda.ingredients : page?.ingredients ?? []
  return {
    name: usda?.name || page?.name || "Food",
    seen,
    gramsPerUnit: usda?.gramsPerUnit || page?.gramsPerUnit || 100,
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(statement ? { ingredientStatement: statement } : {}),
    ingredients,
  }
}

export async function readNutritionLink(url: string): Promise<NutritionRead> {
  const trimmed = url.trim()
  if (!trimmed) return { ok: false, reason: "Paste a nutrition facts link." }
  if (process.env.VITEST) return { ok: false, reason: "That page could not be read." }
  const id = fdcIdFromNutritionUrl(trimmed)
  let usda: SavedFoodDraft | null = null
  if (id) {
    try {
      const endpoint = new URL(`https://api.nal.usda.gov/fdc/v1/food/${encodeURIComponent(id)}`)
      endpoint.searchParams.set("api_key", usdaApiKey())
      const response = await fetch(endpoint)
      if (response.ok) usda = draftFromUsdaFood(await response.json(), trimmed)
    } catch {
      usda = null
    }
  }
  let page: SavedFoodDraft | null = null
  try {
    const response = await fetch(trimmed)
    if (response.ok) {
      const html = await response.text()
      page = draftFromNutritionHtml(html, trimmed)
    }
  } catch {
    page = null
  }
  const draft = mergeNutritionDrafts(usda, page, trimmed)
  if (!draft || (!Object.keys(draft.seen).length && !draft.ingredientStatement)) {
    return { ok: false, reason: "That page could not be read." }
  }
  return { ok: true, draft }
}

export function nutrientsFromSeen(seen: Partial<Nutrients>): Nutrients {
  return nutrientsFrom(seen)
}
