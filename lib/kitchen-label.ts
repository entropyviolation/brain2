/**
 * lib/kitchen-label.ts — Nutrition Facts text into a per-serving nutrient row
 *
 * The photo is read locally (Tesseract). This parser only trusts numbers the
 * label printed in grams, milligrams, micrograms, or calories. A percent daily
 * value is left blank. Per 100 g needs a serving weight. parseNutritionLabel
 * keeps a full row for the photo path. parseLabelDraft leaves a missing line
 * off the draft. Nothing here leaves the machine.
 */

import { cleanNutrient, NUTRIENT_KEYS, nutrientsFrom, scaleNutrients, type NutrientKey, type Nutrients } from "@/lib/kitchen-nutrients"

export interface LabelRead {
  servingLabel: string
  servingG: number | null
  perServing: Nutrients
}

function grab(text: string, pattern: RegExp): { value: number; unit: string } | null {
  const match = pattern.exec(text)
  if (!match) return null
  const value = Number(match[1])
  if (!Number.isFinite(value) || value < 0) return null
  return { value, unit: (match[2] || "").toLowerCase() }
}

function gramsOf(hit: { value: number; unit: string } | null): number {
  if (!hit) return 0
  if (hit.unit === "mg") return hit.value / 1000
  return hit.value
}

function mgOf(hit: { value: number; unit: string } | null): number {
  if (!hit) return 0
  if (hit.unit === "g") return hit.value * 1000
  if (hit.unit === "mcg" || hit.unit === "µg" || hit.unit === "ug") return hit.value / 1000
  return hit.value
}

function mcgOf(hit: { value: number; unit: string } | null): number {
  if (!hit) return 0
  if (hit.unit === "mg") return hit.value * 1000
  if (hit.unit === "g") return hit.value * 1_000_000
  return hit.value
}

/** Null when the text has no calorie line. The other nutrients may be zero. */
export function parseNutritionLabel(text: string): LabelRead | null {
  const raw = text.replace(/\u00a0/g, " ").replace(/[|]/g, " ")
  const calories = /calori\w*\s+(\d+(?:\.\d+)?)/i.exec(raw)
  if (!calories) return null
  const servingLine = /serving\s+size\s+([^\n]+)/i.exec(raw)
  const gramsInParen = servingLine ? /\((\d+(?:\.\d+)?)\s*g\)/i.exec(servingLine[1]) : null
  const gramsBare = servingLine ? /(\d+(?:\.\d+)?)\s*g\b/i.exec(servingLine[1]) : null
  const servingG = Number(gramsInParen?.[1] ?? gramsBare?.[1])
  const perServing = nutrientsFrom({
    kcal: Number(calories[1]),
    fatG: gramsOf(grab(raw, /total\s+fat\s+(\d+(?:\.\d+)?)\s*(g|mg)/i)),
    sodiumMg: mgOf(grab(raw, /sodium\s+(\d+(?:\.\d+)?)\s*(mg|g)/i)),
    carbG: gramsOf(grab(raw, /total\s+carbohydrate\s+(\d+(?:\.\d+)?)\s*(g|mg)/i)),
    fiberG: gramsOf(grab(raw, /dietary\s+fiber\s+(\d+(?:\.\d+)?)\s*(g|mg)/i)),
    sugarG: gramsOf(grab(raw, /total\s+sugars\s+(\d+(?:\.\d+)?)\s*(g|mg)/i)),
    proteinG: gramsOf(grab(raw, /protein\s+(\d+(?:\.\d+)?)\s*(g|mg)/i)),
    vitDMcg: mcgOf(grab(raw, /vitamin\s*d\s+(\d+(?:\.\d+)?)\s*(mcg|µg|ug|mg)/i)),
    calciumMg: mgOf(grab(raw, /calcium\s+(\d+(?:\.\d+)?)\s*(mg|g)/i)),
    ironMg: mgOf(grab(raw, /iron\s+(\d+(?:\.\d+)?)\s*(mg|g)/i)),
    potassiumMg: mgOf(grab(raw, /potassium\s+(\d+(?:\.\d+)?)\s*(mg|g)/i)),
    vitCMg: mgOf(grab(raw, /vitamin\s*c\s+(\d+(?:\.\d+)?)\s*(mg|g)/i)),
  })
  return {
    servingLabel: servingLine?.[1]?.trim() || "",
    servingG: Number.isFinite(servingG) && servingG > 0 ? servingG : null,
    perServing,
  }
}

export function labelPer100g(read: LabelRead, servingG: number): Nutrients | null {
  if (!Number.isFinite(servingG) || servingG <= 0) return null
  const per100 = scaleNutrients(read.perServing, 10_000 / servingG)
  return {
    kcal: cleanNutrient(per100.kcal),
    proteinG: per100.proteinG,
    carbG: per100.carbG,
    fatG: per100.fatG,
    fiberG: per100.fiberG,
    sugarG: per100.sugarG,
    sodiumMg: per100.sodiumMg,
    potassiumMg: per100.potassiumMg,
    calciumMg: per100.calciumMg,
    ironMg: per100.ironMg,
    vitCMg: per100.vitCMg,
    vitDMcg: per100.vitDMcg,
  }
}

