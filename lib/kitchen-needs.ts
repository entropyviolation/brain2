/**
 * lib/kitchen-needs.ts — Body profile and daily reference needs
 *
 * Storage: `brain2-kitchen-needs` (persist v1). Height is stored in centimeters
 * and weight in kilograms. The form may show inches or pounds.
 *
 * Calories are resting energy from Mifflin–St Jeor (Am J Clin Nutr 1990;51:241–7),
 * fitted on adults 19 and older:
 * men 10×kg + 6.25×cm − 5×age + 5, women the same minus 161.
 * Protein, carbohydrate, fiber, and the essential fatty acids follow the
 * Dietary Reference Intakes for macronutrients. Vitamins and minerals follow
 * the National Academies tables by age and sex. Sodium and potassium follow
 * the 2019 Adequate Intakes. A name with no reference intake is left off.
 * These are needs, not a budget and not a grade.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { NutrientKey } from "@/lib/kitchen-nutrients"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"

export const KITCHEN_NEEDS_KEY = persistKey("kitchen-needs")

export type BodySex = "female" | "male"
export type HeightUnit = "cm" | "in"
export type WeightUnit = "kg" | "lb"

export type BodyProfile = {
  ageYears: number | null
  sex: BodySex | null
  heightCm: number | null
  weightKg: number | null
  heightUnit: HeightUnit
  weightUnit: WeightUnit
}

export const EMPTY_BODY_PROFILE: BodyProfile = {
  ageYears: null,
  sex: null,
  heightCm: null,
  weightKg: null,
  heightUnit: "cm",
  weightUnit: "kg",
}

const CM_PER_IN = 2.54
const KG_PER_LB = 0.45359237

export type NeedGroup = "macro" | "micro" | "fatty" | "vitamin" | "mineral"

export type NeedLine = {
  key: NutrientKey
  group: NeedGroup
  amount: number | null
  low: number | null
  high: number | null
}

export type NutrientNeeds = {
  lines: NeedLine[]
  cite: string
}

type Band = "1-3" | "4-8" | "9-13" | "14-18" | "19-30" | "31-50" | "51-70" | "71+"
type Pair = readonly [female: number, male: number]

const ADULT_CITE =
  "Calories are resting energy from the Mifflin–St Jeor equation (1990). It uses age, sex, height, and weight, and it is not a day of activity. Protein is the Recommended Dietary Allowance in grams per kilogram. Carbohydrate is the Recommended Dietary Allowance. Fiber and the omega lines are Adequate Intakes. Fat is the Acceptable Macronutrient Distribution Range, 20–35% of this resting energy, written as grams. Vitamins and minerals are Recommended Dietary Allowances or Adequate Intakes from the National Academies tables by age and sex. Sodium and potassium are the 2019 Adequate Intakes. A name with no reference intake is left off. These are needs, not a budget and not a grade."

const YOUNG_CITE =
  "The Mifflin–St Jeor equation used here was fitted on adults 19 and older, so this age has no calorie figure. Protein is the Recommended Dietary Allowance in grams per kilogram. Carbohydrate is the Recommended Dietary Allowance. Fiber and the omega lines are Adequate Intakes. Vitamins and minerals are Recommended Dietary Allowances or Adequate Intakes from the National Academies tables by age and sex. Sodium and potassium are the 2019 Adequate Intakes. A name with no reference intake is left off. These are needs, not a budget and not a grade."

function same(n: number): Pair {
  return [n, n]
}

function bandFor(age: number): Band | null {
  if (!Number.isInteger(age) || age < 1 || age > 120) return null
  if (age <= 3) return "1-3"
  if (age <= 8) return "4-8"
  if (age <= 13) return "9-13"
  if (age <= 18) return "14-18"
  if (age <= 30) return "19-30"
  if (age <= 50) return "31-50"
  if (age <= 70) return "51-70"
  return "71+"
}

function at(table: Record<Band, Pair>, band: Band, sex: BodySex): number {
  const pair = table[band]
  return sex === "female" ? pair[0] : pair[1]
}

const PROTEIN_G_PER_KG: Record<Band, number> = {
  "1-3": 1.05,
  "4-8": 0.95,
  "9-13": 0.95,
  "14-18": 0.85,
  "19-30": 0.8,
  "31-50": 0.8,
  "51-70": 0.8,
  "71+": 0.8,
}

const FIBER_G: Record<Band, Pair> = {
  "1-3": same(19),
  "4-8": same(25),
  "9-13": [26, 31],
  "14-18": [26, 38],
  "19-30": [25, 38],
  "31-50": [25, 38],
  "51-70": [21, 30],
  "71+": [21, 30],
}

const SODIUM_MG: Record<Band, Pair> = {
  "1-3": same(800),
  "4-8": same(1000),
  "9-13": same(1200),
  "14-18": same(1500),
  "19-30": same(1500),
  "31-50": same(1500),
  "51-70": same(1500),
  "71+": same(1500),
}

const POTASSIUM_MG: Record<Band, Pair> = {
  "1-3": same(2000),
  "4-8": same(2300),
  "9-13": [2300, 2500],
  "14-18": [2300, 3000],
  "19-30": [2600, 3400],
  "31-50": [2600, 3400],
  "51-70": [2600, 3400],
  "71+": [2600, 3400],
}

const CALCIUM_MG: Record<Band, Pair> = {
  "1-3": same(700),
  "4-8": same(1000),
  "9-13": same(1300),
  "14-18": same(1300),
  "19-30": same(1000),
  "31-50": same(1000),
  "51-70": [1200, 1000],
  "71+": same(1200),
}

const IRON_MG: Record<Band, Pair> = {
  "1-3": same(7),
  "4-8": same(10),
  "9-13": same(8),
  "14-18": [15, 11],
  "19-30": [18, 8],
  "31-50": [18, 8],
  "51-70": same(8),
  "71+": same(8),
}

const VIT_C_MG: Record<Band, Pair> = {
  "1-3": same(15),
  "4-8": same(25),
  "9-13": same(45),
  "14-18": [65, 75],
  "19-30": [75, 90],
  "31-50": [75, 90],
  "51-70": [75, 90],
  "71+": [75, 90],
}

const VIT_D_MCG: Record<Band, Pair> = {
  "1-3": same(15),
  "4-8": same(15),
  "9-13": same(15),
  "14-18": same(15),
  "19-30": same(15),
  "31-50": same(15),
  "51-70": same(15),
  "71+": same(20),
}

const VIT_A_MCG: Record<Band, Pair> = {
  "1-3": same(300),
  "4-8": same(400),
  "9-13": same(600),
  "14-18": [700, 900],
  "19-30": [700, 900],
  "31-50": [700, 900],
  "51-70": [700, 900],
  "71+": [700, 900],
}

const VIT_E_MG: Record<Band, Pair> = {
  "1-3": same(6),
  "4-8": same(7),
  "9-13": same(11),
  "14-18": same(15),
  "19-30": same(15),
  "31-50": same(15),
  "51-70": same(15),
  "71+": same(15),
}

const VIT_K_MCG: Record<Band, Pair> = {
  "1-3": same(30),
  "4-8": same(55),
  "9-13": same(60),
  "14-18": same(75),
  "19-30": [90, 120],
  "31-50": [90, 120],
  "51-70": [90, 120],
  "71+": [90, 120],
}

const THIAMIN_MG: Record<Band, Pair> = {
  "1-3": same(0.5),
  "4-8": same(0.6),
  "9-13": same(0.9),
  "14-18": [1, 1.2],
  "19-30": [1.1, 1.2],
  "31-50": [1.1, 1.2],
  "51-70": [1.1, 1.2],
  "71+": [1.1, 1.2],
}

const RIBOFLAVIN_MG: Record<Band, Pair> = {
  "1-3": same(0.5),
  "4-8": same(0.6),
  "9-13": same(0.9),
  "14-18": [1, 1.3],
  "19-30": [1.1, 1.3],
  "31-50": [1.1, 1.3],
  "51-70": [1.1, 1.3],
  "71+": [1.1, 1.3],
}

const NIACIN_MG: Record<Band, Pair> = {
  "1-3": same(6),
  "4-8": same(8),
  "9-13": same(12),
  "14-18": [14, 16],
  "19-30": [14, 16],
  "31-50": [14, 16],
  "51-70": [14, 16],
  "71+": [14, 16],
}

const PANTOTHENIC_MG: Record<Band, Pair> = {
  "1-3": same(2),
  "4-8": same(3),
  "9-13": same(4),
  "14-18": same(5),
  "19-30": same(5),
  "31-50": same(5),
  "51-70": same(5),
  "71+": same(5),
}

const VIT_B6_MG: Record<Band, Pair> = {
  "1-3": same(0.5),
  "4-8": same(0.6),
  "9-13": same(1),
  "14-18": [1.2, 1.3],
  "19-30": same(1.3),
  "31-50": same(1.3),
  "51-70": [1.5, 1.7],
  "71+": [1.5, 1.7],
}

const FOLATE_MCG: Record<Band, Pair> = {
  "1-3": same(150),
  "4-8": same(200),
  "9-13": same(300),
  "14-18": same(400),
  "19-30": same(400),
  "31-50": same(400),
  "51-70": same(400),
  "71+": same(400),
}

const VIT_B12_MCG: Record<Band, Pair> = {
  "1-3": same(0.9),
  "4-8": same(1.2),
  "9-13": same(1.8),
  "14-18": same(2.4),
  "19-30": same(2.4),
  "31-50": same(2.4),
  "51-70": same(2.4),
  "71+": same(2.4),
}

const CHOLINE_MG: Record<Band, Pair> = {
  "1-3": same(200),
  "4-8": same(250),
  "9-13": same(375),
  "14-18": [400, 550],
  "19-30": [425, 550],
  "31-50": [425, 550],
  "51-70": [425, 550],
  "71+": [425, 550],
}

const MAGNESIUM_MG: Record<Band, Pair> = {
  "1-3": same(80),
  "4-8": same(130),
  "9-13": same(240),
  "14-18": [360, 410],
  "19-30": [310, 400],
  "31-50": [320, 420],
  "51-70": [320, 420],
  "71+": [320, 420],
}

const PHOSPHORUS_MG: Record<Band, Pair> = {
  "1-3": same(460),
  "4-8": same(500),
  "9-13": same(1250),
  "14-18": same(1250),
  "19-30": same(700),
  "31-50": same(700),
  "51-70": same(700),
  "71+": same(700),
}

const ZINC_MG: Record<Band, Pair> = {
  "1-3": same(3),
  "4-8": same(5),
  "9-13": same(8),
  "14-18": [9, 11],
  "19-30": [8, 11],
  "31-50": [8, 11],
  "51-70": [8, 11],
  "71+": [8, 11],
}

const SELENIUM_MCG: Record<Band, Pair> = {
  "1-3": same(20),
  "4-8": same(30),
  "9-13": same(40),
  "14-18": same(55),
  "19-30": same(55),
  "31-50": same(55),
  "51-70": same(55),
  "71+": same(55),
}

const COPPER_MG: Record<Band, Pair> = {
  "1-3": same(0.34),
  "4-8": same(0.44),
  "9-13": same(0.7),
  "14-18": same(0.89),
  "19-30": same(0.9),
  "31-50": same(0.9),
  "51-70": same(0.9),
  "71+": same(0.9),
}

const MANGANESE_MG: Record<Band, Pair> = {
  "1-3": same(1.2),
  "4-8": same(1.5),
  "9-13": [1.6, 1.9],
  "14-18": [1.6, 2.2],
  "19-30": [1.8, 2.3],
  "31-50": [1.8, 2.3],
  "51-70": [1.8, 2.3],
  "71+": [1.8, 2.3],
}

const OMEGA3_G: Record<Band, Pair> = {
  "1-3": same(0.7),
  "4-8": same(0.9),
  "9-13": [1, 1.2],
  "14-18": [1.1, 1.6],
  "19-30": [1.1, 1.6],
  "31-50": [1.1, 1.6],
  "51-70": [1.1, 1.6],
  "71+": [1.1, 1.6],
}

const OMEGA6_G: Record<Band, Pair> = {
  "1-3": same(7),
  "4-8": same(10),
  "9-13": [10, 12],
  "14-18": [11, 16],
  "19-30": [12, 17],
  "31-50": [12, 17],
  "51-70": [11, 14],
  "71+": [11, 14],
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function amount(key: NutrientKey, group: NeedGroup, value: number): NeedLine {
  return { key, group, amount: value, low: null, high: null }
}

/** Resting energy, kcal/day. The equation applies from age 19. */
export function mifflinStJeor(sex: BodySex, ageYears: number, heightCm: number, weightKg: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears
  return Math.round(sex === "male" ? base + 5 : base - 161)
}

