/**
 * lib/baby-game/people/draw.ts — a `PersonSpec` drawn as a 32×32 letter grid, in the manner of Stardew Valley
 *
 * Big round head, two-pixel eyes with a glint, a small mouth and pink cheeks, hair with a lit crown and darker strands,
 * and clothes with real parts: collars, cuffs, ribbing, bibs, straps, hems, pockets, stripes. Every material has a
 * four-tone ramp whose shadows lean cool (`color.ts`); the silhouette gets the game's plum outline.
 *
 * Painting is by *slot* (skin, hair, top, bottom ...) and *tone* (0 = decided from the neighbours: lit on the upper-left
 * rim, shaded on the lower-right). After painting, slots become letters. Colors the base palette lacks get a letter from
 * a private block (U+00C0 up) that is added to `SPRITE_PALETTE`, so walk, idle and the renderer need no change.
 *
 * Views face right in the side view like the animals. `pose` picks hand-drawn frames: `stand`, `walk0`..`walk3`, `blink`,
 * `breathe`, `reach`/`reach2` (a swing), `wave`/`wave2`, `cheer`/`cheer2`.
 */

import { blushHex, colorHex, rampOf, skinRamp, type Ramp } from "./color"
import { paletteSink, type View } from "./registry"
import type { PersonSpec } from "./spec"

const S = 32
const FOOT = 29

export type PersonPose = "stand" | "walk0" | "walk1" | "walk2" | "walk3" | "blink" | "breathe" | "reach" | "reach2" | "wave" | "wave2" | "cheer" | "cheer2"

type Slot = "skin" | "hair" | "top" | "top2" | "bottom" | "shoe" | "hat" | "hat2" | "ex" | "eye" | "ink" | "white" | "blush" | "mouth" | "metal" | "sole"
type Px = { slot: Slot; tone: number }

/** Slots whose lit and shaded sides are worked out from what is next to them. */
const AUTO = new Set<Slot>(["skin", "hair", "top", "top2", "bottom", "shoe", "hat", "hat2", "ex", "sole"])

// ─── letters for colors the base palette does not have ───────────────────────

const letters = new Map<string, string>()
let nextCode = 0xc0

function letterFor(hex: string): string {
  const hit = letters.get(hex)
  if (hit) return hit
  const sink = paletteSink.target
  if (sink) {
    for (const [ch, h] of Object.entries(sink)) if (h.toLowerCase() === hex.toLowerCase()) return (letters.set(hex, ch), ch)
  }
  while (nextCode === 0xd7 || nextCode === 0xf7) nextCode++
  const ch = nextCode > 0x17f ? [...letters.values()][nextCode % letters.size]! : String.fromCharCode(nextCode++)
  letters.set(hex, ch)
  if (sink && sink[ch] === undefined) sink[ch] = hex
  return ch
}

// ─── canvas ──────────────────────────────────────────────────────────────────

class Pix {
  cells: (Px | null)[][] = Array.from({ length: S }, () => Array.from({ length: S }, () => null))
  /** Rows to lift whatever is painted next (the bounce of a step). */
  oy = 0

  set(x: number, y: number, slot: Slot, tone = 0) {
    x = Math.round(x)
    y = Math.round(y) - this.oy
    if (x < 1 || x >= S - 1 || y < 1 || y >= S - 1) return
    this.cells[y]![x] = { slot, tone }
  }

  get(x: number, y: number): Px | null {
    return this.cells[y]?.[x] ?? null
  }

  rect(x0: number, y0: number, x1: number, y1: number, slot: Slot, tone = 0) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, slot, tone)
  }

  /** Paint mirrored about the figure's center line (between columns 15 and 16). */
  mir(x: number, y: number, slot: Slot, tone = 0) {
    this.set(x, y, slot, tone)
    this.set(31 - x, y, slot, tone)
  }

  mirRect(x0: number, y0: number, x1: number, y1: number, slot: Slot, tone = 0) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.mir(x, y, slot, tone)
  }

  /** Paint a row of text: each char is a slot code, `.` leaves the cell, `1`/`3` force light or shade of the previous slot. */
  stamp(x: number, y: number, rows: string[], key: Record<string, [Slot, number]>, mirror = false) {
    rows.forEach((row, dy) => {
      ;[...row].forEach((ch, dx) => {
        const k = key[ch]
        if (!k) return
        if (mirror) this.mir(x + dx, y + dy, k[0], k[1])
        else this.set(x + dx, y + dy, k[0], k[1])
      })
    })
  }
}

// ─── geometry ────────────────────────────────────────────────────────────────

const BUILD: Record<PersonSpec["build"], { headH: number; torsoH: number; legH: number; hw: number }> = {
  small: { headH: 11, torsoH: 6, legH: 5, hw: 3 },
  slight: { headH: 11, torsoH: 7, legH: 6, hw: 3 },
  average: { headH: 11, torsoH: 8, legH: 8, hw: 3 },
  tall: { headH: 11, torsoH: 9, legH: 9, hw: 3 },
}

const HEAD_HALF = [3, 4, 5, 5, 5, 5, 5, 5, 5, 4, 3]

type Geo = { h0: number; headH: number; t0: number; torsoH: number; l0: number; legH: number; hw: number }

function geo(spec: PersonSpec): Geo {
  const b = BUILD[spec.build]
  const rows = b.legH + b.torsoH + b.headH - 1
  const h0 = FOOT - rows + 1 + 2
  return { h0, headH: b.headH, t0: h0 + b.headH - 1, torsoH: b.torsoH, l0: h0 + b.headH - 1 + b.torsoH, legH: b.legH, hw: b.hw }
}

// ─── hair ────────────────────────────────────────────────────────────────────

/** Last hair row (from the top of the head) for x = 9..22, front view. Smaller is a higher fringe. */
const FRINGE: Record<string, number[]> = {
  short: [5, 5, 3, 2, 2, 2, 2, 2, 2, 2, 2, 3, 5, 5],
  bangs: [6, 6, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 6, 6],
  side: [6, 6, 5, 4, 4, 4, 3, 3, 3, 2, 2, 3, 6, 6],
  parted: [6, 6, 4, 4, 3, 3, 2, 2, 3, 3, 4, 4, 6, 6],
  messy: [6, 5, 3, 4, 2, 4, 3, 3, 4, 2, 4, 3, 5, 6],
}
const FRINGE_OF: Record<string, string> = {
  short: "short", bangs: "bangs", side: "side", bob: "bangs", long: "parted", pigtails: "parted", ponytail: "parted", bun: "parted", curly: "messy", bald: "short",
}

