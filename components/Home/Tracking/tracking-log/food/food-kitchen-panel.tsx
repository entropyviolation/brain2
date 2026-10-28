"use client"

/**
 * components/Home/Tracking/tracking-log/food/food-kitchen-panel.tsx — Four rooms, what is left, and saved foods
 */

import { useMemo, useState } from "react"
import { KitchenStage } from "@/components/Home/Tracking/tracking-log/food/kitchen-stage"
import { FoodSearch } from "@/components/Home/Tracking/tracking-log/food/food-bits"
import { inventoryOffers } from "@/lib/ingest/apply-inventory"
import { formatLocalDateKey } from "@/lib/date-utils"
import { formatNutrient, NUTRIENT_FACE, nutrientsFrom, type NutrientKey } from "@/lib/kitchen-nutrients"
import { assessKeep, guessLabel, heldLabel } from "@/lib/kitchen-safety"
import { notePantryBuy, resolveKitchenFood, useKitchenStore } from "@/lib/kitchen-store"
import { KITCHEN_ROOMS, ROOM_LABEL, type KitchenFood, type KitchenRoom, type StockUnit } from "@/lib/kitchen-types"
import type { FoodHit } from "@/lib/kitchen-search"
import "./food-library.css"

type FoodDraft = {
  id: string
  name: string
  grams: string
  nutrients: Record<NutrientKey, string>
  barcode: string
  brand: string
  retired: boolean
}

function draftFrom(food: KitchenFood): FoodDraft {
  const nutrients = {} as Record<NutrientKey, string>
  for (const face of NUTRIENT_FACE) nutrients[face.key] = String(food.per100g[face.key])
  return {
    id: food.id,
    name: food.name,
    grams: String(food.gramsPerUnit),
    nutrients,
    barcode: food.barcode ?? "",
    brand: food.brand ?? "",
    retired: food.retired === true,
  }
}

function refreshLoggedPlates(foodId: string) {
  const state = useKitchenStore.getState()
  for (const plate of state.plates) {
    if (!plate.accepted) continue
    const recipe = plate.recipeId ? state.recipes.find((row) => row.id === plate.recipeId) ?? null : null
    const ids = new Set(plate.lines.map((line) => line.foodId))
    for (const line of recipe?.lines ?? []) ids.add(line.foodId)
    if (ids.has(foodId)) useKitchenStore.getState().refreshPlateSnapshot(plate.entryId)
  }
}

