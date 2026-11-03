"use client"

/**
 * components/Home/Tracking/tracking-log/food/food-meal-plan.tsx — A week of meals that are not eaten yet
 *
 * A slot holds a saved recipe or a saved order. Planning does not create an
 * intake. Log this opens a plate the person still has to accept. The grocery
 * count is a number. The list itself stays on the Kitchen tab.
 */

import { format } from "date-fns"
import { formatLocalDateKey, getWeekDates, getWeekStartDate } from "@/lib/date-utils"
import { groceryFromPlan } from "@/lib/kitchen-plan"
import { useKitchenStore } from "@/lib/kitchen-store"
import type { MealPlanSlot, PlanMeal } from "@/lib/kitchen-types"

const MEALS: { id: PlanMeal; label: string }[] = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "snack", label: "Snack" },
]

function slotValue(slot: MealPlanSlot | undefined): string {
  if (!slot) return ""
  return `${slot.kind}:${slot.refId}`
}

export function FoodMealPlan({
  anchor,
  onLog,
  onUsual,
}: {
  anchor: Date
  onLog: (slot: MealPlanSlot) => void
  onUsual: (orderId: string) => void
}) {
  const plan = useKitchenStore((s) => s.plan)
  const recipes = useKitchenStore((s) => s.recipes)
  const orders = useKitchenStore((s) => s.orders)
  const stock = useKitchenStore((s) => s.stock)
  const foods = useKitchenStore((s) => s.foods)
  const days = getWeekDates(getWeekStartDate(anchor))
  const cookbook = recipes.filter((recipe) => !recipe.draft)
  const needs = groceryFromPlan(plan, recipes, orders, stock, foods)

  const choose = (date: string, meal: PlanMeal, value: string) => {
    const existing = plan.find((slot) => slot.date === date && slot.meal === meal)
    if (!value) {
      if (existing) useKitchenStore.getState().removePlanSlot(existing.id)
      return
    }
    const [kind, refId] = value.split(":")
    if ((kind !== "recipe" && kind !== "order") || !refId) return
    useKitchenStore.getState().savePlanSlot({
      ...(existing ? { id: existing.id } : {}),
      date,
      meal,
      kind,
      refId,
      servings: 1,
    })
  }

  return (
    <section className="trk-food-plan" aria-label="Meal plan">
      <h4 className="trk-food-plan-span">Meal plan</h4>
      <p className="trk-food-status trk-food-plan-span">{needs.length} to buy</p>
      <div className="trk-food-plan-week">
      {days.map((day) => {
        const date = formatLocalDateKey(day)
        return (
          <div key={date} className="trk-food-plan-day">
            <p>{format(day, "EEE d")}</p>
            {MEALS.map((meal) => {
              const slot = plan.find((row) => row.date === date && row.meal === meal.id)
              return (
                <div key={meal.id} className="trk-food-plan-slot">
                  <label>
                    {meal.label}
                    <select
                      aria-label={`${meal.label} on ${date}`}
                      value={slotValue(slot)}
                      onChange={(event) => choose(date, meal.id, event.target.value)}
                    >
                      <option value="">Empty</option>
                      <optgroup label="Recipes">
                        {cookbook.map((recipe) => (
                          <option key={recipe.id} value={`recipe:${recipe.id}`}>{recipe.name}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Orders">
                        {orders.map((order) => (
                          <option key={order.id} value={`order:${order.id}`}>{order.name}</option>
                        ))}
                      </optgroup>
                    </select>
                  </label>
                  {slot ? (
                    <button type="button" data-no95="" className="trk-keycap" onClick={() => onLog(slot)}>
                      Log this
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        )
      })}
      </div>
      <h4 className="trk-food-plan-span">Saved orders</h4>
      {orders.length === 0 ? <p className="trk-shelf-empty">No saved orders.</p> : null}
      <ul>
        {orders.map((order) => (
          <li key={order.id}>
            <span>{order.name}</span>
            <span>{order.where === "out" ? "Eating out" : "At home"}</span>
            <button type="button" data-no95="" className="trk-keycap" onClick={() => onUsual(order.id)}>
              The usual
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