/** Last hair row for x = 9..22 in the side view (the face looks right). */
const SIDE_FRINGE = [8, 8, 7, 7, 6, 6, 6, 5, 4, 3, 3, 3, 3, 2]

const inHead = (x: number, i: number, headH: number) => {
  if (i < 0 || i >= headH) return false
  const half = HEAD_HALF[i]!
  return x >= 15 - half && x <= 16 + half
}

function inHeadSide(x: number, i: number, headH: number) {
  if (i < 0 || i >= headH) return false
  const half = HEAD_HALF[i]!
  return x >= 15 - half && x <= 16 + half
}

/** Is any head pixel within `r` of this cell (a head grown by `r`, which is the hair's volume)? */
function bloated(test: (x: number, i: number) => boolean, x: number, i: number, r: number): boolean {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (test(x + dx, i + dy)) return true
  return false
}

// ─── the painter ─────────────────────────────────────────────────────────────

type Ctx = { P: Pix; g: Geo; s: PersonSpec; pose: PersonPose }

function lifts(pose: PersonPose): { l: number; r: number; armL: number; armR: number; bob: number } {
  switch (pose) {
    case "walk0": return { l: 1, r: 0, armL: 1, armR: -1, bob: 0 }
    case "walk1": return { l: 0, r: 0, armL: 0, armR: 0, bob: 1 }
    case "walk2": return { l: 0, r: 1, armL: -1, armR: 1, bob: 0 }
    case "walk3": return { l: 0, r: 0, armL: 0, armR: 0, bob: 1 }
    case "cheer2": return { l: 0, r: 0, armL: 0, armR: 0, bob: 1 }
    default: return { l: 0, r: 0, armL: 0, armR: 0, bob: 0 }
  }
}

const SLEEVES: Record<string, "none" | "short" | "long" | "roll"> = {
  tee: "short", longsleeve: "long", sweater: "long", hoodie: "long", shirt: "roll", dress: "short", overalls: "roll", jacket: "long",
}

function paintPattern(c: Ctx, x0: number, y0: number, x1: number, y1: number) {
  const { P, s } = c
  if (s.top.pattern === "solid") return
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (P.get(x, y - P.oy)?.slot !== "top") continue
      const stripe = s.top.pattern === "stripes" && (y - y0) % 3 === 1
      const dot = s.top.pattern === "dots" && (x + 2 * y) % 4 === 0
      if (stripe || dot) P.set(x, y, "top2")
    }
  }
}

// ── front and back ──────────────────────────────────────────────────────────

function legsFront(c: Ctx, back: boolean) {
  const { P, g, s } = c
  const lf = lifts(c.pose)
  P.oy = 0
  const feet = FOOT
  const long = s.bottom.kind === "pants" || s.top.kind === "overalls"
  const shortLen = Math.min(2, g.legH - 3)
  // hips: one solid row joins the two legs under the torso
  const hipSlot: Slot = s.top.kind === "dress" ? "top" : "bottom"
  P.rect(12, g.l0 - 1, 19, g.l0, hipSlot)
  for (const [side, lift] of [[0, lf.l], [1, lf.r]] as const) {
    const x0 = side === 0 ? 12 : 17
    for (let y = g.l0 + 1; y <= feet; y++) {
      const down = y - g.l0
      const dressed = s.top.kind === "dress" ? down <= 2 : s.bottom.kind === "skirt" ? down <= 2 : long || down <= shortLen
      const yy = y >= feet - 2 && lift ? y - lift : y
      P.rect(x0, yy, x0 + 2, yy, dressed ? (s.top.kind === "dress" ? "top" : "bottom") : "skin")
    }
    shoeFront(c, x0, lift)
  }
  // the crease between the legs, and a pant cuff
  if (long) {
    for (const x0 of [12, 17]) P.rect(x0, feet - 3, x0 + 2, feet - 3, "bottom", 3)
  }
  void back
}

function shoeFront(c: Ctx, x0: number, lift: number) {
  const { P, s } = c
  const flip = x0 === 12
  const wide = flip ? [x0 - 1, x0 + 2] : [x0, x0 + 3]
  const y1 = FOOT - lift
  switch (s.shoes.kind) {
    case "boots":
      P.rect(x0, y1 - 2, x0 + 2, y1 - 2, "shoe", 1)
      P.rect(wide[0]!, y1 - 1, wide[1]!, y1, "shoe")
      P.rect(wide[0]!, y1, wide[1]!, y1, "shoe", 3)
      P.set(flip ? wide[0]! : wide[1]!, y1 - 1, "shoe", 1)
      break
    case "sneakers":
      P.rect(wide[0]!, y1 - 1, wide[1]!, y1 - 1, "shoe")
      P.rect(wide[0]!, y1, wide[1]!, y1, "sole")
      P.set(flip ? wide[0]! + 1 : wide[1]! - 1, y1 - 1, "white")
      P.set(flip ? wide[0]! : wide[1]!, y1 - 1, "shoe", 1)
      break
    case "sandals":
      P.rect(wide[0]!, y1 - 1, wide[1]!, y1, "skin")
      P.rect(x0, y1 - 1, x0 + 2, y1 - 1, "shoe")
      P.rect(wide[0]!, y1, wide[1]!, y1, "shoe", 3)
      break
    default:
      P.rect(wide[0]!, y1 - 1, wide[1]!, y1, "skin")
      P.rect(wide[0]!, y1, wide[1]!, y1, "skin", 3)
  }
}

