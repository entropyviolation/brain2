/**
 * fx/types.ts — what an effect is, and the small tools every draft shares.
 *
 * An effect is a pure function of time: no game state, no per-frame memory,
 * so the lab can scrub, slow, loop and record it. Every draft is deterministic
 * (hash, not Math.random) so draft A looks the same each loop.
 */

export const FX_W = 304
export const FX_H = 192

/** `t` is seconds into the loop, `0 <= t < Effect.loop`. */
export type Draft = (ctx: CanvasRenderingContext2D, t: number) => void

export interface Effect {
  id: string
  label: string
  /** Loop length in seconds. */
  loop: number
  /** One line: what it is for in the game. */
  use: string
  /** Draft letter to one-line idea. Delete the losers once one wins. */
  drafts: Record<string, { note: string; draw: Draft }>
}

/** Hash two ints to [0, 1). */
export function hash(a: number, b = 0): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
export const easeOut = (v: number) => 1 - (1 - clamp01(v)) ** 3

/** Whole-pixel rectangle. Hard edges only. */
export function px(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w = 1, h = 1) {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

/** Meadow, a path strip, and a ground line so effects have something to land on. */
export function meadow(ctx: CanvasRenderingContext2D, ox = 0, oy = 0) {
  px(ctx, "#4d8f4f", -8 + ox, -8 + oy, FX_W + 16, FX_H + 16)
  for (let i = 0; i < 90; i++) {
    const x = hash(i, 1) * FX_W
    const y = hash(i, 2) * FX_H
    px(ctx, hash(i, 3) > 0.5 ? "#5fa05a" : "#3f7a44", x + ox, y + oy, 2, 1)
  }
  px(ctx, "#a98f72", -8 + ox, 118 + oy, FX_W + 16, 26)
  px(ctx, "#bda585", -8 + ox, 118 + oy, FX_W + 16, 2)
}

/** A stand-in baby animal: a 12×9 body with ears. Feet on `ground`. */
export function critter(ctx: CanvasRenderingContext2D, x: number, ground: number, face: 1 | -1, lift = 0, squash = 0) {
  const w = 12 + squash
  const h = 9 - squash
  const x0 = Math.round(x - w / 2)
  const y0 = Math.round(ground - h - lift)
  px(ctx, "#00000030", x0 + 1, ground - 1, w - 2, 2)
  px(ctx, "#d98b4a", x0, y0, w, h)
  px(ctx, "#f2c29a", x0 + (face > 0 ? 6 : 1), y0 + 3, 5, 5)
  px(ctx, "#d98b4a", x0 + (face > 0 ? 8 : 1), y0 - 3, 3, 3)
  px(ctx, "#1b2430", x0 + (face > 0 ? 9 : 2), y0 + 3, 1, 2)
}
