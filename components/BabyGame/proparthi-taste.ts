/**
 * components/BabyGame/proparthi-taste.ts — The props drawn from what the player loves and dreads, at three times the detail
 *
 * Hi-res versions of `propart.ts`: orb, puddle, prism, library, thrift, collage, fireworks, clock, pendulum, ducklings,
 * sprinkler, microscope, fossil, romanesco, slime, wasps, kitten. Thirds of a game pixel (a tile is 48 units); each one
 * keeps its motion and reads the same `rain` and `night` flags. Brushes are in `proparthi-kit.ts`.
 */

import { COBALT, disc, hash, LEAF, line, post, r, shadow, STONE, tufts, WOOD, type Painter } from "./proparthi-kit"

export const TASTE: Record<string, Painter> = {
  orb(c, t, _v, env) {
    shadow(c, 24, 14)
    // a cobalt-capped stone plinth with a pillar, and a white orb hovering over it with a soft halo
    r(c, STONE.deep, 14, 34, 20, 10)
    r(c, STONE.mid, 15, 34, 18, 8)
    r(c, STONE.hi, 14, 34, 20, 2)
    r(c, COBALT.deep, 13, 41, 22, 3)
    r(c, COBALT.mid, 13, 41, 22, 1)
    r(c, STONE.mid, 20, 24, 8, 10)
    r(c, STONE.hi, 20, 24, 2, 10)
    const bob = Math.sin(t * 1.6) * 3
    const cy = 12 + bob
    const a = env.night ? 0.28 : 0.12
    disc(c, `rgba(225,240,255,${a})`, 24, cy, 22, 20)
    disc(c, `rgba(235,246,255,${a + 0.12})`, 24, cy, 15, 14)
    disc(c, "#eaf4ff", 24, cy, 9, 9)
    disc(c, "#ffffff", 22, cy - 2, 7, 7)
    disc(c, "#cfe8ff", 27, cy + 3, 3, 3)
    r(c, "#ffffff", 19, cy - 5, 3, 1)
    if (env.night) for (let i = 0; i < 3; i++) r(c, "#ffffff", 24 + Math.cos(t * 2 + i * 2.1) * 16, cy + Math.sin(t * 2.5 + i * 2.1) * 12, 1, 1)
  },

  puddle(c, t, _v, env) {
    // a wet patch: dark rim, mid water, sky in it, and a cobalt thing on the far side wobbling
    disc(c, "#4a7ea8", 24, 28, 22, 10)
    disc(c, "#5f93bd", 24, 28, 20, 8)
    disc(c, "#8ec2e6", 24, 28, 17, 6)
    disc(c, "#eaf5ff", 17, 26, 8, 2)
    const wob = Math.sin(t * 2) * 2
    r(c, COBALT.mid, 34 + wob, 24, 3, 7)
    r(c, COBALT.hi, 37 + wob, 28, 2, 6)
    const k = (t * (env.rain ? 5 : 1.5)) % 4
    for (const [cx, cy, ph] of [[18, 31, 0], [30, 33, 1.7]] as const) {
      const rad = 3 + ((k + ph) % 4) * 2.5
      for (let a = 0; a < 24; a++) r(c, "rgba(255,255,255,0.5)", cx + Math.cos(a / 3.8) * rad, cy + Math.sin(a / 3.8) * rad * 0.4, 1, 1)
    }
    if (env.rain) for (let i = 0; i < 4; i++) r(c, "rgba(255,255,255,0.6)", 8 + hash(i, Math.floor(t * 8)) * 32, 22 + hash(Math.floor(t * 8), i) * 12, 1, 3)
    tufts(c, 2, 8, 34, 3)
    tufts(c, 40, 46, 34, 4)
  },

  prism(c, t) {
    shadow(c, 24, 16)
    r(c, STONE.deep, 10, 34, 28, 10)
    r(c, STONE.mid, 11, 34, 26, 8)
    r(c, STONE.hi, 10, 34, 28, 2)
    // a glass triangle with a bright left edge, a white beam in and a fan of colour out
    for (let i = 0; i < 28; i++) {
      const w = 4 + i
      const x = 22 - Math.floor(w / 2)
      r(c, "#d6eeff", x, 4 + i, w, 1)
      r(c, "#9ccaec", x + w - 3, 4 + i, 3, 1)
      r(c, "#ffffff", x, 4 + i, 2, 1)
      if (i % 9 === 4) r(c, "#ffffff", x + 4, 4 + i, w - 8, 1)
    }
    r(c, "#ffffff", 0, 20, 14, 2)
    r(c, "rgba(255,255,255,0.4)", 0, 19, 14, 4)
    const band = ["#ff9db8", "#ffc79d", "#f8f0a0", "#8fe0b8", "#8fa8ff", "#c9a8ff"]
    band.forEach((col, i) => {
      for (let x = 32; x < 48; x++) r(c, col, x, 14 + i * 2 + Math.floor((x - 32) * 0.18 * (i - 2.5)), 1, 2)
    })
    if (Math.sin(t * 3) > 0.7) {
      r(c, "#ffffff", 40, 20, 3, 3)
      r(c, "#ffffff", 41, 18, 1, 7)
      r(c, "#ffffff", 38, 21, 7, 1)
    }
  },

  library(c) {
    shadow(c, 24, 14)
    post(c, 21, 28, 6, 18, 2)
    // a free library: a little cobalt cabinet under a gabled roof, with a glass door of books
    r(c, COBALT.mid, 6, 12, 36, 24)
    r(c, COBALT.hi, 6, 12, 36, 2)
    r(c, COBALT.deep, 6, 34, 36, 2)
    r(c, COBALT.deep, 40, 12, 2, 24)
    r(c, "#cfeaff", 11, 16, 26, 17)
    r(c, "#eaf6ff", 11, 16, 26, 2)
    const spines = ["#e0506a", "#4fbf5a", "#c9a8ff", "#ffffff", "#f6b04a", "#8fa8ff", "#e0506a", "#4fbf5a"]
    spines.forEach((col, i) => {
      const h = 9 + (i % 3) * 2
      r(c, col, 12 + i * 3, 33 - h, 3, h)
      r(c, "rgba(0,0,0,0.18)", 14 + i * 3, 33 - h, 1, h)
    })
    r(c, WOOD.mid, 11, 24, 26, 1)
    r(c, WOOD.dark, 23, 16, 2, 17)
    r(c, "#f2d27a", 34, 26, 2, 3)
    for (let i = 0; i < 9; i++) {
      const half = 22 - i * 2
      r(c, i % 2 ? WOOD.mid : WOOD.deep, 24 - half, 10 - i * 2, half * 2, 2)
    }
    r(c, WOOD.hi, 2, 10, 44, 2)
    r(c, "#fff4c8", 17, 4, 14, 3)
    r(c, WOOD.dark, 19, 5, 10, 1)
    tufts(c, 8, 40, 46, 17)
  },

  thrift(c) {
    // a clothes rail: two posts, a bar, hangers with a red dress, a lilac coat, a mint skirt, a blue tee, a scarf
    disc(c, "rgba(20,30,20,0.26)", 24, 45, 23, 3)
    r(c, STONE.mid, 3, 8, 3, 38)
    r(c, STONE.mid, 42, 8, 3, 38)
    r(c, STONE.hi, 3, 8, 3, 1)
    r(c, STONE.deep, 3, 7, 42, 3)
    r(c, STONE.hi, 3, 7, 42, 1)
    r(c, STONE.deep, 0, 44, 10, 3)
    r(c, STONE.deep, 38, 44, 10, 3)
    const clothes: Array<[string, string, string, number, number, number]> = [
      ["#c8324e", "#8a1f3a", "#e86078", 8, 15, 26],
      ["#c9a8ff", "#a888e8", "#e0d0ff", 18, 12, 22],
      ["#8fe0b8", "#5fc098", "#bff0d8", 28, 12, 24],
      ["#8fa8ff", "#5f7fd8", "#c0d0ff", 38, 11, 20],
    ]
    clothes.forEach(([col, dark, hi, x, w, h], i) => {
      r(c, STONE.deep, x + w / 2 - 1, 10, 1, 4)
      r(c, STONE.mid, x + 1, 13, w - 2, 1)
      r(c, col, x, 14, w, h)
      r(c, dark, x + w - 3, 14, 3, h)
      r(c, hi, x, 14, 2, h)
      if (i === 0) for (let y = 17; y < 14 + h; y += 4) r(c, dark, x, y, w, 1)
      if (i === 1) r(c, "#ffffff", x + 3, 20, 3, 3)
      r(c, dark, x, 13 + h, w, 1)
    })
    r(c, "#ff9db8", 33, 14, 4, 26)
    r(c, "#ffffff", 33, 22, 4, 2)
    r(c, "#ffffff", 33, 30, 4, 2)
    r(c, "#fff4c8", 8, 36, 4, 6)
    r(c, "#e0506a", 14, 40, 8, 4)
    r(c, "#ffffff", 16, 40, 2, 1)
  },

  collage(c) {
    shadow(c, 24, 22)
    // a craft table with a glued collage of scraps, scissors and a paste pot
    r(c, WOOD.mid, 3, 26, 42, 8)
    r(c, WOOD.hi, 3, 26, 42, 2)
    r(c, WOOD.dark, 3, 33, 42, 1)
    r(c, WOOD.deep, 6, 34, 5, 11)
    r(c, WOOD.deep, 37, 34, 5, 11)
    r(c, WOOD.hi, 6, 34, 1, 11)
    r(c, "#f4c0cc", 6, 12, 15, 14)
    r(c, "#8fa8ff", 18, 8, 12, 18)
    r(c, "#8fe0b8", 27, 17, 15, 9)
    r(c, "#ffffff", 21, 14, 7, 7)
    r(c, "#e0506a", 33, 20, 6, 6)
    r(c, "#c9a8ff", 9, 20, 7, 3)
    r(c, "#fff4c8", 11, 14, 4, 4)
    r(c, "#ffffff", 8, 12, 1, 1)
    for (let x = 6; x < 42; x += 4) r(c, "rgba(0,0,0,0.12)", x, 25, 2, 1)
    // scissors, and a little paste pot with a brush
    line(c, STONE.deep, 38, 30, 44, 22, 2)
    line(c, STONE.deep, 40, 30, 42, 22, 2)
    r(c, "#e0506a", 37, 29, 3, 3)
    r(c, "#e0506a", 41, 29, 3, 3)
    r(c, "#ffffff", 0, 22, 5, 5)
    r(c, "#d8e4f4", 0, 26, 5, 1)
    r(c, WOOD.mid, 2, 14, 1, 8)
  },

  fireworks(c, t, _v, env) {
    shadow(c, 24, 22)
    // a wooden crate with a stencilled mark and three rockets with paper fins, fuses and sparks
    r(c, WOOD.mid, 6, 24, 36, 20)
    r(c, WOOD.hi, 6, 24, 36, 2)
    r(c, WOOD.dark, 6, 32, 36, 1)
    r(c, WOOD.dark, 6, 43, 36, 1)
    for (const x of [6, 22, 40]) r(c, WOOD.deep, x, 24, 2, 20)
    r(c, "#e0506a", 14, 35, 6, 6)
    r(c, "#ffffff", 16, 36, 2, 4)
    const rockets: Array<[string, number, number]> = [["#e0506a", 11, 6], ["#2f5fe0", 22, 0], ["#c9a8ff", 33, 9]]
    for (const [col, rx, ry] of rockets) {
      r(c, col, rx, ry + 3, 6, 18)
      r(c, "rgba(255,255,255,0.35)", rx, ry + 3, 2, 18)
      r(c, "#ffffff", rx, ry, 6, 4)
      r(c, "#ffffff", rx + 2, ry - 3, 2, 3)
      r(c, WOOD.deep, rx + 2, ry + 21, 2, 4)
      r(c, col, rx - 2, ry + 16, 2, 5)
      r(c, col, rx + 6, ry + 16, 2, 5)
      line(c, "#4a4a5a", rx + 3, ry - 3, rx + 5, ry - 7)
      if (env.night && Math.sin(t * 7 + rx) > 0.55) {
        r(c, "#fff0a0", rx + 4, ry - 9, 2, 2)
        r(c, "#ffffff", rx + 5, ry - 11, 1, 1)
        r(c, "#ffb03a", rx + 2, ry - 8, 1, 1)
      }
    }
  },

  clock(c, t) {
    shadow(c, 24, 14)
    post(c, 21, 28, 6, 18, 7)
    // a cobalt-framed clock face with ticks, hour numbers' dots and two hands
    disc(c, COBALT.deep, 24, 17, 22, 22)
    disc(c, COBALT.mid, 24, 17, 21, 21)
    disc(c, COBALT.hi, 22, 14, 18, 18, -18, -6)
    disc(c, COBALT.mid, 24, 17, 19, 19)
    disc(c, "#f6f0e6", 24, 17, 17, 17)
    disc(c, "#ffffff", 20, 12, 8, 6)
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6
      const big = i % 3 === 0
      r(c, WOOD.dark, 24 + Math.sin(a) * 14, 17 - Math.cos(a) * 14, big ? 2 : 1, big ? 2 : 1)
    }
    const am = t * 0.7
    const ah = t * 0.06
    line(c, WOOD.dark, 24, 17, 24 + Math.sin(am) * 12, 17 - Math.cos(am) * 12, 2)
    line(c, "#c8324e", 24, 17, 24 + Math.sin(ah) * 8, 17 - Math.cos(ah) * 8, 2)
    disc(c, WOOD.dark, 24, 17, 2, 2)
    r(c, "#ff9db8", 18, 34, 12, 2)
    r(c, COBALT.deep, 14, 36, 20, 2)
  },

  pendulum(c, t) {
    shadow(c, 24, 22)
    // a stone frame with a swinging weight on a thread, and a scale of tick marks along the base
    r(c, STONE.deep, 3, 0, 6, 44)
    r(c, STONE.deep, 39, 0, 6, 44)
    r(c, STONE.hi, 3, 0, 2, 44)
    r(c, STONE.mid, 3, 0, 42, 6)
    r(c, STONE.hi, 3, 0, 42, 1)
    r(c, STONE.dark, 3, 40, 42, 5)
    for (let x = 10; x < 38; x += 4) r(c, STONE.hi, x, 40, 1, x === 24 ? 4 : 2)
    const a = Math.sin(t * 2.2) * 0.7
    const bx = 24 + Math.sin(a) * 24
    const by = 6 + Math.cos(a) * 26
    line(c, "#e8eef2", 24, 6, bx, by)
    disc(c, STONE.deep, bx, by + 4, 6, 6)
    disc(c, "#cdd6dd", bx, by + 4, 5, 5)
    disc(c, "#ffffff", bx - 2, by + 2, 2, 2)
    disc(c, COBALT.mid, bx + 1, by + 6, 2, 2)
    r(c, "rgba(255,255,255,0.15)", Math.min(24, bx), 41, Math.abs(bx - 24) + 1, 2)
  },

  ducklings(c, t) {
    // a hen with four ducklings in a line, hopping as they walk back and forth
    const p = Math.sin(t * 0.6)
    const dir = Math.cos(t * 0.6) >= 0 ? 1 : -1
    const head = 24 + p * 14
    const bird = (bx: number, big: boolean, body: string, hi: string, i: number) => {
      const hop = Math.floor(t * 6 + i) % 2 ? 2 : 0
      const w = big ? 12 : 7
      const h = big ? 9 : 6
      disc(c, "rgba(20,30,20,0.24)", bx, 44, w, 2)
      disc(c, body, bx, 36 - hop, w, h)
      disc(c, hi, bx - dir * 2, 34 - hop, w - 3, h - 3)
      disc(c, body, bx + dir * w * 0.8, 29 - hop - (big ? 3 : 0), big ? 5 : 3, big ? 5 : 3)
      r(c, "#ffb03a", bx + dir * (w * 0.8 + (big ? 4 : 3)) - (dir < 0 ? 3 : 0), 30 - hop - (big ? 3 : 0), 3, 2)
      r(c, "#2a2a36", bx + dir * w * 0.8 + dir, 28 - hop - (big ? 3 : 0), 1, 1)
      r(c, "rgba(0,0,0,0.15)", bx - dir * w, 36 - hop, 3, 2)
      r(c, "#e08a1e", bx - 2, 41, 1, 3)
      r(c, "#e08a1e", bx + 2, 41, 1, 3)
    }
    bird(head, true, WOOD.mid, WOOD.hi, 0)
    for (let i = 1; i <= 4; i++) bird(head - dir * (14 + i * 9), false, "#f6e8b0", "#fff6d0", i)
  },

  sprinkler(c, t) {
    // a wet patch, a short pipe with a cobalt head, and eight arcs of droplets sweeping side to side
    disc(c, "rgba(70,130,190,0.3)", 24, 40, 22, 6)
    disc(c, "rgba(70,130,190,0.25)", 24, 40, 14, 4)
    r(c, STONE.deep, 22, 33, 4, 9)
    r(c, STONE.hi, 22, 33, 1, 9)
    r(c, COBALT.deep, 18, 30, 12, 6)
    r(c, COBALT.mid, 19, 30, 10, 4)
    r(c, COBALT.hi, 19, 30, 4, 1)
    const sweep = Math.sin(t * 1.4)
    for (let k = 0; k < 12; k++) {
      const ph = (t * 2.4 + k / 12) % 1
      const dx = sweep * ph * 24
      const dy = -Math.sin(ph * Math.PI) * 22 + ph * 8
      r(c, k % 2 ? "#bfe8ff" : "#ffffff", 24 + dx, 30 + dy, 2, 2)
      r(c, "#bfe8ff", 24 - dx, 30 + dy, 2, 2)
      if (ph > 0.85) r(c, "rgba(255,255,255,0.5)", 24 + dx * 1.1, 42, 3, 1)
    }
  },

  microscope(c, t) {
    shadow(c, 24, 16)
    // a lab microscope: dark base, curved arm, eyepiece, objective, stage with a slide, mirror and a glint
    r(c, "#2a3036", 8, 38, 32, 6)
    r(c, "#3a4150", 8, 38, 32, 2)
    disc(c, STONE.hi, 32, 26, 5, 14)
    r(c, STONE.hi, 28, 14, 5, 24)
    r(c, STONE.deep, 31, 14, 2, 24)
    r(c, "#2a3036", 11, 2, 9, 5)
    r(c, STONE.hi, 14, 7, 9, 10)
    r(c, STONE.mid, 14, 7, 2, 10)
    r(c, STONE.deep, 17, 17, 8, 9)
    r(c, "#1a1f24", 18, 26, 6, 3)
    r(c, STONE.mid, 8, 30, 24, 3)
    r(c, STONE.hi, 8, 30, 24, 1)
    r(c, "#bfe8ff", 12, 28, 9, 2)
    r(c, "#ffffff", 13, 28, 3, 1)
    disc(c, COBALT.mid, 36, 22, 4, 4)
    disc(c, COBALT.hi, 35, 21, 2, 2)
    disc(c, STONE.mid, 18, 36, 8, 2)
    if (Math.sin(t * 2.5) > 0.7) {
      r(c, "#ffffff", 17, 0, 3, 3)
      r(c, "#ffffff", 18, -2, 1, 7)
    }
    r(c, "#f6f0e6", 22, 41, 5, 2)
  },

  fossil(c) {
    // a flat slab of stone with a coiled ammonite and a small rib-like fragment pressed in
    disc(c, "rgba(20,30,20,0.25)", 24, 40, 24, 4)
    r(c, STONE.deep, 3, 18, 42, 24)
    r(c, STONE.mid, 3, 18, 42, 22)
    r(c, STONE.hi, 3, 18, 42, 2)
    r(c, STONE.dark, 3, 40, 42, 3)
    for (let i = 0; i < 40; i++) r(c, hash(i, 2) > 0.5 ? STONE.hi : STONE.deep, 4 + hash(i, 5) * 38, 21 + hash(5, i) * 17, 2, 1)
    // the log spiral of the shell, with ribs across it
    for (let a = 0; a < 6.2 * 1.8; a += 0.05) {
      const rad = 1.5 + a * 1.6
      const x = 17 + Math.cos(a) * rad
      const y = 30 + Math.sin(a) * rad * 0.9
      r(c, STONE.hi, x, y - 1, 2, 2)
      r(c, STONE.deep, x + 1, y + 1, 1, 1)
      if (Math.floor(a * 6) % 3 === 0) r(c, STONE.dark, x, y, 1, 2)
    }
    disc(c, STONE.deep, 17, 30, 2, 2)
    // a fragment of bone with three ribs
    r(c, STONE.dark, 34, 24, 9, 9)
    r(c, STONE.hi, 34, 24, 9, 1)
    for (const x of [35, 38, 41]) r(c, STONE.deep, x, 26, 1, 6)
  },

  romanesco(c) {
    shadow(c, 24, 22)
    // a whorl of green spiral cones, big at the heart and small at the rim, over crinkled outer leaves
    disc(c, "#2a7a3e", 24, 38, 22, 7)
    disc(c, "#4fbf5a", 24, 36, 20, 5, -5, 0)
    for (const x of [6, 16, 28, 38]) r(c, "#2f8248", x, 33, 3, 9)
    const cone = (cx: number, cy: number, w: number, h: number) => {
      for (let i = 0; i < h; i++) {
        const half = Math.round((w / 2) * (i / h) + 0.5)
        r(c, i % 3 === 0 ? "#2f8248" : "#6fcf7a", cx - half, cy + i, half * 2, 1)
        r(c, "#b8f0b8", cx - half, cy + i, 1, 1)
      }
      r(c, "#d8ffd0", cx, cy, 1, 1)
    }
    const heart: Array<[number, number, number, number]> = [[24, 2, 10, 14], [16, 10, 9, 12], [32, 10, 9, 12], [10, 17, 8, 10], [24, 16, 11, 13], [38, 17, 8, 10], [18, 22, 8, 10], [30, 22, 8, 10], [24, 26, 7, 8], [12, 26, 6, 8], [36, 26, 6, 8]]
    for (const [cx, cy, w, h] of heart) {
      cone(cx, cy, w, h)
      for (const [dx, dy] of [[-2, 4], [2, 5], [0, 8]] as const) cone(cx + dx, cy + dy, 4, 5)
    }
  },

  slime(c, t) {
    shadow(c, 24, 24)
    // a mossy log with a cut end, a sprig of green, and a cream slime mould branching across the bark
    r(c, WOOD.dark, 3, 18, 42, 25)
    r(c, WOOD.deep, 3, 18, 42, 6)
    r(c, WOOD.hi, 3, 21, 6, 18)
    disc(c, WOOD.mid, 7, 31, 4, 11)
    disc(c, "#d9a97a", 7, 31, 3, 9)
    for (let y = 18; y < 42; y += 4) r(c, WOOD.dark, 12, y, 1, 3)
    for (let x = 12; x < 44; x += 5) r(c, hash(x, 3) > 0.5 ? WOOD.deep : "#6b4630", x, 24 + hash(x, 1) * 12, 3, 1)
    r(c, "#4f9a4e", 24, 17, 15, 3)
    r(c, "#7fd07a", 26, 16, 5, 2)
    const path: Array<[number, number]> = [[10, 32], [14, 29], [18, 28], [22, 30], [26, 31], [30, 28], [34, 27], [38, 30], [42, 30], [20, 34], [20, 38], [32, 32], [32, 37], [36, 24], [38, 21]]
    for (const [dx, dy] of path) {
      disc(c, "#f0ecd8", dx, dy, 2, 2)
      disc(c, "#fff8e0", dx - 1, dy - 1, 1, 1)
    }
    for (let i = 0; i < path.length - 1; i++) line(c, "#e8e0c0", path[i]![0], path[i]![1], path[i + 1]![0], path[i + 1]![1])
    const [hx, hy] = path[Math.floor(t * 6) % path.length]!
    disc(c, "#ffffff", hx, hy, 3, 3)
    disc(c, "#f6e8b0", 20, 29, 3, 2)
  },

  wasps(c, t) {
    // a leaning post and arm with a grey paper nest hanging from it in layered rings, and three wasps round it
    shadow(c, 14, 10, 45)
    post(c, 3, 3, 6, 43, 8)
    post(c, 3, 3, 42, 6, 9)
    r(c, WOOD.hi, 3, 3, 42, 1)
    r(c, "#9a8a74", 22, 9, 2, 5)
    const rings: Array<[number, number]> = [[8, 12], [10, 20], [12, 26], [12, 28], [11, 28], [9, 24], [6, 18], [3, 10]]
    rings.forEach(([hw, w], i) => {
      const col = i % 2 ? "#9a8a74" : "#b8a890"
      const y = 14 + i * 3
      r(c, col, 24 - hw, y, hw * 2, 3)
      r(c, "#d8cbb4", 24 - hw, y, 3, 3)
      r(c, "#7a6a54", 24 + hw - 3, y, 3, 3)
      void w
    })
    disc(c, WOOD.dark, 24, 40, 4, 4)
    disc(c, "#241a14", 24, 41, 3, 3)
    for (let i = 0; i < 3; i++) {
      const wx = 24 + Math.cos(t * 4 + i * 2.1) * 18
      const wy = 26 + Math.sin(t * 5 + i * 1.7) * 12
      r(c, "#e8b04a", wx, wy, 6, 3)
      r(c, "#2a2a36", wx + 2, wy, 1, 3)
      r(c, "#2a2a36", wx + 4, wy, 1, 3)
      r(c, "#2a2a36", wx + 5, wy + 1, 2, 1)
      r(c, "rgba(255,255,255,0.85)", wx + 1, wy - 2 - (Math.sin(t * 50 + i) > 0 ? 1 : 0), 4, 2)
    }
  },

  kitten(c, t) {
    // a grey kitten sitting, tail swishing, blinking now and then
    disc(c, "rgba(20,30,20,0.26)", 24, 44, 17, 4)
    const tail = Math.sin(t * 3) * 3
    const fur = "#8e99a4"
    const dark = "#6c7782"
    for (let i = 0; i < 12; i++) r(c, i % 4 === 0 ? dark : fur, 4 + Math.sin(i / 3) * 2 + tail * (i / 12), 32 - i * 0.6 + (i > 8 ? 0 : 0), 3, 5)
    disc(c, fur, 24, 34, 13, 10)
    disc(c, "#a8b2bc", 20, 30, 7, 5)
    r(c, dark, 14, 28, 2, 9)
    r(c, dark, 20, 26, 2, 7)
    r(c, dark, 26, 28, 2, 7)
    disc(c, "#f0ecf5", 33, 41, 5, 3)
    disc(c, "#f0ecf5", 22, 42, 5, 3)
    disc(c, fur, 33, 18, 10, 9)
    disc(c, "#a8b2bc", 30, 15, 6, 4)
    for (const [ex, dir] of [[25, 1], [40, -1]] as const) {
      for (let i = 0; i < 7; i++) r(c, fur, ex + dir * Math.floor(i / 3), 5 + i, 4 - Math.floor(i / 2), 1)
      r(c, "#ffb3d1", ex + dir, 8, 2, 4)
    }
    const blink = Math.sin(t * 0.8) > 0.93
    for (const ex of [28, 36]) {
      if (blink) r(c, dark, ex, 18, 4, 1)
      else {
        r(c, "#4fbf5a", ex, 16, 4, 4)
        r(c, "#1a2a1a", ex + 1, 16, 2, 4)
        r(c, "#ffffff", ex, 16, 1, 1)
      }
    }
    r(c, "#ffb3d1", 31, 22, 3, 2)
    r(c, dark, 30, 24, 1, 2)
    r(c, dark, 34, 24, 1, 2)
    for (const wy of [19, 22]) {
      r(c, "#ffffff", 20, wy, 6, 1)
      r(c, "#ffffff", 42, wy, 6, 1)
    }
  },
}