function torsoFront(c: Ctx, back: boolean) {
  const { P, g, s, pose } = c
  const lf = lifts(pose)
  P.oy = lf.bob
  const { t0, torsoH, hw } = g
  const x0 = 15 - hw
  const x1 = 16 + hw
  const rows = t0 + torsoH - 1
  const kind = s.top.kind
  const sleeve = SLEEVES[kind] ?? "short"
  const armRows = torsoH - 1

  // arms first: they sit beside the torso, two pixels wide
  const arm = (side: 0 | 1, dy: number) => {
    const ax = side === 0 ? [10, 11] : [20, 21]
    const up = pose === "cheer" || pose === "cheer2" || (pose === "wave" || pose === "wave2") && side === 1
    if (up) return armUp(c, side, pose)
    if ((pose === "reach" || pose === "reach2") && !back) {
      const ix = side === 0 ? [12, 13, 14] : [19, 18, 17]
      for (let k = 0; k < 3; k++) {
        const y = t0 + 1 + k + (pose === "reach2" ? 0 : 1)
        P.rect(Math.min(ix[k]!, ix[k]! + (side === 0 ? -1 : 1)), y, Math.max(ix[k]!, ix[k]! + (side === 0 ? -1 : 1)), y, k === 2 ? "skin" : sleeveSlot(c))
      }
      return
    }
    const top = t0 + 1 + dy
    const sleeveLen = sleeve === "short" ? 2 : sleeve === "none" ? 0 : sleeve === "roll" ? armRows - 3 : armRows - 2
    for (let k = 0; k < armRows; k++) {
      const y = top + k
      const isSleeve = k < sleeveLen
      for (const x of ax) P.set(x, y, isSleeve ? sleeveSlot(c) : "skin", isSleeve ? 0 : 0)
    }
    if (sleeveLen > 0 && (sleeve === "long" || sleeve === "roll")) {
      const cuff = top + sleeveLen - 1
      for (const x of ax) P.set(x, cuff, kind === "sweater" || sleeve === "roll" ? "top2" : "top", kind === "sweater" ? 3 : 0)
    }
    // the hand: one pixel rounder at the bottom
    const hy = top + armRows - 1
    P.set(side === 0 ? 10 : 21, hy, "skin", 3)
    if (back) return
  }
  // the far arm goes behind the torso when walking away
  arm(0, lf.armL)
  arm(1, lf.armR)

  // torso
  if (kind === "dress") {
    P.rect(x0, t0, x1, rows - 1, "top")
    P.rect(x0 - 1, rows, x1 + 1, rows + 1, "top")
    P.rect(x0 - 2, rows + 2, x1 + 2, rows + 2, "top", 3)
    P.rect(x0, rows - 1, x1, rows - 1, "top2")
    paintPattern(c, x0 - 2, t0, x1 + 2, rows + 2)
    P.rect(x0 - 2, rows + 2, x1 + 2, rows + 2, "top2", 3)
  } else {
    P.rect(x0, t0, x1, rows, "top")
    paintPattern(c, x0, t0, x1, rows)
    for (const side of [0, 1] as const) {
      // sleeves carry the pattern too
      void side
    }
  }
  if (back) {
    backDetails(c, x0, x1, rows)
    return
  }
  detailsFront(c, x0, x1, rows)
}

function sleeveSlot(c: Ctx): Slot {
  return c.s.top.kind === "overalls" ? "top" : "top"
}

function armUp(c: Ctx, side: 0 | 1, pose: PersonPose) {
  const { P, g } = c
  const x = side === 0 ? [8, 9] : [22, 23]
  const y0 = g.t0 + 2
  const sway = pose === "wave2" ? (side === 0 ? -1 : 1) : 0
  for (let k = 0; k < 5; k++) for (const xx of x) P.set(xx + (k < 2 ? 0 : sway), y0 - k, k < 3 ? sleeveSlot(c) : "skin")
  P.set(side === 0 ? 10 : 21, g.t0 + 1, sleeveSlot(c))
  P.set(side === 0 ? 9 : 22, g.t0 + 1, sleeveSlot(c))
}

function detailsFront(c: Ctx, x0: number, x1: number, rows: number) {
  const { P, g, s } = c
  const t0 = g.t0
  const k = s.top.kind
  // shadow the chin throws on the shirt
  P.rect(14, t0 + 1, 17, t0 + 1, "top", 3)
  switch (k) {
    case "tee":
    case "longsleeve":
      P.rect(14, t0 + 1, 17, t0 + 1, "top", 3)
      P.rect(15, t0 + 1, 16, t0 + 1, "skin", 3)
      P.rect(x0, rows, x1, rows, "top", 3)
      break
    case "sweater":
      for (let x = x0; x <= x1; x++) {
        P.set(x, rows, "top", x % 2 ? 3 : 2)
        P.set(x, t0 + 1, "top", x % 2 ? 1 : 3)
      }
      P.rect(15, t0 + 1, 16, t0 + 1, "skin", 3)
      for (let y = t0 + 2; y < rows; y += 2) for (let x = x0 + 1; x <= x1 - 1; x += 2) P.set(x, y, "top", 3)
      break
    case "hoodie":
      P.rect(12, t0 + 1, 13, t0 + 1, "top", 1)
      P.rect(18, t0 + 1, 19, t0 + 1, "top", 1)
      P.rect(14, t0 + 1, 17, t0 + 1, "top", 3)
      P.rect(15, t0 + 1, 16, t0 + 1, "skin", 3)
      P.rect(14, t0 + 2, 14, t0 + 4, "white")
      P.rect(17, t0 + 2, 17, t0 + 4, "white")
      P.rect(14, t0 + 5, 17, t0 + 5, "top", 3)
      P.rect(x0, rows, x1, rows, "top", 3)
      break
    case "shirt":
      P.rect(13, t0 + 1, 14, t0 + 1, "top2", 1)
      P.rect(17, t0 + 1, 18, t0 + 1, "top2", 1)
      P.rect(14, t0 + 2, 14, t0 + 2, "top2")
      P.rect(17, t0 + 2, 17, t0 + 2, "top2")
      P.rect(15, t0 + 1, 16, t0 + 1, "skin", 3)
      for (let y = t0 + 2; y <= rows; y++) P.set(16, y, "top", 3)
      for (let y = t0 + 3; y <= rows; y += 2) P.set(16, y, "white")
      P.rect(x0, rows, x1, rows, "top", 3)
      break
    case "dress":
      P.rect(14, t0 + 1, 17, t0 + 1, "top", 3)
      P.rect(15, t0 + 1, 16, t0 + 1, "skin", 3)
      P.rect(14, t0 + 2, 17, t0 + 2, "top2", 1)
      break
    case "overalls": {
      // straps, bib, pocket patch with a small face, metal buttons
      const shirtRows = t0 + torsoRows(g) - 1
      P.rect(14, t0 + 1, 17, t0 + 1, "top", 3)
      P.rect(15, t0 + 1, 16, t0 + 1, "skin", 3)
      P.rect(13, t0 + 1, 13, t0 + 2, "bottom")
      P.rect(18, t0 + 1, 18, t0 + 2, "bottom")
      P.rect(13, t0 + 3, 18, shirtRows, "bottom")
      P.rect(12, shirtRows - 1, 19, shirtRows, "bottom")
      P.set(13, t0 + 3, "metal", 1)
      P.set(18, t0 + 3, "metal", 1)
      P.set(13, t0 + 3, "metal", 1)
      P.rect(14, t0 + 3, 17, t0 + 3, "bottom", 3)
      P.rect(14, t0 + 4, 17, t0 + 5, "top2")
      P.set(14, t0 + 4, "ink")
      P.set(17, t0 + 4, "ink")
      P.rect(15, t0 + 5, 16, t0 + 5, "blush")
      P.rect(13, shirtRows, 18, shirtRows, "bottom", 3)
      break
    }
    case "jacket":
      P.rect(15, t0 + 1, 16, rows, "top2")
      P.rect(15, t0 + 1, 16, t0 + 1, "skin", 3)
      for (let y = t0 + 1; y <= rows; y++) {
        P.set(14, y, "top", 3)
        P.set(17, y, "top", 3)
      }
      P.rect(13, t0 + 1, 13, t0 + 2, "top", 1)
      P.rect(18, t0 + 1, 18, t0 + 2, "top", 1)
      P.rect(x0, rows, x1, rows, "top", 3)
      break
  }
}

