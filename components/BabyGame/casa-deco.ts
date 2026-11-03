/**
 * components/BabyGame/casa-deco.ts — what makes the shells rich: mouldings, niches, light on the floor, light in the air
 *
 * `decorate` runs once per room over the painted shell (before the wall pieces): a sculpted ribbon of plaster along the springing
 * of the vault, oval niches with a pearl light, the shadow where wall meets floor, a soft sheen on the floor and the room's light
 * thrown down onto it (stars from the cut domes, coloured discs from the round windows, the lattice's shadow, glass-block
 * squares, the skylight ovals). `drawAmbient` runs every frame over the bodies: slow shafts of light and dust drifting in
 * them. After the plaster-sculpted rooms of the "future home" board (`homedesignref/`: 0014, 0037, 0050, 0058, 0062).
 * Coordinates are the room's own, the wall from y = -CEIL*CT down to 128, the floor from 128.
 */

import { CEIL, CT, type FloorId } from "@/lib/baby-game/casa"
import { bayerAt } from "./dither"
import { clamp, disc, h2, LEAD, mix, PLASTER, px, type Ctx } from "./casa-kit"

/** Paint `color` at `alpha` through the dither wherever `density(x, y)` (0..1) beats the grain. */
function stipple(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, color: string, alpha: number, density: (x: number, y: number) => number) {
  ctx.globalAlpha = alpha
  for (let y = Math.floor(y0); y < y1; y++) for (let x = Math.floor(x0); x < x1; x++) if (bayerAt(x, y) < density(x, y)) px(ctx, color, x, y)
  ctx.globalAlpha = 1
}

/** A raised ribbon of plaster that waves across the wall, lit on its top edge, shaded under it. */
function ribbon(ctx: Ctx, x0: number, x1: number, y: number, amp: number, freq: number, thick = 4) {
  for (let x = x0; x < x1; x++) {
    const cy = y + amp * Math.sin(x * freq) + amp * 0.4 * Math.sin(x * freq * 2.3 + 1)
    const top = Math.round(cy)
    px(ctx, PLASTER[4]!, x, top - 1)
    for (let k = 0; k < thick; k++) px(ctx, PLASTER[k < 1 ? 4 : k < thick - 1 ? 3 : 2]!, x, top + k)
    px(ctx, PLASTER[0]!, x, top + thick)
    ctx.globalAlpha = 0.28
    px(ctx, "#4c6a76", x, top + thick + 1, 1, 2)
    ctx.globalAlpha = 1
  }
}

/** An oval niche cut into the wall: shaded inside, a rim of plaster, a pearl set in it that glows. */
function niche(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, tint = "#8fb6b4") {
  disc(ctx, cx, cy, rx + 3, ry + 3, (x, y) => (x + y < cx + cy ? PLASTER[4]! : PLASTER[2]!))
  disc(ctx, cx, cy, rx, ry, (x, y) => {
    const e = Math.hypot((x - cx) / rx, (y - cy) / ry)
    const lit = clamp(0.35 + 0.5 * ((x - cx) / rx) * -0.5 + 0.4 * ((y - cy) / ry) * 0.5, 0, 1)
    return mix(tint, "#e6f2ec", clamp(lit + (1 - e) * 0.15 + (bayerAt(x, y) - 0.5) * 0.2, 0, 1))
  })
  disc(ctx, cx, cy + ry * 0.35, rx * 0.5, rx * 0.5, (x, y) => (x < cx - 1 && y < cy + ry * 0.35 - 1 ? "#ffffff" : "#d8eef4"))
  stipple(ctx, cx - rx * 2, cy - ry * 1.4, cx + rx * 2, cy + ry * 1.6, "#ffffff", 0.35, (x, y) => clamp(1 - Math.hypot((x - cx) / (rx * 2), (y - cy - ry * 0.35) / (ry * 1.5)), 0, 1) * 0.6)
}

