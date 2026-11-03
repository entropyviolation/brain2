/**
 * lib/kitchen-store.ts — Foods, recipes, stock, and plates
 *
 * Storage: `brain2-kitchen` (persist v1). Hub-safe Zustand persist. A food log
 * line stays on the time grid. This store points at it by id. Drawing from the
 * kitchen restores the last draw before it takes again, so saving twice does
 * not eat the pantry twice. An accepted plate stores the nutrients from that
 * save. Editing a food does not rewrite them. Receipt and `inv` bumps land in
 * the pantry. `duplicatePlate` copies one plate onto another entry id and
 * does not draw stock again.
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
  EatWhere,
  FoodPortion,
  FoodSource,
  GroceryRow,
  KitchenFood,
  KitchenOrder,
  KitchenPlate,
  KitchenRecipe,
  KitchenRoom,
  KitchenStock,
  LineOrigin,
  MealPlanSlot,
  PlanMeal,
  PlateLine,
  PlateMode,
  PlateSlot,
  IngredientPart,
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
    ...(raw.pinned === true ? { pinned: true } : {}),
    ...(cleanPortions(raw.portions).length ? { portions: cleanPortions(raw.portions) } : {}),
    ...(optionalText(raw.sourceUrl) ? { sourceUrl: optionalText(raw.sourceUrl) } : {}),
    ...(optionalText(raw.ingredientStatement) ? { ingredientStatement: optionalText(raw.ingredientStatement) } : {}),
    ...(cleanIngredients(raw.ingredients).length ? { ingredients: cleanIngredients(raw.ingredients) } : {}),
  }
}

function cleanIngredients(raw: unknown): IngredientPart[] {
  if (!Array.isArray(raw)) return []
  const out: IngredientPart[] = []
  for (const row of raw) {
    if (!row || typeof row !== "object") continue
    const part = row as Partial<IngredientPart>
    const name = optionalText(part.name)
    if (!name) continue
    const amountText = optionalText(part.amount)
    const grams = amount(part.grams)
    const foodId = typeof part.foodId === "string" && part.foodId ? part.foodId : undefined
    const per100g = part.per100g ? nutrientsFrom(part.per100g) : undefined
    out.push({
      name,
      ...(amountText ? { amount: amountText } : {}),
      ...(grams > 0 ? { grams } : {}),
      ...(foodId ? { foodId } : {}),
      ...(per100g ? { per100g } : {}),
    })
  }
  return out
}

function cleanPortions(raw: unknown): FoodPortion[] {
  if (!Array.isArray(raw)) return []
  const out: FoodPortion[] = []
  for (const row of raw) {
    if (!row || typeof row !== "object") continue
    const portion = row as Partial<FoodPortion>
    const label = optionalText(portion.label)
    const grams = amount(portion.grams)
    if (!label || grams <= 0) continue
    out.push({ label, grams })
  }
  return out
}

const ORIGINS: LineOrigin[] = ["order", "recipe", "api", "label", "catalog", "stock"]

function cleanLine(line: Partial<PlateLine>): PlateLine | null {
  if (typeof line.foodId !== "string" || !line.foodId) return null
  const grams = amount(line.grams)
  if (grams <= 0) return null
  const origin = ORIGINS.includes(line.origin as LineOrigin) ? (line.origin as LineOrigin) : undefined
  const unit = optionalText(line.unit)
  const qty = amount(line.amount)
  return {
    foodId: line.foodId,
    grams,
    ...(qty > 0 ? { amount: qty } : {}),
    ...(unit ? { unit } : {}),
    ...(origin ? { origin } : {}),
    ...(typeof line.orderId === "string" && line.orderId ? { orderId: line.orderId } : {}),
    ...(typeof line.recipeId === "string" && line.recipeId ? { recipeId: line.recipeId } : {}),
  }
}

function cleanLines(raw: unknown): PlateLine[] {
  if (!Array.isArray(raw)) return []
  const out: PlateLine[] = []
  for (const row of raw) {
    if (!row || typeof row !== "object") continue
    const line = cleanLine(row as Partial<PlateLine>)
    if (line) out.push(line)
  }
  return out
}

function cleanRecipe(raw: Partial<KitchenRecipe> | null | undefined): KitchenRecipe | null {
  if (!raw || typeof raw.name !== "string" || !raw.name.trim()) return null
  const lines = cleanLines(raw.lines)
  const sourceUrl = optionalText(raw.sourceUrl)
  const roughText = optionalText(raw.roughText)
  const analysis = raw.analysis ? nutrientsFrom(raw.analysis) : undefined
  const published = raw.published ? nutrientsFrom(raw.published) : undefined
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : newId("rcp"),
    name: raw.name.trim(),
    servings: amount(raw.servings) || 1,
    lines,
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(roughText ? { roughText } : {}),
    ...(analysis && raw.analysis ? { analysis } : {}),
    ...(published && raw.published ? { published } : {}),
    ...(raw.draft === true ? { draft: true } : {}),
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
  const mode: PlateMode =
    raw.mode === "ingredients" || raw.mode === "recipe" || raw.mode === "single" || raw.mode === "combination" ? raw.mode : "single"
  const nutrientSnapshot = cleanSnapshot(raw.nutrientSnapshot)
  const photoId = optionalText(raw.photoId)
  const roughText = optionalText(raw.roughText)
  const where: EatWhere = raw.where === "out" ? "out" : "home"
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : newId("plt"),
    entryId: raw.entryId,
    accepted: raw.accepted === true,
    slot: raw.slot === "snack" ? "snack" : "meal",
    mode,
    lines: cleanLines(raw.lines),
    ...(typeof raw.recipeId === "string" && raw.recipeId ? { recipeId: raw.recipeId } : {}),
    ...(amount(raw.servings) > 0 ? { servings: amount(raw.servings) } : {}),
    fromKitchen: where === "out" ? false : raw.fromKitchen === true,
    drawn: cleanDrawn(raw.drawn),
    ...(nutrientSnapshot ? { nutrientSnapshot } : {}),
    where,
    ...(photoId ? { photoId } : {}),
    ...(roughText ? { roughText } : {}),
    ...(typeof raw.orderId === "string" && raw.orderId ? { orderId: raw.orderId } : {}),
    ...(raw.editedAfterAccept === true ? { editedAfterAccept: true } : {}),
  }
}

function cleanOrder(raw: Partial<KitchenOrder> | null | undefined): KitchenOrder | null {
  if (!raw || typeof raw.name !== "string" || !raw.name.trim()) return null
  const place = optionalText(raw.place) || ""
  const roughText = optionalText(raw.roughText)
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : newId("ord"),
    name: raw.name.trim(),
    place,
    where: raw.where === "out" ? "out" : "home",
    lines: cleanLines(raw.lines),
    ...(raw.pinned === true ? { pinned: true } : {}),
    ...(typeof raw.recipeId === "string" && raw.recipeId ? { recipeId: raw.recipeId } : {}),
    ...(roughText ? { roughText } : {}),
  }
}

const PLAN_MEALS: PlanMeal[] = ["breakfast", "lunch", "dinner", "snack"]

function cleanSlot(raw: Partial<MealPlanSlot> | null | undefined): MealPlanSlot | null {
  if (!raw || typeof raw.date !== "string" || !DATE_KEY.test(raw.date)) return null
  if (typeof raw.refId !== "string" || !raw.refId) return null
  if (raw.kind !== "recipe" && raw.kind !== "order") return null
  const meal = PLAN_MEALS.includes(raw.meal as PlanMeal) ? (raw.meal as PlanMeal) : "dinner"
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : newId("plan"),
    date: raw.date,
    meal,
    kind: raw.kind,
    refId: raw.refId,
    servings: amount(raw.servings) || 1,
  }
}

function cleanGrocery(raw: Partial<GroceryRow> | null | undefined): GroceryRow | null {
  if (!raw || typeof raw.name !== "string" || !raw.name.trim()) return null
  const qty = amount(raw.amount)
  if (qty <= 0) return null
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : newId("groc"),
    name: raw.name.trim(),
    ...(typeof raw.foodId === "string" && raw.foodId ? { foodId: raw.foodId } : {}),
    room: roomOf(raw.room),
    amount: qty,
    unit: unitOf(raw.unit),
    ...(raw.typed === true ? { typed: true } : {}),
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
  where?: EatWhere
  photoId?: string
  roughText?: string
  orderId?: string
  editedAfterAccept?: boolean
  /** Rewrite from a saved order. Does not mark the plate as edited. */
  applyingOrder?: boolean
}

