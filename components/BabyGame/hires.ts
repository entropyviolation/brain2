/**
 * components/BabyGame/hires.ts — the world at twice the pixels
 *
 * The game paints a 304×192 frame in `render.ts`. `HiRes` runs that frame through Scale2x (the EPX rule): every pixel becomes
 * a 2×2 block, and a corner is rounded off only where two neighbours agree. Diagonals and curves come out smooth, outlines
 * stay one crisp pixel of the new grid, and Bayer dither (checkerboards) is left alone because no corner has two matching sides.
 */

export const HI = 2

/** How many real pixels the village paints per game pixel before Scale2x runs (the casa stays at 1). Painters keep working
 * in game pixels because `drawFrame` scales the context; art that wants more detail (`homeart-hi.ts`) paints in halves. */
export const DETAIL = 3

/** Scale2x on 32-bit pixels: `src` is w×h, `dst` is 2w×2h. */
export function scale2x(src: Uint32Array, dst: Uint32Array, w: number, h: number) {
  const W = w * 2
  for (let y = 0; y < h; y++) {
    const up = (y > 0 ? y - 1 : y) * w
    const dn = (y < h - 1 ? y + 1 : y) * w
    const row = y * w
    for (let x = 0; x < w; x++) {
      const l = x > 0 ? x - 1 : x
      const r = x < w - 1 ? x + 1 : x
      const P = src[row + x]!
      const A = src[up + x]!
      const B = src[row + r]!
      const C = src[row + l]!
      const D = src[dn + x]!
      let e0 = P, e1 = P, e2 = P, e3 = P
      if (C === A && C !== D && A !== B) e0 = A
      if (A === B && A !== C && B !== D) e1 = B
      if (D === C && D !== B && C !== A) e2 = C
      if (B === D && B !== A && D !== C) e3 = D
      const o = y * 2 * W + x * 2
      dst[o] = e0
      dst[o + 1] = e1
      dst[o + W] = e2
      dst[o + W + 1] = e3
    }
  }
}

export class HiRes {
  readonly low: HTMLCanvasElement
  readonly lowCtx: CanvasRenderingContext2D
  private out: ImageData
  private src: Uint32Array
  private dst: Uint32Array

  /** `detail` real pixels per game pixel in the low frame; `w` and `h` are game pixels. */
  constructor(private w: number, private h: number, readonly detail = 1) {
    w *= detail
    h *= detail
    this.w = w
    this.h = h
    this.low = document.createElement("canvas")
    this.low.width = w
    this.low.height = h
    this.lowCtx = this.low.getContext("2d", { willReadFrequently: true })!
    this.out = new ImageData(w * HI, h * HI)
    this.src = new Uint32Array(w * h)
    this.dst = new Uint32Array(this.out.data.buffer)
  }

  /** Smooth the low frame onto the display canvas (which is `w*HI` × `h*HI`). */
  present(display: CanvasRenderingContext2D) {
    const img = this.lowCtx.getImageData(0, 0, this.w, this.h)
    this.src = new Uint32Array(img.data.buffer)
    scale2x(this.src, this.dst, this.w, this.h)
    display.putImageData(this.out, 0, 0)
  }
}
