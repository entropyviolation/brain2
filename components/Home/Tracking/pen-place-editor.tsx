/**
 * components/Home/Tracking/pen-place-editor.tsx — Address, zip, and coordinates on a Location pen
 *
 * Pen settings → Place, on Location pens only. Three ways to say where a pen
 * is, none of them "counts as" (`lib/pen-place.ts`):
 *
 * - **Address**: search as you type (Photon; Google Places first when the
 *   itinerary key is set — `lib/geo-address.ts`). Picking one pins the pen
 *   there and files it under its Neighborhood › City › State › Country pens,
 *   creating any that are missing (`fileUnderAddress`). File again re-runs it.
 * - **Zip code**: looked up once to its center; a fix within a few km matches
 *   when nothing finer does. With no address, its city / state / country file
 *   the pen too.
 * - **Coordinates**: attach any number — typed "lat, lng", this device's
 *   location, or a GPS place BIM has seen — each with a label and radius.
 *
 * Writes straight to the store (`setPenPlace`), like the level picker.
 */
"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { geocodeZip, searchAddresses, withParts, type AddressSuggestion } from "@/lib/geo-address"
import { fileUnderAddress, setPenPlace } from "@/lib/pen-place-actions"
import {
  PIN_RADIUS_M,
  formatCoord,
  haversineMeters,
  makeCoordId,
  parseCoordPair,
  partsLine,
  type PenCoord,
  type PenPlace,
} from "@/lib/pen-place"
import { getGpsPlacesServerSnapshot, getGpsPlacesSnapshot, subscribeGpsPlaces } from "@/lib/ingest/gps-places"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"