function torsoRows(g: Geo) {
  return g.torsoH
}

function backDetails(c: Ctx, x0: number, x1: number, rows: number) {
  const { P, g, s } = c
  const t0 = g.t0
  P.rect(x0, rows, x1, rows, "top", 3)
  if (s.top.kind === "hoodie") {
    P.rect(13, t0 + 1, 18, t0 + 3, "top", 1)
    P.rect(13, t0 + 3, 18, t0 + 3, "top", 3)
    P.rect(14, t0 + 4, 17, t0 + 4, "top", 3)
  } else if (s.top.kind === "overalls") {
    const shirtRows = t0 + g.torsoH - 1
    P.rect(13, t0 + 1, 14, t0 + 2, "bottom")
    P.rect(17, t0 + 1, 18, t0 + 2, "bottom")
    P.rect(12, t0 + 3, 19, shirtRows, "bottom")
    P.rect(12, t0 + 3, 19, t0 + 3, "bottom", 3)
    P.set(14, t0 + 3, "metal", 1)
    P.set(17, t0 + 3, "metal", 1)
    P.rect(14, t0 + 5, 17, t0 + 6, "bottom", 3)
    P.rect(15, t0 + 5, 16, t0 + 5, "bottom")
  } else if (s.top.kind === "shirt" || s.top.kind === "jacket") {
    P.rect(13, t0 + 1, 18, t0 + 1, "top2", 1)
    P.rect(16, t0 + 2, 16, rows, "top", 3)
  } else {
    P.rect(14, t0 + 1, 17, t0 + 1, "top", 3)
  }
}

// ── the head ────────────────────────────────────────────────────────────────

function headFront(c: Ctx, back: boolean) {
  const { P, g, s, pose } = c
  const lf = lifts(pose)
  P.oy = lf.bob + (pose === "breathe" ? -0 : 0)
  const { h0, headH } = g
  const style = s.hair.style

  // hair behind the head: a bob's ends, long hair's fall, the tails
  backHair(c, back)

  // the face
  for (let i = 0; i < headH; i++) {
    const half = HEAD_HALF[i]!
    for (let x = 15 - half; x <= 16 + half; x++) P.set(x, h0 + i, "skin")
  }
  if (!back) face(c)

  // scarf at the neck belongs under the chin
  hairCap(c, back)
  if (s.hair.style === "long" || s.hair.style === "bob") frontStrands(c, back)
  hat(c, back)
  if (!back) glasses(c)
  void style
}

function face(c: Ctx) {
  const { P, g, s } = c
  const h = g.h0
  const blink = c.pose === "blink"
  // eyes: dark lash line, glint on the inner side, color below
  for (const side of [0, 1] as const) {
    const xs = side === 0 ? [12, 13] : [19, 18]
    if (blink) {
      P.rect(Math.min(...xs), h + 7, Math.max(...xs), h + 7, "ink")
      continue
    }
    P.set(xs[0]!, h + 6, "ink")
    P.set(xs[1]!, h + 6, "ink")
    P.set(xs[0]!, h + 7, "ink")
    P.set(xs[1]!, h + 7, "white")
    P.set(xs[0]!, h + 8, "eye", 2)
    P.set(xs[1]!, h + 8, "eye", 1)
  }
  if (s.blush) {
    P.mirRect(10, h + 8, 11, h + 8, "blush")
    P.mir(11, h + 9, "blush")
  }
  if (s.extras.includes("freckles")) {
    for (const [x, y] of [[13, 9], [14, 8], [11, 8]] as const) P.mir(x, h + y, "skin", 3)
  }
  const m = s.mouth
  const my = h + 9
  if (m === "smile") {
    P.set(15, my, "mouth")
    P.set(16, my, "mouth")
    P.set(14, my - 1, "mouth", 3)
    P.set(17, my - 1, "mouth", 3)
  } else if (m === "grin") {
    P.rect(14, my, 17, my, "mouth")
    P.rect(15, my, 16, my, "white")
  } else if (m === "neutral") {
    P.rect(15, my, 16, my, "mouth", 3)
  } else if (m === "open") {
    P.rect(15, my - 1, 16, my, "mouth")
    P.set(15, my, "blush")
  } else {
    P.rect(15, my, 16, my, "mouth")
    P.set(17, my - 1, "mouth", 3)
  }
}

function glasses(c: Ctx) {
  const { P, g, s } = c
  if (!s.extras.includes("glasses")) return
  const h = g.h0
  for (const [a, b] of [[11, 14], [17, 20]] as const) {
    P.rect(a, h + 5, b, h + 5, "ink", 2)
    P.rect(a, h + 9, b, h + 9, "ink", 2)
    P.set(a, h + 6, "ink", 2); P.set(a, h + 7, "ink", 2); P.set(a, h + 8, "ink", 2)
    P.set(b, h + 6, "ink", 2); P.set(b, h + 7, "ink", 2); P.set(b, h + 8, "ink", 2)
  }
  P.rect(15, h + 7, 16, h + 7, "ink", 2)
}