/** The wall-to-floor shadow, then a soft sheen (broad pale ovals) that the room's polish gives. */
function floorLife(ctx: Ctx, W: number, H: number, sheen: string, spots: Array<[number, number, number, number]>) {
  stipple(ctx, 0, 128, W, 150, "#2a4a64", 0.34, (_x, y) => clamp(1 - (y - 128) / 22, 0, 1) * 0.9)
  for (const [cx, cy, rx, ry] of spots) stipple(ctx, cx - rx, cy - ry, cx + rx, cy + ry, sheen, 0.22, (x, y) => clamp(1 - Math.hypot((x - cx) / rx, (y - cy) / ry), 0, 1) * 1.3)
  void H
}

/** A six-point star of floor light. */
function starPatch(ctx: Ctx, sx: number, sy: number, R: number, color: string, alpha: number) {
  ctx.globalAlpha = alpha
  for (let y = Math.floor(sy - R); y <= Math.ceil(sy + R); y++) {
    for (let x = Math.floor(sx - R * 1.5); x <= Math.ceil(sx + R * 1.5); x++) {
      const dx = (x - sx) / 1.5
      const a = Math.atan2(y - sy, dx)
      const k = Math.abs(((a * 6) / (Math.PI * 2)) % 1)
      if (Math.hypot(dx, y - sy) <= R * (0.38 + 0.62 * Math.abs(k * 2 - 1) ** 1.2)) px(ctx, color, x, y)
    }
  }
  ctx.globalAlpha = 1
}

/** A slanted ellipse of window light on the floor with a lead cross shadowed across it. */
function windowPatch(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, tint: string) {
  ctx.globalAlpha = 0.3
  disc(ctx, cx, cy, rx, ry, (x, y) => (Math.abs(x - cx - (y - cy) * 0.6) < 1.2 || Math.abs(y - cy) < 1 ? LEAD : tint))
  ctx.globalAlpha = 0.18
  disc(ctx, cx, cy, rx + 3, ry + 1.5, "#ffffff")
  ctx.globalAlpha = 1
}

/** A grid of cells of light, each a different pale glass. */
function cellLight(ctx: Ctx, x0: number, y0: number, cols: number, rows: number, cw: number, ch: number, skew: number, cols_: readonly string[], alpha = 0.26) {
  ctx.globalAlpha = alpha
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const col = cols_[Math.floor(h2(c, r, 21) * cols_.length)]!
      const sx = x0 + c * cw + r * skew
      px(ctx, col, sx, y0 + r * ch, cw - 1, ch - 1)
    }
  }
  ctx.globalAlpha = 1
}

