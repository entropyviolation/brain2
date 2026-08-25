/**
 * Export / import the Activities map (City Places) as JSON or CSV.
 */
import type { Task } from "@/lib/types"
import { getPlaceLists, encodePlaceLists } from "@/lib/trip-activity-lists"
import { parseSpreadsheetText } from "@/lib/csv"

export const TRIP_ACTIVITIES_EXPORT_VERSION = 1 as const

export interface TripActivitiesPlaceExport {
  id: string
  name: string
  /** Filter lists / buckets (Must do, Restaurants, …) */
  lists: string[]
  /** Place kind: Place, Airport, Stay, Landmark, … */
  type: string
  address: string
  notes: string
  city: string
  lat: number | null
  lng: number | null
  googlePlaceId: string
  photoUrls: string[]
  done: boolean
  createdAt?: string
  updatedAt?: string
  /** Full attributes bag for round-trip fidelity */
  attributes: Record<string, unknown>
}

export interface TripActivitiesExport {
  app: "cogs"
  kind: "trip-activities-map"
  version: typeof TRIP_ACTIVITIES_EXPORT_VERSION
  exportedAt: string
  moduleId?: string
  moduleName?: string
  placesListId?: string
  placesListName?: string
  cities: string[]
  activityListNames: string[]
  activityListColors: Record<string, string>
  selectedCity?: string
  placeCount: number
  places: TripActivitiesPlaceExport[]
}

export interface TripActivitiesImportResult {
  places: TripActivitiesPlaceExport[]
  cities: string[]
  activityListNames: string[]
  activityListColors: Record<string, string>
  selectedCity?: string
  source: "json" | "csv"
}

function readPhotoUrls(place: Task): string[] {
  const raw = place.attributes?.photoUrls
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean)
  if (typeof raw === "string" && raw.trim()) return [raw.trim()]
  return []
}

