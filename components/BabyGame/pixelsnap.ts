import { scale2x } from "./hires"

/**
 * components/BabyGame/pixelsnap.ts — one pixel size for the whole village
 *
 * Trees, homes, flora and animals are drawn or generated on grids finer than the game pixel. `snapTo` pools such a picture
 * onto the game's grid: every output pixel takes the colour that covers most of its source block (a block that is mostly empty
 * stays empty), so edges stay hard, nothing is blended into a colour the artist did not paint, and every sprite in the frame
 * has the same pixel size. Used once per cached canvas, never per frame.
 */

/** Pool `src` onto a `w`×`h` canvas. Colours are compared after a small rounding, so a gradient settles on its commonest band. */
export function snapTo(src: HTMLCanvasElement, w: number, h: number, opts: { cover?: number } = {}): HTMLCanvasElement {
  const cover = opts.cover ?? 0.5
  const sw = src.width
  const sh = src.height
  const data = src.getContext("2d")!.getImageData(0, 0, sw, sh).data
  const out = document.createElement("canvas")
  out.width = w
  out.height = h
  const octx = out.getContext("2d")!
  const img = octx.createImageData(w, h)
  const kx = sw / w
  const ky = sh / h
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * ky)
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * ky))
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * kx)
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * kx))
      const votes = new Map<number, { n: number; r: number; g: number; b: number }>()
      let solid = 0
      let total = 0
      // soft pixels (a drop shadow) stay one flat translucent tone instead of vanishing
      let soft = 0, sr = 0, sg = 0, sb = 0
      for (let yy = y0; yy < y1 && yy < sh; yy++) {
        for (let xx = x0; xx < x1 && xx < sw; xx++) {
          total++
          const o = (yy * sw + xx) * 4
          const a = data[o + 3]!
          if (a < 128) {
            if (a > 20) { soft++; sr += data[o]!; sg += data[o + 1]!; sb += data[o + 2]! }
            continue
          }
          solid++
          const r = data[o]!
          const g = data[o + 1]!
          const b = data[o + 2]!
          const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
          const v = votes.get(key)
          if (v) { v.n++; v.r += r; v.g += g; v.b += b } else votes.set(key, { n: 1, r, g, b })
        }
      }
      if (!total) continue
      if (solid / total < cover) {
        if ((soft + solid) / total >= cover && soft) {
          const o = (y * w + x) * 4
          img.data[o] = Math.round(sr / soft)
          img.data[o + 1] = Math.round(sg / soft)
          img.data[o + 2] = Math.round(sb / soft)
          img.data[o + 3] = 72
        }
        continue
      }
      let best: { n: number; r: number; g: number; b: number } | null = null
      for (const v of votes.values()) if (!best || v.n > best.n) best = v
      if (!best) continue
      const o = (y * w + x) * 4
      img.data[o] = Math.round(best.r / best.n)
      img.data[o + 1] = Math.round(best.g / best.n)
      img.data[o + 2] = Math.round(best.b / best.n)
      img.data[o + 3] = 255
    }
  }
  octx.putImageData(img, 0, 0)
  return out
}

/** Scale2x (EPX) of a canvas: every pixel becomes 2×2, and a corner is rounded only where two neighbours agree. Same palette, hard edges. */
export function epx2(src: HTMLCanvasElement): HTMLCanvasElement {
  const w = src.width
  const h = src.height
  const img = src.getContext("2d")!.getImageData(0, 0, w, h)
  const out = new ImageData(w * 2, h * 2)
  scale2x(new Uint32Array(img.data.buffer), new Uint32Array(out.data.buffer), w, h)
  const c = document.createElement("canvas")
  c.width = w * 2
  c.height = h * 2
  c.getContext("2d")!.putImageData(out, 0, 0)
  return c
}

/** Round a game-pixel coordinate to a whole real pixel of the frame (`ctx` may be scaled by `DETAIL`). */
export const onGrid = (ctx: CanvasRenderingContext2D, v: number) => {
  const d = ctx.getTransform().a || 1
  return Math.round(v * d) / d
}

const layers = new Map<string, HTMLCanvasElement>()

/** A live painter that works in finer units than the frame (thirds of a game pixel) is painted into a scratch canvas, pooled
 * onto the frame's grid (`snapTo`), and stamped. Recomputed 8 times a second, so bees and bobbing still move. `region` is the
 * box in game pixels, relative to (x, y), that the painter may touch; `draw` paints the thing on the scratch context, whose
 * transform is already `Q`× with (x, y) at the painter's usual place. */
export function pooledLayer(
  ctx: CanvasRenderingContext2D,
  key: string,
  x: number,
  y: number,
  t: number,
  Q: number,
  region: { x0: number; y0: number; w: number; h: number },
  draw: (c: CanvasRenderingContext2D) => void,
) {
  const d = Math.max(1, Math.round(ctx.getTransform().a))
  const full = `${key}|${Math.round(x)},${Math.round(y)}|${Math.floor(t * 8)}|${d}`
  let c = layers.get(full)
  if (!c) {
    if (layers.size > 900) layers.clear()
    const big = document.createElement("canvas")
    big.width = region.w * Q
    big.height = region.h * Q
    const bc = big.getContext("2d", { willReadFrequently: true })!
    bc.setTransform(Q, 0, 0, Q, -(x + region.x0) * Q, -(y + region.y0) * Q)
    draw(bc)
    c = snapTo(big, region.w * d, region.h * d, { cover: 0.45 })
    layers.set(full, c)
  }
  ctx.drawImage(c, onGrid(ctx, x + region.x0), onGrid(ctx, y + region.y0), region.w, region.h)
}
