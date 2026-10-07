/**
 * lib/sky-motion.ts — On-screen speed of familiar motions
 *
 * A 1,000 px view that is `W` kilometres across, played at `M` seconds of
 * universe time per real second. Pixels per second are `v * M / W * 1000`.
 * The same scale the Moon detail uses to say what would be frozen, barely
 * moving, visibly moving, or too fast to follow.
 */

export const VIEW_PX = 1000
export const LIGHT_SPEED_KM_S = 299792

export const VIEW_WIDTH_LOG_MIN = 3
export const VIEW_WIDTH_LOG_MAX = 10
export const VIEW_WIDTH_LOG_STEP = 0.05
export const DEFAULT_VIEW_WIDTH_LOG = 3.5
export const DEFAULT_RATE_INDEX = 0

export type MotionKind = "frozen" | "barely" | "visible" | "fast"

export type MotionObject = {
  id: string
  name: string
  kmPerSec: number
  color: string
}

/** Slowest to fastest. Speeds are the reference set for the Moon chart. */
export const MOTION_OBJECTS: readonly MotionObject[] = [
  { id: "equator", name: "Point on Earth equator", kmPerSec: 0.465, color: "#888780" },
  { id: "moon", name: "Moon around Earth", kmPerSec: 1.022, color: "#888780" },
  { id: "neptune", name: "Neptune around Sun", kmPerSec: 5.43, color: "#378ADD" },
  { id: "iss", name: "ISS around Earth", kmPerSec: 7.66, color: "#7F77DD" },
  { id: "jupiter", name: "Jupiter around Sun", kmPerSec: 13.06, color: "#D85A30" },
  { id: "voyager", name: "Voyager 1 vs Sun", kmPerSec: 16.9, color: "#1D9E75" },
  { id: "earth", name: "Earth around Sun", kmPerSec: 29.78, color: "#378ADD" },
  { id: "light", name: "Light", kmPerSec: LIGHT_SPEED_KM_S, color: "#BA7517" },
]

/** Universe seconds that pass during one real second, and the label. */
export const TIME_RATES: readonly { seconds: number; label: string }[] = [
  { seconds: 1, label: "real time" },
  { seconds: 60, label: "1 min per second" },
  { seconds: 3600, label: "1 hour per second" },
  { seconds: 86400, label: "1 day per second" },
  { seconds: 604800, label: "1 week per second" },
  { seconds: 2629800, label: "1 month per second" },
  { seconds: 31557600, label: "1 year per second" },
]

const SCALE_REFS: readonly { km: number; label: string }[] = [
  { km: 12742, label: "Earth diameter" },
  { km: 384400, label: "Earth-Moon distance" },
  { km: 1392700, label: "Sun diameter" },
  { km: 1.496e8, label: "1 AU" },
  { km: 7.785e8, label: "Jupiter orbit radius" },
  { km: 4.5e9, label: "Neptune orbit radius" },
]

export const MOTION_LABEL: Record<MotionKind, string> = {
  frozen: "frozen",
  barely: "barely moving",
  visible: "visible motion",
  fast: "too fast to follow",
}

export function clampViewWidthLog(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_VIEW_WIDTH_LOG
  const steps = Math.round(n / VIEW_WIDTH_LOG_STEP)
  const snapped = Math.round(steps * VIEW_WIDTH_LOG_STEP * 100) / 100
  return Math.min(VIEW_WIDTH_LOG_MAX, Math.max(VIEW_WIDTH_LOG_MIN, snapped))
}

export function clampRateIndex(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_RATE_INDEX
  return Math.min(TIME_RATES.length - 1, Math.max(0, Math.round(n)))
}

export function viewWidthKm(log10Km: number): number {
  return 10 ** clampViewWidthLog(log10Km)
}

export function timeRateAt(index: number): { seconds: number; label: string } {
  return TIME_RATES[clampRateIndex(index)]!
}

/** Universe milliseconds advanced by `dtRealSec` of wall clock. A stalled frame counts as 0.1 s. */
export function advanceSimMillis(prevMs: number, dtRealSec: number, multiplier: number): number {
  const dt = Math.min(Math.max(dtRealSec, 0), 0.1)
  const rate = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1
  return prevMs + dt * rate * 1000
}

/** Mean sidereal day. Earth texture longitude advances one turn per this many simulated seconds. */
export const SIDEREAL_DAY_SEC = 86164.0905

/**
 * Earth texture longitude at a simulation instant, degrees in `[0, 360)`.
 * One full turn per sidereal day. A later instant is a larger angle until it wraps.
 * Other planets are not spun here.
 */
export function earthSpinDegrees(simMs: number): number {
  if (!Number.isFinite(simMs)) return 0
  const deg = ((simMs / 1000 / SIDEREAL_DAY_SEC) * 360) % 360
  return deg < 0 ? deg + 360 : deg
}

/** Running chart instant. `shownMs = anchorMs + elapsed × M × direction`. Not persisted. */
export type ChartClock = {
  anchorMs: number
  shownMs: number
}

export function chartClockAt(anchorMs: number): ChartClock {
  return { anchorMs, shownMs: anchorMs }
}

