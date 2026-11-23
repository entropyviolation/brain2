/**
 * lib/food-bimby/read.ts — Is this line about food eaten, and what was eaten
 *
 * `looksLikeFoodLog` is code: the line asks for food tracking or nutrition, or names eating and two foods.
 * `MEALS_SCHEMA` / `MEALS_SYSTEM` ask the local model to turn the line into meals, each with its
 * ingredients in grams and a nutrition guess for the amount eaten. Models think in servings, so the guess is a
 * total, and code turns it into per-100 g; calories the person stated win. The guess only checks (and, with no
 * hit, stands in for) a lookup.
 * `readMealsReply` cleans what the model said. `readMealsInCode` is the no-model reading.
 * Pure: no stores, no network.
 */

import { gramsFromMeasure, parseIngredientLine } from "@/lib/kitchen-ingredient-list"

export type MealKind = "meal" | "snack" | "drink"

export interface Per100Guess {
  kcal: number
  proteinG: number
  carbG: number
  fatG: number
  sugarG: number
  fiberG: number
  sodiumMg: number
}

export interface EatenPart {
  /** What the person called it. */
  name: string
  /** Words for a nutrition search, brand first when there is one (“POM Wonderful 100% pomegranate juice”). */
  search: string
  /** The amount in their words (“1 can”, “a splish”, “4 thick strips”). */
  amount: string
  /** The model's gram (or ml) estimate for the whole amount eaten. */
  grams: number
  /** The model's guess, per 100 g. Checks a lookup; stands in when nothing is found. */
  guess: Per100Guess | null
}

export interface EatenMeal {
  title: string
  /** 0 today, -1 yesterday, -2 the day before. */
  dayOffset: number
  /** Minutes past midnight when the line says a time; null when it does not. */
  minute: number | null
  kind: MealKind
  /** Made at home from the parts: kept as a recipe card. */
  homemade: boolean
  /** Servings the whole batch makes (homemade only). */
  batchServings: number
  /** Servings of the batch eaten. */
  servingsEaten: number
  parts: EatenPart[]
  /** The person's own words about it (“turned out really good, would make again”). */
  note: string
}

export interface MealsReading {
  eaten: EatenMeal[]
  /** Food named as a plan, not eaten yet (“the plan with this rice is …”). Not logged. */
  planned: string[]
}

const ASKS_TRACKING =
  /\b(?:food\s+(?:track(?:ing|er)?|log|diary|journal)|(?:log|track|record)\s+(?:all\s+)?(?:of\s+)?(?:this|that|these|the|my|what\s+i)\s*(?:food|meals?|eat(?:en)?|ate)?|nutrition(?:al)?(?:\s+(?:info|facts|breakdown|data))?|calories|kcal|macros)\b/i
const EAT_WORD = /\b(?:ate|eaten|eat|eating|had|have\s+had|drank|drink|snacked|munched|devoured|finished)\b/i
/** Common foods and drinks. Two of them with an eating word is a food log. */
const FOOD_WORD =
  /\b(?:soup|stew|salad|sandwich|burger|pizza|pasta|ravioli|noodles?|ramen|rice|bread|toast|bagel|eggs?|bacon|sausage|ham|chicken|beef|steak|pork|fish|tuna|salmon|shrimp|tofu|beans?|potato(?:es)?|fries|corn|cheese|cheddar|mozzarella|yogurt|milk|cream|butter|oil|apple|banana|berries|orange|grapes|avocado|tomato(?:es)?|onions?|garlic|carrots?|broccoli|spinach|cereal|oats|oatmeal|granola|chips|crackers|cookies?|cake|candy|chocolate|ice\s+cream|juice|soda|coke|pepsi|sprite|red\s?bulls?|monster|coffee|latte|tea|smoothie|beer|wine|burrito|taco|sushi|curry|dumplings?|kewpie|mayo|sauce|broth)\b/gi

/** True when the line is about food eaten and should be looked up and logged. */
export function looksLikeFoodLog(raw: string): boolean {
  const text = raw.trim()
  if (text.length < 6) return false
  if (/\?\s*$/.test(text) && !ASKS_TRACKING.test(text)) return false
  const foods = new Set((text.match(FOOD_WORD) ?? []).map((w) => w.toLowerCase()))
  if (ASKS_TRACKING.test(text) && (EAT_WORD.test(text) || foods.size >= 1)) return true
  return EAT_WORD.test(text) && foods.size >= 2
}

// ---------------------------------------------------------------- the model

