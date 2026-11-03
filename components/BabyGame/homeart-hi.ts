/**
 * components/BabyGame/homeart-hi.ts — Friends' homes at twice the detail
 *
 * The houses themselves come from `housegen.ts` (one generic builder, customised per friend). This file caches each as a canvas
 * pooled onto the game's pixel grid and stamps it. `homeart.ts` remains the 1× fallback.
 */

import type { HomeKind } from "@/lib/baby-game/homes"
import { houseRgba, specFor, HOUSE_W } from "./housegen"
import { onGrid, snapTo } from "./pixelsnap"

type Ctx = CanvasRenderingContext2D

export const HOME_PX = HOUSE_W

const cache = new Map<string, HTMLCanvasElement>()

/** The painted home for a friend, once per lit state: `housegen.ts` draws it on the 96 grid from the kind and the friend's id (colours,
 * shapes and extras differ per friend), and it is kept at 96 (two pixels per game pixel, `snapTo`). `detail` is kept for old callers and ignored. */
export function homeCanvas(kind: HomeKind, lit: boolean, id: string = kind, _detail = 1): HTMLCanvasElement {
  const key = `${kind}:${id}:${lit ? 1 : 0}`
  let c = cache.get(key)
  if (!c) {
    const big = document.createElement("canvas")
    big.width = big.height = HOME_PX
    big.getContext("2d")!.putImageData(new ImageData(houseRgba(specFor(kind, id), lit), HOME_PX, HOME_PX), 0, 0)
    c = snapTo(big, HOME_PX, HOME_PX, { cover: 0.45 })
    cache.set(key, c)
  }
  return c
}

/** Stand a home on its tile: bottom-centre of the picture on `(baseX, baseY)`, in game pixels. It is three tiles wide (48 game pixels). */
export function drawHomeHi(ctx: Ctx, kind: HomeKind, baseX: number, baseY: number, lit: boolean, id: string = kind) {
  const img = homeCanvas(kind, lit, id)
  const w = img.width / 2
  ctx.drawImage(img, onGrid(ctx, baseX - w / 2), onGrid(ctx, baseY - w), w, w)
}
