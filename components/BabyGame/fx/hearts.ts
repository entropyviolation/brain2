/** Heart burst: trust went up. */
import { type Effect, FX_W, clamp01, critter, easeOut, hash, meadow, px } from "./types"

const LOOP = 2.4
const GROUND = 134
const CX = FX_W / 2
const HEART = ["01010", "11111", "11111", "01110", "00100"]

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, hi: string, lo: string) {
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 5; c++) {
      if (HEART[r][c] === "1") px(ctx, r < 2 && c < 2 ? hi : lo, x + c, y + r)
    }
}

const COUNT = 7
const T0 = 0.25

export const hearts: Effect = {
  id: "hearts",
  label: "Heart burst",
  loop: LOOP,
  use: "Loved gift, trust up, a favor finished.",
  drafts: {
    A: {
      note: "Hearts rise on a sine drift, ease-out, staggered.",
      draw(ctx, t) {
        meadow(ctx)
        const hop = t > T0 && t < T0 + 0.18 ? 3 : 0
        critter(ctx, CX, GROUND, 1, hop)
        for (let i = 0; i < COUNT; i++) {
          const age = (t - T0 - i * 0.07) / 1.2
          if (age < 0 || age > 1) continue
          const x = CX - 22 + i * 7 + Math.sin(age * 6 + i) * 3
          const y = GROUND - 14 - easeOut(age) * (26 + hash(i) * 14)
          if (age > 0.75 && i % 2) continue
          heart(ctx, x, y, "#ffb3d1", "#f0609a")
        }
      },
    },
    B: {
      note: "Radial pop, then they slow and float up.",
      draw(ctx, t) {
        meadow(ctx)
        const hop = t > T0 && t < T0 + 0.12 ? 2 : 0
        critter(ctx, CX, GROUND, 1, hop)
        for (let i = 0; i < COUNT; i++) {
          const age = (t - T0) / 1.3
          if (age < 0 || age > 1) continue
          const a = -Math.PI / 2 + (i / (COUNT - 1) - 0.5) * 2.2
          const burst = easeOut(age * 2.2)
          const float = clamp01(age - 0.35) * 12
          const x = CX + Math.cos(a) * 24 * burst
          const y = GROUND - 14 + Math.sin(a) * 24 * burst - float
          if (age > 0.8 && (i + Math.floor(age * 20)) % 2) continue
          heart(ctx, x - 2, y, "#ffb3d1", "#f0609a")
        }
      },
    },
    C: {
      note: "One big heart pops (1 to 2 to 1 px steps), small ones orbit up.",
      draw(ctx, t) {
        meadow(ctx)
        critter(ctx, CX, GROUND, 1, 0)
        const age = (t - T0) / 1.4
        if (age >= 0 && age <= 1) {
          const sz = age < 0.1 ? 1 : age < 0.2 ? 2 : 1
          const x = CX - 2
          const y = GROUND - 26 - easeOut(age) * 14
          for (let r = 0; r < 5; r++)
            for (let c = 0; c < 5; c++)
              if (HEART[r][c] === "1") px(ctx, r < 2 && c < 2 ? "#ffb3d1" : "#f0609a", x - (sz - 1) * 2 + c * sz, y + r * sz, sz, sz)
          for (let i = 0; i < 4; i++) {
            const a = age * 7 + (i * Math.PI) / 2
            px(ctx, i % 2 ? "#ffb3d1" : "#f0609a", CX + Math.cos(a) * 12, y + 2 + Math.sin(a) * 4 - age * 6, 1, 1)
          }
        }
      },
    },
  },
}
