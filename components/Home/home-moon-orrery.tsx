/**
 * components/Home/home-moon-orrery.tsx — Solar system in the Moon detail
 *
 * Heliocentric ecliptic chart of the eight planets. Body sizes share one
 * kilometres-per-pixel scale, so the Moon is smaller than a pixel until
 * Earth is opened. That view places Earth and the Moon at true size and
 * true separation. Photographs are projected globes. A saved time rate
 * runs that clock faster than the wall; real time leaves the chart on the
 * date it was given. The motion bar under the chart is the same scale.
 * True-scale sky handoff: components/Home/MOON_SKY_MOTION.md.
 */
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { formatMajorWhen, moonGlance } from "@/lib/lunar"
import { advanceSimMillis, timeRateAt } from "@/lib/sky-motion"
import { useSkyMotionStore } from "@/lib/sky-motion-store"
import { SkyMotionBar } from "@/components/Home/home-sky-motion"
import {
  BODY_RADIUS_KM,
  SATURN_RING,
  earthMoonRadii,
  formatAu,
  formatDeg,
  orbitSamples,
  planetPlaces,
  systemBodyRadiusPx,
  type PlanetId,
  type PlanetPlace,
} from "@/lib/solar-system"
import { sunLight, usePlanetSkins, type GlobeLight } from "@/components/Home/planet-skins"

const VB = { w: 520, h: 400 }
const CX = 260
const CY = 200
const SCALE = 34

/** Square-root radius so Mercury and Neptune share one chart. Slight tilt. */
function toScreen(xAu: number, yAu: number, zAu = 0): { x: number; y: number } {
  const r = Math.hypot(xAu, yAu)
  const ang = Math.atan2(yAu, xAu)
  const pr = Math.sqrt(r) * SCALE
  const x = Math.cos(ang) * pr
  const y = Math.sin(ang) * pr
  const tilt = 0.72
  return { x: CX + x, y: CY + y * tilt - zAu * 8 }
}

/** A true Sun is about ten Jupiters across and would cover the inner orbits here. */
const SUN_PX = 8.5
/** Center-to-center pixels for the Earth zoom. Radii follow from the real gap. */
const EARTH_MOON_SEP = 440
const RING_ASPECT = 128 / 360

const STAR_DOTS = Array.from({ length: 56 }, (_, i) => ({
  x: ((i * 97) % 500) + 10,
  y: ((i * 53) % 380) + 10,
  n: i % 7 === 0 ? 1.3 : 0.7,
}))

