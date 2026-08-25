import { beforeEach, describe, expect, it } from "vitest"
import {
  ensureOperationItineraryModule,
  operationItineraryViews,
} from "./operation-itinerary"
import { OPERATION_ATTR, OPERATION_TYPE_ID } from "./operation-types"
import { useModulesStore } from "./modules-store"
import { useTaskStore } from "./task-store"

function resetStores() {
  useTaskStore.getState().clearAllData()
  useModulesStore.setState({ modules: [] })
}

describe("operation-itinerary", () => {
  beforeEach(resetStores)

  it("creates an empty field-plan module linked to the operation", () => {
    const op = {
      id: "op_1",
      description: "Field survey",
      type: OPERATION_TYPE_ID,
      stage: "clarified" as const,
      createdAt: new Date(),
      completed: false,
      lists: [],
      attributes: { [OPERATION_ATTR.stage]: "planning" },
      links: [],
    }
    useTaskStore.getState().addTask(op)

    const mod = ensureOperationItineraryModule("op_1")
    expect(mod).toBeTruthy()
    expect(mod!.config.operationId).toBe("op_1")
    expect(mod!.config.tripItinerary?.days?.length).toBeGreaterThan(0)
    expect(mod!.config.placesCategoryId).toBeTruthy()

    const views = operationItineraryViews(mod!)
    expect(views.itineraryView?.kind).toBe("itinerary-doc")
    expect(views.activitiesView?.kind).toBe("trip-map")
    expect(views.planView?.kind).toBe("doc")

    const updated = useTaskStore.getState().tasks.find((t) => t.id === "op_1")
    expect(updated?.attributes?.[OPERATION_ATTR.itineraryModuleId]).toBe(mod!.id)

    // No demo Lisbon seed places
    const placesId = mod!.config.placesCategoryId!
    const places = useTaskStore.getState().tasks.filter((t) => t.lists?.includes(placesId))
    expect(places).toHaveLength(0)

    const placesList = useTaskStore.getState().lists.find((l) => l.id === placesId)
    expect(placesList?.createdByModuleId).toBe(mod!.id)
    const child = useTaskStore.getState().folders.find((f) => f.id === `module-lists-${mod!.id}`)
    expect(child?.listIds).toContain(placesId)
    expect(useTaskStore.getState().folders.some((f) => f.id === "folder-module-lists")).toBe(true)

    // Idempotent
    const again = ensureOperationItineraryModule("op_1")
    expect(again!.id).toBe(mod!.id)
    expect(useModulesStore.getState().modules.filter((m) => m.config?.operationId === "op_1")).toHaveLength(
      1,
    )
  })
})
