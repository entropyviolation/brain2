/**
 * lib/module-list-import-trip.ts — Trip Itinerary days → Module Lists items
 *
 * Each trip day becomes a nested list under an Itinerary parent. Schedule rows
 * (plans, notes, flights) become items with time + the full text. This is the
 * second shadow-database port; Tidy is the gold-standard field map.
 */
import type { List, Task } from "@/lib/types"
import type { ModuleInstance } from "@/lib/modules-store"
import type { TripItineraryData, TripItineraryDay, TripScheduleEntry } from "@/lib/trip-itinerary"
import { cityLabel, itineraryShowsSleep } from "@/lib/trip-itinerary"
import {
  MODULE_SOURCE_TRIP,
  moduleImportRootListId,
  moduleImportTripDayListId,
  moduleImportTripEntryId,
  stampSource,
  withImportCompletion,
  type ModuleImportPlan,
} from "@/lib/module-list-import-shared"

const TRIP_COLOR = "#6366f1"

function dayTitle(day: TripItineraryDay): string {
  const city = cityLabel(day)
  return city ? `${day.date} — ${city}` : day.date
}

function itineraryList(module: ModuleInstance): List {
  return {
    id: moduleImportRootListId(module.id, MODULE_SOURCE_TRIP),
    name: "Itinerary",
    color: TRIP_COLOR,
    createdAt: new Date(0),
    createdByModuleId: module.id,
    scheduleable: false,
    itemTypeId: "item",
    itemLabel: "day",
    description: "Trip days as nested lists. Open a day for timed plans, notes, and flights.",
    enabledDisplays: ["default", "checklist", "table"],
    order: 0,
  }
}

function dayList(moduleId: string, day: TripItineraryDay, parentListId: string, order: number): List {
  const note = (day.dayNote || "").trim()
  return {
    id: moduleImportTripDayListId(moduleId, day.date),
    name: dayTitle(day),
    color: TRIP_COLOR,
    createdAt: new Date(0),
    parentListId,
    order,
    createdByModuleId: moduleId,
    scheduleable: false,
    itemTypeId: "item",
    itemLabel: "stop",
    description: note || `${dayTitle(day)} — plans, notes, and flights from the trip itinerary.`,
    enabledDisplays: ["default", "checklist", "table"],
  }
}

function scheduledDate(date: string): Date {
  return new Date(`${date}T12:00:00`)
}

function entryTitle(entry: TripScheduleEntry): string {
  const flightTitle = entry.flight?.title?.trim()
  if (entry.kind === "flight" && flightTitle) return flightTitle
  return String(entry.text ?? "").trim() || (entry.kind === "flight" ? "Flight" : "Untitled")
}

function entryNotes(entry: TripScheduleEntry): string | undefined {
  if (entry.kind !== "flight" || !entry.flight) return undefined
  const f = entry.flight
  const bits = [
    f.detail,
    f.confirmation ? `Conf ${f.confirmation}` : "",
    f.durationLabel,
    f.stopsLabel,
    f.rawText,
  ].filter((s) => String(s || "").trim())
  return bits.length ? bits.join("\n") : undefined
}

function entryItem(moduleId: string, day: TripItineraryDay, entry: TripScheduleEntry, listId: string): Task {
  const title = entryTitle(entry)
  const notes = entryNotes(entry)
  const attributes = stampSource(
    {
      tripKind: entry.kind,
      ...(entry.flight?.flightNumber ? { flightNumber: entry.flight.flightNumber } : {}),
    },
    MODULE_SOURCE_TRIP,
    entry.id,
    moduleId,
  )
  const base: Task = {
    id: moduleImportTripEntryId(moduleId, entry.id),
    description: title,
    title,
    type: entry.kind === "flight" ? "flight" : "item",
    stage: "list",
    createdAt: scheduledDate(day.date),
    completed: false,
    lists: [listId],
    tags: ["itinerary", entry.kind, day.date],
    attributes,
    scheduledDate: scheduledDate(day.date),
    scheduledTime: entry.time,
    notes,
  }
  return withImportCompletion(base, false)
}

function sleepItem(moduleId: string, day: TripItineraryDay, listId: string): Task | null {
  if (!day.sleepName && !day.sleepAddress) return null
  const title = day.sleepName?.trim() || "Stay"
  const base: Task = {
    id: moduleImportTripEntryId(moduleId, `sleep-${day.date}`),
    description: title,
    title,
    type: "item",
    stage: "list",
    createdAt: scheduledDate(day.date),
    completed: false,
    lists: [listId],
    tags: ["itinerary", "sleep", day.date],
    attributes: stampSource({ tripKind: "sleep" }, MODULE_SOURCE_TRIP, `sleep-${day.date}`, moduleId),
    scheduledDate: scheduledDate(day.date),
    notes: day.sleepAddress?.trim() || undefined,
  }
  return withImportCompletion(base, false)
}

export function planTripModuleLists(module: ModuleInstance, trip: TripItineraryData): ModuleImportPlan {
  const root = itineraryList(module)
  const lists: List[] = [root]
  const items: Task[] = []
  const days = trip.days ?? []
  days.forEach((day, i) => {
    const list = dayList(module.id, day, root.id, i + 1)
    lists.push(list)
    for (const entry of day.schedule ?? []) {
      items.push(entryItem(module.id, day, entry, list.id))
    }
    if (itineraryShowsSleep(trip)) {
      const sleep = sleepItem(module.id, day, list.id)
      if (sleep) items.push(sleep)
    }
  })
  return { lists, items }
}