/** Chart instant. Real time follows `anchor`. A faster rate plays forward from it. */
function useChartDate(anchor: Date): Date {
  const rateIndex = useSkyMotionStore((s) => s.rateIndex)
  const multiplier = timeRateAt(rateIndex).seconds
  const [sim, setSim] = useState(anchor)
  const simMs = useRef(anchor.getTime())

  useEffect(() => {
    if (multiplier <= 1) {
      simMs.current = anchor.getTime()
      setSim(anchor)
      return
    }
    const frameSec = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.25 : 1 / 24
    let raf = 0
    let last = performance.now()
    let carry = 0
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      simMs.current = advanceSimMillis(simMs.current, dt, multiplier)
      carry += dt
      if (carry >= frameSec) {
        carry = 0
        setSim(new Date(simMs.current))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [anchor, multiplier])

  return multiplier <= 1 ? anchor : sim
}

function coarseLight(light: GlobeLight): GlobeLight {
  if (light.emissive) return light
  const q = (n: number) => Math.round(n * 5) / 5
  return { x: q(light.x), y: q(light.y), z: q(light.z) }
}

export function MoonOrrery({ date }: { date: Date }) {
  const shown = useChartDate(date)
  const rateLabel = useSkyMotionStore((s) => timeRateAt(s.rateIndex).label)
  const sped = useSkyMotionStore((s) => s.rateIndex > 0)
  const glance = useMemo(() => moonGlance(shown), [shown])
  const [zoom, setZoom] = useState(false)
  const [picked, setPicked] = useState<PlanetId>("earth")
  const places = useMemo(() => planetPlaces(shown), [shown])
  const orbits = useMemo(
    () =>
      places.map((p) => ({
        id: p.id,
        d: orbitSamples(p.id, shown)
          .map((pt, i) => {
            const s = toScreen(pt.x, pt.y)
            return `${i === 0 ? "M" : "L"}${s.x.toFixed(1)} ${s.y.toFixed(1)}`
          })
          .join(" ") + " Z",
      })),
    [places, shown],
  )
  const earth = places.find((p) => p.id === "earth")!
  const selected = places.find((p) => p.id === picked) ?? earth

  const sunDirX = -earth.x
  const sunDirY = -earth.y
  const sunLen = Math.hypot(sunDirX, sunDirY) || 1
  const ux = sunDirX / sunLen
  const uy = sunDirY / sunLen
  const elong = glance.cycle * Math.PI * 2
  const mx = ux * Math.cos(elong) - uy * Math.sin(elong)
  const my = ux * Math.sin(elong) + uy * Math.cos(elong)
  const moonScreenLen = Math.hypot(mx, my * 0.72) || 1
  const moonDirX = mx / moonScreenLen
  const moonDirY = (my * 0.72) / moonScreenLen
  const pad = 36
  const sep = Math.min(
    EARTH_MOON_SEP,
    (VB.w - pad * 2) / Math.max(0.2, Math.abs(moonDirX)),
    (VB.h - pad * 2) / Math.max(0.2, Math.abs(moonDirY)),
  )
  const pair = earthMoonRadii(sep)
  const earthZoom = { x: CX - moonDirX * (sep / 2), y: CY - moonDirY * (sep / 2) }
  const moonZoom = { x: CX + moonDirX * (sep / 2), y: CY + moonDirY * (sep / 2) }

  const lights = useMemo(() => {
    const next: Record<string, GlobeLight> = {
      sun: { x: 0, y: 0, z: 1, emissive: true },
    }
    for (const planet of places) {
      const at = toScreen(planet.x, planet.y, planet.z)
      next[planet.id] = sunLight(CX - at.x, CY - at.y)
    }
    const sunX = ux
    const sunY = uy * 0.72
    const sunN = Math.hypot(sunX, sunY) || 1
    next.moon = sunLight(sunX / sunN, sunY / sunN)
    return next
  }, [places, ux, uy])
  const skinLights = useMemo(() => {
    const next: Record<string, GlobeLight> = {}
    for (const [id, light] of Object.entries(lights)) next[id] = coarseLight(light)
    return next
  }, [lights])
  const skins = usePlanetSkins(skinLights)

  const onPlanet = (id: PlanetId) => {
    setPicked(id)
    setZoom(id === "earth")
  }

  return (
    <>
    <div className="home-sky-lab" data-zoom={zoom ? "earth" : "system"} data-rate={sped ? "fast" : "real"}>
      <div className="home-sky-stage">
        <svg className="home-sky-chart" viewBox={`0 0 ${VB.w} ${VB.h}`} role="img" aria-label="Solar system">
          <rect className="home-sky-glass" width={VB.w} height={VB.h} />
          {STAR_DOTS.map((star, i) => (
            <circle key={i} className="home-sky-star" cx={star.x} cy={star.y} r={star.n} />
          ))}
          {zoom ? (
            <g className="home-sky-world is-earth">
              <circle className="home-sky-moon-orbit" cx={earthZoom.x} cy={earthZoom.y} r={sep} />
              <Body
                name="Earth"
                x={earthZoom.x}
                y={earthZoom.y}
                r={pair.earth}
                color={earth.color}
                skin={skins.earth}
                label
              />
              <Body
                name="Moon"
                x={moonZoom.x}
                y={moonZoom.y}
                r={pair.moon}
                color="#c8c2b4"
                skin={skins.moon}
                label
              />
            </g>
          ) : (
            <g className="home-sky-world">
              {orbits.map((orbit) => (
                <path key={orbit.id} className="home-sky-orbit" data-planet={orbit.id} d={orbit.d} />
              ))}
              <line className="home-sky-equinox" x1={CX - 8} y1={CY} x2={CX + 170} y2={CY} />
              <circle className="home-sky-sun" cx={CX} cy={CY} r={SUN_PX} />
              {skins.sun ? (
                <image className="home-sky-photo" href={skins.sun} x={CX - SUN_PX} y={CY - SUN_PX} width={SUN_PX * 2} height={SUN_PX * 2} />
              ) : (
                <circle className="home-sky-sun-core" cx={CX} cy={CY} r={SUN_PX * 0.45} />
              )}
              {places.map((planet) => {
                const at = toScreen(planet.x, planet.y, planet.z)
                const r = systemBodyRadiusPx(BODY_RADIUS_KM[planet.id])
                const ringW = r * SATURN_RING.outer * 2
                return (
                  <g key={planet.id} className="home-sky-body" data-planet={planet.id}>
                    {planet.id === "saturn" && skins["saturn-ring"] ? (
                      <image
                        className="home-sky-photo"
                        href={skins["saturn-ring"]}
                        x={at.x - ringW / 2}
                        y={at.y - (ringW * RING_ASPECT) / 2}
                        width={ringW}
                        height={ringW * RING_ASPECT}
                      />
                    ) : null}
                    <circle
                      className="home-sky-pick"
                      cx={at.x}
                      cy={at.y}
                      r={Math.max(11, r + 4)}
                      role="button"
                      aria-label={planet.id === "earth" ? "Zoom to Earth and the Moon" : planet.name}
                      onClick={() => onPlanet(planet.id)}
                    />
                    {picked === planet.id ? (
                      <circle className="home-sky-select" cx={at.x} cy={at.y} r={r + 2.2} />
                    ) : null}
                    <Body name={planet.name} x={at.x} y={at.y} r={r} color={planet.color} skin={skins[planet.id]} />
                    {planet.au > 4 ? (
                      <text className="home-sky-tag" x={at.x + Math.max(r, planet.id === "saturn" ? ringW / 2 : r) + 6} y={at.y - 4}>
                        {planet.name}
                      </text>
                    ) : null}
                  </g>
                )
              })}
            </g>
          )}
          {!zoom ? (
            <text className="home-sky-zero" x={CX + 176} y={CY - 4}>
              0°
            </text>
          ) : null}
          <text className="home-sky-zero" x={12} y={18}>
            {zoom ? "Earth and Moon · true size" : "planets to scale · √r"}
          </text>
        </svg>
        {zoom ? (
          <button type="button" className="home-review-key home-sky-back" onClick={() => setZoom(false)}>
            Solar system
          </button>
        ) : (
          <button type="button" className="home-review-key home-sky-back" onClick={() => onPlanet("earth")}>
            Earth and Moon
          </button>
        )}
      </div>
      <aside className="home-sky-readout">
        <h3>{zoom ? "Earth and Moon" : "Ecliptic"}</h3>
        <p className="home-sky-epoch">
          {formatMajorWhen(shown)}
          {sped ? ` · ${rateLabel}` : ""}
        </p>
        {zoom ? (
          <EarthCard
            earth={earth}
            phaseLabel={glance.label}
            illuminationPct={Math.round(glance.illumination * 100)}
            cycle={glance.cycle}
          />
        ) : (
          <PlanetCard planet={selected} />
        )}
        <ul className="home-sky-roster">
          {places.map((planet) => (
            <li key={planet.id}>
              <button
                type="button"
                className={picked === planet.id ? "is-on" : undefined}
                onClick={() => onPlanet(planet.id)}
              >
                <span className="home-sky-bead" style={{ background: planet.color }} />
                {planet.name}
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
    <SkyMotionBar />
    </>
  )
}

function Body({
  name,
  x,
  y,
  r,
  color,
  skin,
  label = false,
}: {
  name: string
  x: number
  y: number
  r: number
  color: string
  skin?: string
  label?: boolean
}) {
  return (
    <>
      {skin ? (
        <image className="home-sky-photo" href={skin} x={x - r} y={y - r} width={r * 2} height={r * 2} />
      ) : (
        <circle className="home-sky-disk" cx={x} cy={y} r={Math.max(r, 0.6)} fill={color} />
      )}
      {label ? (
        <text className="home-sky-tag" x={x} y={y + r + 11} textAnchor="middle">
          {name}
        </text>
      ) : null}
    </>
  )
}

function PlanetCard({ planet }: { planet: PlanetPlace }) {
  return (
    <div className="home-sky-card">
      <p className="home-sky-card-name">{planet.name}</p>
      <dl>
        <div>
          <dt>lon</dt>
          <dd>{formatDeg(planet.longitude)}</dd>
        </div>
        <div>
          <dt>lat</dt>
          <dd>{formatDeg(planet.latitude)}</dd>
        </div>
        <div>
          <dt>r</dt>
          <dd>{formatAu(planet.au)}</dd>
        </div>
        <div>
          <dt>from</dt>
          <dd>{planet.id === "earth" ? "here" : formatAu(planet.fromEarth)}</dd>
        </div>
      </dl>
    </div>
  )
}

function EarthCard({
  earth,
  phaseLabel,
  illuminationPct,
  cycle,
}: {
  earth: PlanetPlace
  phaseLabel: string
  illuminationPct: number
  cycle: number
}) {
  const elongation = Math.round(cycle * 360) % 360
  return (
    <div className="home-sky-card">
      <p className="home-sky-card-name">Earth</p>
      <dl>
        <div>
          <dt>lon</dt>
          <dd>{formatDeg(earth.longitude)}</dd>
        </div>
        <div>
          <dt>r</dt>
          <dd>{formatAu(earth.au)}</dd>
        </div>
      </dl>
      <p className="home-sky-card-name">Moon</p>
      <dl>
        <div>
          <dt>phase</dt>
          <dd>{phaseLabel}</dd>
        </div>
        <div>
          <dt>lit</dt>
          <dd>~{illuminationPct}%</dd>
        </div>
        <div>
          <dt>elong.</dt>
          <dd>{elongation}°</dd>
        </div>
        <div>
          <dt>range</dt>
          <dd>384,400 km</dd>
        </div>
      </dl>
    </div>
  )
}
