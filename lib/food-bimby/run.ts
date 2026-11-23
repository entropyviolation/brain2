/**
 * lib/food-bimby/run.ts — One food line to the Food BIMBY
 *
 * Called by BIM chat's `food` lane. Null when the line is not about food eaten, so it goes on.
 * Order: read (local model, or code with LLM off), look up every part (`research.ts`), file the meals
 * (`apply.ts`), then say what was filed with the numbers and where each number came from.
 */

import type { ModelCall } from "@/lib/bim-flow/ollama"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useKitchenStore } from "@/lib/kitchen-store"
import { addNutrients, scaleNutrients, ZERO_NUTRIENTS, type Nutrients } from "@/lib/kitchen-nutrients"
import type { FoodHit } from "@/lib/kitchen-search"
import { fileMeals, type FiledMeal } from "./apply"
import { codeCanRead, looksLikeFoodLog, MEALS_SCHEMA, MEALS_SYSTEM, readMealsInCode, readMealsReply, type MealsReading } from "./read"
import { researchParts, type FoodJudge, type FoundBy } from "./research"

export interface FoodReply {
  text: string
  route: string
  choices?: { label: string; text: string }[]
  wrote?: boolean
}

export interface FoodOpts {
  llm?: boolean
  /** The model to ask. Omitted finds the chat crew's main model; null means none. */
  call?: ModelCall | null
  /** The network food search. Omitted uses USDA, then Open Food Facts. */
  search?: (query: string) => Promise<FoodHit[]>
}

const route = (what: string, by: string) => `FOOD · ${what} · ${by}`

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timed out")), ms)
    p.then((v) => (clearTimeout(t), resolve(v)), (e) => (clearTimeout(t), reject(e)))
  })
}

async function modelFor(opts: FoodOpts): Promise<ModelCall | null> {
  if (opts.call !== undefined) return opts.call
  if (!opts.llm) return null
  try {
    const [{ chatCrew }, { ollamaCall }] = await Promise.all([import("@/lib/bim-flow/chat-models"), import("@/lib/bim-flow/ollama")])
    const crew = await chatCrew()
    return crew ? ollamaCall(crew.main) : null
  } catch {
    return null
  }
}

type ModelRead = { reading: MealsReading } | { failed: string } | null

/** The model's reading; `failed` when a model was asked and gave nothing usable; null when there is no model. */
async function readWithModel(text: string, now: Date, opts: FoodOpts): Promise<ModelRead> {
  const call = await modelFor(opts)
  if (!call) return null
  try {
    const out = await withTimeout(
      call({ system: MEALS_SYSTEM, user: `Today is ${formatLocalDateKey(now)}.\n\nThey said:\n${text}`, schema: MEALS_SCHEMA, maxTokens: 2900, temperature: 0 }),
      120_000,
    )
    const reading = readMealsReply(out)
    return reading.eaten.length || reading.planned.length ? { reading } : { failed: "the model found no food in it" }
  } catch (error) {
    return { failed: error instanceof Error ? error.message : String(error) }
  }
}

const JUDGE_SYSTEM = [
  "You check food database matches. For each numbered food, pick the letter of the record that is the same food, or none.",
  "A different brand or a generic record of the same food is fine. A different food is not: red cabbage is not Red Bull, vegan bacon is not bacon, ramen is not broth, cream cheese is not cheddar, cooked rice is not uncooked rice.",
  "Reply with JSON: picks, one entry per food in order, the letter's index (a = 0, b = 1, …) or -1 for none.",
].join("\n")

const LETTERS = "abcd"

/** The model as the judge of each part's database candidates (`research.ts`). */
function judgeWith(call: ModelCall): FoodJudge {
  return async (items) => {
    const user = items
      .map(({ part, candidates }, n) => [`${n + 1}. ${part.name}, ${part.amount || `${part.grams} g`} (search: ${part.search})`, ...candidates.map((c, k) => `   ${LETTERS[k]}) ${c.name} (${Math.round(c.per100g.kcal)} kcal/100 g)`)].join("\n"))
      .join("\n")
    const out = (await withTimeout(
      call({ system: JUDGE_SYSTEM, user, schema: { type: "object", properties: { picks: { type: "array", items: { type: "integer" } } }, required: ["picks"] }, maxTokens: 200, temperature: 0 }),
      60_000,
    )) as { picks?: unknown }
    const picks = Array.isArray(out?.picks) ? out.picks : null
    if (!picks || picks.length !== items.length) return null
    return picks.map((p, k) => (typeof p === "number" && Number.isInteger(p) && p >= -1 && p < items[k]!.candidates.length ? p : 0))
  }
}

// ---------------------------------------------------------------- the reply

const round = (n: number) => Math.round(n)
const one = (n: number) => (n >= 10 ? String(Math.round(n)) : n.toFixed(1).replace(/\.0$/, ""))

function macros(n: Nutrients): string {
  return `${round(n.kcal).toLocaleString("en-US")} kcal · P ${one(n.proteinG)} g · C ${one(n.carbG)} g · F ${one(n.fatG)} g · sugar ${one(n.sugarG)} g · fiber ${one(n.fiberG)} g · sodium ${round(n.sodiumMg)} mg`
}

