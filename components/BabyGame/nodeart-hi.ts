/**
 * components/BabyGame/nodeart-hi.ts — Gather nodes and crops at three times the detail
 *
 * Hi-res versions of `drawNodeArt` and `drawCrop` in `art.ts`, painted in thirds of a game pixel (a tile is 48 units) and
 * drawn live so reeds sway, ripe fruit bobs and the fish shadow swims. A node that is not `ready` is shown dim. Crop colours
 * come from `CROP_ART` in `art.ts`, so a new crop needs no new painter. Both return false when the frame is not scaled up,
 * and the caller falls back to the game-pixel painters.
 */

import { CROP_ART } from "./art"
import { disc, hash, line, Q, r, type Ctx } from "./proparthi-kit"

const flat = (c: Ctx, cx = 24, rx = 18, y = 44, color = "rgba(20,30,20,0.25)") => disc(c, color, cx, y, rx, 3)

type NodePainter = (c: Ctx, t: number, dim: boolean, x: number) => void

/** A leaf cluster: dark rim, mid body, bright top-left, with a few veins. */
function clump(c: Ctx, cx: number, cy: number, rx: number, ry: number, col: [string, string, string]) {
  disc(c, col[0], cx, cy + 1, rx, ry)
  disc(c, col[1], cx, cy, rx - 1, ry - 1)
  disc(c, col[2], cx - rx / 3, cy - ry / 3, Math.max(1, rx / 2), Math.max(1, ry / 2.4))
}