function backHair(c: Ctx, back: boolean) {
  const { P, g, s } = c
  const h = g.h0
  const style = s.hair.style
  const fillBack = (x0: number, x1: number, i0: number, i1: number) => P.rect(x0, h + i0, x1, h + i1, "hair")
  if (style === "bob") fillBack(9, 22, 3, 9)
  if (style === "long") {
    fillBack(9, 22, 3, g.headH + 3)
    fillBack(10, 21, g.headH, g.headH + 4)
  }
  if (style === "pigtails" && !back) {
    for (const [y, a, b] of [[4, 7, 9], [5, 6, 9], [6, 6, 9], [7, 6, 9], [8, 6, 8], [9, 6, 8], [10, 7, 8], [11, 7, 8], [12, 6, 7]] as const) {
      P.rect(a, h + y, b, h + y, "hair")
      P.rect(31 - b, h + y, 31 - a, h + y, "hair")
    }
    P.rect(7, h + 4, 9, h + 4, "hat2")
    P.rect(22, h + 4, 24, h + 4, "hat2")
  }
  if (style === "ponytail" && back) {
    P.rect(14, h + 8, 17, h + 9, "hair")
    P.rect(14, h + 10, 17, h + g.headH + 3, "hair")
    P.rect(15, h + g.headH + 4, 16, h + g.headH + 5, "hair")
  }
  if (style === "bun") {
    for (let y = -4; y <= -1; y++) for (let x = 13; x <= 18; x++) {
      const d = (x - 15.5) ** 2 / 9 + (y + 2.6) ** 2 / 4
      if (d <= 1) P.set(x, h + y, "hair")
    }
  }
  if (style === "pigtails" && back) {
    for (const [y, a, b] of [[4, 7, 9], [5, 6, 9], [6, 6, 9], [7, 6, 9], [8, 6, 8], [9, 6, 8], [10, 7, 8], [11, 7, 8], [12, 6, 7]] as const) {
      P.rect(a, h + y, b, h + y, "hair")
      P.rect(31 - b, h + y, 31 - a, h + y, "hair")
    }
    P.rect(7, h + 4, 9, h + 4, "hat2")
    P.rect(22, h + 4, 24, h + 4, "hat2")
  }
}

function frontStrands(c: Ctx, back: boolean) {
  const { P, g, s } = c
  if (back) return
  const h = g.h0
  const tail = s.hair.style === "long" ? g.headH + 2 : g.headH - 1
  for (let i = 6; i <= tail; i++) {
    const w = i > g.headH - 2 ? 2 : 3
    for (let k = 0; k < w; k++) {
      P.set(9 + k - (i > g.headH ? 0 : 0), h + i, "hair")
      P.set(22 - k, h + i, "hair")
    }
  }
}

function hairCap(c: Ctx, back: boolean) {
  const { P, g, s } = c
  const style = s.hair.style
  if (style === "bald") return
  const h = g.h0
  const fringe = FRINGE[FRINGE_OF[style]!]!
  const r = style === "curly" ? 2 : 1
  const test = (x: number, i: number) => inHead(x, i, g.headH)
  for (let i = -3; i < g.headH; i++) {
    for (let x = 8; x <= 23; x++) {
      if (!bloated(test, x, i, r)) continue
      const last = back ? g.headH - 3 - (style === "bob" || style === "long" ? 0 : 0) : (fringe[x - 9] ?? 6)
      if (i > last) continue
      P.set(x, h + i, "hair")
    }
  }
  if (back) {
    // nape: the hair stops short of the neck and a little skin shows
    P.rect(13, h + g.headH - 2, 18, h + g.headH - 1, style === "long" || style === "bob" ? "hair" : "skin")
  }
  strands(c, back)
  if (style === "ponytail" && !back) {
    P.rect(20, h + 1, 22, h + 3, "hat2")
  }
  if (style === "bun" && !back) P.rect(14, h - 1, 17, h - 1, "hat2")
}

/** Darker flow lines and a lit crown, so hair reads as strands and not a flat helmet. */
function strands(c: Ctx, back: boolean) {
  const { P, g } = c
  const h = g.h0 - P.oy
  for (let y = h - 4; y < h + g.headH + 6; y++) {
    for (let x = 8; x <= 23; x++) {
      const cell = P.get(x, y)
      if (!cell || cell.slot !== "hair" || cell.tone !== 0) continue
      const below = P.get(x, y + 1)
      const above = P.get(x, y - 1)
      if (below?.slot !== "hair" || above?.slot !== "hair") continue
      const flow = back ? (x * 7 + y * 3) % 5 === 0 : (x + (y - h) * 2) % 5 === 0 || ((x - 16) ** 2 < 1 && y - h < 3)
      if (flow) cell.tone = 3
      else if ((x * 3 + y) % 7 === 0 && y - h < 4) cell.tone = 1
    }
  }
}

function hat(c: Ctx, back: boolean) {
  const { P, g, s } = c
  const h = g.h0
  const k = s.hat.kind
  if (k === "none") return
  const test = (x: number, i: number) => inHead(x, i, g.headH)
  if (k === "bow") {
    P.stamp(18, h - 1, ["aa.aa", "aabaa", "aa.aa"], { a: ["hat", 0], b: ["hat2", 0] })
    P.set(18, h, "hat", 1)
    return
  }
  if (k === "headband") {
    for (let x = 9; x <= 22; x++) if (bloated(test, x, 2, 1)) P.set(x, h + 2, "hat")
    P.stamp(19, h + 1, ["ab", "bb"], { a: ["hat2", 0], b: ["hat", 1] })
    return
  }
  if (k === "beanie") {
    for (let i = -3; i <= 2; i++) for (let x = 8; x <= 23; x++) if (bloated(test, x, i, 2) && !(i < 0 && !bloated(test, x, i, 1))) P.set(x, h + i, "hat")
    for (let x = 8; x <= 23; x++) if (bloated(test, x, 2, 2)) P.set(x, h + 2, "hat2", x % 2 ? 1 : 0)
    P.rect(15, h - 5, 16, h - 4, "hat2")
    return
  }
  if (k === "cap") {
    for (let i = -2; i <= 2; i++) for (let x = 9; x <= 22; x++) if (bloated(test, x, i, 1)) P.set(x, h + i, "hat")
    P.rect(9, h + 3, 22, h + 3, "hat", 3)
    P.rect(12, h + 4, 19, h + 4, "hat", 3)
    if (!back) P.rect(14, h + 1, 17, h + 1, "hat2")
    return
  }
  // straw: a round crown and a wide brim
  for (let i = -3; i <= 1; i++) for (let x = 10; x <= 21; x++) if (bloated(test, x, i, 0) || i < 0 && x > 11 && x < 20) P.set(x, h + i, "hat")
  for (let x = 5; x <= 26; x++) {
    const dx = (x - 15.5) / 11
    P.set(x, h + 2, "hat", dx * dx > 0.6 ? 3 : 0)
    if (Math.abs(dx) < 0.82) P.set(x, h + 3, "hat", 3)
  }
  P.rect(10, h + 1, 21, h + 1, "hat2")
}

