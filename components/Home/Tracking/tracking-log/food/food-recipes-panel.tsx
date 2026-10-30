"use client"

/**
 * components/Home/Tracking/tracking-log/food/food-recipes-panel.tsx — A recipe and its servings
 *
 * Saving a recipe does not touch the kitchen. A plate that says it was used
 * from the kitchen is what lowers the amount left. A pasted list is read into
 * foods and grams before those lines join the recipe (`food-ingredient-list.tsx`).
 * The lines on the form are added up before Save. A recipe with no lines is
 * not a zero-calorie result, and Save does not write one.
 */

import { useState } from "react"
import { FoodSearch, NutrientGrid } from "@/components/Home/Tracking/tracking-log/food/food-bits"
import { FoodIngredientList } from "@/components/Home/Tracking/tracking-log/food/food-ingredient-list"
import { FoodMealPlan } from "@/components/Home/Tracking/tracking-log/food/food-meal-plan"
import { gramsFromMeasure, ingredientHits, parseIngredientLine } from "@/lib/kitchen-ingredient-list"
import { formatNutrient } from "@/lib/kitchen-nutrients"
import { plateNutrients } from "@/lib/kitchen-plate"
import { recipeFromHtml, type RecipeClip } from "@/lib/kitchen-recipe-clip"
import type { FoodHit } from "@/lib/kitchen-search"
import { resolveKitchenFood, useKitchenStore } from "@/lib/kitchen-store"
import type { MealPlanSlot, PlateLine } from "@/lib/kitchen-types"

