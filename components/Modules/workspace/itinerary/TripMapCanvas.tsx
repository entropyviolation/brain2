"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup, Polygon, Polyline, useMap } from "react-leaflet"
import L from "leaflet"

export interface MapPinData {
  id: string
  lat: number
  lng: number
  label: string
  kind: "stay" | "airport" | "landmark" | "place"
  bucket?: string
  address?: string
  /** Optional pin note (editable in popup) */
  notes?: string
  /** Hex color for list-coded pins */
  color?: string
}

export interface CityBoundsData {
  bounds: [[number, number], [number, number]]
  polygon?: [number, number][]
}

// Fix default marker icons under bundlers
const iconRetina = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png"
const iconUrl = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png"
const shadowUrl = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png"

const KIND_COLORS: Record<MapPinData["kind"], string> = {
  stay: "#0ea5e9",
  airport: "#6366f1",
  landmark: "#f59e0b",
  place: "#ec4899",
}

function makeIcon(color: string) {
  return L.divIcon({
    className: "trip-pin",
    html: `<span class="trip-pin-dot" style="background:${color}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  })
}

const iconCache = new Map<string, L.DivIcon>()
function iconFor(color: string) {
  const key = color.toLowerCase()
  let icon = iconCache.get(key)
  if (!icon) {
    icon = makeIcon(color)
    iconCache.set(key, icon)
  }
  return icon
}

L.Icon.Default.mergeOptions({ iconRetinaUrl: iconRetina, iconUrl, shadowUrl })

function FitView({
  pins,
  selectedId,
  cityBounds,
  routeLine,
}: {
  pins: MapPinData[]
  selectedId: string | null
  cityBounds: CityBoundsData | null
  routeLine: [number, number][] | null
}) {
  const map = useMap()
  const boundsKey = cityBounds
    ? `${cityBounds.bounds[0][0]},${cityBounds.bounds[0][1]},${cityBounds.bounds[1][0]},${cityBounds.bounds[1][1]}`
    : ""

  // Frame the city when city changes
  useEffect(() => {
    if (!cityBounds) return
    map.fitBounds(cityBounds.bounds, { padding: [28, 28], maxZoom: 13 })
  }, [boundsKey, map]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fly to selection / route without fighting city frame
  useEffect(() => {
    if (selectedId) {
      const p = pins.find((x) => x.id === selectedId)
      if (p) {
        map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 15), { duration: 0.55 })
        return
      }
    }
    if (routeLine && routeLine.length >= 2) {
      map.fitBounds(L.latLngBounds(routeLine), { padding: [40, 40], maxZoom: 15 })
    }
  }, [selectedId, routeLine, pins, map])

  useEffect(() => {
    if (cityBounds || pins.length === 0) return
    const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number]))
    map.fitBounds(bounds.pad(0.2), { maxZoom: 13 })
  }, [cityBounds, pins.length, map]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

function PinPopupBody({
  pin,
  color,
  measuring,
  onSaveNote,
}: {
  pin: MapPinData
  color: string
  measuring: boolean
  onSaveNote?: (id: string, note: string) => void
}) {
  const [noteDraft, setNoteDraft] = useState(pin.notes || "")
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setNoteDraft(pin.notes || "")
    setDirty(false)
  }, [pin.id, pin.notes])

  const save = () => {
    if (!onSaveNote || !dirty) return
    onSaveNote(pin.id, noteDraft.trim())
    setDirty(false)
  }

  return (
    <div className="trip-map-popup" onClick={(e) => e.stopPropagation()}>
      <strong className="trip-map-popup-title">{pin.label}</strong>
      {pin.bucket && (
        <div className="trip-map-popup-bucket" style={{ color }}>
          {pin.bucket}
        </div>
      )}
      {pin.address && <div className="trip-map-popup-addr">{pin.address}</div>}
      {onSaveNote && !pin.id.startsWith("stay-") && (
        <div className="trip-map-popup-note">
          <label htmlFor={`map-note-${pin.id}`}>Note</label>
          <textarea
            id={`map-note-${pin.id}`}
            rows={3}
            value={noteDraft}
            placeholder="Add a note…"
            onChange={(e) => {
              setNoteDraft(e.target.value)
              setDirty(true)
            }}
            onBlur={save}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                save()
              }
            }}
          />
          {dirty && (
            <button
              type="button"
              className="trip-map-popup-save"
              onMouseDown={(e) => e.preventDefault()}
              onClick={save}
            >
              Save note
            </button>
          )}
        </div>
      )}
      {measuring && <div className="trip-map-popup-measure">Measuring</div>}
    </div>
  )
}

function SelectableMarker({
  pin,
  color,
  selected,
  measuring,
  faded,
  onSelect,
  onSaveNote,
}: {
  pin: MapPinData
  color: string
  selected: boolean
  measuring: boolean
  faded: boolean
  onSelect: (id: string) => void
  onSaveNote?: (id: string, note: string) => void
}) {
  const markerRef = useRef<L.Marker | null>(null)

  useEffect(() => {
    if (selected) markerRef.current?.openPopup()
  }, [selected])

  return (
    <Marker
      ref={markerRef}
      position={[pin.lat, pin.lng]}
      icon={iconFor(color)}
      opacity={faded ? 0.45 : 1}
      eventHandlers={{
        click: (e) => {
          L.DomEvent.stopPropagation(e.originalEvent)
          onSelect(pin.id)
        },
      }}
    >
      <Popup minWidth={220} maxWidth={280} autoPan>
        <PinPopupBody pin={pin} color={color} measuring={measuring} onSaveNote={onSaveNote} />
      </Popup>
    </Marker>
  )
}

export function TripMapCanvas({
  pins,
  selectedId,
  onSelect,
  onSaveNote,
  cityBounds,
  measureIds,
  routeLine,
}: {
  pins: MapPinData[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** Persist a note from the pin popup (place pins only). */
  onSaveNote?: (id: string, note: string) => void
  cityBounds?: CityBoundsData | null
  /** Highlight pins selected for distance measure */
  measureIds?: string[]
  routeLine?: [number, number][] | null
}) {
  const center = useMemo<[number, number]>(() => {
    if (cityBounds) {
      const [[s, w], [n, e]] = cityBounds.bounds
      return [(s + n) / 2, (w + e) / 2]
    }
    if (pins[0]) return [pins[0].lat, pins[0].lng]
    return [38.72, -9.14]
  }, [pins, cityBounds])

  const measureSet = new Set(measureIds || [])
  const measuringActive = measureSet.size > 0

  return (
    <MapContainer center={center} zoom={12} className="trip-leaflet-map" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitView
        pins={pins}
        selectedId={selectedId}
        cityBounds={cityBounds || null}
        routeLine={routeLine || null}
      />
      {cityBounds?.polygon && cityBounds.polygon.length >= 3 && (
        <Polygon
          positions={cityBounds.polygon}
          pathOptions={{
            color: "#2f5d8c",
            weight: 2,
            opacity: 0.75,
            fillColor: "#2f5d8c",
            fillOpacity: 0.06,
            dashArray: "6 4",
          }}
        />
      )}
      {routeLine && routeLine.length >= 2 && (
        <Polyline
          positions={routeLine}
          pathOptions={{ color: "#c2410c", weight: 3, opacity: 0.85, dashArray: "8 6" }}
        />
      )}
      {pins.map((p) => {
        const color = p.color || KIND_COLORS[p.kind] || KIND_COLORS.place
        const measuring = measureSet.has(p.id)
        return (
          <SelectableMarker
            key={p.id}
            pin={p}
            color={color}
            selected={selectedId === p.id}
            measuring={measuring}
            faded={measuringActive && !measuring}
            onSelect={onSelect}
            onSaveNote={onSaveNote}
          />
        )
      })}
    </MapContainer>
  )
}