export type LabelBasis = "serving" | "100g" | "container"

/** Keys that were printed. A missing key was not on the label. Zero was printed. */
export type LabelNutrients = Partial<Nutrients>

export interface LabelDraft {
  name: string | null
  servingLabel: string
  servingGrams: number | null
  nutrients: LabelNutrients
  basis: LabelBasis
}

const NUM = "(\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d+)?)"

const LINE_SPECS: { key: NutrientKey; test: RegExp; kind: "kcal" | "g" | "mg" | "mcg" }[] = [
  { key: "kcal", test: /\bcalories\b(?!\s+from\b)|\benergy\b/i, kind: "kcal" },
  { key: "fatG", test: /^total\s+fat\b|^fat\b/i, kind: "g" },
  { key: "carbG", test: /^total\s+carbohydrates?\b|^carbohydrates?\b/i, kind: "g" },
  { key: "fiberG", test: /^(?:dietary\s+)?fib(?:re|er)\b/i, kind: "g" },
  { key: "sugarG", test: /^total\s+sugars?\b|^sugars?\b/i, kind: "g" },
  { key: "proteinG", test: /^protein\b/i, kind: "g" },
  { key: "vitDMcg", test: /^vitamin\s*d\b/i, kind: "mcg" },
  { key: "calciumMg", test: /^calcium\b/i, kind: "mg" },
  { key: "ironMg", test: /^iron\b/i, kind: "mg" },
  { key: "potassiumMg", test: /^potassium\b/i, kind: "mg" },
  { key: "sodiumMg", test: /^sodium\b/i, kind: "mg" },
  { key: "vitCMg", test: /^vitamin\s*c\b/i, kind: "mg" },
]

function plainNumber(raw: string): number {
  return Number(raw.replace(/,/g, ""))
}

function skipNutrientLine(line: string): boolean {
  return /^(?:saturated|trans|polyunsaturated|monounsaturated|includes|added|cholesterol|soluble|insoluble)\b/i.test(line) || /^of\s+which\b/i.test(line)
}

function specFor(line: string): (typeof LINE_SPECS)[number] | null {
  return LINE_SPECS.find((spec) => spec.test.test(line)) ?? null
}

function restAfter(line: string, test: RegExp): string {
  const match = test.exec(line)
  if (!match) return line
  return line.slice(match.index + match[0].length)
}

function isPer100Header(line: string): boolean {
  if (/serving\s+size/i.test(line)) return false
  return /per\s+100\s*g\b/i.test(line) || /\/\s*100\s*g\b/i.test(line)
}

function servingColumn(line: string): number | null {
  if (!/per\s+serving/i.test(line) || !/per\s+container/i.test(line)) return null
  const servingAt = line.search(/per\s+serving/i)
  const containerAt = line.search(/per\s+container/i)
  return servingAt <= containerAt ? 0 : 1
}

function isContainerHeader(line: string): boolean {
  if (/serving\s+size/i.test(line)) return false
  if (/servings?\s+per\s+container/i.test(line) && !/amount\s+per\s+container/i.test(line)) return false
  return /amount\s+per\s+container\b/i.test(line) || /^per\s+container\b/i.test(line)
}

function tokensFor(kind: "kcal" | "g" | "mg" | "mcg", rest: string): { value: number; unit: string }[] {
  const cleaned = rest.replace(/[µμ]g/gi, "mcg").replace(new RegExp(`${NUM}\\s*%`, "gi"), " ")
  if (kind === "kcal") {
    const labeled = [...cleaned.matchAll(new RegExp(`${NUM}\\s*kcal\\b`, "gi"))].map((match) => ({
      value: plainNumber(match[1]),
      unit: "kcal",
    }))
    if (labeled.length) return labeled.filter((row) => Number.isFinite(row.value) && row.value >= 0)
    return [...cleaned.matchAll(new RegExp(`${NUM}(?!\\s*(?:kcal|kj)\\b)`, "gi"))]
      .map((match) => ({ value: plainNumber(match[1]), unit: "" }))
      .filter((row) => Number.isFinite(row.value) && row.value >= 0)
  }
  const allowed = kind === "g" ? "mg|g" : "mcg|ug|mg|g"
  return [...cleaned.matchAll(new RegExp(`<?\\s*${NUM}\\s*(${allowed})\\b`, "gi"))].map((match) => ({
    value: plainNumber(match[1]),
    unit: match[2].toLowerCase(),
  }))
}

function pickToken<T>(tokens: T[], index: number): T | null {
  if (tokens.length === 0) return null
  if (tokens.length === 1) return tokens[0]
  return tokens[index] ?? null
}