interface KitchenState {
  foods: KitchenFood[]
  recipes: KitchenRecipe[]
  orders: KitchenOrder[]
  stock: KitchenStock[]
  plates: KitchenPlate[]
  plan: MealPlanSlot[]
  grocery: GroceryRow[]
  pinnedIds: string[]
  saveFood: (draft: Omit<KitchenFood, "id"> & { id?: string }) => KitchenFood
  saveRecipe: (draft: Omit<KitchenRecipe, "id"> & { id?: string }) => KitchenRecipe | null
  removeRecipe: (id: string) => void
  saveOrder: (draft: Omit<KitchenOrder, "id"> & { id?: string }) => KitchenOrder | null
  removeOrder: (id: string) => void
  pinFood: (id: string, pinned?: boolean) => void
  putAway: (draft: PutAwayDraft) => KitchenStock | null
  setStockAmount: (id: string, next: number) => void
  setStockUnit: (id: string, unit: StockUnit) => void
  setStockRoom: (id: string, room: KitchenRoom) => void
  markOpened: (id: string, day: string) => void
  markStillGood: (id: string, day: string) => void
  markFinished: (id: string) => void
  savePlate: (draft: PlateDraft) => KitchenPlate | null
  /** Rewrite one plate's snapshot from the foods now. Does not draw stock. */
  refreshPlateSnapshot: (entryId: string) => KitchenPlate | null
  /** Write an order's current lines onto plates that still follow it. */
  updatePastOrder: (orderId: string) => number
  removePlate: (entryId: string) => void
  /** Copy a plate onto another entry. Same lines and snapshot. Does not draw stock. */
  duplicatePlate: (fromEntryId: string, toEntryId: string) => KitchenPlate | null
  savePlanSlot: (draft: Omit<MealPlanSlot, "id"> & { id?: string }) => MealPlanSlot | null
  removePlanSlot: (id: string) => void
  addGrocery: (draft: Omit<GroceryRow, "id"> & { id?: string }) => GroceryRow | null
  removeGrocery: (id: string) => void
  /** Put the row away today and drop it from the list. */
  checkGrocery: (id: string, today: string) => KitchenStock | null
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
  const atHome = draft.where !== "out"
  const drawLines = !atHome
    ? []
    : lines.some((line) => line.origin === "stock")
      ? lines.filter((line) => line.origin === "stock")
      : draft.fromKitchen
        ? lines
        : []
  if (draft.accepted && drawLines.length) {
    const taken = drawFromStock(stock, drawLines, state.foods)
    stock = taken.stock
    drawn = taken.drawn
  }
  const linesChanged = lineSignature(previous?.lines) !== lineSignature(draft.lines)
  const editedAfterAccept = draft.applyingOrder
    ? false
    : draft.editedAfterAccept === true || (previous?.accepted === true && linesChanged) || previous?.editedAfterAccept === true
  const base = cleanPlate({ ...draft, id, drawn, editedAfterAccept: editedAfterAccept || undefined, fromKitchen: atHome && draft.fromKitchen })!
  const plate = base.accepted
    ? refreshNutrientSnapshot(base, (foodId) => resolveKitchenFood(foodId, state.foods), recipe)
    : base
  return { stock, plate }
}

