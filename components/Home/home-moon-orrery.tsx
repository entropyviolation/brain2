/**
 * components/Home/home-moon-orrery.tsx — Solar system in the Moon detail
 *
 * Heliocentric ecliptic chart of the eight planets. Orbits stay √r.
 * Disks use displayBodyRadiusPx, so the Sun stays larger than Jupiter.
 * True sizes, off by default, draws kilometres and does not write the
 * motion store. Earth, opened to its moons, keeps true size, true
 * separation, and the lunar phase. Photographs are projected globes. A saved time rate
 * runs that clock faster than the wall. The anchor is the widget date when
 * the detail opens. A same-day minute tick does not move it and does not
 * clear elapsed. Pause freezes that clock and does not change the saved
 * rate or view width. Real time paused holds the anchor. Reverse runs that
 * same clock backward and is not saved. Reset returns to real time forward.
 * Chart zoom is a session magnifier (`lib/sky-zoom.ts`); it is not the
 * motion bar's view width. Wheel notches coalesce to one frame, and a
 * flight eases that same world-group transform. The factor commits once
 * when the gesture ends, so the star field is not rebuilt on every tick.
 * Planet names fly to an orbit fit. Double-click
 * flies to that planet's moons (Earth keeps the lunar phase; Mercury and
 * Venus are the globe alone). Facts flies closer, until the globe fills the
 * glass. Disks use `displayBodyRadiusPx` unless True sizes is on. That
 * toggle is session-only and does not write the motion store. The Sun stays
 * the center of an orbit fit. The motion bar under the chart is the same
 * width and rate. A date control sets a new anchor and restarts elapsed.
 * Now returns the anchor to the widget date and clears elapsed. Reset to
 * real time clears elapsed and leaves the anchor. Elapsed time, direction,
 * and zoom are not saved. Earth texture longitude follows the simulation
 * instant, one turn per sidereal day. The √r chart stays; the log camera
 * waits for one AU scene.
 * True-scale sky handoff: components/Home/MOON_SKY_MOTION.md.
 */
"use client"

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { formatMajorWhen, moonGlance } from "@/lib/lunar"
import {
  chartAnchorAfterWidget,
  chartClockAt,
  earthSpinDegrees,
  stepChartClock,
  timeRateAt,
  type ChartClock,
} from "@/lib/sky-motion"
import { useSkyMotionStore } from "@/lib/sky-motion-store"
import {
  ZOOM_STOPS,
  approachZoom,
  bodyCloseFactor,
  chartPoint,
  nearestStop,
  orbitFitFactor,
  stopCaption,
  zoomByWheel,
  zoomFactor,
  type ZoomStop,
} from "@/lib/sky-zoom"
import {
  SCALE_CONTROLS,
  SCALE_TOUR_MS,
  scaleCaptionFrame,
  scaleExponent,
  scaleGlyph,
  scaleOnChart,
  scaleStopName,
  tourCaption,
  tourChartFactor,
  tourPlace,
  type ScaleGlyph,
  type ScaleStop,
} from "@/lib/sky-scale"
import { SkyMotionBar } from "@/components/Home/home-sky-motion"
import { displayBodyRadiusPx, kmPerPxForOrbit, trueBodyRadiusPx } from "@/lib/sky-bodies"
import { moonAngle, moonsOf, planetFacts } from "@/lib/sky-moons"
import {
  BODY_RADIUS_KM,
  SATURN_RING,
  SUN_RADIUS_KM,
  earthMoonRadii,
  formatAu,
  formatDeg,
  orbitSamples,
  planetPlaces,
  type PlanetId,
  type PlanetPlace,
} from "@/lib/solar-system"
import { CLOSE_GLOBE, sunLight, usePlanetSkins, type GlobeLight } from "@/components/Home/planet-skins"
import { SKY_STAR_DOTS } from "@/components/Home/naked-eye-stars"
import { StarIdentifyLabels, StarIdentifyPanel } from "@/components/Home/star-identify"
import { GalaxyBand, GalaxySchematic, showGalaxySchematic } from "@/components/Home/sky-galaxy"

const VB = { w: 520, h: 400 }
const CX = 260
const CY = 200

const STOP_LABEL: Record<ZoomStop, string> = {
  inner: "Inner",
  earth: "Earth",
  moon: "Moon",
  system: "System",
  stars: "Stars",
  galaxy: "Galaxy",
}

/**
 * `chartPoint` at this factor, then a uniform fit so Mars stays on the glass.
 * Factor 1 is unscaled: today's √r × 34, tilt 0.72.
 */
function project(
  xAu: number,
  yAu: number,
  zAu: number,
  factor: number,
  mag: number,
  pan: { x: number; y: number },
): { x: number; y: number } {
  const p = chartPoint(xAu, yAu, factor, CX, CY)
  const scale = factor === 0 ? 1 : mag / factor
  return {
    x: CX + (p.x - CX) * scale + pan.x,
    y: CY + (p.y - CY) * scale - zAu * 8 * mag + pan.y,
  }
}

/** Inner stop: Mars's orbit meets the glass, so Mercury through Mars stay in view. */
function innerFit(factor: number): number {
  const mars = chartPoint(1.52, 0, factor, 0, 0)
  const radius = Math.hypot(mars.x, mars.y)
  const glass = Math.min(VB.w, VB.h) / 2 - 18
  if (!(radius > glass) || radius === 0) return 1
  return glass / radius
}

/** On-screen radius of a circular orbit of `au` at this magnification. */
function orbitScreenRadius(au: number, factor: number, mag: number): number {
  const placed = chartPoint(Math.max(au, 1e-9), 0, factor, 0, 0)
  const scale = factor === 0 ? 1 : mag / factor
  return Math.hypot(placed.x, placed.y) * scale
}

/**
 * Display disks follow `displayBodyRadiusPx`. True sizes use kilometres on
 * that orbit. A true disk under 2 px becomes a 2 px marker so it stays findable.
 */
function bodyRadius(
  id: "sun" | PlanetId,
  zoom: number,
  trueSizes: boolean,
  au: number,
  orbitPx: number,
): { r: number; marked: boolean } {
  if (!trueSizes) return { r: displayBodyRadiusPx(id, zoom), marked: false }
  const km = id === "sun" ? SUN_RADIUS_KM : BODY_RADIUS_KM[id]
  const raw = trueBodyRadiusPx(km, kmPerPxForOrbit(au, orbitPx))
  if (!(raw >= 2)) return { r: 1, marked: true }
  return { r: raw, marked: false }
}

type ZoomLayout = { mag: number; panX: number; panY: number }

/** Screen pan toward `place`. Gaze 0 and the Earth–Moon frame stay on the Sun. */
function chartPan(
  focus: "sun" | "earth" | "pair",
  gaze: number,
  place: { x: number; y: number; z: number } | undefined,
  factor: number,
): { x: number; y: number } {
  if (focus === "pair" || !place || gaze === 0) return { x: 0, y: 0 }
  const at = chartPoint(place.x, place.y, factor, CX, CY)
  return {
    x: (CX - at.x) * gaze,
    y: (CY - (at.y - place.z * 8 * factor)) * gaze,
  }
}

function scaleAbout(cx: number, cy: number, scale: number): string {
  if (!Number.isFinite(scale) || Math.abs(scale - 1) < 1e-4) return ""
  return `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})`
}

function setTransform(node: Element, value: string) {
  if (value) node.setAttribute("transform", value)
  else node.removeAttribute("transform")
}

function isChartBody(id: string): id is "sun" | PlanetId {
  return (
    id === "sun" ||
    id === "mercury" ||
    id === "venus" ||
    id === "earth" ||
    id === "mars" ||
    id === "jupiter" ||
    id === "saturn" ||
    id === "uranus" ||
    id === "neptune"
  )
}

/**
 * Map a chart laid out at `layout` onto `mag` and pan.
 * `chartPoint` is linear in factor, so one scale about the Sun matches it.
 * Disks sit in a counter-scale so they follow `displayBodyRadiusPx` instead of the orbit scale.
 */
