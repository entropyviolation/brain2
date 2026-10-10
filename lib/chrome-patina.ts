/**
 * lib/chrome-patina.ts — One gunmetal for every chrome face
 *
 * Warmth walks specific computer-chrome grays from the design refs.
 * Piecewise, knot to knot. It is not a red/blue filter on an arbitrary gray.
 *
 * Mix 50 is the named preset `default`: the `--chrome-*` colors measured in
 * `app/win95.css` before this path replaced the old warmth endpoints.
 * **Default** in Settings writes that palette back and pauses.
 *
 * | Mix | Face | Where |
 * |----:|------|-------|
 * | 0 | `#999683` | IRIX cattle `designrefs/designref1.jpg` |
 * | 8 | `#999686` | Warmer olive on that walk |
 * | 16 | `#9a9889` | TENO `designrefs/5d58e7b46cf9bd493eb09f761340fb17.jpg` |
 * | 32 | `#c0c1b9` | Pocket PC `designrefs/36bc1715c629f42e163d54abe8741ac6.jpg` |
 * | 40 | `#c0bfba` | Pocket PC and Tek 465B |
 * | 50 | `#c0c0c0` | Display Properties, Win95, and the stored default |
 * | 75 | `#b7bcbf` | Cooler silver, flower-CRT / gadget-wall family |
 * | 100 | `#b8bbc0` | Flower CRTs `designrefs/9d225800a3f631bc7559c83d11f1aaa2.jpg` |
 *
 * Sheen, shadow, and highlight at a knot are companions sampled beside that
 * gray (same-hue ladder in the still). Between knots each token interpolates
 * from one of those palettes to the next. Ink stays the stored `#404040` /
 * `#3a3a3a`. Drift timing lives in `lib/drift-clock.ts`.
 */

export const CHROME_FACE_CLASSIC = 192
export const CHROME_FACE_DEFAULT_SETPOINT = 50
export const DEFAULT_CHROME_PRESET = "default" as const

/** @deprecated Lightness band is gone. Warmth is 0–100 around classic 50. */
export const CHROME_FACE_MIN = 0
/** @deprecated Lightness band is gone. Warmth is 0–100 around classic 50. */
export const CHROME_FACE_MAX = 100

/**
 * Classic bevel names. These are the stored default at mix 50
 * (`#c0c0c0` and its companions), captured from `app/win95.css`.
 */
export const CHROME_COOL = {
  face: "#c0c0c0",
  mid: "#dfdfdf",
  hi: "#ffffff",
  lo: "#808080",
  frame: "#0a0a0a",
  brush: "#acacac",
} as const

export const CHROME_INK = "#000000"

/**
 * Fascia stops measured from `app/win95.css` at the classic face.
 * Mix 50 writes these bytes back. They are the default companions of
 * `#c0c0c0`, not a warmth pole.
 */
export const CHROME_NEUTRAL_STOPS = {
  "--chrome-sheen": [212, 216, 220], // #d4d8dc
  "--chrome-shade": [150, 154, 158], // #969a9e
  "--chrome-key-sheen": [236, 238, 240], // #eceef0
  "--chrome-key-mid": [212, 214, 216], // #d4d6d8
  "--chrome-key-shade": [154, 158, 162], // #9a9ea2
  "--chrome-inset": [176, 180, 184], // #b0b4b8
  "--chrome-ring": [92, 96, 100], // #5c6064
  "--chrome-ring-deep": [74, 78, 82], // #4a4e52
  "--chrome-lip": [106, 110, 114], // #6a6e72
  "--chrome-pressed": [58, 62, 66], // #3a3e42
  "--chrome-mill-hi": [216, 220, 224], // #d8dce0
  "--chrome-mill-soft": [192, 196, 200], // #c0c4c8
  "--chrome-grade-sheen": [196, 200, 204], // #c4c8cc
  "--chrome-foot": [164, 168, 172], // #a4a8ac
  "--chrome-stone": [168, 172, 176], // #a8acb0
  "--chrome-mist": [238, 240, 242], // #eef0f2
  "--chrome-haze": [208, 212, 216], // #d0d4d8
  "--chrome-paper": [244, 246, 248], // #f4f6f8
  "--chrome-pewter": [200, 204, 208], // #c8ccd0
  "--chrome-ash": [184, 188, 191], // #b8bcbf
  "--chrome-cloud": [240, 242, 244], // #f0f2f4
  "--chrome-pearl": [228, 230, 232], // #e4e6e8
  "--chrome-tin": [200, 202, 205], // #c8cacd
  "--chrome-fog": [244, 245, 246], // #f4f5f6
  "--chrome-slate": [138, 142, 146], // #8a8e92
  "--chrome-slate-dim": [132, 136, 140], // #84888c
  "--chrome-nickel": [180, 184, 188], // #b4b8bc
  "--chrome-mist-2": [232, 234, 236], // #e8eaec
  "--chrome-pearl-2": [228, 231, 234], // #e4e7ea
  "--chrome-ash-2": [184, 188, 190], // #b8bcbe
  "--chrome-ice": [228, 234, 242], // #e4eaf2
  "--chrome-blue-stone": [154, 164, 178], // #9aa4b2
  "--chrome-blue-shade": [138, 144, 153], // #8a9099
  "--chrome-ink-soft": [64, 64, 64], // #404040
  "--chrome-ink-deep": [58, 58, 58], // #3a3a3a
} as const

