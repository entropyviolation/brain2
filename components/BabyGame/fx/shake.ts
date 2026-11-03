/**
 * Shake and hit-stop: a bump, a miss, a landing. Draft C (hit-stop, then a decaying jitter) won and lives in
 * `components/BabyGame/shake.ts`, used by the mini games and the world. A and B stay here to compare.
 */
import { type Effect, critter, easeOut, hash, meadow, px } from "./types"

const LOOP = 2
const GROUND = 134
const HIT = 0.9
const WALL = 200

/** Critter runs at the wall and bumps it; drafts pass a frozen `t` for hit-stop. */
function scene(ctx: CanvasRenderingContext2D, t: number, ox: number, oy: number, flash: boolean) {
  ctx.save()
  ctx.translate(ox, oy)
  meadow(ctx)
  px(ctx, "#8b93a0", WALL, 70, 18, 66)
  px(ctx, "#b9c0c8", WALL, 70, 18, 3)
  px(ctx, "#6d7582", WALL + 14, 70, 4, 66)
  const x = Math.min(t, HIT) / HIT
  const cx = 30 + x * (WALL - 8 - 30) - (t > HIT ? easeOut((t - HIT) / 0.25) * 10 : 0)
  critter(ctx, cx, GROUND, 1, 0, t > HIT && t < HIT + 0.12 ? 2 : 0)
  if (flash) px(ctx, "#ffffff", WALL - 2, 96, 4, 6)
  ctx.restore()
}

export const shake: Effect = {
  id: "shake",
  label: "Shake + hit-stop",
  loop: LOOP,
  use: "Mini game misses, bumps, big harvests. Whole pixels only.",
  drafts: {
    A: {
      note: "Random jitter, 3 px decaying to 0 over 8 steps at 30 Hz.",
      draw(ctx, t) {
        const age = (t - HIT) / 0.27
        const step = Math.floor((t - HIT) * 30)
        const amp = age >= 0 && age < 1 ? Math.round(3 * (1 - age)) : 0
        scene(ctx, t, Math.round((hash(step, 1) - 0.5) * 2 * amp), Math.round((hash(step, 2) - 0.5) * 2 * amp), age >= 0 && age < 0.15)
      },
    },
    B: {
      note: "Directional kick, damped spring along the hit axis.",
      draw(ctx, t) {
        const s = t - HIT
        const ox = s >= 0 ? Math.round(-4 * Math.exp(-s * 12) * Math.cos(s * 38)) : 0
        scene(ctx, t, ox, 0, s >= 0 && s < 0.1)
      },
    },
    C: {
      note: "2-frame hit-stop (clock freezes), then a 1 px shake, then release.",
      draw(ctx, t) {
        const stop = 2 / 60
        const frozen = t >= HIT && t < HIT + stop ? HIT : t > HIT + stop ? t - stop : t
        const age = (t - HIT - stop) / 0.2
        const step = Math.floor((t - HIT) * 30)
        const jit = age >= 0 && age < 1 ? 1 : 0
        scene(ctx, frozen, Math.round((hash(step, 1) - 0.5) * 2 * jit), Math.round((hash(step, 2) - 0.5) * 2 * jit), t >= HIT && t < HIT + stop + 0.05)
      },
    },
  },
}
