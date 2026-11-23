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

/** Share of the search words (or of the person's words, whichever fits better) that the hit's name holds. */
export function nameFit(part: Pick<EatenPart, "name" | "search">, hitName: string): number {
  const have = new Set(words(hitName))
  const share = (ws: string[]) => (ws.length ? ws.filter((w) => have.has(w)).length / ws.length : 0)
  return Math.max(share([...new Set(words(part.search))]), share([...new Set(words(part.name))]))
}

/** The hit's calories agree with the guess: within a factor of about two, or both near zero. */
export function kcalFits(hitKcal: number, guess: Per100Guess | null): boolean {
  if (!guess) return true
  if (guess.kcal < 20) return hitKcal < 60
  if (hitKcal <= 0) return false
  const r = hitKcal / guess.kcal
  return r >= 0.45 && r <= 2.2
}

/** The best fitting hit, or null. Ties go to the record that printed more nutrients. */
export function pickHit(part: EatenPart, hits: readonly FoodHit[]): FoodHit | null {
  let best: { hit: FoodHit; score: number } | null = null
  for (const hit of hits) {
    if (!kcalFits(hit.per100g.kcal, part.guess)) continue
    const fit = nameFit(part, hit.name)
    if (fit < 0.6) continue
    const richness = (hit.present?.length ?? Object.values(hit.per100g).filter((v) => v > 0).length) / 100
    const score = fit + Math.min(richness, 0.3)
    if (!best || score > best.score) best = { hit, score }
  }
  return best?.hit ?? null
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

/** One part: local first; the network only when nothing local fits. */
export async function researchPart(part: EatenPart, deps: ResearchDeps): Promise<Researched | null> {
  const local = [...ingredientHits(part.search, deps.custom), ...(part.search !== part.name ? ingredientHits(part.name, deps.custom) : [])]
  const near = pickHit(part, local)
  if (near) return { part, hit: near, by: byOf(near, deps.custom) }
  const search = deps.search ?? searchFoodsOnline
  for (const query of [...new Set([part.search, part.name].map((q) => q.trim()).filter(Boolean))]) {
    const key = query.toLowerCase()
    if (!online.has(key)) online.set(key, search(query).catch(() => []))
    const hit = pickHit(part, await online.get(key)!)
    if (hit) return { part, hit, by: byOf(hit, deps.custom) }
  }
  const guess = estimateHit(part)
  return guess ? { part, hit: guess, by: "estimate" } : null
}

/** Every part, three at a time, in the order given. A part with no hit and no guess is null. */
export async function researchParts(parts: readonly EatenPart[], deps: ResearchDeps): Promise<(Researched | null)[]> {
  const out: (Researched | null)[] = new Array(parts.length).fill(null)
  let next = 0
  const worker = async () => {
    while (next < parts.length) {
      const i = next++
      out[i] = await researchPart(parts[i]!, deps).catch(() => {
        const guess = estimateHit(parts[i]!)
        return guess ? { part: parts[i]!, hit: guess, by: "estimate" as const } : null
      })
    }
  }
  await Promise.all([worker(), worker(), worker()])
  return out
}
