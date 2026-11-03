/**
 * components/BabyGame/homeart.ts — Friends' homes, one painter per kind (`lib/baby-game/homes.ts`)
 *
 * Plain rectangles at the game's native pixel size, like `art.ts` and `propart.ts`. Each home fills its own tile and
 * may rise a few pixels above it; the door faces down, toward the tile the friend sleeps on. After dark a lit window
 * glows when its friend is awake inside the hour before bed, and goes dark once they sleep.
 */

import type { HomeKind } from "@/lib/baby-game/homes"

type Ctx = CanvasRenderingContext2D

function px(ctx: Ctx, color: string, x: number, y: number, w = 1, h = 1) {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

const WOOD = { hi: "#c48e74", mid: "#8a5a44", deep: "#6b4630", dark: "#4e3224" }
const STRAW = { hi: "#e4d4c0", mid: "#c8b098", deep: "#9c8268" }
const EARTH = { hi: "#a88a74", mid: "#7e6450", deep: "#56402f", hole: "#2b1d1e" }
const ICE = { hi: "#ffffff", mid: "#e2eef8", deep: "#b8cce0", line: "#9fb6cc" }
const LEAF = { hi: "#8ed17a", mid: "#5fae6a", deep: "#3a8a58" }
const GLOW = "#cfe8ff"

export function drawHome(ctx: Ctx, kind: HomeKind, x: number, y: number, lit: boolean) {
  const shadow = (sx = 1, sw = 14) => px(ctx, "rgba(20,30,20,0.25)", x + sx, y + 13, sw, 3)
  switch (kind) {
    case "nest": {
      // a woven bowl on a short stump, with a feather sticking up
      shadow(2, 12)
      px(ctx, WOOD.mid, x + 6, y + 9, 4, 5)
      px(ctx, WOOD.hi, x + 6, y + 9, 1, 5)
      px(ctx, STRAW.deep, x + 2, y + 6, 12, 3)
      px(ctx, STRAW.mid, x + 1, y + 4, 14, 3)
      for (let i = 0; i < 7; i++) px(ctx, i % 2 ? STRAW.hi : STRAW.deep, x + 2 + i * 2, y + 5, 1, 1)
      px(ctx, EARTH.hole, x + 4, y + 4, 8, 1)
      px(ctx, "#f4faf8", x + 11, y + 1, 1, 3)
      px(ctx, "#cfe0ec", x + 12, y + 1, 1, 2)
      break
    }
    case "burrow": {
      // a grassy mound with a round dark door
      shadow()
      px(ctx, LEAF.deep, x + 1, y + 7, 14, 7)
      px(ctx, LEAF.mid, x + 2, y + 5, 12, 3)
      px(ctx, LEAF.hi, x + 4, y + 4, 8, 1)
      px(ctx, EARTH.mid, x + 5, y + 9, 6, 5)
      px(ctx, EARTH.hole, x + 6, y + 10, 4, 4)
      if (lit) px(ctx, GLOW, x + 7, y + 11, 2, 2)
      px(ctx, "#f0f4f8", x + 3, y + 6, 1, 1)
      px(ctx, "#f0f4f8", x + 12, y + 7, 1, 1)
      break
    }
    case "den": {
      // a rock outcrop with a wide shadowed mouth
      shadow(0, 16)
      px(ctx, "#6c7782", x + 0, y + 5, 16, 9)
      px(ctx, "#9aa6b0", x + 2, y + 2, 12, 4)
      px(ctx, "#cdd6dd", x + 4, y + 1, 7, 2)
      px(ctx, "#4a5560", x + 4, y + 8, 8, 6)
      px(ctx, EARTH.hole, x + 5, y + 9, 6, 5)
      if (lit) px(ctx, "rgba(255,180,140,0.7)", x + 7, y + 12, 2, 1)
      px(ctx, LEAF.mid, x + 0, y + 12, 3, 2)
      px(ctx, LEAF.mid, x + 13, y + 11, 3, 3)
      break
    }
    case "hollow": {
      // a thick old trunk with a round hollow and a little canopy
      shadow(2, 12)
      px(ctx, WOOD.deep, x + 4, y + 0, 8, 14)
      px(ctx, WOOD.mid, x + 5, y + 0, 5, 14)
      px(ctx, WOOD.hi, x + 5, y + 2, 1, 10)
      px(ctx, LEAF.deep, x + 1, y - 6, 14, 6)
      px(ctx, LEAF.mid, x + 3, y - 8, 10, 4)
      px(ctx, LEAF.hi, x + 5, y - 8, 4, 1)
      px(ctx, EARTH.hole, x + 6, y + 5, 4, 5)
      if (lit) px(ctx, GLOW, x + 7, y + 7, 2, 2)
      px(ctx, WOOD.dark, x + 3, y + 13, 3, 1)
      px(ctx, WOOD.dark, x + 10, y + 13, 3, 1)
      break
    }
    case "lodge": {
      // a dome of crossed sticks at the water's edge
      shadow()
      for (let r = 0; r < 8; r++) {
        const w = 6 + r * 1.5
        px(ctx, r % 2 ? WOOD.mid : WOOD.deep, x + 8 - w / 2, y + 5 + r, w, 1)
      }
      for (let i = 0; i < 5; i++) px(ctx, WOOD.hi, x + 3 + i * 2.5, y + 6 + (i % 3), 1, 3)
      px(ctx, EARTH.hole, x + 6, y + 10, 4, 3)
      if (lit) px(ctx, GLOW, x + 7, y + 11, 2, 1)
      break
    }
    case "hutch": {
      // a little wooden house with a peaked cobalt roof and a round window
      shadow()
      px(ctx, WOOD.mid, x + 2, y + 6, 12, 8)
      px(ctx, WOOD.hi, x + 2, y + 6, 12, 1)
      for (let r = 0; r < 5; r++) px(ctx, r % 2 ? "#2f5fe0" : "#6a8ff0", x + 7 - r * 1.5, y + 1 + r, 2 + r * 3, 1)
      px(ctx, WOOD.dark, x + 6, y + 9, 4, 5)
      px(ctx, lit ? GLOW : "#4a5560", x + 11, y + 8, 2, 2)
      break
    }
    case "stall": {
      // an open-fronted stall with a hay rack
      shadow(0, 16)
      px(ctx, WOOD.deep, x + 1, y + 3, 14, 11)
      px(ctx, WOOD.mid, x + 1, y + 3, 14, 1)
      px(ctx, "#b9764a", x + 0, y + 1, 16, 2)
      px(ctx, WOOD.dark, x + 4, y + 6, 8, 8)
      px(ctx, STRAW.hi, x + 4, y + 12, 8, 2)
      px(ctx, STRAW.mid, x + 5, y + 11, 3, 1)
      if (lit) px(ctx, "rgba(207,232,255,0.6)", x + 7, y + 7, 2, 2)
      break
    }
    case "igloo": {
      // a dome of snow blocks with a low tunnel door
      shadow()
      for (let r = 0; r < 9; r++) {
        const w = Math.round(14 * Math.sin(((r + 1) / 9) * (Math.PI / 2)))
        px(ctx, r < 2 ? ICE.hi : ICE.mid, x + 8 - w / 2, y + 4 + r, w, 1)
      }
      px(ctx, ICE.line, x + 3, y + 8, 10, 1)
      px(ctx, ICE.line, x + 6, y + 5, 1, 3)
      px(ctx, ICE.line, x + 10, y + 9, 1, 3)
      px(ctx, ICE.deep, x + 5, y + 10, 6, 4)
      px(ctx, lit ? GLOW : "#6c8aa8", x + 6, y + 11, 4, 3)
      break
    }
  }
}
