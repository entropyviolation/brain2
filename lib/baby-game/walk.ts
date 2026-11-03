/**
 * lib/baby-game/walk.ts — four-frame walk cycles made from any still grid
 *
 * Every animal and the player already has a front, side and back grid. A walk frame is the same grid with its feet moved,
 * so all 25 bodies walk without a hand-drawn sheet:
 *
 * - **Side view** (`0` reach, `1` pass, `2` reach with the other legs, `3` pass): the lowest three rows split at the body's
 *   middle. The back half and the front half swing apart and together; on the pass frames the whole body lifts a pixel.
 * - **Front and back view** (`0` left foot up, `1` pass, `2` right foot up, `3` pass): the lowest three rows split at the
 *   middle and one half lifts a pixel at a time; the pass frames lift the body.
 *
 * Frame `-1` is the idle still. Hand-drawn frames can replace any of these later without touching the callers.
 */

import { poseSources } from "./people/registry"
import { SPRITE_SIZE, type SpriteView } from "./sprites"

export type WalkFrame = 0 | 1 | 2 | 3

const LEG_ROWS = 3

const grids = new Map<string, string[]>()

/** The still `base` grid with its feet moved for walk `frame`. Same size, same palette. */
export function walkGrid(base: readonly string[], view: SpriteView, frame: WalkFrame): string[] {
  const cells = base.map((row) => row.split(""))
  const filled = (row: string[]) => row.some((ch) => ch !== ".")
  let bottom = -1
  for (let y = SPRITE_SIZE - 1; y >= 0; y--) {
    if (filled(cells[y]!)) {
      bottom = y
      break
    }
  }
  if (bottom < LEG_ROWS) return [...base]
  let left = SPRITE_SIZE
  let right = -1
  for (const row of cells) {
    row.forEach((ch, x) => {
      if (ch === ".") return
      left = Math.min(left, x)
      right = Math.max(right, x)
    })
  }
  const mid = Math.floor((left + right + 1) / 2)
  const top = bottom - LEG_ROWS + 1
  const passing = frame === 1 || frame === 3
  const out = cells.map((row) => row.slice())

  const put = (x: number, y: number, ch: string) => {
    if (x >= 0 && x < SPRITE_SIZE && y >= 0 && y < SPRITE_SIZE && ch !== ".") out[y]![x] = ch
  }
  // clear the leg zone, then redraw each half where this frame wants it
  for (let y = top; y <= bottom; y++) for (let x = 0; x < SPRITE_SIZE; x++) out[y]![x] = "."

  for (let y = top; y <= bottom; y++) {
    for (let x = 0; x < SPRITE_SIZE; x++) {
      const ch = cells[y]![x]!
      if (ch === ".") continue
      const backHalf = x < mid
      let dx = 0
      let dy = 0
      if (view === "side") {
        const reach = frame === 0 ? 1 : frame === 2 ? -1 : 0
        // only the lowest two rows swing, so the thigh stays under the body
        if (y > top) dx = backHalf ? -reach : reach
      } else {
        const lifted = (frame === 0 && backHalf) || (frame === 2 && !backHalf)
        if (lifted) dy = -1
      }
      put(x + dx, y + dy, ch)
    }
  }
  if (passing) {
    // a body already near the top of the cell tucks its legs a pixel instead of lifting, so nothing is cropped
    const roomAbove = !cells[1]!.some((ch) => ch !== "." && ch !== "k")
    const lifted = out.map((row) => row.slice())
    if (roomAbove) {
      for (let y = 0; y < SPRITE_SIZE; y++) lifted[y] = y + 1 < SPRITE_SIZE ? out[y + 1]!.slice() : new Array(SPRITE_SIZE).fill(".")
      // keep the feet row on the ground so a lifted body does not float
      for (let x = 0; x < SPRITE_SIZE; x++) if (out[bottom]![x] !== "." && lifted[bottom]![x] === ".") lifted[bottom]![x] = out[bottom]![x]!
    } else {
      for (let y = top; y <= bottom; y++) {
        for (let x = 0; x < SPRITE_SIZE; x++) {
          const ch = out[y]![x]!
          if (y === bottom) lifted[y]![x] = "."
          if (ch !== "." && y > top) lifted[y - 1]![x] = ch
        }
      }
    }
    return lifted.map((row) => row.join(""))
  }
  return out.map((row) => row.join(""))
}

/** Memoized `walkGrid` for a named grid. */
export function cachedWalk(key: string, base: readonly string[], view: SpriteView, frame: WalkFrame): string[] {
  const k = `${key}:${view}:${frame}`
  let hit = grids.get(k)
  if (!hit) {
    // a body with hand-drawn frames (the person drawer) wins over the frames made from its still
    hit = poseSources.get(key)?.(view, `walk${frame}`) ?? walkGrid(base, view, frame)
    grids.set(k, hit)
  }
  return hit
}
