/**
 * lib/kitchen-store.ts — Foods, recipes, stock, and plates
 *
 * Storage: `brain2-kitchen` (persist v1). Hub-safe Zustand persist. A food log
 * line stays on the time grid. This store points at it by id. Drawing from the
 * kitchen restores the last draw before it takes again, so saving twice does
 * not eat the pantry twice. An accepted plate stores the nutrients from that
 * save. Editing a food does not rewrite them. Receipt and `inv` bumps land in
 * the pantry.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { matchCatalog } from "@/lib/kitchen-catalog"
import { plateGramLines, refreshNutrientSnapshot } from "@/lib/kitchen-plate"
import { NUTRIENT_KEYS, nutrientsFrom, type Nutrients } from "@/lib/kitchen-nutrients"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import { formatLocalDateKey } from "@/lib/date-utils"
import type {
  FoodSource,
  KitchenFood,
  KitchenPlate,
  KitchenRecipe,
  KitchenRoom,
  KitchenStock,
  PlateLine,
  PlateMode,
  PlateSlot,
  RecipeLine,
  StockDraw,
  StockUnit,
} from "@/lib/kitchen-types"
import { KITCHEN_ROOMS } from "@/lib/kitchen-types"
import { catalogFood } from "@/lib/kitchen-catalog"

export const KITCHEN_STORAGE_KEY = persistKey("kitchen")

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `${prefix}_${crypto.randomUUID()}`
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function amount(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 1000) / 1000
}

function roomOf(value: unknown): KitchenRoom {
  return KITCHEN_ROOMS.includes(value as KitchenRoom) ? (value as KitchenRoom) : "pantry"
}

function unitOf(value: unknown): StockUnit {
  return value === "g" || value === "ml" || value === "count" ? value : "count"
}

function optionalText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const text = value.trim().replace(/\s+/g, " ")
  return text || undefined
}

function optionalBarcode(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const code = value.replace(/\s+/g, "")
  return code || undefined
}

function cleanFood(raw: Partial<KitchenFood> | null | undefined): KitchenFood | null {
  if (!raw || typeof raw.name !== "string" || !raw.name.trim()) return null
  const id = typeof raw.id === "string" && raw.id ? raw.id : newId("food")
  const source: FoodSource =
    raw.source === "usda" || raw.source === "off" || raw.source === "label" || raw.source === "catalog" || raw.source === "custom"
      ? raw.source
      : "custom"
  const barcode = optionalBarcode(raw.barcode)
  const brand = optionalText(raw.brand)
  return {
    id,
    name: raw.name.trim(),
    per100g: nutrientsFrom(raw.per100g),
    gramsPerUnit: amount(raw.gramsPerUnit) || 100,
    source,
    ...(raw.room ? { room: roomOf(raw.room) } : {}),
    ...(raw.keepDays ? { keepDays: raw.keepDays } : {}),
    ...(barcode ? { barcode } : {}),
    ...(brand ? { brand } : {}),
    ...(raw.retired === true ? { retired: true } : {}),
  }
}

function cleanLines(raw: unknown): PlateLine[] {
  if (!Array.isArray(raw)) return []
  const out: PlateLine[] = []
  for (const row of raw) {
    if (!row || typeof row !== "object") continue
    const line = row as Partial<PlateLine>
    if (typeof line.foodId !== "string" || !line.foodId) continue
    const grams = amount(line.grams)
    if (grams <= 0) continue
    out.push({ foodId: line.foodId, grams })
  }
  return out
}

function cleanRecipe(raw: Partial<KitchenRecipe> | null | undefined): KitchenRecipe | null {
  if (!raw || typeof raw.name !== "string" || !raw.name.trim()) return null
  const lines = cleanLines(raw.lines)
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : newId("rcp"),
    name: raw.name.trim(),
    servings: amount(raw.servings) || 1,
    lines,
  }
}

function cleanStock(raw: Partial<KitchenStock> | null | undefined): KitchenStock | null {
  if (!raw || typeof raw.foodId !== "string" || !raw.foodId) return null
  const boughtOn = typeof raw.boughtOn === "string" && DATE_KEY.test(raw.boughtOn) ? raw.boughtOn : ""
  if (!boughtOn) return null
  const openedOn = typeof raw.openedOn === "string" && DATE_KEY.test(raw.openedOn) ? raw.openedOn : undefined
  const stillGoodOn = typeof raw.stillGoodOn === "string" && DATE_KEY.test(raw.stillGoodOn) ? raw.stillGoodOn : undefined
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : newId("stk"),
    foodId: raw.foodId,
    room: roomOf(raw.room),
    amount: amount(raw.amount),
    unit: unitOf(raw.unit),
    boughtOn,
    ...(openedOn ? { openedOn } : {}),
    ...(stillGoodOn ? { stillGoodOn } : {}),
    ...(raw.finished ? { finished: true } : {}),
  }
}

function cleanDrawn(raw: unknown): StockDraw[] {
  if (!Array.isArray(raw)) return []
  const out: StockDraw[] = []
  for (const row of raw) {
    if (!row || typeof row !== "object") continue
    const draw = row as Partial<StockDraw>
    if (typeof draw.stockId !== "string" || !draw.stockId) continue
    const taken = amount(draw.amount)
    if (taken <= 0) continue
    out.push({ stockId: draw.stockId, amount: taken })
  }
  return out
}

function cleanSnapshot(raw: unknown): Nutrients | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined
  const body = raw as Partial<Nutrients>
  if (!NUTRIENT_KEYS.some((key) => body[key] != null)) return undefined
  return nutrientsFrom(body)
}

function cleanPlate(raw: Partial<KitchenPlate> | null | undefined): KitchenPlate | null {
  if (!raw || typeof raw.entryId !== "string" || !raw.entryId) return null
  const mode: PlateMode = raw.mode === "ingredients" || raw.mode === "recipe" || raw.mode === "single" ? raw.mode : "single"
  const nutrientSnapshot = cleanSnapshot(raw.nutrientSnapshot)
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : newId("plt"),
    entryId: raw.entryId,
    accepted: raw.accepted === true,
    slot: raw.slot === "snack" ? "snack" : "meal",
    mode,
    lines: cleanLines(raw.lines),
    ...(typeof raw.recipeId === "string" && raw.recipeId ? { recipeId: raw.recipeId } : {}),
    ...(amount(raw.servings) > 0 ? { servings: amount(raw.servings) } : {}),
    fromKitchen: raw.fromKitchen === true,
    drawn: cleanDrawn(raw.drawn),
    ...(nutrientSnapshot ? { nutrientSnapshot } : {}),
  }
}

export function resolveKitchenFood(id: string, custom: readonly KitchenFood[]): KitchenFood | null {
  return custom.find((food) => food.id === id) ?? catalogFood(id)
}

/** Foods a chooser can offer. Retired rows stay in the store for old plates. */
export function foodsForPick(foods: readonly KitchenFood[]): KitchenFood[] {
  return foods.filter((food) => !food.retired)
}

