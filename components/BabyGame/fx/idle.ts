/** Idle life from `lib/baby-game/idle.ts`: what a friend does while standing still. */
import { cachedIdle, idlePose } from "@/lib/baby-game/idle"
import { paintGrid, playerGrid, spriteGrid } from "@/lib/baby-game/sprites"
import { type Effect, meadow, px } from "./types"

function body(ctx: CanvasRenderingContext2D, id: string, t: number, x: number, ground: number, scale = 1) {
  const pose = idlePose(id, t)
  const view = pose === "glance" ? "side" : "front"
  const base = id === "player" ? playerGrid(view) : spriteGrid(id, view)
  const grid = pose && pose !== "glance" ? cachedIdle(id, base, view, pose) : base
  px(ctx, "#0000002e", x - 7 * scale, ground - 1, 14 * scale, 3)
  ctx.save()
  ctx.translate(Math.round(x), Math.round(ground - 30 * scale))
  ctx.scale(scale, scale)
  paintGrid(ctx, grid, -16, 0, 1)
  ctx.restore()
}

export const idle: Effect = {
  id: "idle",
  label: "Idle life",
  loop: 12,
  use: "Everyone standing still: blink, breathe, ear flick, glance. Each body keeps its own rhythm.",
  drafts: {
    A: {
      note: "One body at 3×, so you can judge the eyes and the breath.",
      draw(ctx, t) {
        meadow(ctx)
        body(ctx, "fox", t, 152, 150, 3)
      },
    },
    B: {
      note: "A crowd, each on its own clock, at game size.",
      draw(ctx, t) {
        meadow(ctx)
        const ids = ["player", "fox", "owl", "capybara", "bunny", "hedgehog", "otter", "penguin"]
        ids.forEach((id, i) => body(ctx, id, t, 22 + i * 37, 136))
      },
    },
    C: {
      note: "Two rows, same schedule offset: front friends and the player.",
      draw(ctx, t) {
        meadow(ctx)
        const ids = ["kitten", "puppy", "wolf", "seal", "crow", "mouse"]
        ids.forEach((id, i) => body(ctx, id, t, 28 + i * 48, 100, 1.4))
        ids.forEach((id, i) => body(ctx, id, t + 3, 28 + i * 48, 170, 1.4))
      },
    },
  },
}
