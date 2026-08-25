/**
 * lib/operation-itinerary.ts — Per-operation itinerary + activities workspace
 *
 * Each Operation can own a backing itinerary module (same stack as Modules →
 * Trip Itinerary): day-by-day itinerary doc + City Places map. Lazily created
 * on first open of the Itinerary or Activities tab, linked via
 * `OPERATION_ATTR.itineraryModuleId`.
 */
import { buildModuleTemplate } from "@/lib/module-templates"
import { useModulesStore, type ModuleInstance, type ModuleView } from "@/lib/modules-store"
import { OPERATION_ATTR } from "@/lib/operation-types"
import { useTaskStore } from "@/lib/task-store"
import { emptyTripItinerary } from "@/lib/trip-itinerary"

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function defaultRange(): { start: string; end: string } {
  const start = new Date()
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return { start: isoDate(start), end: isoDate(end) }
}

/** Find itinerary / activities views on an operation-linked module. */
export function operationItineraryViews(module: ModuleInstance): {
  itineraryView?: ModuleView
  activitiesView?: ModuleView
  planView?: ModuleView
} {
  const views = module.views ?? []
  return {
    itineraryView: views.find((v) => v.kind === "itinerary-doc"),
    activitiesView: views.find((v) => v.kind === "trip-map"),
    planView: views.find((v) => v.kind === "doc"),
  }
}

/**
 * Ensure the operation has a backing itinerary workspace (empty field plan,
 * no demo Lisbon seeds). Idempotent — returns the existing module when linked.
 */
export function ensureOperationItineraryModule(operationId: string): ModuleInstance | null {
  const taskStore = useTaskStore.getState()
  const op = taskStore.tasks.find((t) => t.id === operationId)
  if (!op) return null

  const modStore = useModulesStore.getState()
  const linkedId = String(op.attributes?.[OPERATION_ATTR.itineraryModuleId] ?? "").trim()

  if (linkedId) {
    const existing = modStore.modules.find((m) => m.id === linkedId)
    if (existing) return existing
  }

  const byOp = modStore.modules.find((m) => m.config?.operationId === operationId)
  if (byOp) {
    taskStore.updateTask({
      ...op,
      attributes: {
        ...(op.attributes ?? {}),
        [OPERATION_ATTR.itineraryModuleId]: byOp.id,
      },
    })
    return byOp
  }

  const built = buildModuleTemplate("itinerary")
  const { start, end } = defaultRange()
  const title = `${op.description.trim() || "Operation"} — Field plan`

  const planDocId = built.module.config.planDocId
  const planDoc = built.seedTasks.find((t) => t.id === planDocId)
  const placesId = built.module.config.placesCategoryId

  const module: ModuleInstance = {
    ...built.module,
    title,
    description:
      "Day-by-day itinerary and activities map for this operation (cities, stays, flights, places).",
    config: {
      ...built.module.config,
      operationId,
      placesCategoryId: placesId,
      tripItinerary: emptyTripItinerary(start, end, { showSleep: false }),
      activityListNames: ["Must do", "Maybe"],
      activityListColors: {},
      removedActivityCities: [],
    },
    // Keep itinerary + activities (+ plan doc) — skip packing/pre-trip for ops
    views: (built.module.views ?? []).filter(
      (v) => v.kind === "itinerary-doc" || v.kind === "trip-map" || v.kind === "doc",
    ),
  }

  built.lists.forEach((list) => {
    // Only City Places is required for the map; keep packing/todo lists out of the way
    if (placesId && list.id === placesId) {
      taskStore.addList({
        ...list,
        name: `Places — ${op.description.trim() || "Operation"}`,
        description: "Places and stays plotted on the operation Activities map.",
      })
    }
  })

  if (planDoc) {
    taskStore.addTask({
      ...planDoc,
      description: `${op.description.trim() || "Operation"} plan`,
      body: `<h1>${op.description.trim() || "Operation"}</h1>
<p>Field notes, goals, and anything that doesn’t fit the day grid.</p>
<h2>Goals</h2>
<ul>
<li></li>
</ul>`,
      attributes: {
        ...(planDoc.attributes ?? {}),
        docsFolder: "Operations",
        status: "draft",
      },
      tags: ["docs", "operation"],
    })
  }

  modStore.addModuleInstance(module)
  taskStore.updateTask({
    ...op,
    attributes: {
      ...(op.attributes ?? {}),
      [OPERATION_ATTR.itineraryModuleId]: module.id,
    },
  })

  return module
}
