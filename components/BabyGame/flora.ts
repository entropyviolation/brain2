/**
 * components/BabyGame/flora.ts — paints the ground's little plants (daisies, ferns, glow mushrooms, cacti, ...)
 *
 * Sprites are the snapped ComfyUI pictures in `lib/baby-game/flora-sprites.ts`. Each is painted once to a canvas, then drawn in
 * thin bands so the top sways on the wind and leans away from walkers while the roots stay put. Which plant grows on a tile is
 * `floraKind` (`lib/baby-game/flora.ts`), cached per tile.
 */

import { epx2, onGrid } from "./pixelsnap"
import { FLORA_SPRITES } from "@/lib/baby-game/flora-sprites"
import { floraKind, GRASS_FLORA } from "@/lib/baby-game/flora"
import { T, zoneAt } from "@/lib/baby-game/world"

const INK = "#2b1d2e"
const CHARS = "0123456789abcdefghijklmnopqrstuvwxyz"
const canvases = new Map<string, HTMLCanvasElement>()
const kinds = new Map<number, string | null>()

/** The pictures come out of ComfyUI darker and greyer than the ground; each colour is lifted toward the game's bright, clean ramp. */
function lift(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
  const l = (mx + mn) / 2
  const d = mx - mn
  let h = 0
  if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  const sat = d ? d / (1 - Math.abs(2 * l - 1)) : 0
  const L = 0.3 + l * 0.58
  const S = Math.min(0.85, 0.28 + sat * 0.8)
  const c = (1 - Math.abs(2 * L - 1)) * S
  const x = c * (1 - Math.abs((h % 2) - 1))
  const m = L - c / 2
  const [R, G, B] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x]
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0")
  return `#${to(R)}${to(G)}${to(B)}`
}

const has = (id: string) => id in FLORA_SPRITES

function canvasOf(id: string): HTMLCanvasElement | null {
  const hit = canvases.get(id)
  if (hit) return hit
  const s = FLORA_SPRITES[id]
  if (!s) return null
  const c = document.createElement("canvas")
  c.width = s.w
  c.height = s.h
  const ctx = c.getContext("2d")!
  s.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === ".") continue
      // the last palette colour is the outline: the game's own ink, so a plant sits in the same world as the tiles
      const ci = CHARS.indexOf(row[x]!)
      ctx.fillStyle = ci === s.pal.length - 1 ? INK : lift(s.pal[ci]!)
      ctx.fillRect(x, y, 1, 1)
    }
  })
  // one EPX step: the fine grid, with rounded curves and the same colours
  const fine = epx2(c)
  canvases.set(id, fine)
  return fine
}

/** The plant growing on a flower or grass tile, or null for none (a plain tile, or no sprites yet). */
export function floraOn(tile: number, tx: number, ty: number, r: number): string | null {
  if (tile !== T.FLOWER && !(tile === T.GRASS && r < GRASS_FLORA)) return null
  const key = ty * 4096 + tx
  if (kinds.has(key)) return kinds.get(key)!
  const kind = floraKind(zoneAt(tx, ty), tile === T.FLOWER ? r : (r / GRASS_FLORA), has)
  kinds.set(key, kind)
  return kind
}

/** Draw plant `id` with its feet at (fx, fy). `lean` is whole pixels at the top; the bands below lean less. */
export function drawFlora(ctx: CanvasRenderingContext2D, id: string, fx: number, fy: number, lean: number) {
  const c = canvasOf(id)
  if (!c) return
  const w = c.width / 2
  const h = c.height / 2
  const x0 = onGrid(ctx, fx - w / 2)
  const y0 = onGrid(ctx, fy - h)
  if (!lean) return void ctx.drawImage(c, x0, y0, w, h)
  const band = 3
  for (let y = 0; y < h; y += band) {
    const rise = 1 - (y + band / 2) / h
    const dx = Math.round(lean * rise * rise * 2) / 2
    const bh = Math.min(band, h - y)
    ctx.drawImage(c, 0, y * 2, c.width, bh * 2, x0 + dx, y0 + y, w, bh)
  }
}