const BY_LABEL: Record<FoundBy, string> = { saved: "saved food", catalog: "catalog", usda: "USDA", off: "Open Food Facts", estimate: "estimate" }

function dayLabel(key: string, now: Date): string {
  const today = formatLocalDateKey(now)
  const y = new Date(now)
  y.setDate(y.getDate() - 1)
  if (key === today) return "Today"
  if (key === formatLocalDateKey(y)) return "Yesterday"
  const [yy, mm, dd] = key.split("-").map(Number)
  return new Date(yy!, mm! - 1, dd!).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

export function foodReplyText(filed: readonly FiledMeal[], planned: readonly string[], now: Date): string {
  const lines: string[] = [`On the Food book: ${filed.length} ${filed.length === 1 ? "entry" : "entries"}, each looked up and priced.`]
  const days = [...new Set(filed.map((m) => m.date))].sort()
  let estimates = 0
  for (const day of days) {
    const meals = filed.filter((m) => m.date === day)
    let total: Nutrients = { ...ZERO_NUTRIENTS }
    lines.push("", `${dayLabel(day, now)}`)
    for (const m of meals) {
      total = addNutrients(total, m.nutrients)
      const share = m.recipeId ? ` (${one(m.meal.servingsEaten)} of ${one(m.meal.batchServings)} servings; recipe card saved)` : ""
      lines.push(`• ${m.meal.title}${share}: ${macros(m.nutrients)}`)
      for (const r of m.parts) {
        const kcal = scaleNutrients(r.hit.per100g, r.part.grams).kcal
        if (r.by === "estimate") estimates++
        const amount = r.part.amount ? `${r.part.amount}, ` : ""
        lines.push(`   – ${r.part.name} (${amount}~${r.part.grams} g): ${round(kcal)} kcal · ${BY_LABEL[r.by]}${r.by === "estimate" ? "" : `: ${r.hit.name}`}`)
      }
      if (m.missing.length) lines.push(`   – not priced: ${m.missing.join(", ")}`)
    }
    if (meals.length > 1) lines.push(`  Day total: ${macros(total)}`)
  }
  if (estimates) lines.push("", `${estimates === 1 ? "One number" : `${estimates} numbers`} marked estimate had no database match; edit the food in Tracking → Food to swap in a label.`)
  lines.push("", "Grams are estimates from your amounts. Open a plate in Tracking → Food to change one.")
  if (planned.length) lines.push("", `Not logged (not eaten yet): ${planned.join("; ")}. Tell me when you have.`)
  return lines.join("\n")
}

// ---------------------------------------------------------------- one line

/** One typed line. Null when the line is not about food eaten. */
export async function tryFood(raw: string, now: Date, opts: FoodOpts = {}): Promise<FoodReply | null> {
  const text = raw.trim()
  if (!looksLikeFoodLog(text)) return null
  const read = await readWithModel(text, now, opts)
  const byModel = read && "reading" in read ? read.reading : null
  // A long line the model could not read is not guessed at in code: a comma split files a day of food as one plate.
  if (!byModel && !codeCanRead(text)) {
    const why = read && "failed" in read ? `The model could not read it (${read.failed}).` : "LLM is off, and this is too long to read without the model."
    return {
      text: `${why} Nothing is logged. Try again, or send it a day at a time (“yesterday: …”, “today: …”).`,
      route: route("unread", read ? "model failed" : "code"),
      choices: [{ label: "try again", text }],
    }
  }
  const reading = byModel ?? readMealsInCode(text)
  const by = byModel ? "model" : "code"
  const plannedChoices = reading.planned.slice(0, 2).map((p) => ({ label: `ate ${p.length > 18 ? `${p.slice(0, 18)}…` : p}`, text: `I ate ${p}` }))
  if (!reading.eaten.length) {
    if (!reading.planned.length) return null
    return { text: `That reads as a plan, so nothing is logged yet: ${reading.planned.join("; ")}. Tell me when you have eaten it.`, route: route("planned", by), choices: plannedChoices }
  }

  const custom = useKitchenStore.getState().foods
  const all = reading.eaten.flatMap((meal) => meal.parts)
  const call = byModel ? await modelFor(opts) : null
  const judge = call ? judgeWith(call) : undefined
  const found = await researchParts(all, { custom, ...(opts.search ? { search: opts.search } : {}), ...(judge ? { judge } : {}) })
  let i = 0
  const meals = reading.eaten.map((meal) => ({ meal, found: meal.parts.map(() => found[i++] ?? null) }))
  const filed = fileMeals(meals, now)
  if (!filed.length) {
    return { text: "I read food in that but could not find nutrition for any of it, so nothing is logged. Try naming each food plainly (“1 can corn, 3 potatoes”).", route: route("unpriced", by) }
  }
  return {
    text: foodReplyText(filed, reading.planned, now),
    route: route("logged", by),
    choices: [{ label: "undo", text: "undo that" }, ...plannedChoices],
    wrote: true,
  }
}