export function PenPlaceEditor({ scopeId, penId }: { scopeId: string; penId: string }) {
  const pen = useTimeTrackingStore((s) => s.scopes.find((sc) => sc.id === scopeId)?.pens.find((p) => p.id === penId))
  const place: PenPlace = pen?.place ?? {}
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<AddressSuggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [status, setStatus] = useState("")
  const [zip, setZip] = useState(place.zip ?? "")
  const [pair, setPair] = useState("")
  const [pairLabel, setPairLabel] = useState("")
  const gpsSnapshot = useSyncExternalStore(subscribeGpsPlaces, getGpsPlacesSnapshot, getGpsPlacesServerSnapshot)

  useEffect(() => setZip(pen?.place?.zip ?? ""), [pen?.id, pen?.place?.zip])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 3) {
      setResults([])
      return
    }
    let cancelled = false
    setSearching(true)
    const near = place.lat !== undefined && place.lng !== undefined ? { lat: place.lat, lng: place.lng } : null
    const timer = window.setTimeout(() => {
      void searchAddresses(q, near).then((rows) => {
        if (cancelled) return
        setResults(rows)
        setSearching(false)
      })
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const gpsPlaces = gpsSnapshot

  if (!pen) return null
  const write = (next: PenPlace) => setPenPlace(scopeId, penId, next)

  const pick = async (suggestion: AddressSuggestion) => {
    setResults([])
    setQuery("")
    setStatus("Looking up the neighborhood, city, state…")
    const full = await withParts(suggestion)
    write({ ...place, address: full.label, lat: full.lat, lng: full.lng, parts: full.parts, zip: place.zip ?? full.parts.postcode })
    const filed = fileUnderAddress(scopeId, penId, full.parts)
    setStatus(filed.length ? `Filed under ${filed.join(" › ")}.` : "Pinned. No level pens to file under — add Neighborhood, City… in Tracking settings.")
  }

  const refile = () => {
    if (!place.parts) return
    const filed = fileUnderAddress(scopeId, penId, place.parts)
    setStatus(filed.length ? `Filed under ${filed.join(" › ")}.` : "Nothing to file under.")
  }

  const saveZip = async () => {
    const z = zip.trim()
    if (!z) {
      write({ ...place, zip: undefined, zipLat: undefined, zipLng: undefined })
      setStatus("")
      return
    }
    setStatus("Looking up the zip…")
    const found = await geocodeZip(z)
    if (!found) {
      write({ ...place, zip: z, zipLat: undefined, zipLng: undefined })
      setStatus("Saved the zip. Its area could not be found, so GPS will not match it yet.")
      return
    }
    const parts = place.parts ?? found.parts
    write({ ...place, zip: z, zipLat: found.lat, zipLng: found.lng, parts })
    const filed = place.address ? [] : fileUnderAddress(scopeId, penId, { ...found.parts, neighborhood: undefined })
    setStatus(`Zip ${z}: ${partsLine(found.parts) || found.label}.${filed.length ? ` Filed under ${filed.join(" › ")}.` : ""}`)
  }

  const addCoord = (coord: Omit<PenCoord, "id">) => {
    write({ ...place, coords: [...(place.coords ?? []), { id: makeCoordId(), ...coord }] })
    setPair("")
    setPairLabel("")
  }

  const updateCoord = (id: string, patch: Partial<PenCoord>) =>
    write({ ...place, coords: (place.coords ?? []).map((c) => (c.id === id ? { ...c, ...patch } : c)) })

  const parsed = parseCoordPair(pair)

  const useHere = () => {
    if (!("geolocation" in navigator)) {
      setStatus("This device does not share its location.")
      return
    }
    setStatus("Asking this device where it is…")
    navigator.geolocation.getCurrentPosition(
      (position) => {
        addCoord({ lat: position.coords.latitude, lng: position.coords.longitude, label: pairLabel.trim() || "This device" })
        setStatus("Attached this device’s location.")
      },
      () => setStatus("Location permission was not given."),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const anchor = place.lat !== undefined && place.lng !== undefined ? { lat: place.lat, lng: place.lng } : null

  return (
    <div className="trk-place" data-testid="pen-place-editor">
      <div className="trk-place-block">
        <span className="trk-place-label">Address</span>
        {place.address ? (
          <div className="trk-place-pinned">
            <span className="trk-place-pin" aria-hidden>
              ●
            </span>
            <div className="trk-place-pinned-copy">
              <span className="trk-place-address">{place.address}</span>
              {place.parts ? <span className="trk-place-parts">{partsLine(place.parts)}</span> : null}
              {anchor ? <span className="trk-place-coord">{formatCoord(anchor.lat, anchor.lng)}</span> : null}
            </div>
            <div className="trk-place-actions">
              {place.parts ? (
                <button type="button" data-no95="" onClick={refile}>
                  File again
                </button>
              ) : null}
              <button
                type="button"
                data-no95=""
                aria-label="Clear address"
                onClick={() => write({ ...place, address: undefined, lat: undefined, lng: undefined, parts: undefined })}
              >
                Clear
              </button>
            </div>
          </div>
        ) : null}
        <div className="trk-place-search">
          <input
            type="search"
            aria-label="Search for an address"
            placeholder={place.address ? "Change the address…" : "Search an address or place…"}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {searching && query.trim().length >= 3 ? <span className="trk-place-hint">Searching…</span> : null}
          {results.length ? (
            <ul className="trk-place-results" role="listbox" aria-label="Address suggestions">
              {results.map((row) => (
                <li key={row.id}>
                  <button type="button" data-no95="" role="option" aria-selected={false} onClick={() => void pick(row)}>
                    <span className="trk-place-result-name">{row.name}</span>
                    <span className="trk-place-result-line">{row.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="trk-place-block">
        <label className="trk-place-label" htmlFor={`pen-zip-${penId}`}>
          Zip code
        </label>
        <div className="trk-place-row">
          <input
            id={`pen-zip-${penId}`}
            inputMode="numeric"
            placeholder="92107"
            value={zip}
            onChange={(event) => setZip(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                void saveZip()
              }
            }}
          />
          <button type="button" data-no95="" onClick={() => void saveZip()} disabled={zip.trim() === (place.zip ?? "")}>
            {zip.trim() ? "Save zip" : "Clear zip"}
          </button>
          {place.zip && place.zipLat !== undefined ? <span className="trk-place-hint">matches GPS within ~3.5 km</span> : null}
        </div>
      </div>

      <div className="trk-place-block">
        <span className="trk-place-label">Coordinates · also this place</span>
        {(place.coords ?? []).length === 0 ? (
          <p className="trk-place-hint">None attached. A GPS fix inside one of these is {pen.name}, not counts-as.</p>
        ) : (
          <ul className="trk-place-coords">
            {(place.coords ?? []).map((coord) => (
              <li key={coord.id}>
                <input
                  aria-label={`Label for ${formatCoord(coord.lat, coord.lng)}`}
                  placeholder="label"
                  value={coord.label ?? ""}
                  onChange={(event) => updateCoord(coord.id, { label: event.target.value || undefined })}
                />
                <code>{formatCoord(coord.lat, coord.lng)}</code>
                <label className="trk-place-radius">
                  <input
                    type="number"
                    min={20}
                    max={5000}
                    step={10}
                    aria-label={`Radius for ${formatCoord(coord.lat, coord.lng)}`}
                    value={coord.radiusM ?? PIN_RADIUS_M}
                    onChange={(event) => updateCoord(coord.id, { radiusM: Math.max(20, Number.parseInt(event.target.value, 10) || PIN_RADIUS_M) })}
                  />
                  m
                </label>
                <button
                  type="button"
                  data-no95=""
                  aria-label={`Remove ${formatCoord(coord.lat, coord.lng)}`}
                  onClick={() => write({ ...place, coords: (place.coords ?? []).filter((c) => c.id !== coord.id) })}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="trk-place-row">
          <input aria-label="Coordinate pair" placeholder="32.7495, -117.2470" value={pair} onChange={(event) => setPair(event.target.value)} />
          <input aria-label="Coordinate label" placeholder="label (optional)" value={pairLabel} onChange={(event) => setPairLabel(event.target.value)} />
          <button type="button" data-no95="" disabled={!parsed} onClick={() => parsed && addCoord({ ...parsed, label: pairLabel.trim() || undefined })}>
            Attach
          </button>
          <button type="button" data-no95="" onClick={useHere}>
            This device
          </button>
        </div>
        {gpsPlaces.length ? (
          <div className="trk-place-gps" role="group" aria-label="GPS places BIM has seen">
            <span className="trk-place-hint">From GPS:</span>
            {gpsPlaces.slice(0, 8).map((gps) => {
              const attached = (place.coords ?? []).some((c) => haversineMeters(c, { lat: gps.lat, lng: gps.lon }) < 30)
              return (
                <button
                  key={`${gps.lat},${gps.lon}`}
                  type="button"
                  data-no95=""
                  disabled={attached}
                  title={`${formatCoord(gps.lat, gps.lon)} · ${gps.count} pins`}
                  onClick={() => addCoord({ lat: gps.lat, lng: gps.lon, label: gps.name || undefined })}
                >
                  {gps.name || formatCoord(gps.lat, gps.lon)} · {gps.count}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
      {status ? (
        <p className="trk-place-status" role="status">
          {status}
        </p>
      ) : null}
    </div>
  )
}
