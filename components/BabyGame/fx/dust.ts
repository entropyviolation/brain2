/** Footstep dust: what a step leaves behind on soft ground. */
import { type Effect, FX_W, critter, easeOut, hash, meadow, px } from "./types"

const LOOP = 4
const GROUND = 134
const STEP = 0.14

/** Triangle walk: left to right and back across the loop. */
const walkX = (t: number) => {
  const u = ((t % LOOP) + LOOP) % LOOP / LOOP
  return 40 + (u < 0.5 ? u * 2 : 2 - u * 2) * (FX_W - 80)
}
const walkFace = (t: number): 1 | -1 => (((t % LOOP) + LOOP) % LOOP < LOOP / 2 ? 1 : -1)

function walker(ctx: CanvasRenderingContext2D, t: number) {
  const hop = Math.abs(Math.sin(t * 22)) > 0.8 ? 1 : 0
  critter(ctx, walkX(t), GROUND, walkFace(t), hop)
}

function eachPuff(t: number, life: number, fn: (age: number, x: number, k: number, face: 1 | -1) => void) {
  const first = Math.floor(t / STEP)
  for (let j = 0; j < Math.ceil(life / STEP) + 1; j++) {
    const k = first - j
    const ts = k * STEP
    const age = (t - ts) / life
    if (age < 0 || age >= 1) continue
    fn(age, walkX(ts), k, walkFace(ts))
  }
}

export const dust: Effect = {
  id: "dust",
  label: "Footstep dust",
  loop: LOOP,
  use: "Player and friends walking or running; tint by tile.",
  drafts: {
    A: {
      note: "Pale specks lift and shrink, 2 to 3 per step.",
      draw(ctx, t) {
        meadow(ctx)
        eachPuff(t, 0.5, (age, x, k, face) => {
          for (let i = 0; i < 3; i++) {
            const dx = (hash(k, i) - 0.5) * 6 - face * 5
            const rise = easeOut(age) * (3 + hash(k, i + 9) * 4)
            const size = age < 0.55 ? 2 : 1
            px(ctx, age < 0.3 ? "#e8eddc" : "#c3cdb4", x + dx, GROUND - 1 - rise, size, size)
          }
        })
        walker(ctx, t)
      },
    },
    B: {
      note: "Grass blades flick up and fall back, with gravity.",
      draw(ctx, t) {
        meadow(ctx)
        eachPuff(t, 0.45, (age, x, k, face) => {
          for (let i = 0; i < 2; i++) {
            const vx = (hash(k, i) * 12 + 4) * -face
            const vy = -(14 + hash(k, i + 4) * 10)
            const s = age * 0.45
            const bx = x + vx * s
            const by = GROUND - 1 + vy * s + 70 * s * s
            px(ctx, i ? "#8fcf7a" : "#5fa05a", bx, by, 1, 2)
          }
        })
        walker(ctx, t)
      },
    },
    C: {
      note: "A low ring of single dots spreads out behind the heel.",
      draw(ctx, t) {
        meadow(ctx)
        eachPuff(t, 0.4, (age, x, _k, face) => {
          const r = 2 + easeOut(age) * 7
          const fade = age > 0.6
          for (let i = 0; i < 5; i++) {
            const a = (i / 4) * Math.PI
            const dx = Math.cos(a) * r * 0.9
            const dy = Math.sin(a) * r * 0.35
            if (fade && i % 2) continue
            px(ctx, "#d6dcc8", x - face * (3 + Math.abs(dx)), GROUND - 1 - dy, 1, 1)
          }
        })
        walker(ctx, t)
      },
    },
  },
}
