"use client"

/**
 * components/Home/Tracking/tracking-log/food/food-bits.tsx — Nutrient grid, search, label photo
 *
 * Search shows foods on this device at once, then USDA FoodData Central, then
 * Open Food Facts. A barcode scan sits with that search. A nutrition-label
 * photo or pasted label text is read locally; the numbers stay editable
 * before they become a food (`food-label-paste.tsx`).
 */

import { useEffect, useMemo, useState } from "react"
import { FoodBarcodeScan } from "@/components/Home/Tracking/tracking-log/food/food-barcode-scan"
import { FoodCreateSheet } from "@/components/Home/Tracking/tracking-log/food/food-create-sheet"
import { LabelCapture } from "@/components/Home/Tracking/tracking-log/food/food-label-paste"
import { formatNutrient, LAB_GROUPS, labGroupHasAny, netCarbs, NUTRIENT_FACE, NUTRIENT_LAB, type Nutrients } from "@/lib/kitchen-nutrients"
import { searchFoodsOnline, searchLocalFoods, type FoodHit } from "@/lib/kitchen-search"
import { useKitchenStore } from "@/lib/kitchen-store"
import type { FoodSource } from "@/lib/kitchen-types"

function sourceWords(source: FoodSource | FoodHit["source"]): string {
  if (source === "catalog" || source === "custom") return "On this device"
  if (source === "usda") return "USDA"
  if (source === "off") return "Open Food Facts"
  return "Label"
}

function servingKcal(kcalPer100: number, gramsPerUnit: number): string {
  const grams = gramsPerUnit > 0 ? gramsPerUnit : 100
  return formatNutrient("kcal", (kcalPer100 * grams) / 100)
}

function HitLine({
  name,
  source,
  kcalPer100,
  gramsPerUnit,
}: {
  name: string
  source: FoodSource | FoodHit["source"]
  kcalPer100: number
  gramsPerUnit: number
}) {
  return (
    <>
      <span className="trk-food-hit-name">
        {name}
        {source === "usda" ? (
          <span className="trk-food-verified" aria-hidden="true">
            {" "}
            ✓
          </span>
        ) : null}
      </span>
      {source === "usda" ? <span className="trk-food-verified-word">Verified</span> : null}
      <small>{sourceWords(source)}</small>
      <small className="trk-food-hit-kcal">{servingKcal(kcalPer100, gramsPerUnit)}</small>
    </>
  )
}

/** Protein, fat, and carbs as a mix of this calorie figure. Not a target. */
export function MacroShare({ row, scope }: { row: Nutrients; scope?: string }) {
  const kcal = row.kcal
  const parts = [
    { id: "protein", label: "Protein", grams: formatNutrient("proteinG", row.proteinG), energy: row.proteinG * 4 },
    { id: "fat", label: "Fat", grams: formatNutrient("fatG", row.fatG), energy: row.fatG * 9 },
    { id: "carb", label: "Carbs", grams: formatNutrient("carbG", row.carbG), energy: row.carbG * 4 },
  ]
  const used = parts.reduce((sum, part) => sum + part.energy, 0)
  const factor = kcal > 0 && used > kcal ? kcal / used : 1
  const share = (energy: number) => (kcal > 0 ? Math.round((energy / kcal) * 100) : 0)
  return (
    <div className="trk-food-share">
      <p>Share of these calories</p>
      {scope ? <p className="trk-food-share-scope">{scope}</p> : null}
      <div className="trk-food-share-bar" aria-hidden="true">
        {parts.map((part) => (
          <span
            key={part.id}
            data-part={part.id}
            style={{ width: `${kcal > 0 ? (part.energy * factor / kcal) * 100 : 0}%` }}
          />
        ))}
      </div>
      <ul>
        {parts.map((part) => (
          <li key={part.id}>
            {part.label} {part.grams} · {share(part.energy)}%
          </li>
        ))}
      </ul>
    </div>
  )
}