const GUESS_SCHEMA = {
  type: "object",
  properties: {
    kcal: { type: "number" },
    proteinG: { type: "number" },
    carbG: { type: "number" },
    fatG: { type: "number" },
    sugarG: { type: "number" },
    fiberG: { type: "number" },
    sodiumMg: { type: "number" },
  },
  required: ["kcal", "proteinG", "carbG", "fatG", "sugarG", "fiberG", "sodiumMg"],
}

export const MEALS_SCHEMA = {
  type: "object",
  properties: {
    eaten: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          dayOffset: { type: "integer" },
          minute: { type: ["integer", "null"] },
          kind: { type: "string", enum: ["meal", "snack", "drink"] },
          homemade: { type: "boolean" },
          batchServings: { type: "number" },
          servingsEaten: { type: "number" },
          note: { type: "string" },
          parts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                search: { type: "string" },
                amount: { type: "string" },
                grams: { type: "number" },
                total: GUESS_SCHEMA,
                statedKcal: { type: "number" },
              },
              required: ["name", "search", "amount", "grams", "total", "statedKcal"],
            },
          },
        },
        required: ["title", "dayOffset", "minute", "kind", "homemade", "batchServings", "servingsEaten", "note", "parts"],
      },
    },
    planned: { type: "array", items: { type: "string" } },
  },
  required: ["eaten", "planned"],
}

export const MEALS_SYSTEM = [
  "You read what a person says they ate and turn it into a food log. Reply with JSON only.",
  "eaten: one entry per dish or drink they actually ate or drank. A drink with calories (juice, soda, energy drink) is its own entry, kind drink.",
  "dayOffset: 0 today, -1 yesterday, -2 the day before yesterday. When they list days in order (\"the day before\", \"next day\", \"today\"), follow that order. When no day is said, 0.",
  "minute: minutes after midnight only if a clock time is said, else null.",
  "homemade: true for something they cooked from parts (a soup they made). Then parts are the recipe's ingredients for the whole batch, batchServings is how many servings the batch makes (guess 4 if unsure), and servingsEaten is how many of those they ate (all of it = batchServings).",
  "For a bought dish they added things to, parts are the dish plus each addition. For a single item, one part.",
  "parts.grams: your best estimate of the grams (or ml) eaten for that amount. Use real package sizes: a standard can of corn is about 432 g with liquid, a medium Yukon Gold potato about 170 g, one thick-cut bacon strip about 28 g raw, a splash of cream about 15 g, a 12 oz soda can or Mexican Coke bottle 355 ml, an 8.4 oz Red Bull 250 ml, a large POM juice bottle 1420 ml (48 oz), a Target refrigerated ravioli container about 255 g. Multiply by the count.",
  "parts.search: words for a nutrition database search, brand first when said (\"POM Wonderful 100% pomegranate juice\", \"Red Bull apple\", \"Mexican Coca-Cola\", \"Good & Gather pumpkin goat cheese ravioli\", \"bacon raw\", \"heavy whipping cream\"). Plain names, no amounts.",
  "parts.total: your best nutrition estimate for the whole amount eaten of that part, as on a label times the count (kcal, protein, carb, fat, sugar, fiber in grams, sodium in mg). Two 8.4 oz Red Bulls are about 220 kcal; a 48 oz bottle of pomegranate juice about 960 kcal.",
  "parts.statedKcal: total calories the person said for that part (\"2 Mexican Cokes, 150 calorie ones\" is 300), else 0.",
  "note: their own words about how it was or wanting to keep the recipe, else empty.",
  "planned: food they say they will eat or plan to eat, not eaten yet, each as a short phrase. Never put planned food in eaten.",
].join("\n")

const num = (v: unknown, fallback = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback)
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "")

const GUESS_KEYS = ["kcal", "proteinG", "carbG", "fatG", "sugarG", "fiberG", "sodiumMg"] as const

/**
 * The model's total for the amount eaten, as per 100 g. A stated calorie count rescales the whole guess
 * (a macro-free guess keeps only the stated calories). Null when there is nothing usable.
 */
export function guessPer100(total: unknown, grams: number, statedKcal = 0): Per100Guess | null {
  if (grams <= 0) return null
  const t = total && typeof total === "object" ? (total as Record<string, unknown>) : {}
  const row = Object.fromEntries(GUESS_KEYS.map((k) => [k, Math.max(0, num(t[k]))])) as unknown as Per100Guess
  if (statedKcal > 0) {
    const scale = row.kcal > 0 ? statedKcal / row.kcal : 0
    for (const k of GUESS_KEYS) row[k] = scale ? row[k] * scale : 0
    row.kcal = statedKcal
  }
  if (!total && statedKcal <= 0) return null
  const per = Object.fromEntries(GUESS_KEYS.map((k) => [k, (row[k] * 100) / grams])) as unknown as Per100Guess
  // Nothing holds more than 900 kcal in 100 g (pure fat): a bigger guess is wrong.
  return per.kcal > 900 ? null : per
}

