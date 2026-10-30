"use client"

/**
 * components/Home/Tracking/tracking-log/food/food-create-sheet.tsx — Name a food the search missed
 *
 * A nutrition-facts link, including MyFoodData, fills the confirm sheet from
 * USDA and from the page. Save food writes the kitchen record only. It does
 * not log a plate and it does not draw stock.
 */

import { useState } from "react"
import { NUTRIENT_FACE, NUTRIENT_LAB, nutrientsFrom, type NutrientKey, type Nutrients } from "@/lib/kitchen-nutrients"
import {
  matchIngredientNames,
  nutrientsFromSeen,
  readNutritionLink,
  type SavedFoodDraft,
} from "@/lib/kitchen-food-page"
import { useKitchenStore } from "@/lib/kitchen-store"
import type { IngredientPart, KitchenFood } from "@/lib/kitchen-types"

function blankLines(): Record<NutrientKey, string> {
  const lines = {} as Record<NutrientKey, string>
  for (const face of [...NUTRIENT_FACE, ...NUTRIENT_LAB]) lines[face.key] = ""
  return lines
}

function linesFromSeen(seen: Partial<Nutrients>): Record<NutrientKey, string> {
  const lines = blankLines()
  for (const face of [...NUTRIENT_FACE, ...NUTRIENT_LAB]) {
    if (seen[face.key] == null) continue
    lines[face.key] = String(seen[face.key])
  }
  return lines
}

export function FoodCreateSheet({
  initialName = "",
  onSaved,
  onCancel,
}: {
  initialName?: string
  onSaved: (food: KitchenFood) => void
  onCancel?: () => void
}) {
  const [name, setName] = useState(initialName)
  const [link, setLink] = useState("")
  const [status, setStatus] = useState("")
  const [lines, setLines] = useState(blankLines)
  const [statement, setStatement] = useState("")
  const [parts, setParts] = useState<IngredientPart[]>([])
  const [sourceUrl, setSourceUrl] = useState("")
  const [grams, setGrams] = useState("100")
  const [more, setMore] = useState(false)
  const [openPart, setOpenPart] = useState<string | null>(null)

  const apply = (draft: SavedFoodDraft) => {
    setName(draft.name || name)
    setLines(linesFromSeen(draft.seen))
    setStatement(draft.ingredientStatement ?? "")
    setGrams(String(draft.gramsPerUnit || 100))
    setSourceUrl(draft.sourceUrl ?? "")
    const matched = matchIngredientNames(
      draft.ingredients.map((part) => part.name),
      useKitchenStore.getState().foods,
    )
    setParts(matched)
    setMore(true)
  }

  const read = async () => {
    setStatus("Reading the link…")
    const result = await readNutritionLink(link)
    if (!result.ok) {
      setStatus(result.reason)
      return
    }
    apply(result.draft)
    setStatus("")
  }

  const save = () => {
    const title = name.trim()
    if (!title) {
      setStatus("Name the food.")
      return
    }
    const seen: Partial<Nutrients> = {}
    for (const face of [...NUTRIENT_FACE, ...NUTRIENT_LAB]) {
      const raw = lines[face.key].trim()
      if (!raw) continue
      const n = Number(raw)
      if (Number.isFinite(n) && n >= 0) seen[face.key] = n
    }
    const food = useKitchenStore.getState().saveFood({
      name: title,
      per100g: nutrientsFromSeen(seen),
      gramsPerUnit: Number(grams) > 0 ? Number(grams) : 100,
      source: sourceUrl ? "usda" : "custom",
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(statement.trim() ? { ingredientStatement: statement.trim() } : {}),
      ...(parts.length ? { ingredients: parts } : {}),
    })
    if (!food.id) return
    onSaved(food)
  }

  const faces = more ? [...NUTRIENT_FACE, ...NUTRIENT_LAB] : NUTRIENT_FACE

  return (
    <form
      className="trk-food-create"
      aria-label="Create saved food"
      onSubmit={(event) => {
        event.preventDefault()
        save()
      }}
    >
      <h4>Create saved food</h4>
      <label>
        Name
        <input aria-label="New food name" value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label>
        Nutrition facts link
        <input
          aria-label="Nutrition facts link"
          value={link}
          placeholder="https://tools.myfooddata.com/nutrition-facts/…"
          onChange={(event) => setLink(event.target.value)}
        />
      </label>
      <div className="trk-food-caps">
        <button type="button" data-no95="" className="trk-keycap" onClick={() => void read()}>
          Read link
        </button>
        <button type="button" data-no95="" className="trk-keycap" aria-pressed={more} onClick={() => setMore((open) => !open)}>
          More
        </button>
      </div>
      {status ? <p className="trk-food-status">{status}</p> : null}
      {sourceUrl ? <p className="trk-food-status">{sourceUrl}</p> : null}
      <label>
        Grams per piece
        <input aria-label="Grams per piece" inputMode="decimal" value={grams} onChange={(event) => setGrams(event.target.value)} />
      </label>
      <div className="trk-food-profile" aria-label="Per 100 g">
        <p>Per 100 g</p>
        {faces.map((face) => (
          <label key={face.key}>
            {face.label}
            <input
              aria-label={face.label}
              inputMode="decimal"
              value={lines[face.key]}
              onChange={(event) => setLines({ ...lines, [face.key]: event.target.value })}
            />
          </label>
        ))}
      </div>
      <label>
        Ingredient statement
        <textarea aria-label="Ingredient statement" value={statement} onChange={(event) => setStatement(event.target.value)} />
      </label>
      {parts.length ? (
        <ul className="trk-food-breakdown" aria-label="Ingredient breakdown">
          {parts.map((part) => (
            <li key={part.name}>
              <div className="trk-food-caps">
                <button
                  type="button"
                  data-no95=""
                  className="trk-keycap"
                  aria-pressed={openPart === part.name}
                  onClick={() => setOpenPart((current) => (current === part.name ? null : part.name))}
                >
                  {part.name}
                </button>
              </div>
              {openPart === part.name ? (
                part.per100g ? (
                  <p className="trk-food-status">
                    {part.foodId ? "Matched. " : ""}
                    {nutrientsFrom(part.per100g).kcal} kcal per 100 g
                  </p>
                ) : (
                  <p className="trk-food-status">No nutrients for this name yet.</p>
                )
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="trk-food-caps">
        <button type="submit" data-no95="" className="trk-keycap">
          Save food
        </button>
        {onCancel ? (
          <button type="button" data-no95="" className="trk-keycap" onClick={onCancel}>
            Close
          </button>
        ) : null}
      </div>
    </form>
  )
}