export function FoodRecipesPanel({
  anchor = new Date(),
  onLog,
  onUsual,
}: {
  anchor?: Date
  onLog?: (slot: MealPlanSlot) => void
  onUsual?: (orderId: string) => void
}) {
  const foods = useKitchenStore((s) => s.foods)
  const recipes = useKitchenStore((s) => s.recipes)
  const [name, setName] = useState("")
  const [servings, setServings] = useState("2")
  const [lines, setLines] = useState<PlateLine[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [link, setLink] = useState("")
  const [clipNote, setClipNote] = useState("")
  const [published, setPublished] = useState<RecipeClip["published"]>(undefined)
  const resolve = (id: string) => resolveKitchenFood(id, foods)
  const count = Number(servings) > 0 ? Number(servings) : 1
  const usable = lines.filter((line) => line.foodId && line.grams > 0)
  const draftRecipe = { id: "draft", name: name.trim() || "Recipe", servings: count, lines: usable }
  const draftWhole = plateNutrients({ mode: "recipe", lines: [], servings: count, recipeId: "draft" }, resolve, draftRecipe)
  const draftOne = plateNutrients({ mode: "recipe", lines: [], servings: 1, recipeId: "draft" }, resolve, draftRecipe)
  const canSave = name.trim().length > 0 && usable.length > 0

  const remember = (hit: FoodHit, grams?: number) => {
    const id = hit.id.startsWith("cat_")
      ? hit.id
      : useKitchenStore.getState().saveFood({
          id: hit.id,
          name: hit.name,
          per100g: hit.per100g,
          gramsPerUnit: hit.gramsPerUnit || 100,
          source: hit.source === "catalog" ? "custom" : hit.source,
        }).id
    setLines((current) => {
      const add = grams != null && grams > 0 ? grams : hit.gramsPerUnit || 100
      const existing = current.find((line) => line.foodId === id)
      if (existing) return current.map((line) => (line.foodId === id ? { ...line, grams: line.grams + add } : line))
      return [...current, { foodId: id, grams: add }]
    })
  }

  const save = () => {
    const trimmed = name.trim()
    if (!trimmed || !usable.length) return
    const named = useKitchenStore.getState().recipes.find((row) => row.name.toLowerCase() === trimmed.toLowerCase())
    const id = editing || named?.id
    const analysis = plateNutrients(
      { mode: "recipe", lines: [], servings: 1, recipeId: "draft" },
      resolve,
      { id: "draft", name: trimmed, servings: count, lines: usable },
    )
    const recipe = useKitchenStore.getState().saveRecipe({
      ...(id ? { id } : {}),
      name: trimmed,
      servings: count,
      lines: usable,
      ...(link.trim() ? { sourceUrl: link.trim() } : {}),
      ...(published ? { published } : {}),
      analysis,
    })
    if (!recipe) return
    setName("")
    setServings("2")
    setLines([])
    setEditing(null)
    setLink("")
    setPublished(undefined)
    setClipNote("")
  }

  const applyClip = (clip: RecipeClip) => {
    setName(clip.name)
    setServings(String(clip.servings))
    setPublished(clip.published)
    const next: PlateLine[] = []
    for (const raw of clip.ingredients) {
      const parsed = parseIngredientLine(raw)
      if (!parsed) continue
      const hit = ingredientHits(parsed.query, useKitchenStore.getState().foods)[0]
      if (!hit) continue
      const id = hit.id.startsWith("cat_")
        ? hit.id
        : useKitchenStore.getState().saveFood({
            id: hit.id,
            name: hit.name,
            per100g: hit.per100g,
            gramsPerUnit: hit.gramsPerUnit || 100,
            source: hit.source === "catalog" ? "custom" : hit.source,
          }).id
      const grams = gramsFromMeasure(parsed.quantity, parsed.unit) ?? parsed.gramsGuess ?? (hit.gramsPerUnit || 100)
      next.push({ foodId: id, grams, origin: "recipe" })
    }
    if (next.length) setLines(next)
    setClipNote(clip.published ? "Published nutrition is beside the summed lines. Save recipe does not log a meal." : "Save recipe does not log a meal.")
  }

  const readLink = async () => {
    const url = link.trim()
    if (!url) return
    if (process.env.VITEST) {
      setClipNote("That page could not be read.")
      return
    }
    try {
      const response = await fetch(url)
      if (!response.ok) {
        setClipNote("That page could not be read.")
        return
      }
      const clip = recipeFromHtml(await response.text())
      if (!clip) {
        setClipNote("No recipe on that page.")
        return
      }
      applyClip({ ...clip, sourceUrl: url })
    } catch {
      setClipNote("That page could not be read.")
    }
  }

  return (
    <div className="trk-food-recipes">
      <div className="trk-food-recipes-split">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
      >
        <h4>{editing ? "Edit recipe" : "New recipe"}</h4>
        <label>
          Name
          <input aria-label="Recipe name" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Servings
          <input aria-label="Servings" inputMode="decimal" value={servings} onChange={(event) => setServings(event.target.value)} />
        </label>
        <FoodIngredientList onAdd={(picked) => {
          for (const row of picked) remember(row.hit, row.grams)
        }} />
        <FoodSearch label="Add an ingredient" onPick={(hit) => remember(hit)} />
        <ul>
          {lines.map((line) => (
            <li key={line.foodId}>
              <span>{resolve(line.foodId)?.name || "Food"}</span>
              <label>
                Grams
                <input
                  aria-label={`Grams of ${resolve(line.foodId)?.name || "food"}`}
                  inputMode="decimal"
                  value={String(line.grams)}
                  onChange={(event) =>
                    setLines((current) => current.map((row) => (row.foodId === line.foodId ? { ...row, grams: Number(event.target.value) } : row)))
                  }
                />
              </label>
              <button type="button" data-no95="" className="trk-keycap" onClick={() => setLines((current) => current.filter((row) => row.foodId !== line.foodId))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        {usable.length ? (
          <>
            <p className="trk-food-status">{formatNutrient("kcal", draftOne.kcal)} per serving</p>
            <NutrientGrid row={draftOne} heading="One serving" />
            <NutrientGrid row={draftWhole} heading="Whole recipe" />
          </>
        ) : null}
        <label>
          Recipe link
          <input aria-label="Recipe link" value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://" />
        </label>
        <button type="button" data-no95="" className="trk-keycap" onClick={() => void readLink()}>
          Read link
        </button>
        {clipNote ? <p className="trk-food-status">{clipNote}</p> : null}
        {published ? <p className="trk-food-status">Published {formatNutrient("kcal", published.kcal)}</p> : null}
        <button type="submit" data-no95="" className="trk-keycap" disabled={!canSave}>Save recipe</button>
      </form>
      <ul className="trk-food-recipe-list">
        {recipes.map((recipe) => {
          const whole = plateNutrients({ mode: "recipe", lines: [], servings: recipe.servings, recipeId: recipe.id }, resolve, recipe)
          const one = plateNutrients({ mode: "recipe", lines: [], servings: 1, recipeId: recipe.id }, resolve, recipe)
          return (
            <li key={recipe.id}>
              <header>
                <strong>{recipe.name}</strong>
                <span>{recipe.lines.length ? `${formatNutrient("kcal", one.kcal)} per serving` : "No ingredients"}</span>
                {recipe.published ? <span>Published {formatNutrient("kcal", recipe.published.kcal)}</span> : null}
              </header>
              {recipe.lines.length ? (
                <>
                  <NutrientGrid row={one} heading="One serving" />
                  <NutrientGrid row={whole} heading="Whole recipe" />
                </>
              ) : null}
              <button
                type="button"
                data-no95=""
                className="trk-keycap"
                onClick={() => {
                  setEditing(recipe.id)
                  setName(recipe.name)
                  setServings(String(recipe.servings))
                  setLines(recipe.lines)
                }}
              >
                Edit
              </button>
              <button type="button" data-no95="" className="trk-keycap" onClick={() => useKitchenStore.getState().removeRecipe(recipe.id)}>
                Remove
              </button>
            </li>
          )
        })}
      </ul>
      </div>
      <FoodMealPlan
        anchor={anchor}
        onLog={(slot) => onLog?.(slot)}
        onUsual={(orderId) => onUsual?.(orderId)}
      />
    </div>
  )
}
