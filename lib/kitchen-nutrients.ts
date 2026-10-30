/**
 * lib/kitchen-nutrients.ts — Per-100g nutrients, plate totals, meal and snack sums
 *
 * Calories and the macro and micro set live on one record. The face is the
 * twelve numbers the day shows. More opens the rest of the profile: fatty
 * acids, carbohydrate detail, vitamins, minerals, carotenoids, and amino acids.
 * A missing
 * key on an old save is zero. Net carbs are carbohydrate minus fiber. Grams
 * scale a per-100g row. No network here.
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
  "satFatG",
  "monoFatG",
  "polyFatG",
  "omega3G",
  "omega6G",
  "transFatG",
  "cholesterolMg",
  "starchG",
  "addedSugarG",
  "sugarAlcoholG",
  "vitAMcg",
  "vitEMg",
  "vitKMcg",
  "thiaminMg",
  "riboflavinMg",
  "niacinMg",
  "pantothenicMg",
  "vitB6Mg",
  "folateMcg",
  "vitB12Mcg",
  "cholineMg",
  "magnesiumMg",
  "phosphorusMg",
  "zincMg",
  "seleniumMcg",
  "copperMg",
  "manganeseMg",
  "betaCaroteneMcg",
  "luteinMcg",
  "histidineG",
  "isoleucineG",
  "leucineG",
  "lysineG",
  "methionineG",
  "phenylalanineG",
  "threonineG",
  "tryptophanG",
  "valineG",
  "alanineG",
  "arginineG",
  "asparticG",
  "cystineG",
  "glutamicG",
  "glycineG",
  "prolineG",
  "serineG",
  "tyrosineG",
] as const

export type NutrientKey = (typeof NUTRIENT_KEYS)[number]

export type Nutrients = Record<NutrientKey, number>

function zeros(): Nutrients {
  const out = {} as Nutrients
  for (const key of NUTRIENT_KEYS) out[key] = 0
  return out
}

export const ZERO_NUTRIENTS: Nutrients = zeros()

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

export type NutrientMeta = { key: NutrientKey; label: string; unit: string; digits: number; group: string }

/** The profile behind More. The face stays the twelve above. */
export const NUTRIENT_LAB: NutrientMeta[] = [
  { key: "satFatG", label: "Saturated fat", unit: "g", digits: 1, group: "fatty" },
  { key: "monoFatG", label: "Monounsaturated fat", unit: "g", digits: 1, group: "fatty" },
  { key: "polyFatG", label: "Polyunsaturated fat", unit: "g", digits: 1, group: "fatty" },
  { key: "omega3G", label: "Omega-3", unit: "g", digits: 2, group: "fatty" },
  { key: "omega6G", label: "Omega-6", unit: "g", digits: 2, group: "fatty" },
  { key: "transFatG", label: "Trans fat", unit: "g", digits: 2, group: "fatty" },
  { key: "cholesterolMg", label: "Cholesterol", unit: "mg", digits: 0, group: "fatty" },
  { key: "starchG", label: "Starch", unit: "g", digits: 1, group: "carb" },
  { key: "addedSugarG", label: "Added sugar", unit: "g", digits: 1, group: "carb" },
  { key: "sugarAlcoholG", label: "Sugar alcohols", unit: "g", digits: 1, group: "carb" },
  { key: "vitAMcg", label: "Vitamin A", unit: "mcg", digits: 0, group: "vitamin" },
  { key: "vitEMg", label: "Vitamin E", unit: "mg", digits: 1, group: "vitamin" },
  { key: "vitKMcg", label: "Vitamin K", unit: "mcg", digits: 0, group: "vitamin" },
  { key: "thiaminMg", label: "Thiamin", unit: "mg", digits: 2, group: "vitamin" },
  { key: "riboflavinMg", label: "Riboflavin", unit: "mg", digits: 2, group: "vitamin" },
  { key: "niacinMg", label: "Niacin", unit: "mg", digits: 1, group: "vitamin" },
  { key: "pantothenicMg", label: "Pantothenic acid", unit: "mg", digits: 2, group: "vitamin" },
  { key: "vitB6Mg", label: "Vitamin B6", unit: "mg", digits: 2, group: "vitamin" },
  { key: "folateMcg", label: "Folate", unit: "mcg", digits: 0, group: "vitamin" },
  { key: "vitB12Mcg", label: "Vitamin B12", unit: "mcg", digits: 2, group: "vitamin" },
  { key: "cholineMg", label: "Choline", unit: "mg", digits: 1, group: "vitamin" },
  { key: "magnesiumMg", label: "Magnesium", unit: "mg", digits: 0, group: "mineral" },
  { key: "phosphorusMg", label: "Phosphorus", unit: "mg", digits: 0, group: "mineral" },
  { key: "zincMg", label: "Zinc", unit: "mg", digits: 1, group: "mineral" },
  { key: "seleniumMcg", label: "Selenium", unit: "mcg", digits: 0, group: "mineral" },
  { key: "copperMg", label: "Copper", unit: "mg", digits: 2, group: "mineral" },
  { key: "manganeseMg", label: "Manganese", unit: "mg", digits: 2, group: "mineral" },
  { key: "betaCaroteneMcg", label: "Beta-carotene", unit: "mcg", digits: 0, group: "carotenoid" },
  { key: "luteinMcg", label: "Lutein + zeaxanthin", unit: "mcg", digits: 0, group: "carotenoid" },
  { key: "histidineG", label: "Histidine", unit: "g", digits: 2, group: "amino" },
  { key: "isoleucineG", label: "Isoleucine", unit: "g", digits: 2, group: "amino" },
  { key: "leucineG", label: "Leucine", unit: "g", digits: 2, group: "amino" },
  { key: "lysineG", label: "Lysine", unit: "g", digits: 2, group: "amino" },
  { key: "methionineG", label: "Methionine", unit: "g", digits: 2, group: "amino" },
  { key: "phenylalanineG", label: "Phenylalanine", unit: "g", digits: 2, group: "amino" },
  { key: "threonineG", label: "Threonine", unit: "g", digits: 2, group: "amino" },
  { key: "tryptophanG", label: "Tryptophan", unit: "g", digits: 2, group: "amino" },
  { key: "valineG", label: "Valine", unit: "g", digits: 2, group: "amino" },
  { key: "alanineG", label: "Alanine", unit: "g", digits: 2, group: "aminoOther" },
  { key: "arginineG", label: "Arginine", unit: "g", digits: 2, group: "aminoOther" },
  { key: "asparticG", label: "Aspartic acid", unit: "g", digits: 2, group: "aminoOther" },
  { key: "cystineG", label: "Cystine", unit: "g", digits: 2, group: "aminoOther" },
  { key: "glutamicG", label: "Glutamic acid", unit: "g", digits: 2, group: "aminoOther" },
  { key: "glycineG", label: "Glycine", unit: "g", digits: 2, group: "aminoOther" },
  { key: "prolineG", label: "Proline", unit: "g", digits: 2, group: "aminoOther" },
  { key: "serineG", label: "Serine", unit: "g", digits: 2, group: "aminoOther" },
  { key: "tyrosineG", label: "Tyrosine", unit: "g", digits: 2, group: "aminoOther" },
]