// ─── side view ───────────────────────────────────────────────────────────────

function sideBody(c: Ctx) {
  const { P, g, s, pose } = c
  const lf = lifts(pose)
  const phase = pose === "walk0" ? 1 : pose === "walk2" ? -1 : 0
  const pass = pose === "walk1" || pose === "walk3"
  const long = s.bottom.kind === "pants" || s.top.kind === "overalls"
  P.oy = 0
  const tx0 = 13
  const tx1 = 18
  // far leg and far arm sit behind
  const leg = (back: boolean) => {
    const off = pass ? (back ? -1 : 1) * 0 : (back ? -phase : phase) * 2
    const lift = pass && back ? 1 : 0
    for (let y = g.l0 + (back ? 0 : 0); y <= FOOT - lift; y++) {
      const t = (y - g.l0) / Math.max(1, FOOT - g.l0)
      const shift = Math.round(off * t)
      const down = y - g.l0
      const dressed = s.top.kind === "dress" ? down <= 2 : s.bottom.kind === "skirt" ? down <= 2 : long || down <= Math.min(2, g.legH - 3)
      const slot: Slot = dressed ? (s.top.kind === "dress" ? "top" : "bottom") : "skin"
      P.rect(14 + shift, y, 16 + shift, y, slot, back ? 3 : 0)
    }
    const sh = Math.round(off)
    shoeSide(c, 14 + sh, FOOT - lift, back)
  }
  P.rect(14, g.l0 - 1, 17, g.l0, s.top.kind === "dress" ? "top" : "bottom")
  leg(true)
  leg(false)

  P.oy = lf.bob
  // far arm
  const swing = pose === "walk0" ? -1 : pose === "walk2" ? 1 : 0
  const sleeve = SLEEVES[s.top.kind] ?? "short"
  const armRows = g.torsoH - 1
  const sleeveLen = sleeve === "short" ? 2 : sleeve === "roll" ? armRows - 3 : armRows - 2
  const drawArm = (x: number, far: boolean, dx: number) => {
    for (let k = 0; k < armRows; k++) {
      const isS = k < sleeveLen
      const xx = x + Math.round(dx * (k / armRows))
      P.rect(xx, g.t0 + 1 + k, xx + 1, g.t0 + 1 + k, isS ? "top" : "skin", far ? 3 : 0)
    }
    const cuff = g.t0 + sleeveLen
    if (sleeveLen > 0 && (sleeve === "long" || sleeve === "roll")) P.rect(x + Math.round(dx * ((sleeveLen - 1) / armRows)), cuff, x + 1 + Math.round(dx * ((sleeveLen - 1) / armRows)), cuff, "top2", far ? 3 : 0)
  }
  drawArm(15, true, -swing * 2)

  // torso
  const rows = g.t0 + g.torsoH - 1
  if (s.top.kind === "dress") {
    P.rect(tx0, g.t0, tx1, rows - 1, "top")
    P.rect(tx0 - 1, rows, tx1 + 1, rows + 1, "top")
    P.rect(tx0 - 2, rows + 2, tx1 + 2, rows + 2, "top", 3)
    P.rect(tx0, rows - 1, tx1, rows - 1, "top2")
  } else {
    P.rect(tx0, g.t0, tx1, rows, "top")
  }
  paintPattern(c, tx0 - 2, g.t0, tx1 + 2, rows + 2)
  if (s.top.kind === "overalls") {
    P.rect(tx0, g.t0 + 3, tx1, rows, "bottom")
    P.rect(16, g.t0 + 1, 17, g.t0 + 2, "bottom")
    P.set(17, g.t0 + 3, "metal", 1)
    P.rect(tx0, rows, tx1, rows, "bottom", 3)
    P.set(18, g.t0 + 4, "top2")
    P.set(18, g.t0 + 5, "top2")
  } else if (s.top.kind === "hoodie") {
    P.rect(12, g.t0, 14, g.t0 + 2, "top", 1)
    P.rect(12, g.t0 + 2, 14, g.t0 + 2, "top", 3)
    P.rect(tx0, rows, tx1, rows, "top", 3)
    P.rect(17, g.t0 + 2, 17, g.t0 + 4, "white")
  } else if (s.top.kind === "sweater") {
    for (let x = tx0; x <= tx1; x++) P.set(x, rows, "top", x % 2 ? 3 : 2)
    for (let y = g.t0 + 2; y < rows; y += 2) for (let x = tx0 + 1; x <= tx1; x += 2) P.set(x, y, "top", 3)
  } else if (s.top.kind === "shirt" || s.top.kind === "jacket") {
    P.rect(17, g.t0 + 1, 18, g.t0 + 2, "top2", 1)
    P.rect(tx1, g.t0 + 3, tx1, rows, "top2")
    P.rect(tx0, rows, tx1, rows, "top", 3)
  } else {
    P.rect(tx0, rows, tx1, rows, "top", 3)
  }
  P.rect(15, g.t0, 16, g.t0, "skin", 3)
  // near arm
  armSide(c, swing, sleeveLen, drawArm)
}

function armSide(c: Ctx, swing: number, _sleeveLen: number, drawArm: (x: number, far: boolean, dx: number) => void) {
  const { P, g, pose } = c
  if (pose === "reach" || pose === "reach2") {
    const end = pose === "reach2" ? [21, g.t0 + 2] : [20, g.t0 + 4]
    for (let k = 0; k <= 5; k++) {
      const x = 15 + Math.round(((end[0]! - 15) * k) / 5)
      const y = g.t0 + 1 + Math.round(((end[1]! - g.t0 - 1) * k) / 5)
      P.rect(x, y, x + 1, y, k < 3 ? "top" : "skin")
    }
    return
  }
  if (pose === "wave" || pose === "wave2" || pose === "cheer" || pose === "cheer2") {
    const sway = pose === "wave2" ? 1 : 0
    for (let k = 0; k < 6; k++) {
      const x = 16 + Math.round((k * 2) / 5) + (k > 3 ? sway : 0)
      P.rect(x, g.t0 + 2 - k, x + 1, g.t0 + 2 - k, k < 3 ? "top" : "skin")
    }
    return
  }
  drawArm(15, false, swing * 2)
  P.set(16, g.t0 + g.torsoH - 1, "skin", 3)
}