function tokenValue(kind: "kcal" | "g" | "mg" | "mcg", token: { value: number; unit: string }): number | null {
  if (!Number.isFinite(token.value) || token.value < 0) return null
  if (kind === "kcal") return cleanNutrient(token.value)
  if (kind === "g") return cleanNutrient(gramsOf(token))
  if (kind === "mg") return cleanNutrient(mgOf(token))
  return cleanNutrient(mcgOf(token))
}

function hasAny(row: LabelNutrients): boolean {
  return NUTRIENT_KEYS.some((key) => row[key] != null)
}

function readServingLine(text: string): { servingLabel: string; servingGrams: number | null } {
  const servingLine = /serving\s+size\s*[:\-]?\s*([^\n]+)/i.exec(text)
  if (!servingLine) return { servingLabel: "", servingGrams: null }
  const servingLabel = servingLine[1].trim()
  const gramsInParen = /\((\d+(?:\.\d+)?)\s*g\)/i.exec(servingLabel)
  const gramsBare = /(\d+(?:\.\d+)?)\s*g\b/i.exec(servingLabel)
  const grams = Number(gramsInParen?.[1] ?? gramsBare?.[1])
  return { servingLabel, servingGrams: Number.isFinite(grams) && grams > 0 ? grams : null }
}

function looksLikeName(line: string): boolean {
  if (!line || line.length > 80) return false
  if (/nutrition\s+(facts|information)\b/i.test(line)) return false
  if (/serving\s+size|servings?\s+per\s+container|amount\s+per\b|%\s*daily\s+value|ingredients\b|allergen\b/i.test(line)) return false
  if (/\d+(?:\.\d+)?\s*(?:kcal|mcg|mg|g)\b/i.test(line) && /calories|fat|carb|fiber|fibre|sugar|protein|sodium|vitamin|calcium|iron|potassium/i.test(line)) return false
  return true
}

function draftName(lines: string[]): string | null {
  const head = lines.findIndex((line) => /nutrition\s+(facts|information)\b/i.test(line))
  if (head > 0) {
    for (let i = head - 1; i >= 0; i--) {
      if (!lines[i]) continue
      return looksLikeName(lines[i]) ? lines[i] : null
    }
  }
  if (head < 0) return null
  for (let i = head + 1; i < lines.length; i++) {
    if (!lines[i]) continue
    if (/servings?\s+per\s+container/i.test(lines[i])) continue
    return looksLikeName(lines[i]) ? lines[i] : null
  }
  return null
}

/** A pasted Nutrition Facts panel, for the person to check before it is saved. */
export function parseLabelDraft(text: string): LabelDraft | null {
  const raw = text.replace(/\u00a0/g, " ").replace(/[|]/g, " ")
  if (!raw.trim()) return null
  const lines = raw.split(/\r?\n/).map((line) => line.replace(/[ \t]+/g, " ").trim())
  const buckets: Record<LabelBasis, LabelNutrients> = { serving: {}, "100g": {}, container: {} }
  let current: LabelBasis = "serving"
  let column = 0

  for (const line of lines) {
    if (!line || skipNutrientLine(line)) continue
    const dual = servingColumn(line)
    if (dual != null && !specFor(line)) {
      column = dual
      current = "serving"
      continue
    }
    if (isPer100Header(line)) {
      current = "100g"
      column = 0
    } else if (dual != null) {
      column = dual
      current = "serving"
    } else if (/amount\s+per\s+serving\b/i.test(line)) {
      current = "serving"
    } else if (isContainerHeader(line)) {
      current = "container"
      column = 0
    }
    const spec = specFor(line)
    if (!spec) continue
    const token = pickToken(tokensFor(spec.kind, restAfter(line, spec.test)), column)
    if (!token) continue
    const value = tokenValue(spec.kind, token)
    if (value == null) continue
    if (buckets[current][spec.key] == null) buckets[current][spec.key] = value
  }

  const basis: LabelBasis = hasAny(buckets["100g"]) ? "100g" : hasAny(buckets.serving) ? "serving" : hasAny(buckets.container) ? "container" : "serving"
  const nutrients = basis === "100g" ? buckets["100g"] : basis === "container" ? buckets.container : buckets.serving
  if (!hasAny(nutrients)) return null
  const serving = readServingLine(raw)
  return {
    name: draftName(lines),
    servingLabel: serving.servingLabel,
    servingGrams: serving.servingGrams,
    nutrients,
    basis,
  }
}

/** Per 100 g after a draft is checked. A per-100g panel is not scaled again. Missing lines become 0. */
export function labelDraftPer100g(draft: LabelDraft): Nutrients | null {
  const row = nutrientsFrom(draft.nutrients)
  if (draft.basis === "100g") return row
  if (draft.servingGrams == null) return null
  return labelPer100g({ servingLabel: draft.servingLabel, servingG: draft.servingGrams, perServing: row }, draft.servingGrams)
}
