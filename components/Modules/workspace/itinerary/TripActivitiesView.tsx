/**
 * Trip Activities map — cities, stays, multi-list filters, Leaflet pins,
 * place autocomplete, city boundary, default airport, distance measure.
 */
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { MapPin, Bed, Plane, Plus, Trash2, Ruler, ExternalLink, X, Pencil, Check, ChevronLeft, ChevronRight, Download, Upload, Home, Briefcase, Landmark } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import { useModulesStore } from "@/lib/modules-store"
import { createListItem, withCategoryDefaults } from "@/lib/item-utils"
import { citiesFromTripItinerary, itineraryShowsSleep } from "@/lib/trip-itinerary"
import {
  cityChipKey,
  dedupeCityLabels,
  DEFAULT_ACTIVITY_LISTS,
  encodePlaceLists,
  getPlaceLists,
  placeInList,
  placeVisibleForLists,
  togglePlaceList,
  colorForList,
  colorForPlaceKind,
  withListColor,
  FIXED_PIN_COLORS,
  isAlwaysVisiblePlaceKind,
  isSignificantPlaceKind,
  labelForPlaceKind,
  type SignificantPlaceKind,
} from "@/lib/trip-activity-lists"
import { parseCoord } from "@/lib/geocode"
import {
  fetchCityRegion,
  findCityAirport,
  resolvePlaceInCity,
  resolvePlacePaste,
  fetchPlacePhotos,
  geocodeNameAddress,
  type PlaceSuggestion,
} from "@/lib/places-search"
import {
  buildTripActivitiesExport,
  downloadTripActivitiesCsv,
  downloadTripActivitiesJson,
  importedPlaceAttributes,
  parseTripActivitiesImport,
} from "@/lib/trip-activities-export"
import { parsePlacePasteBlock } from "@/lib/parse-place-paste"
import { estimateRoute, type RouteEstimate, type TravelMode } from "@/lib/trip-directions"
import type { ModuleInstance, ModuleView } from "@/lib/modules-store"
import type { Task } from "@/lib/types"
import type { CityBoundsData, MapPinData } from "./TripMapCanvas"
import { PlaceSuggestInput } from "./PlaceSuggestInput"
import "leaflet/dist/leaflet.css"
import "./trip-activities.css"

const MapCanvas = dynamic(() => import("./TripMapCanvas").then((m) => m.TripMapCanvas), {
  ssr: false,
  loading: () => <div className="trip-map-placeholder">Loading map…</div>,
})

