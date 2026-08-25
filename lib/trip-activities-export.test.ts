import { describe, it, expect } from "vitest"
import {
  buildTripActivitiesExport,
  placeToExportRow,
  tripActivitiesExportToCsv,
  serializeTripActivitiesExport,
  parseTripActivitiesJson,
  parseTripActivitiesCsv,
  parseTripActivitiesImport,
  importedPlaceAttributes,
} from "./trip-activities-export"
import type { Task } from "@/lib/types"

function fakePlace(over: Partial<Task> & { attributes?: Record<string, unknown> }): Task {
  return {
    id: over.id || "p1",
    description: over.description || "Circuito Mágico del Agua",
    title: over.title || over.description || "Circuito Mágico del Agua",
    lists: over.lists || ["places"],
    completed: over.completed ?? false,
    attributes: {
      placeKind: "Place",
      address: "Lima, Peru",
      notes: "Fountain show at night",
      city: "Lima, Peru",
      lat: -12.07,
      lng: -77.03,
      bucket: "Must do",
      ...over.attributes,
    },
    ...over,
  } as Task
}

describe("trip-activities-export", () => {
  it("flattens place fields for export", () => {
    const row = placeToExportRow(
      fakePlace({
        attributes: {
          placeKind: "Landmark",
          address: "Av. 28 de Julio",
          notes: "Go early",
          city: "Lima",
          lat: -12.1,
          lng: -77.0,
          bucket: ["Must do", "Free"],
          googlePlaceId: "abc",
          photoUrls: ["https://example.com/a.jpg"],
        },
      }),
    )
    expect(row.name).toMatch(/Circuito/)
    expect(row.type).toBe("Landmark")
    expect(row.address).toBe("Av. 28 de Julio")
    expect(row.notes).toBe("Go early")
    expect(row.lists).toEqual(["Must do", "Free"])
    expect(row.lat).toBe(-12.1)
    expect(row.googlePlaceId).toBe("abc")
    expect(row.photoUrls).toHaveLength(1)
  })

  it("builds a full map envelope and CSV", () => {
    const data = buildTripActivitiesExport({
      places: [fakePlace({})],
      cities: ["Lima, Peru"],
      activityListNames: ["Must do"],
      moduleName: "Peru Trip",
      placesListName: "City Places",
    })
    expect(data.kind).toBe("trip-activities-map")
    expect(data.placeCount).toBe(1)
    expect(data.places[0]!.address).toMatch(/Lima/)
    const json = serializeTripActivitiesExport(data)
    expect(json).toContain("trip-activities-map")
    const csv = tripActivitiesExportToCsv(data)
    expect(csv.split("\n")[0]).toContain("name")
    expect(csv).toContain("Fountain show")
  })

  it("round-trips JSON export", () => {
    const data = buildTripActivitiesExport({
      places: [
        fakePlace({
          attributes: {
            placeKind: "Landmark",
            address: "Av. 28 de Julio",
            notes: "Go early",
            city: "Lima",
            lat: -12.1,
            lng: -77.0,
            bucket: ["Must do", "Restaurants"],
            googlePlaceId: "abc",
            photoUrls: ["https://example.com/a.jpg"],
          },
        }),
      ],
      cities: ["Lima"],
      activityListNames: ["Must do", "Restaurants"],
      activityListColors: { Restaurants: "#c44" },
      selectedCity: "Lima",
      moduleName: "Peru Trip",
    })
    const parsed = parseTripActivitiesJson(serializeTripActivitiesExport(data))
    expect(parsed.source).toBe("json")
    expect(parsed.places).toHaveLength(1)
    expect(parsed.places[0]!.name).toMatch(/Circuito/)
    expect(parsed.places[0]!.lists).toEqual(["Must do", "Restaurants"])
    expect(parsed.places[0]!.lat).toBe(-12.1)
    expect(parsed.activityListColors.Restaurants).toBe("#c44")
    expect(parsed.selectedCity).toBe("Lima")

    const attrs = importedPlaceAttributes(parsed.places[0]!, "Trip")
    expect(attrs.city).toBe("Lima")
    expect(attrs.placeKind).toBe("Landmark")
    expect(attrs.googlePlaceId).toBe("abc")
  })

  it("parses CSV export", () => {
    const data = buildTripActivitiesExport({
      places: [fakePlace({})],
      cities: ["Lima, Peru"],
    })
    const csv = tripActivitiesExportToCsv(data)
    const parsed = parseTripActivitiesCsv(csv, "activities.csv")
    expect(parsed.source).toBe("csv")
    expect(parsed.places).toHaveLength(1)
    expect(parsed.places[0]!.name).toMatch(/Circuito/)
    expect(parsed.places[0]!.notes).toContain("Fountain")
    expect(parsed.places[0]!.lat).toBeCloseTo(-12.07)
  })

  it("detects JSON vs CSV from contents", () => {
    const json = parseTripActivitiesImport(
      JSON.stringify({ places: [{ name: "Miraflores", lists: "Must do", city: "Lima" }] }),
      "x.txt",
    )
    expect(json.places[0]!.name).toBe("Miraflores")

    const csv = parseTripActivitiesImport(
      "name,lists,city\nBarranco,Must do,Lima\n",
      "places.csv",
    )
    expect(csv.places[0]!.name).toBe("Barranco")
  })
})
