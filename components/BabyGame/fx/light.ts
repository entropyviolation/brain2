/** Dither and light: the night veil with pools cut out of it, against the old flat tint. */
import { ditherRect, Veil, type Light } from "../dither"
import { type Effect, FX_H, FX_W, critter, meadow, px } from "./types"

const LOOP = 8
let veil: Veil | null = null

function fire(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  px(ctx, "#6b4630", x - 5, y - 2, 10, 3)
  px(ctx, "#8a5a44", x - 4, y - 3, 8, 1)
  const h = 5 + Math.round(Math.sin(t * 13) + Math.sin(t * 7.7))
  px(ctx, "#f0609a", x - 3, y - 3 - h, 6, h)
  px(ctx, "#ffb3d1", x - 2, y - 3 - h + 2, 4, Math.max(1, h - 3))
  px(ctx, "#ffffff", x - 1, y - 6, 2, 2)
}

function scene(ctx: CanvasRenderingContext2D, t: number) {
  meadow(ctx)
  px(ctx, "#3f7a44", 0, 0, FX_W, 6)
  fire(ctx, 150, 134, t)
  critter(ctx, 110, 138, 1)
  critter(ctx, 196, 140, -1)
  const u = (t % LOOP) / LOOP
  const x = 30 + (u < 0.5 ? u * 2 : 2 - u * 2) * (FX_W - 60)
  critter(ctx, x, 168, u < 0.5 ? 1 : -1, Math.abs(Math.sin(t * 16)) > 0.8 ? 1 : 0)
  return x
}

export const light: Effect = {
  id: "light",
  label: "Dither + light",
  loop: LOOP,
  use: "Dusk, night, fog and pools of fire, lamp and lantern light. One Bayer grain for all of it.",
  drafts: {
    A: {
      note: "The old way: a flat tint and a soft radial glow. Keep for comparison.",
      draw(ctx, t) {
        scene(ctx, t)
        ctx.fillStyle = "rgba(20,30,80,0.5)"
        ctx.fillRect(0, 0, FX_W, FX_H)
        const g = ctx.createRadialGradient(150, 134, 2, 150, 134, 50)
        g.addColorStop(0, "rgba(255,170,150,0.35)")
        g.addColorStop(1, "rgba(255,200,200,0)")
        ctx.fillStyle = g
        ctx.fillRect(100, 84, 100, 100)
      },
    },
    B: {
      note: "Dithered veil, a pool around the fire, hard-edged stepped bands.",
      draw(ctx, t) {
        scene(ctx, t)
        veil ??= new Veil(FX_W, FX_H)
        veil.draw(ctx, { color: [20, 30, 80], alpha: 0.5, lights: [{ x: 150, y: 128, r: 50, power: 0.9, glow: 0.5, color: [255, 160, 150] }] })
      },
    },
    C: {
      note: "B with a flickering fire and a lantern that follows the walker.",
      draw(ctx, t) {
        const x = scene(ctx, t)
        veil ??= new Veil(FX_W, FX_H)
        const flick = 1 + Math.sin(t * 11) * 0.03 + Math.sin(t * 17.3) * 0.02
        const lights: Light[] = [
          { x: 150, y: 128, r: 50 * flick, power: 0.9, glow: 0.5, color: [255, 160, 150] },
          { x, y: 162, r: 26, power: 0.38 },
        ]
        veil.draw(ctx, { color: [20, 30, 80], alpha: 0.5, lights })
      },
    },
    D: {
      note: "Fog: a dither veil with drifting banks in three stepped layers.",
      draw(ctx, t) {
        scene(ctx, t)
        ditherRect(ctx, "#e1d2f8", 0, 0, FX_W, FX_H, 0.22)
        for (let i = 0; i < 7; i++) {
          const fx = Math.round(((i * 71 + t * 6) % (FX_W + 80)) - 40)
          const fy = 20 + ((i * 53) % (FX_H - 30))
          ditherRect(ctx, "#f5eeff", fx - 6, fy - 2, 72, 14, 0.25)
          ditherRect(ctx, "#f5eeff", fx, fy - 4, 60, 18, 0.35)
          ditherRect(ctx, "#f5eeff", fx + 10, fy - 4, 40, 18, 0.5)
        }
      },
    },
  },
}