function paintChartZoom(
  chart: SVGSVGElement,
  layout: ZoomLayout,
  mag: number,
  panX: number,
  panY: number,
  trueSizes: boolean,
) {
  const world = chart.querySelector(".home-sky-world")
  if (!world || world.classList.contains("is-earth") || world.hasAttribute("data-moons") || world.hasAttribute("data-facts")) {
    return
  }
  const s = layout.mag > 0 ? mag / layout.mag : 1
  const tx = CX * (1 - s) + panX - s * layout.panX
  const ty = CY * (1 - s) + panY - s * layout.panY
  const moved = Math.abs(s - 1) > 1e-4 || Math.abs(tx) > 1e-3 || Math.abs(ty) > 1e-3
  setTransform(world, moved ? `matrix(${s} 0 0 ${s} ${tx} ${ty})` : "")
  const pins = world.querySelectorAll<SVGGElement>("[data-zoom-pin]")
  pins.forEach((pin) => {
    const lx = Number(pin.getAttribute("data-layout-x"))
    const ly = Number(pin.getAttribute("data-layout-y"))
    const layoutR = Number(pin.getAttribute("data-r"))
    const marked = pin.getAttribute("data-marked") === "yes"
    const id = pin.getAttribute("data-planet") ?? ""
    let glyphScale = 1
    if (layoutR > 0 && isChartBody(id)) {
      const liveR = marked ? layoutR : trueSizes ? layoutR * s : displayBodyRadiusPx(id, mag)
      glyphScale = liveR / layoutR
    }
    const hold = pin.querySelector(".home-sky-hold")
    const glyph = pin.querySelector(".home-sky-glyph")
    if (hold) setTransform(hold, moved ? scaleAbout(lx, ly, s === 0 ? 1 : 1 / s) : "")
    if (glyph) setTransform(glyph, moved ? scaleAbout(lx, ly, glyphScale) : "")
    if (pin.hasAttribute("data-x") && Number.isFinite(lx) && Number.isFinite(ly)) {
      const vx = moved ? CX + (lx - CX) * s + panX - s * layout.panX : lx
      const vy = moved ? CY + (ly - CY) * s + panY - s * layout.panY : ly
      pin.setAttribute("data-x", vx.toFixed(1))
      pin.setAttribute("data-y", vy.toFixed(1))
    }
  })
}

function clearChartZoom(chart: SVGSVGElement) {
  const world = chart.querySelector(".home-sky-world")
  if (!world) return
  world.removeAttribute("transform")
  world.querySelectorAll(".home-sky-hold, .home-sky-glyph").forEach((node) => node.removeAttribute("transform"))
  world.querySelectorAll<SVGGElement>("[data-zoom-pin]").forEach((pin) => {
    const lx = pin.getAttribute("data-layout-x")
    const ly = pin.getAttribute("data-layout-y")
    if (lx == null || ly == null || !pin.hasAttribute("data-x")) return
    pin.setAttribute("data-x", Number(lx).toFixed(1))
    pin.setAttribute("data-y", Number(ly).toFixed(1))
  })
}

/** Center-to-center pixels for the Earth zoom. Radii follow from the real gap. */
const EARTH_MOON_SEP = 440
const RING_ASPECT = 128 / 360
/** Visible log-space flight. A stop or a planet name eases; it does not snap. */
const ZOOM_FLIGHT_MS = 700
/** Settle the wheel, then commit the factor once. */
const WHEEL_COMMIT_MS = 90
/** Wait so a double-click can choose the close-up instead of the orbit fit. */
const ROSTER_CLICK_MS = 250

type Glass =
  | { kind: "chart" }
  | { kind: "moons"; id: PlanetId }
  | { kind: "facts"; id: PlanetId }

type Intent =
  | { kind: "stop"; stop: ZoomStop }
  | { kind: "orbit"; id: PlanetId }
  | { kind: "moons"; id: PlanetId }
  | { kind: "facts"; id: PlanetId }

type Flight = {
  during: number
  landed: number
  focus: "sun" | "earth" | "pair"
  fitted: boolean
  gaze: number
  gazeId: PlanetId | null
  intent: Intent
  glass: Glass
}

/** Progress in the detail. Bright rows are in. Dim rows are still ahead. */
const SKY_BUILD = [
  { id: "date", label: "Date control", state: "done" },
  { id: "now", label: "Now", state: "done" },
  { id: "clock", label: "One clock", state: "done" },
  { id: "zoom", label: "Zoom", state: "done" },
  { id: "pause", label: "Pause", state: "done" },
  { id: "orbit", label: "Orbit zip", state: "done" },
  { id: "close", label: "Close-up", state: "done" },
  { id: "moons", label: "Moons", state: "done" },
  { id: "reverse", label: "Reverse", state: "done" },
  { id: "spin", label: "Earth spin", state: "done" },
  { id: "camera", label: "Log camera", state: "ahead", title: "From view width, once a one-AU scene exists. 1,000 px = W km." },
  { id: "chrome", label: "Chrome", state: "ahead" },
  { id: "stars", label: "Stars", state: "done" },
  { id: "galaxy", label: "Galaxy", state: "done" },
  { id: "identify", label: "Star identify", state: "done" },
  { id: "sizes", label: "True sizes", state: "done" },
  { id: "scale", label: "Powers of ten", state: "done" },
  { id: "light", label: "Light-time", state: "ahead" },
] as const

function localInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function dateFromLocalInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const next = new Date(year, month - 1, day, hour, minute, 0, 0)
  if (
    next.getFullYear() !== year ||
    next.getMonth() !== month - 1 ||
    next.getDate() !== day ||
    next.getHours() !== hour ||
    next.getMinutes() !== minute
  ) {
    return null
  }
  return next
}

/**
 * Chart instant. `shown = anchor + elapsed × M × direction`, with a 0.1 s
 * frame cap. Elapsed lives in a ref and keeps accumulating while this detail
 * is open. A new anchor or `snap` restarts it. Real time forward shows the
 * anchor and clears elapsed. Reverse runs the same elapsed backward, including
 * at real time. Pause freezes the ref and does not zero it. Real time paused
 * holds the anchor. Elapsed and direction are not stored.
 */