const NODES: Record<string, NodePainter> = {
  berry(c, _t, dim) {
    flat(c)
    const col: [string, string, string] = dim ? ["#3d7a50", "#4f8f62", "#62a073"] : ["#235f38", "#3d9a58", "#7fd890"]
    for (const [cx, cy, rx, ry] of [[14, 30, 12, 10], [34, 30, 12, 10], [24, 24, 16, 13], [24, 36, 18, 8]] as const) clump(c, cx, cy, rx, ry, col)
    r(c, "#1f5a3a", 12, 38, 24, 4)
    if (!dim)
      for (const [bx, by] of [[10, 26], [22, 16], [32, 28], [18, 34], [38, 20], [28, 38], [14, 18]] as const) {
        disc(c, "#8a1f3a", bx + 1, by + 1, 4, 4)
        disc(c, "#c8324e", bx, by, 4, 4)
        r(c, "#f0607a", bx - 2, by - 2, 2, 2)
        r(c, "#4a8a3a", bx - 1, by - 5, 3, 1)
      }
  },
  acorn(c, _t, dim) {
    flat(c, 24, 14, 45)
    r(c, "#4e3224", 21, 26, 6, 20)
    r(c, "#6b4630", 21, 26, 3, 20)
    r(c, "#8a5a44", 20, 44, 8, 2)
    const col: [string, string, string] = dim ? ["#3d7a50", "#4f8f62", "#62a073"] : ["#1f6a3a", "#45a05a", "#8fdc92"]
    for (const [cx, cy, rx, ry] of [[14, 14, 11, 9], [34, 14, 11, 9], [24, 8, 14, 9], [24, 20, 16, 8]] as const) clump(c, cx, cy, rx, ry, col)
    if (!dim)
      for (const [bx, by] of [[12, 24], [32, 22], [24, 31]] as const) {
        disc(c, "#a8683c", bx, by + 3, 4, 5)
        disc(c, "#d09060", bx - 1, by + 2, 2, 3)
        disc(c, "#5f3f31", bx, by - 1, 5, 3, -3, 1)
        r(c, "#3a2418", bx, by - 5, 1, 2)
      }
  },
  reed(c, t, dim, x) {
    flat(c, 24, 20, 45, "rgba(30,60,90,0.25)")
    disc(c, "rgba(255,255,255,0.28)", 24, 44, 14, 2)
    const stalks: Array<[number, number]> = [[8, 34], [15, 40], [23, 37], [31, 40], [39, 32], [27, 28]]
    stalks.forEach(([bx, h], i) => {
      const sway = Math.sin(t * 1.6 + x * 0.3 + i) * 2
      for (let y = 0; y < h; y++) {
        const k = y / h
        r(c, dim ? "#7aa07a" : k > 0.6 ? "#2a9a4a" : "#4fbf5a", bx + sway * k * k, 44 - y, 2, 1)
      }
      r(c, dim ? "#6a8f6a" : "#2a7a3e", bx + 1 + sway * 0.4, 44 - h * 0.4, 1, h * 0.4)
      if (!dim) {
        const tx = bx + sway
        r(c, "#6b4630", tx - 1, 44 - h - 8, 5, 10)
        r(c, "#8a5a44", tx, 44 - h - 8, 2, 9)
        r(c, "#3a2418", tx + 1, 44 - h - 10, 1, 3)
      }
    })
    for (let i = 0; i < 3; i++) r(c, "#8fd48a", 4 + i * 14 + (i % 2) * 3, 40 + (i % 2) * 2, 8, 1)
  },
  clover(c, _t, dim) {
    flat(c, 24, 20, 44, "rgba(20,30,20,0.2)")
    const a = dim ? "#7aa87a" : "#2a9a4a"
    const b = dim ? "#8cb88c" : "#5fd27a"
    for (const [bx, by] of [[9, 26], [24, 15], [18, 34], [34, 31]] as const) {
      r(c, "#2a7a3e", bx + 3, by + 4, 2, 10)
      for (const [dx, dy] of [[-3, 0], [3, 0], [0, -4]] as const) {
        disc(c, a, bx + dx + 2, by + dy + 2, 4, 4)
        disc(c, b, bx + dx + 1, by + dy + 1, 2, 2)
      }
      r(c, "#c0f0c0", bx + 2, by - 1, 1, 2)
    }
    if (!dim) {
      disc(c, "#ffffff", 38, 12, 4, 4)
      disc(c, "#fff0a0", 38, 12, 1, 1)
    }
  },
  pebble(c) {
    flat(c, 24, 20, 44, "rgba(20,20,30,0.25)")
    for (const [cx, cy, rx, ry, base, hi, lo] of [[15, 34, 11, 8, "#8e99a4", "#b8c2cb", "#6c7782"], [32, 30, 10, 11, "#9aa6b0", "#cdd6dd", "#6c7782"], [26, 40, 7, 4, "#8e99a4", "#b8c2cb", "#6c7782"]] as const) {
      disc(c, lo, cx, cy + 1, rx, ry)
      disc(c, base, cx, cy, rx - 1, ry - 1)
      disc(c, hi, cx - rx / 3, cy - ry / 3, rx / 2.2, ry / 3)
    }
    r(c, "#6fa05a", 8, 24, 9, 3)
    r(c, "#8fd08a", 10, 23, 4, 1)
  },
  feather(c) {
    flat(c, 24, 16, 44, "rgba(20,30,20,0.18)")
    // a long feather lying on the ground: quill, vane with barbs, a darker tip
    line(c, "#9aa6b0", 8, 40, 38, 14, 2)
    for (let i = 0; i < 26; i++) {
      const x = 12 + i
      const y = 37 - i * 0.9
      const w = 7 - Math.abs(13 - i) * 0.3
      r(c, i % 4 < 2 ? "#ffffff" : "#e6ecf0", x - 3, y - w, 1, w)
      r(c, i % 3 ? "#e6ecf0" : "#cdd6dd", x + 1, y + 1, 1, w - 1)
    }
    r(c, "#6b7886", 8, 40, 5, 2)
    r(c, "#9aa6b0", 34, 14, 5, 3)
  },
  mushroom(c, _t, dim) {
    flat(c, 24, 20, 45)
    const cap = dim ? "#c89aa8" : "#e0506a"
    const lite = dim ? "#dcb4c0" : "#f08aa0"
    const shade = dim ? "#a87a88" : "#b8324e"
    const shroom = (cx: number, base: number, rw: number, rh: number, stem: number) => {
      r(c, "#f3e6dc", cx - stem, base - 14, stem * 2, 14)
      r(c, "#d9c7ba", cx + stem - 2, base - 14, 2, 14)
      disc(c, shade, cx, base - 12, rw, rh, -rh, 1)
      disc(c, cap, cx, base - 13, rw - 1, rh - 1, -rh + 1, 0)
      disc(c, lite, cx - rw / 3, base - 17, rw / 2, rh / 3)
      r(c, "#e8d4c8", cx - rw + 2, base - 12, rw * 2 - 4, 2)
      if (!dim) for (const [dx, dy] of [[-4, -4], [3, -5], [1, -8], [-7, -2]] as const) if (Math.abs(dx) < rw - 2) disc(c, "#ffffff", cx + dx, base - 13 + dy, 2, 2)
    }
    shroom(10, 46, 9, 6, 2)
    shroom(38, 46, 9, 6, 2)
    shroom(24, 46, 14, 11, 4)
  },
  shell(c) {
    flat(c, 24, 16, 44, "rgba(30,60,90,0.2)")
    // a scallop: ribbed fan with a hinge, soft pink and lilac
    for (let a = -1.2; a <= 1.2; a += 0.03) {
      const len = 24 - Math.abs(a) * 3
      for (let k = 6; k < len; k++) {
        const x = 24 + Math.sin(a) * k
        const y = 42 - Math.cos(a) * k * 0.95
        const rib = Math.round(a * 14) % 2 === 0
        r(c, k > len - 3 ? "#d0b8e8" : rib ? "#f4e8f8" : "#e2d0f0", x, y, 1, 1)
      }
    }
    for (let a = -1.1; a <= 1.1; a += 0.275) line(c, "#b89ad8", 24, 40, 24 + Math.sin(a) * 22, 42 - Math.cos(a) * 21)
    r(c, "#9a72e0", 18, 40, 12, 3)
    r(c, "#ffffff", 14, 24, 5, 2)
    r(c, "#fff8ff", 20, 28, 2, 1)
  },
  dig(c, t, dim, x) {
    flat(c, 24, 21, 45, "rgba(20,10,20,0.2)")
    disc(c, dim ? "#a98a6e" : "#7a5238", 24, 36, 21, 9)
    disc(c, dim ? "#bd9e82" : "#a37860", 24, 30, 15, 7)
    disc(c, dim ? "#cdb094" : "#b88a70", 20, 27, 8, 3)
    for (let i = 0; i < 20; i++) r(c, hash(i, 3) > 0.5 ? "#5f3f31" : "#c89a7a", 6 + hash(i, 1) * 36, 24 + hash(1, i) * 18, 2, 1)
    if (!dim) {
      for (const [px, py] of [[14, 36], [32, 38]] as const) disc(c, "#5f3f31", px, py, 3, 2)
      r(c, "#cdd6dd", 24, 24, 6, 2)
      if (Math.sin(t * 3 + x) > 0.6) {
        r(c, "#ffffff", 27, 21, 3, 3)
        r(c, "#ffffff", 28, 19, 1, 7)
      }
    }
  },
  fish(c, t, dim, x) {
    // ripples on the water and a quick fish shadow
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.6 + i / 3) % 1
      for (let a = 0; a < 20; a++) r(c, `rgba(255,255,255,${0.45 * (1 - k)})`, 24 + Math.cos(a / 3.2) * (4 + k * 18), 24 + Math.sin(a / 3.2) * (2 + k * 8), 1, 1)
    }
    if (!dim) {
      const fx = 12 + (Math.sin(t * 1.2 + x) + 1) * 11
      const wig = Math.sin(t * 9) * 2
      disc(c, "rgba(20,50,90,0.45)", fx, 26, 8, 3)
      disc(c, "rgba(20,50,90,0.45)", fx + 11, 26 + wig, 3, 2)
      r(c, "rgba(20,50,90,0.45)", fx + 12, 22 + wig, 3, 3)
      r(c, "rgba(20,50,90,0.45)", fx + 12, 27 + wig, 3, 3)
    }
  },
}