function stockToGrams(stock: KitchenStock, food: KitchenFood): number {
  if (stock.unit === "g") return stock.amount
  const per = food.gramsPerUnit > 0 ? food.gramsPerUnit : 1
  return stock.amount * per
}

function gramsToAmount(grams: number, stock: KitchenStock, food: KitchenFood): number {
  if (stock.unit === "g") return grams
  const per = food.gramsPerUnit > 0 ? food.gramsPerUnit : 1
  return grams / per
}

function restoreDrawn(stock: KitchenStock[], drawn: StockDraw[]): KitchenStock[] {
  if (!drawn.length) return stock
  return stock.map((lot) => {
    const back = drawn.filter((row) => row.stockId === lot.id).reduce((sum, row) => sum + row.amount, 0)
    if (back <= 0) return lot
    const amountLeft = amount(lot.amount + back)
    return { ...lot, amount: amountLeft, ...(amountLeft > 0 ? { finished: undefined } : {}) }
  })
}

function drawFromStock(
  stock: KitchenStock[],
  lines: PlateLine[],
  foods: readonly KitchenFood[],
): { stock: KitchenStock[]; drawn: StockDraw[] } {
  let lots = stock.map((lot) => ({ ...lot }))
  const drawn: StockDraw[] = []
  for (const line of lines) {
    let need = line.grams
    const food = resolveKitchenFood(line.foodId, foods)
    if (!food || need <= 0) continue
    const order = lots
      .filter((lot) => lot.foodId === line.foodId && !lot.finished && lot.amount > 0)
      .sort((a, b) => a.boughtOn.localeCompare(b.boughtOn) || a.id.localeCompare(b.id))
    for (const lot of order) {
      if (need <= 0.0001) break
      const haveG = stockToGrams(lot, food)
      if (haveG <= 0) continue
      const takeG = Math.min(need, haveG)
      const take = amount(gramsToAmount(takeG, lot, food))
      if (take <= 0) continue
      const left = amount(Math.max(0, lot.amount - take))
      lots = lots.map((row) => (row.id === lot.id ? { ...row, amount: left, ...(left <= 0 ? { finished: true } : {}) } : row))
      lot.amount = left
      drawn.push({ stockId: lot.id, amount: take })
      need -= takeG
    }
  }
  return { stock: lots, drawn }
}

export interface PutAwayDraft {
  name: string
  foodId?: string
  room: KitchenRoom
  amount: number
  unit: StockUnit
  boughtOn: string
  per100g?: KitchenFood["per100g"]
  gramsPerUnit?: number
  source?: FoodSource
}