function readCoord(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim()) {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

export function placeToExportRow(place: Task): TripActivitiesPlaceExport {
  const attrs = (place.attributes || {}) as Record<string, unknown>
  return {
    id: place.id,
    name: place.description || place.title || "",
    lists: getPlaceLists(place),
    type: String(attrs.placeKind ?? "Place"),
    address: String(attrs.address ?? ""),
    notes: String(attrs.notes ?? ""),
    city: String(attrs.city ?? ""),
    lat: readCoord(attrs.lat),
    lng: readCoord(attrs.lng),
    googlePlaceId: String(attrs.googlePlaceId ?? ""),
    photoUrls: readPhotoUrls(place),
    done: Boolean(place.completed),
    createdAt: place.createdAt ? String(place.createdAt) : undefined,
    attributes: { ...attrs },
  }
}

export function buildTripActivitiesExport(opts: {
  places: Task[]
  cities: string[]
  activityListNames?: string[]
  activityListColors?: Record<string, string>
  selectedCity?: string
  moduleId?: string
  moduleName?: string
  placesListId?: string
  placesListName?: string
}): TripActivitiesExport {
  const places = opts.places.map(placeToExportRow)
  return {
    app: "cogs",
    kind: "trip-activities-map",
    version: TRIP_ACTIVITIES_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    moduleId: opts.moduleId,
    moduleName: opts.moduleName,
    placesListId: opts.placesListId,
    placesListName: opts.placesListName,
    cities: [...opts.cities],
    activityListNames: [...(opts.activityListNames ?? [])],
    activityListColors: { ...(opts.activityListColors ?? {}) },
    selectedCity: opts.selectedCity,
    placeCount: places.length,
    places,
  }
}

export function serializeTripActivitiesExport(data: TripActivitiesExport): string {
  return JSON.stringify(data, null, 2)
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

/** Spreadsheet-friendly CSV of the core place fields. */
export function tripActivitiesExportToCsv(data: TripActivitiesExport): string {
  const headers = [
    "name",
    "type",
    "lists",
    "address",
    "notes",
    "city",
    "lat",
    "lng",
    "googlePlaceId",
    "done",
    "id",
  ]
  const lines = [headers.join(",")]
  for (const p of data.places) {
    lines.push(
      [
        csvEscape(p.name),
        csvEscape(p.type),
        csvEscape(p.lists.join("; ")),
        csvEscape(p.address),
        csvEscape(p.notes),
        csvEscape(p.city),
        p.lat == null ? "" : String(p.lat),
        p.lng == null ? "" : String(p.lng),
        csvEscape(p.googlePlaceId),
        p.done ? "true" : "false",
        csvEscape(p.id),
      ].join(","),
    )
  }
  return lines.join("\n")
}

function triggerDownload(contents: string, filename: string, mime: string): void {
  const blob = new Blob([contents], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function defaultStem(data: TripActivitiesExport): string {
  const day = data.exportedAt.slice(0, 10)
  const label = (data.moduleName || data.placesListName || "activities")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
  return `cogs-activities-map-${label || "export"}-${day}`
}

/** Download full JSON (all fields) for the Activities map. */
export function downloadTripActivitiesJson(
  data: TripActivitiesExport,
  filename?: string,
): void {
  triggerDownload(
    serializeTripActivitiesExport(data),
    filename ?? `${defaultStem(data)}.json`,
    "application/json",
  )
}

/** Download CSV of names / types / lists / addresses / notes / coords. */
export function downloadTripActivitiesCsv(
  data: TripActivitiesExport,
  filename?: string,
): void {
  triggerDownload(
    tripActivitiesExportToCsv(data),
    filename ?? `${defaultStem(data)}.csv`,
    "text/csv;charset=utf-8",
  )
}

function normalizeLists(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return [...new Set(raw.map((x) => String(x).trim()).filter(Boolean))]
  }
  if (typeof raw === "string" && raw.trim()) {
    return [
      ...new Set(
        raw
          .split(/[|;]/)
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ]
  }
  return ["Must do"]
}

function normalizePlaceRow(raw: Record<string, unknown>): TripActivitiesPlaceExport | null {
  const attrs =
    raw.attributes && typeof raw.attributes === "object" && !Array.isArray(raw.attributes)
      ? ({ ...(raw.attributes as Record<string, unknown>) } as Record<string, unknown>)
      : ({} as Record<string, unknown>)

  const name = String(raw.name ?? raw.title ?? raw.description ?? attrs.name ?? "").trim()
  if (!name) return null

  const lists = normalizeLists(raw.lists ?? raw.list ?? attrs.bucket ?? "Must do")
  const type = String(raw.type ?? raw.placeKind ?? attrs.placeKind ?? "Place").trim() || "Place"
  const address = String(raw.address ?? attrs.address ?? "").trim()
  const notes = String(raw.notes ?? attrs.notes ?? "").trim()
  const city = String(raw.city ?? attrs.city ?? "").trim()
  const lat = readCoord(raw.lat ?? attrs.lat)
  const lng = readCoord(raw.lng ?? attrs.lng)
  const googlePlaceId = String(raw.googlePlaceId ?? attrs.googlePlaceId ?? "").trim()
  const photoRaw = raw.photoUrls ?? attrs.photoUrls
  const photoUrls = Array.isArray(photoRaw)
    ? photoRaw.map(String).filter(Boolean)
    : typeof photoRaw === "string" && photoRaw.trim()
      ? [photoRaw.trim()]
      : []
  const done =
    raw.done === true ||
    raw.done === "true" ||
    raw.completed === true ||
    String(raw.done ?? "").toLowerCase() === "yes"

  return {
    id: String(raw.id ?? "").trim(),
    name,
    lists: lists.length ? lists : ["Must do"],
    type,
    address,
    notes,
    city,
    lat,
    lng,
    googlePlaceId,
    photoUrls,
    done,
    attributes: {
      ...attrs,
      placeKind: type,
      address,
      notes,
      city,
      bucket: encodePlaceLists(lists.length ? lists : ["Must do"]),
      ...(lat != null ? { lat } : {}),
      ...(lng != null ? { lng } : {}),
      ...(googlePlaceId ? { googlePlaceId } : {}),
      ...(photoUrls.length ? { photoUrls } : {}),
    },
  }
}

/** Parse a COGS activities JSON export (envelope or bare `{ places: [...] }` / array). */
export function parseTripActivitiesJson(text: string): TripActivitiesImportResult {
  const data = JSON.parse(text) as unknown
  let placesRaw: unknown[] = []
  let cities: string[] = []
  let activityListNames: string[] = []
  let activityListColors: Record<string, string> = {}
  let selectedCity: string | undefined

  if (Array.isArray(data)) {
    placesRaw = data
  } else if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.places)) placesRaw = obj.places
    else if (Array.isArray(obj.items)) placesRaw = obj.items
    else throw new Error("JSON must include a places array")

    cities = Array.isArray(obj.cities) ? obj.cities.map(String).filter(Boolean) : []
    activityListNames = Array.isArray(obj.activityListNames)
      ? obj.activityListNames.map(String).filter(Boolean)
      : []
    if (obj.activityListColors && typeof obj.activityListColors === "object") {
      activityListColors = Object.fromEntries(
        Object.entries(obj.activityListColors as Record<string, unknown>).map(([k, v]) => [
          k,
          String(v),
        ]),
      )
    }
    if (typeof obj.selectedCity === "string") selectedCity = obj.selectedCity
  } else {
    throw new Error("Unrecognized JSON")
  }

  const places = placesRaw
    .map((row) =>
      row && typeof row === "object" ? normalizePlaceRow(row as Record<string, unknown>) : null,
    )
    .filter((p): p is TripActivitiesPlaceExport => Boolean(p))

  if (!places.length) throw new Error("No places found in JSON")

  const listNames = [...new Set([...activityListNames, ...places.flatMap((p) => p.lists)])]
  const cityNames = [...new Set([...cities, ...places.map((p) => p.city).filter(Boolean)])]

  return {
    places,
    cities: cityNames,
    activityListNames: listNames,
    activityListColors,
    selectedCity,
    source: "json",
  }
}

/** Parse CSV exported by `tripActivitiesExportToCsv` (or compatible headers). */
export function parseTripActivitiesCsv(
  text: string,
  fileName = "import.csv",
): TripActivitiesImportResult {
  const { headers, rows } = parseSpreadsheetText(text, fileName)
  if (!headers.length || !rows.length) throw new Error("CSV is empty")

  const idx = (names: string[]) => {
    const lower = headers.map((h) => h.trim().toLowerCase())
    for (const n of names) {
      const i = lower.indexOf(n.toLowerCase())
      if (i >= 0) return i
    }
    return -1
  }

  const nameI = idx(["name", "title", "description", "place"])
  if (nameI < 0) throw new Error("CSV needs a name column")

  const typeI = idx(["type", "placekind", "kind"])
  const listsI = idx(["lists", "list", "bucket", "categories"])
  const addressI = idx(["address", "addr"])
  const notesI = idx(["notes", "note"])
  const cityI = idx(["city"])
  const latI = idx(["lat", "latitude"])
  const lngI = idx(["lng", "lon", "longitude"])
  const gI = idx(["googleplaceid", "placeid", "google_place_id"])
  const doneI = idx(["done", "completed"])
  const idI = idx(["id"])

  const places: TripActivitiesPlaceExport[] = []
  for (const row of rows) {
    const get = (i: number) => (i >= 0 ? String(row[i] ?? "").trim() : "")
    const normalized = normalizePlaceRow({
      name: get(nameI),
      type: get(typeI) || "Place",
      lists: get(listsI),
      address: get(addressI),
      notes: get(notesI),
      city: get(cityI),
      lat: get(latI),
      lng: get(lngI),
      googlePlaceId: get(gI),
      done: get(doneI),
      id: get(idI),
    })
    if (normalized) places.push(normalized)
  }

  if (!places.length) throw new Error("No places found in CSV")

  return {
    places,
    cities: [...new Set(places.map((p) => p.city).filter(Boolean))],
    activityListNames: [...new Set(places.flatMap((p) => p.lists))],
    activityListColors: {},
    source: "csv",
  }
}

/** Detect JSON vs CSV from filename / contents and parse. */
export function parseTripActivitiesImport(
  text: string,
  fileName = "",
): TripActivitiesImportResult {
  const trimmed = text.replace(/^\uFEFF/, "").trim()
  if (!trimmed) throw new Error("File is empty")

  const looksJson =
    /\.json$/i.test(fileName) || trimmed.startsWith("{") || trimmed.startsWith("[")

  if (looksJson) {
    try {
      return parseTripActivitiesJson(trimmed)
    } catch (e) {
      if (/\.json$/i.test(fileName)) throw e
    }
  }

  return parseTripActivitiesCsv(trimmed, fileName || "import.csv")
}

/** Build task attributes for an imported place row. */
export function importedPlaceAttributes(
  place: TripActivitiesPlaceExport,
  fallbackCity: string,
): Record<string, unknown> {
  const lists = place.lists.length ? place.lists : ["Must do"]
  return {
    ...(place.attributes || {}),
    city: place.city || fallbackCity,
    bucket: encodePlaceLists(lists),
    placeKind: place.type || "Place",
    address: place.address || "",
    notes: place.notes || "",
    ...(place.lat != null ? { lat: place.lat } : {}),
    ...(place.lng != null ? { lng: place.lng } : {}),
    ...(place.googlePlaceId ? { googlePlaceId: place.googlePlaceId } : {}),
    ...(place.photoUrls.length ? { photoUrls: place.photoUrls } : {}),
  }
}
