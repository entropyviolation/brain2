/**
 * lib/kitchen-ingredient-list.ts — A pasted recipe list, one food per line
 *
 * "2 slices of bacon" keeps the count and the food words. A weight or a
 * spoon measure becomes grams, including a spoon written after the food
 * ("butter (1 tbs)"). A slice, a count, or a bare name does not: the recipe
 * asks for grams after the food is looked up. A near miss such as
 * "mozzerella" can still hit a catalog food. "Glaze" stays the food.
 */

import { KITCHEN_CATALOG } from "@/lib/kitchen-catalog"
import { searchFoodsOnline, searchLocalFoods, type FoodHit } from "@/lib/kitchen-search"
import type { KitchenFood } from "@/lib/kitchen-types"

export type MeasureUnit = "g" | "kg" | "oz" | "lb" | "ml" | "l" | "cup" | "tbsp" | "tsp" | "slice" | "count"

export interface ParsedIngredient {
  raw: string
  query: string
  quantity: number | null
  unit: MeasureUnit | null
  /** A stated guess, such as a splash or a clove. Editable. Null when the measure is already grams. */
  gramsGuess: number | null
}

const UNIT: Record<string, MeasureUnit> = {
  g: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  cup: "cup",
  cups: "cup",
  tbsp: "tbsp",
  tbs: "tbsp",
  tbl: "tbsp",
  tbls: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  slice: "slice",
  slices: "slice",
  rasher: "slice",
  rashers: "slice",
  strip: "slice",
  strips: "slice",
  piece: "count",
  pieces: "count",
  clove: "count",
  cloves: "count",
}

const VAGUE = new Set(["pinch", "pinches", "dash", "dashes", "handful", "handfuls", "splash", "splashes", "knob", "knobs", "dollop", "dollops", "drizzle"])

const NUMBER_WORDS: Record<string, string> = {
  a: "1",
  an: "1",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  half: "1/2",
}

const GLYPH: Record<string, number> = {
  "½": 1 / 2,
  "¼": 1 / 4,
  "¾": 3 / 4,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 1 / 8,
}

const GRAMS: Partial<Record<MeasureUnit, number>> = {
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
  ml: 1,
  l: 1000,
  cup: 240,
  tbsp: 15,
  tsp: 5,
}

