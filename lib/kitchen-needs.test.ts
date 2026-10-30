import { beforeEach, describe, expect, it } from "vitest"
import {
  mifflinStJeor,
  nutrientNeeds,
  resetKitchenNeeds,
  toCentimeters,
  toKilograms,
  useKitchenNeeds,
  type BodyProfile,
  type NutrientNeeds,
} from "@/lib/kitchen-needs"
import type { NutrientKey } from "@/lib/kitchen-nutrients"

function line(needs: NutrientNeeds, key: NutrientKey) {
  return needs.lines.find((row) => row.key === key)
}

describe("kitchen nutrient needs", () => {
  beforeEach(() => {
    localStorage.clear()
    resetKitchenNeeds()
  })

  it("uses Mifflin–St Jeor and the adult reference tables for one known man", () => {
    // Man, 30 years, 180 cm, 80 kg.
    // Mifflin–St Jeor, Am J Clin Nutr 1990;51:241–7:
    // 10×80 + 6.25×180 − 5×30 + 5 = 1780 kcal resting energy.
    // Protein RDA 0.8 g/kg = 64 g. Carbohydrate RDA 130 g.
    // Fiber AI, men 19–50: 38 g. Fat AMDR 20–35% of 1780 kcal = 39.6–69.2 g.
    // Sodium AI 1500 mg and potassium AI 3400 mg (National Academies, 2019).
    // Men 19–30: calcium 1000 mg, iron 8 mg, vitamin C 90 mg, vitamin D 15 mcg,
    // vitamin A 900 mcg, vitamin E 15 mg, vitamin K 120 mcg, thiamin 1.2 mg,
    // riboflavin 1.3 mg, niacin 16 mg, pantothenic acid 5 mg, vitamin B6 1.3 mg,
    // folate 400 mcg, vitamin B12 2.4 mcg, choline 550 mg, magnesium 400 mg,
    // phosphorus 700 mg, zinc 11 mg, selenium 55 mcg, copper 0.9 mg,
    // manganese 2.3 mg, omega-3 1.6 g, omega-6 17 g.
    const resting = 10 * 80 + 6.25 * 180 - 5 * 30 + 5
    expect(resting).toBe(1780)
    expect(mifflinStJeor("male", 30, 180, 80)).toBe(1780)

    const profile: BodyProfile = {
      ageYears: 30,
      sex: "male",
      heightCm: 180,
      weightKg: 80,
      heightUnit: "cm",
      weightUnit: "kg",
    }
    const needs = nutrientNeeds(profile)
    expect(needs).not.toBeNull()
    if (!needs) return

    const reference: Partial<Record<NutrientKey, number>> = {
      kcal: 1780,
      proteinG: 64,
      carbG: 130,
      fiberG: 38,
      sodiumMg: 1500,
      potassiumMg: 3400,
      calciumMg: 1000,
      ironMg: 8,
      vitCMg: 90,
      vitDMcg: 15,
      vitAMcg: 900,
      vitEMg: 15,
      vitKMcg: 120,
      thiaminMg: 1.2,
      riboflavinMg: 1.3,
      niacinMg: 16,
      pantothenicMg: 5,
      vitB6Mg: 1.3,
      folateMcg: 400,
      vitB12Mcg: 2.4,
      cholineMg: 550,
      magnesiumMg: 400,
      phosphorusMg: 700,
      zincMg: 11,
      seleniumMcg: 55,
      copperMg: 0.9,
      manganeseMg: 2.3,
      omega3G: 1.6,
      omega6G: 17,
    }
    for (const [key, value] of Object.entries(reference) as [NutrientKey, number][]) {
      expect(line(needs, key)?.amount, key).toBe(value)
    }
    expect(line(needs, "fatG")).toMatchObject({ amount: null, low: 39.6, high: 69.2 })
    expect(line(needs, "sugarG")).toBeUndefined()
    expect(line(needs, "satFatG")).toBeUndefined()
    expect(line(needs, "cholesterolMg")).toBeUndefined()
    expect(line(needs, "betaCaroteneMcg")).toBeUndefined()
    expect(line(needs, "histidineG")).toBeUndefined()
    expect(needs.cite).toContain("Mifflin–St Jeor")
    expect(needs.cite).toContain("National Academies")
  })

  it("shows no figures when age, sex, height, or weight is missing", () => {
    expect(nutrientNeeds({ ageYears: null, sex: null, heightCm: null, weightKg: null, heightUnit: "cm", weightUnit: "kg" })).toBeNull()
    expect(
      nutrientNeeds({ ageYears: 30, sex: "male", heightCm: null, weightKg: 80, heightUnit: "cm", weightUnit: "kg" }),
    ).toBeNull()
  })

  it("does not apply the adult calorie equation under 19", () => {
    const needs = nutrientNeeds({
      ageYears: 10,
      sex: "male",
      heightCm: 140,
      weightKg: 35,
      heightUnit: "cm",
      weightUnit: "kg",
    })
    expect(needs).not.toBeNull()
    expect(line(needs!, "kcal")).toBeUndefined()
    expect(line(needs!, "fatG")).toBeUndefined()
    expect(line(needs!, "calciumMg")?.amount).toBe(1300)
    expect(line(needs!, "ironMg")?.amount).toBe(8)
  })

  it("stores height in centimeters and weight in kilograms", () => {
    expect(toCentimeters(70, "in")).toBe(177.8)
    expect(toCentimeters(180, "cm")).toBe(180)
    expect(toKilograms(80, "kg")).toBe(80)
    useKitchenNeeds.getState().write({
      ageYears: 30,
      sex: "female",
      heightCm: toCentimeters(65, "in"),
      weightKg: toKilograms(132, "lb"),
      heightUnit: "in",
      weightUnit: "lb",
    })
    const saved = useKitchenNeeds.getState().profile
    expect(saved.heightUnit).toBe("in")
    expect(saved.weightUnit).toBe("lb")
    expect(saved.heightCm).toBe(165.1)
    expect(saved.weightKg).toBeCloseTo(59.874, 3)
    expect(saved.sex).toBe("female")
    useKitchenNeeds.getState().write({ ageYears: null, sex: null, heightCm: null, weightKg: null })
    expect(useKitchenNeeds.getState().profile).toMatchObject({
      ageYears: null,
      sex: null,
      heightCm: null,
      weightKg: null,
    })
  })
})