export function TripActivitiesView({
  view,
  module,
}: {
  view: ModuleView
  module?: ModuleInstance
  onOpenItem?: (id: string) => void
}) {
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const addTask = useTaskStore((s) => s.addTask)
  const updateTask = useTaskStore((s) => s.updateTask)
  const deleteTask = useTaskStore((s) => s.deleteTask)
  const updateList = useTaskStore((s) => s.updateList)
  const updateModule = useModulesStore((s) => s.updateModule)

  const placesId =
    view.config.placesCategoryId || view.config.categoryId || module?.config?.placesCategoryId
  const placesList = placesId ? lists.find((l) => l.id === placesId) : undefined
  const places = useMemo(
    () => (placesId ? tasks.filter((t) => t.lists?.includes(placesId)) : []),
    [tasks, placesId],
  )

  const removedCityKeys = useMemo(
    () => new Set((module?.config?.removedActivityCities ?? []).map((k) => k.toLowerCase())),
    [module?.config?.removedActivityCities],
  )

  const cities = useMemo(() => {
    const raw: string[] = [...citiesFromTripItinerary(module?.config?.tripItinerary)]
    for (const p of places) {
      const c = String(p.attributes?.city ?? "").trim()
      if (c) raw.push(c)
    }
    const deduped = dedupeCityLabels(raw).filter((c) => !removedCityKeys.has(cityChipKey(c)))
    return deduped.length ? deduped : ["Trip"]
  }, [module?.config?.tripItinerary, places, removedCityKeys])

  const [city, setCity] = useState(
    () => module?.config?.activitySelectedCity || cities[0] || "Trip",
  )
  useEffect(() => {
    if (!cities.some((c) => cityChipKey(c) === cityChipKey(city)) && cities[0]) {
      setCity(cities[0])
    }
  }, [cities, city])

  useEffect(() => {
    if (!module?.id) return
    if (!useModulesStore.persist.hasHydrated()) return
    if (module.config?.activitySelectedCity === city) return
    updateModule(module.id, { config: { activitySelectedCity: city } })
  }, [city, module?.id, module?.config?.activitySelectedCity, updateModule])

  const listOptionsFromSchema = useMemo(() => {
    const attr = placesList?.itemAttributes?.find((a) => a.id === "bucket")
    return (attr?.options ?? []).map(String).filter(Boolean)
  }, [placesList])

  const bucketsInUse = useMemo(() => {
    const set = new Set<string>([
      ...DEFAULT_ACTIVITY_LISTS,
      ...(module?.config?.activityListNames ?? []),
      ...listOptionsFromSchema,
    ])
    for (const p of places) {
      for (const b of getPlaceLists(p)) set.add(b)
    }
    return [...set]
  }, [places, module?.config?.activityListNames, listOptionsFromSchema])

  const [visibleBuckets, setVisibleBuckets] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(DEFAULT_ACTIVITY_LISTS.map((b) => [b, true])),
  )
  /** Snapshot of list filters before an "Only" click — restored when Only is toggled off. */
  const bucketsBeforeOnly = useRef<Record<string, boolean> | null>(null)
  useEffect(() => {
    setVisibleBuckets((prev) => {
      const next = { ...prev }
      for (const b of bucketsInUse) if (next[b] === undefined) next[b] = true
      return next
    })
  }, [bucketsInUse])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [placeName, setPlaceName] = useState("")
  /** Lists assigned when adding a new place (multi-select). */
  const [placeListsDraft, setPlaceListsDraft] = useState<string[]>(["Must do"])
  const [bulk, setBulk] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [customBucket, setCustomBucket] = useState("")
  const [cityBounds, setCityBounds] = useState<CityBoundsData | null>(null)
  const [cityCenter, setCityCenter] = useState<{ lat: number; lng: number } | null>(null)
  const importFileRef = useRef<HTMLInputElement>(null)

  // Distance measure
  const [measureMode, setMeasureMode] = useState(false)
  const [measurePick, setMeasurePick] = useState<string[]>([])
  const [routeEstimate, setRouteEstimate] = useState<RouteEstimate | null>(null)
  const [routeBusy, setRouteBusy] = useState(false)
  const [travelMode, setTravelMode] = useState<TravelMode>("walking")

  const staysForCity = useMemo(() => {
    if (!itineraryShowsSleep(module?.config?.tripItinerary)) return []
    const days = module?.config?.tripItinerary?.days ?? []
    return days
      .filter((d) => {
        const label = d.cityMode === "travel" ? d.toCity || d.fromCity || "" : d.city
        return (
          cityChipKey(label).includes(cityChipKey(city)) ||
          cityChipKey(city).includes(cityChipKey((label || "").split(",")[0] || ""))
        )
      })
      .filter((d) => d.sleepName)
      .map((d) => ({
        id: `sleep-${d.date}`,
        description: d.sleepName!,
        attributes: { address: d.sleepAddress, lat: undefined, lng: undefined, placeKind: "Stay" },
      }))
  }, [module?.config?.tripItinerary, city])

  const placesForCity = useMemo(() => {
    const token = cityChipKey(city)
    return places.filter((p) => {
      const pc = cityChipKey(String(p.attributes?.city ?? ""))
      return (
        pc === cityChipKey(city) ||
        pc === token ||
        pc.includes(token) ||
        token.includes(pc)
      )
    })
  }, [places, city])

  const listColors = module?.config?.activityListColors

  const showSleep = itineraryShowsSleep(module?.config?.tripItinerary)

  const pins: MapPinData[] = useMemo(() => {
    const out: MapPinData[] = []

    for (const p of placesForCity) {
      const pk = String(p.attributes?.placeKind ?? "Place")
      if (pk === "Stay" && !showSleep) continue
      const alwaysOn = isAlwaysVisiblePlaceKind(pk)
      if (!alwaysOn && !placeVisibleForLists(p, visibleBuckets)) continue
      const lat = parseCoord(p.attributes?.lat)
      const lng = parseCoord(p.attributes?.lng)
      if (lat == null || lng == null) continue
      const kind: MapPinData["kind"] =
        pk === "Airport"
          ? "airport"
          : pk === "Stay"
            ? "stay"
            : isSignificantPlaceKind(pk)
              ? "landmark"
              : "place"
      const color = colorForPlaceKind(pk, getPlaceLists(p), listColors)
      out.push({
        id: p.id,
        lat,
        lng,
        label: p.description,
        kind,
        bucket: alwaysOn ? labelForPlaceKind(pk) : getPlaceLists(p).join(", "),
        address: String(p.attributes?.address ?? ""),
        notes: String(p.attributes?.notes ?? ""),
        color,
      })
    }
    return out
  }, [placesForCity, visibleBuckets, listColors, showSleep])

  const stayPlaces = useMemo(
    () =>
      showSleep
        ? placesForCity.filter((p) => String(p.attributes?.placeKind) === "Stay")
        : [],
    [placesForCity, showSleep],
  )
  const airportPlaces = useMemo(
    () => placesForCity.filter((p) => String(p.attributes?.placeKind) === "Airport"),
    [placesForCity],
  )
  const significantPlaces = useMemo(
    () =>
      placesForCity.filter((p) => isSignificantPlaceKind(String(p.attributes?.placeKind))),
    [placesForCity],
  )

  // Load city boundary + center when city changes
  useEffect(() => {
    let cancelled = false
    setCityBounds(null)
    setCityCenter(null)
    setSelectedId(null)
    setMeasurePick([])
    setRouteEstimate(null)
    ;(async () => {
      const region = await fetchCityRegion(city)
      if (cancelled || !region) return
      setCityCenter({ lat: region.lat, lng: region.lng })
      setCityBounds({ bounds: region.bounds, polygon: region.polygon })
    })()
    return () => {
      cancelled = true
    }
  }, [city])

  // Auto-add airport pin once per city (user can delete)
  const airportSeeded = useRef(new Set<string>())
  useEffect(() => {
    if (!placesId || !placesList || !cityCenter) return
    const key = cityChipKey(city)
    if (airportSeeded.current.has(key)) return
    const hasAirport = placesForCity.some((p) => String(p.attributes?.placeKind) === "Airport")
    if (hasAirport) {
      airportSeeded.current.add(key)
      return
    }
    let cancelled = false
    ;(async () => {
      const airport = await findCityAirport(city, cityCenter.lat, cityCenter.lng)
      if (cancelled || !airport) {
        airportSeeded.current.add(key)
        return
      }
      const stillMissing = !useTaskStore
        .getState()
        .tasks.some(
          (t) =>
            t.lists?.includes(placesId) &&
            String(t.attributes?.placeKind) === "Airport" &&
            cityChipKey(String(t.attributes?.city ?? "")) === key,
        )
      if (!stillMissing) {
        airportSeeded.current.add(key)
        return
      }
      addTask(
        withCategoryDefaults(
          {
            ...createListItem(airport.name, [placesId]),
            attributes: {
              city,
              bucket: "Must do",
              placeKind: "Airport",
              address: airport.address,
              lat: airport.lat,
              lng: airport.lng,
            },
          },
          placesList,
        ),
      )
      airportSeeded.current.add(key)
    })()
    return () => {
      cancelled = true
    }
  }, [city, cityCenter, placesId, placesList, placesForCity, addTask])

  // Ensure itinerary sleeps become map pins (City Places Stay) with coords.
  // Track by sleepKey only after success — marking before await + effect cancel
  // left stays stuck on “Placing on map…” forever.
  const plottedStays = useRef(new Set<string>())
  const stayPlotInFlight = useRef(new Set<string>())
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!placesId || !placesList) return

      // Dedupe multi-night stays (same hotel across days)
      const uniqueStays: { name: string; addr: string; sleepKey: string }[] = []
      const seenKeys = new Set<string>()
      for (const s of staysForCity) {
        const name = s.description.trim()
        if (!name) continue
        const sleepKey = `${cityChipKey(city)}::${name.toLowerCase()}`
        if (seenKeys.has(sleepKey)) continue
        seenKeys.add(sleepKey)
        uniqueStays.push({
          name,
          addr: String(s.attributes?.address ?? "")
            .replace(/[\u200B-\u200D\uFEFF]/g, "")
            .trim(),
          sleepKey,
        })
      }

      for (const { name, addr, sleepKey } of uniqueStays) {
        if (cancelled) return

        const livePlaces = useTaskStore
          .getState()
          .tasks.filter((t) => t.lists?.includes(placesId))
        const existing = livePlaces.find(
          (p) =>
            String(p.attributes?.placeKind) === "Stay" &&
            (p.description.trim().toLowerCase() === name.toLowerCase() ||
              String(p.attributes?.itinerarySleepKey ?? "") === sleepKey),
        )

        if (existing) {
          const hasCoords =
            parseCoord(existing.attributes?.lat) != null &&
            parseCoord(existing.attributes?.lng) != null
          if (hasCoords) {
            plottedStays.current.add(sleepKey)
            continue
          }
          // Existing stay without pin — keep trying (don't treat as done)
        } else if (plottedStays.current.has(sleepKey)) {
          // Already created this stay (may still be waiting for coords via existing branch)
          continue
        }

        if (stayPlotInFlight.current.has(sleepKey)) continue

        stayPlotInFlight.current.add(sleepKey)
        try {
          const geo = await geocodeNameAddress(name, addr, {
            cityLabel: city,
            cityLat: cityCenter?.lat,
            cityLng: cityCenter?.lng,
          })
          if (cancelled) continue

          const lat = geo?.lat ?? cityCenter?.lat
          const lng = geo?.lng ?? cityCenter?.lng

          if (existing) {
            const current = useTaskStore.getState().tasks.find((t) => t.id === existing.id)
            if (!current) continue
            updateTask({
              ...current,
              attributes: {
                ...current.attributes,
                address: String(current.attributes?.address ?? addr),
                ...(lat != null ? { lat } : {}),
                ...(lng != null ? { lng } : {}),
                itinerarySleepKey: sleepKey,
              },
            })
          } else {
            // Re-check — a parallel/cancelled run may have created it already
            const already = useTaskStore
              .getState()
              .tasks.some(
                (t) =>
                  t.lists?.includes(placesId) &&
                  String(t.attributes?.placeKind) === "Stay" &&
                  (t.description.trim().toLowerCase() === name.toLowerCase() ||
                    String(t.attributes?.itinerarySleepKey ?? "") === sleepKey),
              )
            if (already) {
              plottedStays.current.add(sleepKey)
              continue
            }
            addTask(
              withCategoryDefaults(
                {
                  ...createListItem(name, [placesId]),
                  attributes: {
                    city,
                    bucket: "Must do",
                    placeKind: "Stay",
                    address: addr || geo?.address || "",
                    ...(lat != null ? { lat } : {}),
                    ...(lng != null ? { lng } : {}),
                    itinerarySleepKey: sleepKey,
                    literalEntry: true,
                  },
                },
                placesList,
              ),
            )
            // Prevent duplicate creates; coords may still fill on a later pass
            plottedStays.current.add(sleepKey)
          }
          await new Promise((r) => setTimeout(r, 400))
        } finally {
          stayPlotInFlight.current.delete(sleepKey)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [staysForCity, placesId, placesList, city, cityCenter, addTask, updateTask])

  const syncSleepToItinerary = useCallback(
    (prevName: string, nextName: string, nextAddress: string) => {
      if (!module?.id) return
      const data = module.config?.tripItinerary
      if (!data?.days?.length) return
      const cityTok = cityChipKey(city)
      let changed = false
      const days = data.days.map((d) => {
        const label = d.cityMode === "travel" ? d.toCity || d.fromCity || "" : d.city
        const matchesCity =
          cityChipKey(label).includes(cityTok) ||
          cityTok.includes(cityChipKey((label || "").split(",")[0] || ""))
        if (!matchesCity) return d
        if ((d.sleepName || "").trim() !== prevName.trim()) return d
        changed = true
        return { ...d, sleepName: nextName, sleepAddress: nextAddress }
      })
      if (!changed) return
      updateModule(module.id, { config: { tripItinerary: { ...data, days } } })
    },
    [module?.id, module?.config?.tripItinerary, city, updateModule],
  )

  const persistListNames = useCallback(
    (names: string[]) => {
      if (!module?.id) return
      updateModule(module.id, { config: { activityListNames: names } })
      if (!placesList) return
      const attrs = placesList.itemAttributes ?? []
      const nextAttrs = attrs.map((a) =>
        a.id === "bucket"
          ? {
              ...a,
              allowMultiple: true,
              options: [...new Set([...(a.options ?? []), ...names, ...DEFAULT_ACTIVITY_LISTS])],
            }
          : a,
      )
      if (!attrs.some((a) => a.id === "bucket")) {
        nextAttrs.push({
          id: "bucket",
          name: "List",
          type: "selection",
          optionSource: "manual",
          allowMultiple: true,
          options: [...new Set([...DEFAULT_ACTIVITY_LISTS, ...names])],
        })
      }
      updateList({ ...placesList, itemAttributes: nextAttrs })
    },
    [module?.id, placesList, updateModule, updateList],
  )

  const addFromSuggestion = useCallback(
    (place: PlaceSuggestion, listsForPlace: string[], placeKind = "Place") => {
      if (!placesId || !placesList) return
      const kind =
        place.kind === "aerodrome" || /airport/i.test(place.name)
          ? "Airport"
          : placeKind
      const photos = place.photoUrls?.length ? place.photoUrls : undefined
      const task = withCategoryDefaults(
        {
          ...createListItem(place.name, [placesId]),
          attributes: {
            city,
            bucket: encodePlaceLists(listsForPlace),
            placeKind: kind,
            address: place.address,
            lat: place.lat,
            lng: place.lng,
            ...(photos ? { photoUrls: photos } : {}),
            ...(place.googlePlaceId ? { googlePlaceId: place.googlePlaceId } : {}),
          },
        },
        placesList,
      )
      addTask(task)
      setPlaceName("")
      setErr(null)

      // Background photo enrich when we only have coords
      if (!photos?.length) {
        const taskId = task.id
        void (async () => {
          const urls = await fetchPlacePhotos({
            name: place.name,
            address: place.address,
            cityLabel: city,
            lat: place.lat,
            lng: place.lng,
            googlePlaceId: place.googlePlaceId,
          })
          if (!urls.length) return
          const current = useTaskStore.getState().tasks.find((t) => t.id === taskId)
          if (!current) return
          updateTask({
            ...current,
            attributes: { ...current.attributes, photoUrls: urls },
          })
        })()
      }
    },
    [placesId, placesList, city, addTask, updateTask],
  )

  /**
   * Add with the exact name + address typed — never replace with a Places match.
   * Soft-geocode only for a map pin (lat/lng); name/address stay literal.
   * Significant kinds (Home / Work / Landmark) skip filter lists.
   */
  const addLiteralPlace = useCallback(
    async (raw: string, listsForPlace: string[], placeKind = "Place") => {
      if (!placesId || !placesList || !raw.trim()) return false
      const parsed = parsePlacePasteBlock(raw)[0] || { name: raw.trim(), raw: raw.trim() }
      const name = parsed.name.trim()
      const address = (parsed.address || "").trim()
      if (!name) return false

      let lat: number | undefined
      let lng: number | undefined
      try {
        const geo =
          (await resolvePlacePaste(parsed, city, cityCenter?.lat, cityCenter?.lng)) ||
          (address
            ? await resolvePlaceInCity(address, city, cityCenter?.lat, cityCenter?.lng)
            : null) ||
          (await resolvePlaceInCity(name, city, cityCenter?.lat, cityCenter?.lng))
        if (geo) {
          lat = geo.lat
          lng = geo.lng
        }
      } catch {
        /* pin optional — still save literal text */
      }

      const significant = isSignificantPlaceKind(placeKind)
      const task = withCategoryDefaults(
        {
          ...createListItem(name, [placesId]),
          attributes: {
            city,
            bucket: significant ? "" : encodePlaceLists(listsForPlace),
            placeKind,
            address,
            ...(lat != null ? { lat } : {}),
            ...(lng != null ? { lng } : {}),
            literalEntry: true,
          },
        },
        placesList,
      )
      addTask(task)
      setPlaceName("")
      setErr(null)
      setSelectedId(task.id)
      return true
    },
    [placesId, placesList, city, cityCenter, addTask],
  )

  const addSignificantLandmark = async (kind: SignificantPlaceKind) => {
    const defaults: Record<SignificantPlaceKind, string> = {
      Home: "Home",
      Work: "Work",
      Significant: "Landmark",
    }
    const raw = placeName.trim() || defaults[kind]
    setBusy(true)
    setErr(null)
    try {
      const ok = await addLiteralPlace(raw, [], kind)
      if (!ok) setErr("Enter a name (optionally: Name - address).")
    } finally {
      setBusy(false)
    }
  }

  const addPlaceByName = async (name: string, listsForPlace: string[], placeKind = "Place") => {
    if (!placesId || !placesList || !name.trim()) return false
    try {
      const parsed = parsePlacePasteBlock(name)[0] || { name: name.trim(), raw: name.trim() }
      const geo =
        (await resolvePlacePaste(parsed, city, cityCenter?.lat, cityCenter?.lng)) ||
        (await resolvePlaceInCity(name.trim(), city, cityCenter?.lat, cityCenter?.lng))
      if (!geo) return false
      addFromSuggestion(geo, listsForPlace, placeKind)
      return true
    } catch {
      return false
    }
  }

  const onAddOne = async () => {
    setBusy(true)
    setErr(null)
    try {
      const ok = await addPlaceByName(placeName, placeListsDraft)
      if (!ok) setErr(`Could not find “${placeName.trim()}” near ${city} — try picking a suggestion, or use Add as typed.`)
    } finally {
      setBusy(false)
    }
  }

  const onAddLiteral = async () => {
    setBusy(true)
    setErr(null)
    try {
      const ok = await addLiteralPlace(placeName, placeListsDraft)
      if (!ok) setErr("Enter a name (optionally: Name - address).")
    } finally {
      setBusy(false)
    }
  }

  const onAddBulk = async () => {
    const rows = parsePlacePasteBlock(bulk)
    if (!rows.length) return
    setBusy(true)
    setErr(null)
    const failed: string[] = []
    let added = 0
    try {
      for (const row of rows) {
        const geo = await resolvePlacePaste(row, city, cityCenter?.lat, cityCenter?.lng)
        if (!geo) {
          failed.push(row.name)
        } else {
          addFromSuggestion(geo, placeListsDraft)
          added += 1
        }
        // Nominatim wants ~1 req/s; Photon is fine faster — keep a small gap.
        await new Promise((r) => setTimeout(r, 450))
      }
      if (added) setBulk("")
      if (failed.length) {
        setErr(
          failed.length === rows.length
            ? `Could not geocode any of ${rows.length} places. Check the city chip and try again.`
            : `Added ${added}. Couldn’t find: ${failed.join(", ")}`,
        )
      }
    } finally {
      setBusy(false)
    }
  }

  /** Bulk-add keeping each line’s name/address exactly; soft pin only. */
  const onAddBulkLiteral = async () => {
    const rows = parsePlacePasteBlock(bulk)
    if (!rows.length) return
    setBusy(true)
    setErr(null)
    let added = 0
    try {
      for (const row of rows) {
        const line = row.address ? `${row.name} - ${row.address}` : row.name
        const ok = await addLiteralPlace(line, placeListsDraft)
        if (ok) added += 1
        await new Promise((r) => setTimeout(r, 350))
      }
      if (added) setBulk("")
      if (!added) setErr("Nothing to add — use lines like Name - address.")
    } finally {
      setBusy(false)
    }
  }

  const setListColor = (listName: string, color: string) => {
    if (!module?.id) return
    updateModule(module.id, {
      config: {
        activityListColors: withListColor(module.config?.activityListColors, listName, color),
      },
    })
  }

  /** Import places from a COGS JSON export or compatible CSV. */
  const onImportFile = useCallback(
    async (file: File) => {
      if (!placesId || !placesList) {
        setErr("City Places list is not ready yet.")
        return
      }
      setBusy(true)
      setErr(null)
      try {
        const text = await file.text()
        const parsed = parseTripActivitiesImport(text, file.name)
        const fallbackCity = parsed.selectedCity || city

        const mergedNames = [
          ...new Set([
            ...(module?.config?.activityListNames ?? []),
            ...bucketsInUse,
            ...parsed.activityListNames,
            ...DEFAULT_ACTIVITY_LISTS,
          ]),
        ]
        persistListNames(mergedNames)

        if (module?.id && Object.keys(parsed.activityListColors).length) {
          updateModule(module.id, {
            config: {
              activityListColors: {
                ...(module.config?.activityListColors ?? {}),
                ...parsed.activityListColors,
              },
            },
          })
        }

        if (parsed.selectedCity) setCity(parsed.selectedCity)

        let added = 0
        for (const row of parsed.places) {
          const attrs = importedPlaceAttributes(row, fallbackCity)
          let lat = typeof attrs.lat === "number" ? attrs.lat : undefined
          let lng = typeof attrs.lng === "number" ? attrs.lng : undefined

          if (lat == null || lng == null) {
            try {
              const geo = await geocodeNameAddress(row.name, row.address, {
                cityLabel: String(attrs.city || fallbackCity),
                cityLat: cityCenter?.lat,
                cityLng: cityCenter?.lng,
              })
              if (geo) {
                lat = geo.lat
                lng = geo.lng
                if (!row.address && geo.address) attrs.address = geo.address
              }
            } catch {
              /* pin optional */
            }
          }

          const task = withCategoryDefaults(
            {
              ...createListItem(row.name, [placesId]),
              completed: row.done,
              attributes: {
                ...attrs,
                ...(lat != null ? { lat } : {}),
                ...(lng != null ? { lng } : {}),
              },
            },
            placesList,
          )
          addTask(task)
          added += 1
          if (lat == null) await new Promise((r) => setTimeout(r, 250))
        }

        if (!added) setErr("No places found in that file.")
        else setErr(null)
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Could not import file.")
      } finally {
        setBusy(false)
        if (importFileRef.current) importFileRef.current.value = ""
      }
    },
    [
      placesId,
      placesList,
      city,
      cityCenter,
      module,
      bucketsInUse,
      persistListNames,
      updateModule,
      addTask,
    ],
  )

  const toggleBucket = (b: string) => {
    bucketsBeforeOnly.current = null
    setVisibleBuckets((prev) => ({ ...prev, [b]: !prev[b] }))
  }

  /** Show only this list — click again to restore the previous selection. */
  const showOnlyBucket = (b: string) => {
    const isAlreadyOnly =
      bucketsInUse.length > 0 &&
      bucketsInUse.every((name) =>
        name === b ? visibleBuckets[name] !== false : visibleBuckets[name] === false,
      )

    if (isAlreadyOnly) {
      if (bucketsBeforeOnly.current) {
        setVisibleBuckets({ ...bucketsBeforeOnly.current })
        bucketsBeforeOnly.current = null
      } else {
        showAllBuckets()
      }
      return
    }

    bucketsBeforeOnly.current = { ...visibleBuckets }
    for (const name of bucketsInUse) {
      if (bucketsBeforeOnly.current[name] === undefined) bucketsBeforeOnly.current[name] = true
    }
    setVisibleBuckets((prev) => {
      const next: Record<string, boolean> = { ...prev }
      for (const name of bucketsInUse) next[name] = name === b
      next[b] = true
      return next
    })
  }

  const showAllBuckets = () => {
    bucketsBeforeOnly.current = null
    setVisibleBuckets((prev) => {
      const next = { ...prev }
      for (const name of bucketsInUse) next[name] = true
      return next
    })
  }

  const onlyOneVisible =
    bucketsInUse.length > 1 &&
    bucketsInUse.filter((b) => visibleBuckets[b] !== false).length === 1

  const addCustomBucket = () => {
    const b = customBucket.trim()
    if (!b) return
    const names = [...new Set([...(module?.config?.activityListNames ?? []), ...bucketsInUse, b])]
    persistListNames(names)
    setVisibleBuckets((prev) => ({ ...prev, [b]: true }))
    setPlaceListsDraft((prev) => (prev.includes(b) ? prev : [...prev, b]))
    setCustomBucket("")
  }

  const removeCityChip = (label: string) => {
    if (!module?.id) return
    const key = cityChipKey(label)
    const next = [...new Set([...(module.config?.removedActivityCities ?? []), key])]
    updateModule(module.id, { config: { removedActivityCities: next } })
    if (cityChipKey(city) === key) {
      const remaining = cities.filter((c) => cityChipKey(c) !== key)
      setCity(remaining[0] || "Trip")
    }
  }

  const onMapSelect = (id: string) => {
    if (measureMode) {
      setMeasurePick((prev) => {
        if (prev.includes(id)) return prev.filter((x) => x !== id)
        if (prev.length >= 2) return [prev[1]!, id]
        return [...prev, id]
      })
      setRouteEstimate(null)
      return
    }
    setSelectedId(id)
  }

  // Compute route when two pins + mode ready
  useEffect(() => {
    if (measurePick.length !== 2) {
      setRouteEstimate(null)
      return
    }
    const a = pins.find((p) => p.id === measurePick[0])
    const b = pins.find((p) => p.id === measurePick[1])
    if (!a || !b) return
    let cancelled = false
    setRouteBusy(true)
    ;(async () => {
      const est = await estimateRoute(
        { lat: a.lat, lng: a.lng },
        { lat: b.lat, lng: b.lng },
        travelMode,
      )
      if (!cancelled) {
        setRouteEstimate(est)
        setRouteBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [measurePick, travelMode, pins])

  const routeLine: [number, number][] | null =
    measurePick.length === 2
      ? (() => {
          const a = pins.find((p) => p.id === measurePick[0])
          const b = pins.find((p) => p.id === measurePick[1])
          return a && b ? [[a.lat, a.lng], [b.lat, b.lng]] : null
        })()
      : null

  const selectedPlace = useMemo(() => {
    if (!selectedId) return null
    return places.find((p) => p.id === selectedId) || null
  }, [selectedId, places])

  // Lazy-load photos when selecting a place that has none yet
  useEffect(() => {
    if (!selectedPlace) return
    const existing = readPhotoUrls(selectedPlace)
    if (existing.length) return
    let cancelled = false
    ;(async () => {
      const urls = await fetchPlacePhotos({
        name: selectedPlace.description,
        address: String(selectedPlace.attributes?.address ?? ""),
        cityLabel: city,
        lat: parseCoord(selectedPlace.attributes?.lat) ?? undefined,
        lng: parseCoord(selectedPlace.attributes?.lng) ?? undefined,
        googlePlaceId: String(selectedPlace.attributes?.googlePlaceId ?? "") || undefined,
      })
      if (cancelled || !urls.length) return
      const current = useTaskStore.getState().tasks.find((t) => t.id === selectedPlace.id)
      if (!current) return
      updateTask({
        ...current,
        attributes: { ...current.attributes, photoUrls: urls },
      })
    })()
    return () => {
      cancelled = true
    }
  }, [selectedPlace?.id, city, updateTask]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!placesId) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No City Places list linked. Create a new Itinerary module (or add a City Places list) to use
        Activities.
      </p>
    )
  }

  return (
    <div className="trip-activities">
      <div className="flex flex-wrap gap-1.5 mb-3 items-center">
        {cities.map((c) => {
          const active = cityChipKey(city) === cityChipKey(c)
          return (
          <span key={cityChipKey(c)} className={`trip-city-chip-wrap ${active ? "is-active" : ""}`}>
            <button
              type="button"
              className={`trip-city-chip ${active ? "is-active" : ""}`}
              onClick={() => setCity(c)}
            >
              {c}
            </button>
            {c !== "Trip" && (
              <button
                type="button"
                className="trip-city-chip-x"
                title={`Remove ${c}`}
                onClick={(e) => {
                  e.stopPropagation()
                  removeCityChip(c)
                }}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
          )
        })}
        <button
          type="button"
          className={`trip-measure-btn ${measureMode ? "is-on" : ""}`}
          onClick={() => {
            setMeasureMode((m) => !m)
            setMeasurePick([])
            setRouteEstimate(null)
          }}
          title="Measure distance between two pins"
        >
          <Ruler className="h-3.5 w-3.5" />
          Distance
        </button>
        <button
          type="button"
          className="trip-measure-btn"
          disabled={!places.length}
          title="Download all map locations (JSON — full data)"
          onClick={() => {
            const payload = buildTripActivitiesExport({
              places,
              cities,
              activityListNames: module?.config?.activityListNames ?? bucketsInUse,
              activityListColors: module?.config?.activityListColors ?? {},
              selectedCity: city,
              moduleId: module?.id,
              moduleName: module?.title,
              placesListId: placesId,
              placesListName: placesList?.name,
            })
            downloadTripActivitiesJson(payload)
          }}
        >
          <Download className="h-3.5 w-3.5" />
          Export JSON
        </button>
        <button
          type="button"
          className="trip-measure-btn"
          disabled={!places.length}
          title="Download spreadsheet of names, types, lists, addresses, notes"
          onClick={() => {
            const payload = buildTripActivitiesExport({
              places,
              cities,
              activityListNames: module?.config?.activityListNames ?? bucketsInUse,
              activityListColors: module?.config?.activityListColors ?? {},
              selectedCity: city,
              moduleId: module?.id,
              moduleName: module?.title,
              placesListId: placesId,
              placesListName: placesList?.name,
            })
            downloadTripActivitiesCsv(payload)
          }}
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </button>
        <button
          type="button"
          className="trip-measure-btn"
          disabled={busy || !placesId}
          title="Import places from JSON or CSV"
          onClick={() => importFileRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" />
          Import
        </button>
        <input
          ref={importFileRef}
          type="file"
          accept=".json,.csv,application/json,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void onImportFile(file)
          }}
        />
      </div>

      {measureMode && (
        <div className="trip-measure-bar">
          <span className="text-xs font-medium">
            {measurePick.length === 0 && "Click two pins on the map (or list) to compare."}
            {measurePick.length === 1 && "Pick a second pin…"}
            {measurePick.length === 2 && !routeBusy && routeEstimate && (
              <>
                <strong>{routeEstimate.durationLabel}</strong>
                {" · "}
                {routeEstimate.distanceLabel}
                {" · "}
                {travelMode}
              </>
            )}
            {routeBusy && "Calculating…"}
          </span>
          <div className="flex flex-wrap gap-1.5 items-center">
            {(["walking", "driving", "transit"] as TravelMode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`trip-bucket-toggle ${travelMode === m ? "is-on" : ""}`}
                onClick={() => setTravelMode(m)}
              >
                {m === "walking" ? "Walking" : m === "driving" ? "Driving" : "Transit"}
              </button>
            ))}
            {routeEstimate && (
              <a
                href={routeEstimate.mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="trip-maps-link"
              >
                <ExternalLink className="h-3 w-3" />
                Google Maps
              </a>
            )}
            <button
              type="button"
              className="trip-measure-clear"
              onClick={() => {
                setMeasurePick([])
                setRouteEstimate(null)
              }}
              title="Clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="trip-activities-layout">
        <div className="trip-map-pane">
          <MapCanvas
            pins={pins}
            selectedId={measureMode ? null : selectedId}
            onSelect={onMapSelect}
            onSaveNote={(id, note) => {
              const place = places.find((t) => t.id === id)
              if (!place) return
              updateTask({
                ...place,
                attributes: { ...place.attributes, notes: note },
              })
            }}
            cityBounds={cityBounds}
            measureIds={measureMode ? measurePick : undefined}
            routeLine={routeLine}
          />
        </div>

        <aside className="trip-lists-pane space-y-3">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="text-sm font-semibold">Show on map</h3>
              {onlyOneVisible && (
                <button
                  type="button"
                  className="trip-maps-link text-[10px]"
                  onClick={showAllBuckets}
                  title="Show all categories again"
                >
                  Show all
                </button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mb-1.5">
              Airport, sleep, and significant pins (home / work) always stay on the map. Toggle lists
              to filter the rest.
            </p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              <span className="trip-fixed-legend" style={{ borderColor: FIXED_PIN_COLORS.airport }}>
                <span className="trip-list-swatch" style={{ background: FIXED_PIN_COLORS.airport }} />
                Airport
              </span>
              {showSleep && (
                <span className="trip-fixed-legend" style={{ borderColor: FIXED_PIN_COLORS.stay }}>
                  <span className="trip-list-swatch" style={{ background: FIXED_PIN_COLORS.stay }} />
                  Sleeping
                </span>
              )}
              <span className="trip-fixed-legend" style={{ borderColor: FIXED_PIN_COLORS.home }}>
                <span className="trip-list-swatch" style={{ background: FIXED_PIN_COLORS.home }} />
                Home
              </span>
              <span className="trip-fixed-legend" style={{ borderColor: FIXED_PIN_COLORS.work }}>
                <span className="trip-list-swatch" style={{ background: FIXED_PIN_COLORS.work }} />
                Work
              </span>
              <span className="trip-fixed-legend" style={{ borderColor: FIXED_PIN_COLORS.significant }}>
                <span className="trip-list-swatch" style={{ background: FIXED_PIN_COLORS.significant }} />
                Landmark
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {bucketsInUse.map((b) => {
                const on = visibleBuckets[b] !== false
                const color = colorForList(b, listColors)
                const isSolo = on && onlyOneVisible
                return (
                  <div key={b} className="trip-list-color-row">
                    <input
                      type="color"
                      className="trip-list-color-input"
                      value={color}
                      onChange={(e) => setListColor(b, e.target.value)}
                      title={`Pin color for ${b}`}
                      aria-label={`Pin color for ${b}`}
                    />
                    <button
                      type="button"
                      className={`trip-bucket-toggle flex-1 ${on ? "is-on" : ""}`}
                      onClick={() => toggleBucket(b)}
                      style={on ? { borderColor: color, background: `${color}22` } : undefined}
                    >
                      {on ? "✓ " : ""}
                      {b}
                    </button>
                    <button
                      type="button"
                      className={`trip-only-btn ${isSolo ? "is-on" : ""}`}
                      onClick={() => showOnlyBucket(b)}
                      title={isSolo ? `Show previous lists again` : `Show only ${b}`}
                      aria-pressed={isSolo}
                    >
                      Only
                    </button>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-1 mt-2">
              <Input
                value={customBucket}
                onChange={(e) => setCustomBucket(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addCustomBucket()
                  }
                }}
                placeholder="New list (e.g. Restaurants)"
                className="h-8 text-xs"
              />
              <Button size="sm" variant="outline" onClick={addCustomBucket} disabled={!customBucket.trim()}>
                Add list
              </Button>
            </div>
          </div>

          {selectedPlace && (
            <PlacePhotoPanel
              place={selectedPlace}
              onSaveDetails={async (name, address) => {
                const prevName = selectedPlace.description
                const prevAddress = String(selectedPlace.attributes?.address ?? "")
                const addressChanged = address.trim() !== prevAddress.trim()
                const kind = String(selectedPlace.attributes?.placeKind ?? "Place")
                // Keep typed name/address; move pin when address changes (or pin missing)
                const needsPin =
                  addressChanged ||
                  parseCoord(selectedPlace.attributes?.lat) == null ||
                  parseCoord(selectedPlace.attributes?.lng) == null

                let lat = parseCoord(selectedPlace.attributes?.lat) ?? undefined
                let lng = parseCoord(selectedPlace.attributes?.lng) ?? undefined
                let googlePlaceId = String(selectedPlace.attributes?.googlePlaceId ?? "") || undefined

                if (needsPin && (address.trim() || name.trim())) {
                  const geo = await geocodeNameAddress(name, address, {
                    cityLabel: city,
                    cityLat: cityCenter?.lat,
                    cityLng: cityCenter?.lng,
                  })
                  if (geo) {
                    lat = geo.lat
                    lng = geo.lng
                    if (addressChanged) googlePlaceId = geo.googlePlaceId || undefined
                  }
                }

                const current = useTaskStore.getState().tasks.find((t) => t.id === selectedPlace.id)
                if (!current) return
                updateTask({
                  ...current,
                  description: name,
                  title: name,
                  attributes: {
                    ...current.attributes,
                    address,
                    ...(lat != null ? { lat } : {}),
                    ...(lng != null ? { lng } : {}),
                    ...(addressChanged
                      ? googlePlaceId
                        ? { googlePlaceId }
                        : { googlePlaceId: undefined }
                      : {}),
                  },
                })

                // Persist sleep edits back onto itinerary days
                if (kind === "Stay") {
                  syncSleepToItinerary(prevName, name, address)
                }
              }}
              onSaveNote={(note) =>
                updateTask({
                  ...selectedPlace,
                  attributes: { ...selectedPlace.attributes, notes: note },
                })
              }
              onRefreshPhotos={async () => {
                const urls = await fetchPlacePhotos({
                  name: selectedPlace.description,
                  address: String(selectedPlace.attributes?.address ?? ""),
                  cityLabel: city,
                  lat: parseCoord(selectedPlace.attributes?.lat) ?? undefined,
                  lng: parseCoord(selectedPlace.attributes?.lng) ?? undefined,
                  googlePlaceId: String(selectedPlace.attributes?.googlePlaceId ?? "") || undefined,
                })
                if (!urls.length) return
                updateTask({
                  ...selectedPlace,
                  attributes: { ...selectedPlace.attributes, photoUrls: urls },
                })
              }}
            />
          )}

          <div className="space-y-2">
            <div className="flex gap-2 items-start">
              <PlaceSuggestInput
                value={placeName}
                onChange={setPlaceName}
                onPick={(place) => addFromSuggestion(place, placeListsDraft)}
                cityLabel={city}
                cityLat={cityCenter?.lat}
                cityLng={cityCenter?.lng}
                placeholder="Search or type: Name - address…"
                disabled={busy}
                className="place-suggest-input"
              />
              <Button size="sm" onClick={onAddOne} disabled={busy || !placeName.trim()} title="Match to a known place">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10px] w-full"
              onClick={() => void onAddLiteral()}
              disabled={busy || !placeName.trim()}
              title="Keep exact name & address — do not replace with a Places match"
            >
              Add as typed (exact name &amp; address)
            </Button>
            <div className="rounded border border-dashed p-2 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center gap-1">
                <Landmark className="h-3 w-3" />
                Significant landmarks
              </p>
              <p className="text-[10px] text-muted-foreground">
                Home, work, and other anchors get their own pin colors and always show — no list needed.
                Type a name/address above, or use the defaults.
              </p>
              <div className="flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px]"
                  style={{ borderColor: FIXED_PIN_COLORS.home, color: FIXED_PIN_COLORS.home }}
                  disabled={busy}
                  onClick={() => void addSignificantLandmark("Home")}
                  title="Add Home pin (uses the field above if filled)"
                >
                  <Home className="h-3 w-3 mr-1" />
                  Home
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px]"
                  style={{ borderColor: FIXED_PIN_COLORS.work, color: FIXED_PIN_COLORS.work }}
                  disabled={busy}
                  onClick={() => void addSignificantLandmark("Work")}
                  title="Add Work pin (uses the field above if filled)"
                >
                  <Briefcase className="h-3 w-3 mr-1" />
                  Work
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px]"
                  style={{
                    borderColor: FIXED_PIN_COLORS.significant,
                    color: FIXED_PIN_COLORS.significant,
                  }}
                  disabled={busy}
                  onClick={() => void addSignificantLandmark("Significant")}
                  title="Add a named landmark / HQ / depot (type name first)"
                >
                  <Landmark className="h-3 w-3 mr-1" />
                  Landmark
                </Button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground -mt-1">
              Example: <code>Bruto - Calle Alcanfores 195-199, Miraflores 15074, Peru</code>
            </p>
            <div className="flex flex-wrap gap-1">
              {bucketsInUse.map((b) => {
                const on = placeListsDraft.some((x) => x.toLowerCase() === b.toLowerCase())
                return (
                  <button
                    key={`draft-${b}`}
                    type="button"
                    className={`trip-bucket-toggle ${on ? "is-on" : ""}`}
                    onClick={() => setPlaceListsDraft((prev) => togglePlaceList(prev, b))}
                    title="Assign new places to this list"
                  >
                    {on ? "✓ " : "+ "}
                    {b}
                  </button>
                )
              })}
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Paste several places</summary>
              <textarea
                className="mt-1 w-full min-h-[70px] border rounded p-2 text-sm bg-background"
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
                placeholder={"Bruto - Calle Alcanfores 195-199, Miraflores 15074, Peru\nDemo — Jirón Domeyer 282, Barranco, Lima, Peru"}
                disabled={busy}
              />
              <div className="flex flex-wrap gap-1 mt-1">
                <Button size="sm" onClick={onAddBulk} disabled={busy || !bulk.trim()}>
                  Match &amp; add
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void onAddBulkLiteral()}
                  disabled={busy || !bulk.trim()}
                  title="Keep each line’s name & address exactly"
                >
                  Add as typed
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                One per line: <code>Name - address</code>. “Add as typed” never rewrites your text.
              </p>
            </details>
            {err && <p className="text-xs text-destructive">{err}</p>}
            {busy && <p className="text-xs text-muted-foreground">Looking up places…</p>}
          </div>

          {significantPlaces.length > 0 && (
            <div>
              <h4
                className="text-xs font-semibold uppercase mb-1 flex items-center gap-1"
                style={{ color: FIXED_PIN_COLORS.significant }}
              >
                <Landmark className="h-3 w-3" /> Significant
              </h4>
              <ul className="space-y-1">
                {significantPlaces.map((p) => (
                  <PlaceRow
                    key={p.id}
                    place={p}
                    allLists={bucketsInUse}
                    listColors={listColors}
                    selected={selectedId === p.id || measurePick.includes(p.id)}
                    onSelect={() => onMapSelect(p.id)}
                    onRename={(name) => updateTask({ ...p, description: name, title: name })}
                    onToggleDone={() => updateTask({ ...p, completed: !p.completed })}
                    onDelete={() => deleteTask(p.id)}
                    onToggleList={(listName) => {
                      const next = togglePlaceList(getPlaceLists(p), listName)
                      updateTask({
                        ...p,
                        attributes: { ...p.attributes, bucket: encodePlaceLists(next) },
                      })
                    }}
                  />
                ))}
              </ul>
            </div>
          )}

          {(stayPlaces.length > 0 || staysForCity.length > 0) && (
            <div>
              <h4
                className="text-xs font-semibold uppercase mb-1 flex items-center gap-1"
                style={{ color: FIXED_PIN_COLORS.stay }}
              >
                <Bed className="h-3 w-3" /> Staying
              </h4>
              <ul className="space-y-1">
                {stayPlaces.map((p) => (
                  <PlaceRow
                    key={p.id}
                    place={p}
                    allLists={bucketsInUse}
                    listColors={listColors}
                    selected={selectedId === p.id || measurePick.includes(p.id)}
                    onSelect={() => onMapSelect(p.id)}
                    onRename={(name) => {
                      const prev = p.description
                      updateTask({ ...p, description: name, title: name })
                      syncSleepToItinerary(prev, name, String(p.attributes?.address ?? ""))
                    }}
                    onToggleDone={() => updateTask({ ...p, completed: !p.completed })}
                    onDelete={() => deleteTask(p.id)}
                    onToggleList={(listName) => {
                      const next = togglePlaceList(getPlaceLists(p), listName)
                      updateTask({
                        ...p,
                        attributes: { ...p.attributes, bucket: encodePlaceLists(next) },
                      })
                    }}
                  />
                ))}
                {stayPlaces.length === 0 &&
                  staysForCity.map((s) => (
                    <li key={s.id}>
                      <div className="w-full text-left text-sm px-2 py-1.5 rounded border opacity-80">
                        {s.description}
                        {s.attributes?.address && (
                          <span className="block text-[10px] text-muted-foreground">
                            {String(s.attributes.address)}
                          </span>
                        )}
                        <span className="block text-[10px] text-muted-foreground">Placing on map…</span>
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {airportPlaces.length > 0 && (
            <div>
              <h4
                className="text-xs font-semibold uppercase mb-1 flex items-center gap-1"
                style={{ color: FIXED_PIN_COLORS.airport }}
              >
                <Plane className="h-3 w-3" /> Airport
              </h4>
              <ul className="space-y-1">
                {airportPlaces.map((p) => (
                  <PlaceRow
                    key={p.id}
                    place={p}
                    allLists={bucketsInUse}
                    listColors={listColors}
                    selected={selectedId === p.id || measurePick.includes(p.id)}
                    onSelect={() => onMapSelect(p.id)}
                    onRename={(name) => updateTask({ ...p, description: name, title: name })}
                    onToggleDone={() => updateTask({ ...p, completed: !p.completed })}
                    onDelete={() => deleteTask(p.id)}
                    onToggleList={(listName) => {
                      const next = togglePlaceList(getPlaceLists(p), listName)
                      updateTask({
                        ...p,
                        attributes: { ...p.attributes, bucket: encodePlaceLists(next) },
                      })
                    }}
                  />
                ))}
              </ul>
            </div>
          )}

          {bucketsInUse
            .filter((b) => visibleBuckets[b])
            .map((bucket) => {
              const items = placesForCity.filter(
                (p) =>
                  placeInList(p, bucket) &&
                  !isAlwaysVisiblePlaceKind(String(p.attributes?.placeKind)),
              )
              if (items.length === 0) return null
              return (
                <div key={bucket}>
                  <h4
                    className="text-xs font-semibold uppercase mb-1 flex items-center gap-1.5"
                    style={{ color: colorForList(bucket, listColors) }}
                  >
                    <span
                      className="trip-list-swatch"
                      style={{ background: colorForList(bucket, listColors) }}
                    />
                    {bucket}
                  </h4>
                  <ul className="space-y-1">
                    {items.map((p) => (
                      <PlaceRow
                        key={`${bucket}-${p.id}`}
                        place={p}
                        allLists={bucketsInUse}
                        listColors={listColors}
                        selected={selectedId === p.id || measurePick.includes(p.id)}
                        onSelect={() => onMapSelect(p.id)}
                        onRename={(name) =>
                          updateTask({ ...p, description: name, title: name })
                        }
                        onToggleDone={() => updateTask({ ...p, completed: !p.completed })}
                        onDelete={() => deleteTask(p.id)}
                        onToggleList={(listName) => {
                          const next = togglePlaceList(getPlaceLists(p), listName)
                          updateTask({
                            ...p,
                            attributes: { ...p.attributes, bucket: encodePlaceLists(next) },
                          })
                        }}
                      />
                    ))}
                  </ul>
                </div>
              )
            })}
        </aside>
      </div>
    </div>
  )
}

function readPhotoUrls(place: Task): string[] {
  const raw = place.attributes?.photoUrls
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean)
  if (typeof raw === "string" && raw.trim()) return [raw.trim()]
  return []
}

function PlacePhotoPanel({
  place,
  onSaveDetails,
  onSaveNote,
  onRefreshPhotos,
}: {
  place: Task
  onSaveDetails: (name: string, address: string) => void | Promise<void>
  onSaveNote: (note: string) => void
  onRefreshPhotos: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [savingDetails, setSavingDetails] = useState(false)
  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState(place.description)
  const [addressDraft, setAddressDraft] = useState(String(place.attributes?.address ?? ""))
  const [noteDraft, setNoteDraft] = useState(String(place.attributes?.notes ?? ""))
  const [noteDirty, setNoteDirty] = useState(false)
  const photos = readPhotoUrls(place)
  const mapsQuery = encodeURIComponent(
    [nameDraft.trim() || place.description, addressDraft.trim() || String(place.attributes?.address ?? "")]
      .filter(Boolean)
      .join(" "),
  )
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`

  useEffect(() => {
    if (!editing) {
      setNameDraft(place.description)
      setAddressDraft(String(place.attributes?.address ?? ""))
    }
  }, [place.description, place.attributes?.address, place.id, editing])

  useEffect(() => {
    setNoteDraft(String(place.attributes?.notes ?? ""))
    setNoteDirty(false)
  }, [place.id, place.attributes?.notes])

  const saveDetails = async () => {
    const nextName = nameDraft.trim()
    if (!nextName) {
      setNameDraft(place.description)
      setAddressDraft(String(place.attributes?.address ?? ""))
      setEditing(false)
      return
    }
    const nextAddress = addressDraft.trim()
    const prevAddress = String(place.attributes?.address ?? "")
    if (nextName !== place.description || nextAddress !== prevAddress) {
      setSavingDetails(true)
      try {
        await onSaveDetails(nextName, nextAddress)
      } finally {
        setSavingDetails(false)
      }
    }
    setEditing(false)
  }

  const saveNote = () => {
    onSaveNote(noteDraft.trim())
    setNoteDirty(false)
  }

  return (
    <div className="trip-photo-panel">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[10px] font-semibold uppercase text-muted-foreground">Selected place</span>
        <div className="flex items-center gap-2 shrink-0">
          {!editing ? (
            <button
              type="button"
              className="trip-maps-link"
              onClick={() => setEditing(true)}
              title="Edit name & address"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          ) : (
            <button
              type="button"
              className="trip-maps-link"
              onClick={() => void saveDetails()}
              disabled={savingDetails}
              title="Save and update map pin"
            >
              <Check className="h-3.5 w-3.5" />
              {savingDetails ? "Updating map…" : "Save"}
            </button>
          )}
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="trip-maps-link">
            <ExternalLink className="h-3 w-3" />
            Maps
          </a>
        </div>
      </div>

      {editing ? (
        <div className="trip-place-edit-fields">
          <label className="trip-place-field-label" htmlFor={`place-name-${place.id}`}>
            Name
          </label>
          <Input
            id={`place-name-${place.id}`}
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                void saveDetails()
              }
              if (e.key === "Escape") {
                setNameDraft(place.description)
                setAddressDraft(String(place.attributes?.address ?? ""))
                setEditing(false)
              }
            }}
            className="h-7 text-xs mb-1.5"
            autoFocus
            placeholder="Place name"
            disabled={savingDetails}
          />
          <label className="trip-place-field-label" htmlFor={`place-addr-${place.id}`}>
            Address
          </label>
          <Input
            id={`place-addr-${place.id}`}
            value={addressDraft}
            onChange={(e) => setAddressDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                void saveDetails()
              }
              if (e.key === "Escape") {
                setNameDraft(place.description)
                setAddressDraft(String(place.attributes?.address ?? ""))
                setEditing(false)
              }
            }}
            className="h-7 text-xs mb-1.5"
            placeholder="Street, city, country"
            disabled={savingDetails}
          />
          {savingDetails && (
            <p className="text-[10px] text-muted-foreground mb-1">Moving pin to the new address…</p>
          )}
        </div>
      ) : (
        <>
          <button
            type="button"
            className="text-xs font-semibold text-left hover:underline w-full truncate mb-0.5"
            onClick={() => setEditing(true)}
            title="Edit name"
          >
            {place.description}
          </button>
          <button
            type="button"
            className="text-[10px] text-muted-foreground text-left hover:underline w-full truncate mb-1.5"
            onClick={() => setEditing(true)}
            title="Edit address"
          >
            {String(place.attributes?.address ?? "").trim() || "Add address…"}
          </button>
        </>
      )}

      {photos.length > 0 ? (
        <div className="trip-photo-strip">
          {photos.map((src) => (
            <a key={src} href={src} target="_blank" rel="noreferrer" className="trip-photo-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" />
            </a>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground mb-1">
          No photos yet — load from Google/Wikimedia, or open Maps.
        </p>
      )}
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-[10px] mt-1"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await onRefreshPhotos()
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? "Loading photos…" : photos.length ? "Refresh photos" : "Load photos"}
      </Button>

      <div className="trip-pin-note mt-2">
        <label className="text-[10px] font-semibold uppercase text-muted-foreground" htmlFor={`pin-note-${place.id}`}>
          Note
        </label>
        <textarea
          id={`pin-note-${place.id}`}
          className="trip-pin-note-input"
          rows={3}
          value={noteDraft}
          placeholder="Hours, tips, reservation #, what to order…"
          onChange={(e) => {
            setNoteDraft(e.target.value)
            setNoteDirty(true)
          }}
          onBlur={() => {
            if (noteDirty) saveNote()
          }}
        />
        {noteDirty && (
          <Button size="sm" variant="outline" className="h-7 text-[10px] mt-1" onClick={saveNote}>
            Save note
          </Button>
        )}
      </div>
    </div>
  )
}

function PlaceRow({
  place,
  allLists,
  listColors,
  selected,
  onSelect,
  onRename,
  onToggleDone,
  onDelete,
  onToggleList,
}: {
  place: Task
  allLists: string[]
  listColors?: Record<string, string>
  selected: boolean
  onSelect: () => void
  onRename: (name: string) => void
  onToggleDone: () => void
  onDelete: () => void
  onToggleList: (listName: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(place.description)
  const kind = String(place.attributes?.placeKind ?? "Place")
  const Icon =
    kind === "Airport"
      ? Plane
      : kind === "Stay"
        ? Bed
        : kind === "Home"
          ? Home
          : kind === "Work"
            ? Briefcase
            : isSignificantPlaceKind(kind)
              ? Landmark
              : MapPin
  const hasCoords = parseCoord(place.attributes?.lat) != null
  const lists = getPlaceLists(place)
  const pinColor = colorForPlaceKind(kind, lists, listColors)
  const thumb = readPhotoUrls(place)[0]
  const showListChips = !isAlwaysVisiblePlaceKind(kind)

  useEffect(() => {
    if (!editing) setDraft(place.description)
  }, [place.description, place.id, editing])

  const save = () => {
    const next = draft.trim()
    if (!next) {
      setDraft(place.description)
      setEditing(false)
      return
    }
    if (next !== place.description) onRename(next)
    setEditing(false)
  }

  return (
    <li>
      <div
        className={`rounded border text-sm ${selected ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
      >
        <div className="flex items-start gap-2 px-2 py-1.5">
          <button type="button" onClick={onSelect} className="mt-0.5 shrink-0" title="Focus on map">
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt="" className="trip-row-thumb" />
            ) : (
              <Icon className="h-3.5 w-3.5" style={{ color: pinColor }} />
            )}
          </button>
          {editing ? (
            <div className="flex-1 min-w-0 flex items-center gap-1">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    save()
                  }
                  if (e.key === "Escape") {
                    setDraft(place.description)
                    setEditing(false)
                  }
                }}
                onBlur={save}
                className="h-7 text-xs"
                autoFocus
                aria-label="Activity name"
              />
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground shrink-0"
                title="Save"
                onMouseDown={(e) => e.preventDefault()}
                onClick={save}
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="flex-1 text-left min-w-0"
              onClick={onSelect}
              onDoubleClick={(e) => {
                e.preventDefault()
                setEditing(true)
              }}
              title="Select on map · double-click to rename"
            >
              <span className={place.completed ? "line-through text-muted-foreground" : ""}>
                {place.description}
              </span>
              {place.attributes?.address && (
                <span className="block text-[10px] text-muted-foreground truncate">
                  {String(place.attributes.address)}
                </span>
              )}
              {!!place.attributes?.notes && (
                <span className="block text-[10px] text-muted-foreground truncate italic">
                  {String(place.attributes.notes)}
                </span>
              )}
              {!hasCoords && (
                <Badge variant="outline" className="ml-1 text-[9px]">
                  no pin
                </Badge>
              )}
            </button>
          )}
          <div className="flex flex-col items-end gap-1 shrink-0">
            {!editing && (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                title="Rename"
                onClick={(e) => {
                  e.stopPropagation()
                  setEditing(true)
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              className="text-muted-foreground hover:text-destructive"
              title="Remove from map"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <input
              type="checkbox"
              checked={!!place.completed}
              onChange={onToggleDone}
              onClick={(e) => e.stopPropagation()}
              className="mt-0.5"
            />
          </div>
        </div>
        {showListChips && (
          <div className="flex flex-wrap gap-0.5 px-2 pb-1.5">
            {allLists.map((b) => {
              const on = lists.some((x) => x.toLowerCase() === b.toLowerCase())
              const color = colorForList(b, listColors)
              return (
                <button
                  key={b}
                  type="button"
                  className={`trip-list-chip ${on ? "is-on" : ""}`}
                  style={on ? { borderColor: color, background: `${color}22` } : undefined}
                  title={on ? `Remove from ${b}` : `Add to ${b}`}
                  onClick={() => onToggleList(b)}
                >
                  {b}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </li>
  )
}