function lineSignature(lines: readonly PlateLine[] | undefined): string {
  return (lines ?? []).map((line) => `${line.foodId}:${line.grams}`).join("|")
}

export function sanitizeKitchen(raw: unknown): Pick<KitchenState, "foods" | "recipes" | "orders" | "stock" | "plates" | "plan" | "grocery" | "pinnedIds"> {
  const body = (raw ?? {}) as Partial<KitchenState>
  const foods = Array.isArray(body.foods) ? body.foods.map((row) => cleanFood(row)).filter((row): row is KitchenFood => !!row) : []
  const recipes = Array.isArray(body.recipes) ? body.recipes.map((row) => cleanRecipe(row)).filter((row): row is KitchenRecipe => !!row) : []
  const orders = Array.isArray(body.orders) ? body.orders.map((row) => cleanOrder(row)).filter((row): row is KitchenOrder => !!row) : []
  const stock = Array.isArray(body.stock) ? body.stock.map((row) => cleanStock(row)).filter((row): row is KitchenStock => !!row) : []
  const plates = Array.isArray(body.plates) ? body.plates.map((row) => cleanPlate(row)).filter((row): row is KitchenPlate => !!row) : []
  const plan = Array.isArray(body.plan) ? body.plan.map((row) => cleanSlot(row)).filter((row): row is MealPlanSlot => !!row) : []
  const grocery = Array.isArray(body.grocery) ? body.grocery.map((row) => cleanGrocery(row)).filter((row): row is GroceryRow => !!row) : []
  const pinnedIds = Array.isArray(body.pinnedIds) ? body.pinnedIds.filter((id): id is string => typeof id === "string" && !!id) : []
  return { foods, recipes, orders, stock, plates, plan, grocery, pinnedIds }
}

