"use client"

/**
 * components/Home/Tracking/tracking-log/food/food-detail-dialog.tsx — Food intake detail
 *
 * Meals and snacks for the open range. A multi-day range has a day rail; the
 * lists and the one nutrient grid follow the day in view. A line can be one
 * food, a list of ingredients, or a recipe. Move retargets the time entry,
 * and linked count ticks follow that date and certainty. Copy paints a new
 * instant and leaves the source ticks where they are.
 * "Sometime this week" files Monday with an unknown clock. The kitchen
 * and the recipe book sit on the other two tabs. Needs sits under the day's
 * nutrient grid.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FoodSearch, LabelPhoto, MacroShare, NutrientGrid } from "@/components/Home/Tracking/tracking-log/food/food-bits"
import { FoodNeeds } from "@/components/Home/Tracking/tracking-log/food/food-needs"
import {
  FoodDayRail,
  foodDayLabel,
  foodRailDays,
  foodRangeDayKeys,
  foodRangeIsSingleDay,
  foodRangeLabel,
  mondayKey,
} from "@/components/Home/Tracking/tracking-log/food/food-day-rail"
import { FoodIngredientList } from "@/components/Home/Tracking/tracking-log/food/food-ingredient-list"
import { FoodPeriodNotes } from "@/components/Home/Tracking/tracking-log/food/food-period-notes"
import { FoodPlainLog } from "@/components/Home/Tracking/tracking-log/food/food-plain-log"
import { FoodKitchenPanel } from "@/components/Home/Tracking/tracking-log/food/food-kitchen-panel"
import { FoodRecipesPanel } from "@/components/Home/Tracking/tracking-log/food/food-recipes-panel"
import { LogShelfRangeBar, useLogShelfRange } from "@/components/Home/Tracking/tracking-log/log-shelf-dialog"
import {
  compareLogRows,
  entriesForLogShelf,
  logRowWhenLabel,
  submitTrackingLog,
  type LogBookEntry,
} from "@/components/Home/Tracking/tracking-log-model"
import { useAttachmentSrc } from "@/components/use-attachment-src"
import { FoodDishSheet } from "@/components/Home/Tracking/tracking-log/food/food-dish-sheet"
import { syncCountTicksForEntry } from "@/lib/count-statuses"
import { formatLocalDateKey } from "@/lib/date-utils"
import { putAttachment } from "@/lib/attachments"
import { rememberBarcode } from "@/lib/kitchen-barcode"
import { daysLogged } from "@/lib/kitchen-diary"
import { formatNutrient, ZERO_NUTRIENTS, type Nutrients } from "@/lib/kitchen-nutrients"
import { gramsFromServings as gramsForCount, nutrientsForPlate, plateNutrients, servingsFromGrams as servingsForCount, totalsForPlates } from "@/lib/kitchen-plate"
import type { FoodHit } from "@/lib/kitchen-search"
import { resolveKitchenFood, useKitchenStore, type PlateDraft } from "@/lib/kitchen-store"
import type { EatWhere, KitchenFood, LineOrigin, MealPlanSlot, PlateLine, PlateMode, PlateSlot } from "@/lib/kitchen-types"
import { whereOf } from "@/lib/kitchen-types"
import { entryClockCertainty } from "@/lib/time-entries"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import "./food-detail.css"

/** Grams stay the stored amount. Servings are only a view of `gramsPerUnit`. */
function gramsFromServings(servings: number, gramsPerUnit: number): number {
  return gramsForCount(gramsPerUnit, servings) ?? 0
}

function servingsFromGrams(grams: number, gramsPerUnit: number): string {
  const servings = servingsForCount(gramsPerUnit, grams)
  return servings == null ? "" : String(servings)
}

function ensureFood(hit: FoodHit): string {
  if (hit.id.startsWith("cat_")) return hit.id
  const existing = useKitchenStore.getState().foods.find((food) => food.id === hit.id)
  if (existing) return existing.id
  return useKitchenStore.getState().saveFood({
    id: hit.id,
    name: hit.name,
    per100g: hit.per100g,
    gramsPerUnit: hit.gramsPerUnit || 100,
    source: hit.source === "catalog" ? "custom" : hit.source,
  }).id
}

