/**
 * lib/food-bimby/research.ts — Nutrition for each part eaten
 *
 * The tools, in order: foods on this device (saved foods and the catalog), then USDA FoodData Central,
 * then Open Food Facts (`lib/kitchen-search.ts`). A hit is taken only when its name shares the part's
 * words and its calories sit near the model's per-100 g guess, so "corn" does not become corn syrup. With
 * no fitting hit the model's guess is the number, saved as a food marked "(estimate)". Network answers are
 * kept for this session, and at most three searches run at once (the USDA demo key allows 30 an hour).
 */

import { ingredientHits } from "@/lib/kitchen-ingredient-list"
import { nutrientsFrom } from "@/lib/kitchen-nutrients"
import { searchFoodsOnline, type FoodHit } from "@/lib/kitchen-search"
import type { KitchenFood } from "@/lib/kitchen-types"
import type { EatenPart, Per100Guess } from "./read"

export type FoundBy = "saved" | "catalog" | "usda" | "off" | "estimate"

export interface Researched {
  part: EatenPart
  hit: FoodHit
  by: FoundBy
}

export interface ResearchDeps {
  /** Foods saved on this device. */
  custom: readonly KitchenFood[]
  /** The network search. Omitted uses USDA, then Open Food Facts. */
  search?: (query: string) => Promise<FoodHit[]>
}

const STOP = new Set(["a", "an", "the", "of", "and", "with", "in", "raw", "cooked", "fresh", "100", "100%", "oz", "g", "ml", "brand", "estimate"])

function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9%&\s-]/g, " ")
    .split(/[\s-]+/)
    .map((w) => w.replace(/(?:es|s)$/, ""))
    .filter((w) => w.length > 1 && !STOP.has(w))
}

/**
 * Share of the search words that the hit's name holds. The person's own words count too, but only when they are
 * two words or more: "cheese" alone would let "Cream cheese" stand for shredded cheddar.
 */
export function nameFit(part: Pick<EatenPart, "name" | "search">, hitName: string): number {
  const have = new Set(words(hitName))
  const share = (ws: string[]) => (ws.length ? ws.filter((w) => have.has(w)).length / ws.length : 0)
  const own = [...new Set(words(part.name))]
  return Math.max(share([...new Set(words(part.search))]), own.length >= 2 ? share(own) : 0)
}

const UNCOOKED = /\b(?:uncooked|dry|dried|raw)\b/i
const COOKED = /\b(?:cooked|boiled|steamed|baked|fried|roasted|prepared)\b/i

/** An uncooked amount is not priced as cooked food, nor a cooked one as raw. */
export function stateFits(part: Pick<EatenPart, "name" | "search" | "amount">, hitName: string): boolean {
  const said = `${part.name} ${part.search} ${part.amount}`
  if (UNCOOKED.test(said) && !/\braw\b.*\bstrips?\b/i.test(said)) return !COOKED.test(hitName)
  if (COOKED.test(said)) return !/\b(?:uncooked|dry|raw)\b/i.test(hitName)
  return true
}

/** The hit's calories agree with the guess: within a factor of about two, or both near zero. */
export function kcalFits(hitKcal: number, guess: Per100Guess | null): boolean {
  if (!guess) return true
  if (guess.kcal < 20) return hitKcal < 60
  if (hitKcal <= 0) return false
  const r = hitKcal / guess.kcal
  return r >= 0.45 && r <= 2.2
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "food"
}

/** The model's guess as a food, for a part no tool could find. */
export function estimateHit(part: EatenPart): FoodHit | null {
  if (!part.guess) return null
  return {
    id: `fbe_${slug(part.search || part.name)}`,
    name: `${part.name} (estimate)`,
    per100g: nutrientsFrom(part.guess),
    gramsPerUnit: 100,
    source: "custom",
    present: ["kcal", "proteinG", "carbG", "fatG", "sugarG", "fiberG", "sodiumMg"],
  }
}

const online = new Map<string, Promise<FoodHit[]>>()

export function forgetFoodSearches(): void {
  online.clear()
}

