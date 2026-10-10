/**
 * lib/trip-itinerary-items.ts — Trip itinerary records on Items (Wave 10)
 *
 * Schedule rows (plans, notes, flights, sleep) are ordinary Items on day lists
 * (same stable ids as Module Lists import). The itinerary UI writes through here
 * first. For one release, `module.config.tripItinerary` is still dual-written as
 * a read shim — day meta (city, weather, sunrise) is not fully on Items yet, so
 * the config tree remains the day-shell fallback.
 */
import type { List, Task } from "@/lib/types"
import type { ModuleInstance } from "@/lib/modules-store"
import {
  emptyTripItinerary,
  type TripItineraryData,
  type TripItineraryDay,
  type TripScheduleEntry,
  type TripScheduleKind,
} from "@/lib/trip-itinerary"
import {
  MODULE_SOURCE_ID_ATTR,
  MODULE_SOURCE_TRIP,
  moduleImportRootListId,
  moduleImportTripDayListId,
  moduleImportTripEntryId,
  sourceOf,
} from "@/lib/module-list-import-shared"
import { syncModuleListContents } from "@/lib/module-list-import"
import { syncModuleListFolders, taskStoreModuleListsMutators } from "@/lib/module-lists"

function tripSourceId(item: Pick<Task, "attributes">): string | undefined {
  const v = item.attributes?.[MODULE_SOURCE_ID_ATTR]
  return typeof v === "string" && v ? v : undefined
}

function dayDateFromListId(moduleId: string, listId: string): string | null {
  const prefix = `mll-${moduleId}-trip-d-`
  if (!listId.startsWith(prefix)) return null
  const date = listId.slice(prefix.length)
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null
}

function entrySourceId(moduleId: string, itemId: string): string | null {
  const prefix = `mli-${moduleId}-trip-`
  if (!itemId.startsWith(prefix)) return null
  return itemId.slice(prefix.length) || null
}

/** True when this module already has Trip schedule Items in the vault. */
export function hasTripRecordItems(moduleId: string, tasks: readonly Task[]): boolean {
  const prefix = `mli-${moduleId}-trip-`
  return tasks.some((t) => t.id.startsWith(prefix) && sourceOf(t) === MODULE_SOURCE_TRIP)
}

function kindOf(item: Task): TripScheduleKind | "sleep" {
  const k = item.attributes?.tripKind
  if (k === "plan" || k === "note" || k === "flight" || k === "sleep") return k
  if (item.type === "flight") return "flight"
  return "plan"
}

/**
 * Overlay schedule rows from Items onto a config (or empty) trip shell.
 * Day city/weather/sleep meta stay on the shell when present.
 */
export function mergeTripScheduleFromItems(
  moduleId: string,
  shell: TripItineraryData,
  tasks: readonly Task[],
  lists: readonly List[],
): TripItineraryData {
  if (!hasTripRecordItems(moduleId, tasks)) return shell

  const byDate = new Map<string, TripScheduleEntry[]>()
  const sleepByDate = new Map<string, { name?: string; address?: string }>()

  for (const item of tasks) {
    if (sourceOf(item) !== MODULE_SOURCE_TRIP) continue
    const entryId = entrySourceId(moduleId, item.id) ?? tripSourceId(item)
    if (!entryId) continue
    const listId = (item.lists ?? []).find((id) => dayDateFromListId(moduleId, id))
    const date = listId ? dayDateFromListId(moduleId, listId) : null
    if (!date) continue

    const kind = kindOf(item)
    if (kind === "sleep" || entryId.startsWith("sleep-")) {
      sleepByDate.set(date, {
        name: String(item.title || item.description || "").trim() || undefined,
        address: typeof item.notes === "string" ? item.notes.trim() || undefined : undefined,
      })
      continue
    }

    const entry: TripScheduleEntry = {
      id: entryId,
      kind,
      text: String(item.title || item.description || ""),
      ...(item.scheduledTime ? { time: item.scheduledTime } : {}),
      ...(kind === "flight" && item.notes
        ? {
            flight: {
              flightNumber: String(item.attributes?.flightNumber || ""),
              title: String(item.title || ""),
              detail: item.notes,
              rawText: item.notes,
            },
          }
        : {}),
    }
    const list = byDate.get(date) ?? []
    list.push(entry)
    byDate.set(date, list)
  }

  // Prefer shell day order; append any Item-only days from lists.
  const dates = new Set(shell.days.map((d) => d.date))
  for (const list of lists) {
    const date = dayDateFromListId(moduleId, list.id)
    if (date) dates.add(date)
  }
  const ordered = [...dates].sort()
  if (ordered.length === 0) return shell

  const days: TripItineraryDay[] = ordered.map((date) => {
    const prior = shell.days.find((d) => d.date === date)
    const sleep = sleepByDate.get(date)
    const schedule = byDate.get(date) ?? prior?.schedule ?? []
    return {
      date,
      cityMode: prior?.cityMode ?? "city",
      city: prior?.city ?? "",
      fromCity: prior?.fromCity,
      toCity: prior?.toCity,
      dayNote: prior?.dayNote,
      sleepName: sleep?.name ?? prior?.sleepName,
      sleepAddress: sleep?.address ?? prior?.sleepAddress,
      schedule,
      weather: prior?.weather,
      weatherFetchedAt: prior?.weatherFetchedAt,
      climateCity: prior?.climateCity,
      sunrise: prior?.sunrise,
      sunset: prior?.sunset,
    }
  })

  return {
    ...shell,
    startDate: shell.startDate || ordered[0],
    endDate: shell.endDate || ordered[ordered.length - 1],
    days,
  }
}

/**
 * Resolve trip data: schedule from Items when present, day shell from config.
 * Falls back entirely to config when no Trip Items exist yet.
 */
export function resolveTripItinerary(
  module: ModuleInstance,
  tasks: readonly Task[],
  lists: readonly List[],
): TripItineraryData {
  const raw = module.config?.tripItinerary
  const shell =
    raw && Array.isArray(raw.days) && raw.days.length > 0
      ? raw
      : emptyTripItinerary(raw?.startDate || "", raw?.endDate || raw?.startDate || "")
  return mergeTripScheduleFromItems(module.id, shell, tasks, lists)
}

/**
 * Write trip schedule rows onto Items (and Module Lists folders). Dual-write of
 * `module.config.tripItinerary` for one release is the caller's responsibility.
 */
export function persistTripItineraryItems(module: ModuleInstance, trip: TripItineraryData): void {
  const nextModule: ModuleInstance = {
    ...module,
    config: { ...module.config, tripItinerary: trip },
  }
  const mut = taskStoreModuleListsMutators()
  syncModuleListFolders(mut, [nextModule])
  syncModuleListContents(mut, [nextModule])
}

export { moduleImportTripDayListId, moduleImportTripEntryId, moduleImportRootListId }
