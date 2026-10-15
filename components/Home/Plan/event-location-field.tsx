/**
 * components/Home/Plan/event-location-field.tsx — Event location search
 *
 * Type like a maps search box: places this app already knows (trip / itinerary
 * places with a pin, earlier pinned events) come first, then map results from
 * `lib/places-search.ts` (Photon, or Google when a key is set) biased to the
 * Settings home city. Picking a row stores the name plus address and pin on the
 * event; typing over it drops the pin and keeps free text.
 */
"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import type { CalendarEvent } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { useEventStore } from "@/lib/event-store"
import { useUserSettingsStore } from "@/lib/user-settings-store"
import { itemTitle } from "@/lib/item-utils"
import { searchPlaces } from "@/lib/places-search"

export interface EventPlace {
  location: string
  locationAddress?: string
  locationLat?: number
  locationLng?: number
}

interface PlaceRow {
  key: string
  name: string
  address: string
  lat: number
  lng: number
  source: "saved" | "map"
}

const SAVED_LIMIT = 5
const MAP_LIMIT = 7

function coord(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim()) {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** Places already in the app: items carrying lat/lng attributes, and pinned events. */
function useSavedPlaces(): PlaceRow[] {
  const tasks = useTaskStore((s) => s.tasks)
  const events = useEventStore((s) => s.events)
  return useMemo(() => {
    const rows: PlaceRow[] = []
    const seen = new Set<string>()
    const push = (row: PlaceRow) => {
      const k = `${row.name.toLowerCase()}|${row.lat.toFixed(4)},${row.lng.toFixed(4)}`
      if (seen.has(k)) return
      seen.add(k)
      rows.push(row)
    }
    for (const t of tasks) {
      const attrs = t.attributes as Record<string, unknown> | undefined
      if (!attrs) continue
      const lat = coord(attrs.lat)
      const lng = coord(attrs.lng)
      if (lat === null || lng === null) continue
      const name = itemTitle(t)
      if (!name) continue
      const address = [attrs.address, attrs.city].map((v) => String(v ?? "").trim()).filter(Boolean)[0] ?? ""
      push({ key: `item-${t.id}`, name, address, lat, lng, source: "saved" })
    }
    for (const e of events as CalendarEvent[]) {
      if (typeof e.locationLat !== "number" || typeof e.locationLng !== "number" || !e.location) continue
      push({
        key: `event-${e.id}`,
        name: e.location,
        address: e.locationAddress ?? "",
        lat: e.locationLat,
        lng: e.locationLng,
        source: "saved",
      })
    }
    return rows
  }, [tasks, events])
}

export function EventLocationField({
  id,
  value,
  onChange,
}: {
  id: string
  value: EventPlace
  onChange: (next: EventPlace) => void
}) {
  const listId = useId()
  const homeCity = useUserSettingsStore((s) => s.homeCity)
  const saved = useSavedPlaces()
  const [open, setOpen] = useState(false)
  const [mapHits, setMapHits] = useState<PlaceRow[]>([])
  const [loading, setLoading] = useState(false)
  const [highlight, setHighlight] = useState(0)
  /** Only search after the person types, never on open of an existing event. */
  const [typed, setTyped] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const query = value.location.trim()
  const needle = query.toLowerCase()

  const savedHits = useMemo(() => {
    if (!typed || needle.length < 2) return []
    return saved
      .filter((p) => p.name.toLowerCase().includes(needle) || p.address.toLowerCase().includes(needle))
      .slice(0, SAVED_LIMIT)
  }, [saved, needle, typed])

  useEffect(() => {
    if (!typed || query.length < 2) {
      setMapHits([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(() => {
      void searchPlaces(query, { cityLabel: homeCity, limit: MAP_LIMIT })
        .then((hits) => {
          if (cancelled) return
          setMapHits(
            hits.map((h) => ({
              key: `map-${h.id}`,
              name: h.name,
              address: h.address,
              lat: h.lat,
              lng: h.lng,
              source: "map" as const,
            })),
          )
        })
        .catch(() => {
          if (!cancelled) setMapHits([])
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 280)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, typed, homeCity])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [])

  const rows = useMemo(() => [...savedHits, ...mapHits], [savedHits, mapHits])

  useEffect(() => {
    setHighlight(0)
  }, [rows.length])

  const pick = (row: PlaceRow) => {
    onChange({ location: row.name, locationAddress: row.address || undefined, locationLat: row.lat, locationLng: row.lng })
    setOpen(false)
    setTyped(false)
  }

  const pinned = typeof value.locationLat === "number" && typeof value.locationLng === "number"
  const showList = open && typed && query.length >= 2 && (rows.length > 0 || loading)

  const renderRow = (row: PlaceRow, index: number) => (
    <li key={row.key} role="presentation">
      <button
        type="button"
        role="option"
        data-plan-pick=""
        data-no95=""
        className="plan-place-row"
        aria-selected={index === highlight}
        data-active={index === highlight ? "true" : undefined}
        onMouseDown={(e) => {
          e.preventDefault()
          pick(row)
        }}
        onMouseEnter={() => setHighlight(index)}
      >
        <span className="plan-place-pin" aria-hidden data-source={row.source} />
        <span className="plan-place-text">
          <span className="plan-place-name">{row.name}</span>
          {row.address ? <span className="plan-place-addr">{row.address}</span> : null}
        </span>
      </button>
    </li>
  )

  return (
    <div className="plan-place" ref={wrapRef}>
      <input
        id={id}
        value={value.location}
        placeholder="Search a place or address…"
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => {
          // Typing over a picked place keeps the words but drops its pin.
          onChange({ location: e.target.value, locationAddress: undefined, locationLat: undefined, locationLng: undefined })
          setTyped(true)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!showList || rows.length === 0) return
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setHighlight((h) => Math.min(h + 1, rows.length - 1))
          } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setHighlight((h) => Math.max(h - 1, 0))
          } else if (e.key === "Enter") {
            e.preventDefault()
            const row = rows[highlight]
            if (row) pick(row)
          } else if (e.key === "Escape") {
            e.stopPropagation()
            setOpen(false)
          }
        }}
      />
      {showList ? (
        <ul id={listId} className="plan-place-list" role="listbox" aria-label="Place results">
          {savedHits.length > 0 ? (
            <li role="presentation" className="plan-place-group">
              Saved places
            </li>
          ) : null}
          {savedHits.map((row, i) => renderRow(row, i))}
          {mapHits.length > 0 || loading ? (
            <li role="presentation" className="plan-place-group">
              Map{loading ? " — searching…" : ""}
            </li>
          ) : null}
          {mapHits.map((row, i) => renderRow(row, savedHits.length + i))}
        </ul>
      ) : null}
      {pinned ? (
        <div className="plan-place-pinned" data-testid="event-location-pinned">
          <span className="plan-place-pin" aria-hidden data-source="map" />
          <span className="plan-place-pinned-text">
            {value.locationAddress || value.location}
            <span className="plan-place-coords">
              {" "}
              {value.locationLat!.toFixed(5)}, {value.locationLng!.toFixed(5)}
            </span>
          </span>
          <a
            className="plan-place-open"
            href={`https://www.google.com/maps/search/?api=1&query=${value.locationLat},${value.locationLng}`}
            target="_blank"
            rel="noreferrer"
          >
            Map
          </a>
        </div>
      ) : null}
    </div>
  )
}
