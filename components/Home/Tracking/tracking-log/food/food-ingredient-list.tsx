"use client"

/**
 * components/Home/Tracking/tracking-log/food/food-ingredient-list.tsx — Name a dish from a list
 *
 * The lines are parsed. A food already on this device is matched at once.
 * USDA, then Open Food Facts, still run, so a brand can sit beside that match.
 * Look up searches again. Grams from a weight or a spoon are filled in. A
 * slice, a count, or a bare name stays empty until the grams are entered. A
 * serving from the match can fill that box.
 */

import { useRef, useState } from "react"
import {
  gatherIngredientHits,
  gramsFromMeasure,
  ingredientHits,
  measureIsAbout,
  measurePhrase,
  parseIngredientList,
  type MeasureUnit,
  type ParsedIngredient,
} from "@/lib/kitchen-ingredient-list"
import type { FoodHit } from "@/lib/kitchen-search"
import { useKitchenStore } from "@/lib/kitchen-store"

export interface PickedIngredient {
  hit: FoodHit
  grams: number
}

interface Draft {
  id: string
  raw: string
  query: string
  quantity: number | null
  unit: MeasureUnit | null
  grams: string
  hits: FoodHit[]
  pickedId: string
  status: string
}

function sourceLabel(source: FoodHit["source"]): string {
  if (source === "catalog" || source === "custom") return "On this device"
  if (source === "usda") return "USDA"
  if (source === "off") return "Open Food Facts"
  return "Label"
}

function draftFrom(row: ParsedIngredient, index: number, foods: ReturnType<typeof useKitchenStore.getState>["foods"]): Draft {
  const hits = ingredientHits(row.query, foods)
  const measured = gramsFromMeasure(row.quantity, row.unit)
  const grams = measured ?? row.gramsGuess
  return {
    id: `${index}:${row.raw}`,
    raw: row.raw,
    query: row.query,
    quantity: row.quantity,
    unit: row.unit,
    grams: grams == null ? "" : String(grams),
    hits,
    pickedId: hits[0]?.id ?? "",
    status: hits.length ? "" : "Searching USDA FoodData Central…",
  }
}

function amountNote(row: Draft): string {
  const phrase = measurePhrase(row.quantity, row.unit)
  const grams = gramsFromMeasure(row.quantity, row.unit)
  if (!phrase) return ""
  if (grams != null && measureIsAbout(row.unit)) return `${phrase}, about ${grams} g`
  return phrase
}

function suggestedGrams(row: Draft): number | null {
  if (row.grams !== "") return null
  if (gramsFromMeasure(row.quantity, row.unit) != null) return null
  const hit = row.hits.find((item) => item.id === row.pickedId)
  if (!hit || !(hit.gramsPerUnit > 0)) return null
  const count = row.unit === "slice" || row.unit === "count" ? row.quantity : null
  const n = count != null && count > 0 ? count * hit.gramsPerUnit : hit.gramsPerUnit
  return Math.round(n * 10) / 10
}

