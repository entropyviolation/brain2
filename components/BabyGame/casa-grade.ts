/**
 * components/BabyGame/casa-grade.ts — one colour grade over the whole cottage, so six rooms and ~60 pieces read as one place
 *
 * The palette is read off the board: cream plaster, honey and walnut wood, deep emerald and olive, black lacquer, silver chrome,
 * rose velvet. Cool mint plaster leans to cream, honey is kept a shade deeper, greens are richer, black goes to green-black
 * ink, white goes to warm pearl, and everything leans a little toward one warm cream tint.
 * `gradeCanvas` rewrites a canvas in place once (room shells and the pictured sprites); the pieces painted in code are already in it.
 */

const INK: readonly [number, number, number] = [0x1d, 0x26, 0x23]
const PEARL: readonly [number, number, number] = [0xf8, 0xf2, 0xe6]
const CREAM: readonly [number, number, number] = [0xf3, 0xeb, 0xdb]
const TINT: readonly [number, number, number] = [0xef, 0xe6, 0xd6]

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function toHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  const l = (mx + mn) / 2
  if (mx === mn) return [0, 0, l]
  const d = mx - mn
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}

function fromHsl(h: number, s: number, l: number): [number, number, number] {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const f = (t: number) => {
    t = (t + 360) % 360
    const u = t < 60 ? p + (q - p) * (t / 60) : t < 180 ? q : t < 240 ? p + (q - p) * ((240 - t) / 60) : p
    return Math.round(u * 255)
  }
  return [f(h + 120), f(h), f(h - 120)]
}

/** The graded colour of one pixel. */
export function gradeRgb(r: number, g: number, b: number): [number, number, number] {
  let [h, s, l] = toHsl(r, g, b)
  // honey stays honey, only a shade deeper and less loud; greens get richer, like the board's emerald and olive
  if (s > 0.1 && h >= 18 && h <= 70 && l > 0.15) {
    s *= 0.86
    l *= 0.94
  } else if (s > 0.1 && h >= 90 && h <= 170) s = Math.min(1, s * 1.12)
  // cool mint plaster leans toward cream, as the board's white plaster does
  const cream = l > 0.74 && s < 0.32 && h >= 130 && h <= 210 ? 0.45 : 0
  let [R, G, B] = fromHsl(h, s, l)
  if (cream) {
    R = lerp(R, CREAM[0], cream)
    G = lerp(G, CREAM[1], cream)
    B = lerp(B, CREAM[2], cream)
  }
  if (l < 0.22) {
    const t = ((0.22 - l) / 0.22) * 0.75
    R = lerp(R, INK[0], t)
    G = lerp(G, INK[1], t)
    B = lerp(B, INK[2], t)
  } else if (l > 0.9) {
    R = lerp(R, PEARL[0], 0.4)
    G = lerp(G, PEARL[1], 0.4)
    B = lerp(B, PEARL[2], 0.4)
  }
  return [Math.round(lerp(R, TINT[0], 0.06)), Math.round(lerp(G, TINT[1], 0.06)), Math.round(lerp(B, TINT[2], 0.06))]
}

const memo = new Map<number, number>()

/** Grade a canvas in place; transparent pixels stay as they are. */
export function gradeCanvas(c: HTMLCanvasElement) {
  const ctx = c.getContext("2d")
  if (!ctx || !c.width || !c.height) return
  const img = ctx.getImageData(0, 0, c.width, c.height)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue
    const key = (d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!
    let out = memo.get(key)
    if (out === undefined) {
      const [r, g, b] = gradeRgb(d[i]!, d[i + 1]!, d[i + 2]!)
      out = (r << 16) | (g << 8) | b
      memo.set(key, out)
    }
    d[i] = out >> 16
    d[i + 1] = (out >> 8) & 255
    d[i + 2] = out & 255
  }
  ctx.putImageData(img, 0, 0)
}