export interface PlateDraft {
  entryId: string
  accepted: boolean
  slot: PlateSlot
  mode: PlateMode
  lines: PlateLine[]
  recipeId?: string
  servings?: number
  fromKitchen: boolean
}

interface KitchenState {
  foods: KitchenFood[]
  recipes: KitchenRecipe[]
  stock: KitchenStock[]
  plates: KitchenPlate[]
  saveFood: (draft: Omit<KitchenFood, "id"> & { id?: string }) => KitchenFood
  saveRecipe: (draft: Omit<KitchenRecipe, "id"> & { id?: string }) => KitchenRecipe | null
  removeRecipe: (id: string) => void
  putAway: (draft: PutAwayDraft) => KitchenStock | null
  setStockAmount: (id: string, next: number) => void
  setStockRoom: (id: string, room: KitchenRoom) => void
  markOpened: (id: string, day: string) => void
  markStillGood: (id: string, day: string) => void
  markFinished: (id: string) => void
  savePlate: (draft: PlateDraft) => KitchenPlate | null
  /** Rewrite one plate's snapshot from the foods now. Does not draw stock. */
  refreshPlateSnapshot: (entryId: string) => KitchenPlate | null
  removePlate: (entryId: string) => void
}

function applyPlateDraw(state: Pick<KitchenState, "foods" | "recipes" | "stock" | "plates">, draft: PlateDraft, id: string): { stock: KitchenStock[]; plate: KitchenPlate } {
  const previous = state.plates.find((plate) => plate.entryId === draft.entryId)
  let stock = restoreDrawn(state.stock, previous?.drawn ?? [])
  const recipe = draft.recipeId ? state.recipes.find((row) => row.id === draft.recipeId) ?? null : null
  const lines = plateGramLines(
    { mode: draft.mode, lines: draft.lines, recipeId: draft.recipeId, servings: draft.servings },
    recipe,
  )
  let drawn: StockDraw[] = []
  if (draft.fromKitchen && draft.accepted) {
    const taken = drawFromStock(stock, lines, state.foods)
    stock = taken.stock
    drawn = taken.drawn
  }
  const base = cleanPlate({ ...draft, id, drawn })!
  const plate = base.accepted
    ? refreshNutrientSnapshot(base, (foodId) => resolveKitchenFood(foodId, state.foods), recipe)
    : base
  return { stock, plate }
}

export function sanitizeKitchen(raw: unknown): Pick<KitchenState, "foods" | "recipes" | "stock" | "plates"> {
  const body = (raw ?? {}) as Partial<KitchenState>
  const foods = Array.isArray(body.foods) ? body.foods.map((row) => cleanFood(row)).filter((row): row is KitchenFood => !!row) : []
  const recipes = Array.isArray(body.recipes) ? body.recipes.map((row) => cleanRecipe(row)).filter((row): row is KitchenRecipe => !!row) : []
  const stock = Array.isArray(body.stock) ? body.stock.map((row) => cleanStock(row)).filter((row): row is KitchenStock => !!row) : []
  const plates = Array.isArray(body.plates) ? body.plates.map((row) => cleanPlate(row)).filter((row): row is KitchenPlate => !!row) : []
  return { foods, recipes, stock, plates }
}