export function sameLocalDay(aMs: number, bMs: number): boolean {
  const a = new Date(aMs)
  const b = new Date(bMs)
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/**
 * Widget instant while the chart is still following that date.
 * A later clock time on the same local day leaves the anchor alone.
 * A new local day is a new anchor.
 */
export function chartAnchorAfterWidget(
  anchorMs: number,
  widgetMs: number,
  following: boolean,
): { anchorMs: number; restarted: boolean } {
  if (!following || sameLocalDay(anchorMs, widgetMs)) return { anchorMs, restarted: false }
  return { anchorMs: widgetMs, restarted: true }
}

/**
 * One frame of the chart clock.
 * `restartAnchorMs` is Now, a Date edit, a new widget day, or reset-rate:
 * elapsed returns to zero at that anchor. Omit it and elapsed keeps accumulating.
 * `paused` holds the shown instant. Real time forward (`multiplier` ≤ 1 and
 * direction +1) shows the anchor. Direction −1 runs that same elapsed backward
 * and is not persisted. Pause freezes either direction and does not zero elapsed.
 */
export function stepChartClock(
  clock: ChartClock,
  frame: {
    dtRealSec: number
    multiplier: number
    restartAnchorMs?: number
    paused?: boolean
    /** +1 plays forward. −1 plays the same rate backward. Omitted is forward. */
    direction?: 1 | -1
  },
): ChartClock {
  const restarted = frame.restartAnchorMs !== undefined
  const anchorMs = restarted ? frame.restartAnchorMs! : clock.anchorMs
  const shownMs = restarted ? anchorMs : clock.shownMs
  if (frame.paused) return { anchorMs, shownMs }
  const direction = frame.direction === -1 ? -1 : 1
  if (direction > 0 && !(frame.multiplier > 1)) return { anchorMs, shownMs: anchorMs }
  const rate = frame.multiplier > 1 ? frame.multiplier : 1
  const forward = advanceSimMillis(shownMs, frame.dtRealSec, rate)
  return { anchorMs, shownMs: shownMs + direction * (forward - shownMs) }
}

export function formatViewWidth(km: number): string {
  if (km < 1e6) return `${Math.round(km).toLocaleString("en-US")} km`
  if (km < 1e9) return `${(km / 1e6).toFixed(1)} million km`
  return `${(km / 1e9).toFixed(1)} billion km`
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)} s`
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} min`
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} h`
  return `${(seconds / 86400).toFixed(1)} days`
}

export function formatKmPerSec(kmPerSec: number): string {
  if (kmPerSec > 1000) return `${Math.round(kmPerSec).toLocaleString("en-US")} km/s`
  return `${kmPerSec} km/s`
}

export function formatPixelsPerSecond(px: number): string {
  if (px >= 100) return `${Math.round(px).toLocaleString("en-US")} px/s`
  if (px >= 1) return `${px.toFixed(1)} px/s`
  return `${px.toPrecision(2)} px/s`
}

/** Closest familiar length, by log distance, for the current view width. */
export function scaleComparison(widthKm: number): string {
  let best = SCALE_REFS[0]!
  let bestDist = Infinity
  for (const ref of SCALE_REFS) {
    const d = Math.abs(Math.log10(widthKm / ref.km))
    if (d < bestDist) {
      bestDist = d
      best = ref
    }
  }
  const ratio = widthKm / best.km
  const ratioText = ratio < 10 ? ratio.toFixed(1) : Math.round(ratio).toLocaleString("en-US")
  return `About ${ratioText} x ${best.label}`
}

export function lightCrossing(widthKm: number): string {
  return `Light crosses this in ${formatDuration(widthKm / LIGHT_SPEED_KM_S)}`
}

/** Pixels per real second on a 1,000 px view that spans `widthKm`. */
export function pixelsPerSecond(kmPerSec: number, multiplier: number, widthKm: number): number {
  if (!(widthKm > 0)) return 0
  return (kmPerSec * multiplier * VIEW_PX) / widthKm
}

export function motionKind(pxPerSec: number): MotionKind {
  if (pxPerSec < 0.05) return "frozen"
  if (pxPerSec < 1) return "barely"
  if (pxPerSec < 600) return "visible"
  return "fast"
}

export function motionSummary(visible: number, total: number): string {
  return `${visible} of ${total} objects show visible motion on a 1,000 px wide view at this zoom and rate.`
}

export type MotionRow = {
  id: string
  name: string
  kmPerSec: number
  color: string
  speedLabel: string
  pxPerSec: number
  pxLabel: string
  kind: MotionKind
  motionLabel: string
  /** Fraction of the view width this object crosses per real second. */
  fractionPerSec: number
}

export type MotionReadout = {
  viewWidthKm: number
  viewWidthLabel: string
  rateIndex: number
  multiplier: number
  rateLabel: string
  scaleLabel: string
  lightLabel: string
  rows: MotionRow[]
  visibleCount: number
  summary: string
}

export function motionReadout(viewWidthLog: number, rateIndex: number): MotionReadout {
  const width = viewWidthKm(viewWidthLog)
  const rate = timeRateAt(rateIndex)
  const rows = MOTION_OBJECTS.map((object) => {
    const pxPerSec = pixelsPerSecond(object.kmPerSec, rate.seconds, width)
    const kind = motionKind(pxPerSec)
    return {
      id: object.id,
      name: object.name,
      kmPerSec: object.kmPerSec,
      color: object.color,
      speedLabel: formatKmPerSec(object.kmPerSec),
      pxPerSec,
      pxLabel: formatPixelsPerSecond(pxPerSec),
      kind,
      motionLabel: MOTION_LABEL[kind],
      fractionPerSec: width > 0 ? (object.kmPerSec * rate.seconds) / width : 0,
    }
  })
  const visibleCount = rows.filter((row) => row.kind === "visible").length
  return {
    viewWidthKm: width,
    viewWidthLabel: formatViewWidth(width),
    rateIndex: clampRateIndex(rateIndex),
    multiplier: rate.seconds,
    rateLabel: rate.label,
    scaleLabel: scaleComparison(width),
    lightLabel: lightCrossing(width),
    rows,
    visibleCount,
    summary: motionSummary(visibleCount, rows.length),
  }
}