export function toCentimeters(value: number, unit: HeightUnit): number | null {
  if (!Number.isFinite(value) || value <= 0) return null
  const cm = unit === "cm" ? value : value * CM_PER_IN
  return Math.round(cm * 100) / 100
}

export function toKilograms(value: number, unit: WeightUnit): number | null {
  if (!Number.isFinite(value) || value <= 0) return null
  const kg = unit === "kg" ? value : value * KG_PER_LB
  return Math.round(kg * 1000) / 1000
}

export function fromCentimeters(cm: number, unit: HeightUnit): number {
  return unit === "cm" ? cm : cm / CM_PER_IN
}

export function fromKilograms(kg: number, unit: WeightUnit): number {
  return unit === "kg" ? kg : kg / KG_PER_LB
}

export function formatMeasure(value: number): string {
  return String(Math.round(value * 100) / 100)
}

function profileReady(profile: BodyProfile): profile is BodyProfile & {
  ageYears: number
  sex: BodySex
  heightCm: number
  weightKg: number
} {
  return (
    profile.ageYears != null &&
    profile.sex != null &&
    profile.heightCm != null &&
    profile.weightKg != null &&
    bandFor(profile.ageYears) != null &&
    profile.heightCm >= 40 &&
    profile.heightCm <= 272 &&
    profile.weightKg >= 2 &&
    profile.weightKg <= 400
  )
}