/** A gather node at three times the detail. Returns false when this frame is not scaled up. */
export function drawNodeHi(ctx: Ctx, kind: string, x: number, y: number, ready: boolean, t: number): boolean {
  const paint = NODES[kind]
  if (!paint || ctx.getTransform().a < Q - 0.01) return false
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(1 / Q, 1 / Q)
  paint(ctx, t, !ready, x)
  if (ready && Math.sin(t * 4 + x) > 0.82) {
    r(ctx, "#ffffff", 40, 6, 3, 3)
    r(ctx, "#ffffff", 41, 4, 1, 7)
    r(ctx, "#ffffff", 38, 7, 7, 1)
  }
  ctx.restore()
  return true
}

/** One plot's crop at its stage, at three times the detail. `frac` is growth 0..1; ripe at 1. */
export function drawCropHi(ctx: Ctx, id: string, x: number, y: number, frac: number, t: number): boolean {
  if (ctx.getTransform().a < Q - 0.01) return false
  const a = CROP_ART[id] ?? CROP_ART.glowbean!
  const c = ctx
  c.save()
  c.translate(x, y)
  c.scale(1 / Q, 1 / Q)
  const sway = Math.sin(t * 1.8 + x * 0.4) * 2
  const leaf = (cx: number, cy: number, w: number, h: number, up = false) => {
    disc(c, a.leaf, cx, cy + 1, w, h)
    disc(c, a.leaf2, cx - (up ? 0 : 1), cy, w - 1, h - 1)
    r(c, a.leaf, cx - w + 2, cy, w * 2 - 4, 1)
  }
  if (frac < 0.25) {
    // a seed mound with the first two leaves
    disc(c, "#5a3628", 24, 38, 6, 3)
    r(c, a.leaf, 24, 28, 2, 10)
    leaf(20, 28, 4, 3, true)
    leaf(30, 27, 4, 3, true)
  } else if (frac < 0.6) {
    r(c, a.leaf, 23, 20, 3, 24)
    leaf(14 + sway, 22, 8, 4)
    leaf(34 + sway, 20, 8, 4)
    leaf(16, 32, 7, 3)
    leaf(32, 34, 7, 3)
  } else if (frac < 1) {
    r(c, a.leaf, 23, 12, 3, 32)
    leaf(11 + sway, 18, 9, 5)
    leaf(37 + sway, 16, 9, 5)
    leaf(13, 30, 9, 4)
    leaf(36, 33, 9, 4)
    leaf(24, 10 + sway * 0.5, 10, 4)
    disc(c, a.fruit, 24, 28, 3, 3)
  } else {
    const bob = Math.sin(t * 4 + x) * 2
    disc(c, a.leaf, 24, 36, 18, 8)
    leaf(10, 24, 9, 6)
    leaf(38, 24, 9, 6)
    leaf(24, 38, 14, 5)
    const fruit = (cx: number, cy: number, rx: number, ry: number) => {
      disc(c, a.fruit, cx, cy + bob, rx, ry)
      disc(c, a.fruit2, cx - rx / 3, cy + bob - ry / 3, Math.max(1, rx / 2.4), Math.max(1, ry / 2.4))
    }
    switch (a.shape) {
      case "pod":
        for (const [bx, by] of [[14, 14], [24, 6], [34, 16]] as const) {
          disc(c, "#1f5a3a", bx, by + 11 + bob, 4, 12)
          disc(c, a.fruit, bx, by + 10 + bob, 3, 11)
          r(c, a.fruit2, bx - 2, by + 2 + bob, 1, 8)
          for (let k = 0; k < 3; k++) r(c, "rgba(0,0,0,0.15)", bx, by + 5 + k * 5 + bob, 2, 1)
        }
        break
      case "tall":
        fruit(24, 22, 9, 13)
        r(c, "#2a7a45", 22, 4 + bob, 4, 8)
        r(c, "#4fbf5a", 26, 6 + bob, 4, 2)
        break
      case "leafy":
        fruit(24, 20, 16, 14)
        for (const k of [0, 1, 2, 3]) line(c, a.leaf, 14, 14 + k * 5 + bob, 34, 16 + k * 5 + bob)
        r(c, a.fruit2, 14, 10 + bob, 8, 2)
        break
      case "split":
        fruit(24, 14, 10, 11)
        r(c, "#2e2933", 22, 27, 4, 9)
        r(c, "#2e2933", 20, 34, 8, 2)
        break
      case "mandala":
        fruit(24, 20, 13, 13)
        for (let i = 0; i < 8; i++) {
          const ang = (i * Math.PI) / 4
          line(c, a.fruit2, 24, 20 + bob, 24 + Math.cos(ang) * 10, 20 + bob + Math.sin(ang) * 10)
        }
        disc(c, a.leaf2, 24, 20 + bob, 3, 3)
        break
      case "flicker": {
        fruit(24, 20, 13, 13)
        const phase = Math.floor(t * 3)
        for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if ((i + j + phase) % 2 === 0 && Math.hypot(i - 2, j - 2) < 2.7) r(c, a.fruit2, 14 + i * 4.4, 10 + j * 4.4 + bob, 4, 4)
        break
      }
      case "leek":
        r(c, a.fruit, 19, 4 + bob, 10, 30)
        r(c, a.fruit2, 19, 6 + bob, 3, 20)
        r(c, "rgba(0,0,0,0.12)", 27, 4 + bob, 2, 30)
        for (const dx of [-4, 0, 4]) line(c, a.leaf2, 24 + dx, 6 + bob, 24 + dx * 2, -4 + bob)
        break
      case "quince":
        fruit(24, 24, 13, 10)
        fruit(24, 12, 7, 7)
        r(c, a.leaf2, 22, 2 + bob, 4, 5)
        break
      case "pearl":
        fruit(24, 20, 12, 12)
        disc(c, "#9ad4e6", 24, 31 + bob, 10, 1)
        break
      default:
        fruit(24, 20, 12, 12)
        r(c, a.leaf, 14, 31 + bob, 20, 2)
    }
    if (Math.sin(t * 4 + x * 3) > 0.7) {
      r(c, "#ffffff", 40, 6, 3, 3)
      r(c, "#ffffff", 41, 4, 1, 7)
    }
  }
  c.restore()
  return true
}

