import { describe, it, expect, beforeEach } from "vitest"
import { migrateItineraryModule, ITINERARY_UI_VERSION } from "./itinerary-migrate"
import { useTaskStore } from "./task-store"
import type { ModuleInstance } from "./modules-store"

describe("migrateItineraryModule", () => {
  beforeEach(() => {
    useTaskStore.setState({ tasks: [], lists: [] })
  })

  it("returns null when already current and Activities exists", () => {
    const mod: ModuleInstance = {
      id: "m1",
      type: "workspace",
      title: "Trip",
      templateId: "itinerary",
      config: { itineraryUiVersion: ITINERARY_UI_VERSION, placesCategoryId: "places" },
      views: [
        { id: "v1", title: "Plan", kind: "doc", config: {} },
        { id: "v2", title: "Activities", kind: "trip-map", config: { categoryId: "places" } },
      ],
    }
    expect(migrateItineraryModule(mod)).toBeNull()
  })

  it("re-adds Activities when missing on a current module", () => {
    useTaskStore.getState().addList({
      id: "places",
      name: "City Places",
      color: "#ec4899",
      createdAt: new Date(),
      scheduleable: false,
    })
    const mod: ModuleInstance = {
      id: "m1",
      type: "workspace",
      kind: "workspace",
      title: "Trip",
      templateId: "itinerary",
      config: { itineraryUiVersion: ITINERARY_UI_VERSION, placesCategoryId: "places" },
      views: [
        { id: "v1", title: "Plan", kind: "doc", config: {} },
        { id: "v2", title: "Itinerary", kind: "itinerary-doc", config: {} },
        { id: "v3", title: "Packing", kind: "checklist", config: {} },
        { id: "v4", title: "Before Trip", kind: "checklist", config: {} },
      ],
    }
    const next = migrateItineraryModule(mod)
    expect(next).toBeTruthy()
    const titles = next!.views!.map((v) => v.title)
    expect(titles).toContain("Activities")
    expect(titles.indexOf("Activities")).toBeLessThan(titles.indexOf("Packing"))
  })

  it("rewrites old views and creates City Places + plan doc", () => {
    useTaskStore.getState().addList({
      id: "plan",
      name: "Trip Plan",
      color: "#0ea5e9",
      createdAt: new Date(),
      scheduleable: false,
    })
    useTaskStore.getState().addList({
      id: "flights",
      name: "Flights",
      color: "#6366f1",
      createdAt: new Date(),
      scheduleable: false,
    })
    useTaskStore.getState().addList({
      id: "entries",
      name: "Activities & Stays",
      color: "#14b8a6",
      createdAt: new Date(),
      scheduleable: false,
    })
    useTaskStore.getState().addList({
      id: "pack",
      name: "Packing",
      color: "#8b5cf6",
      createdAt: new Date(),
      scheduleable: false,
    })
    useTaskStore.getState().addList({
      id: "todo",
      name: "To Do Before Trip",
      color: "#f59e0b",
      createdAt: new Date(),
      scheduleable: false,
    })

    const old: ModuleInstance = {
      id: "m-old",
      type: "workspace",
      kind: "workspace",
      title: "Trip Itinerary",
      templateId: "itinerary",
      config: {},
      views: [
        { id: "v1", title: "Plan", kind: "spreadsheet", config: { categoryId: "plan" } },
        { id: "v2", title: "Flights", kind: "spreadsheet", config: { categoryId: "flights" } },
        { id: "v3", title: "Timeline", kind: "timeline", config: { categoryId: "entries", dateAttrId: "day" } },
        { id: "v4", title: "Costs", kind: "summary", config: { categoryId: "entries" } },
        { id: "v5", title: "Packing", kind: "checklist", config: { categoryId: "pack" } },
        { id: "v6", title: "Before Trip", kind: "checklist", config: { categoryId: "todo" } },
      ],
    }

    const next = migrateItineraryModule(old)
    expect(next).toBeTruthy()
    const titles = next!.views!.map((v) => v.title)
    expect(titles).toContain("Plan")
    expect(titles).toContain("Itinerary")
    expect(titles).toContain("Activities")
    expect(titles).not.toContain("Costs")
    expect(titles).not.toContain("Timeline")
    expect(titles).not.toContain("Flights")
    expect(next!.views!.find((v) => v.title === "Plan")!.kind).toBe("doc")
    expect(next!.views!.find((v) => v.title === "Itinerary")!.kind).toBe("itinerary-doc")
    expect(next!.config.itineraryUiVersion).toBe(ITINERARY_UI_VERSION)
    expect(next!.config.planDocId).toBeTruthy()
    expect(next!.config.tripItinerary?.days?.length).toBeGreaterThan(0)
    expect(useTaskStore.getState().lists.some((l) => l.name === "City Places")).toBe(true)
    expect(useTaskStore.getState().tasks.some((t) => t.id === next!.config.planDocId)).toBe(true)
  })
})
