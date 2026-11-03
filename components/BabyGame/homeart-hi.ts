/**
 * components/BabyGame/homeart-hi.ts — Friends' homes at twice the detail
 *
 * The houses themselves come from `housegen.ts` (one generic builder, customised per friend). This file caches each as a canvas
 * pooled onto the game's pixel grid and stamps it. `homeart.ts` remains the 1× fallback.
 */

import { houseRgba, HOUSE_GROUND, HOUSE_W, type HouseSpec } from "./housegen"
import { onGrid } from "./pixelsnap"

type Ctx = CanvasRenderingContext2D

export const HOME_PX = HOUSE_W

const cache = new Map<string, HTMLCanvasElement>()

/** The painted home, once per friend (or block) and lit state: `housegen.ts` draws it on the 96 grid, and it is kept at twice that, nearest
 * neighbour, so one art pixel is exactly one game pixel (the same size as the trees and animals around it) and shown 96 game pixels wide. */
export function homeCanvas(spec: HouseSpec, key: string, lit: boolean | boolean[]): HTMLCanvasElement {
  const k = `${key}:${Array.isArray(lit) ? lit.map(Number).join("") : Number(lit)}`
  let c = cache.get(k)
  if (!c) {
    const small = document.createElement("canvas")
    small.width = small.height = HOME_PX
    small.getContext("2d")!.putImageData(new ImageData(houseRgba(spec, lit), HOME_PX, HOME_PX), 0, 0)
    c = document.createElement("canvas")
    c.width = c.height = HOME_PX * 2
    const g = c.getContext("2d")!
    g.imageSmoothingEnabled = false
    g.drawImage(small, 0, 0, HOME_PX * 2, HOME_PX * 2)
    cache.set(k, c)
  }
  return c
}

/** Stand a house with its middle on `baseX` and its ground line a little above `baseY`, in game pixels (it is `HOME_PX` wide). */
export function drawHomeHi(ctx: Ctx, spec: HouseSpec, key: string, baseX: number, baseY: number, lit: boolean | boolean[]) {
  const img = homeCanvas(spec, key, lit)
  const w = img.width / 2
  ctx.drawImage(img, onGrid(ctx, baseX - w / 2), onGrid(ctx, baseY - HOUSE_GROUND - 3), w, w)
}
