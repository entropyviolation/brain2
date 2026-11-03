/**
 * lib/baby-game/people/color.ts — named colors and three-tone ramps for people
 *
 * Stardew-style shading hue-shifts: lights lean warm, shadows lean cool and a little purple, so a red shirt's shadow
 * is plum, not brown. `rampOf` turns one base color into `hi`, `mid`, `lo` and `deep` (used for outlines inside a
 * garment). Names are a closed list so a model can only pick colors the game knows.
 */

export type Ramp = { hi: string; mid: string; lo: string; deep: string }

const NAMED: Record<string, string> = {
  red: "#d8453f", crimson: "#b02a3e", rose: "#e66a86", pink: "#f59ac0", blush: "#f3b7b0", coral: "#f2765f", maroon: "#7a2335",
  orange: "#ee8a3b", rust: "#b65a35", peach: "#f6c29a", mustard: "#d9a937", yellow: "#f0d040", cream: "#f6ecd6",
  green: "#4fa85a", forest: "#2f6b43", olive: "#7d8a3a", sage: "#9db38a", mint: "#a6e0c0", lime: "#9bd24a", teal: "#2f9aa0",
  blue: "#4e86d6", navy: "#2b3f7a", sky: "#8cc4ee", denim: "#4a6fa5", cobalt: "#2f5fc0", turquoise: "#3fc1c9",
  purple: "#8458c0", lavender: "#b9a2e6", plum: "#6f3d6b", magenta: "#c447a6",
  white: "#f4f1ee", grey: "#8d8a96", charcoal: "#4a4752", black: "#2f2b36", silver: "#bcc3cc",
  brown: "#8a5a3c", tan: "#c9a27a", khaki: "#b8a577", chocolate: "#5a3a2a", beige: "#dcc6a4",
  // hair
  blonde: "#e8c76a", strawberry: "#e8a27c", ginger: "#d2692f", auburn: "#a8492c", chestnut: "#7a4326", brunette: "#5a3825", jet: "#2c2631", platinum: "#e9e6d9",
}

export const COLOR_NAMES = Object.keys(NAMED)

export const SKIN_NAMES = ["pale", "fair", "light", "tan", "olive", "brown", "deep", "ebony"] as const
export type SkinName = (typeof SKIN_NAMES)[number]

const SKIN: Record<SkinName, string> = {
  pale: "#f8dccb", fair: "#f4c9a8", light: "#e9b18a", tan: "#d39a6b", olive: "#c08a5f", brown: "#9a6642", deep: "#6e4430", ebony: "#4b2f26",
}

const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n))

function toHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}

function fromHsl(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  const to = (v: number) => Math.round(clamp(v) * 255).toString(16).padStart(2, "0")
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`
}

/** Pull a hue toward `target` by `amount` degrees along the short way round. */
function lean(h: number, target: number, amount: number): number {
  let d = ((target - h + 540) % 360) - 180
  d = Math.max(-amount, Math.min(amount, d))
  return h + d
}

/** Four tones from one base color: warm light, cool shadow, a deep tone for creases. */
export function rampOf(hex: string): Ramp {
  const [h, s, l] = toHsl(hex)
  return {
    hi: fromHsl(lean(h, 50, 14), clamp(s * 0.95), clamp(l + 0.13 * (1 - l) + 0.05)),
    mid: hex,
    lo: fromHsl(lean(h, 285, 22), clamp(s * 1.05 + 0.03), clamp(l * 0.74)),
    deep: fromHsl(lean(h, 285, 34), clamp(s * 1.05 + 0.05), clamp(l * 0.5)),
  }
}

/** A color by name or `#rrggbb`, or `fallback` for anything the game does not know. */
export function colorHex(name: string | undefined, fallback = "#8d8a96"): string {
  if (!name) return fallback
  const n = name.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(n)) return n
  return NAMED[n] ?? fallback
}

export function isColor(name: unknown): name is string {
  return typeof name === "string" && (/^#[0-9a-fA-F]{6}$/.test(name) || name in NAMED)
}

/** Skin as a ramp: shadows lean red-plum, lights stay warm, so skin never goes grey. */
export function skinRamp(skin: SkinName): Ramp {
  const base = SKIN[skin] ?? SKIN.fair
  const [h, s, l] = toHsl(base)
  return {
    hi: fromHsl(lean(h, 40, 6), clamp(s * 0.9), clamp(l + 0.07)),
    mid: base,
    lo: fromHsl(lean(h, 350, 14), clamp(s * 1.1 + 0.04), clamp(l * 0.84)),
    deep: fromHsl(lean(h, 345, 20), clamp(s * 1.1 + 0.08), clamp(l * 0.6)),
  }
}

/** Cheek pink: the skin warmed toward rose. */
export function blushHex(skin: SkinName): string {
  const [h, s, l] = toHsl(SKIN[skin] ?? SKIN.fair)
  return fromHsl(lean(h, 350, 28), clamp(s * 1.1 + 0.1), clamp(l - 0.04))
}
