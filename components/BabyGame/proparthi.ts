/**
 * components/BabyGame/proparthi.ts — Everyday props at three times the detail
 *
 * The same eleven props `art.ts` paints at game-pixel size (well, mailbox, firewood, signpost, birdbath, picnic blanket,
 * scarecrow, wheelbarrow, hay bale, beehive, rowboat), plus the taste props in `proparthi-taste.ts`, painted in thirds of a
 * game pixel: a tile is 48 units wide, so a unit is one real pixel in a frame painted at `DETAIL` (3). They are drawn live
 * (not cached) so the mailbox flag, the bird, the bees and the water keep moving. Any other prop, or a context not scaled
 * up, falls back to `art.ts`. Brushes and palettes are in `proparthi-kit.ts`.
 */

import { disc, hash, LEAF, post, Q, r, shadow, STONE, STRAW, TERRA, tufts, WOOD, type Ctx, type Painter, type PropEnv } from "./proparthi-kit"
import { TASTE } from "./proparthi-taste"

const PAINT: Record<string, Painter> = {
  ...TASTE,
  well(c) {
    shadow(c, 24, 24)
    // the stone ring: courses of bricks, each a slightly different grey
    r(c, STONE.deep, 6, 26, 36, 19)
    for (let row = 0; row < 4; row++) {
      const y = 26 + row * 5
      for (let x = 6 + (row % 2) * 4; x < 42; x += 8) {
        const w = Math.min(7, 42 - x)
        const k = hash(x + row * 13, row)
        r(c, k > 0.66 ? STONE.hi : k > 0.33 ? STONE.mid : "#8e9aa5", x, y, w, 4)
        r(c, STONE.hi, x, y, w, 1)
      }
    }
    r(c, STONE.dark, 6, 44, 36, 1)
    disc(c, STONE.deep, 24, 26, 20, 6)
    disc(c, STONE.hi, 24, 25, 20, 5)
    disc(c, STONE.mid, 24, 26, 17, 4)
    disc(c, "#2a5a86", 24, 26, 15, 3)
    disc(c, "#5a9ed0", 20, 25, 7, 1)
    // posts, the cross beam with its crank, and the rope with its bucket
    post(c, 7, -14, 6, 42, 3)
    post(c, 35, -14, 6, 42, 8)
    r(c, WOOD.deep, 7, -12, 34, 5)
    r(c, WOOD.hi, 7, -12, 34, 1)
    r(c, WOOD.dark, 7, -8, 34, 1)
    r(c, STONE.deep, 40, -10, 9, 2)
    r(c, WOOD.mid, 47, -14, 3, 8)
    r(c, "#d9c7ba", 23, -7, 2, 22)
    for (let y = -6; y < 14; y += 3) r(c, "#b9a79a", 23, y, 2, 1)
    r(c, WOOD.mid, 19, 14, 10, 8)
    r(c, WOOD.hi, 19, 14, 10, 1)
    r(c, STONE.deep, 19, 16, 10, 1)
    r(c, STONE.deep, 19, 20, 10, 1)
    r(c, WOOD.dark, 19, 22, 10, 1)
    // the tiled roof: courses that step out to an overhang, a ridge cap
    for (let row = 0; row < 8; row++) {
      const y = -44 + row * 4
      const half = 5 + row * 3.1
      r(c, row % 2 ? TERRA.mid : TERRA.hi, 24 - half, y, half * 2, 4)
      for (let x = 24 - half + (row % 2) * 3; x < 24 + half; x += 6) r(c, TERRA.deep, x, y, 1, 4)
      r(c, TERRA.deep, 24 - half, y + 3, half * 2, 1)
      r(c, TERRA.rim, 24 - half, y, half * 2, 1)
    }
    r(c, TERRA.deep, 0, -12, 48, 2)
    r(c, TERRA.rim, 21, -47, 6, 3)
    // moss on the stones and flowers at the foot
    for (const [mx, my, mw] of [[8, 38, 8], [30, 42, 7], [14, 29, 5]] as const) {
      r(c, LEAF.deep, mx, my, mw, 3)
      r(c, LEAF.mid, mx + 1, my - 1, mw - 3, 2)
    }
    tufts(c, 2, 46, 46, 5)
  },

  mailbox(c, t) {
    shadow(c, 24, 14)
    post(c, 20, 24, 8, 22, 4)
    r(c, WOOD.dark, 17, 44, 14, 2)
    // the box: a round-topped tin tunnel with a rusty foot, a door end, a slot and a heart
    r(c, "#2a4f86", 8, 12, 32, 16)
    disc(c, "#2a4f86", 24, 12, 16, 8, -8, 0)
    r(c, "#3d6fb0", 9, 12, 30, 14)
    disc(c, "#3d6fb0", 24, 12, 15, 7, -7, 0)
    disc(c, "#6a9ae0", 22, 7, 11, 2, -2, 1)
    r(c, "#6a9ae0", 9, 12, 30, 2)
    r(c, "#244878", 9, 26, 30, 2)
    r(c, "#8a4a38", 12, 27, 6, 1)
    r(c, "#244878", 36, 8, 4, 20)
    r(c, "#5a88c8", 36, 8, 1, 20)
    r(c, "#16305a", 14, 17, 12, 2)
    disc(c, "#ff9db8", 31, 20, 2, 2)
    r(c, "#ff9db8", 28, 18, 6, 1)
    r(c, "#ffffff", 31, 19, 1, 1)
    // a letter peeking from the slot, and a flag that rises and falls
    r(c, "#fff4e6", 15, 14, 9, 4)
    r(c, "#e8c8a8", 15, 17, 9, 1)
    const up = Math.sin(t * 0.4) > -0.2
    r(c, STONE.deep, 41, up ? -4 : 14, 2, up ? 24 : 12)
    r(c, "#e0506a", 43, up ? -4 : 14, 9, 6)
    r(c, "#ff8a9a", 43, up ? -4 : 14, 9, 1)
    r(c, "#a02a44", 43, up ? 1 : 19, 9, 1)
    tufts(c, 10, 40, 46, 9)
  },

  firewood(c) {
    shadow(c, 24, 24)
    // a stack of split logs seen end on: bark ring, then rings of growth, a dark heart
    const log = (cx: number, cy: number, rad: number, seed: number) => {
      disc(c, WOOD.dark, cx, cy, rad + 1, rad + 1)
      disc(c, WOOD.deep, cx, cy, rad, rad)
      disc(c, "#d9a97a", cx, cy, rad - 2, rad - 2)
      disc(c, "#f0d0a0", cx - 1, cy - 1, rad - 4, rad - 4)
      disc(c, "#c89a68", cx, cy, Math.max(1, rad - 6), Math.max(1, rad - 6))
      r(c, WOOD.deep, cx - 1, cy, 2, 1)
      if (hash(seed, 1) > 0.5) r(c, WOOD.dark, cx + 1, cy - rad + 3, 1, 4)
      r(c, "#fff0cc", cx - rad + 3, cy - rad + 3, 2, 1)
    }
    ;[[7, 38], [21, 38], [35, 38], [14, 27], [28, 27], [21, 16]].forEach(([x, y], i) => log(x! + 3, y! + 3, 7, i))
    r(c, LEAF.mid, 12, 8, 14, 2)
    r(c, LEAF.hi, 14, 7, 5, 1)
    // chips on the ground and a splitting axe
    for (const [x, y] of [[2, 46], [40, 45], [44, 47]] as const) r(c, "#d9a97a", x, y, 3, 2)
    r(c, WOOD.mid, 42, 22, 3, 22)
    r(c, WOOD.hi, 42, 22, 1, 22)
    r(c, STONE.mid, 38, 20, 9, 7)
    r(c, STONE.hi, 38, 20, 9, 1)
    r(c, STONE.deep, 38, 26, 9, 1)
    tufts(c, 0, 48, 47, 11)
  },

  signpost(c) {
    shadow(c, 24, 12)
    post(c, 21, 6, 7, 40, 6)
    // vine up the post
    for (let y = 14; y < 44; y += 3) r(c, LEAF.mid, 21 + (y % 6 === 0 ? -1 : 6), y, 2, 2)
    // two plank signs with pointed ends, a pair of nails each, and carved lines for words
    const sign = (x: number, y: number, w: number, dir: 1 | -1, seed: number) => {
      r(c, WOOD.hi, x, y, w, 12)
      r(c, WOOD.mid, x, y + 6, w, 6)
      r(c, WOOD.dark, x, y + 11, w, 1)
      r(c, WOOD.deep, x, y, w, 1)
      for (let i = 0; i < 6; i++) r(c, WOOD.mid, dir > 0 ? x + w + i : x - 6 + i, y + 1 + i, 6 - i, 10 - i * 2 > 0 ? 10 - i * 2 : 1)
      r(c, WOOD.dark, x + 3, y + 4, w - 12, 2)
      r(c, WOOD.dark, x + 3, y + 7, w - 18 + Math.floor(hash(seed, 1) * 6), 1)
      r(c, STONE.deep, dir > 0 ? x + 2 : x + w - 4, y + 2, 2, 2)
    }
    sign(5, 6, 34, 1, 1)
    sign(10, 23, 32, -1, 2)
    tufts(c, 14, 36, 46, 13)
  },

  birdbath(c, t) {
    shadow(c, 24, 18)
    // a stepped plinth, a fluted column, and a wide shallow bowl
    r(c, STONE.deep, 12, 38, 24, 7)
    r(c, STONE.mid, 13, 37, 22, 3)
    r(c, STONE.hi, 12, 37, 24, 1)
    r(c, STONE.dark, 12, 44, 24, 1)
    for (let x = 19; x < 29; x += 3) r(c, x === 19 ? STONE.hi : STONE.deep, x, 22, 2, 15)
    r(c, STONE.mid, 18, 22, 12, 15)
    r(c, STONE.hi, 19, 22, 2, 15)
    disc(c, STONE.deep, 24, 22, 22, 7)
    disc(c, STONE.hi, 24, 20, 22, 6)
    disc(c, STONE.mid, 24, 21, 19, 4)
    disc(c, "#7fc8ee", 24, 21, 17, 3)
    disc(c, "#b4e4f8", 19, 20, 8, 1)
    if (Math.sin(t * 3) > 0.4) {
      const k = 24 + Math.round(Math.sin(t * 1.3) * 8)
      r(c, "#ffffff", k, 20, 3, 1)
      r(c, "#ffffff", k + 1, 19, 1, 3)
    }
    r(c, "#bfeaff", 14, 22, 20, 1)
    // a small blue bird on the rim: round body, light breast, beak, wing, tail, an eye that blinks
    const hop = Math.sin(t * 2.4) > 0.8 ? 3 : 0
    const bx = 31
    const by = 8 - hop
    disc(c, "#3e76a0", bx, by + 6, 7, 5)
    disc(c, "#8fc0e0", bx + 1, by + 8, 5, 3)
    disc(c, "#3e76a0", bx + 4, by + 1, 4, 4)
    r(c, "#ffb03a", bx + 8, by + 2, 3, 2)
    r(c, "#ffd070", bx + 8, by + 2, 3, 1)
    r(c, Math.sin(t * 3.7) > 0.93 ? "#3e76a0" : "#2a1f24", bx + 5, by, 2, 2)
    r(c, "#2a5a80", bx - 8, by + 5, 6, 3)
    r(c, "#245078", bx - 2, by + 4, 6, 4)
    r(c, "#3a2a24", bx - 1, by + 11, 1, 3)
    r(c, "#3a2a24", bx + 3, by + 11, 1, 3)
    r(c, LEAF.mid, 12, 36, 4, 2)
  },

  blanket(c) {
    // a gingham cloth with a frayed edge, laid a little crooked, a basket, bread, a cup and an apple
    r(c, "rgba(60,30,40,0.22)", 2, 12, 46, 34)
    for (let y = 6; y < 42; y++) {
      const skew = Math.round((y - 6) * 0.06)
      for (let x = 1; x < 47; x += 4) {
        const cx = x + skew
        const on = (Math.floor((x - 1) / 4) + Math.floor((y - 6) / 4)) % 2 === 0
        r(c, on ? "#e8708a" : "#f8ccd6", cx, y, Math.min(4, 47 + skew - cx), 1)
      }
    }
    r(c, "#c04060", 1, 6, 47, 1)
    r(c, "#c04060", 1, 41, 47, 1)
    for (let x = 1; x < 48; x += 2) r(c, "#f8ccd6", x, 42, 1, 2 + Math.floor(hash(x, 2) * 2))
    // the wicker basket with a handle, and a napkin
    r(c, WOOD.deep, 24, 18, 20, 16)
    for (let y = 18; y < 34; y += 3) for (let x = 24 + ((y / 3) % 2) * 2; x < 44; x += 4) r(c, y % 6 === 0 ? WOOD.hi : WOOD.mid, x, y, 3, 2)
    r(c, WOOD.dark, 24, 33, 20, 1)
    r(c, WOOD.hi, 23, 17, 22, 2)
    r(c, WOOD.mid, 26, 8, 2, 10)
    r(c, WOOD.mid, 40, 8, 2, 10)
    r(c, WOOD.hi, 26, 8, 16, 2)
    r(c, "#ffffff", 28, 14, 10, 4)
    r(c, "#e8d8e8", 28, 17, 10, 1)
    // a loaf, an apple with a leaf, a little cup
    disc(c, "#c88a4e", 10, 30, 6, 4)
    disc(c, "#e8b878", 9, 28, 5, 2)
    r(c, "#a86a32", 6, 29, 8, 1)
    disc(c, "#d8344e", 14, 20, 4, 4)
    disc(c, "#f08aa0", 12, 18, 1, 1)
    r(c, "#6a4a30", 14, 14, 1, 3)
    r(c, "#4fbf5a", 15, 14, 4, 2)
    r(c, "#ffffff", 34, 36, 7, 5)
    r(c, "#d8e4f4", 34, 40, 7, 1)
    r(c, "#ffffff", 41, 37, 2, 3)
  },

  scarecrow(c) {
    shadow(c, 24, 16)
    // a stake and cross arms with straw hands
    post(c, 21, -20, 6, 66, 5)
    r(c, WOOD.mid, 0, 6, 48, 5)
    r(c, WOOD.hi, 0, 6, 48, 1)
    r(c, WOOD.dark, 0, 10, 48, 1)
    for (const hx of [-4, 44] as const) for (let i = 0; i < 6; i++) r(c, i % 2 ? STRAW.deep : STRAW.mid, hx + i, 4 + (i % 3), 1, 9 - (i % 3))
    // a blue shirt with a pink patch and stitches, straw out of the hem
    r(c, "#3e6aa8", 11, 6, 26, 24)
    r(c, "#5a88c8", 11, 6, 8, 24)
    r(c, "#2a4f86", 33, 6, 4, 24)
    r(c, "#ff9db8", 26, 14, 8, 8)
    r(c, "#ffc8d8", 26, 14, 8, 1)
    for (let i = 0; i < 4; i++) r(c, "#ffffff", 26 + i * 2, 13, 1, 1)
    for (let x = 11; x < 37; x += 3) r(c, STRAW.mid, x, 30, 2, 4 + Math.floor(hash(x, 1) * 5))
    r(c, STRAW.hi, 12, 30, 2, 4)
    // a sack head: button eyes and a stitched smile
    disc(c, "#e8d4a8", 24, -9, 11, 11)
    disc(c, "#f4e6c4", 20, -12, 6, 6)
    disc(c, "#c8b088", 31, -7, 3, 8)
    r(c, "#2a2020", 17, -12, 4, 4)
    r(c, "#2a2020", 27, -12, 4, 4)
    r(c, "#6a5a4a", 18, -11, 1, 1)
    r(c, "#6a5a4a", 28, -11, 1, 1)
    r(c, WOOD.dark, 18, -3, 12, 1)
    r(c, WOOD.dark, 17, -5, 1, 2)
    r(c, WOOD.dark, 30, -5, 1, 2)
    for (let x = 19; x < 30; x += 3) r(c, WOOD.dark, x, -4, 1, 3)
    // a floppy hat with a pink band and a daisy
    disc(c, WOOD.deep, 24, -18, 20, 4)
    disc(c, WOOD.mid, 24, -26, 12, 9, -9, 3)
    disc(c, WOOD.hi, 19, -28, 5, 5)
    r(c, "#ff9db8", 12, -21, 24, 3)
    r(c, "#ffffff", 30, -26, 6, 6)
    r(c, "#fff0a0", 32, -24, 2, 2)
    // a crow sitting on the arm that does not mind
    disc(c, "#2a2a36", 40, 1, 7, 6)
    disc(c, "#3e3e50", 38, 0, 3, 3)
    disc(c, "#2a2a36", 45, -4, 4, 4)
    r(c, "#ffb03a", 48, -4, 4, 2)
    r(c, "#ffffff", 46, -5, 1, 1)
    r(c, "#1a1a24", 32, 3, 4, 3)
    tufts(c, 12, 40, 47, 15)
  },

  wheelbarrow(c) {
    shadow(c, 26, 22)
    // soil heaped in the tub with a seedling coming up
    disc(c, WOOD.deep, 28, 18, 14, 5, -5, 0)
    disc(c, "#7a5640", 28, 18, 12, 4, -4, 0)
    disc(c, "#8a6048", 24, 16, 6, 2)
    for (const x of [18, 28, 36]) r(c, "#5a3e2e", x, 14 + (x % 3), 2, 2)
    r(c, "#3f9f4a", 29, 4, 2, 13)
    r(c, "#6fd078", 31, 6, 7, 3)
    r(c, "#4fbf5a", 21, 8, 8, 3)
    r(c, "#b8f0b8", 32, 6, 4, 1)
    // the tub: a deep red pan with ribs and rivets
    for (let row = 0; row < 14; row++) {
      const inset = Math.round(row * 0.45)
      r(c, row < 2 ? "#f0607a" : row > 11 ? "#8a1f3a" : "#c8324e", 14 + inset, 17 + row, 34 - inset * 2, 1)
    }
    r(c, "#f08aa0", 16, 18, 14, 1)
    for (let x = 22; x < 44; x += 7) r(c, "#a02a44", x, 19, 1, 11)
    for (const x of [16, 44]) r(c, "#f0d0d8", x, 19, 2, 2)
    r(c, "#6a1530", 22, 31, 22, 1)
    // legs, handles, and the front wheel with spokes
    r(c, WOOD.deep, 36, 30, 3, 14)
    r(c, WOOD.mid, 36, 30, 1, 14)
    r(c, WOOD.mid, 40, 30, 10, 3)
    r(c, WOOD.hi, 40, 30, 10, 1)
    r(c, WOOD.deep, 14, 26, 3, 18)
    disc(c, "#2f3640", 8, 36, 9, 9)
    disc(c, "#8e99a4", 8, 36, 6, 6)
    disc(c, "#cdd6dd", 6, 34, 3, 3)
    disc(c, "#2f3640", 8, 36, 2, 2)
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 4
      for (let k = -5; k <= 5; k++) r(c, "#5a6672", 8 + Math.round(Math.cos(a) * k), 36 + Math.round(Math.sin(a) * k), 1, 1)
    }
    tufts(c, 0, 46, 47, 17)
  },

  haybale(c, _t, variant) {
    shadow(c, 24, 24)
    const bale = (bx: number, by: number, w: number, h: number, seed: number) => {
      r(c, STRAW.mid, bx, by, w, h)
      for (let i = 0; i < w * h * 0.35; i++) {
        const sx = bx + Math.floor(hash(i, seed) * (w - 2))
        const sy = by + Math.floor(hash(seed, i) * (h - 1))
        r(c, hash(i, i) > 0.5 ? STRAW.hi : STRAW.deep, sx, sy, 3 + Math.floor(hash(i, 4) * 4), 1)
      }
      r(c, STRAW.hi, bx, by, w, 2)
      r(c, STRAW.deep, bx, by + h - 2, w, 2)
      r(c, STRAW.dark, bx + w - 2, by, 2, h)
      r(c, STRAW.hi, bx, by, 2, h)
      // two bands of twine
      for (const tx of [bx + Math.round(w * 0.25), bx + Math.round(w * 0.7)]) {
        r(c, "#6a4a30", tx, by, 2, h)
        r(c, "#a07a50", tx, by, 1, h)
      }
    }
    bale(2, 18, 44, 27, 1)
    if (variant % 2 === 0) bale(8, 0, 33, 20, 2)
    for (const [x, y, w] of [[0, 24, 6], [42, 38, 6], [18, 46, 8], [30, 46, 5]] as const) r(c, STRAW.hi, x, y, w, 1)
  },

  beehive(c, t) {
    shadow(c, 24, 20)
    // a little stand
    r(c, WOOD.deep, 9, 38, 6, 8)
    r(c, WOOD.deep, 33, 38, 6, 8)
    r(c, WOOD.mid, 3, 33, 42, 6)
    r(c, WOOD.hi, 3, 33, 42, 2)
    r(c, WOOD.dark, 3, 38, 42, 1)
    // a straw skep built of curved coils, each one drawn a little wider than the last
    for (let i = 0; i < 26; i++) {
      const y = 5 + i
      const half = Math.round(18 * Math.sqrt(1 - Math.pow((26 - i) / 28, 2)))
      for (let x = 24 - half; x < 24 + half; x += 2) {
        const k = hash(x + i * 5, Math.floor(i / 4))
        r(c, Math.floor(i / 4) % 2 ? (k > 0.5 ? STRAW.mid : STRAW.deep) : k > 0.5 ? STRAW.hi : STRAW.mid, x, y, 2, 1)
      }
      if (i % 4 === 3) r(c, STRAW.dark, 24 - half, y, half * 2, 1)
      r(c, STRAW.hi, 24 - half, y, 2, 1)
    }
    r(c, STRAW.deep, 22, 2, 4, 4)
    r(c, STRAW.mid, 23, 0, 2, 3)
    // the door, with a landing board
    disc(c, WOOD.dark, 24, 30, 5, 6, -6, 0)
    r(c, WOOD.dark, 19, 29, 10, 3)
    r(c, WOOD.hi, 17, 32, 14, 2)
    // flowers at the foot
    for (const [x, col] of [[3, "#ff9db8"], [8, "#fff4c8"], [40, "#c9a8ff"], [44, "#ff9db8"]] as const) {
      r(c, LEAF.deep, x, 38, 1, 8)
      r(c, col, x - 2, 34, 5, 5)
      r(c, "#f0b050", x, 36, 1, 1)
    }
    // two bees circling, wings beating
    for (let i = 0; i < 2; i++) {
      const bx = 24 + Math.cos(t * 3 + i * 3) * 24
      const by = 10 + Math.sin(t * 4 + i * 2) * 12
      r(c, "#e8b04a", bx, by, 5, 3)
      r(c, "#2a2a36", bx + 1, by, 1, 3)
      r(c, "#2a2a36", bx + 3, by, 1, 3)
      r(c, "rgba(255,255,255,0.85)", bx + 1, by - 2 - (Math.sin(t * 40 + i) > 0 ? 1 : 0), 3, 2)
    }
  },

  rowboat(c) {
    // a little blue boat pulled up on the sand: planked hull, a seat, a rope, an oar across it
    disc(c, "rgba(60,40,20,0.26)", 24, 42, 24, 5)
    for (let row = 0; row < 14; row++) {
      const inset = Math.round(Math.pow(row / 14, 2) * 8)
      r(c, row === 0 ? WOOD.hi : row % 3 === 2 ? "#2a4f86" : row > 10 ? "#244878" : "#4a7ab8", inset, 16 + row, 48 - inset * 2, 1)
    }
    r(c, "#ffffff", 3, 27, 42, 2)
    for (let x = 4; x < 44; x += 8) r(c, "#244878", x, 18, 1, 10)
    r(c, "#6a9ae0", 2, 17, 12, 1)
    // the prow and stern lifted a little, with a white stripe
    r(c, "#4a7ab8", 0, 12, 4, 7)
    r(c, "#4a7ab8", 44, 12, 4, 7)
    r(c, "#6a9ae0", 0, 12, 1, 7)
    r(c, WOOD.hi, 0, 12, 48, 2)
    r(c, WOOD.deep, 4, 14, 40, 3)
    // a seat plank, a coil of rope, and the oar with its blade
    r(c, WOOD.mid, 20, 14, 8, 3)
    r(c, WOOD.hi, 20, 14, 8, 1)
    disc(c, "#d9c7ba", 38, 16, 4, 2)
    r(c, "#b9a79a", 35, 16, 6, 1)
    r(c, WOOD.hi, 10, 4, 3, 22)
    r(c, WOOD.mid, 12, 4, 1, 22)
    disc(c, WOOD.hi, 11, 4, 5, 4)
    disc(c, WOOD.mid, 11, 5, 3, 2)
    r(c, STONE.deep, 7, 32, 2, 2)
    r(c, STONE.deep, 38, 33, 2, 2)
  },
}

/** Paint a prop at three times the detail. Returns false when this kind has no hi-res painter, or the frame is not scaled up. */
export function drawPropHi(ctx: Ctx, kind: string, x: number, y: number, t: number, variant: number, env: PropEnv = { rain: false, night: false }): boolean {
  const paint = PAINT[kind]
  if (!paint || ctx.getTransform().a < Q - 0.01) return false
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(1 / Q, 1 / Q)
  paint(ctx, t, variant, env)
  ctx.restore()
  return true
}