export type ChromeStopToken = keyof typeof CHROME_NEUTRAL_STOPS

export type ChromeColorTokens = {
  "--chrome-face": string
  "--chrome-mid": string
  "--chrome-hi": string
  "--chrome-lo": string
  "--chrome-frame": string
  "--chrome-brush": string
} & Record<ChromeStopToken, string>

function stopHex(rgb: readonly number[]): string {
  return `#${rgb.map((n) => n.toString(16).padStart(2, "0")).join("")}`
}

/** Stored classic palette. Mix 50 and Default write these strings. */
export const DEFAULT_CHROME_TOKENS: ChromeColorTokens = {
  "--chrome-face": CHROME_COOL.face,
  "--chrome-mid": CHROME_COOL.mid,
  "--chrome-hi": CHROME_COOL.hi,
  "--chrome-lo": CHROME_COOL.lo,
  "--chrome-frame": CHROME_COOL.frame,
  "--chrome-brush": CHROME_COOL.brush,
  ...(Object.fromEntries(
    Object.entries(CHROME_NEUTRAL_STOPS).map(([name, rgb]) => [name, stopHex(rgb)]),
  ) as Record<ChromeStopToken, string>),
}

export type ChromeFaceSwatch = {
  mix: number
  face: string
  /** Still (or stylesheet) the face hex was taken from. */
  source: string
  tokens: ChromeColorTokens
}

