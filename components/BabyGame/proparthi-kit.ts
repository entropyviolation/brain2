/**
 * components/BabyGame/proparthi-kit.ts — Shared brushes and palettes for the hi-res props
 *
 * Thirds of a game pixel: a tile is 48 units. See `proparthi.ts`.
 */

export type Ctx = CanvasRenderingContext2D

export const Q = 3

export const WOOD = { hi: "#d8a184", mid: "#a06a4e", deep: "#7c4f38", dark: "#503324" }
export const STONE = { hi: "#d7dfe5", mid: "#a4afb9", deep: "#74808b", dark: "#4a5560" }
export const STRAW = { hi: "#f2deaa", mid: "#dcbc7e", deep: "#b8965a", dark: "#8a6c3c" }
export const LEAF = { hi: "#9bdc86", mid: "#5fb06a", deep: "#3a8456" }
export const TERRA = { hi: "#e89a74", mid: "#c9744f", deep: "#9c5238", rim: "#f2b690" }

export const hash = (a: number, b: number) => {
  let t = (a * 374761393 + b * 668265263) >>> 0
  t = (t ^ (t >>> 13)) * 1274126177
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296
}

export function r(c: Ctx, color: string, x: number, y: number, w: number, h: number) {
  c.fillStyle = color
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

/** An ellipse of one-unit rows, so its edge is hard like everything else. */
export function disc(c: Ctx, color: string, cx: number, cy: number, rx: number, ry: number, from = -ry, to = ry) {
  c.fillStyle = color
  for (let dy = Math.ceil(from); dy <= to; dy++) {
    const k = Math.sqrt(Math.max(0, 1 - (dy / ry) * (dy / ry)))
    const w = Math.round(rx * k)
    if (w > 0) c.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2, 1)
  }
}

export const shadow = (c: Ctx, cx = 24, rx = 20, y = 44) => disc(c, "rgba(20,30,20,0.26)", cx, y, rx, 4)

/** Short blades and the odd flower along a ground line. */
export function tufts(c: Ctx, x0: number, x1: number, y: number, seed: number) {
  for (let x = x0; x < x1; x += 2) {
    const k = hash(x, seed)
    const h = 3 + Math.floor(k * 5)
    r(c, k > 0.5 ? LEAF.mid : LEAF.deep, x, y - h, 1, h)
    if (k > 0.93) r(c, "#fff4c8", x - 1, y - h - 3, 3, 3)
    else if (k < 0.04) r(c, "#f6a5c0", x - 1, y - h - 3, 3, 3)
  }
}

/** A vertical board with a lit left edge, a dark right edge and a few grain strokes. */
export function post(c: Ctx, x: number, y: number, w: number, h: number, seed: number) {
  r(c, WOOD.mid, x, y, w, h)
  r(c, WOOD.hi, x, y, Math.max(1, Math.round(w / 4)), h)
  r(c, WOOD.deep, x + w - Math.max(1, Math.round(w / 4)), y, Math.max(1, Math.round(w / 4)), h)
  for (let i = 0; i < h / 7; i++) if (hash(i, seed) > 0.45) r(c, WOOD.dark, x + 1 + Math.floor(hash(seed, i) * (w - 2)), y + i * 7, 1, 3 + Math.floor(hash(i, i) * 3))
}

export const COBALT = { hi: "#6a8ff0", mid: "#2f5fe0", deep: "#1f3fa0" }
export type PropEnv = { rain: boolean; night: boolean }
export type Painter = (c: Ctx, t: number, variant: number, env: PropEnv) => void

/** A run of one-unit squares between two points, for strings and hands. */
export function line(c: Ctx, color: string, x0: number, y0: number, x1: number, y1: number, w = 1) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
  c.fillStyle = color
  for (let i = 0; i <= steps; i++) c.fillRect(Math.round(x0 + ((x1 - x0) * i) / (steps || 1)), Math.round(y0 + ((y1 - y0) * i) / (steps || 1)), w, w)
}