function useChartDate(anchor: Date, snap: number, paused: boolean, reversed: boolean): Date {
  const rateIndex = useSkyMotionStore((s) => s.rateIndex)
  const multiplier = timeRateAt(rateIndex).seconds
  const anchorMs = anchor.getTime()
  const clockRef = useRef<ChartClock>(chartClockAt(anchorMs))
  const multiplierRef = useRef(multiplier)
  multiplierRef.current = multiplier
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const reversedRef = useRef(reversed)
  reversedRef.current = reversed
  const [shownMs, setShownMs] = useState(anchorMs)
  const running = multiplier > 1 || reversed

  useEffect(() => {
    clockRef.current = stepChartClock(clockRef.current, {
      dtRealSec: 0,
      multiplier: multiplierRef.current,
      restartAnchorMs: anchorMs,
    })
    setShownMs(clockRef.current.shownMs)
  }, [anchorMs, snap])

  useEffect(() => {
    if (multiplier > 1 || reversed) return
    clockRef.current = stepChartClock(clockRef.current, {
      dtRealSec: 0,
      multiplier: 1,
      restartAnchorMs: clockRef.current.anchorMs,
    })
    setShownMs(clockRef.current.shownMs)
  }, [multiplier, reversed])

  useEffect(() => {
    if (!running) return
    const frameSec = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.25 : 1 / 24
    let raf = 0
    let last = performance.now()
    let carry = 0
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      const rate = multiplierRef.current
      const direction = reversedRef.current ? -1 : 1
      if (!pausedRef.current && (rate > 1 || direction < 0)) {
        clockRef.current = stepChartClock(clockRef.current, {
          dtRealSec: dt,
          multiplier: rate > 1 ? rate : 1,
          direction,
          paused: false,
        })
        carry += dt
        if (carry >= frameSec) {
          carry = 0
          setShownMs(clockRef.current.shownMs)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [running])

  return multiplier <= 1 && !reversed ? new Date(anchorMs) : new Date(shownMs)
}

/**
 * Real-time forward keeps the epoch on the anchor. The Earth texture still
 * needs the seconds, so this adds wall time while that clock is playing.
 * Fast rates and reverse already move `shownMs`. Pause freezes the hold.
 */
function useLiveSpin(anchorMs: number, shownMs: number, live: boolean, paused: boolean): number {
  const hold = useRef(anchorMs)
  const [wallMs, setWallMs] = useState(anchorMs)
  useEffect(() => {
    if (!live || paused) return
    const wall0 = performance.now()
    let raf = 0
    let last = Number.NaN
    const tick = (now: number) => {
      const sim = anchorMs + (now - wall0)
      hold.current = sim
      const bucket = Math.round(earthSpinDegrees(sim))
      if (bucket !== last) {
        last = bucket
        setWallMs(sim)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [live, paused, anchorMs])
  if (!live) return shownMs
  return paused ? hold.current : wallMs
}

function coarseLight(light: GlobeLight): GlobeLight {
  if (light.emissive) return light
  const q = (n: number) => Math.round(n * 5) / 5
  const next: GlobeLight = { x: q(light.x), y: q(light.y), z: q(light.z) }
  if (light.spinTurns) next.spinTurns = light.spinTurns
  return next
}

/** Hipparcos dots. Zoom never changes their props, so a chart render leaves the nodes mounted. */
const StarField = memo(function StarField() {
  return SKY_STAR_DOTS.map((star) => (
    <g key={star.hip} className="home-sky-star" opacity={star.opacity} aria-label={star.label}>
      <title>{star.label}</title>
      {star.cross > 0 ? (
        <g aria-hidden="true">
          <line x1={star.x - star.cross} y1={star.y} x2={star.x + star.cross} y2={star.y} stroke={star.fill} strokeWidth={0.35} strokeLinecap="round" />
          <line x1={star.x} y1={star.y - star.cross} x2={star.x} y2={star.y + star.cross} stroke={star.fill} strokeWidth={0.35} strokeLinecap="round" />
        </g>
      ) : null}
      <circle cx={star.x} cy={star.y} r={star.r} fill={star.fill} />
    </g>
  ))
})

export function MoonOrrery({ date }: { date: Date }) {
  const [chosen, setChosen] = useState<Date | null>(null)
  const [snap, setSnap] = useState(0)
  const [followMs, setFollowMs] = useState(() => date.getTime())
  const [paused, setPaused] = useState(false)
  const [reversed, setReversed] = useState(false)
  const [factor, setFactor] = useState(1)
  const [focus, setFocus] = useState<"sun" | "earth" | "pair">("sun")
  const [fitted, setFitted] = useState(false)
  const [gaze, setGaze] = useState(0)
  const [gazeId, setGazeId] = useState<PlanetId | null>(null)
  const [intent, setIntent] = useState<Intent | null>({ kind: "stop", stop: "system" })
  const [glass, setGlass] = useState<Glass>({ kind: "chart" })
  const [trueSizes, setTrueSizes] = useState(false)
  const [scaleT, setScaleT] = useState<number | null>(null)
  const [scalePlaying, setScalePlaying] = useState(false)
  const [scaleSpeed, setScaleSpeed] = useState(1)
  const widgetMs = date.getTime()
  const chartRef = useRef<SVGSVGElement>(null)
  const focusRef = useRef(focus)
  const factorRef = useRef(factor)
  const fittedRef = useRef(fitted)
  const gazeRef = useRef(gaze)
  const glassRef = useRef(glass)
  const liveMagRef = useRef(1)
  const layoutRef = useRef<ZoomLayout>({ mag: 1, panX: 0, panY: 0 })
  const gesturingRef = useRef(false)
  const gazePlaceRef = useRef<{ x: number; y: number; z: number } | undefined>(undefined)
  const trueSizesRef = useRef(false)
  const flightGen = useRef(0)
  const flightRaf = useRef(0)
  const scaleRaf = useRef(0)
  const scaleTRef = useRef<number | null>(null)
  const scaleSpeedRef = useRef(1)
  const scalePlayingRef = useRef(false)
  scaleSpeedRef.current = scaleSpeed
  const wheelDeltaRef = useRef(0)
  const wheelRafRef = useRef(0)
  const wheelCommitRef = useRef(0)
  const clickTimer = useRef(0)
  focusRef.current = focus
  glassRef.current = glass

  useEffect(() => {
    if (paused) return
    const next = chartAnchorAfterWidget(followMs, widgetMs, chosen === null)
    if (!next.restarted) return
    setFollowMs(next.anchorMs)
    setSnap((n) => n + 1)
  }, [chosen, widgetMs, followMs, paused])

  useEffect(() => {
    return () => {
      cancelAnimationFrame(flightRaf.current)
      cancelAnimationFrame(scaleRaf.current)
      cancelAnimationFrame(wheelRafRef.current)
      window.clearTimeout(clickTimer.current)
      window.clearTimeout(wheelCommitRef.current)
    }
  }, [])

  useEffect(() => {
    const node = chartRef.current
    if (!node) return
    const commitWheel = () => {
      wheelCommitRef.current = 0
      if (flightRaf.current || scaleRaf.current || !gesturingRef.current) return
      gesturingRef.current = false
      const next = factorRef.current
      liveMagRef.current = next
      gazeRef.current = 0
      fittedRef.current = false
      setFactor(next)
      setGaze(0)
      setGazeId(null)
      setFocus("sun")
      setFitted(false)
      setIntent(null)
      setGlass({ kind: "chart" })
      glassRef.current = { kind: "chart" }
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      window.clearTimeout(clickTimer.current)
      flightGen.current += 1
      cancelAnimationFrame(flightRaf.current)
      flightRaf.current = 0
      cancelAnimationFrame(scaleRaf.current)
      scaleRaf.current = 0
      scalePlayingRef.current = false
      scaleTRef.current = null
      setScalePlaying(false)
      setScaleT(null)
      const offChart = glassRef.current.kind !== "chart" || focusRef.current === "pair"
      if (offChart) {
        const base = focusRef.current === "pair" ? zoomFactor("earth") : liveMagRef.current
        factorRef.current = base
        liveMagRef.current = base
        gazeRef.current = 0
        focusRef.current = "sun"
        fittedRef.current = false
        glassRef.current = { kind: "chart" }
        gesturingRef.current = true
        setFocus("sun")
        setFitted(false)
        setGaze(0)
        setGazeId(null)
        setIntent(null)
        setGlass({ kind: "chart" })
        setFactor(base)
        setScaleT(null)
      } else {
        if (fittedRef.current) {
          factorRef.current = liveMagRef.current
          fittedRef.current = false
        }
        gazeRef.current = 0
        gesturingRef.current = true
      }
      wheelDeltaRef.current += event.deltaY
      if (wheelRafRef.current) return
      wheelRafRef.current = requestAnimationFrame(() => {
        wheelRafRef.current = 0
        const delta = wheelDeltaRef.current
        wheelDeltaRef.current = 0
        const next = zoomByWheel(liveMagRef.current, delta)
        liveMagRef.current = next
        factorRef.current = next
        gazeRef.current = 0
        const chart = chartRef.current
        if (chart) {
          paintChartZoom(chart, layoutRef.current, next, 0, 0, trueSizesRef.current)
          chart.setAttribute("data-factor", String(next))
        }
        window.clearTimeout(wheelCommitRef.current)
        wheelCommitRef.current = window.setTimeout(commitWheel, WHEEL_COMMIT_MS)
      })
    }
    node.addEventListener("wheel", onWheel, { passive: false })
    return () => node.removeEventListener("wheel", onWheel)
  }, [])

  const anchor = chosen ?? new Date(followMs)
  const shown = useChartDate(anchor, snap, paused, reversed)
  const rateIndex = useSkyMotionStore((s) => s.rateIndex)
  const multiplier = timeRateAt(rateIndex).seconds
  const rateLabel = timeRateAt(rateIndex).label
  const sped = rateIndex > 0
  const spinMs = useLiveSpin(anchor.getTime(), shown.getTime(), multiplier <= 1 && !reversed, paused)
  const spinDeg = earthSpinDegrees(spinMs)
  const glance = useMemo(() => moonGlance(shown), [shown])
  const [picked, setPicked] = useState<PlanetId>("earth")
  const places = useMemo(() => planetPlaces(shown), [shown])
  const computed: ZoomStop =
    focus === "pair" || (glass.kind === "moons" && glass.id === "earth")
      ? "moon"
      : focus === "earth"
        ? "earth"
        : fitted
          ? "inner"
          : nearestStop(factor)
  const active: ZoomStop | null =
    intent?.kind === "stop"
      ? intent.stop
      : intent == null && glass.kind === "chart"
        ? computed
        : glass.kind === "moons" && glass.id === "earth"
          ? "moon"
          : null
  const pairFrame = glass.kind === "moons" && glass.id === "earth"
  const fit = fitted ? innerFit(factor) : 1
  const mag = factor * fit
  const earth = places.find((p) => p.id === "earth")!
  const gazePlace = gazeId ? places.find((p) => p.id === gazeId) : undefined
  const pan = useMemo(() => {
    if (focus === "pair" || !gazePlace || gaze === 0) return { x: 0, y: 0 }
    const at = chartPoint(gazePlace.x, gazePlace.y, factor, CX, CY)
    return {
      x: (CX - at.x) * gaze,
      y: (CY - (at.y - gazePlace.z * 8 * factor)) * gaze,
    }
  }, [focus, gaze, gazePlace, factor])
  gazePlaceRef.current = gazePlace
  trueSizesRef.current = trueSizes
  useLayoutEffect(() => {
    layoutRef.current = { mag, panX: pan.x, panY: pan.y }
    const chart = chartRef.current
    if (!gesturingRef.current) {
      factorRef.current = factor
      gazeRef.current = gaze
      fittedRef.current = fitted
      liveMagRef.current = mag
      if (chart) clearChartZoom(chart)
      return
    }
    if (!chart) return
    const livePan = chartPan(focusRef.current, gazeRef.current, gazePlaceRef.current, liveMagRef.current)
    paintChartZoom(chart, layoutRef.current, liveMagRef.current, livePan.x, livePan.y, trueSizesRef.current)
    chart.setAttribute("data-factor", String(factorRef.current))
  })
  const orbits = useMemo(
    () =>
      places.map((p) => ({
        id: p.id,
        d: orbitSamples(p.id, shown)
          .map((pt, i) => {
            const s = project(pt.x, pt.y, 0, factor, mag, pan)
            return `${i === 0 ? "M" : "L"}${s.x.toFixed(1)} ${s.y.toFixed(1)}`
          })
          .join(" ") + " Z",
      })),
    [places, shown, factor, mag, pan],
  )
  const selected = places.find((p) => p.id === picked) ?? earth
  const sunAt = project(0, 0, 0, factor, mag, pan)
  const sunOrbitPx = orbitScreenRadius(1, factor, mag)
  const sunDisk = bodyRadius("sun", mag, trueSizes, 1, sunOrbitPx)
  const chartDisks = places.map((planet) => {
    const orbitPx = orbitScreenRadius(planet.au, factor, mag)
    return { id: planet.id, ...bodyRadius(planet.id, mag, trueSizes, planet.au, orbitPx) }
  })
  const trueMarked = trueSizes && glass.kind === "chart" && (sunDisk.marked || chartDisks.some((disk) => disk.marked))
  const systemFraming =
    glass.kind === "chart" &&
    (intent == null || intent.kind === "stop") &&
    active === "system" &&
    Math.abs(factor - 1) < 0.02 &&
    !fitted

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
    const sun = project(0, 0, 0, factor, mag, pan)
    for (const planet of places) {
      const at = project(planet.x, planet.y, planet.z, factor, mag, pan)
      next[planet.id] = sunLight(sun.x - at.x, sun.y - at.y)
    }
    const sunX = ux
    const sunY = uy * 0.72
    const sunN = Math.hypot(sunX, sunY) || 1
    next.moon = sunLight(sunX / sunN, sunY / sunN)
    // Earth only. One sidereal turn per simulated day. Other planets stay fixed.
    if (next.earth) next.earth = { ...next.earth, spinTurns: spinDeg / 360 }
    return next
  }, [places, ux, uy, factor, mag, pan, spinDeg])
  const skinLights = useMemo(() => {
    const next: Record<string, GlobeLight> = {}
    for (const [id, light] of Object.entries(lights)) next[id] = coarseLight(light)
    return next
  }, [lights])
  const skins = usePlanetSkins(
    skinLights,
    glass.kind === "facts" || (glass.kind === "moons" && glass.id !== "earth")
      ? { [glass.id]: CLOSE_GLOBE }
      : undefined,
  )

  const onPlanet = (id: PlanetId) => {
    setPicked(id)
  }

  const fly = (target: Flight) => {
    window.clearTimeout(clickTimer.current)
    window.clearTimeout(wheelCommitRef.current)
    wheelCommitRef.current = 0
    cancelAnimationFrame(wheelRafRef.current)
    wheelRafRef.current = 0
    wheelDeltaRef.current = 0
    cancelAnimationFrame(scaleRaf.current)
    scaleRaf.current = 0
    scalePlayingRef.current = false
    setScalePlaying(false)
    setScaleT(null)
    scaleTRef.current = null
    const fromFactor = fittedRef.current ? factorRef.current * innerFit(factorRef.current) : factorRef.current
    const fromGaze = gazeRef.current
    const gen = ++flightGen.current
    cancelAnimationFrame(flightRaf.current)
    const start = performance.now()
    const leavingFrame = focusRef.current === "pair" || glassRef.current.kind !== "chart"
    gesturingRef.current = true
    factorRef.current = fromFactor
    liveMagRef.current = fromFactor
    gazeRef.current = fromGaze
    setIntent(target.intent)
    setGlass({ kind: "chart" })
    glassRef.current = { kind: "chart" }
    setFitted(false)
    fittedRef.current = false
    setFactor(fromFactor)
    if (leavingFrame) setFocus("sun")
    if (target.focus === "earth") setFocus("earth")
    else if (target.focus === "sun") setFocus("sun")
    if (target.gazeId) setGazeId(target.gazeId)
    const step = (now: number) => {
      if (gen !== flightGen.current) return
      const t = Math.min(1, (now - start) / ZOOM_FLIGHT_MS)
      const nextFactor = approachZoom(fromFactor, target.during, t)
      const nextGaze = fromGaze + (target.gaze - fromGaze) * t
      factorRef.current = nextFactor
      liveMagRef.current = nextFactor
      gazeRef.current = nextGaze
      const chart = chartRef.current
      if (chart) {
        const livePan = chartPan(focusRef.current, nextGaze, gazePlaceRef.current, nextFactor)
        paintChartZoom(chart, layoutRef.current, nextFactor, livePan.x, livePan.y, trueSizesRef.current)
        chart.setAttribute("data-factor", String(nextFactor))
      }
      if (t < 1) {
        flightRaf.current = requestAnimationFrame(step)
        return
      }
      flightRaf.current = 0
      gesturingRef.current = false
      factorRef.current = target.landed
      liveMagRef.current = target.fitted ? target.landed * innerFit(target.landed) : target.landed
      gazeRef.current = target.gaze
      fittedRef.current = target.fitted
      setFactor(target.landed)
      setGaze(target.gaze)
      setGazeId(target.gazeId)
      setFocus(target.focus)
      setFitted(target.fitted)
      setGlass(target.glass)
      glassRef.current = target.glass
    }
    flightRaf.current = requestAnimationFrame(step)
  }

  const applyScale = (t: number) => {
    const place = tourPlace(t)
    setGaze(0)
    gazeRef.current = 0
    setGazeId(null)
    setIntent(null)
    scaleTRef.current = t
    setScaleT(t)
    if (!scaleOnChart(place.stop)) {
      if (glassRef.current.kind !== "chart" || focusRef.current === "pair") {
        setFocus("sun")
        const chart = { kind: "chart" } as const
        setGlass(chart)
        glassRef.current = chart
      }
      return
    }
    gesturingRef.current = false
    setFitted(false)
    fittedRef.current = false
    const nextFactor = tourChartFactor(t)
    factorRef.current = nextFactor
    liveMagRef.current = nextFactor
    setFactor(nextFactor)
    if (place.stop === "earth-moon") {
      setFocus("pair")
      const next = { kind: "moons", id: "earth" } as const
      setGlass(next)
      glassRef.current = next
    } else {
      setFocus("sun")
      const chart = { kind: "chart" } as const
      setGlass(chart)
      glassRef.current = chart
    }
  }

  const beginScale = (t: number) => {
    window.clearTimeout(wheelCommitRef.current)
    wheelCommitRef.current = 0
    cancelAnimationFrame(wheelRafRef.current)
    wheelRafRef.current = 0
    wheelDeltaRef.current = 0
    flightGen.current += 1
    cancelAnimationFrame(flightRaf.current)
    flightRaf.current = 0
    cancelAnimationFrame(scaleRaf.current)
    scalePlayingRef.current = true
    setScalePlaying(true)
    applyScale(t)
    let last = performance.now()
    const step = (now: number) => {
      if (!scalePlayingRef.current) return
      const dt = now - last
      last = now
      const tour = SCALE_TOUR_MS / scaleSpeedRef.current
      const next = (scaleTRef.current ?? 0) + dt / tour
      if (next >= 1) {
        applyScale(1)
        scalePlayingRef.current = false
        setScalePlaying(false)
        scaleRaf.current = 0
        return
      }
      applyScale(next)
      scaleRaf.current = requestAnimationFrame(step)
    }
    scaleRaf.current = requestAnimationFrame(step)
  }

  const openScale = () => {
    scaleSpeedRef.current = 1
    setScaleSpeed(1)
    beginScale(0)
  }

  const pauseScale = () => {
    scalePlayingRef.current = false
    cancelAnimationFrame(scaleRaf.current)
    scaleRaf.current = 0
    setScalePlaying(false)
  }

  const playScale = () => {
    const t = scaleTRef.current
    if (t == null || t >= 1) openScale()
    else beginScale(t)
  }

  const stepScale = (dir: -1 | 1) => {
    if (scaleTRef.current == null) return
    const n = tourPlace(1).index + 1
    const index = tourPlace(scaleTRef.current).index
    const next = Math.max(0, Math.min(n - 1, index + dir))
    const t = next / n
    if (scalePlayingRef.current) beginScale(t)
    else applyScale(t)
  }

  const bumpScaleSpeed = (dir: 1 | -1) => {
    setScaleSpeed((speed) => {
      const next = dir > 0 ? Math.min(8, speed * 2) : Math.max(0.25, speed / 2)
      scaleSpeedRef.current = next
      return next
    })
  }

  const onScaleControl = (label: (typeof SCALE_CONTROLS)[number]) => {
    if (label === "Pause") pauseScale()
    else if (label === "Play") playScale()
    else if (label === "Slower") bumpScaleSpeed(-1)
    else if (label === "Faster") bumpScaleSpeed(1)
    else if (label === "Previous") stepScale(-1)
    else stepScale(1)
  }

  const selectStop = (stop: ZoomStop) => {
    const intentStop: Intent = { kind: "stop", stop }
    if (stop === "moon") {
      const landed = zoomFactor("moon")
      fly({
        during: landed,
        landed,
        focus: "pair",
        fitted: false,
        gaze: 1,
        gazeId: "earth",
        intent: intentStop,
        glass: { kind: "moons", id: "earth" },
      })
      return
    }
    if (stop === "earth") {
      const landed = zoomFactor("earth")
      fly({
        during: landed,
        landed,
        focus: "earth",
        fitted: false,
        gaze: 1,
        gazeId: "earth",
        intent: intentStop,
        glass: { kind: "chart" },
      })
      return
    }
    const landed = zoomFactor(stop)
    const during = stop === "inner" ? landed * innerFit(landed) : landed
    fly({
      during,
      landed,
      focus: "sun",
      fitted: stop === "inner",
      gaze: 0,
      gazeId: null,
      intent: intentStop,
      glass: { kind: "chart" },
    })
  }

  const zoomOrbit = (planet: PlanetPlace) => {
    setPicked(planet.id)
    const landed = orbitFitFactor(planet.au)
    fly({
      during: landed,
      landed,
      focus: "sun",
      fitted: false,
      gaze: 0,
      gazeId: null,
      intent: { kind: "orbit", id: planet.id },
      glass: { kind: "chart" },
    })
  }

  const zoomClose = (planet: PlanetPlace) => {
    setPicked(planet.id)
    const landed = bodyCloseFactor(planet.au)
    const earthClose = planet.id === "earth"
    fly({
      during: landed,
      landed,
      focus: earthClose ? "pair" : "sun",
      fitted: false,
      gaze: 1,
      gazeId: planet.id,
      intent: { kind: "moons", id: planet.id },
      glass: { kind: "moons", id: planet.id },
    })
  }

  const zoomFacts = (planet: PlanetPlace) => {
    setPicked(planet.id)
    const close = bodyCloseFactor(planet.au)
    const ceiling = zoomFactor("moon")
    const landed = close * 1.5 < ceiling ? Math.min(ceiling, close * 2) : ceiling
    fly({
      during: landed,
      landed,
      focus: "sun",
      fitted: false,
      gaze: 1,
      gazeId: planet.id,
      intent: { kind: "facts", id: planet.id },
      glass: { kind: "facts", id: planet.id },
    })
  }

  const onRosterClick = (planet: PlanetPlace) => {
    window.clearTimeout(clickTimer.current)
    clickTimer.current = window.setTimeout(() => zoomOrbit(planet), ROSTER_CLICK_MS)
  }

  const onRosterDouble = (planet: PlanetPlace) => {
    window.clearTimeout(clickTimer.current)
    zoomClose(planet)
  }

  const named = (id: PlanetId) => places.find((planet) => planet.id === id)?.name ?? id
  const factId =
    glass.kind === "moons" || glass.kind === "facts"
      ? glass.id
      : intent?.kind === "moons" || intent?.kind === "facts"
        ? intent.id
        : null
  const factPlanet = factId ? (places.find((planet) => planet.id === factId) ?? selected) : selected
  const facts = factId ? planetFacts(factId) : null
  let title = active === "system" ? "Ecliptic" : stopCaption(active ?? computed)
  let corner = systemFraming ? "planets to scale · √r" : stopCaption(active ?? computed)
  if (intent?.kind === "orbit") {
    const orbitName = `${named(intent.id)} orbit`
    title = orbitName
    corner = orbitName
  }
  if (intent?.kind === "moons") {
    const moonName = intent.id === "earth" ? "Earth and Moon" : named(intent.id)
    title = moonName
    corner = moonName
  }
  if (intent?.kind === "facts") {
    title = named(intent.id)
    corner = named(intent.id)
  }
  if (glass.kind === "moons" && glass.id === "earth") {
    title = "Earth and Moon"
    corner = "Earth and Moon · true size"
  } else if (glass.kind === "moons" || glass.kind === "facts") {
    title = named(glass.id)
    corner = named(glass.id)
  }

  const tourStop = scaleT == null ? null : tourPlace(scaleT).stop
  if (tourStop) {
    title = scaleStopName(tourStop)
    corner = `10^${scaleExponent(tourStop)} m`
  }
  const wideStars =
    glass.kind === "chart" &&
    (active === "system" || active === "stars" || showGalaxySchematic(active) || showGalaxySchematic(tourStop))
  const galaxyFrame = glass.kind === "chart" && (showGalaxySchematic(active) || showGalaxySchematic(tourStop))

  return (
    <>
    <div className="home-sky-lab" data-zoom={active ?? computed} data-true-sizes={trueSizes ? "yes" : "no"} data-paused={paused ? "yes" : "no"} data-rate={sped ? "fast" : "real"} data-direction={reversed ? "reverse" : "forward"}>
      <div className="home-sky-stage">
        <svg ref={chartRef} className="home-sky-chart" viewBox={`0 0 ${VB.w} ${VB.h}`} role="img" aria-label="Solar system" data-factor={factor}>
          <rect className="home-sky-glass" width={VB.w} height={VB.h} />
          {wideStars ? <GalaxyBand /> : null}
          <StarField />
          <StarIdentifyLabels longitude={factPlanet.longitude} factor={factor} />
          {pairFrame ? (
            <g className="home-sky-world is-earth">
              <circle className="home-sky-moon-orbit" cx={earthZoom.x} cy={earthZoom.y} r={sep} />
              <Body
                name="Earth"
                x={earthZoom.x}
                y={earthZoom.y}
                r={pair.earth}
                color={earth.color}
                skin={skins.earth}
                spin={spinDeg.toFixed(1)}
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
          ) : glass.kind === "moons" ? (
            <MoonSystem
              planet={places.find((p) => p.id === glass.id) ?? earth}
              simMs={shown.getTime()}
              skin={skins[glass.id]}
              ring={glass.id === "saturn" ? skins["saturn-ring"] : undefined}
              spin={glass.id === "earth" ? spinDeg.toFixed(1) : undefined}
            />
          ) : glass.kind === "facts" ? (
            <FactsGlobe
              planet={places.find((p) => p.id === glass.id) ?? earth}
              skin={skins[glass.id]}
              ring={glass.id === "saturn" ? skins["saturn-ring"] : undefined}
              spin={glass.id === "earth" ? spinDeg.toFixed(1) : undefined}
            />
          ) : (
            <g className="home-sky-world">
              {orbits.map((orbit) => (
                <path key={orbit.id} className="home-sky-orbit" data-planet={orbit.id} d={orbit.d} />
              ))}
              <line className="home-sky-equinox" x1={sunAt.x - 8 * mag} y1={sunAt.y} x2={sunAt.x + 170 * mag} y2={sunAt.y} />
              <g data-zoom-pin="sun" data-planet="sun" data-layout-x={sunAt.x} data-layout-y={sunAt.y} data-r={sunDisk.r.toFixed(2)} data-marked={sunDisk.marked ? "yes" : "no"}>
                <g className="home-sky-hold">
                  <g className="home-sky-glyph">
                    <circle className="home-sky-sun" cx={sunAt.x} cy={sunAt.y} r={sunDisk.r} data-r={sunDisk.r.toFixed(2)} />
                    {sunDisk.marked ? (
                      <circle className="home-sky-marker" cx={sunAt.x} cy={sunAt.y} r={1} />
                    ) : skins.sun ? (
                      <image className="home-sky-photo" href={skins.sun} x={sunAt.x - sunDisk.r} y={sunAt.y - sunDisk.r} width={sunDisk.r * 2} height={sunDisk.r * 2} />
                    ) : (
                      <circle className="home-sky-sun-core" cx={sunAt.x} cy={sunAt.y} r={sunDisk.r * 0.45} />
                    )}
                  </g>
                </g>
              </g>
              {places.map((planet) => {
                const at = project(planet.x, planet.y, planet.z, factor, mag, pan)
                const disk = chartDisks.find((row) => row.id === planet.id) ?? { r: 1, marked: true }
                const ringW = disk.r * SATURN_RING.outer * 2
                const onGlass = at.x > 12 && at.x < VB.w - 12 && at.y > 20 && at.y < VB.h - 16
                const showTag = onGlass && mag >= 0.75 && (planet.au > 4 || mag > 2.2)
                return (
                  <g key={planet.id} className="home-sky-body" data-zoom-pin={planet.id} data-planet={planet.id} data-layout-x={at.x} data-layout-y={at.y} data-x={at.x.toFixed(1)} data-y={at.y.toFixed(1)} data-r={disk.r.toFixed(2)} data-marked={disk.marked ? "yes" : "no"}>
                    <g className="home-sky-hold">
                      <g className="home-sky-glyph">
                        {planet.id === "saturn" && skins["saturn-ring"] && !disk.marked ? (
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
                          r={Math.max(11, disk.r + 4)}
                          role="button"
                          aria-label={`${planet.name} on the chart`}
                          onClick={() => onPlanet(planet.id)}
                        />
                        {picked === planet.id ? (
                          <circle className="home-sky-select" cx={at.x} cy={at.y} r={disk.r + 2.2} />
                        ) : null}
                        <Body
                          name={planet.name}
                          x={at.x}
                          y={at.y}
                          r={disk.r}
                          color={planet.color}
                          skin={disk.marked ? undefined : skins[planet.id]}
                          marker={disk.marked}
                          spin={planet.id === "earth" ? spinDeg.toFixed(1) : undefined}
                        />
                      </g>
                      {showTag ? (
                        <text className="home-sky-tag" x={at.x + Math.max(disk.r, planet.id === "saturn" ? ringW / 2 : disk.r) + 6} y={at.y - 4}>
                          {planet.name}
                        </text>
                      ) : null}
                    </g>
                  </g>
                )
              })}
            </g>
          )}
          {galaxyFrame ? <GalaxySchematic frame="layer" /> : null}
          {!pairFrame && systemFraming ? (
            <text className="home-sky-zero" x={CX + 176} y={CY - 4}>
              0°
            </text>
          ) : null}
          <text className="home-sky-zero" x={12} y={18}>
            {corner}
          </text>
          {active === "galaxy" && glass.kind === "chart" ? (
            <text className="home-sky-zero" x={12} y={34}>
              Milky Way radius · 50,000 ly
            </text>
          ) : null}
        </svg>
        {scaleT != null && tourStop && scaleCaptionFrame(tourStop) ? <ScaleField stop={tourStop} /> : null}
        {scaleT != null && tourStop && !scaleCaptionFrame(tourStop) ? (
          <p className="home-sky-scale-note">
            <ScalePower n={scaleExponent(tourStop)} />
            {tourCaption(tourStop)}
          </p>
        ) : null}
      </div>
      <aside className="home-sky-readout">
        <h3>{title}</h3>
        <div className="home-sky-zoom" role="group" aria-label="Chart zoom">
          {ZOOM_STOPS.map((stop) => (
            <button
              key={stop}
              type="button"
              className={active === stop ? "home-review-key is-on" : "home-review-key"}
              aria-pressed={active === stop}
              aria-label={stop === "earth" ? "Earth zoom" : STOP_LABEL[stop]}
              title={
                stop === "system"
                  ? "Reset chart zoom. Does not change the time rate or the view width."
                  : stopCaption(stop)
              }
              onClick={() => selectStop(stop)}
            >
              {STOP_LABEL[stop]}
            </button>
          ))}
        </div>
        <div className="home-sky-zoom home-sky-scale-key" role="group" aria-label="Powers of ten">
          <button
            type="button"
            className={scaleT != null ? "home-review-key is-on" : "home-review-key"}
            aria-pressed={scaleT != null}
            title="Powers of ten, from a proton to the observable universe. Session only. Does not change the clock, the time rate, or the view width."
            onClick={openScale}
          >
            Scale
          </button>
          {scaleT != null
            ? SCALE_CONTROLS.map((label) => {
                const index = tourPlace(scaleT).index
                const last = tourPlace(1).index
                const pressed = label === "Play" ? scalePlaying : label === "Pause" ? !scalePlaying : false
                const disabled = (label === "Previous" && index === 0) || (label === "Next" && index === last)
                return (
                  <button
                    key={label}
                    type="button"
                    className={pressed ? "home-review-key is-on" : "home-review-key"}
                    aria-pressed={label === "Play" || label === "Pause" ? pressed : undefined}
                    aria-label={label}
                    title={SCALE_CONTROL_TITLE[label]}
                    disabled={disabled}
                    onClick={() => onScaleControl(label)}
                  >
                    {label}
                  </button>
                )
              })
            : null}
        </div>
        <button
          type="button"
          className={trueSizes ? "home-review-key is-on" : "home-review-key"}
          aria-pressed={trueSizes}
          title="Orbits may still be the √r layout. Only the disks are true kilometres."
          onClick={() => setTrueSizes((on) => !on)}
        >
          True sizes
        </button>
        {trueMarked ? <p className="home-sky-zoom-note">true size, marked</p> : null}
        {active === "galaxy" ? <p className="home-sky-zoom-note">Milky Way radius · 50,000 ly</p> : null}
        <div className="home-sky-when" data-held={chosen ? "yes" : "no"}>
          <label htmlFor="sky-chart-date">Date</label>
          <input
            id="sky-chart-date"
            type="datetime-local"
            value={localInputValue(anchor)}
            title="Sets the instant. A faster rate plays forward from here."
            onChange={(event) => {
              const next = dateFromLocalInput(event.target.value)
              if (!next) return
              setChosen(next)
              setSnap((n) => n + 1)
            }}
          />
          <button
            type="button"
            className="home-review-key"
            title="Return to the widget date"
            onClick={() => {
              setChosen(null)
              setFollowMs(date.getTime())
              setSnap((n) => n + 1)
            }}
          >
            Now
          </button>
        </div>
        <p className="home-sky-epoch">
          {formatMajorWhen(shown)}
          {sped ? ` · ${rateLabel}` : ""}
          {reversed && !paused ? " · reverse" : ""}
          {paused ? " · paused" : ""}
        </p>
        {pairFrame ? (
          <EarthCard
            earth={earth}
            phaseLabel={glance.label}
            illuminationPct={Math.round(glance.illumination * 100)}
            cycle={glance.cycle}
            facts={planetFacts("earth")}
          />
        ) : (
          <PlanetCard planet={factPlanet} facts={facts} />
        )}
        <StarIdentifyPanel planetName={factPlanet.name} longitude={factPlanet.longitude} />
        <ul className="home-sky-roster">
          {places.map((planet) => (
            <li key={planet.id}>
              <button
                type="button"
                className={picked === planet.id ? "is-on" : undefined}
                title="Show this orbit. Double-click for the moons."
                onClick={() => onRosterClick(planet)}
                onDoubleClick={(event) => {
                  event.preventDefault()
                  onRosterDouble(planet)
                }}
              >
                <span className="home-sky-bead" style={{ background: planet.color }} />
                {planet.name}
              </button>
              <button
                type="button"
                className={intent?.kind === "facts" && intent.id === planet.id ? "is-facts is-on" : "is-facts"}
                aria-label={`${planet.name} facts`}
                title="Zoom closer so the globe fills the glass."
                onClick={() => zoomFacts(planet)}
              >
                Facts
              </button>
            </li>
          ))}
        </ul>
        <div className="home-sky-progress">
          <p className="home-sky-progress-label">This sky</p>
          <ul aria-label="Sky build">
            {SKY_BUILD.map((item) => (
              <li key={item.id} data-state={item.state} title={"title" in item ? item.title : undefined}>
                {item.label}
              </li>
            ))}
          </ul>
          <p className="home-sky-progress-note">Bright is in. Dim is still ahead.</p>
        </div>
      </aside>
    </div>
    <SkyMotionBar paused={paused} reversed={reversed} onPausedChange={setPaused} onReversedChange={setReversed} />
    </>
  )
}

const MOON_REACH = Math.min(VB.w, VB.h) / 2 - 28

const SCALE_INK = "#e8e4da"

const SCALE_CONTROL_TITLE = {
  Pause: "Pause the tour. The chart clock keeps running.",
  Play: "Play the tour. Does not change the chart clock.",
  Slower: "Twice as long on each decade.",
  Faster: "Half as long on each decade.",
  Previous: "Previous decade.",
  Next: "Next decade.",
} as const

function ScalePower({ n }: { n: number }) {
  return (
    <span className="home-sky-scale-power" aria-label={`10^${n} m`}>
      10<sup aria-hidden="true">{n}</sup> m
    </span>
  )
}

function ScaleField({ stop }: { stop: ScaleStop }) {
  const glyph = scaleGlyph(stop)
  const caption = tourCaption(stop)
  const power = `10^${scaleExponent(stop)} m`
  return (
    <div className="home-sky-scale" role="img" aria-label={`${power}. ${caption}`} data-scale-stop={stop}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        <rect width="100" height="100" fill="#050806" />
        {glyph ? <ScalePicture glyph={glyph} /> : null}
      </svg>
      <p>
        <ScalePower n={scaleExponent(stop)} />
        {caption}
      </p>
    </div>
  )
}

function helixStrand(sign: number): string {
  let d = ""
  for (let i = 0; i <= 36; i++) {
    const t = i / 36
    const y = 16 + t * 68
    const x = 50 + sign * Math.sin(t * Math.PI * 4) * 16
    d += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`
  }
  return d
}

function ScalePicture({ glyph }: { glyph: ScaleGlyph }) {
  const ink = SCALE_INK
  switch (glyph) {
    case "proton":
      return <circle cx="50" cy="50" r="16" fill={ink} />
    case "nucleus":
      return (
        <g fill={ink}>
          {[
            [50, 42],
            [44, 52],
            [56, 52],
            [50, 60],
            [38, 46],
            [62, 46],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="5" />
          ))}
        </g>
      )
    case "nucleus-dense":
      return (
        <g fill={ink}>
          {Array.from({ length: 12 }, (_, i) => {
            const ang = (i / 12) * Math.PI * 2
            const ring = i < 6 ? 8 : 16
            return <circle key={i} cx={50 + Math.cos(ang) * ring} cy={50 + Math.sin(ang) * ring} r="4.2" />
          })}
        </g>
      )
    case "shell":
      return (
        <g fill="none" stroke={ink} strokeWidth="1.6">
          <ellipse cx="50" cy="50" rx="28" ry="16" />
          <circle cx="76" cy="50" r="3.2" fill={ink} stroke="none" />
          <circle cx="50" cy="50" r="3" fill={ink} stroke="none" />
        </g>
      )
    case "electron":
      return <circle cx="50" cy="50" r="22" fill="none" stroke={ink} strokeWidth="1.4" />
    case "atom":
      return (
        <g fill="none" stroke={ink} strokeWidth="1.5">
          <circle cx="50" cy="50" r="26" />
          <circle cx="50" cy="50" r="3.5" fill={ink} stroke="none" />
          <circle cx="74" cy="50" r="3" fill={ink} stroke="none" />
        </g>
      )
    case "molecule":
      return (
        <g fill={ink}>
          <circle cx="46" cy="54" r="14" />
          <circle cx="64" cy="38" r="8" />
          <circle cx="68" cy="64" r="8" />
        </g>
      )
    case "helix":
      return (
        <g fill="none" stroke={ink} strokeWidth="1.8" strokeLinecap="round">
          <path d={helixStrand(1)} />
          <path d={helixStrand(-1)} />
          {[0.2, 0.4, 0.6, 0.8].map((t) => (
            <line key={t} x1={50 - 16} y1={16 + t * 68} x2={50 + 16} y2={16 + t * 68} strokeWidth="1.2" />
          ))}
        </g>
      )
    case "virus":
      return (
        <g fill={ink}>
          <circle cx="50" cy="50" r="16" />
          {Array.from({ length: 10 }, (_, i) => {
            const ang = (i / 10) * Math.PI * 2
            return <circle key={i} cx={50 + Math.cos(ang) * 24} cy={50 + Math.sin(ang) * 24} r="3.2" />
          })}
        </g>
      )
    case "bacterium":
      return <ellipse cx="50" cy="50" rx="30" ry="16" fill={ink} />
    case "cell":
      return (
        <g>
          <circle cx="50" cy="50" r="30" fill="none" stroke={ink} strokeWidth="2" />
          <circle cx="54" cy="48" r="10" fill={ink} />
        </g>
      )
    case "hair":
      return <rect x="46" y="10" width="8" height="80" rx="4" fill={ink} />
    case "sand":
      return <path d="M38 58c2-16 10-22 20-18 8 2 14 8 12 18-2 10-12 16-22 12-8-2-12-6-10-12z" fill={ink} />
    case "ant":
      return (
        <g fill={ink} stroke={ink} strokeWidth="1.3" strokeLinecap="round">
          <ellipse cx="38" cy="52" rx="8" ry="6" />
          <ellipse cx="52" cy="50" rx="6" ry="5" />
          <circle cx="64" cy="48" r="4.5" />
          <path d="M46 46 L38 34 M52 44 L58 32 M40 56 L30 68 M48 56 L44 70 M56 54 L64 66" fill="none" />
        </g>
      )
    case "dollar":
      return (
        <g fill="none" stroke={ink} strokeWidth="1.7">
          <circle cx="50" cy="50" r="28" />
          <circle cx="50" cy="50" r="5" fill={ink} stroke="none" />
          {[0, 72, 144, 216, 288].map((deg) => {
            const rad = (deg * Math.PI) / 180
            return <line key={deg} x1="50" y1="50" x2={50 + Math.sin(rad) * 20} y2={50 - Math.cos(rad) * 20} />
          })}
        </g>
      )
    case "mouse":
      return (
        <g fill={ink}>
          <path d="M28 62 C14 76 8 54 24 56" fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />
          <ellipse cx="46" cy="58" rx="20" ry="11" />
          <circle cx="66" cy="52" r="8" />
          <circle cx="72" cy="42" r="5.5" />
          <circle cx="70" cy="41" r="1.4" fill="#050806" />
        </g>
      )
    case "person":
      return (
        <g fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round">
          <circle cx="50" cy="24" r="7" fill={ink} stroke="none" />
          <path d="M50 32 L50 62 M34 44 L66 44 M50 62 L38 84 M50 62 L62 84" />
        </g>
      )
    case "gull":
      return (
        <g fill={ink}>
          <path d="M14 60c16-8 30-8 42 0 6-16 20-30 36-36 1 7-8 16-16 20 12-1 22 3 26 8-14 3-26 8-36 16-16 8-34 6-52-8z" />
          <path d="M78 44c8-1 14 0 16 3-8 1-13 2-16 5z" />
          <path d="M48 74c1 7 0 11-2 13M56 74c1 7 0 11-2 13" fill="none" stroke={ink} strokeWidth="1.5" />
        </g>
      )
    case "park":
      return (
        <g fill={ink}>
          <rect x="18" y="78" width="64" height="2" />
          <rect x="32" y="58" width="3" height="20" />
          <circle cx="33" cy="50" r="12" />
          <rect x="62" y="52" width="3" height="26" />
          <circle cx="63" cy="44" r="14" />
        </g>
      )
    case "blocks":
      return (
        <g fill={ink}>
          <rect x="16" y="58" width="14" height="22" />
          <rect x="32" y="46" width="16" height="34" />
          <rect x="50" y="54" width="12" height="26" />
          <rect x="64" y="40" width="18" height="40" />
        </g>
      )
    case "skyline":
      return (
        <g fill={ink}>
          <rect x="10" y="48" width="10" height="34" />
          <rect x="22" y="28" width="12" height="54" />
          <rect x="36" y="40" width="14" height="42" />
          <rect x="52" y="22" width="8" height="60" />
          <rect x="62" y="36" width="16" height="46" />
          <rect x="80" y="50" width="10" height="32" />
        </g>
      )
    case "span":
      return (
        <g fill="none" stroke={ink} strokeWidth="1.8" strokeLinecap="round">
          <line x1="16" y1="58" x2="84" y2="58" />
          <circle cx="18" cy="58" r="4" fill={ink} stroke="none" />
          <circle cx="82" cy="58" r="4" fill={ink} stroke="none" />
        </g>
      )
    case "moon":
      return (
        <g>
          <circle cx="50" cy="50" r="28" fill="#c8c2b4" />
          <circle cx="40" cy="42" r="5" fill="#b3ab9c" />
          <circle cx="58" cy="56" r="3.4" fill="#b3ab9c" />
          <circle cx="46" cy="60" r="2.2" fill="#b3ab9c" />
        </g>
      )
    case "earth":
      return (
        <g>
          <circle cx="50" cy="50" r="28" fill="#7ec8e3" />
          <path d="M34 42c8-8 18-6 24 2 4 6 2 12-4 16-8 4-16 2-20-6-2-6-2-8 0-12z" fill="#3f7d58" />
          <path d="M58 58c6 2 10 8 6 12-6 2-12-2-12-8 0-2 2-4 6-4z" fill="#3f7d58" />
        </g>
      )
    case "andromeda":
      return (
        <g>
          <ellipse cx="50" cy="50" rx="36" ry="10" transform="rotate(-24 50 50)" fill="#d5efe4" opacity="0.85" />
          <circle cx="50" cy="50" r="6" fill="#f4fff8" />
        </g>
      )
    case "group":
      return (
        <g fill="#d5efe4">
          <ellipse cx="36" cy="54" rx="16" ry="6" transform="rotate(-18 36 54)" />
          <ellipse cx="62" cy="46" rx="18" ry="7" transform="rotate(16 62 46)" />
          <ellipse cx="54" cy="64" rx="8" ry="3" />
        </g>
      )
    case "cluster":
      return (
        <g fill={ink}>
          {Array.from({ length: 18 }, (_, i) => {
            const ang = i * 2.4
            const rad = 8 + (i % 5) * 4
            return <circle key={i} cx={50 + Math.cos(ang) * rad} cy={50 + Math.sin(ang) * rad * 0.72} r={i % 4 === 0 ? 2.4 : 1.5} />
          })}
        </g>
      )
    case "wall":
      return (
        <g fill={ink}>
          {Array.from({ length: 22 }, (_, i) => (
            <circle key={i} cx={8 + i * 4} cy={46 + Math.sin(i * 0.9) * 10} r={i % 3 === 0 ? 2 : 1.3} />
          ))}
        </g>
      )
    case "cosmos":
      return (
        <g fill={ink}>
          <circle cx="50" cy="50" r="34" fill="none" stroke={ink} strokeWidth="1.2" />
          {Array.from({ length: 24 }, (_, i) => {
            const ang = i * 1.7
            const rad = 6 + (i % 7) * 3.6
            return <circle key={i} cx={50 + Math.cos(ang) * rad} cy={50 + Math.sin(ang) * rad} r={i % 5 === 0 ? 1.8 : 1} />
          })}
        </g>
      )
    default:
      return null
  }
}

/** Moon close-up. Orbits are orbitKm / planet radius. Mercury and Venus are the globe alone. */
function MoonSystem({
  planet,
  simMs,
  skin,
  ring,
  spin,
}: {
  planet: PlanetPlace
  simMs: number
  skin?: string
  ring?: string
  spin?: string
}) {
  const moons = moonsOf(planet.id)
  const radiusKm = BODY_RADIUS_KM[planet.id]
  const globeOnly = moons.length === 0
  const outerKm = globeOnly ? radiusKm : Math.max(...moons.map((moon) => moon.orbitKm))
  const planetR = globeOnly ? Math.min(VB.w, VB.h) * 0.22 : MOON_REACH * (radiusKm / outerKm)
  const ringW = planetR * SATURN_RING.outer * 2
  return (
    <g className="home-sky-world" data-moons={planet.id}>
      {moons.map((moon) => {
        const orbitR = planetR * (moon.orbitKm / radiusKm)
        const ang = moonAngle(moon.periodDays, simMs, moon.retrograde)
        const x = CX + Math.cos(ang) * orbitR
        const y = CY + Math.sin(ang) * orbitR
        const trueR = planetR * (moon.radiusKm / radiusKm)
        const drawn = Math.max(trueR, 1.25)
        return (
          <g key={moon.id} data-moon={moon.id}>
            <circle className="home-sky-moon-orbit" cx={CX} cy={CY} r={orbitR} />
            <circle className="home-sky-disk" cx={x} cy={y} r={drawn} fill="#c8c2b4" data-true-r={trueR.toFixed(3)} />
            <text className="home-sky-tag" x={x + drawn + 4} y={y - 2}>
              {moon.name}
            </text>
          </g>
        )
      })}
      {ring ? (
        <image
          className="home-sky-photo"
          href={ring}
          x={CX - ringW / 2}
          y={CY - (ringW * RING_ASPECT) / 2}
          width={ringW}
          height={ringW * RING_ASPECT}
        />
      ) : null}
      <Body name={planet.name} x={CX} y={CY} r={planetR} color={planet.color} skin={skin} spin={spin} label />
    </g>
  )
}

/** Facts zoom. The globe fills the glass. */
function FactsGlobe({
  planet,
  skin,
  ring,
  spin,
}: {
  planet: PlanetPlace
  skin?: string
  ring?: string
  spin?: string
}) {
  const r = Math.min(VB.w, VB.h) * 0.42
  const ringW = r * SATURN_RING.outer * 2
  return (
    <g className="home-sky-world" data-facts={planet.id} data-globe={r.toFixed(1)}>
      {ring ? (
        <image
          className="home-sky-photo"
          href={ring}
          x={CX - ringW / 2}
          y={CY - (ringW * RING_ASPECT) / 2}
          width={ringW}
          height={ringW * RING_ASPECT}
        />
      ) : null}
      <Body name={planet.name} x={CX} y={CY} r={r} color={planet.color} skin={skin} spin={spin} label />
    </g>
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
  marker = false,
  spin,
}: {
  name: string
  x: number
  y: number
  r: number
  color: string
  skin?: string
  label?: boolean
  marker?: boolean
  /** Earth texture longitude, degrees. Other bodies omit it. */
  spin?: string
}) {
  return (
    <>
      {skin ? (
        <image className="home-sky-photo" href={skin} x={x - r} y={y - r} width={r * 2} height={r * 2} data-earth-spin={spin} />
      ) : (
        <circle className="home-sky-disk" cx={x} cy={y} r={Math.max(r, 0.6)} fill={color} data-earth-spin={spin} />
      )}
      {marker ? <circle className="home-sky-marker" cx={x} cy={y} r={1} /> : null}
      {label ? (
        <text className="home-sky-tag" x={x} y={y + r + 11} textAnchor="middle">
          {name}
        </text>
      ) : null}
    </>
  )
}

function FactLines({ lines }: { lines: string[] }) {
  return (
    <>
      {lines.map((line) => (
        <p key={line} className="home-sky-zoom-note">
          {line}
        </p>
      ))}
    </>
  )
}

function PlanetCard({ planet, facts }: { planet: PlanetPlace; facts: { title: string; lines: string[] } | null }) {
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
      {facts ? <FactLines lines={facts.lines} /> : null}
    </div>
  )
}

function EarthCard({
  earth,
  phaseLabel,
  illuminationPct,
  cycle,
  facts,
}: {
  earth: PlanetPlace
  phaseLabel: string
  illuminationPct: number
  cycle: number
  facts: { title: string; lines: string[] }
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
          <dt>lat</dt>
          <dd>{formatDeg(earth.latitude)}</dd>
        </div>
        <div>
          <dt>r</dt>
          <dd>{formatAu(earth.au)}</dd>
        </div>
        <div>
          <dt>from</dt>
          <dd>here</dd>
        </div>
      </dl>
      <FactLines lines={facts.lines} />
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