export function NutrientGrid({ row, heading }: { row: Nutrients; heading?: string }) {
  const [more, setMore] = useState(false)
  const macros = NUTRIENT_FACE.filter((face) => face.group === "macro")
  const micros = NUTRIENT_FACE.filter((face) => face.group === "micro")
  return (
    <div className="trk-food-nuts">
      {heading ? <h4>{heading}</h4> : null}
      <NutrientList title="Macros" faces={macros} row={row} />
      <NutrientList title="Micros" faces={micros} row={row} />
      <div className="trk-food-caps">
        <button type="button" data-no95="" className="trk-keycap" aria-pressed={more} onClick={() => setMore((open) => !open)}>
          More
        </button>
      </div>
      {more ? (
        <div className="trk-food-profile">
          <p className="trk-food-subtotal">Net carbs {netCarbs(row)} g</p>
          {LAB_GROUPS.map((group) => (
            <section key={group.id} aria-label={group.title}>
              <p>{group.title}</p>
              {labGroupHasAny(row, group.id) ? (
                <dl>
                  {NUTRIENT_LAB.filter((face) => face.group === group.id).map((face) => (
                    <div key={face.key}>
                      <dt>{face.label}</dt>
                      <dd>{formatNutrient(face.key, row[face.key])}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="trk-food-status">None on this row.</p>
              )}
            </section>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function NutrientList({
  title,
  faces,
  row,
}: {
  title: string
  faces: typeof NUTRIENT_FACE
  row: Nutrients
}) {
  return (
    <section aria-label={title}>
      <p>{title}</p>
      <dl>
        {faces.map((face) => (
          <div key={face.key}>
            <dt>{face.label}</dt>
            <dd>{formatNutrient(face.key, row[face.key])}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function FoodSearch({ onPick, label = "Search foods" }: { onPick: (hit: FoodHit) => void; label?: string }) {
  const foods = useKitchenStore((s) => s.foods)
  const [query, setQuery] = useState("")
  const [online, setOnline] = useState<FoodHit[]>([])
  const [status, setStatus] = useState("")
  const [creating, setCreating] = useState(false)
  const local = useMemo(() => searchLocalFoods(query, foods), [query, foods])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setOnline([])
      setStatus("")
      return
    }
    let dead = false
    const timer = window.setTimeout(() => {
      setStatus("Searching USDA FoodData Central…")
      void searchFoodsOnline(q).then((hits) => {
        if (dead) return
        setOnline(hits)
        setStatus(hits.length ? "" : "Nothing further on the food search. The foods on this device are still listed.")
      })
    }, 350)
    return () => {
      dead = true
      window.clearTimeout(timer)
    }
  }, [query])

  const seen = new Set(local.map((hit) => hit.name.toLowerCase()))
  const extra = online.filter((hit) => !seen.has(hit.name.toLowerCase()))

  return (
    <>
    <div className="trk-food-search">
      <label>
        {label}
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="oats, banana, a brand" />
      </label>
      {status ? <p className="trk-food-status">{status}</p> : null}
      {local.length + extra.length > 0 ? (
        <ul>
          {[...local, ...extra].map((hit) => (
            <li key={hit.id}>
              <button type="button" onClick={() => onPick(hit)}>
                <HitLine name={hit.name} source={hit.source} kcalPer100={hit.per100g.kcal} gramsPerUnit={hit.gramsPerUnit} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {query.trim() === "" && foods.some((food) => food.pinned && !food.retired) ? (
        <ul aria-label="Pinned foods">
          {foods.filter((food) => food.pinned && !food.retired).map((food) => (
            <li key={food.id}>
              <button
                type="button"
                onClick={() =>
                  onPick({
                    id: food.id,
                    name: food.name,
                    per100g: food.per100g,
                    gramsPerUnit: food.gramsPerUnit,
                    source: food.source,
                  })
                }
              >
                <HitLine name={food.name} source={food.source} kcalPer100={food.per100g.kcal} gramsPerUnit={food.gramsPerUnit} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {query.trim().length >= 2 && !status.startsWith("Searching") && local.length + extra.length === 0 ? (
        <div className="trk-food-caps">
          <button type="button" data-no95="" className="trk-keycap" onClick={() => setCreating(true)}>
            Create saved food
          </button>
        </div>
      ) : null}
      {creating ? (
        <FoodCreateSheet
          initialName={query}
          onCancel={() => setCreating(false)}
          onSaved={(food) => {
            setCreating(false)
            onPick({
              id: food.id,
              name: food.name,
              per100g: food.per100g,
              gramsPerUnit: food.gramsPerUnit,
              source: food.source,
            })
          }}
        />
      ) : null}
    </div>
    <FoodBarcodeScan onPick={onPick} />
    </>
  )
}

export function LabelPhoto({
  onUse,
}: {
  onUse: (draft: { name: string; per100g: Nutrients; grams: number; barcode?: string }) => void
}) {
  return <LabelCapture onUse={onUse} />
}
