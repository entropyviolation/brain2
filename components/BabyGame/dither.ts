/**
 * components/BabyGame/dither.ts — one grain for the whole world
 *
 * A single ordered 4×4 (Bayer) dither is used for everything that fades: the dusk and night veil, the pools of light around
 * the fire, the lamp and the player, fog banks. Gradients would blur the pixels; this keeps hard edges and stepped bands.
 *
 * - `ditherRect` fills a rectangle at a density 0..1 through a cached pattern (fast, screen-aligned).
 * - `Veil` paints a darkness field with pools of light cut out of it, per pixel, in one ImageData.
 */

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
/** Threshold in [0, 1) for a screen pixel. */
export const bayerAt = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)]! + 0.5) / 16

const patterns = new Map<string, CanvasPattern>()

function pattern(ctx: CanvasRenderingContext2D, color: string, step: number): CanvasPattern | null {
  const key = `${color}:${step}`
  let p = patterns.get(key)
  if (!p) {
    const c = document.createElement("canvas")
    c.width = c.height = 4
    const g = c.getContext("2d")
    if (!g) return null
    g.fillStyle = color
    for (let i = 0; i < 16; i++) if (BAYER[i]! < step) g.fillRect(i % 4, Math.floor(i / 4), 1, 1)
    p = ctx.createPattern(c, "repeat") ?? undefined
    if (!p) return null
    patterns.set(key, p)
  }
  return p
}

/** Fill a rectangle with `color` at `level` (0 nothing, 1 solid), as a dither. */
export function ditherRect(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number, level: number) {
  const step = Math.round(Math.max(0, Math.min(1, level)) * 16)
  if (step <= 0) return
  if (step >= 16) {
    ctx.fillStyle = color
    ctx.fillRect(x, y, w, h)
    return
  }
  const p = pattern(ctx, color, step)
  if (!p) return
  ctx.fillStyle = p
  ctx.fillRect(x, y, w, h)
}

export type Light = {
  x: number
  y: number
  r: number
  /** How much of the darkness the centre removes, 0..1. */
  power: number
  /** Warm tint inside the pool, 0..1 of full colour at the centre. */
  glow?: number
  color?: readonly [number, number, number]
}

export type VeilSpec = {
  color: readonly [number, number, number]
  /** Strongest alpha the veil reaches, 0..1. */
  alpha: number
  lights: readonly Light[]
}

const STEPS = 4

export class Veil {
  private off: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D | null
  private img: ImageData | null = null

  constructor(private w: number, private h: number) {
    this.off = document.createElement("canvas")
    this.off.width = w
    this.off.height = h
    this.ctx = this.off.getContext("2d")
    this.img = this.ctx ? this.ctx.createImageData(w, h) : null
  }

  /** Paint the veil over `ctx` (identity transform, screen space). */
  draw(ctx: CanvasRenderingContext2D, spec: VeilSpec) {
    const { w, h, img } = this
    if (!img || !this.ctx) return
    const d = img.data
    const [vr, vg, vb] = spec.color
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        const b = bayerAt(x, y)
        let lit = 0
        let gr = 0
        let gg = 0
        let gb = 0
        let glow = 0
        for (const l of spec.lights) {
          const dx = x - l.x
          const dy = y - l.y
          if (dx > l.r || dx < -l.r || dy > l.r || dy < -l.r) continue
          const dist = Math.sqrt(dx * dx + dy * dy) / l.r
          if (dist >= 1) continue
          const f = (1 - dist) * (1 - dist) * (3 - 2 * (1 - dist))
          lit += f * l.power
          const gl = f * (l.glow ?? 0)
          if (gl > glow) {
            glow = gl
            const c = l.color ?? [255, 190, 210]
            gr = c[0]
            gg = c[1]
            gb = c[2]
          }
        }
        const dark = spec.alpha * Math.max(0, 1 - lit)
        const darkStep = Math.floor((dark / spec.alpha) * STEPS + b)
        const glowStep = Math.floor(glow * 3 + b)
        if (glowStep > 0) {
          d[i] = gr
          d[i + 1] = gg
          d[i + 2] = gb
          d[i + 3] = Math.min(255, (glowStep / 3) * 90)
        } else if (darkStep > 0) {
          d[i] = vr
          d[i + 1] = vg
          d[i + 2] = vb
          d[i + 3] = Math.round(Math.min(1, darkStep / STEPS) * spec.alpha * 255)
        } else {
          d[i + 3] = 0
        }
      }
    }
    this.ctx.putImageData(img, 0, 0)
    ctx.drawImage(this.off, 0, 0)
  }
}