const META = new Map<NutrientKey, NutrientMeta>([...NUTRIENT_FACE, ...NUTRIENT_LAB].map((row) => [row.key, row]))

export const LAB_GROUPS: { id: string; title: string }[] = [
  { id: "fatty", title: "Fatty acids" },
  { id: "carb", title: "Carbohydrate detail" },
  { id: "vitamin", title: "Vitamins" },
  { id: "mineral", title: "Minerals" },
  { id: "carotenoid", title: "Carotenoids" },
  { id: "amino", title: "Essential amino acids" },
  { id: "aminoOther", title: "Other amino acids" },
]

export function cleanNutrient(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 1000) / 1000
}

export function nutrientsFrom(partial: Partial<Nutrients> | null | undefined): Nutrients {
  const out = zeros()
  if (!partial) return out
  for (const key of NUTRIENT_KEYS) out[key] = cleanNutrient(partial[key])
  return out
}

export function scaleNutrients(row: Nutrients, grams: number): Nutrients {
  const g = Number.isFinite(grams) && grams > 0 ? grams : 0
  const out = zeros()
  for (const key of NUTRIENT_KEYS) out[key] = cleanNutrient((row[key] * g) / 100)
  return out
}

export function addNutrients(a: Nutrients, b: Nutrients): Nutrients {
  const out = zeros()
  for (const key of NUTRIENT_KEYS) out[key] = cleanNutrient(a[key] + b[key])
  return out
}

export function sumNutrients(rows: readonly Nutrients[]): Nutrients {
  return rows.reduce(addNutrients, zeros())
}

export function divideNutrients(row: Nutrients, parts: number): Nutrients {
  const n = Number.isFinite(parts) && parts > 0 ? parts : 1
  const out = zeros()
  for (const key of NUTRIENT_KEYS) out[key] = cleanNutrient(row[key] / n)
  return out
}

/** Carbohydrate minus fiber. A derived line, not a diet mode. */
export function netCarbs(row: Nutrients): number {
  return cleanNutrient(Math.max(0, row.carbG - row.fiberG))
}

export function labGroupHasAny(row: Nutrients, group: string): boolean {
  return NUTRIENT_LAB.some((face) => face.group === group && row[face.key] > 0)
}

export function formatNutrient(key: NutrientKey, value: number): string {
  const face = META.get(key)
  const n = cleanNutrient(value)
  if (!face) return String(n)
  const shown = face.digits === 0 ? String(Math.round(n)) : (Math.round(n * 10 ** face.digits) / 10 ** face.digits).toFixed(face.digits)
  return `${shown} ${face.unit}`
}

export function hasNutrients(row: Nutrients): boolean {
  return NUTRIENT_KEYS.some((key) => row[key] > 0)
}