function plateTitle(draft: PlateDraft, foods: ReturnType<typeof useKitchenStore.getState>["foods"], recipes: ReturnType<typeof useKitchenStore.getState>["recipes"]): string {
  if (draft.mode === "recipe") {
    return recipes.find((recipe) => recipe.id === draft.recipeId)?.name || (draft.slot === "snack" ? "Snack" : "Meal")
  }
  const names = draft.lines.map((line) => resolveKitchenFood(line.foodId, foods)?.name).filter((name): name is string => !!name)
  if (names.length === 0) return draft.slot === "snack" ? "Snack" : "Meal"
  if (names.length === 1) return names[0]
  return names.slice(0, 3).join(", ")
}

function MealThumb({ uri, alt = "Meal photo" }: { uri?: string; alt?: string }) {
  const src = useAttachmentSrc(uri)
  if (!src) return null
  return <img className="trk-food-thumb" src={src} alt={alt} width={36} height={36} />
}

const ORIGIN_LABEL: Record<LineOrigin, string> = {
  order: "Saved order",
  recipe: "Recipe",
  api: "Search",
  label: "Label",
  catalog: "On this device",
  stock: "Kitchen",
}

function PlateLineRow({
  line,
  food,
  onGrams,
  onOrigin,
  onRemove,
}: {
  line: PlateLine
  food: KitchenFood | null
  onGrams: (grams: number) => void
  onOrigin: (origin: LineOrigin) => void
  onRemove: () => void
}) {
  const name = food?.name || "Food"
  const unit = food && food.gramsPerUnit > 0 ? food.gramsPerUnit : 0
  const [gramsText, setGramsText] = useState(String(line.grams))
  const [servingsText, setServingsText] = useState(unit ? servingsFromGrams(line.grams, unit) : "")
  const gramsEditing = useRef(false)
  const servingsEditing = useRef(false)

  useEffect(() => {
    if (!gramsEditing.current) setGramsText(String(line.grams))
    if (!servingsEditing.current && unit) setServingsText(servingsFromGrams(line.grams, unit))
  }, [line.grams, unit])

  return (
    <li className="trk-food-line">
      {unit > 0 ? (
        <label>
          Servings
          <input
            aria-label={`Servings of ${name}`}
            inputMode="decimal"
            value={servingsText}
            onChange={(event) => {
              const raw = event.target.value
              servingsEditing.current = true
              gramsEditing.current = false
              setServingsText(raw)
              const n = Number(raw)
              if (raw.trim() !== "" && Number.isFinite(n) && n >= 0) onGrams(gramsFromServings(n, unit))
            }}
            onBlur={() => {
              servingsEditing.current = false
              setServingsText(servingsFromGrams(line.grams, unit))
            }}
          />
        </label>
      ) : null}
      {unit > 0 ? (
        <div className="trk-food-caps trk-food-fractions" role="group" aria-label={`Household servings of ${name}`}>
          {(
            [
              ["Half", 0.5],
              ["One", 1],
              ["Two", 2],
            ] as const
          ).map(([label, count]) => (
            <button key={label} type="button" data-no95="" className="trk-keycap" onClick={() => onGrams(gramsFromServings(count, unit))}>
              {label}
            </button>
          ))}
        </div>
      ) : null}
      <label>
        Grams
        <input
          aria-label={`Grams of ${name}`}
          inputMode="decimal"
          value={gramsText}
          onChange={(event) => {
            const raw = event.target.value
            gramsEditing.current = true
            servingsEditing.current = false
            setGramsText(raw)
            const n = Number(raw)
            if (raw.trim() !== "" && Number.isFinite(n) && n >= 0) onGrams(n)
          }}
          onBlur={() => {
            gramsEditing.current = false
            setGramsText(String(line.grams))
          }}
        />
      </label>
      {unit > 0 ? <span className="trk-food-unit">× {unit} g</span> : null}
      <span className="trk-food-line-name">{name}</span>
      <button
        type="button"
        data-no95=""
        className="trk-keycap"
        aria-pressed={line.origin === "stock"}
        onClick={() => onOrigin(line.origin === "stock" ? "catalog" : "stock")}
      >
        Kitchen lot
      </button>
      <button type="button" data-no95="" className="trk-keycap" onClick={onRemove}>
        Remove
      </button>
    </li>
  )
}

function subtotalLine(row: Nutrients): string {
  return `${formatNutrient("kcal", row.kcal)} · ${formatNutrient("proteinG", row.proteinG)} protein · ${formatNutrient("fatG", row.fatG)} fat`
}

