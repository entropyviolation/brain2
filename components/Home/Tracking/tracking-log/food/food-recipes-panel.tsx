"use client"

/**
 * components/Home/Tracking/tracking-log/food/food-recipes-panel.tsx — A recipe and its servings
 *
 * Saving a recipe does not touch the kitchen. A plate that says it was used
 * from the kitchen is what lowers the amount left.
 */

import { useState } from "react"
import { FoodSearch, NutrientGrid } from "@/components/Home/Tracking/tracking-log/food/food-bits"
import { formatNutrient } from "@/lib/kitchen-nutrients"
import { plateNutrients } from "@/lib/kitchen-plate"
import type { FoodHit } from "@/lib/kitchen-search"
import { resolveKitchenFood, useKitchenStore } from "@/lib/kitchen-store"
import type { PlateLine } from "@/lib/kitchen-types"

export function FoodRecipesPanel() {
  const foods = useKitchenStore((s) => s.foods)
  const recipes = useKitchenStore((s) => s.recipes)
  const [name, setName] = useState("")
  const [servings, setServings] = useState("2")
  const [lines, setLines] = useState<PlateLine[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const resolve = (id: string) => resolveKitchenFood(id, foods)

  const remember = (hit: FoodHit) => {
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
      const grams = hit.gramsPerUnit || 100
      const existing = current.find((line) => line.foodId === id)
      if (existing) return current.map((line) => (line.foodId === id ? { ...line, grams: line.grams + grams } : line))
      return [...current, { foodId: id, grams }]
    })
  }

  const save = () => {
    const recipe = useKitchenStore.getState().saveRecipe({
      ...(editing ? { id: editing } : {}),
      name,
      servings: Number(servings) || 1,
      lines,
    })
    if (!recipe) return
    setName("")
    setServings("2")
    setLines([])
    setEditing(null)
  }

  return (
    <div className="trk-food-recipes">
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
        <FoodSearch label="Add an ingredient" onPick={remember} />
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
              <button type="button" onClick={() => setLines((current) => current.filter((row) => row.foodId !== line.foodId))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        <button type="submit">Save recipe</button>
      </form>
      <ul className="trk-food-recipe-list">
        {recipes.map((recipe) => {
          const whole = plateNutrients({ mode: "recipe", lines: [], servings: recipe.servings, recipeId: recipe.id }, resolve, recipe)
          const one = plateNutrients({ mode: "recipe", lines: [], servings: 1, recipeId: recipe.id }, resolve, recipe)
          return (
            <li key={recipe.id}>
              <header>
                <strong>{recipe.name}</strong>
                <span>{formatNutrient("kcal", one.kcal)} per serving</span>
              </header>
              <NutrientGrid row={one} heading="One serving" />
              <NutrientGrid row={whole} heading="Whole recipe" />
              <button
                type="button"
                onClick={() => {
                  setEditing(recipe.id)
                  setName(recipe.name)
                  setServings(String(recipe.servings))
                  setLines(recipe.lines)
                }}
              >
                Edit
              </button>
              <button type="button" onClick={() => useKitchenStore.getState().removeRecipe(recipe.id)}>
                Remove
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