/** Daily reference needs for a complete profile. Null when age, sex, height, or weight is missing or out of the tables. */
export function nutrientNeeds(profile: BodyProfile): NutrientNeeds | null {
  if (!profileReady(profile)) return null
  const band = bandFor(profile.ageYears)
  if (!band) return null
  const sex = profile.sex
  const adult = profile.ageYears >= 19
  const kcal = adult ? mifflinStJeor(sex, profile.ageYears, profile.heightCm, profile.weightKg) : null
  const lines: NeedLine[] = []
  if (kcal != null) lines.push(amount("kcal", "macro", kcal))
  lines.push(amount("proteinG", "macro", round1(PROTEIN_G_PER_KG[band] * profile.weightKg)))
  lines.push(amount("carbG", "macro", 130))
  if (kcal != null) {
    lines.push({
      key: "fatG",
      group: "macro",
      amount: null,
      low: round1((kcal * 0.2) / 9),
      high: round1((kcal * 0.35) / 9),
    })
  }
  lines.push(amount("fiberG", "macro", at(FIBER_G, band, sex)))
  lines.push(amount("omega3G", "fatty", at(OMEGA3_G, band, sex)))
  lines.push(amount("omega6G", "fatty", at(OMEGA6_G, band, sex)))
  lines.push(amount("sodiumMg", "micro", at(SODIUM_MG, band, sex)))
  lines.push(amount("potassiumMg", "micro", at(POTASSIUM_MG, band, sex)))
  lines.push(amount("calciumMg", "micro", at(CALCIUM_MG, band, sex)))
  lines.push(amount("ironMg", "micro", at(IRON_MG, band, sex)))
  lines.push(amount("vitCMg", "micro", at(VIT_C_MG, band, sex)))
  lines.push(amount("vitDMcg", "micro", at(VIT_D_MCG, band, sex)))
  lines.push(amount("vitAMcg", "vitamin", at(VIT_A_MCG, band, sex)))
  lines.push(amount("vitEMg", "vitamin", at(VIT_E_MG, band, sex)))
  lines.push(amount("vitKMcg", "vitamin", at(VIT_K_MCG, band, sex)))
  lines.push(amount("thiaminMg", "vitamin", at(THIAMIN_MG, band, sex)))
  lines.push(amount("riboflavinMg", "vitamin", at(RIBOFLAVIN_MG, band, sex)))
  lines.push(amount("niacinMg", "vitamin", at(NIACIN_MG, band, sex)))
  lines.push(amount("pantothenicMg", "vitamin", at(PANTOTHENIC_MG, band, sex)))
  lines.push(amount("vitB6Mg", "vitamin", at(VIT_B6_MG, band, sex)))
  lines.push(amount("folateMcg", "vitamin", at(FOLATE_MCG, band, sex)))
  lines.push(amount("vitB12Mcg", "vitamin", at(VIT_B12_MCG, band, sex)))
  lines.push(amount("cholineMg", "vitamin", at(CHOLINE_MG, band, sex)))
  lines.push(amount("magnesiumMg", "mineral", at(MAGNESIUM_MG, band, sex)))
  lines.push(amount("phosphorusMg", "mineral", at(PHOSPHORUS_MG, band, sex)))
  lines.push(amount("zincMg", "mineral", at(ZINC_MG, band, sex)))
  lines.push(amount("seleniumMcg", "mineral", at(SELENIUM_MCG, band, sex)))
  lines.push(amount("copperMg", "mineral", at(COPPER_MG, band, sex)))
  lines.push(amount("manganeseMg", "mineral", at(MANGANESE_MG, band, sex)))
  return { lines, cite: adult ? ADULT_CITE : YOUNG_CITE }
}

