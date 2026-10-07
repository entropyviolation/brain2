/**
 * components/Home/star-identify.tsx — Session “Stars near” for the Moon chart
 *
 * Off until the readout is switched on. The choice lives in this module
 * while the detail is mounted. It is not written to `brain2-sky-motion`.
 * Names on the glass show only while the zoom still frames the star field
 * (system and wider). A closer factor hides those labels; the list stays.
 */
"use client"

import { useEffect, useSyncExternalStore } from "react"
import { nearestNamedStars } from "@/components/Home/naked-eye-stars"
import { zoomFactor } from "@/lib/sky-zoom"

let starsNear = false
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function setStarsNear(next: boolean): void {
  if (starsNear === next) return
  starsNear = next
  emit()
}

function useStarsNear(): boolean {
  return useSyncExternalStore(subscribe, () => starsNear, () => false)
}

/** System framing and wider. Closer than that, a globe fills the glass. */
export function starFieldVisible(factor: number): boolean {
  return Number.isFinite(factor) && factor <= zoomFactor("system") * 1.001
}

export function StarIdentifyPanel({
  planetName,
  longitude,
}: {
  planetName: string
  longitude: number
}) {
  const on = useStarsNear()
  useEffect(() => () => setStarsNear(false), [])
  const near = on ? nearestNamedStars(longitude) : []
  return (
    <div className="home-sky-near">
      <label className="home-sky-near-toggle">
        <input
          type="checkbox"
          checked={on}
          onChange={(event) => setStarsNear(event.target.checked)}
        />
        Stars near
      </label>
      {on ? (
        <>
          <p className="home-sky-near-title">
            Directions on the sky from the Sun’s neighborhood, not stars orbiting {planetName}.
          </p>
          <ol className="home-sky-near-list" aria-label="Stars near this longitude">
            {near.map((star) => (
              <li key={star.hip}>
                <span className="home-sky-near-name">{star.name}</span>
                <span>V {star.mag.toFixed(2)}</span>
                <span>{star.gap.toFixed(1)}°</span>
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </div>
  )
}

/** Short names for the five nearest stars. Hover stays on the catalog dots. */
export function StarIdentifyLabels({
  longitude,
  factor,
}: {
  longitude: number
  factor: number
}) {
  const on = useStarsNear()
  if (!on || !starFieldVisible(factor)) return null
  const near = nearestNamedStars(longitude)
  return (
    <g className="home-sky-star-names" aria-hidden="true">
      {near.map((star) => (
        <text key={star.hip} className="home-sky-star-name" x={star.x + 3.5} y={star.y - 2.5}>
          {star.name}
        </text>
      ))}
    </g>
  )
}