/** The model's answer, cleaned. Empty when it said nothing usable. */
export function readMealsReply(raw: unknown): MealsReading {
  const out: MealsReading = { eaten: [], planned: [] }
  if (!raw || typeof raw !== "object") return out
  const body = raw as { eaten?: unknown; planned?: unknown }
  for (const m of Array.isArray(body.eaten) ? body.eaten : []) {
    if (!m || typeof m !== "object") continue
    const meal = m as Record<string, unknown>
    const parts: EatenPart[] = []
    for (const p of Array.isArray(meal.parts) ? meal.parts : []) {
      if (!p || typeof p !== "object") continue
      const part = p as Record<string, unknown>
      const name = str(part.name)
      const grams = num(part.grams)
      // Plain water carries nothing to count.
      if (!name || grams <= 0 || grams > 5000 || /^(?:some\s+)?(?:tap\s+)?water$/i.test(name)) continue
      parts.push({ name, search: str(part.search) || name, amount: str(part.amount).replace(/[{}[\]]/g, "").trim(), grams: Math.round(grams), guess: guessPer100(part.total, grams, num(part.statedKcal)) })
    }
    if (!parts.length) continue
    const kind = meal.kind === "drink" || meal.kind === "snack" ? meal.kind : "meal"
    const homemade = meal.homemade === true && parts.length > 1
    const batch = Math.max(1, Math.min(24, num(meal.batchServings, 1)))
    const minute = typeof meal.minute === "number" && meal.minute >= 0 && meal.minute < 1440 ? Math.round(meal.minute) : null
    out.eaten.push({
      title: str(meal.title) || parts.map((p) => p.name).slice(0, 3).join(", "),
      dayOffset: Math.max(-14, Math.min(0, Math.round(num(meal.dayOffset)))),
      minute,
      kind,
      homemade,
      batchServings: homemade ? batch : 1,
      servingsEaten: homemade ? Math.max(0.25, Math.min(batch, num(meal.servingsEaten, batch))) : 1,
      parts,
      note: str(meal.note),
    })
  }
  for (const p of Array.isArray(body.planned) ? body.planned : []) {
    const said = str(p)
    if (said) out.planned.push(said)
  }
  return out
}

// ---------------------------------------------------------------- no model

const DAY_WORD: [RegExp, number][] = [
  [/\b(?:day\s+before\s+yesterday|two\s+days\s+ago)\b/i, -2],
  [/\byesterday\b/i, -1],
]

/**
 * The line read with no model: split on commas, "and", "also", "as well as"; each piece one food,
 * all on one plate on the day a day word names (today otherwise). Amounts become grams only when written
 * as a weight or a spoon; a bare count is one 100 g portion.
 */
export function readMealsInCode(raw: string): MealsReading {
  const text = raw.replace(/\bPLEASE\b[\s\S]*$/i, "").trim()
  const dayOffset = DAY_WORD.find(([re]) => re.test(text))?.[1] ?? 0
  const pieces = text
    .replace(/^(?:today\s+|yesterday\s+)?(?:i\s+)?(?:ate|had|eaten|drank)\s+/i, "")
    .split(/\s*(?:,|;|\band\b|\balso\s+had\b|\balso\b|\bas\s+well\s+as\b|\bplus\b|\bwith\b)\s*/i)
    .map((p) => p.replace(/^(?:a|an|some|the)\s+/i, "").replace(/[.!]+$/, "").trim())
    .filter((p) => p.length >= 2 && p.length <= 60)
  const parts: EatenPart[] = []
  for (const piece of pieces) {
    const parsed = parseIngredientLine(piece)
    const name = parsed?.query?.trim() || piece
    const grams = (parsed ? gramsFromMeasure(parsed.quantity, parsed.unit) ?? parsed.gramsGuess : null) ?? 100 * (parsed?.quantity && parsed.unit === "count" ? parsed.quantity : 1)
    parts.push({ name, search: name, amount: piece, grams: Math.round(grams), guess: null })
  }
  if (!parts.length) return { eaten: [], planned: [] }
  return {
    eaten: [{ title: parts.map((p) => p.name).slice(0, 3).join(", "), dayOffset, minute: null, kind: "meal", homemade: false, batchServings: 1, servingsEaten: 1, parts, note: "" }],
    planned: [],
  }
}