function cleanAge(value: unknown): number | null {
  if (value == null || value === "") return null
  const age = typeof value === "number" ? value : Number(value)
  if (!Number.isInteger(age) || age < 0 || age > 130) return null
  return age
}

function cleanProfile(raw: unknown): BodyProfile {
  if (!raw || typeof raw !== "object") return { ...EMPTY_BODY_PROFILE }
  const body = raw as Record<string, unknown>
  const height = Number(body.heightCm)
  const weight = Number(body.weightKg)
  return {
    ageYears: cleanAge(body.ageYears),
    sex: body.sex === "female" || body.sex === "male" ? body.sex : null,
    heightCm: Number.isFinite(height) && height > 0 && height < 400 ? Math.round(height * 100) / 100 : null,
    weightKg: Number.isFinite(weight) && weight > 0 && weight < 600 ? Math.round(weight * 1000) / 1000 : null,
    heightUnit: body.heightUnit === "in" ? "in" : "cm",
    weightUnit: body.weightUnit === "lb" ? "lb" : "kg",
  }
}

interface NeedsState {
  profile: BodyProfile
  write: (patch: Partial<BodyProfile>) => void
}

export const useKitchenNeeds = create<NeedsState>()(
  persist(
    (set) => ({
      profile: { ...EMPTY_BODY_PROFILE },
      write: (patch) => {
        set((state) => ({ profile: cleanProfile({ ...state.profile, ...patch }) }))
      },
    }),
    {
      name: KITCHEN_NEEDS_KEY,
      version: 1,
      storage: createCogsJSONStorage(),
      partialize: (state) => ({ profile: state.profile }),
      merge: (persisted, current) => {
        const body = (persisted ?? {}) as { profile?: unknown }
        return { ...current, profile: cleanProfile(body.profile) }
      },
    },
  ),
)

/** Tests: drop the in-memory profile and the persisted key. */
export function resetKitchenNeeds(): void {
  useKitchenNeeds.setState({ profile: { ...EMPTY_BODY_PROFILE } })
  if (typeof localStorage === "undefined") return
  try {
    localStorage.removeItem(KITCHEN_NEEDS_KEY)
  } catch {
    /* the test double may refuse */
  }
}
