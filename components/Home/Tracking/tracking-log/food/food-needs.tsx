"use client"

/**
 * components/Home/Tracking/tracking-log/food/food-needs.tsx — Body profile for nutrient needs
 *
 * Age, sex, height, and weight stay on the diary. Height is stored in
 * centimeters and weight in kilograms. An empty profile shows no figures.
 */

import { useEffect, useState } from "react"
import { formatNutrient, NUTRIENT_FACE, NUTRIENT_LAB, type NutrientKey } from "@/lib/kitchen-nutrients"
import {
  formatMeasure,
  fromCentimeters,
  fromKilograms,
  nutrientNeeds,
  toCentimeters,
  toKilograms,
  useKitchenNeeds,
  type BodySex,
  type HeightUnit,
  type NeedGroup,
  type NeedLine,
  type WeightUnit,
} from "@/lib/kitchen-needs"
import "./food-needs.css"

const GROUPS: { id: NeedGroup; title: string }[] = [
  { id: "macro", title: "Macros" },
  { id: "micro", title: "Micros" },
  { id: "fatty", title: "Fatty acids" },
  { id: "vitamin", title: "Vitamins" },
  { id: "mineral", title: "Minerals" },
]

function labelFor(key: NutrientKey): string {
  return NUTRIENT_FACE.find((face) => face.key === key)?.label ?? NUTRIENT_LAB.find((face) => face.key === key)?.label ?? key
}

function needText(line: NeedLine): string {
  if (line.low != null && line.high != null) {
    const low = formatNutrient(line.key, line.low)
    const high = formatNutrient(line.key, line.high)
    const lowN = low.slice(0, low.lastIndexOf(" "))
    const unit = high.slice(high.lastIndexOf(" ") + 1)
    const highN = high.slice(0, high.lastIndexOf(" "))
    return `${lowN}–${highN} ${unit}`
  }
  return formatNutrient(line.key, line.amount ?? 0)
}

function syncMeasure(
  prev: string,
  stored: number | null,
  toStore: (value: number) => number | null,
  fromStore: (value: number) => number,
): string {
  if (stored == null) return prev.trim() === "" ? prev : ""
  const parsed = Number(prev)
  if (prev.trim() !== "" && Number.isFinite(parsed) && toStore(parsed) === stored) return prev
  return formatMeasure(fromStore(stored))
}

export function FoodNeeds() {
  const profile = useKitchenNeeds((s) => s.profile)
  const write = useKitchenNeeds((s) => s.write)
  const needs = nutrientNeeds(profile)
  const [ageText, setAgeText] = useState("")
  const [heightText, setHeightText] = useState("")
  const [weightText, setWeightText] = useState("")

  useEffect(() => {
    setAgeText((prev) => {
      if (profile.ageYears == null) return prev.trim() === "" ? prev : ""
      const parsed = Number(prev)
      if (prev.trim() !== "" && Number.isInteger(parsed) && parsed === profile.ageYears) return prev
      return String(profile.ageYears)
    })
  }, [profile.ageYears])

  useEffect(() => {
    setHeightText((prev) =>
      syncMeasure(
        prev,
        profile.heightCm,
        (value) => toCentimeters(value, profile.heightUnit),
        (value) => fromCentimeters(value, profile.heightUnit),
      ),
    )
  }, [profile.heightCm, profile.heightUnit])

  useEffect(() => {
    setWeightText((prev) =>
      syncMeasure(
        prev,
        profile.weightKg,
        (value) => toKilograms(value, profile.weightUnit),
        (value) => fromKilograms(value, profile.weightUnit),
      ),
    )
  }, [profile.weightKg, profile.weightUnit])

  function onAge(value: string) {
    setAgeText(value)
    if (value.trim() === "") {
      write({ ageYears: null })
      return
    }
    const n = Number(value)
    if (Number.isInteger(n) && n >= 0 && n <= 130) write({ ageYears: n })
  }

  function onHeight(value: string) {
    setHeightText(value)
    if (value.trim() === "") {
      write({ heightCm: null })
      return
    }
    const n = Number(value)
    const cm = toCentimeters(n, profile.heightUnit)
    if (cm != null) write({ heightCm: cm })
  }

  function onWeight(value: string) {
    setWeightText(value)
    if (value.trim() === "") {
      write({ weightKg: null })
      return
    }
    const n = Number(value)
    const kg = toKilograms(n, profile.weightUnit)
    if (kg != null) write({ weightKg: kg })
  }

  function chooseSex(sex: BodySex) {
    write({ sex })
  }

  function chooseHeightUnit(unit: HeightUnit) {
    write({ heightUnit: unit })
  }

  function chooseWeightUnit(unit: WeightUnit) {
    write({ weightUnit: unit })
  }

  return (
    <section className="trk-food-needs" aria-label="Needs">
      <h4>Needs</h4>
      <p className="trk-food-needs-lead">
        Age, sex, height, and weight are what these figures use. Sex is the column in the reference tables.
      </p>
      <div className="trk-food-needs-fields">
        <label>
          Age
          <input inputMode="numeric" value={ageText} onChange={(event) => onAge(event.target.value)} />
        </label>
        <div className="trk-food-needs-sex" role="group" aria-label="Sex">
          <span>Sex</span>
          <div className="trk-food-caps">
            <button type="button" data-no95="" className="trk-keycap" aria-pressed={profile.sex === "female"} onClick={() => chooseSex("female")}>
              Female
            </button>
            <button type="button" data-no95="" className="trk-keycap" aria-pressed={profile.sex === "male"} onClick={() => chooseSex("male")}>
              Male
            </button>
          </div>
        </div>
        <div className="trk-food-needs-measure">
          <label>
            Height
            <input inputMode="decimal" value={heightText} onChange={(event) => onHeight(event.target.value)} />
          </label>
          <div className="trk-food-caps" role="group" aria-label="Height unit">
            <button type="button" data-no95="" className="trk-keycap" aria-pressed={profile.heightUnit === "cm"} onClick={() => chooseHeightUnit("cm")}>
              cm
            </button>
            <button type="button" data-no95="" className="trk-keycap" aria-pressed={profile.heightUnit === "in"} onClick={() => chooseHeightUnit("in")}>
              in
            </button>
          </div>
        </div>
        <div className="trk-food-needs-measure">
          <label>
            Weight
            <input inputMode="decimal" value={weightText} onChange={(event) => onWeight(event.target.value)} />
          </label>
          <div className="trk-food-caps" role="group" aria-label="Weight unit">
            <button type="button" data-no95="" className="trk-keycap" aria-pressed={profile.weightUnit === "kg"} onClick={() => chooseWeightUnit("kg")}>
              kg
            </button>
            <button type="button" data-no95="" className="trk-keycap" aria-pressed={profile.weightUnit === "lb"} onClick={() => chooseWeightUnit("lb")}>
              lb
            </button>
          </div>
        </div>
      </div>
      {needs ? (
        <div className="trk-food-needs-figures">
          {GROUPS.map((group) => {
            const rows = needs.lines.filter((row) => row.group === group.id)
            if (rows.length === 0) return null
            return (
              <section key={group.id} aria-label={group.title}>
                <p>{group.title}</p>
                <dl>
                  {rows.map((row) => (
                    <div key={row.key}>
                      <dt>{labelFor(row.key)}</dt>
                      <dd>{needText(row)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )
          })}
          <p className="trk-food-needs-cite">{needs.cite}</p>
        </div>
      ) : null}
    </section>
  )
}