const DESIGN_REF_SWATCHES: readonly ChromeFaceSwatch[] = [
  {
    mix: 0,
    face: "#999683",
    source: "IRIX cattle designrefs/designref1.jpg",
    tokens: {
      "--chrome-face": "#999683",
      "--chrome-mid": "#b9b6a3",
      "--chrome-hi": "#c6c3b0",
      "--chrome-lo": "#494633",
      "--chrome-frame": "#1c1d18",
      "--chrome-brush": "#828071",
      "--chrome-sheen": "#b9b6a3",
      "--chrome-shade": "#5c5948",
      "--chrome-key-sheen": "#b9b6a3",
      "--chrome-key-mid": "#b9b6a3",
      "--chrome-key-shade": "#5c5948",
      "--chrome-inset": "#828071",
      "--chrome-ring": "#333125",
      "--chrome-ring-deep": "#333125",
      "--chrome-lip": "#333125",
      "--chrome-pressed": "#1c1d18",
      "--chrome-mill-hi": "#b9b6a3",
      "--chrome-mill-soft": "#a4a18e",
      "--chrome-grade-sheen": "#a4a18e",
      "--chrome-foot": "#726f5c",
      "--chrome-stone": "#726f5c",
      "--chrome-mist": "#c6c3b0",
      "--chrome-haze": "#a4a18e",
      "--chrome-paper": "#c6c3b0",
      "--chrome-pewter": "#a4a18e",
      "--chrome-ash": "#93907d",
      "--chrome-cloud": "#c6c3b0",
      "--chrome-pearl": "#b9b6a3",
      "--chrome-tin": "#a4a18e",
      "--chrome-fog": "#c6c3b0",
      "--chrome-slate": "#494633",
      "--chrome-slate-dim": "#494633",
      "--chrome-nickel": "#828071",
      "--chrome-mist-2": "#b9b6a3",
      "--chrome-pearl-2": "#b9b6a3",
      "--chrome-ash-2": "#93907d",
      "--chrome-ice": "#b9b6a3",
      "--chrome-blue-stone": "#726f5c",
      "--chrome-blue-shade": "#5c5948",
      "--chrome-ink-soft": "#404040",
      "--chrome-ink-deep": "#3a3a3a",
    },
  },
  {
    mix: 8,
    face: "#999686",
    source: "Olive walk beside the IRIX modal",
    tokens: {
      "--chrome-face": "#999686",
      "--chrome-mid": "#b9b6a3",
      "--chrome-hi": "#c6c3b0",
      "--chrome-lo": "#494633",
      "--chrome-frame": "#1c1d18",
      "--chrome-brush": "#828071",
      "--chrome-sheen": "#b9b6a3",
      "--chrome-shade": "#5c5948",
      "--chrome-key-sheen": "#b9b6a3",
      "--chrome-key-mid": "#b9b6a3",
      "--chrome-key-shade": "#5c5948",
      "--chrome-inset": "#828071",
      "--chrome-ring": "#333125",
      "--chrome-ring-deep": "#333125",
      "--chrome-lip": "#333125",
      "--chrome-pressed": "#1c1d18",
      "--chrome-mill-hi": "#b9b6a3",
      "--chrome-mill-soft": "#a4a18e",
      "--chrome-grade-sheen": "#a4a18e",
      "--chrome-foot": "#726f5c",
      "--chrome-stone": "#726f5c",
      "--chrome-mist": "#c6c3b0",
      "--chrome-haze": "#a4a18e",
      "--chrome-paper": "#c6c3b0",
      "--chrome-pewter": "#a4a18e",
      "--chrome-ash": "#93907d",
      "--chrome-cloud": "#c6c3b0",
      "--chrome-pearl": "#b9b6a3",
      "--chrome-tin": "#a4a18e",
      "--chrome-fog": "#c6c3b0",
      "--chrome-slate": "#494633",
      "--chrome-slate-dim": "#494633",
      "--chrome-nickel": "#828071",
      "--chrome-mist-2": "#b9b6a3",
      "--chrome-pearl-2": "#b9b6a3",
      "--chrome-ash-2": "#93907d",
      "--chrome-ice": "#b9b6a3",
      "--chrome-blue-stone": "#726f5c",
      "--chrome-blue-shade": "#5c5948",
      "--chrome-ink-soft": "#404040",
      "--chrome-ink-deep": "#3a3a3a",
    },
  },
  {
    mix: 16,
    face: "#9a9889",
    source: "TENO designrefs/5d58e7b46cf9bd493eb09f761340fb17.jpg",
    tokens: {
      "--chrome-face": "#9a9889",
      "--chrome-mid": "#caccbe",
      "--chrome-hi": "#edefe2",
      "--chrome-lo": "#263121",
      "--chrome-frame": "#122011",
      "--chrome-brush": "#566352",
      "--chrome-sheen": "#caccbe",
      "--chrome-shade": "#334432",
      "--chrome-key-sheen": "#caccbe",
      "--chrome-key-mid": "#caccbe",
      "--chrome-key-shade": "#334432",
      "--chrome-inset": "#566352",
      "--chrome-ring": "#263121",
      "--chrome-ring-deep": "#122011",
      "--chrome-lip": "#263121",
      "--chrome-pressed": "#122011",
      "--chrome-mill-hi": "#caccbe",
      "--chrome-mill-soft": "#aba99a",
      "--chrome-grade-sheen": "#aba99a",
      "--chrome-foot": "#566352",
      "--chrome-stone": "#566352",
      "--chrome-mist": "#edefe2",
      "--chrome-haze": "#aba99a",
      "--chrome-paper": "#edefe2",
      "--chrome-pewter": "#aba99a",
      "--chrome-ash": "#7e8677",
      "--chrome-cloud": "#edefe2",
      "--chrome-pearl": "#caccbe",
      "--chrome-tin": "#aba99a",
      "--chrome-fog": "#edefe2",
      "--chrome-slate": "#334432",
      "--chrome-slate-dim": "#263121",
      "--chrome-nickel": "#7e8677",
      "--chrome-mist-2": "#caccbe",
      "--chrome-pearl-2": "#caccbe",
      "--chrome-ash-2": "#7e8677",
      "--chrome-ice": "#caccbe",
      "--chrome-blue-stone": "#334432",
      "--chrome-blue-shade": "#334432",
      "--chrome-ink-soft": "#404040",
      "--chrome-ink-deep": "#3a3a3a",
    },
  },
  {
    mix: 32,
    face: "#c0c1b9",
    source: "Pocket PC designrefs/36bc1715c629f42e163d54abe8741ac6.jpg",
    tokens: {
      "--chrome-face": "#c0c1b9",
      "--chrome-mid": "#c9c9c1",
      "--chrome-hi": "#e3e5e4",
      "--chrome-lo": "#808078",
      "--chrome-frame": "#000000",
      "--chrome-brush": "#afb0a8",
      "--chrome-sheen": "#c9c9c1",
      "--chrome-shade": "#8e8e86",
      "--chrome-key-sheen": "#dcdedd",
      "--chrome-key-mid": "#c9c9c1",
      "--chrome-key-shade": "#9d9e99",
      "--chrome-inset": "#b6b8b3",
      "--chrome-ring": "#808078",
      "--chrome-ring-deep": "#181818",
      "--chrome-lip": "#808078",
      "--chrome-pressed": "#000000",
      "--chrome-mill-hi": "#c9c9c1",
      "--chrome-mill-soft": "#c7c7bf",
      "--chrome-grade-sheen": "#c7c7bf",
      "--chrome-foot": "#a7a99e",
      "--chrome-stone": "#a7a99e",
      "--chrome-mist": "#dcdedd",
      "--chrome-haze": "#c9c9c1",
      "--chrome-paper": "#e3e5e4",
      "--chrome-pewter": "#c7c7bf",
      "--chrome-ash": "#bfc0b8",
      "--chrome-cloud": "#dcdedd",
      "--chrome-pearl": "#dcdedd",
      "--chrome-tin": "#c7c7bf",
      "--chrome-fog": "#e3e5e4",
      "--chrome-slate": "#8e8e86",
      "--chrome-slate-dim": "#868982",
      "--chrome-nickel": "#b6b8b3",
      "--chrome-mist-2": "#dcdedd",
      "--chrome-pearl-2": "#dcdedd",
      "--chrome-ash-2": "#b6b8b3",
      "--chrome-ice": "#dcdedd",
      "--chrome-blue-stone": "#a7a99e",
      "--chrome-blue-shade": "#8e8e86",
      "--chrome-ink-soft": "#404040",
      "--chrome-ink-deep": "#3a3a3a",
    },
  },
  {
    mix: 40,
    face: "#c0bfba",
    source: "Pocket PC and Tek 465B designrefs/a898e04c534aeed3017938c701efdb2f.jpg",
    tokens: {
      "--chrome-face": "#c0bfba",
      "--chrome-mid": "#c9c9c1",
      "--chrome-hi": "#e3e5e4",
      "--chrome-lo": "#808078",
      "--chrome-frame": "#000000",
      "--chrome-brush": "#afb0a8",
      "--chrome-sheen": "#c9c9c1",
      "--chrome-shade": "#8e8e86",
      "--chrome-key-sheen": "#dcdedd",
      "--chrome-key-mid": "#c9c9c1",
      "--chrome-key-shade": "#9d9e99",
      "--chrome-inset": "#b6b8b3",
      "--chrome-ring": "#808078",
      "--chrome-ring-deep": "#181818",
      "--chrome-lip": "#808078",
      "--chrome-pressed": "#000000",
      "--chrome-mill-hi": "#c9c9c1",
      "--chrome-mill-soft": "#c7c7bf",
      "--chrome-grade-sheen": "#c7c7bf",
      "--chrome-foot": "#a7a99e",
      "--chrome-stone": "#a7a99e",
      "--chrome-mist": "#dcdedd",
      "--chrome-haze": "#c9c9c1",
      "--chrome-paper": "#e3e5e4",
      "--chrome-pewter": "#c7c7bf",
      "--chrome-ash": "#bfc0b8",
      "--chrome-cloud": "#dcdedd",
      "--chrome-pearl": "#dcdedd",
      "--chrome-tin": "#c7c7bf",
      "--chrome-fog": "#e3e5e4",
      "--chrome-slate": "#8e8e86",
      "--chrome-slate-dim": "#868982",
      "--chrome-nickel": "#b6b8b3",
      "--chrome-mist-2": "#dcdedd",
      "--chrome-pearl-2": "#dcdedd",
      "--chrome-ash-2": "#b6b8b3",
      "--chrome-ice": "#dcdedd",
      "--chrome-blue-stone": "#a7a99e",
      "--chrome-blue-shade": "#8e8e86",
      "--chrome-ink-soft": "#404040",
      "--chrome-ink-deep": "#3a3a3a",
    },
  },
  {
    mix: 75,
    face: "#b7bcbf",
    source: "Cooler silver, flower CRTs and gadget wall",
    tokens: {
      "--chrome-face": "#b7bcbf",
      "--chrome-mid": "#dddce4",
      "--chrome-hi": "#f1f0f5",
      "--chrome-lo": "#595b68",
      "--chrome-frame": "#2a2d34",
      "--chrome-brush": "#a0a4a3",
      "--chrome-sheen": "#c2c3c5",
      "--chrome-shade": "#808080",
      "--chrome-key-sheen": "#edecf1",
      "--chrome-key-mid": "#c2c3c5",
      "--chrome-key-shade": "#8e908d",
      "--chrome-inset": "#a0a4a3",
      "--chrome-ring": "#4d4f5c",
      "--chrome-ring-deep": "#33363f",
      "--chrome-lip": "#4d4f5c",
      "--chrome-pressed": "#33363f",
      "--chrome-mill-hi": "#dddce4",
      "--chrome-mill-soft": "#bfc0c2",
      "--chrome-grade-sheen": "#bfc0c2",
      "--chrome-foot": "#969b97",
      "--chrome-stone": "#969b97",
      "--chrome-mist": "#edecf1",
      "--chrome-haze": "#c2c3c5",
      "--chrome-paper": "#f1f0f5",
      "--chrome-pewter": "#c2c3c5",
      "--chrome-ash": "#b8bbc0",
      "--chrome-cloud": "#edecf1",
      "--chrome-pearl": "#dddce4",
      "--chrome-tin": "#bfc0c2",
      "--chrome-fog": "#f1f0f5",
      "--chrome-slate": "#727272",
      "--chrome-slate-dim": "#595b68",
      "--chrome-nickel": "#b7b7b7",
      "--chrome-mist-2": "#edecf1",
      "--chrome-pearl-2": "#dddce4",
      "--chrome-ash-2": "#b7b7b7",
      "--chrome-ice": "#dddce4",
      "--chrome-blue-stone": "#8e908d",
      "--chrome-blue-shade": "#727272",
      "--chrome-ink-soft": "#404040",
      "--chrome-ink-deep": "#3a3a3a",
    },
  },
  {
    mix: 100,
    face: "#b8bbc0",
    source: "Flower CRTs designrefs/9d225800a3f631bc7559c83d11f1aaa2.jpg",
    tokens: {
      "--chrome-face": "#b8bbc0",
      "--chrome-mid": "#c2c3c5",
      "--chrome-hi": "#f1f0f5",
      "--chrome-lo": "#4d4f5c",
      "--chrome-frame": "#2a2d34",
      "--chrome-brush": "#969b97",
      "--chrome-sheen": "#c2c3c5",
      "--chrome-shade": "#727272",
      "--chrome-key-sheen": "#edecf1",
      "--chrome-key-mid": "#bfc0c2",
      "--chrome-key-shade": "#808080",
      "--chrome-inset": "#a0a4a3",
      "--chrome-ring": "#4d4f5c",
      "--chrome-ring-deep": "#33363f",
      "--chrome-lip": "#4d4f5c",
      "--chrome-pressed": "#2a2d34",
      "--chrome-mill-hi": "#c2c3c5",
      "--chrome-mill-soft": "#b7bcbf",
      "--chrome-grade-sheen": "#b7bcbf",
      "--chrome-foot": "#8e908d",
      "--chrome-stone": "#8e908d",
      "--chrome-mist": "#edecf1",
      "--chrome-haze": "#bfc0c2",
      "--chrome-paper": "#f1f0f5",
      "--chrome-pewter": "#bfc0c2",
      "--chrome-ash": "#b7b7b7",
      "--chrome-cloud": "#edecf1",
      "--chrome-pearl": "#c2c3c5",
      "--chrome-tin": "#bfc0c2",
      "--chrome-fog": "#edecf1",
      "--chrome-slate": "#727272",
      "--chrome-slate-dim": "#595b68",
      "--chrome-nickel": "#a0a4a3",
      "--chrome-mist-2": "#dddce4",
      "--chrome-pearl-2": "#dddce4",
      "--chrome-ash-2": "#a0a4a3",
      "--chrome-ice": "#dddce4",
      "--chrome-blue-stone": "#8e908d",
      "--chrome-blue-shade": "#727272",
      "--chrome-ink-soft": "#404040",
      "--chrome-ink-deep": "#3a3a3a",
    },
  },
]

