/**
 * lib/chrome-patina.ts — One cool gunmetal for every chrome face
 *
 * Classic Win95 `#c0c0c0` is the default set-point. The live face drifts a few
 * RGB units around that set-point on a minutes-scale sine — living metal, not
 * a hue walk. Channels stay equal (chroma 0) so the gray can never go brown.
 *
 * CSS writes `--chrome-face` / `--chrome-hi` / `--chrome-mid` / `--chrome-lo`
 * on `:root`; `app/win95.css` aliases `--w95-*` to those tokens.
 */

export const CHROME_FACE_CLASSIC = 192
export const CHROME_FACE_MIN = 168
export const CHROME_FACE_MAX = 216
export const CHROME_FACE_DEFAULT_SETPOINT = 50

/** Full sine of the live metal, in milliseconds. */
export const CHROME_DRIFT_PERIOD_MS = 24 * 60 * 1000
/** Recalc often enough for the ghost tick to crawl, not flicker. */
export const CHROME_PATINA_TICK_MS = 60 * 1000
/** Peak offset from the set-point, in 8-bit gray units. */
export const CHROME_DRIFT_AMPLITUDE = 5

/** Bevel deltas sampled from classic `app/win95.css` (`#c0c0c0` family). */
const MID_DELTA = 31
const LO_DELTA = 64
const BRUSH_T = 0.35

/** @deprecated Use CHROME_DRIFT_PERIOD_MS. Kept so old imports do not explode. */
export const CHROME_PATINA_PERIOD_MS = CHROME_DRIFT_PERIOD_MS

export const CHROME_COOL = {
  face: "#c0c0c0",
  mid: "#dfdfdf",
  hi: "#ffffff",
  lo: "#808080",
  frame: "#0a0a0a",
} as const

export const CHROME_INK = "#000000"

export type ChromePatinaTokens = {
  "--chrome-set": string
  "--chrome-live": string
  "--chrome-mix": string
  "--chrome-face": string
  "--chrome-mid": string
  "--chrome-hi": string
  "--chrome-lo": string
  "--chrome-frame": string
  "--chrome-brush": string
}

export function clampChromeFaceSetpoint(value: number): number {
  if (!Number.isFinite(value)) return CHROME_FACE_DEFAULT_SETPOINT
  return Math.min(100, Math.max(0, value))
}

export function chromeFaceLevelFromSetpoint(setpoint: number): number {
  const t = clampChromeFaceSetpoint(setpoint) / 100
  return CHROME_FACE_MIN + (CHROME_FACE_MAX - CHROME_FACE_MIN) * t
}

export function chromePatinaDrift(nowMs: number, periodMs: number = CHROME_DRIFT_PERIOD_MS): number {
  const period = periodMs > 0 ? periodMs : CHROME_DRIFT_PERIOD_MS
  const phase = (((nowMs % period) + period) % period) / period
  return Math.sin(2 * Math.PI * phase)
}

export function chromeFaceDisplayedLevel(
  setpoint: number,
  nowMs: number,
  periodMs: number = CHROME_DRIFT_PERIOD_MS,
): number {
  const level = chromeFaceLevelFromSetpoint(setpoint) + CHROME_DRIFT_AMPLITUDE * chromePatinaDrift(nowMs, periodMs)
  return Math.min(CHROME_FACE_MAX + CHROME_DRIFT_AMPLITUDE, Math.max(CHROME_FACE_MIN - CHROME_DRIFT_AMPLITUDE, level))
}

export function chromeLevelToPercent(level: number): number {
  const span = CHROME_FACE_MAX - CHROME_FACE_MIN
  if (span <= 0) return CHROME_FACE_DEFAULT_SETPOINT
  return ((level - CHROME_FACE_MIN) / span) * 100
}

export function grayHex(level: number): string {
  const n = Math.round(Math.min(255, Math.max(0, level)))
  return hexFromRgb(n, n, n)
}

export function mixChromeHex(a: string, b: string, t: number): string {
  const u = clamp01(t)
  const [ar, ag, ab] = parseHex(a)
  const [br, bg, bb] = parseHex(b)
  return hexFromRgb(ar + (br - ar) * u, ag + (bg - ag) * u, ab + (bb - ab) * u)
}

export function chromaSpan(hex: string): number {
  const [r, g, b] = parseHex(hex)
  return Math.max(r, g, b) - Math.min(r, g, b)
}

/** Warm / brown: red pulls ahead of blue (or green). Cool-or-neutral gray never does. */
export function isBrownish(hex: string): boolean {
  const [r, g, b] = parseHex(hex)
  return r - b > 2 || r - g > 2
}

export function chromePatinaTokens(
  setpoint: number = CHROME_FACE_DEFAULT_SETPOINT,
  nowMs: number = 0,
  periodMs: number = CHROME_DRIFT_PERIOD_MS,
): ChromePatinaTokens {
  const set = clampChromeFaceSetpoint(setpoint)
  const live = chromeFaceDisplayedLevel(set, nowMs, periodMs)
  const face = grayHex(live)
  const mid = grayHex(live + MID_DELTA)
  const lo = grayHex(live - LO_DELTA)
  const brush = mixChromeHex(face, lo, BRUSH_T)
  const drift = chromePatinaDrift(nowMs, periodMs)
  return {
    "--chrome-set": set.toFixed(1),
    "--chrome-live": chromeLevelToPercent(live).toFixed(1),
    "--chrome-mix": drift.toFixed(4),
    "--chrome-face": face,
    "--chrome-mid": mid,
    "--chrome-hi": CHROME_COOL.hi,
    "--chrome-lo": lo,
    "--chrome-frame": CHROME_COOL.frame,
    "--chrome-brush": brush,
  }
}

export function applyChromePatina(
  el: { style: { setProperty: (name: string, value: string) => void } } | Pick<CSSStyleDeclaration, never>,
  setpoint: number = CHROME_FACE_DEFAULT_SETPOINT,
  nowMs: number = Date.now(),
  periodMs: number = CHROME_DRIFT_PERIOD_MS,
): ChromePatinaTokens {
  const tokens = chromePatinaTokens(setpoint, nowMs, periodMs)
  const style = "style" in el ? el.style : null
  if (style) {
    for (const [name, value] of Object.entries(tokens)) {
      style.setProperty(name, value)
    }
  }
  return tokens
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

function clamp01(t: number): number {
  if (!Number.isFinite(t)) return 0
  return Math.min(1, Math.max(0, t))
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim()
  if (h.length !== 6) return [CHROME_FACE_CLASSIC, CHROME_FACE_CLASSIC, CHROME_FACE_CLASSIC]
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function hexFromRgb(r: number, g: number, b: number): string {
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`
}

function toByte(n: number): string {
  return Math.round(Math.min(255, Math.max(0, n)))
    .toString(16)
    .padStart(2, "0")
}

function srgbToLinear(channel: number): number {
  const x = channel / 255
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex)
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}