function shoeSide(c: Ctx, x: number, y: number, far: boolean) {
  const { P, s } = c
  const t = far ? 3 : 0
  switch (s.shoes.kind) {
    case "boots":
      P.rect(x, y - 2, x + 2, y - 2, "shoe", far ? 3 : 1)
      P.rect(x, y - 1, x + 4, y, "shoe", t)
      P.rect(x, y, x + 4, y, "shoe", 3)
      break
    case "sneakers":
      P.rect(x, y - 1, x + 4, y - 1, "shoe", t)
      P.rect(x, y, x + 4, y, "sole")
      P.set(x + 3, y - 1, "white")
      break
    case "sandals":
      P.rect(x, y - 1, x + 4, y, "skin", t)
      P.rect(x + 1, y - 1, x + 2, y - 1, "shoe", t)
      P.rect(x, y, x + 4, y, "shoe", 3)
      break
    default:
      P.rect(x, y - 1, x + 4, y, "skin", t)
  }
}

function headSide(c: Ctx) {
  const { P, g, s, pose } = c
  const lf = lifts(pose)
  P.oy = lf.bob
  const h = g.h0
  const style = s.hair.style

  // hair behind
  if (style === "bob") P.rect(9, h + 3, 14, h + 9, "hair")
  if (style === "long") {
    P.rect(9, h + 3, 15, h + g.headH + 3, "hair")
  }
  if (style === "ponytail") {
    P.rect(7, h + 2, 10, h + 3, "hat2")
    P.rect(6, h + 4, 10, h + 7, "hair")
    P.rect(6, h + 8, 8, h + g.headH + 1, "hair")
    P.rect(7, h + g.headH + 2, 8, h + g.headH + 3, "hair")
  }
  if (style === "bun") {
    for (let y = -4; y <= 0; y++) for (let x = 9; x <= 15; x++) {
      const d = (x - 12) ** 2 / 9 + (y + 2) ** 2 / 4
      if (d <= 1) P.set(x, h + y, "hair")
    }
  }

  // face
  for (let i = 0; i < g.headH; i++) {
    const half = HEAD_HALF[i]!
    for (let x = 15 - half; x <= 16 + half; x++) P.set(x, h + i, "skin")
  }
  P.set(22, h + 7, "skin")
  P.set(22, h + 7, "skin", 1)
  // eye, cheek, mouth
  if (pose === "blink") {
    P.rect(18, h + 7, 19, h + 7, "ink")
  } else {
    P.rect(18, h + 6, 19, h + 7, "ink")
    P.set(19, h + 7, "white")
    P.set(18, h + 8, "eye", 2)
    P.set(19, h + 8, "eye", 1)
  }
  if (s.blush) P.rect(16, h + 8, 17, h + 9, "blush")
  P.set(21, h + 9, "mouth")
  if (s.mouth === "grin" || s.mouth === "open") P.set(20, h + 9, "mouth")
  if (s.extras.includes("freckles")) for (const [x, y] of [[18, 9], [20, 8]] as const) P.set(x, h + y, "skin", 3)
  // ear
  P.set(14, h + 7, "skin", 3)
  P.set(14, h + 8, "skin", 3)

  // hair cap
  if (style !== "bald") {
    const r = style === "curly" ? 2 : 1
    const test = (x: number, i: number) => inHeadSide(x, i, g.headH)
    const fringe = style === "bangs" || style === "bob" ? SIDE_FRINGE.map((v, k) => (k > 7 ? Math.min(v + 1, 4) : v)) : SIDE_FRINGE
    for (let i = -3; i < g.headH; i++) {
      for (let x = 8; x <= 23; x++) {
        if (!bloated(test, x, i, r)) continue
        if (i > (fringe[x - 9] ?? 6)) continue
        P.set(x, h + i, "hair")
      }
    }
    if (style === "pigtails") {
      for (const [y, a, b] of [[5, 11, 13], [6, 10, 13], [7, 10, 13], [8, 10, 12], [9, 10, 12], [10, 11, 12], [11, 11, 12], [12, 10, 11]] as const) P.rect(a, h + y, b, h + y, "hair")
      P.rect(11, h + 4, 14, h + 4, "hat2")
    }
    strandsSide(c)
  }
  hatSide(c)
  if (s.extras.includes("glasses")) {
    P.rect(17, h + 5, 20, h + 5, "ink", 2)
    P.rect(17, h + 9, 20, h + 9, "ink", 2)
    P.rect(17, h + 6, 17, h + 8, "ink", 2)
    P.rect(20, h + 6, 20, h + 8, "ink", 2)
    P.rect(21, h + 7, 22, h + 7, "ink", 2)
  }
}

function strandsSide(c: Ctx) {
  const { P, g } = c
  const h = g.h0 - P.oy
  for (let y = h - 4; y < h + g.headH + 6; y++) {
    for (let x = 6; x <= 23; x++) {
      const cell = P.get(x, y)
      if (!cell || cell.slot !== "hair" || cell.tone !== 0) continue
      if (P.get(x, y + 1)?.slot !== "hair" || P.get(x, y - 1)?.slot !== "hair") continue
      if ((x * 2 + y * 3) % 5 === 0) cell.tone = 3
      else if ((x + y * 2) % 7 === 0 && y - h < 4) cell.tone = 1
    }
  }
}

function hatSide(c: Ctx) {
  const { P, g, s } = c
  const h = g.h0
  const k = s.hat.kind
  if (k === "none") return
  const test = (x: number, i: number) => inHeadSide(x, i, g.headH)
  if (k === "bow") {
    P.stamp(11, h - 1, ["aa.aa", "aabaa", "aa.aa"], { a: ["hat", 0], b: ["hat2", 0] })
    return
  }
  if (k === "headband") {
    for (let x = 9; x <= 22; x++) if (bloated(test, x, 2, 1)) P.set(x, h + 2, "hat")
    return
  }
  if (k === "beanie") {
    for (let i = -3; i <= 2; i++) for (let x = 8; x <= 23; x++) if (bloated(test, x, i, 2) && !(i < 0 && !bloated(test, x, i, 1))) P.set(x, h + i, "hat")
    for (let x = 8; x <= 23; x++) if (bloated(test, x, 2, 2)) P.set(x, h + 2, "hat2", x % 2 ? 1 : 0)
    P.rect(11, h - 5, 12, h - 4, "hat2")
    return
  }
  if (k === "cap") {
    for (let i = -2; i <= 2; i++) for (let x = 9; x <= 22; x++) if (bloated(test, x, i, 1)) P.set(x, h + i, "hat")
    P.rect(9, h + 3, 24, h + 3, "hat", 3)
    P.rect(21, h + 2, 25, h + 2, "hat")
    return
  }
  for (let i = -3; i <= 1; i++) for (let x = 10; x <= 21; x++) if (bloated(test, x, i, 0) || i < 0 && x > 11 && x < 20) P.set(x, h + i, "hat")
  for (let x = 5; x <= 26; x++) {
    P.set(x, h + 2, "hat", x < 8 || x > 23 ? 3 : 0)
    if (x > 7 && x < 24) P.set(x, h + 3, "hat", 3)
  }
  P.rect(10, h + 1, 21, h + 1, "hat2")
}

