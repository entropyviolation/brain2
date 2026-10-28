/**
 * lib/kitchen-nutrients.ts — Per-100g nutrients, plate totals, meal and snack sums
 *
 * Calories and the macro and micro set live on one record. A plate, a recipe,
 * and a day add those records up. Grams scale a per-100g row. No network here.
 */

export const NUTRIENT_KEYS = [
  "kcal",
  "proteinG",
  "carbG",
  "fatG",
  "fiberG",
  "sugarG",
  "sodiumMg",
  "potassiumMg",
  "calciumMg",
  "ironMg",
  "vitCMg",
  "vitDMcg",
] as const

export type NutrientKey = (typeof NUTRIENT_KEYS)[number]

export type Nutrients = Record<NutrientKey, number>

export const ZERO_NUTRIENTS: Nutrients = {
  kcal: 0,
  proteinG: 0,
  carbG: 0,
  fatG: 0,
  fiberG: 0,
  sugarG: 0,
  sodiumMg: 0,
  potassiumMg: 0,
  calciumMg: 0,
  ironMg: 0,
  vitCMg: 0,
  vitDMcg: 0,
}

export const NUTRIENT_FACE: { key: NutrientKey; label: string; unit: string; digits: number; group: "macro" | "micro" }[] = [
  { key: "kcal", label: "Calories", unit: "kcal", digits: 0, group: "macro" },
  { key: "proteinG", label: "Protein", unit: "g", digits: 1, group: "macro" },
  { key: "carbG", label: "Carbohydrate", unit: "g", digits: 1, group: "macro" },
  { key: "fatG", label: "Fat", unit: "g", digits: 1, group: "macro" },
  { key: "fiberG", label: "Fiber", unit: "g", digits: 1, group: "macro" },
  { key: "sugarG", label: "Sugar", unit: "g", digits: 1, group: "macro" },
  { key: "sodiumMg", label: "Sodium", unit: "mg", digits: 0, group: "micro" },
  { key: "potassiumMg", label: "Potassium", unit: "mg", digits: 0, group: "micro" },
  { key: "calciumMg", label: "Calcium", unit: "mg", digits: 0, group: "micro" },
  { key: "ironMg", label: "Iron", unit: "mg", digits: 1, group: "micro" },
  { key: "vitCMg", label: "Vitamin C", unit: "mg", digits: 1, group: "micro" },
  { key: "vitDMcg", label: "Vitamin D", unit: "mcg", digits: 1, group: "micro" },
]

export function cleanNutrient(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 1000) / 1000
}

export function nutrientsFrom(partial: Partial<Nutrients> | null | undefined): Nutrients {
  const out = { ...ZERO_NUTRIENTS }
  if (!partial) return out
  for (const key of NUTRIENT_KEYS) out[key] = cleanNutrient(partial[key])
  return out
}

export function scaleNutrients(row: Nutrients, grams: number): Nutrients {
  const g = Number.isFinite(grams) && grams > 0 ? grams : 0
  const out = { ...ZERO_NUTRIENTS }
  for (const key of NUTRIENT_KEYS) out[key] = cleanNutrient((row[key] * g) / 100)
  return out
}

export function addNutrients(a: Nutrients, b: Nutrients): Nutrients {
  const out = { ...ZERO_NUTRIENTS }
  for (const key of NUTRIENT_KEYS) out[key] = cleanNutrient(a[key] + b[key])
  return out
}

export function sumNutrients(rows: readonly Nutrients[]): Nutrients {
  return rows.reduce(addNutrients, { ...ZERO_NUTRIENTS })
}

export function divideNutrients(row: Nutrients, parts: number): Nutrients {
  const n = Number.isFinite(parts) && parts > 0 ? parts : 1
  const out = { ...ZERO_NUTRIENTS }
  for (const key of NUTRIENT_KEYS) out[key] = cleanNutrient(row[key] / n)
  return out
}

export function formatNutrient(key: NutrientKey, value: number): string {
  const face = NUTRIENT_FACE.find((row) => row.key === key)!
  const n = cleanNutrient(value)
  const shown = face.digits === 0 ? String(Math.round(n)) : (Math.round(n * 10 ** face.digits) / 10 ** face.digits).toFixed(face.digits)
  return `${shown} ${face.unit}`
}

export function hasNutrients(row: Nutrients): boolean {
  return NUTRIENT_KEYS.some((key) => row[key] > 0)
}
