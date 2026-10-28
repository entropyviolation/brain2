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
import { LabelCapture } from "@/components/Home/Tracking/tracking-log/food/food-label-paste"
import { formatNutrient, NUTRIENT_FACE, type Nutrients } from "@/lib/kitchen-nutrients"
import { searchFoodsOnline, searchLocalFoods, type FoodHit } from "@/lib/kitchen-search"
import { useKitchenStore } from "@/lib/kitchen-store"

export function NutrientGrid({ row, heading }: { row: Nutrients; heading?: string }) {
  const macros = NUTRIENT_FACE.filter((face) => face.group === "macro")
  const micros = NUTRIENT_FACE.filter((face) => face.group === "micro")
  return (
    <div className="trk-food-nuts">
      {heading ? <h4>{heading}</h4> : null}
      <NutrientList title="Macros" faces={macros} row={row} />
      <NutrientList title="Micros" faces={micros} row={row} />
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
                {hit.name}
                {" "}
                <small>{hit.source === "catalog" || hit.source === "custom" ? "On this device" : hit.source === "usda" ? "USDA" : hit.source === "off" ? "Open Food Facts" : "Label"}</small>
              </button>
            </li>
          ))}
        </ul>
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