// ─── extras: scarf, satchel ──────────────────────────────────────────────────

function extras(c: Ctx, view: View) {
  const { P, g, s } = c
  const lf = lifts(c.pose)
  P.oy = lf.bob
  if (s.extras.includes("scarf")) {
    if (view === "side") {
      P.rect(13, g.t0 - 1, 18, g.t0 + 1, "ex")
      P.rect(12, g.t0 + 1, 14, g.t0 + 4, "ex", 3)
    } else {
      P.rect(12, g.t0 - 1, 19, g.t0, "ex")
      P.rect(12, g.t0, 19, g.t0, "ex", 3)
      if (view === "front") P.rect(17, g.t0 + 1, 18, g.t0 + 4, "ex")
    }
  }
  if (s.extras.includes("satchel")) {
    if (view === "side") {
      P.rect(15, g.t0 + 1, 15, g.t0 + g.torsoH - 2, "ex", 3)
      P.rect(13, g.t0 + g.torsoH - 3, 17, g.t0 + g.torsoH, "ex")
      P.rect(13, g.t0 + g.torsoH - 3, 17, g.t0 + g.torsoH - 3, "ex", 3)
    } else {
      for (let k = 0; k < g.torsoH - 1; k++) P.set(12 + Math.round((k * 7) / (g.torsoH - 2)), g.t0 + 1 + k, "ex", 3)
      const bx = view === "front" ? 17 : 11
      P.rect(bx, g.t0 + g.torsoH - 3, bx + 3, g.t0 + g.torsoH, "ex")
      P.rect(bx, g.t0 + g.torsoH - 3, bx + 3, g.t0 + g.torsoH - 3, "ex", 3)
      P.set(bx + 1, g.t0 + g.torsoH - 2, "metal", 1)
    }
  }
}

// ─── resolve: slots to letters ───────────────────────────────────────────────

function ramps(s: PersonSpec): Record<Slot, Ramp> {
  const one = (hex: string): Ramp => ({ hi: hex, mid: hex, lo: hex, deep: hex })
  const skin = skinRamp(s.skin)
  return {
    skin,
    hair: rampOf(colorHex(s.hair.color)),
    top: rampOf(colorHex(s.top.color)),
    top2: rampOf(colorHex(s.top.accent)),
    bottom: rampOf(colorHex(s.bottom.color)),
    shoe: rampOf(colorHex(s.shoes.color)),
    hat: rampOf(colorHex(s.hat.color)),
    hat2: rampOf(colorHex(s.hat.accent)),
    ex: rampOf(colorHex(s.extraColor)),
    eye: rampOf(colorHex(s.eyes)),
    ink: one("#2b1d2e"),
    white: one("#ffffff"),
    blush: one(blushHex(s.skin)),
    mouth: one(skin.deep),
    metal: rampOf("#bcc3cc"),
    sole: rampOf("#f4f1ee"),
  }
}

function resolve(P: Pix, s: PersonSpec): string[] {
  const R = ramps(s)
  const same = (x: number, y: number, slot: Slot) => P.get(x, y)?.slot === slot
  const out: string[] = []
  for (let y = 0; y < S; y++) {
    let row = ""
    for (let x = 0; x < S; x++) {
      const cell = P.get(x, y)
      if (!cell) {
        row += "."
        continue
      }
      const r = R[cell.slot]
      let tone = cell.tone
      if (tone === 0) {
        tone = 2
        if (AUTO.has(cell.slot)) {
          const dark = !same(x, y + 1, cell.slot) || !same(x + 1, y, cell.slot)
          const light = !same(x, y - 1, cell.slot) || !same(x - 1, y, cell.slot)
          tone = dark && !light ? 3 : light && !dark ? 1 : 2
        }
      }
      const hex = tone === 1 ? r.hi : tone === 3 ? r.lo : tone === 4 ? r.deep : r.mid
      row += cell.slot === "ink" ? "k" : cell.slot === "white" ? "w" : letterFor(hex)
    }
    out.push(row)
  }
  return out
}

/** Wrap the figure in the game's plum outline, as every sprite has. */
function outline(rows: string[]): string[] {
  const at = (x: number, y: number) => rows[y]?.[x] ?? "."
  return rows.map((row, y) => [...row].map((ch, x) => (ch === "." && (at(x, y - 1) !== "." || at(x, y + 1) !== "." || at(x - 1, y) !== "." || at(x + 1, y) !== ".") ? "k" : ch)).join(""))
}

function trim(rows: string[]): string[] {
  return rows.map((row, y) => (y === 0 || y === S - 1 ? ".".repeat(S) : "." + row.slice(1, S - 1) + "."))
}

const cache = new Map<string, string[]>()

/** The 32×32 letter grid for a person seen from `view` in `pose`. Cached by spec; same input, same grid. */
export function drawPerson(spec: PersonSpec, view: View, pose: PersonPose = "stand"): string[] {
  const key = `${JSON.stringify(spec)}|${view}|${pose}`
  const hit = cache.get(key)
  if (hit) return hit
  const P = new Pix()
  const c: Ctx = { P, g: geo(spec), s: spec, pose }
  if (view === "side") {
    sideBody(c)
    extras(c, view)
    headSide(c)
  } else {
    const back = view === "back"
    legsFront(c, back)
    torsoFront(c, back)
    extras(c, view)
    headFront(c, back)
  }
  const grid = trim(outline(resolve(P, spec)))
  cache.set(key, grid)
  return grid
}

/** Forget every cached grid (a spec changed under the same id). */
export function clearPeopleCache() {
  cache.clear()
}

export { FOOT as PERSON_FOOT, S as PERSON_SIZE }
