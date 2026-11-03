/** Walk cycles from `lib/baby-game/walk.ts`, shown big enough to judge the feet. */
import { paintGrid, playerGrid, spriteGrid, type SpriteView } from "@/lib/baby-game/sprites"
import { cachedWalk, type WalkFrame } from "@/lib/baby-game/walk"
import { type Effect, FX_W, meadow, px } from "./types"

const LOOP = 4

function sprite(ctx: CanvasRenderingContext2D, id: string, view: SpriteView, frame: WalkFrame, x: number, ground: number, face: 1 | -1) {
  const base = id === "player" ? playerGrid(view) : spriteGrid(id, view)
  const grid = cachedWalk(id, base, view, frame)
  px(ctx, "#0000002e", x - 7, ground - 1, 14, 3)
  ctx.save()
  ctx.translate(Math.round(x), Math.round(ground - 30))
  ctx.scale(face, 1)
  paintGrid(ctx, grid, -16, 0, 1)
  ctx.restore()
}

const frameAt = (t: number, rate: number) => (Math.floor(t * rate) & 3) as WalkFrame
const across = (t: number, pad: number) => {
  const u = (t % LOOP) / LOOP
  return { x: pad + (u < 0.5 ? u * 2 : 2 - u * 2) * (FX_W - pad * 2), face: (u < 0.5 ? 1 : -1) as 1 | -1 }
}

export const walk: Effect = {
  id: "walk",
  label: "Walk cycles",
  loop: LOOP,
  use: "Every body that walks. Frames are made from the still grids, not hand drawn.",
  drafts: {
    A: {
      note: "A fox crosses the meadow, side view, 8 steps a second.",
      draw(ctx, t) {
        meadow(ctx)
        const { x, face } = across(t, 30)
        sprite(ctx, "fox", "side", frameAt(t, 8), x, 134, face)
      },
    },
    B: {
      note: "The Center of The World, side then toward you, running pace.",
      draw(ctx, t) {
        meadow(ctx)
        const { x, face } = across(t, 30)
        sprite(ctx, "player", "side", frameAt(t, 13), x, 134, face)
        sprite(ctx, "player", "front", frameAt(t, 8), 60, 176, 1)
        sprite(ctx, "player", "back", frameAt(t, 8), 100, 176, 1)
      },
    },
    C: {
      note: "A row of friends, all walking in place: side, front, back.",
      draw(ctx, t) {
        meadow(ctx)
        const ids = ["hedgehog", "capybara", "owl", "otter", "bunny", "penguin"]
        ids.forEach((id, i) => {
          sprite(ctx, id, "side", frameAt(t + i * 0.1, 8), 28 + i * 48, 96, 1)
          sprite(ctx, id, "front", frameAt(t + i * 0.1, 8), 28 + i * 48, 136, 1)
          sprite(ctx, id, "back", frameAt(t + i * 0.1, 8), 28 + i * 48, 176, 1)
        })
      },
    },
    D: {
      note: "The friends snapped from liked generations (gen-sprites.ts): side crossing, then front and back in place.",
      draw(ctx, t) {
        meadow(ctx)
        const ids = ["duckling", "blackduck", "kitten"]
        ids.forEach((id, i) => {
          const { x, face } = across(t + i * 0.7, 30)
          sprite(ctx, id, "side", frameAt(t + i * 0.1, 8), x, 70 + i * 30, face)
          sprite(ctx, id, "front", frameAt(t + i * 0.1, 8), 200 + i * 40, 176, 1)
          sprite(ctx, id, "back", frameAt(t + i * 0.1, 8), 60 + i * 40, 176, 1)
        })
      },
    },
  },
}