export const useKitchenStore = create<KitchenState>()(
  persist(
    (set, get) => ({
      foods: [],
      recipes: [],
      orders: [],
      stock: [],
      plates: [],
      plan: [],
      grocery: [],
      pinnedIds: [],
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
      saveOrder: (draft) => {
        const order = cleanOrder(draft)
        if (!order) return null
        set({
          orders: get().orders.some((row) => row.id === order.id)
            ? get().orders.map((row) => (row.id === order.id ? order : row))
            : [...get().orders, order],
        })
        return order
      },
      removeOrder: (id) => set({ orders: get().orders.filter((row) => row.id !== id) }),
      pinFood: (id, pinned = true) => {
        const ids = new Set(get().pinnedIds)
        if (pinned) ids.add(id)
        else ids.delete(id)
        set({
          pinnedIds: [...ids],
          foods: get().foods.map((food) => (food.id === id ? { ...food, ...(pinned ? { pinned: true } : { pinned: undefined }) } : food)),
        })
      },
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
      setStockUnit: (id, unit) =>
        set({
          stock: get().stock.map((lot) => {
            if (lot.id !== id) return lot
            const next = unitOf(unit)
            if (next === lot.unit) return lot
            const food = resolveKitchenFood(lot.foodId, get().foods)
            const grams = stockToGrams(lot, food ?? { gramsPerUnit: lot.unit === "g" ? 1 : 0 } as KitchenFood)
            if (next === "g") return { ...lot, unit: next, amount: amount(grams) || lot.amount }
            if (lot.unit === "g" && next === "count" && food && food.gramsPerUnit > 0) {
              return { ...lot, unit: next, amount: amount(grams / food.gramsPerUnit) || lot.amount }
            }
            return { ...lot, unit: next }
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
      updatePastOrder: (orderId) => {
        const state = get()
        const order = state.orders.find((row) => row.id === orderId)
        if (!order) return 0
        let count = 0
        const plates = state.plates.map((plate) => {
          if (plate.orderId !== orderId || plate.editedAfterAccept) return plate
          const recipe = order.recipeId ? state.recipes.find((row) => row.id === order.recipeId) ?? null : null
          const next = refreshNutrientSnapshot(
            { ...plate, lines: order.lines.map((line) => ({ ...line, origin: line.origin ?? "order", orderId })), orderId, where: order.where },
            (foodId) => resolveKitchenFood(foodId, state.foods),
            recipe,
          )
          count += 1
          return { ...next, editedAfterAccept: undefined }
        })
        if (count) set({ plates })
        return count
      },
      removePlate: (entryId) => {
        const previous = get().plates.find((plate) => plate.entryId === entryId)
        set({
          plates: get().plates.filter((plate) => plate.entryId !== entryId),
          stock: restoreDrawn(get().stock, previous?.drawn ?? []),
        })
      },
      duplicatePlate: (fromEntryId, toEntryId) => {
        const source = get().plates.find((plate) => plate.entryId === fromEntryId)
        if (!source || !toEntryId || toEntryId === fromEntryId) return null
        if (get().plates.some((plate) => plate.entryId === toEntryId)) return null
        const plate: KitchenPlate = {
          ...source,
          id: newId("plt"),
          entryId: toEntryId,
          lines: source.lines.map((line) => ({ ...line })),
          drawn: [],
          ...(source.nutrientSnapshot ? { nutrientSnapshot: { ...source.nutrientSnapshot } } : {}),
        }
        set({ plates: [...get().plates, plate] })
        return plate
      },
      savePlanSlot: (draft) => {
        const slot = cleanSlot(draft)
        if (!slot) return null
        set({
          plan: get().plan.some((row) => row.id === slot.id)
            ? get().plan.map((row) => (row.id === slot.id ? slot : row))
            : [...get().plan, slot],
        })
        return slot
      },
      removePlanSlot: (id) => set({ plan: get().plan.filter((row) => row.id !== id) }),
      addGrocery: (draft) => {
        const row = cleanGrocery({ ...draft, typed: true })
        if (!row) return null
        set({ grocery: [...get().grocery, row] })
        return row
      },
      removeGrocery: (id) => set({ grocery: get().grocery.filter((row) => row.id !== id) }),
      checkGrocery: (id, today) => {
        const row = get().grocery.find((item) => item.id === id)
        if (!row) return null
        const lot = get().putAway({
          name: row.name,
          foodId: row.foodId,
          room: row.room,
          amount: row.amount,
          unit: row.unit,
          boughtOn: today,
        })
        if (lot) set({ grocery: get().grocery.filter((item) => item.id !== id) })
        return lot
      },
    }),
    {
      name: KITCHEN_STORAGE_KEY,
      version: 1,
      storage: createCogsJSONStorage(),
      partialize: (state) => ({
        foods: state.foods,
        recipes: state.recipes,
        orders: state.orders,
        stock: state.stock,
        plates: state.plates,
        plan: state.plan,
        grocery: state.grocery,
        pinnedIds: state.pinnedIds,
      }),
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