/** Warm pole → classic default → cool pole. Mix 50 is `DEFAULT_CHROME_TOKENS`. */
export const CHROME_FACE_SWATCHES: readonly ChromeFaceSwatch[] = [
  ...DESIGN_REF_SWATCHES.filter((swatch) => swatch.mix < CHROME_FACE_DEFAULT_SETPOINT),
  {
    mix: CHROME_FACE_DEFAULT_SETPOINT,
    face: DEFAULT_CHROME_TOKENS["--chrome-face"],
    source: "Display Properties designrefs/60d7202cb958e11734ce0567eb382868.jpg and app/win95.css",
    tokens: DEFAULT_CHROME_TOKENS,
  },
  ...DESIGN_REF_SWATCHES.filter((swatch) => swatch.mix > CHROME_FACE_DEFAULT_SETPOINT),
]

export type ChromePatinaTokens = {
  "--chrome-set": string
  "--chrome-live": string
  "--chrome-mix": string
} & ChromeColorTokens

export function clampChromeFaceSetpoint(value: number): number {
  if (!Number.isFinite(value)) return CHROME_FACE_DEFAULT_SETPOINT
  return Math.min(100, Math.max(0, value))
}

function spanAt(position: number): { from: ChromeFaceSwatch; to: ChromeFaceSwatch; t: number } {
  const x = clampChromeFaceSetpoint(position)
  const knots = CHROME_FACE_SWATCHES
  const exact = knots.find((knot) => knot.mix === x)
  if (exact) return { from: exact, to: exact, t: 0 }
  for (let i = 0; i < knots.length - 1; i++) {
    const from = knots[i]
    const to = knots[i + 1]
    if (x >= from.mix && x <= to.mix) {
      return { from, to, t: (x - from.mix) / (to.mix - from.mix) }
    }
  }
  const last = knots[knots.length - 1]
  return { from: last, to: last, t: 0 }
}