function byOf(hit: FoodHit, custom: readonly KitchenFood[]): FoundBy {
  if (hit.source === "usda") return custom.some((f) => f.id === hit.id) ? "saved" : "usda"
  if (hit.source === "off") return custom.some((f) => f.id === hit.id) ? "saved" : "off"
  if (hit.id.startsWith("cat_") || hit.source === "catalog") return "catalog"
  return "saved"
}

/** The model picks among the candidates: one index per item, -1 for none of them. Null when it could not say. */
export type FoodJudge = (items: { part: EatenPart; candidates: FoodHit[] }[]) => Promise<number[] | null>

/** Candidates that pass the name, calorie and cooked checks, best first, at most four. */
export function candidates(part: EatenPart, hits: readonly FoodHit[]): FoodHit[] {
  const seen = new Set<string>()
  const scored: { hit: FoodHit; fit: number; score: number }[] = []
  for (const hit of hits) {
    const key = hit.name.toLowerCase()
    if (seen.has(key) || !kcalFits(hit.per100g.kcal, part.guess) || !stateFits(part, hit.name)) continue
    const fit = nameFit(part, hit.name)
    if (fit < 0.5) continue
    seen.add(key)
    const richness = (hit.present?.length ?? Object.values(hit.per100g).filter((v) => v > 0).length) / 100
    scored.push({ hit, fit, score: fit + Math.min(richness, 0.3) })
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, 4).map((r) => r.hit)
}

/** The pick with no judge: the best candidate that names most of the search words, or null. */
export function pickHit(part: EatenPart, hits: readonly FoodHit[]): FoodHit | null {
  return candidates(part, hits).find((hit) => nameFit(part, hit.name) >= 0.6) ?? null
}

/** One part's candidates: on this device first; the network only when nothing here names it fully. */
export async function gatherCandidates(part: EatenPart, deps: ResearchDeps): Promise<FoodHit[]> {
  const local = candidates(part, [...ingredientHits(part.search, deps.custom), ...(part.search !== part.name ? ingredientHits(part.name, deps.custom) : [])])
  if (local.some((hit) => nameFit(part, hit.name) >= 0.99)) return local
  const search = deps.search ?? searchFoodsOnline
  for (const query of [...new Set([part.search, part.name].map((q) => q.trim()).filter(Boolean))]) {
    const key = query.toLowerCase()
    if (!online.has(key)) online.set(key, search(query).catch(() => []))
    const found = candidates(part, [...local, ...(await online.get(key)!)])
    if (found.some((hit) => !local.includes(hit))) return found
  }
  return local
}

const guessOf = (part: EatenPart): Researched | null => {
  const guess = estimateHit(part)
  return guess ? { part, hit: guess, by: "estimate" } : null
}

/**
 * Every part, in the order given. Candidates are gathered three parts at a time; then the judge (the model)
 * picks one per part or none, in one call. With no judge, or when it fails, the best-scoring candidate is
 * taken. A part with no pick gets the model's estimate, and null when there is none.
 */
export async function researchParts(parts: readonly EatenPart[], deps: ResearchDeps & { judge?: FoodJudge }): Promise<(Researched | null)[]> {
  const found: FoodHit[][] = new Array(parts.length).fill(null).map(() => [])
  let next = 0
  const worker = async () => {
    while (next < parts.length) {
      const i = next++
      found[i] = await gatherCandidates(parts[i]!, deps).catch(() => [])
    }
  }
  await Promise.all([worker(), worker(), worker()])

  const asked = parts.map((part, i) => ({ part, candidates: found[i]!, i })).filter((r) => r.candidates.length)
  const picks = deps.judge && asked.length ? await deps.judge(asked.map(({ part, candidates }) => ({ part, candidates }))).catch(() => null) : null
  const choice = new Map<number, number>()
  asked.forEach((r, k) => {
    const fallback = pickHit(r.part, r.candidates)
    choice.set(r.i, picks && Number.isInteger(picks[k]) ? picks[k]! : fallback ? r.candidates.indexOf(fallback) : -1)
  })

  return parts.map((part, i) => {
    const pick = choice.get(i)
    const hit = pick !== undefined && pick >= 0 ? found[i]![pick] : undefined
    return hit ? { part, hit, by: byOf(hit, deps.custom) } : guessOf(part)
  })
}