const AMOUNT = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?|[½¼¾⅓⅔⅛])`

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function parseAmount(token: string): number | null {
  if (GLYPH[token] != null) return GLYPH[token]
  const mixed = token.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (mixed) {
    const den = Number(mixed[3])
    if (!den) return null
    return Number(mixed[1]) + Number(mixed[2]) / den
  }
  const frac = token.match(/^(\d+)\/(\d+)$/)
  if (frac) {
    const den = Number(frac[2])
    if (!den) return null
    return Number(frac[1]) / den
  }
  const n = Number(token)
  return Number.isFinite(n) ? n : null
}

function tidy(line: string): string {
  let raw = line.trim()
  raw = raw.replace(/^\s*(?:[-*•–]|\d+[.)])\s+/, "")
  raw = raw.replace(/^(about|approx\.?|approximately|around)\s+/i, "")
  const worded = raw.match(/^(a|an|one|two|three|four|five|six|seven|eight|nine|ten|half)\s+(.*)$/i)
  if (worded) raw = `${NUMBER_WORDS[worded[1].toLowerCase()]} ${worded[2]}`
  return raw.trim()
}

function unitWord(token: string): { unit: MeasureUnit; word: string } | null {
  const word = token.toLowerCase().replace(/\./g, "")
  const unit = UNIT[word]
  if (!unit) return null
  return { unit, word }
}

function measured(raw: string, query: string, quantity: number, unit: MeasureUnit | null, word: string): ParsedIngredient {
  const clove = word === "clove" || word === "cloves"
  return { raw, query, quantity, unit, gramsGuess: clove ? round1(quantity * 3) : null }
}

/** "butter (1 tbs)" and "butter, 1 tbs" are a spoon of butter, not a food named tbs. */
function trailingMeasure(raw: string, text: string): ParsedIngredient | null {
  const paren = text.match(new RegExp(`^(.*?)\\s*\\(\\s*(${AMOUNT})\\s*([a-zA-Z.]+)\\s*\\)\\s*$`, "i"))
  const comma = text.match(new RegExp(`^(.*?)\\s*,\\s*(${AMOUNT})\\s*([a-zA-Z.]+)\\s*$`, "i"))
  const found = paren || comma
  if (!found) return null
  const query = found[1].trim().replace(/[,\s]+$/, "")
  const quantity = parseAmount(found[2])
  const parsed = unitWord(found[3])
  if (!query || quantity == null || !parsed) return null
  return measured(raw, query, quantity, parsed.unit, parsed.word)
}

export function parseIngredientLine(line: string): ParsedIngredient | null {
  const raw = line.trim()
  if (!raw || raw.startsWith("#")) return null
  const text = tidy(line)
  if (!text) return null
  if (/^\d+(?:\.\d+)?%/.test(text)) return { raw, query: text, quantity: null, unit: null, gramsGuess: null }
  const bareVague = text.match(/^(pinch|dash|handful|splash|splashes|knob|dollop|drizzle)\s+of\s+(.+)$/i)
  if (bareVague) {
    const query = bareVague[2].trim()
    if (!query) return null
    const word = bareVague[1].toLowerCase()
    return { raw, query, quantity: null, unit: null, gramsGuess: word.startsWith("splash") ? 5 : null }
  }
  const match = text.match(new RegExp(`^(${AMOUNT})\\s*([a-zA-Z.]+)?\\s*(.*)$`, "i"))
  if (!match || parseAmount(match[1]) == null) {
    return trailingMeasure(raw, text) ?? { raw, query: text, quantity: null, unit: null, gramsGuess: null }
  }
  const quantity = parseAmount(match[1])
  const word = (match[2] || "").toLowerCase().replace(/\./g, "")
  let rest = (match[3] || "").replace(/^of\s+/i, "").trim()
  if (word && VAGUE.has(word)) {
    const query = rest || text
    const guess = word.startsWith("splash") && quantity != null ? round1(quantity * 5) : null
    return { raw, query, quantity: null, unit: null, gramsGuess: guess }
  }
  let unit: MeasureUnit | null = null
  if (word && UNIT[word]) {
    unit = UNIT[word]
  } else if (word) {
    unit = "count"
    rest = `${word} ${rest}`.trim()
  }
  const query = rest.trim()
  if (!query || quantity == null) return trailingMeasure(raw, text) ?? { raw, query: query || text, quantity: null, unit: null, gramsGuess: null }
  return measured(raw, query, quantity, unit, word)
}

export function parseIngredientList(text: string): ParsedIngredient[] {
  const out: ParsedIngredient[] = []
  for (const line of text.split(/\r?\n/)) {
    const row = parseIngredientLine(line)
    if (row) out.push(row)
  }
  return out
}

/** Grams for a weight or a kitchen volume. A slice or a count stays open. */
export function gramsFromMeasure(quantity: number | null, unit: MeasureUnit | null): number | null {
  if (quantity == null || quantity <= 0 || !unit) return null
  const per = GRAMS[unit]
  if (per == null) return null
  return round1(quantity * per)
}

export function measureIsAbout(unit: MeasureUnit | null): boolean {
  return unit === "ml" || unit === "l" || unit === "cup" || unit === "tbsp" || unit === "tsp"
}

export function measurePhrase(quantity: number | null, unit: MeasureUnit | null): string {
  if (quantity == null || quantity <= 0) return ""
  const qty = Number.isInteger(quantity) ? String(quantity) : String(round1(quantity))
  if (!unit || unit === "count") return qty
  const plural: Partial<Record<MeasureUnit, string>> = {
    slice: "slices",
    cup: "cups",
  }
  const one: Partial<Record<MeasureUnit, string>> = { slice: "slice", cup: "cup" }
  const word = quantity === 1 ? one[unit] || unit : plural[unit] || unit
  return `${qty} ${word}`
}

function tokens(value: string): string[] {
  const stop = new Set(["and", "the", "with", "for", "from", "raw"])
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !stop.has(word))
}

function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    let best = next[0]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      next[j] = Math.min(prev[j] + 1, next[j - 1] + 1, prev[j - 1] + cost)
      if (next[j] < best) best = next[j]
    }
    if (best > limit) return limit + 1
    prev = next
  }
  return prev[b.length]
}

function closeWord(a: string, b: string): boolean {
  if (a === b) return true
  if (a.endsWith("s") && a.slice(0, -1) === b) return true
  if (b.endsWith("s") && b.slice(0, -1) === a) return true
  if (a.endsWith("es") && a.slice(0, -2) === b) return true
  const shortest = Math.min(a.length, b.length)
  if (shortest < 5) return false
  const limit = shortest >= 9 ? 2 : 1
  return editDistance(a, b, limit) <= limit
}

/** Catalog foods whose names sit next to the typed words. Ties stay in the list. */
export function closeCatalogFoods(query: string): KitchenFood[] {
  const qWords = tokens(query)
  if (!qWords.length) return []
  const scored = KITCHEN_CATALOG.map((food) => {
    const names = tokens(food.name)
    const score = qWords.filter((word) => names.some((other) => closeWord(word, other))).length
    return { food, score }
  }).filter((row) => row.score > 0)
  scored.sort((a, b) => b.score - a.score || a.food.name.length - b.food.name.length)
  if (!scored.length) return []
  const need = qWords.length === 1 ? 1 : Math.ceil(qWords.length / 2)
  const best = scored[0].score
  if (best < need) return []
  return scored.filter((row) => row.score === best).map((row) => row.food)
}

function asHit(food: KitchenFood): FoodHit {
  return {
    id: food.id,
    name: food.name,
    per100g: food.per100g,
    gramsPerUnit: food.gramsPerUnit,
    source: food.source,
  }
}

export function ingredientHits(query: string, custom: readonly KitchenFood[]): FoodHit[] {
  const direct = searchLocalFoods(query, custom)
  if (direct.length) return direct.slice(0, 8)
  return closeCatalogFoods(query).slice(0, 4).map(asHit)
}

/** The typed words, plus one catalog name when the typing is off. */
export function lookupQueries(query: string): string[] {
  const q = query.trim()
  if (q.length < 2) return q ? [q] : []
  const out = [q]
  if (!searchLocalFoods(q, []).length) {
    const hint = closeCatalogFoods(q)[0]
    if (hint && hint.name.toLowerCase() !== q.toLowerCase()) out.push(hint.name)
  }
  return out
}

function mergeHits(current: FoodHit[], extra: FoodHit[]): FoodHit[] {
  const seen = new Set(current.map((hit) => hit.id))
  const names = new Set(current.map((hit) => hit.name.toLowerCase()))
  const next = [...current]
  for (const hit of extra) {
    if (seen.has(hit.id) || names.has(hit.name.toLowerCase())) continue
    seen.add(hit.id)
    names.add(hit.name.toLowerCase())
    next.push(hit)
  }
  return next.slice(0, 8)
}

/** Foods on this device, then USDA, then Open Food Facts, for each lookup name. */
export async function gatherIngredientHits(query: string, custom: readonly KitchenFood[]): Promise<FoodHit[]> {
  let hits = ingredientHits(query, custom)
  const groups = await Promise.all(lookupQueries(query).map((name) => searchFoodsOnline(name)))
  for (const group of groups) hits = mergeHits(hits, group)
  return hits
}