export function FoodIngredientList({ onAdd, commitLabel = "Add to the recipe" }: { onAdd: (lines: PickedIngredient[]) => void; commitLabel?: string }) {
  const foods = useKitchenStore((s) => s.foods)
  const [text, setText] = useState("")
  const [rows, setRows] = useState<Draft[]>([])
  const pending = useRef<Record<string, object>>({})

  const runLookup = (id: string, query: string) => {
    const token = {}
    pending.current[id] = token
    void gatherIngredientHits(query, useKitchenStore.getState().foods).then((hits) => {
      if (pending.current[id] !== token) return
      setRows((current) => {
        let changed = false
        const next = current.map((row) => {
          if (row.id !== id || row.query !== query) return row
          const still = hits.some((hit) => hit.id === row.pickedId)
          const pickedId = still ? row.pickedId : hits[0]?.id ?? ""
          const status = hits.length ? "" : "Nothing matched."
          const sameHits = row.hits.length === hits.length && row.hits.every((hit, index) => hit.id === hits[index]?.id)
          if (sameHits && row.pickedId === pickedId && row.status === status) return row
          changed = true
          return { ...row, hits, pickedId, status }
        })
        return changed ? next : current
      })
    })
  }

  const read = () => {
    const next = parseIngredientList(text).map((row, index) => draftFrom(row, index, foods))
    setRows(next)
    for (const row of next) runLookup(row.id, row.query)
  }

  const ready =
    rows.length > 0 &&
    rows.every((row) => {
      const grams = Number(row.grams)
      return row.hits.some((hit) => hit.id === row.pickedId) && Number.isFinite(grams) && grams > 0
    })

  const add = () => {
    const picked: PickedIngredient[] = []
    for (const row of rows) {
      const hit = row.hits.find((item) => item.id === row.pickedId)
      const grams = Number(row.grams)
      if (!hit || !(grams > 0)) return
      picked.push({ hit, grams })
    }
    onAdd(picked)
    setRows([])
  }

  return (
    <div className="trk-food-ingredient-list">
      <label>
        Ingredients
        <textarea
          aria-label="Ingredients"
          value={text}
          placeholder="one food on each line"
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <button type="button" data-no95="" className="trk-keycap" onClick={read}>
        Read the list
      </button>
      {rows.length ? (
        <ul aria-label="Read ingredients">
          {rows.map((row) => {
            const suggestion = suggestedGrams(row)
            const note = amountNote(row)
            return (
              <li key={row.id}>
                <p>{row.raw}</p>
                <div className="trk-food-line">
                  <label>
                    Food
                    <input
                      aria-label={`Food for ${row.raw}`}
                      value={row.query}
                      onChange={(event) =>
                        setRows((current) => current.map((item) => (item.id === row.id ? { ...item, query: event.target.value } : item)))
                      }
                    />
                  </label>
                  <button type="button" data-no95="" className="trk-keycap" aria-label={`Look up ${row.raw}`} onClick={() => runLookup(row.id, row.query)}>
                    Look up
                  </button>
                  {row.hits.length ? (
                    <label>
                      Match
                      <select
                        aria-label={`Match for ${row.raw}`}
                        value={row.pickedId}
                        onChange={(event) =>
                          setRows((current) =>
                            current.map((item) => (item.id === row.id ? { ...item, pickedId: event.target.value } : item)),
                          )
                        }
                      >
                        {row.hits.map((hit) => (
                          <option key={hit.id} value={hit.id}>
                            {hit.name} — {sourceLabel(hit.source)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label>
                    Grams
                    <input
                      aria-label={`Grams of ${row.raw}`}
                      inputMode="decimal"
                      value={row.grams}
                      onChange={(event) =>
                        setRows((current) => current.map((item) => (item.id === row.id ? { ...item, grams: event.target.value } : item)))
                      }
                    />
                  </label>
                  {suggestion != null ? (
                    <button
                      type="button"
                      data-no95=""
                      className="trk-keycap"
                      onClick={() =>
                        setRows((current) => current.map((item) => (item.id === row.id ? { ...item, grams: String(suggestion) } : item)))
                      }
                    >
                      Use {suggestion} g
                    </button>
                  ) : null}
                  <button
                    type="button"
                    data-no95=""
                    className="trk-keycap"
                    aria-label={`Remove ${row.raw}`}
                    onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
                  >
                    Remove
                  </button>
                </div>
                {note ? <p className="trk-food-unit">{note}</p> : null}
                {row.status ? <p className="trk-food-status">{row.status}</p> : null}
              </li>
            )
          })}
        </ul>
      ) : null}
      {rows.length ? (
        <button type="button" data-no95="" className="trk-keycap" disabled={!ready} onClick={add}>
          {commitLabel}
        </button>
      ) : null}
    </div>
  )
}