export function chromeColorTokens(position: number = CHROME_FACE_DEFAULT_SETPOINT): ChromeColorTokens {
  const { from, to, t } = spanAt(position)
  if (from === to || t <= 0) return from.tokens
  if (t >= 1) return to.tokens
  const out = {} as ChromeColorTokens
  for (const key of Object.keys(from.tokens) as (keyof ChromeColorTokens)[]) {
    out[key] = mixChromeHex(from.tokens[key], to.tokens[key], t)
  }
  return out
}

export function chromeFaceRgb(position: number): [number, number, number] {
  return parseHex(chromeColorTokens(position)["--chrome-face"])
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

/** Warm / brown: red pulls ahead of blue (or green). */
export function isBrownish(hex: string): boolean {
  const [r, g, b] = parseHex(hex)
  return r - b > 2 || r - g > 2
}

export function chromePatinaTokens(position: number = CHROME_FACE_DEFAULT_SETPOINT): ChromePatinaTokens {
  const set = clampChromeFaceSetpoint(position)
  return {
    "--chrome-set": set.toFixed(1),
    "--chrome-live": set.toFixed(1),
    "--chrome-mix": ((set - 50) / 50).toFixed(4),
    ...chromeColorTokens(set),
  }
}

export function applyChromePatina(
  el: { style: { setProperty: (name: string, value: string) => void } },
  position: number = CHROME_FACE_DEFAULT_SETPOINT,
): ChromePatinaTokens {
  const tokens = chromePatinaTokens(position)
  for (const [name, value] of Object.entries(tokens)) {
    el.style.setProperty(name, value)
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

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex)
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}