export function FoodKitchenPanel() {
  const foods = useKitchenStore((s) => s.foods)
  const stock = useKitchenStore((s) => s.stock)
  const [room, setRoom] = useState<KitchenRoom | "all">("all")
  const [name, setName] = useState("")
  const [foodId, setFoodId] = useState("")
  const [hit, setHit] = useState<FoodHit | null>(null)
  const [amount, setAmount] = useState("1")
  const [unit, setUnit] = useState<StockUnit>("count")
  const [boughtOn, setBoughtOn] = useState(() => formatLocalDateKey(new Date()))
  const [putRoom, setPutRoom] = useState<KitchenRoom>("pantry")
  const [draft, setDraft] = useState<FoodDraft | null>(null)
  const [showRetired, setShowRetired] = useState(false)
  const today = formatLocalDateKey(new Date())
  const retiredCount = foods.filter((food) => food.retired).length
  const library = useMemo(
    () =>
      [...foods]
        .filter((food) => showRetired || !food.retired)
        .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
    [foods, showRetired],
  )
  const offers = useMemo(() => inventoryOffers(), [stock, foods])
  const lots = stock.filter((lot) => !lot.finished && lot.amount > 0 && (room === "all" || lot.room === room))
  const dioramaLots = stock
    .filter((lot) => !lot.finished && lot.amount > 0)
    .map((lot) => ({ room: lot.room, name: resolveKitchenFood(lot.foodId, foods)?.name || "Food" }))

  const pick = (next: FoodHit) => {
    setHit(next)
    setFoodId(next.id.startsWith("cat_") ? next.id : "")
    setName(next.name)
    if (next.gramsPerUnit && unit !== "g") setAmount(String(next.gramsPerUnit))
  }

  const putAway = () => {
    const qty = Number(amount)
    const savedId = foodId || (hit && !hit.id.startsWith("cat_") ? hit.id : undefined)
    if (hit && savedId && !hit.id.startsWith("cat_")) {
      const existing = useKitchenStore.getState().foods.find((food) => food.id === savedId)
      useKitchenStore.getState().saveFood({
        ...existing,
        id: savedId,
        name: hit.name,
        per100g: hit.per100g,
        gramsPerUnit: hit.gramsPerUnit || existing?.gramsPerUnit || 100,
        source: hit.source === "catalog" ? "custom" : hit.source,
        room: putRoom,
      })
    }
    const lot = useKitchenStore.getState().putAway({
      name: name.trim(),
      foodId: foodId || savedId,
      room: putRoom,
      amount: qty,
      unit,
      boughtOn,
      per100g: hit?.per100g,
      gramsPerUnit: hit?.gramsPerUnit,
      source: hit?.source,
    })
    if (!lot) return
    setName("")
    setFoodId("")
    setHit(null)
    setAmount("1")
    setRoom(putRoom)
  }

  const chooseFood = (food: KitchenFood) => {
    if (draft?.id === food.id) return
    setDraft(draftFrom(food))
  }

  const saveLibraryFood = () => {
    if (!draft) return
    const nameTrimmed = draft.name.trim()
    if (!nameTrimmed) return
    const current = useKitchenStore.getState().foods.find((food) => food.id === draft.id)
    if (!current) return
    const per100g = nutrientsFrom(
      Object.fromEntries(NUTRIENT_FACE.map((face) => [face.key, draft.nutrients[face.key]])) as Partial<KitchenFood["per100g"]>,
    )
    const saved = useKitchenStore.getState().saveFood({
      ...current,
      id: current.id,
      name: nameTrimmed,
      per100g,
      gramsPerUnit: Number(draft.grams),
      source: current.source,
      barcode: draft.barcode,
      brand: draft.brand,
      retired: draft.retired ? true : undefined,
    })
    if (saved.id) setDraft(draftFrom(saved))
  }

  const setRetired = (retired: boolean) => {
    if (!draft) return
    const current = useKitchenStore.getState().foods.find((food) => food.id === draft.id)
    if (!current) return
    const saved = useKitchenStore.getState().saveFood({ ...current, id: current.id, retired: retired ? true : undefined })
    if (!saved.id) return
    if (retired && !showRetired) setDraft(null)
    else setDraft(draftFrom(saved))
  }

  return (
    <div className="trk-food-kitchen">
      <p className="trk-food-status">How long it has been here, and a house guess from a typical keep time. Not a safety test.</p>
      <KitchenStage lots={dioramaLots} active={room} onRoom={setRoom} />
      <div className="trk-span-switch" role="toolbar" aria-label="Kitchen rooms">
        <button type="button" aria-pressed={room === "all"} onClick={() => setRoom("all")}>
          All
        </button>
        {KITCHEN_ROOMS.map((id) => (
          <button key={id} type="button" aria-pressed={room === id} onClick={() => setRoom(id)}>
            {ROOM_LABEL[id]}
          </button>
        ))}
      </div>
      {offers.length > 0 ? (
        <button
          type="button"
          onClick={() => {
            const now = new Date()
            for (const row of offers) notePantryBuy(row.name, row.qty, now)
          }}
        >
          Put the inventory list in the pantry
        </button>
      ) : null}
      <form
        className="trk-food-put"
        onSubmit={(event) => {
          event.preventDefault()
          putAway()
        }}
      >
        <h4>Put away</h4>
        <FoodSearch label="Find a food to store" onPick={pick} />
        <label>
          Name
          <input aria-label="Food to store" value={name} onChange={(event) => { setName(event.target.value); setFoodId(""); setHit(null) }} />
        </label>
        <label>
          Room
          <select aria-label="Room" value={putRoom} onChange={(event) => setPutRoom(event.target.value as KitchenRoom)}>
            {KITCHEN_ROOMS.map((id) => (
              <option key={id} value={id}>{ROOM_LABEL[id]}</option>
            ))}
          </select>
        </label>
        <label>
          Amount
          <input aria-label="Amount to store" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </label>
        <label>
          Unit
          <select aria-label="Unit" value={unit} onChange={(event) => setUnit(event.target.value as StockUnit)}>
            <option value="count">Count</option>
            <option value="g">Grams</option>
            <option value="ml">Milliliters</option>
          </select>
        </label>
        <label>
          Bought
          <input aria-label="Bought on" type="date" value={boughtOn} onChange={(event) => setBoughtOn(event.target.value)} />
        </label>
        <button type="submit">Put away</button>
      </form>
      {lots.length === 0 ? <p className="trk-shelf-empty">Nothing in this room.</p> : null}
      <ul className="trk-food-lots">
        {lots.map((lot) => {
          const food = resolveKitchenFood(lot.foodId, foods)
          const keep = assessKeep(lot, food, today)
          return (
            <li key={lot.id} className="trk-food-lot">
              <header>
                <strong>{food?.name || "Food"}</strong>
                <span>{ROOM_LABEL[lot.room]}</span>
              </header>
              <p>
                {heldLabel(keep.daysHeld)}. {guessLabel(keep.guess)}.
              </p>
              <label>
                Amount left
                <input
                  aria-label={`Amount left of ${food?.name || "food"}`}
                  inputMode="decimal"
                  value={String(lot.amount)}
                  onChange={(event) => useKitchenStore.getState().setStockAmount(lot.id, Number(event.target.value))}
                />
              </label>
              <div className="trk-span-switch" role="group" aria-label={`${food?.name || "Food"} room`}>
                {KITCHEN_ROOMS.map((id) => (
                  <button key={id} type="button" aria-pressed={lot.room === id} onClick={() => useKitchenStore.getState().setStockRoom(lot.id, id)}>
                    {ROOM_LABEL[id]}
                  </button>
                ))}
              </div>
              <div className="trk-food-lot-actions">
                <button type="button" onClick={() => useKitchenStore.getState().markOpened(lot.id, today)}>
                  Opened
                </button>
                <button type="button" onClick={() => useKitchenStore.getState().markStillGood(lot.id, today)}>
                  Still good
                </button>
                <button type="button" onClick={() => useKitchenStore.getState().markFinished(lot.id)}>
                  Finished
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      <section className="trk-food-library" aria-label="Saved foods">
        <h4>Saved foods</h4>
        {retiredCount > 0 ? (
          <button type="button" aria-pressed={showRetired} onClick={() => setShowRetired((on) => !on)}>
            Retired
          </button>
        ) : null}
        {library.length === 0 ? <p className="trk-shelf-empty">Nothing saved.</p> : null}
        <ul className="trk-food-library-list">
          {library.map((food) => (
            <li key={food.id}>
              <button type="button" aria-pressed={draft?.id === food.id} onClick={() => chooseFood(food)}>
                <strong>{food.name}</strong>
                <span>{formatNutrient("kcal", food.per100g.kcal)} per 100 g</span>
              </button>
            </li>
          ))}
        </ul>
        {draft ? (
          <form
            className="trk-food-library-edit"
            aria-label={`Edit ${draft.name || "saved food"}`}
            onSubmit={(event) => {
              event.preventDefault()
              saveLibraryFood()
            }}
          >
            <h4>Edit food</h4>
            <label>
              Name
              <input aria-label="Saved food name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            </label>
            <label>
              Grams per serving
              <input
                aria-label="Grams per serving"
                inputMode="decimal"
                value={draft.grams}
                onChange={(event) => setDraft({ ...draft, grams: event.target.value })}
              />
            </label>
            <label>
              Brand
              <input aria-label="Brand" value={draft.brand} onChange={(event) => setDraft({ ...draft, brand: event.target.value })} />
            </label>
            <label>
              Barcode
              <input value={draft.barcode} onChange={(event) => setDraft({ ...draft, barcode: event.target.value })} />
            </label>
            <fieldset className="trk-food-library-nuts">
              <legend>Per 100 g</legend>
              {NUTRIENT_FACE.map((face) => (
                <label key={face.key}>
                  {face.label}
                  <input
                    aria-label={`${face.label} per 100 g`}
                    inputMode="decimal"
                    value={draft.nutrients[face.key]}
                    onChange={(event) =>
                      setDraft({ ...draft, nutrients: { ...draft.nutrients, [face.key]: event.target.value } })
                    }
                  />
                </label>
              ))}
            </fieldset>
            <div className="trk-food-library-actions">
              <button type="submit">Save food</button>
              <button type="button" onClick={() => refreshLoggedPlates(draft.id)}>
                Refresh logged plates
              </button>
              <button type="button" onClick={() => setRetired(!draft.retired)}>
                {draft.retired ? "Restore" : "Retire"}
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </div>
  )
}
