/**
 * lib/itinerary-migrate.ts — Best-effort upgrade of old Trip Itinerary workspaces
 *
 * Rewrites views when `templateId === "itinerary"` and `config.itineraryUiVersion < 2`:
 * remove Costs, swap Timeline → itinerary-doc, Plan spreadsheet → doc, add Activities.
 */
import type { ModuleInstance, ModuleView } from "@/lib/modules-store"
import { useTaskStore } from "@/lib/task-store"
import { NOTE_TYPE_ID, NOTE_ATTR } from "@/lib/note-types"
import type { AttributeDefinition, List } from "@/lib/types"
import { emptyTripItinerary } from "@/lib/trip-itinerary"
import { addModuleCreatedLists, taskStoreModuleListsMutators } from "@/lib/module-lists"

const ITINERARY_UI_VERSION = 3

function genId(prefix: string): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `${prefix}_${crypto.randomUUID()}`
    }
  } catch {
    /* fall through */
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function attr(
  id: string,
  name: string,
  type: AttributeDefinition["type"],
  extra: Partial<AttributeDefinition> = {},
): AttributeDefinition {
  return { id, name, type, ...extra }
}

function ensurePlacesList(existingId?: string, module?: ModuleInstance): string {
  const store = useTaskStore.getState()
  if (existingId && store.lists.some((l) => l.id === existingId)) {
    if (module) addModuleCreatedLists(taskStoreModuleListsMutators(), module, store.lists.filter((l) => l.id === existingId))
    return existingId
  }
  const byName = store.lists.find((l) => l.name === "City Places")
  if (byName) {
    if (module) addModuleCreatedLists(taskStoreModuleListsMutators(), module, [byName])
    return byName.id
  }

  const list: List = {
    id: genId("list-city-places"),
    name: "City Places",
    color: "#ec4899",
    description: "Wishlist and landmarks for the Activities map.",
    createdAt: new Date(),
    scheduleable: false,
    itemLabel: "place",
    itemAttributes: [
      attr("city", "City", "string"),
      attr("bucket", "List", "selection", {
        optionSource: "manual",
        options: ["Must do", "Maybe"],
        allowMultiple: true,
      }),
      attr("placeKind", "Kind", "selection", {
        optionSource: "manual",
        options: ["Place", "Airport", "Landmark", "Stay", "Home", "Work", "Significant"],
      }),
      attr("address", "Address", "string"),
      attr("lat", "Latitude", "number", { allowFloat: true }),
      attr("lng", "Longitude", "number", { allowFloat: true }),
      attr("notes", "Notes", "string"),
    ],
    displayedAttributes: ["city", "bucket", "placeKind", "address"],
    defaultAttributeValues: { bucket: "Must do", placeKind: "Place" },
  }
  if (module) addModuleCreatedLists(taskStoreModuleListsMutators(), module, [list])
  else store.addList(list)
  return list.id
}

function guessListIds(module: ModuleInstance): {
  daysId?: string
  flightsId?: string
  entriesId?: string
  packingId?: string
  todoId?: string
  placesId?: string
} {
  const lists = useTaskStore.getState().lists
  const cfg = module.config ?? {}
  const byName = (name: string) => lists.find((l) => l.name === name)?.id

  const views = module.views ?? []
  const planView = views.find((v) => v.title === "Plan")
  const flightsView = views.find((v) => v.title === "Flights")
  const timelineView = views.find((v) => v.kind === "timeline" || v.title === "Timeline")
  const packingView = views.find((v) => v.title === "Packing")
  const todoView = views.find((v) => v.title === "Before Trip")
  const activitiesView = views.find((v) => v.kind === "trip-map" || v.title === "Activities")

  return {
    daysId: cfg.daysCategoryId || planView?.config.categoryId || byName("Trip Plan"),
    flightsId: cfg.flightsCategoryId || flightsView?.config.categoryId || byName("Flights"),
    entriesId:
      cfg.entriesCategoryId ||
      timelineView?.config.categoryId ||
      module.planSync?.categoryId ||
      byName("Activities & Stays") ||
      byName("Entries"),
    packingId: packingView?.config.categoryId || byName("Packing"),
    todoId: todoView?.config.categoryId || byName("To Do Before Trip"),
    placesId: cfg.placesCategoryId || activitiesView?.config.categoryId || byName("City Places"),
  }
}

function ensurePlanDoc(module: ModuleInstance): string {
  const existing = module.config?.planDocId
  if (existing) {
    const found = useTaskStore.getState().tasks.find((t) => t.id === existing)
    if (found) return existing
  }
  const store = useTaskStore.getState()
  const docId = genId("doc")
  store.addTask({
    id: docId,
    description: `${module.title || "Trip"} plan`,
    type: NOTE_TYPE_ID,
    stage: "list",
    createdAt: new Date(),
    completed: false,
    lists: [],
    body: `<h1>${module.title || "Trip"} plan</h1><p>Write your trip notes, themes, and rough outline here.</p>`,
    attributes: {
      [NOTE_ATTR.status]: "draft",
      [NOTE_ATTR.folder]: "Trips",
      [NOTE_ATTR.fontFamily]: "Merriweather",
    },
    links: [],
    tags: ["docs", "trip"],
  })
  return docId
}

/**
 * Returns a patched module if migration / repair is needed, otherwise null.
 * Caller should `updateModule` with the result.
 *
 * Also re-adds a missing Activities (trip-map) tab even after a prior migrate,
 * so accidental view deletion can be recovered on next open.
 */
export function migrateItineraryModule(module: ModuleInstance): ModuleInstance | null {
  if (module.templateId !== "itinerary") return null
  const version = module.config?.itineraryUiVersion ?? 0
  const oldViews = module.views ?? []
  const hasActivities = oldViews.some((v) => v.kind === "trip-map" || v.title === "Activities")

  // Soft repair: Activities was deleted but module is otherwise current
  if (version >= ITINERARY_UI_VERSION && !hasActivities) {
    const ids = guessListIds(module)
    const placesId = ensurePlacesList(ids.placesId, module)
    const packingIdx = oldViews.findIndex((v) => v.title === "Packing")
    const insertAt = packingIdx >= 0 ? packingIdx : Math.min(2, oldViews.length)
    const activitiesView: ModuleView = {
      id: genId("view-activities"),
      title: "Activities",
      kind: "trip-map",
      config: {
        categoryId: placesId,
        placesCategoryId: placesId,
      },
    }
    const views = [...oldViews]
    views.splice(insertAt, 0, activitiesView)
    return {
      ...module,
      config: {
        ...module.config,
        placesCategoryId: placesId,
      },
      views,
    }
  }

  if (version >= ITINERARY_UI_VERSION) return null

  const ids = guessListIds(module)
  const placesId = ensurePlacesList(ids.placesId, module)
  const planDocId = ensurePlanDoc(module)

  const preserved = oldViews.filter((v) => {
    if (v.title === "Costs") return false
    if (v.kind === "summary" && v.title.toLowerCase().includes("cost")) return false
    if (v.title === "Plan" || v.title === "Timeline" || v.title === "Itinerary") return false
    if (v.title === "Flights" || v.title === "Packing" || v.title === "Before Trip") return false
    if (v.title === "Activities" || v.kind === "trip-map") return false
    if (v.title === "Entries") return false
    return true
  })

  const uid = (suffix: string) => genId(`view-${suffix}`)

  const views: ModuleView[] = [
    {
      id: oldViews.find((v) => v.title === "Plan")?.id || uid("plan"),
      title: "Plan",
      kind: "doc",
      config: { docId: planDocId },
    },
    {
      id: oldViews.find((v) => v.title === "Itinerary" || v.title === "Timeline")?.id || uid("itinerary"),
      title: "Itinerary",
      kind: "itinerary-doc",
      config: {},
    },
    {
      id: oldViews.find((v) => v.title === "Activities")?.id || uid("activities"),
      title: "Activities",
      kind: "trip-map",
      config: {
        categoryId: placesId,
        placesCategoryId: placesId,
      },
    },
    {
      id: oldViews.find((v) => v.title === "Packing")?.id || uid("packing"),
      title: "Packing",
      kind: "checklist",
      config: { categoryId: ids.packingId, checklistStyle: "packing" },
    },
    {
      id: oldViews.find((v) => v.title === "Before Trip")?.id || uid("before"),
      title: "Before Trip",
      kind: "checklist",
      config: { categoryId: ids.todoId, checklistStyle: "pretrip" },
    },
    ...preserved,
  ]

  const start = new Date()
  start.setDate(start.getDate() + 7)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const tripItinerary = module.config?.tripItinerary?.days?.length
    ? module.config.tripItinerary
    : emptyTripItinerary(iso(start), iso(end))

  return {
    ...module,
    description:
      module.description ||
      "Write a trip doc, build a day-by-day itinerary (weather + flights by number), map activities by city, and pack.",
    config: {
      ...module.config,
      planDocId,
      itineraryUiVersion: ITINERARY_UI_VERSION,
      placesCategoryId: placesId,
      tripItinerary,
    },
    views,
  }
}

export { ITINERARY_UI_VERSION }