export function decorate(ctx: Ctx, id: FloorId, W: number, H: number) {
  // the ribbon along the springing of the vault, and the polish of the floor, in every room
  if (id === 0) {
    ribbon(ctx, 0, W, 4, 2.4, 0.045)
    floorLife(ctx, W, H, "#ffffff", [[256, 150, 150, 14], [110, 220, 90, 30], [400, 230, 70, 24]])
    // star light under the cut domes
    for (const [x, y, R] of [[132, 196, 9], [186, 226, 6], [96, 240, 6], [394, 206, 9], [350, 242, 6], [440, 232, 6]] as const) starPatch(ctx, x, y, R, "#ffffff", 0.34)
  } else if (id === 1) {
    ribbon(ctx, 0, W, 6, 2.4, 0.04)
    floorLife(ctx, W, H, "#fff6ea", [[240, 160, 200, 16], [180, 250, 120, 40], [440, 260, 90, 30]])
  } else if (id === 2) {
    ribbon(ctx, 0, W, -12, 2.8, 0.05)
    floorLife(ctx, W, H, "#fff6ea", [[256, 150, 200, 14], [160, 240, 120, 36], [380, 250, 100, 34]])
    // the pebble skylights lay their ovals on the floor
    for (const [x, y, rx, ry] of [[190, 222, 34, 12], [330, 232, 38, 13]] as const) {
      ctx.globalAlpha = 0.26
      disc(ctx, x, y, rx, ry, (px0, py0) => ((Math.floor((px0 - x) / 6) + Math.floor((py0 - y) / 5)) % 2 ? "#ffffff" : "#bfe0f0"))
      ctx.globalAlpha = 1
    }
  } else if (id === 3) {
    ribbon(ctx, 0, W, 4, 2.6, 0.05)
    floorLife(ctx, W, H, "#ffffff", [[256, 170, 160, 12], [100, 240, 70, 24], [420, 240, 70, 24]])
    windowPatch(ctx, 118, 214, 34, 13, "#ffffff")
    windowPatch(ctx, 408, 214, 34, 13, "#ffffff")
  } else if (id === 4) {
    ribbon(ctx, 0, W, 108, 1.2, 0.07, 3)
    floorLife(ctx, W, H, "#ffffff", [[256, 160, 220, 14], [256, 240, 160, 40]])
    // the iron lattice throws its shadow in lozenges over the stone
    ctx.globalAlpha = 0.16
    for (let k = -8; k < 24; k++) {
      for (let y = 130; y < H; y += 2) {
        const x = k * 28 + (y - 130) * 0.7
        px(ctx, "#2f4a40", x, y, 2, 1)
        px(ctx, "#2f4a40", k * 28 + 14 - (y - 130) * 0.5, y, 2, 1)
      }
    }
    ctx.globalAlpha = 1
  } else {
    ribbon(ctx, 0, W, 8, 2.2, 0.05)
    floorLife(ctx, W, H, "#ffffff", [[256, 150, 200, 14], [120, 240, 100, 34]])
    // the glass-block wall casts its squares across the parquet
    cellLight(ctx, 52, 146, 12, 7, 14, 11, 4, ["#ffffff", "#cfe8f4", "#d8f0e4", "#e6dcf4"], 0.24)
  }
}

// ─── in the air ─────────────────────────────────────────────────────────────

/** Shafts: top-left (x, y), bottom-left (x, y), width. In room pixels (the ceiling rows are already counted). */
const SHAFTS: Record<FloorId, Array<[number, number, number, number, number]>> = {
  0: [],
  1: [[140, 50, 90, 250, 70], [250, 50, 210, 260, 60], [330, 50, 360, 250, 50]],
  2: [[150, 10, 130, 230, 46], [300, 10, 290, 240, 50]],
  3: [[50, 40, 120, 220, 44], [422, 40, 360, 220, 44]],
  4: [[90, -20, 140, 240, 60], [250, -20, 310, 240, 60], [400, -20, 440, 240, 50]],
  5: [[30, 20, 100, 200, 60], [100, 20, 190, 200, 50]],
}

/** The light that moves: shafts that breathe, and motes that drift through them. `cam` is the camera's offset. */
export function drawAmbient(ctx: Ctx, id: FloorId, t: number) {
  const dy = CEIL * CT
  for (const [x0, y0, x1, y1, wd] of SHAFTS[id]) {
    const breath = 0.8 + 0.2 * Math.sin(t * 0.6 + x0)
    for (const [k, a] of [[0, 0.07], [0.45, 0.06]] as const) {
      ctx.globalAlpha = a * breath
      ctx.fillStyle = "#ffffff"
      ctx.beginPath()
      ctx.moveTo(x0 + wd * k * 0.5, y0 + dy)
      ctx.lineTo(x0 + wd * (1 - k * 0.5), y0 + dy)
      ctx.lineTo(x1 + wd * (1 - k * 0.5), y1 + dy)
      ctx.lineTo(x1 + wd * k * 0.5, y1 + dy)
      ctx.closePath()
      ctx.fill()
    }
    ctx.globalAlpha = 1
    for (let m = 0; m < 7; m++) {
      const ph = (t * 0.05 + h2(m, x0, 2)) % 1
      const my = y0 + (y1 - y0) * ph
      const mx = x0 + (x1 - x0) * ph + wd * h2(m, x0, 3) + Math.sin(t * 0.9 + m * 2.1) * 3
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 1.3 + m * 1.7)
      px(ctx, "#ffffff", mx, my + dy, 1, 1)
    }
    ctx.globalAlpha = 1
  }
}
