/**
 * Rain. The first drafts here (one, then three depths, then dithered mist) were beaten by the game's own rain in
 * `art.ts` `drawRain`, which already has three layers and four-frame crown splashes. So draft A is that, plus the
 * dithered floor mist that went in with the shared grain (`dither.ts`).
 */
import { drawRain } from "../art"
import { type Effect, FX_H, FX_W, meadow } from "./types"

export const rain: Effect = {
  id: "rain",
  label: "Rain",
  loop: 6,
  use: "Rain days. The shipped rain, so any new idea can be compared against it.",
  drafts: {
    A: {
      note: "Shipped: three layers, splashes on open ground, floor mist as dither.",
      draw(ctx, t) {
        meadow(ctx)
        ctx.fillStyle = "rgba(70,100,150,0.16)"
        ctx.fillRect(0, 0, FX_W, FX_H)
        drawRain(ctx, FX_W, FX_H, t, (_x, y) => y > 100, 0, 0)
      },
    },
  },
}