export function FoodDetailDialog({
  open,
  onOpenChange,
  anchor,
  entries,
  onOpenEntry,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  anchor: Date
  entries: readonly LogBookEntry[]
  onOpenEntry: (id: string) => void
}) {
  const foods = useKitchenStore((s) => s.foods)
  const recipes = useKitchenStore((s) => s.recipes)
  const orders = useKitchenStore((s) => s.orders)
  const plates = useKitchenStore((s) => s.plates)
  const timeEntries = useTimeTrackingStore((s) => s.entries)
  const [tab, setTab] = useState<"eaten" | "kitchen" | "recipes">("eaten")
  const [where, setWhere] = useState<"all" | EatWhere>("all")
  const [draft, setDraft] = useState<PlateDraft | null>(null)
  const [dayKey, setDayKey] = useState<string | null>(null)
  const [fileOn, setFileOn] = useState("")
  const [weekFuzzy, setWeekFuzzy] = useState(false)
  const shelf = useLogShelfRange(open, anchor)
  const shown = useMemo(() => entriesForLogShelf(entries, shelf.bounds), [entries, shelf.bounds])
  const single = foodRangeIsSingleDay(shelf.range, shelf.bounds)
  const rangeLabel = foodRangeLabel(shelf.range, shelf.bounds)
  const railKeys = useMemo(
    () => foodRailDays(shelf.range, shelf.bounds, shown.map((row) => row.date)),
    [shelf.range, shelf.bounds, shown],
  )

  useEffect(() => {
    setDayKey((current) => {
      if (!current) return current
      if (single || !railKeys.includes(current)) return null
      return current
    })
  }, [single, railKeys])

  const viewed = dayKey ? shown.filter((row) => row.date === dayKey) : shown
  const eaten = where === "all"
    ? viewed
    : viewed.filter((entry) => {
        const plate = plates.find((row) => row.entryId === entry.id)
        return !!plate && whereOf(plate) === where
      })
  const logDay = dayKey ?? (single && shelf.bounds ? shelf.bounds.fromKey : null)
  const resolve = (id: string) => resolveKitchenFood(id, foods)
  const totalsFor = (rows: readonly LogBookEntry[]) => {
    const ids = new Set(rows.map((row) => row.id))
    return totalsForPlates(
      plates.filter((plate) => ids.has(plate.entryId)),
      resolve,
      recipes,
    )
  }
  const rangeTotals = useMemo(() => totalsFor(shown), [shown, plates, foods, recipes])
  const viewTotals = useMemo(() => totalsFor(eaten), [eaten, plates, foods, recipes])

  const addDateKey = () => {
    if (dayKey) return dayKey
    if (single && shelf.bounds) return shelf.bounds.fromKey
    return formatLocalDateKey(anchor)
  }

  const sourceOf = (id: string): LogBookEntry | null => {
    const fromProp = entries.find((row) => row.id === id)
    if (fromProp) return fromProp
    const live = useTimeTrackingStore.getState().entries.find((row) => row.id === id)
    if (!live) return null
    return { ...live, list: "food", kindKey: live.intakeClass ? `intake.${live.intakeClass}` : "intake.food" }
  }

  const openDraft = (entryId: string, slot: PlateSlot = "meal") => {
    const plate = plates.find((row) => row.entryId === entryId)
    const row = entries.find((entry) => entry.id === entryId)
    setFileOn(row?.date ?? addDateKey())
    setWeekFuzzy(false)
    setDraft(
      plate
        ? {
            entryId,
            accepted: plate.accepted,
            slot: plate.slot,
            mode: plate.mode,
            lines: plate.lines,
            recipeId: plate.recipeId,
            servings: plate.servings ?? 1,
            fromKitchen: plate.fromKitchen,
            where: plate.where ?? "home",
            photoId: plate.photoId,
            orderId: plate.orderId,
          }
        : { entryId, accepted: false, slot, mode: "single", lines: [], fromKitchen: false, where: "home" },
    )
    setTab("eaten")
  }

  const addLogged = (slot: PlateSlot) => {
    const date = addDateKey()
    const now = new Date()
    const minute = date === formatLocalDateKey(now) ? now.getHours() * 60 + now.getMinutes() : 12 * 60
    const id = submitTrackingLog({
      date,
      title: slot === "snack" ? "Snack" : "Meal",
      mode: "intake",
      intakeClass: "food",
      clock: "exact",
      minute,
    })
    if (!id) return
    setFileOn(date)
    setWeekFuzzy(false)
    setDraft({ entryId: id, accepted: false, slot, mode: "single", lines: [], fromKitchen: false, where: "home" })
    setTab("eaten")
  }

  const fileMove = (entryId: string, date: string, fuzzy: boolean) => {
    const target = fuzzy ? mondayKey(date) : date
    if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) return
    useTimeTrackingStore.getState().updateEntry(entryId, {
      date: target,
      clockCertainty: fuzzy ? "unknown" : "exact",
    })
    syncCountTicksForEntry(entryId)
    setFileOn(target)
  }

  const fileCopy = (source: LogBookEntry, date: string, fuzzy: boolean) => {
    const target = fuzzy ? mondayKey(date) : date
    if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) return
    const certainty = fuzzy ? "unknown" : entryClockCertainty(source)
    const clock = certainty === "estimated" ? "estimated" : certainty === "unknown" ? "unknown" : "exact"
    const id = submitTrackingLog({
      date: target,
      title: source.title?.trim() || "Meal",
      mode: "intake",
      intakeClass: "food",
      clock,
      minute: source.startMin,
    })
    if (!id) return
    const plate = useKitchenStore.getState().plates.find((row) => row.entryId === source.id)
    if (!plate) return
    const next: PlateDraft = {
      entryId: id,
      accepted: true,
      slot: plate.slot,
      mode: plate.mode,
      lines: plate.lines.map((line) => ({ ...line })),
      recipeId: plate.recipeId,
      servings: plate.servings,
      fromKitchen: plate.fromKitchen,
      where: plate.where,
      photoId: plate.photoId,
      orderId: plate.orderId,
    }
    const saved = useKitchenStore.getState().savePlate(next)
    if (!saved) return
    const title = plateTitle(next, useKitchenStore.getState().foods, useKitchenStore.getState().recipes)
    useTimeTrackingStore.getState().updateEntry(id, { title })
  }

  const accept = () => {
    if (!draft) return
    const saved = useKitchenStore.getState().savePlate({ ...draft, accepted: true })
    if (!saved) return
    const title = plateTitle(draft, useKitchenStore.getState().foods, useKitchenStore.getState().recipes)
    useTimeTrackingStore.getState().updateEntry(draft.entryId, { title })
    setDraft({ ...draft, accepted: true })
  }

  const originFor = (hit: FoodHit): LineOrigin => {
    if (hit.source === "usda" || hit.source === "off") return "api"
    if (hit.source === "label") return "label"
    return "catalog"
  }

  const addHit = (hit: FoodHit, gramsOverride?: number, origin?: LineOrigin) => {
    if (!draft) return
    const id = ensureFood(hit)
    const grams = gramsOverride && gramsOverride > 0 ? gramsOverride : hit.gramsPerUnit || 100
    const lineOrigin = origin ?? originFor(hit)
    if (draft.mode === "combination") {
      setDraft({ ...draft, lines: [...draft.lines, { foodId: id, grams, origin: lineOrigin }] })
      return
    }
    setDraft({
      ...draft,
      mode: draft.mode === "recipe" ? "ingredients" : draft.mode,
      lines:
        draft.mode === "single"
          ? [{ foodId: id, grams, origin: lineOrigin }]
          : draft.lines.some((line) => line.foodId === id)
            ? draft.lines.map((line) => (line.foodId === id ? { ...line, grams: line.grams + grams } : line))
            : [...draft.lines, { foodId: id, grams, origin: lineOrigin }],
    })
  }

  const openLoggedDraft = (date: string, slot: PlateSlot, title: string, next: Omit<PlateDraft, "entryId" | "accepted" | "slot">) => {
    const now = new Date()
    const minute = date === formatLocalDateKey(now) ? now.getHours() * 60 + now.getMinutes() : 12 * 60
    const id = submitTrackingLog({
      date,
      title,
      mode: "intake",
      intakeClass: "food",
      clock: "exact",
      minute,
    })
    if (!id) return
    setFileOn(date)
    setWeekFuzzy(false)
    setDraft({ ...next, entryId: id, accepted: false, slot })
    setTab("eaten")
  }

  const logPlan = (slot: MealPlanSlot) => {
    if (slot.kind === "recipe") {
      const recipe = recipes.find((row) => row.id === slot.refId)
      openLoggedDraft(slot.date, slot.meal === "snack" ? "snack" : "meal", recipe?.name || "Meal", {
        mode: "recipe",
        lines: [],
        recipeId: slot.refId,
        servings: slot.servings || 1,
        fromKitchen: false,
        where: "home",
      })
      return
    }
    const order = orders.find((row) => row.id === slot.refId)
    if (!order) return
    openLoggedDraft(slot.date, slot.meal === "snack" ? "snack" : "meal", order.name, {
      mode: "combination",
      lines: order.lines.map((line) => ({ ...line, origin: line.origin ?? "order", orderId: order.id })),
      fromKitchen: false,
      where: order.where,
      orderId: order.id,
    })
  }

  const logUsual = (orderId: string) => {
    const order = orders.find((row) => row.id === orderId)
    if (!order) return
    openLoggedDraft(addDateKey(), "meal", order.name, {
      mode: "combination",
      lines: order.lines.map((line) => ({ ...line, origin: "order", orderId: order.id })),
      fromKitchen: false,
      where: order.where,
      orderId: order.id,
    })
  }

  const ordered = [...eaten].sort(compareLogRows)
  const groups: { id: string; title: string; slot: PlateSlot | null; rows: LogBookEntry[] }[] = [
    { id: "meal", title: "Meals", slot: "meal", rows: ordered.filter((entry) => plates.find((plate) => plate.entryId === entry.id)?.slot === "meal") },
    { id: "snack", title: "Snacks", slot: "snack", rows: ordered.filter((entry) => plates.find((plate) => plate.entryId === entry.id)?.slot === "snack") },
    { id: "open", title: "Not filed yet", slot: null, rows: ordered.filter((entry) => !plates.some((plate) => plate.entryId === entry.id)) },
  ]

  const preview = draft
    ? plateNutrients(
        draft,
        resolve,
        draft.recipeId ? recipes.find((recipe) => recipe.id === draft.recipeId) ?? null : null,
      )
    : ZERO_NUTRIENTS

  const whereLabel = where === "home" ? "At home" : where === "out" ? "Eating out" : ""
  const viewScope = [dayKey ? foodDayLabel(dayKey) : rangeLabel, whereLabel].filter(Boolean).join(" · ")
  const mealsLabel = ["Meals", dayKey ? foodDayLabel(dayKey) : "", whereLabel].filter(Boolean).join(" · ")
  const snacksLabel = ["Snacks", dayKey ? foodDayLabel(dayKey) : "", whereLabel].filter(Boolean).join(" · ")
  const gridHeading = dayKey ? foodDayLabel(dayKey) : rangeLabel
  const notePeriod = shelf.range === "month" ? "month" : shelf.range === "all" ? "year" : shelf.range === "custom" ? "custom" : "week"
  const noteDays = shelf.range === "custom" && shelf.bounds ? foodRangeDayKeys(shelf.bounds.fromKey, shelf.bounds.toKey) : []
  const rail = railKeys.map((key) => {
    const ids = new Set(shown.filter((row) => row.date === key).map((row) => row.id))
    const row = totalsForPlates(
      plates.filter((plate) => ids.has(plate.entryId)),
      resolve,
      recipes,
    ).day
    return { key, label: foodDayLabel(key), kcal: Math.round(row.kcal), proteinG: row.proteinG, carbG: row.carbG, fatG: row.fatG }
  })
  const trend = rail
  const loggedCount = daysLogged(
    plates
      .filter((plate) => plate.accepted)
      .map((plate) => timeEntries.find((row) => row.id === plate.entryId)?.date ?? ""),
    anchor,
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="trk95 trk-dialog trk-shelf-dialog trk-food-dialog sm:max-w-6xl max-h-[85vh] overflow-y-auto"
        data-ui-name="Food detail"
        data-ui-docs="components/Home/Tracking/README.md"
        data-item-layer=""
      >
        <DialogHeader className="trk-dialog-head">
          <DialogTitle>Food</DialogTitle>
          <DialogDescription>Meals, snacks, nutrients, and what is in the kitchen.</DialogDescription>
          <p className="trk-food-range-head">{rangeLabel}</p>
        </DialogHeader>
        <div className="trk-food-caps trk-food-tabs" role="tablist" aria-label="Food detail">
          {(
            [
              ["eaten", "Eaten"],
              ["kitchen", "Kitchen"],
              ["recipes", "Recipes"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" data-no95="" className="trk-keycap" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        {tab === "kitchen" ? <FoodKitchenPanel /> : null}
        {tab === "recipes" ? <FoodRecipesPanel anchor={anchor} onLog={logPlan} onUsual={logUsual} /> : null}
        {tab === "eaten" ? (
          <div className={draft ? "trk-food-eaten trk-food-split" : "trk-food-eaten"}>
            <div className="trk-food-diary">
            <LogShelfRangeBar
              range={shelf.range}
              onRange={shelf.setRange}
              from={shelf.from}
              to={shelf.to}
              onFrom={shelf.setFrom}
              onTo={shelf.setTo}
              anchor={anchor}
              caps
            />
            <div className="trk-food-caps trk-food-segment" role="group" aria-label="Where">
              {(
                [
                  ["all", "All"],
                  ["home", "At home"],
                  ["out", "Eating out"],
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" data-no95="" className="trk-keycap" aria-pressed={where === id} onClick={() => setWhere(id)}>
                  {label}
                </button>
              ))}
            </div>
            <p className="trk-food-streak"><span>Days logged</span> <strong>{loggedCount}</strong></p>
            <p className="trk-food-kcal-hero">
              <span>{viewScope}</span>
              <strong>{formatNutrient("kcal", viewTotals.day.kcal)}</strong>
            </p>
            <div className="trk-food-kpis" aria-label="Calories">
              <p><span>{mealsLabel}</span><strong>{formatNutrient("kcal", viewTotals.meals.kcal)}</strong></p>
              <p><span>{snacksLabel}</span><strong>{formatNutrient("kcal", viewTotals.snacks.kcal)}</strong></p>
              <p><span>{rangeLabel}</span><strong>{formatNutrient("kcal", rangeTotals.day.kcal)}</strong></p>
            </div>
            <MacroShare row={viewTotals.day} scope={viewScope} />
            <FoodDayRail
              days={rail}
              selected={dayKey}
              onSelect={(key) => setDayKey((current) => (current === key ? null : key))}
            />
            {!single && rail.length > 1 ? (
              <table className="trk-food-trend">
                <caption>Each day</caption>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Calories</th>
                    <th>Protein</th>
                    <th>Carbs</th>
                    <th>Fat</th>
                  </tr>
                </thead>
                <tbody>
                  {trend.map((day) => (
                    <tr key={day.key}>
                      <td>{day.label}</td>
                      <td>{day.kcal}</td>
                      <td>{Math.round(day.proteinG)}</td>
                      <td>{Math.round(day.carbG)}</td>
                      <td>{Math.round(day.fatG)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            {eaten.length === 0 ? (
              <p className="trk-shelf-empty">{logDay ? "Nothing eaten this day." : "Nothing logged in this range."}</p>
            ) : null}
            {groups.filter((group) => group.slot != null || group.rows.length > 0).map((group) => {
                const accepted = group.slot
                  ? group.rows.some((row) => plates.some((plate) => plate.entryId === row.id && plate.accepted && plate.slot === group.slot))
                  : false
                const line = accepted
                  ? subtotalLine(group.slot === "snack" ? viewTotals.snacks : viewTotals.meals)
                  : null
                return (
                  <section key={group.id} aria-label={group.title}>
                    <h4 className="trk-food-rows-head">
                      <span>{group.title}</span>
                      {group.slot ? (
                        <button type="button" data-no95="" className="trk-keycap" onClick={() => addLogged(group.slot as PlateSlot)}>
                          {group.slot === "snack" ? "Add a snack" : "Add a meal"}
                        </button>
                      ) : null}
                    </h4>
                    {line ? <p className="trk-food-subtotal">{line}</p> : null}
                    <ul className="trk-food-rows">
                      {group.rows.map((entry) => {
                        const plate = plates.find((row) => row.entryId === entry.id)
                        const when = logRowWhenLabel(entry, { showDate: !dayKey && shelf.showDate })
                        const kcal = plate?.accepted
                          ? Math.round(
                              nutrientsForPlate(
                                plate,
                                resolve,
                                plate.recipeId ? recipes.find((recipe) => recipe.id === plate.recipeId) ?? null : null,
                              ).kcal,
                            )
                          : null
                        return (
                          <li key={entry.id}>
                            <button
                              type="button"
                              className="trk-food-diary-row"
                              aria-pressed={draft?.entryId === entry.id}
                              onClick={() => openDraft(entry.id, plate?.slot ?? "meal")}
                            >
                              {plate?.photoId ? <MealThumb uri={plate.photoId} alt="" /> : null}
                              <span className="trk-food-row-main">
                                {when.when ? <span className="trk-food-row-when">{when.when}</span> : null}
                                {when.badge ? <span>{when.badge}</span> : null}
                                <span className="trk-food-row-title">{entry.title?.trim() || "Untitled"}</span>
                              </span>
                              {kcal != null ? <span className="trk-food-row-kcal">{kcal} kcal</span> : null}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )
              })
            }
            {logDay ? <FoodPlainLog day={logDay} rows={eaten} plates={plates} /> : null}
            {!single ? <FoodPeriodNotes period={notePeriod} anchor={anchor} days={noteDays} /> : null}
            <NutrientGrid row={viewTotals.day} heading={gridHeading} />
            <FoodNeeds />
            </div>
            {draft ? (
              <form
                className="trk-food-plate"
                aria-label="Plate"
                onSubmit={(event) => {
                  event.preventDefault()
                  accept()
                }}
              >
                <div className="trk-food-plate-head">
                <div className="trk-food-file">
                  <label>
                    Day
                    <input
                      type="date"
                      aria-label="Day"
                      value={fileOn}
                      onChange={(event) => {
                        setFileOn(event.target.value)
                        setWeekFuzzy(false)
                      }}
                    />
                  </label>
                  <div className="trk-food-plate-actions">
                    <button
                      type="button"
                      data-no95=""
                      className="trk-keycap"
                      onClick={() => {
                        if (!fileOn) return
                        fileMove(draft.entryId, fileOn, weekFuzzy)
                      }}
                    >
                      Move
                    </button>
                    <button
                      type="button"
                      data-no95=""
                      className="trk-keycap"
                      onClick={() => {
                        const source = sourceOf(draft.entryId)
                        if (!source || !fileOn) return
                        fileCopy(source, fileOn, weekFuzzy)
                      }}
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      data-no95=""
                      className="trk-keycap"
                      aria-pressed={weekFuzzy}
                      onClick={() => {
                        const base = fileOn || sourceOf(draft.entryId)?.date || formatLocalDateKey(anchor)
                        const monday = mondayKey(base)
                        setFileOn(monday)
                        setWeekFuzzy(true)
                        fileMove(draft.entryId, monday, true)
                      }}
                    >
                      Sometime this week
                    </button>
                  </div>
                </div>
                <button type="submit" data-no95="" className="trk-keycap trk-food-accept-top">{draft.accepted ? "Save" : "Accept"}</button>
                </div>
                <div className="trk-food-caps trk-food-segment" role="group" aria-label="Meal or snack">
                  {(["meal", "snack"] as const).map((slot) => (
                    <button key={slot} type="button" data-no95="" className="trk-keycap" aria-pressed={draft.slot === slot} onClick={() => setDraft({ ...draft, slot })}>
                      {slot === "meal" ? "Meal" : "Snack"}
                    </button>
                  ))}
                </div>
                <div className="trk-food-caps trk-food-segment" role="group" aria-label="Where this plate was eaten">
                  {(["home", "out"] as const).map((place) => (
                    <button
                      key={place}
                      type="button"
                      data-no95=""
                      className="trk-keycap"
                      aria-pressed={(draft.where ?? "home") === place}
                      onClick={() => setDraft({ ...draft, where: place, fromKitchen: place === "out" ? false : draft.fromKitchen })}
                    >
                      {place === "home" ? "At home" : "Eating out"}
                    </button>
                  ))}
                </div>
                <div className="trk-food-caps trk-food-segment" role="group" aria-label="How this plate is built">
                  {(
                    [
                      ["single", "One food"],
                      ["ingredients", "Ingredients"],
                      ["recipe", "Recipe"],
                      ["combination", "Mix"],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      data-no95=""
                      className="trk-keycap"
                      aria-pressed={draft.mode === mode}
                      onClick={() => setDraft({ ...draft, mode: mode as PlateMode })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {draft.mode === "recipe" ? (
                  <label>
                    Recipe
                    <select
                      aria-label="Recipe"
                      value={draft.recipeId ?? ""}
                      onChange={(event) => setDraft({ ...draft, recipeId: event.target.value, servings: draft.servings ?? 1 })}
                    >
                      <option value="">Choose</option>
                      {recipes.map((recipe) => (
                        <option key={recipe.id} value={recipe.id}>{recipe.name}</option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <>
                    <FoodSearch label="Search foods" onPick={addHit} />
                    <LabelPhoto
                      onUse={(label) => {
                        const saved = useKitchenStore.getState().saveFood({
                          name: label.name,
                          per100g: label.per100g,
                          gramsPerUnit: label.grams,
                          source: "label",
                          ...(label.barcode ? { barcode: label.barcode } : {}),
                        })
                        if (label.barcode) rememberBarcode(label.barcode, saved.id)
                        addHit({
                          id: saved.id,
                          name: saved.name,
                          per100g: saved.per100g,
                          gramsPerUnit: label.grams,
                          source: "label",
                        })
                      }}
                    />
                    <FoodDishSheet onUse={(hit) => addHit(hit)} />
                    <FoodIngredientList
                      commitLabel="Add to this plate"
                      onAdd={(picked) => {
                        if (!draft) return
                        let next = draft
                        for (const row of picked) {
                          const id = ensureFood(row.hit)
                          const grams = row.grams > 0 ? row.grams : row.hit.gramsPerUnit || 100
                          const lines = next.lines.some((line) => line.foodId === id)
                            ? next.lines.map((line) => (line.foodId === id ? { ...line, grams } : line))
                            : [...next.lines, { foodId: id, grams }]
                          next = { ...next, mode: next.mode === "single" ? "ingredients" : next.mode, lines }
                        }
                        setDraft(next)
                      }}
                    />
                  </>
                )}
                {draft.mode === "recipe" ? (
                  <label>
                    Servings
                    <input
                      aria-label="Servings eaten"
                      inputMode="decimal"
                      value={String(draft.servings ?? 1)}
                      onChange={(event) => setDraft({ ...draft, servings: Number(event.target.value) })}
                    />
                  </label>
                ) : draft.mode === "combination" ? (
                  <div className="trk-food-mix">
                    {(["order", "recipe", "api", "label", "catalog", "stock"] as const).map((origin) => {
                      const rows = draft.lines.filter((line) => (line.origin ?? "catalog") === origin)
                      if (rows.length === 0) return null
                      return (
                        <section key={origin} aria-label={ORIGIN_LABEL[origin]}>
                          <p>{ORIGIN_LABEL[origin]}</p>
                          <ul>
                            {rows.map((line) => (
                              <PlateLineRow
                                key={`${origin}:${line.foodId}`}
                                line={line}
                                food={resolve(line.foodId)}
                                onGrams={(grams) =>
                                  setDraft({
                                    ...draft,
                                    lines: draft.lines.map((row) => (row.foodId === line.foodId && (row.origin ?? "catalog") === origin ? { ...row, grams } : row)),
                                  })
                                }
                                onOrigin={(next) =>
                                  setDraft({
                                    ...draft,
                                    lines: draft.lines.map((row) => (row.foodId === line.foodId ? { ...row, origin: next } : row)),
                                  })
                                }
                                onRemove={() => setDraft({ ...draft, lines: draft.lines.filter((row) => !(row.foodId === line.foodId && (row.origin ?? "catalog") === origin)) })}
                              />
                            ))}
                          </ul>
                        </section>
                      )
                    })}
                  </div>
                ) : (
                  <ul>
                    {draft.lines.map((line: PlateLine) => (
                      <PlateLineRow
                        key={line.foodId}
                        line={line}
                        food={resolve(line.foodId)}
                        onGrams={(grams) =>
                          setDraft({
                            ...draft,
                            lines: draft.lines.map((row) => (row.foodId === line.foodId ? { ...row, grams } : row)),
                          })
                        }
                        onOrigin={(next) =>
                          setDraft({
                            ...draft,
                            lines: draft.lines.map((row) => (row.foodId === line.foodId ? { ...row, origin: next } : row)),
                          })
                        }
                        onRemove={() => setDraft({ ...draft, lines: draft.lines.filter((row) => row.foodId !== line.foodId) })}
                      />
                    ))}
                  </ul>
                )}
                <MacroShare row={preview} scope="This plate" />
                <NutrientGrid row={preview} heading="This plate" />
                <label>
                  Meal photo
                  <input
                    aria-label="Meal photo"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      event.target.value = ""
                      if (!file || !draft) return
                      void putAttachment(`meal_${draft.entryId}`, file, { name: file.name || "meal", mime: file.type || "image/jpeg" }).then((uri) => {
                        setDraft((current) => (current && current.entryId === draft.entryId ? { ...current, photoId: uri } : current))
                      })
                    }}
                  />
                </label>
                {draft.photoId ? <MealThumb uri={draft.photoId} /> : null}
                <button
                  type="button"
                  data-no95=""
                  className="trk-keycap"
                  onClick={() => {
                    if (!draft.lines.length && draft.mode !== "recipe") return
                    useKitchenStore.getState().saveOrder({
                      name: plateTitle(draft, foods, recipes),
                      place: "",
                      where: draft.where ?? "home",
                      lines: draft.lines,
                    })
                  }}
                >
                  Save as usual
                </button>
                <label className="trk-food-check">
                  <input
                    type="checkbox"
                    checked={draft.fromKitchen}
                    onChange={(event) => setDraft({ ...draft, fromKitchen: event.target.checked })}
                  />
                  From the kitchen
                </label>
                <div className="trk-food-plate-actions">
                  <button type="submit" data-no95="" className="trk-keycap">{draft.accepted ? "Save" : "Accept"}</button>
                  <button type="button" data-no95="" className="trk-keycap" onClick={() => onOpenEntry(draft.entryId)}>
                    Edit the clock
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
