"use client"

/**
 * components/Home/Tracking/tracking-log/food/food-detail-dialog.tsx — Food intake detail
 *
 * Meals and snacks for the open range. A multi-day range has a day rail; the
 * lists and the one nutrient grid follow the day in view. A line can be one
 * food, a list of ingredients, or a recipe. Move and copy retarget the time
 * entry. "Sometime this week" files Monday with an unknown clock. The kitchen
 * and the recipe book sit on the other two tabs.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FoodSearch, LabelPhoto, NutrientGrid } from "@/components/Home/Tracking/tracking-log/food/food-bits"
import {
  FoodDayRail,
  foodDayLabel,
  foodRailDays,
  foodRangeIsSingleDay,
  foodRangeLabel,
  mondayKey,
} from "@/components/Home/Tracking/tracking-log/food/food-day-rail"
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
import { formatLocalDateKey } from "@/lib/date-utils"
import { rememberBarcode } from "@/lib/kitchen-barcode"
import { formatNutrient, ZERO_NUTRIENTS, type Nutrients } from "@/lib/kitchen-nutrients"
import { gramsFromServings as gramsForCount, nutrientsForPlate, plateNutrients, servingsFromGrams as servingsForCount, totalsForPlates } from "@/lib/kitchen-plate"
import type { FoodHit } from "@/lib/kitchen-search"
import { resolveKitchenFood, useKitchenStore, type PlateDraft } from "@/lib/kitchen-store"
import type { KitchenFood, PlateLine, PlateMode, PlateSlot } from "@/lib/kitchen-types"
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

function PlateLineRow({
  line,
  food,
  onGrams,
  onRemove,
}: {
  line: PlateLine
  food: KitchenFood | null
  onGrams: (grams: number) => void
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
      <span>{name}</span>
      {unit > 0 ? (
        <>
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
          <span className="trk-food-unit">× {unit} g</span>
        </>
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
      <button type="button" onClick={onRemove}>
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
  const plates = useKitchenStore((s) => s.plates)
  const [tab, setTab] = useState<"eaten" | "kitchen" | "recipes">("eaten")
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
  const viewTotals = useMemo(() => totalsFor(viewed), [viewed, plates, foods, recipes])

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
          }
        : { entryId, accepted: false, slot, mode: "single", lines: [], fromKitchen: false },
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
    setDraft({ entryId: id, accepted: false, slot, mode: "single", lines: [], fromKitchen: false })
    setTab("eaten")
  }

  const fileMove = (entryId: string, date: string, fuzzy: boolean) => {
    const target = fuzzy ? mondayKey(date) : date
    if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) return
    useTimeTrackingStore.getState().updateEntry(entryId, {
      date: target,
      clockCertainty: fuzzy ? "unknown" : "exact",
    })
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

  const addHit = (hit: FoodHit) => {
    if (!draft) return
    const id = ensureFood(hit)
    const grams = hit.gramsPerUnit || 100
    setDraft({
      ...draft,
      mode: draft.mode === "recipe" ? "ingredients" : draft.mode,
      lines:
        draft.mode === "single"
          ? [{ foodId: id, grams }]
          : draft.lines.some((line) => line.foodId === id)
            ? draft.lines.map((line) => (line.foodId === id ? { ...line, grams: line.grams + grams } : line))
            : [...draft.lines, { foodId: id, grams }],
    })
  }

  const ordered = [...viewed].sort(compareLogRows)
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

  const gridHeading = dayKey ? foodDayLabel(dayKey) : rangeLabel
  const rail = railKeys.map((key) => {
    const ids = new Set(shown.filter((row) => row.date === key).map((row) => row.id))
    const kcal = totalsForPlates(
      plates.filter((plate) => ids.has(plate.entryId)),
      resolve,
      recipes,
    ).day.kcal
    return { key, label: foodDayLabel(key), kcal: Math.round(kcal) }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="trk95 trk-dialog trk-shelf-dialog trk-food-dialog sm:max-w-3xl max-h-[85vh] overflow-y-auto"
        data-ui-name="Food detail"
        data-ui-docs="components/Home/Tracking/README.md"
      >
        <DialogHeader className="trk-dialog-head">
          <DialogTitle>Food</DialogTitle>
          <DialogDescription>Meals, snacks, nutrients, and what is in the kitchen.</DialogDescription>
        </DialogHeader>
        <div className="trk-span-switch" role="tablist" aria-label="Food detail">
          {(
            [
              ["eaten", "Eaten"],
              ["kitchen", "Kitchen"],
              ["recipes", "Recipes"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        {tab === "kitchen" ? <FoodKitchenPanel /> : null}
        {tab === "recipes" ? <FoodRecipesPanel /> : null}
        {tab === "eaten" ? (
          <div className="trk-food-eaten">
            <LogShelfRangeBar
              range={shelf.range}
              onRange={shelf.setRange}
              from={shelf.from}
              to={shelf.to}
              onFrom={shelf.setFrom}
              onTo={shelf.setTo}
              anchor={anchor}
            />
            <div className="trk-food-kpis" aria-label="Calories">
              <p><span>Meals</span><strong>{formatNutrient("kcal", viewTotals.meals.kcal)}</strong></p>
              <p><span>Snacks</span><strong>{formatNutrient("kcal", viewTotals.snacks.kcal)}</strong></p>
              <p><span>{rangeLabel}</span><strong>{formatNutrient("kcal", rangeTotals.day.kcal)}</strong></p>
            </div>
            <FoodDayRail
              days={rail}
              selected={dayKey}
              onSelect={(key) => setDayKey((current) => (current === key ? null : key))}
            />
            <div className="trk-food-add">
              <button type="button" onClick={() => addLogged("meal")}>Add a meal</button>
              <button type="button" onClick={() => addLogged("snack")}>Add a snack</button>
            </div>
            {viewed.length === 0 ? (
              <p className="trk-shelf-empty">{logDay ? "Nothing eaten this day." : "Nothing logged in this range."}</p>
            ) : (
              groups.filter((group) => group.rows.length > 0).map((group) => {
                const accepted = group.slot
                  ? group.rows.some((row) => plates.some((plate) => plate.entryId === row.id && plate.accepted && plate.slot === group.slot))
                  : false
                const line = accepted
                  ? subtotalLine(group.slot === "snack" ? viewTotals.snacks : viewTotals.meals)
                  : null
                return (
                  <section key={group.id} aria-label={group.title}>
                    <h4>{group.title}</h4>
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
                              aria-pressed={draft?.entryId === entry.id}
                              onClick={() => openDraft(entry.id, plate?.slot ?? "meal")}
                            >
                              {when.when ? <span>{when.when}</span> : null}
                              {when.badge ? <span>{when.badge}</span> : null}
                              <span>{entry.title?.trim() || "Untitled"}</span>
                              {kcal != null ? <span>{kcal} kcal</span> : null}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )
              })
            )}
            {logDay ? <FoodPlainLog day={logDay} rows={viewed} /> : null}
            {draft ? (
              <form
                className="trk-food-plate"
                aria-label="Plate"
                onSubmit={(event) => {
                  event.preventDefault()
                  accept()
                }}
              >
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
                      onClick={() => {
                        if (!fileOn) return
                        fileMove(draft.entryId, fileOn, weekFuzzy)
                      }}
                    >
                      Move
                    </button>
                    <button
                      type="button"
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
                <div className="trk-span-switch" role="group" aria-label="Meal or snack">
                  {(["meal", "snack"] as const).map((slot) => (
                    <button key={slot} type="button" aria-pressed={draft.slot === slot} onClick={() => setDraft({ ...draft, slot })}>
                      {slot === "meal" ? "Meal" : "Snack"}
                    </button>
                  ))}
                </div>
                <div className="trk-span-switch" role="group" aria-label="How this plate is built">
                  {(
                    [
                      ["single", "One food"],
                      ["ingredients", "Ingredients"],
                      ["recipe", "Recipe"],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
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
                        onRemove={() => setDraft({ ...draft, lines: draft.lines.filter((row) => row.foodId !== line.foodId) })}
                      />
                    ))}
                  </ul>
                )}
                <label className="trk-food-check">
                  <input
                    type="checkbox"
                    checked={draft.fromKitchen}
                    onChange={(event) => setDraft({ ...draft, fromKitchen: event.target.checked })}
                  />
                  From the kitchen
                </label>
                <NutrientGrid row={preview} heading="This plate" />
                <div className="trk-food-plate-actions">
                  <button type="submit">{draft.accepted ? "Save" : "Accept"}</button>
                  <button type="button" onClick={() => onOpenEntry(draft.entryId)}>
                    Edit the clock
                  </button>
                </div>
              </form>
            ) : (
              <NutrientGrid row={viewTotals.day} heading={gridHeading} />
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