export const useKitchenStore = create<KitchenState>()(
  persist(
    (set, get) => ({
      foods: [],
      recipes: [],
      stock: [],
      plates: [],
      saveFood: (draft) => {
        const food = cleanFood(draft)
        if (!food) {
          return {
            id: "",
            name: "",
            per100g: nutrientsFrom(null),
            gramsPerUnit: 100,
            source: "custom",
          }
        }
        set({
          foods: get().foods.some((row) => row.id === food.id)
            ? get().foods.map((row) => (row.id === food.id ? food : row))
            : [...get().foods, food],
        })
        return food
      },
      saveRecipe: (draft) => {
        const recipe = cleanRecipe(draft)
        if (!recipe) return null
        set({
          recipes: get().recipes.some((row) => row.id === recipe.id)
            ? get().recipes.map((row) => (row.id === recipe.id ? recipe : row))
            : [...get().recipes, recipe],
        })
        return recipe
      },
      removeRecipe: (id) => set({ recipes: get().recipes.filter((row) => row.id !== id) }),
      putAway: (draft) => {
        const boughtOn = DATE_KEY.test(draft.boughtOn) ? draft.boughtOn : ""
        const qty = amount(draft.amount)
        if (!boughtOn || qty <= 0) return null
        let foodId = draft.foodId?.trim() || ""
        if (!foodId) {
          const named = draft.name.trim()
          const catalog = matchCatalog(named)
          const existing = get().foods.find((food) => !food.retired && food.name.toLowerCase() === named.toLowerCase())
          if (existing) foodId = existing.id
          else if (catalog) foodId = catalog.id
          else if (named) {
            const saved = get().saveFood({
              name: named,
              per100g: nutrientsFrom(draft.per100g),
              gramsPerUnit: amount(draft.gramsPerUnit) || 100,
              source: draft.source ?? "custom",
              room: draft.room,
            })
            foodId = saved.id
          }
        } else if (draft.per100g && !catalogFood(foodId) && !get().foods.some((food) => food.id === foodId)) {
          get().saveFood({
            id: foodId,
            name: draft.name.trim() || "Food",
            per100g: nutrientsFrom(draft.per100g),
            gramsPerUnit: amount(draft.gramsPerUnit) || 100,
            source: draft.source ?? "custom",
            room: draft.room,
          })
        }
        if (!foodId) return null
        const unit = unitOf(draft.unit)
        const sameDay = get().stock.find(
          (lot) => lot.foodId === foodId && lot.room === draft.room && lot.unit === unit && lot.boughtOn === boughtOn && !lot.finished,
        )
        if (sameDay) {
          const next = { ...sameDay, amount: amount(sameDay.amount + qty) }
          set({ stock: get().stock.map((lot) => (lot.id === sameDay.id ? next : lot)) })
          return next
        }
        const lot = cleanStock({
          foodId,
          room: draft.room,
          amount: qty,
          unit,
          boughtOn,
        })
        if (!lot) return null
        set({ stock: [...get().stock, lot] })
        return lot
      },
      setStockAmount: (id, next) =>
        set({
          stock: get().stock.map((lot) => {
            if (lot.id !== id) return lot
            const left = amount(next)
            return { ...lot, amount: left, ...(left > 0 ? { finished: undefined } : { finished: true }) }
          }),
        }),
      setStockRoom: (id, room) =>
        set({ stock: get().stock.map((lot) => (lot.id === id ? { ...lot, room } : lot)) }),
      markOpened: (id, day) => {
        if (!DATE_KEY.test(day)) return
        set({ stock: get().stock.map((lot) => (lot.id === id ? { ...lot, openedOn: day } : lot)) })
      },
      markStillGood: (id, day) => {
        if (!DATE_KEY.test(day)) return
        set({ stock: get().stock.map((lot) => (lot.id === id ? { ...lot, stillGoodOn: day, finished: undefined } : lot)) })
      },
      markFinished: (id) =>
        set({ stock: get().stock.map((lot) => (lot.id === id ? { ...lot, amount: 0, finished: true } : lot)) }),
      savePlate: (draft) => {
        const state = get()
        const previous = state.plates.find((plate) => plate.entryId === draft.entryId)
        const { stock, plate } = applyPlateDraw(state, draft, previous?.id ?? newId("plt"))
        if (!plate) return null
        set({
          stock,
          plates: previous ? state.plates.map((row) => (row.entryId === draft.entryId ? plate : row)) : [...state.plates, plate],
        })
        return plate
      },
      refreshPlateSnapshot: (entryId) => {
        const state = get()
        const current = state.plates.find((row) => row.entryId === entryId)
        if (!current) return null
        const recipe = current.recipeId ? state.recipes.find((row) => row.id === current.recipeId) ?? null : null
        const plate = refreshNutrientSnapshot(current, (foodId) => resolveKitchenFood(foodId, state.foods), recipe)
        set({ plates: state.plates.map((row) => (row.entryId === entryId ? plate : row)) })
        return plate
      },
      removePlate: (entryId) => {
        const previous = get().plates.find((plate) => plate.entryId === entryId)
        set({
          plates: get().plates.filter((plate) => plate.entryId !== entryId),
          stock: restoreDrawn(get().stock, previous?.drawn ?? []),
        })
      },
    }),
    {
      name: KITCHEN_STORAGE_KEY,
      version: 1,
      storage: createCogsJSONStorage(),
      partialize: (state) => ({ foods: state.foods, recipes: state.recipes, stock: state.stock, plates: state.plates }),
      merge: (persisted, current) => ({ ...current, ...sanitizeKitchen(persisted) }),
    },
  ),
)

/** Pantry lot from a grocery bump or a receipt. Stacks onto today's lot. */
export function notePantryBuy(name: string, qty = 1, now = new Date()): KitchenStock | null {
  const amountQty = Number.isFinite(qty) && qty > 0 ? qty : 1
  return useKitchenStore.getState().putAway({
    name,
    room: "pantry",
    amount: amountQty,
    unit: "count",
    boughtOn: formatLocalDateKey(now),
  })
}

export function foodName(id: string, custom: readonly KitchenFood[]): string {
  return resolveKitchenFood(id, custom)?.name ?? "Food"
}

export type { RecipeLine }
