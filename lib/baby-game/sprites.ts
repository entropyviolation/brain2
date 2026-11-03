/**
 * lib/baby-game/sprites.ts — Baby animals as 32×32 side-view pixel sprites, sized against each other
 *
 * Each animal faces right, stands on row 29, and is as big as a baby of that kind really is next to the others: a
 * capybara pup is three times the mouse. Four builders do the drawing from small parameter tables: `quad` (four-legged
 * animals), `fowl` (birds), and three custom shapes (hedgehog, seal, penguin, owl). The pipeline after drawing is the
 * same for all: `shade` lights the top-left rim and darkens every bottom rim, `fur` scatters flecks so nothing is flat,
 * `face` marks (eyes, stripes, spots) go on top, and `outline` wraps the figure in warm plum. The renderer flips a sprite
 * when its animal walks left. The palette extends `PIXEL_PALETTE`. Yellow only where a subject needs it; no gold.
 */

import { PIXEL_PALETTE } from "@/components/friend-details/PixelIcon"
import { GEN_GRIDS } from "./gen-sprites"
import { HYRAX_GRIDS } from "./hyrax"
import { paletteSink } from "./people/registry"
import { playerGridOf } from "./people/player"

export const SPRITE_PALETTE: Record<string, string> = {
  ...PIXEL_PALETTE,
  O: "#e8915a", // apricot
  o: "#f6c9a0", // peach
  Q: "#b5603a", // rust
  e: "#fbf1e6", // cream
  E: "#e3cdb6", // cream shade
  a: "#c9c1cc", // ash
  A: "#8a8294", // ash shade
  z: "#4b4456", // charcoal
  f: "#d9a066", // fawn tan
  F: "#a8683c", // brown
  j: "#5f3f31", // dark brown
  y: "#2e2933", // near black
  i: "#fcefa8", // duckling down, light (generated sprites only, `gen-sprites.ts`)
  I: "#f2cf5b", // duckling down
  J: "#d39a3a", // duckling down, shade
}

// people bring their own colors (every shirt is one); the drawer adds them to this palette
paletteSink.target = SPRITE_PALETTE

/** [light, dark] for a paint letter. Letters not listed stay flat. */
const SHADE: Record<string, [string, string]> = {
  O: ["o", "Q"], e: ["w", "E"], o: ["w", "E"], E: ["e", "a"], a: ["l", "A"], z: ["A", "y"], A: ["a", "z"], y: ["z", "k"],
  f: ["o", "F"], F: ["f", "j"], j: ["F", "k"], t: ["o", "T"], T: ["t", "u"], l: ["w", "s"], s: ["w", "S"],
  p: ["w", "P"], b: ["w", "B"], B: ["b", "n"], G: ["g", "h"], u: ["T", "k"], Q: ["O", "j"], d: ["S", "k"], P: ["p", "q"],
}

export const SPRITE_SIZE = 32
/** The row an animal's feet end on, so the renderer can stand every sprite on the same line. */
export const SPRITE_FOOT = 29

/** How big each animal stands in the world, against the 32×32 grid (1 = the grid, the same height as the player). Small
 * things are small: most babies come to the player's knee. Anything not listed (the player, the pixie) stays 1. */
export const SPRITE_SCALE: Record<string, number> = {
  chick: 0.4, mouse: 0.4, duckling: 0.4, blackduck: 0.4, gosling: 0.45, hedgehog: 0.45, bunny: 0.5, kitten: 0.5,
  possum: 0.5, possum2: 0.5, possum3: 0.45, skunk: 0.55, crow: 0.55, owl: 0.6, otter: 0.6, fox: 0.65, puppy: 0.65,
  penguin: 0.65, seal: 0.7, fawn: 0.8, cub: 0.8, wolf: 0.9, foal: 0.9, capybara: 0.85,
  meerkat: 0.55, raccoon: 0.6, lamb: 0.55, goat: 0.6, piglet: 0.5, shipcat: 0.5,
}
export const spriteScale = (id: string): number => SPRITE_SCALE[id] ?? 1
const S = SPRITE_SIZE
const G = SPRITE_FOOT

type Cell = { ch: string; layer: number }

class Canvas {
  cells: Cell[][] = Array.from({ length: S }, () => Array.from({ length: S }, () => ({ ch: ".", layer: 0 })))
  layer = 1

  next() {
    this.layer += 1
  }

  put(x: number, y: number, ch: string) {
    x = Math.round(x)
    y = Math.round(y)
    if (x < 1 || y < 0 || x >= S - 1 || y >= S) return
    this.cells[y]![x] = { ch, layer: this.layer }
  }

  pts(ch: string, list: Array<[number, number]>) {
    for (const [x, y] of list) this.put(x, y, ch)
  }

  rect(x0: number, y0: number, x1: number, y1: number, ch: string) {
    for (let y = Math.round(y0); y <= Math.round(y1); y++) for (let x = Math.round(x0); x <= Math.round(x1); x++) this.put(x, y, ch)
  }

  ell(cx: number, cy: number, rx: number, ry: number, ch: string) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx
        const dy = (y - cy) / ry
        if (dx * dx + dy * dy <= 1) this.put(x, y, ch)
      }
    }
  }

  /** A filled triangle; pixel centers inside it. */
  tri(a: [number, number], b: [number, number], c: [number, number], ch: string) {
    const side = (p: [number, number], q: [number, number], x: number, y: number) => (x - q[0]) * (p[1] - q[1]) - (p[0] - q[0]) * (y - q[1])
    const x0 = Math.floor(Math.min(a[0], b[0], c[0]))
    const x1 = Math.ceil(Math.max(a[0], b[0], c[0]))
    const y0 = Math.floor(Math.min(a[1], b[1], c[1]))
    const y1 = Math.ceil(Math.max(a[1], b[1], c[1]))
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d1 = side(a, b, x + 0.5, y + 0.5)
        const d2 = side(b, c, x + 0.5, y + 0.5)
        const d3 = side(c, a, x + 0.5, y + 0.5)
        if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) this.put(x, y, ch)
      }
    }
  }

  /** A thick line of dots, for tails and whiskers. */
  line(a: [number, number], b: [number, number], ch: string, w = 1) {
    const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) * 2 || 1
    for (let i = 0; i <= n; i++) {
      const x = a[0] + ((b[0] - a[0]) * i) / n
      const y = a[1] + ((b[1] - a[1]) * i) / n
      if (w <= 1) this.put(x, y, ch)
      else this.ell(x, y, w / 2, w / 2, ch)
    }
  }

  /** A baby's side-view eye: two wide, three tall, a glint in the corner toward the viewer. */
  eye(x: number, y: number, size = 1) {
    if (size >= 1) {
      this.rect(x, y, x + 1, y + 2, "k")
      this.put(x + 1, y, "w")
      this.put(x + 1, y + 1, "w")
    } else {
      this.rect(x, y, x + 1, y + 1, "k")
      this.put(x + 1, y, "w")
    }
  }

  at(x: number, y: number): string {
    return this.cells[y]?.[x]?.ch ?? "."
  }
}

const empty = (cell: Cell | undefined) => !cell || cell.ch === "."

function shade(c: Canvas) {
  const next = c.cells.map((row) => row.map((cell) => ({ ...cell })))
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const cell = c.cells[y]![x]!
      const tones = SHADE[cell.ch]
      if (!tones) continue
      const below = c.cells[y + 1]?.[x]
      const above = c.cells[y - 1]?.[x]
      const left = c.cells[y]?.[x - 1]
      if (empty(below) || (below && below.layer < cell.layer)) next[y]![x]!.ch = tones[1]
      else if (empty(above) || empty(left)) next[y]![x]!.ch = tones[0]
    }
  }
  c.cells = next
}

const flake = (x: number, y: number, k: number) => {
  let t = (x * 374761393 + y * 668265263 + k * 2147483647) >>> 0
  t = (t ^ (t >>> 13)) * 1274126177
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296
}

/** Fur: darker and lighter flecks on interior cells, so a flat color reads as fluff. */
function fur(c: Canvas, letters: string, amount = 0.11) {
  const next = c.cells.map((row) => row.map((cell) => ({ ...cell })))
  for (let y = 1; y < S - 1; y++) {
    for (let x = 1; x < S - 1; x++) {
      const ch = c.cells[y]![x]!.ch
      if (!letters.includes(ch) || !SHADE[ch]) continue
      const solid = [c.cells[y - 1]![x], c.cells[y + 1]![x], c.cells[y]![x - 1], c.cells[y]![x + 1]].every((n) => n!.ch === ch)
      if (!solid) continue
      const r = flake(x, y, ch.charCodeAt(0))
      const soft = "eloaE".includes(ch) ? 0.6 : 1
      if (r < amount * soft) next[y]![x]!.ch = SHADE[ch]![1]
      else if (r > 1 - amount * 0.5) next[y]![x]!.ch = SHADE[ch]![0]
    }
  }
  c.cells = next
}

function trim(c: Canvas) {
  for (const y of [0, S - 1]) c.cells[y] = Array.from({ length: S }, () => ({ ch: ".", layer: 0 }))
  for (const x of [0, S - 1]) for (let y = 0; y < S; y++) c.cells[y]![x] = { ch: ".", layer: 0 }
}

function outline(c: Canvas) {
  const next = c.cells.map((row) => row.map((cell) => ({ ...cell })))
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (!empty(c.cells[y]![x])) continue
      const near = [c.cells[y - 1]?.[x], c.cells[y + 1]?.[x], c.cells[y]?.[x - 1], c.cells[y]?.[x + 1]]
      if (near.some((cell) => !empty(cell))) next[y]![x]!.ch = "k"
    }
  }
  c.cells = next
}

// ─── four-legged animals, side view ────────────────────────────────────────

type Ear = { kind: "point" | "round" | "long" | "floppy" | "leaf" | "none"; size: number; inner?: string; ch?: string }
type Tail = { kind: "bush" | "thin" | "short" | "curl" | "thick" | "none"; size: number; ch?: string; tip?: string }

type Quad = {
  fur: string
  belly?: string
  /** Far-side legs, back ear, and anything behind the body. Defaults to the fur's shadow. */
  far?: string
  sock?: string
  size: number
  /** Body center x. */
  cx: number
  body: [number, number]
  leg: [number, number]
  head: [number, number]
  /** Forward snout: length, height, color. */
  snout?: [number, number, string]
  ear: Ear
  tail: Tail
  nose: string
  haunch?: boolean
  /** Markings, drawn last, given the geometry. */
  mark?: (c: Canvas, g: Geo) => void
}

type Geo = { bx: number; by: number; brx: number; bry: number; hx: number; hy: number; hrx: number; hry: number; legTop: number; snoutX: number; snoutY: number; s: number }

function quad(c: Canvas, p: Quad): Geo {
  const s = p.size
  const legH = p.leg[0] * s
  const legW = Math.max(2, Math.round(p.leg[1] * s))
  const brx = p.body[0] * s
  const bry = p.body[1] * s
  const bx = p.cx
  const by = G - legH - bry + 2
  const legTop = by + bry * 0.4
  const far = p.far ?? p.fur
  const frontX = bx + brx * 0.58
  const backX = bx - brx * 0.62
  // far legs and tail go behind the body
  for (const lx of [frontX + legW, backX + legW]) {
    c.rect(lx - 1, legTop, lx - 1 + legW - 1, G, far)
    if (p.sock) c.rect(lx - 1, G - 2, lx - 1 + legW - 1, G, p.sock)
  }
  const tail = p.tail
  const tc = tail.ch ?? p.fur
  const tx = bx - brx + 0.5
  const ty = by - bry * 0.2
  const ts = tail.size * s
  if (tail.kind === "bush") {
    c.ell(tx - ts * 0.8, ty + ts * 0.1, ts * 1.1, ts * 0.65, tc)
    if (tail.tip) c.ell(tx - ts * 1.5, ty + ts * 0.15, ts * 0.45, ts * 0.45, tail.tip)
  } else if (tail.kind === "thin") {
    c.line([tx, ty + 1], [tx - ts * 0.9, ty - ts * 0.3], tc, 2)
    c.line([tx - ts * 0.9, ty - ts * 0.3], [tx - ts * 0.8, ty - ts * 1.3], tc, 2)
  } else if (tail.kind === "curl") {
    c.line([tx, ty + 2], [tx - ts * 0.6, ty + ts * 0.7], tc, 2)
    c.line([tx - ts * 0.6, ty + ts * 0.7], [tx - ts * 1.4, ty + ts * 0.2], tc, 2)
    c.line([tx - ts * 1.4, ty + ts * 0.2], [tx - ts * 1.5, ty - ts * 0.6], tc, 2)
    c.line([tx - ts * 1.5, ty - ts * 0.6], [tx - ts * 0.9, ty - ts * 0.9], tc, 2)
  } else if (tail.kind === "short") {
    c.ell(tx - ts * 0.3, ty, ts, ts, tc)
  } else if (tail.kind === "thick") {
    c.ell(tx - ts * 0.9, ty + ts * 0.3, ts * 1.2, ts * 0.5, tc)
    c.ell(tx - ts * 1.8, ty + ts * 0.1, ts * 0.7, ts * 0.4, tc)
  }
  c.next()
  // body
  c.ell(bx, by, brx, bry, p.fur)
  if (p.haunch) c.ell(bx - brx * 0.35, by + bry * 0.15, brx * 0.5, bry * 0.95, p.fur)
  c.next()
  if (p.belly) {
    c.ell(bx + brx * 0.1, by + bry * 0.55, brx * 0.7, bry * 0.5, p.belly)
    c.next()
  }
  // near legs
  for (const lx of [frontX, backX]) {
    c.rect(lx, legTop, lx + legW - 1, G, p.fur)
    if (p.sock) c.rect(lx, G - 2, lx + legW - 1, G, p.sock)
  }
  c.next()
  // head
  const hrx = p.head[0] * s
  const hry = p.head[1] * s
  const hx = bx + brx * 0.78 + hrx * 0.45
  const hy = by - bry * 0.55
  const sn = p.snout
  const snoutX = hx + hrx * 0.6
  const snoutY = hy + hry * 0.35
  // ears behind the head
  const e = p.ear
  const ec = e.ch ?? p.fur
  const es = e.size * s
  const earBase: [number, number] = [hx - hrx * 0.25, hy - hry * 0.55]
  const farEar = p.far ?? ec
  const drawEar = (dx: number, col: string, inner: string | undefined) => {
    const [ex, ey] = [earBase[0] + dx, earBase[1]]
    if (e.kind === "point") {
      c.tri([ex - es * 0.55, ey + 2], [ex + es * 0.1, ey - es * 1.5], [ex + es * 0.6, ey + 2], col)
      if (inner) c.tri([ex - es * 0.2, ey + 1], [ex + es * 0.1, ey - es * 0.9], [ex + es * 0.3, ey + 1], inner)
    } else if (e.kind === "long") {
      c.ell(ex + 1, ey - es * 0.9, es * 0.4, es * 1.2, col)
      if (inner) c.ell(ex + 1, ey - es * 0.8, es * 0.18, es * 0.85, inner)
    } else if (e.kind === "round") {
      c.ell(ex, ey - es * 0.3, es * 0.7, es * 0.7, col)
      if (inner) c.ell(ex, ey - es * 0.25, es * 0.38, es * 0.38, inner)
    } else if (e.kind === "floppy") {
      c.ell(ex - 1, ey + es * 0.9, es * 0.55, es * 1.1, col)
    } else if (e.kind === "leaf") {
      c.ell(ex, ey - es * 0.4, es * 0.45, es * 0.95, col)
      if (inner) c.ell(ex, ey - es * 0.35, es * 0.2, es * 0.65, inner)
    }
  }
  if (e.kind !== "none") drawEar(-hrx * 0.45, farEar, undefined)
  c.next()
  c.ell(hx, hy, hrx, hry, p.fur)
  if (sn) {
    c.rect(snoutX - 1, snoutY - sn[1] / 2, snoutX + sn[0], snoutY + sn[1] / 2, sn[2])
    c.pts(p.nose, [[snoutX + sn[0], snoutY - sn[1] / 2 + 0], [snoutX + sn[0], snoutY - sn[1] / 2 + 1], [snoutX + sn[0] - 1, snoutY - sn[1] / 2]])
  } else {
    c.pts(p.nose, [[hx + hrx - 1, hy + 1], [hx + hrx - 1, hy + 2]])
  }
  c.next()
  if (e.kind !== "none") drawEar(hrx * 0.15, ec, e.inner)
  c.next()
  // the eye, big and glinting
  c.eye(hx + hrx * 0.28, hy - hry * 0.25, s > 0.7 ? 1 : 0.5)
  const g: Geo = { bx, by, brx, bry, hx, hy, hrx, hry, legTop, snoutX, snoutY, s }
  p.mark?.(c, g)
  return g
}

// ─── birds ─────────────────────────────────────────────────────────────────

type Fowl = {
  fur: string
  belly?: string
  wing?: string
  beak: string
  beakLen: number
  beakFlat?: boolean
  foot: string
  size: number
  cx: number
  /** Neck height: how far the head sits above the body. */
  neck: number
  crest?: string
  tail?: number
  bright?: string
}

function fowl(c: Canvas, p: Fowl) {
  const s = p.size
  const bx = p.cx
  const brx = 8 * s
  const bry = 6 * s
  const by = G - 4 * s - bry + 1
  // legs
  for (const lx of [bx - 1, bx + 3]) {
    c.rect(lx, by + bry - 1, lx, G, p.foot)
    c.rect(lx - 1, G, lx + 2, G, p.foot)
  }
  c.next()
  // tail
  if (p.tail) c.tri([bx - brx + 1, by - 2], [bx - brx - p.tail * s, by - bry * 0.7], [bx - brx + 1, by + 3], p.wing ?? p.fur)
  c.next()
  c.ell(bx, by, brx, bry, p.fur)
  c.next()
  if (p.belly) c.ell(bx + brx * 0.18, by + bry * 0.5, brx * 0.75, bry * 0.55, p.belly)
  c.next()
  // wing
  c.ell(bx - brx * 0.15, by - bry * 0.1, brx * 0.55, bry * 0.55, p.wing ?? p.fur)
  if (p.wing) c.line([bx - brx * 0.6, by + 1], [bx + brx * 0.2, by + bry * 0.3], p.wing, 1)
  c.next()
  // neck and head
  const hrx = 5.2 * s
  const hx = bx + brx * 0.78
  const hy = by - bry - p.neck * s + 1
  c.rect(hx - 2.5 * s, hy + hrx * 0.6, hx + 2 * s, by - bry * 0.4, p.fur)
  c.ell(hx, hy, hrx, hrx * 0.95, p.fur)
  if (p.crest) c.tri([hx - 2, hy - hrx * 0.7], [hx - 4, hy - hrx - 3], [hx + 1, hy - hrx * 0.7], p.crest)
  c.next()
  // beak
  const bk = p.beakLen * s
  if (p.beakFlat) {
    c.rect(hx + hrx - 1, hy + 1, hx + hrx + bk, hy + 2, p.beak)
    c.pts("k", [[hx + hrx + bk - 1, hy + 1]])
  } else {
    c.tri([hx + hrx - 1.5, hy - 1.5], [hx + hrx + bk, hy + 1], [hx + hrx - 1.5, hy + 3], p.beak)
  }
  c.next()
  c.eye(hx + 1.4 * s, hy - 1.8 * s, 1)
  return { bx, by, brx, bry, hx, hy, hrx }
}

// ─── the species ───────────────────────────────────────────────────────────

type Species = { draw: (c: Canvas) => void; fur?: string }

const stripes = (c: Canvas, g: Geo, ch: string) => {
  for (let i = -2; i <= 2; i++) c.line([g.bx + i * 2.4 - 1, g.by - g.bry + 1], [g.bx + i * 2.4, g.by - g.bry * 0.1], ch, 1)
}

const SPECIES: Record<string, Species> = {
  bunny: {
    fur: "e",
    draw: (c) => {
      quad(c, {
        fur: "e", belly: "e", far: "E", size: 0.95, cx: 14, body: [7, 5.6], leg: [4, 3], head: [4.8, 4.4], ear: { kind: "long", size: 4.4, inner: "p" },
        tail: { kind: "short", size: 2.4, ch: "w" }, nose: "P", haunch: true,
        mark: (c2, g) => {
          c2.pts("p", [[g.hx + g.hrx - 3, g.hy + 2], [g.hx + g.hrx - 4, g.hy + 3]])
          c2.pts("p", [[g.hx + g.hrx * 0.3, g.hy + 2], [g.hx + g.hrx * 0.3 + 1, g.hy + 3]])
        },
      })
    },
  },
  kitten: {
    fur: "a",
    draw: (c) => {
      quad(c, {
        fur: "a", belly: "e", far: "A", sock: "e", size: 0.9, cx: 14, body: [7.4, 4.8], leg: [5.4, 3], head: [5, 4.6], ear: { kind: "point", size: 4, inner: "p" },
        tail: { kind: "curl", size: 6, ch: "a" }, nose: "P",
        mark: (c2, g) => {
          stripes(c2, g, "A")
          c2.line([g.hx - 1, g.hy - g.hry + 1], [g.hx - 1, g.hy - 1], "A", 1)
          c2.line([g.hx - 4, g.hy - g.hry + 2], [g.hx - 3, g.hy], "A", 1)
          c2.pts("e", [[g.hx + g.hrx - 2, g.hy + 2], [g.hx + g.hrx - 3, g.hy + 3], [g.hx + g.hrx - 4, g.hy + 3]])
          c2.pts("w", [[g.hx + g.hrx + 2, g.hy + 1], [g.hx + g.hrx + 3, g.hy + 2]])
        },
      })
    },
  },
  puppy: {
    fur: "f",
    draw: (c) => {
      quad(c, {
        fur: "f", belly: "o", far: "F", sock: "o", size: 0.98, cx: 14, body: [7.8, 5.2], leg: [5.4, 3.2], head: [5.4, 5], snout: [3, 3, "o"], ear: { kind: "floppy", size: 4, ch: "F" },
        tail: { kind: "thin", size: 5, ch: "f" }, nose: "k",
        mark: (c2, g) => {
          c2.pts("P", [[g.snoutX + 1, g.snoutY + 3], [g.snoutX + 2, g.snoutY + 3]])
          c2.pts("p", [[g.hx + 1, g.hy + 2], [g.hx, g.hy + 2]])
        },
      })
    },
  },
  cub: {
    fur: "F",
    draw: (c) => {
      quad(c, {
        fur: "F", belly: "f", far: "j", sock: "j", size: 1.02, cx: 14, body: [8.6, 6.4], leg: [4.6, 4], head: [5.8, 5.4], snout: [2.8, 3, "f"], ear: { kind: "round", size: 3.2, inner: "f" },
        tail: { kind: "short", size: 1.8, ch: "F" }, nose: "k",
        mark: (c2, g) => c2.pts("p", [[g.hx + 1, g.hy + 3], [g.hx, g.hy + 3]]),
      })
    },
  },
  fox: {
    fur: "O",
    draw: (c) => {
      quad(c, {
        fur: "O", belly: "e", far: "Q", sock: "y", size: 0.98, cx: 15, body: [7.6, 4.6], leg: [6.4, 2.8], head: [5, 4.4], snout: [3.8, 2.4, "e"], ear: { kind: "point", size: 4.6, inner: "y", ch: "O" },
        tail: { kind: "bush", size: 4.2, ch: "O", tip: "e" }, nose: "k",
        mark: (c2, g) => {
          c2.tri([g.hx - 1, g.hy + g.hry - 1], [g.hx + g.hrx - 1, g.hy + 1], [g.hx + g.hrx - 1, g.hy + g.hry], "e")
          c2.pts("O", [[g.hx + 3, g.hy - 4], [g.hx + 4, g.hy - 3]])
        },
      })
    },
  },
  wolf: {
    fur: "a",
    draw: (c) => {
      quad(c, {
        fur: "a", belly: "e", far: "A", sock: "A", size: 1.1, cx: 14, body: [8, 4.8], leg: [7, 3], head: [5, 4.6], snout: [4.2, 2.6, "e"], ear: { kind: "point", size: 4.8, inner: "p" },
        tail: { kind: "bush", size: 3.4, ch: "a", tip: "z" }, nose: "k",
        mark: (c2, g) => {
          c2.line([g.bx - g.brx * 0.7, g.by - g.bry + 1], [g.bx + g.brx * 0.5, g.by - g.bry + 1], "A", 1)
          c2.line([g.bx - g.brx * 0.4, g.by - g.bry + 2], [g.bx + g.brx * 0.2, g.by - g.bry + 3], "A", 1)
          c2.tri([g.hx, g.hy + g.hry - 1], [g.hx + g.hrx, g.hy + 1], [g.hx + g.hrx, g.hy + g.hry], "e")
        },
      })
    },
  },
  mouse: {
    fur: "a",
    draw: (c) => {
      quad(c, {
        fur: "a", belly: "e", far: "A", sock: "p", size: 0.78, cx: 14, body: [6.4, 4.4], leg: [3, 2.4], head: [4, 3.6], snout: [3, 2.2, "a"], ear: { kind: "round", size: 4.2, inner: "p" },
        tail: { kind: "thin", size: 7, ch: "p" }, nose: "P",
        mark: (c2, g) => {
          c2.pts("w", [[g.snoutX + 4, g.snoutY], [g.snoutX + 5, g.snoutY - 1], [g.snoutX + 4, g.snoutY + 2], [g.snoutX + 5, g.snoutY + 3]])
        },
      })
    },
  },
  otter: {
    fur: "F",
    draw: (c) => {
      quad(c, {
        fur: "F", belly: "f", far: "j", sock: "j", size: 1, cx: 14, body: [10, 4.4], leg: [3.8, 3.2], head: [4.8, 4.4], snout: [2.4, 3.2, "e"], ear: { kind: "round", size: 1.8 },
        tail: { kind: "thick", size: 4, ch: "F" }, nose: "k",
        mark: (c2, g) => {
          c2.ell(g.hx + 1, g.hy + g.hry * 0.7, g.hrx * 0.7, g.hry * 0.5, "e")
          c2.pts("w", [[g.snoutX + 3, g.snoutY], [g.snoutX + 4, g.snoutY - 1], [g.snoutX + 3, g.snoutY + 2]])
        },
      })
    },
  },
  fawn: {
    fur: "f",
    draw: (c) => {
      quad(c, {
        fur: "f", belly: "e", far: "F", sock: "j", size: 1.12, cx: 14, body: [7, 4.6], leg: [9.2, 2.2], head: [4.4, 4.2], snout: [4, 2.6, "e"], ear: { kind: "leaf", size: 4.6, inner: "p" },
        tail: { kind: "short", size: 1.8, ch: "e" }, nose: "k",
        mark: (c2, g) => {
          for (const [dx, dy] of [[-4, -3], [-1, -3.5], [2, -3], [-2.5, -1], [0.5, -1.2], [-5, -0.5], [3, -0.4]] as const) c2.pts("w", [[g.bx + dx, g.by + dy]])
        },
      })
    },
  },
  foal: {
    fur: "F",
    draw: (c) => {
      quad(c, {
        fur: "F", belly: "f", far: "j", sock: "e", size: 1.2, cx: 13, body: [7.6, 5], leg: [10, 2.6], head: [4.2, 4.6], snout: [5.6, 3.8, "o"], ear: { kind: "point", size: 3.6, inner: "p" },
        tail: { kind: "thick", size: 3.6, ch: "j" }, nose: "j",
        mark: (c2, g) => {
          c2.line([g.hx - 2, g.hy - g.hry - 1], [g.bx + g.brx * 0.3, g.by - g.bry + 1], "j", 3)
          c2.line([g.hx + 1, g.hy - g.hry + 2], [g.hx + g.hrx + 2, g.hy + g.hry - 1], "e", 1)
        },
      })
    },
  },
  capybara: {
    fur: "f",
    draw: (c) => {
      quad(c, {
        fur: "f", belly: "F", far: "F", size: 0.98, cx: 10.5, body: [9.6, 6.2], leg: [3.6, 3.4], head: [5.4, 5.2], snout: [3.6, 4.6, "F"], ear: { kind: "round", size: 1.6, inner: "F" },
        tail: { kind: "none", size: 0 }, nose: "j",
        mark: (c2, g) => {
          c2.pts("j", [[g.snoutX + 1, g.snoutY - 1], [g.snoutX + 2, g.snoutY]])
          for (let i = 0; i < 18; i++) c2.pts("F", [[g.bx - g.brx * 0.7 + (i * 7) % (g.brx * 1.5), g.by - g.bry * 0.5 + ((i * 5) % g.bry)]])
        },
      })
    },
  },
  skunk: {
    fur: "y",
    draw: (c) => {
      quad(c, {
        fur: "y", belly: "z", far: "y", sock: "w", size: 1, cx: 15, body: [6.8, 4.8], leg: [4.6, 3], head: [4.4, 4.2], snout: [2.8, 2.6, "z"], ear: { kind: "round", size: 2.2, inner: "p" },
        tail: { kind: "bush", size: 5.2, ch: "y", tip: "w" }, nose: "P",
        mark: (c2, g) => {
          c2.line([g.snoutX + 1, g.snoutY - 1], [g.hx - 2, g.hy - g.hry + 1], "w", 2)
          c2.line([g.hx - 2, g.hy - g.hry + 1], [g.bx + g.brx * 0.2, g.by - g.bry + 1], "w", 2)
          c2.line([g.bx + g.brx * 0.2, g.by - g.bry + 1], [g.bx - g.brx + 1, g.by - g.bry * 0.4], "w", 2)
          c2.line([g.bx - g.brx - 2, g.by - 3], [g.bx - g.brx - 4, g.by - 1], "w", 1)
        },
      })
    },
  },
  // three baby opossums: the same animal in three coats, with the long bare tail and the white face
  possum: { fur: "a", draw: (c) => possum(c, "a", "l", "z") },
  possum2: { fur: "A", draw: (c) => possum(c, "A", "e", "y") },
  possum3: { fur: "e", draw: (c) => possum(c, "e", "w", "A") },
  // Rhizome's six: built from the same quad parameters as the rest (the meerkat is a snapped ComfyUI drawing in `gen-sprites.ts`)
  raccoon: {
    fur: "a",
    draw: (c) => {
      quad(c, {
        fur: "a", belly: "e", far: "A", sock: "z", size: 0.9, cx: 14, body: [7, 4.8], leg: [5, 3], head: [5, 4.4], snout: [3.2, 2.4, "e"], ear: { kind: "round", size: 2.4, inner: "z" },
        tail: { kind: "bush", size: 5, ch: "a", tip: "z" }, nose: "k",
        mark: (c2, g) => {
          // the mask runs from the eye back across the cheek
          c2.line([g.hx - 2, g.hy - 1], [g.hx + g.hrx * 0.28 - 1, g.hy - g.hry * 0.25 + 1], "z", 1)
          c2.pts("z", [[g.hx - 1, g.hy], [g.hx, g.hy + 1]])
          c2.pts("z", [[g.bx - g.brx - 3, g.by - 3], [g.bx - g.brx - 4, g.by - 2], [g.bx - g.brx - 5, g.by - 1]])
        },
      })
    },
  },
  lamb: {
    fur: "e",
    draw: (c) => {
      quad(c, {
        fur: "e", belly: "E", far: "E", sock: "z", size: 0.9, cx: 14, body: [7.8, 5.6], leg: [4.6, 2.6], head: [4.4, 4.4], ear: { kind: "floppy", size: 3, ch: "z" },
        tail: { kind: "short", size: 2, ch: "e" }, nose: "P",
        mark: (c2, g) => {
          for (let i = 0; i < 14; i++) c2.pts("E", [[g.bx - g.brx * 0.8 + (i * 5) % (g.brx * 1.6), g.by - g.bry * 0.7 + ((i * 3) % g.bry)]])
          c2.pts("e", [[g.hx - 1, g.hy - g.hry - 1], [g.hx, g.hy - g.hry - 1], [g.hx + 1, g.hy - g.hry]])
        },
      })
    },
  },
  goat: {
    fur: "f",
    draw: (c) => {
      quad(c, {
        fur: "f", belly: "e", far: "F", sock: "j", size: 0.95, cx: 14, body: [7, 4.6], leg: [6, 2.8], head: [4.6, 4.2], snout: [3, 2.6, "e"], ear: { kind: "leaf", size: 3, inner: "o" },
        tail: { kind: "short", size: 1.6, ch: "f" }, nose: "k",
        mark: (c2, g) => {
          c2.pts("E", [[g.hx - 1, g.hy - g.hry - 1], [g.hx, g.hy - g.hry - 2], [g.hx + 1, g.hy - g.hry - 1]])
          c2.pts("e", [[g.snoutX, g.snoutY + 2], [g.snoutX, g.snoutY + 3]])
        },
      })
    },
  },
  piglet: {
    fur: "p",
    draw: (c) => {
      quad(c, {
        fur: "p", belly: "o", far: "P", sock: "P", size: 0.85, cx: 14, body: [7, 5], leg: [4, 2.6], head: [5, 4.6], snout: [2.6, 3.2, "P"], ear: { kind: "floppy", size: 3.6, ch: "P" },
        tail: { kind: "curl", size: 3, ch: "p" }, nose: "k",
        mark: (c2, g) => c2.pts("k", [[g.snoutX + 1, g.snoutY], [g.snoutX + 1, g.snoutY + 1]]),
      })
    },
  },
  shipcat: {
    fur: "z",
    draw: (c) => {
      quad(c, {
        fur: "z", belly: "e", far: "y", sock: "e", size: 0.9, cx: 14, body: [7.4, 4.8], leg: [5.4, 3], head: [5, 4.6], ear: { kind: "point", size: 4, inner: "p" },
        tail: { kind: "curl", size: 6, ch: "z" }, nose: "P",
        mark: (c2, g) => {
          c2.pts("e", [[g.hx + g.hrx - 2, g.hy + 2], [g.hx + g.hrx - 3, g.hy + 3], [g.hx + g.hrx - 4, g.hy + 3]])
          c2.pts("e", [[g.bx + g.brx - 2, g.by], [g.bx + g.brx - 3, g.by + 1], [g.bx + g.brx - 3, g.by + 2]])
          c2.pts("w", [[g.hx + g.hrx + 2, g.hy + 1], [g.hx + g.hrx + 3, g.hy + 2]])
        },
      })
    },
  },
  hedgehog: {
    fur: "o",
    draw: (c) => {
      // legs and snout
      c.rect(8, 25, 10, G, "o")
      c.rect(18, 25, 20, G, "o")
      c.pts("p", [[8, G], [9, G], [18, G], [19, G]])
      c.next()
      c.ell(13, 21, 10, 7.4, "j")
      c.next()
      c.ell(13, 22, 9.2, 6.4, "F")
      c.next()
      c.ell(22.4, 24, 5, 3.6, "o")
      c.tri([21, 22], [29, 25.6], [21, 27], "o")
      c.pts("k", [[29, 25], [29, 26]])
      c.next()
      c.ell(21, 20, 1.8, 1.8, "o")
      c.eye(24, 22, 1)
      for (let y = 8; y < 28; y++) {
        for (let x = 2; x < 24; x++) {
          const ch = c.at(x, y)
          if (ch !== "F" && ch !== "j") continue
          const r = flake(x, y, 9)
          if (r < 0.32) c.put(x, y, "t")
          else if (r < 0.5) c.put(x, y, "u")
        }
      }
      for (let x = 3; x < 23; x += 2) {
        const top = [...Array(24).keys()].find((y) => c.at(x, y + 1) !== ".")
        if (top !== undefined && top > 2) c.put(x, top, flake(x, 3, 3) < 0.5 ? "u" : "t")
      }
    },
  },
  seal: {
    fur: "e",
    draw: (c) => {
      c.ell(14, 23, 11, 5.6, "e")
      c.tri([4, 25], [1.5, 27.6], [2, 21], "a")
      c.next()
      c.ell(15, 26, 9, 2.8, "l")
      c.next()
      c.ell(22, 17, 6, 6, "e")
      c.next()
      c.ell(25.4, 20.4, 3.4, 2.5, "l")
      c.ell(18, 26, 3.6, 1.6, "a")
      c.pts("k", [[28, 19], [29, 19], [28, 20], [29, 20]])
      c.next()
      c.eye(22, 14, 1)
      c.pts("w", [[28, 21], [29, 22], [28, 23], [29, 24]])
      c.pts("p", [[21, 19], [22, 19]])
    },
  },
  penguin: {
    fur: "A",
    draw: (c) => {
      c.rect(11, 28, 14, G, "z")
      c.rect(17, 28, 20, G, "z")
      c.next()
      c.ell(15, 19, 8.2, 9.4, "A")
      c.next()
      c.ell(16.4, 21, 5.2, 7, "l")
      c.next()
      c.ell(15, 9, 6, 6, "A")
      c.ell(16.6, 10, 4, 4.4, "l")
      c.tri([21, 9], [27, 11.4], [21, 13.4], "z")
      c.ell(8, 20, 2, 5.4, "z")
      c.next()
      c.eye(18, 6, 1)
      c.pts("p", [[17, 12], [18, 12]])
    },
  },
  owl: {
    fur: "F",
    draw: (c) => {
      c.rect(12, 28, 14, G, "O")
      c.rect(18, 28, 20, G, "O")
      c.next()
      c.ell(15, 19, 9.4, 10, "F")
      c.tri([7, 11], [8, 2], [14, 8], "F")
      c.tri([23, 11], [22, 2], [16, 8], "F")
      c.next()
      c.ell(15, 22, 6.2, 6.2, "o")
      c.ell(7, 20, 3, 6.6, "j")
      c.ell(23, 20, 3, 6.6, "j")
      c.next()
      c.ell(11, 12, 4.6, 4.6, "e")
      c.ell(19, 12, 4.6, 4.6, "e")
      c.rect(12, 9, 18, 15, "e")
      c.tri([13.5, 14], [17.5, 14], [15.5, 19], "O")
      c.next()
      c.rect(9, 10, 11, 14, "k")
      c.rect(19, 10, 21, 14, "k")
      c.pts("w", [[10, 10], [10, 11], [20, 10], [20, 11]])
      for (let y = 20; y < 27; y += 2) for (let x = 11; x < 20; x += 3) c.put(x + (y % 4 ? 1 : 0), y, "F")
    },
  },
  duckling: {
    fur: "e",
    draw: (c) => {
      fowl(c, { fur: "e", belly: "e", wing: "E", beak: "O", beakLen: 3.4, beakFlat: true, foot: "O", size: 0.82, cx: 14, neck: 1.4, tail: 2 })
    },
  },
  blackduck: {
    fur: "y",
    draw: (c) => {
      fowl(c, { fur: "y", belly: "z", wing: "z", beak: "d", beakLen: 3.4, beakFlat: true, foot: "O", size: 0.82, cx: 14, neck: 1.4, tail: 2 })
      // a small white chin and a sheen on the wing
      c.pts("w", [[22, 15], [23, 16], [21, 16]])
      c.pts("S", [[11, 20], [12, 21], [14, 22]])
    },
  },
  gosling: {
    fur: "a",
    draw: (c) => {
      fowl(c, { fur: "a", belly: "l", wing: "A", beak: "O", beakLen: 3.4, foot: "O", size: 0.92, cx: 13, neck: 3, tail: 2.4 })
    },
  },
  chick: {
    fur: "O",
    draw: (c) => {
      fowl(c, { fur: "O", belly: "o", wing: "Q", beak: "Q", beakLen: 2.4, foot: "Q", size: 0.7, cx: 14, neck: 0.6, tail: 1.6 })
    },
  },
  crow: {
    fur: "y",
    draw: (c) => {
      fowl(c, { fur: "y", belly: "z", wing: "z", beak: "d", beakLen: 5.2, foot: "d", size: 0.98, cx: 14, neck: 1.6, tail: 4.6 })
      c.pts("S", [[9, 20], [11, 21], [13, 22], [8, 22]])
    },
  },
}

function possum(c: Canvas, coat: string, face: string, ear: string) {
  quad(c, {
    fur: coat, belly: face === "w" ? "e" : "l", far: "A", sock: "p", size: 0.9, cx: 17, body: [6.8, 4.6], leg: [3.6, 2.6], head: [4.2, 3.8], snout: [4.6, 2.4, face], ear: { kind: "round", size: 3.4, inner: "p", ch: ear },
    tail: { kind: "curl", size: 5.4, ch: "p" }, nose: "P",
    mark: (c2, g) => {
      c2.ell(g.hx, g.hy + 1, g.hrx * 0.9, g.hry * 0.85, face)
      c2.pts("p", [[g.snoutX + 6, g.snoutY - 1], [g.snoutX + 6, g.snoutY]])
      c2.pts("A", [[g.bx - 2, g.by - 3], [g.bx + 1, g.by - 2], [g.bx - 4, g.by - 1], [g.bx + 3, g.by - 3]])
      c2.eye(g.hx + g.hrx * 0.3, g.hy - g.hry * 0.3, 1)
    },
  })
}


// ─── front views ───────────────────────────────────────────────────────────

/**
 * A drawing surface that maps a small authoring grid onto the 32×32 canvas at a scale, standing on the ground line: how a front
 * view is drawn at the size the animal really is next to the others. Shapes scale smoothly; single marks (eyes, whiskers,
 * blush) keep their pixel size and just move.
 */
class Front {
  constructor(
    public b: Canvas,
    private k: number,
    private srcCx = 11.5,
    private srcBase = 22.5,
  ) {}

  private X = (x: number) => 15.5 + (x - this.srcCx) * this.k
  private Y = (y: number) => G - (this.srcBase - y) * this.k
  private mx = (x: number) => 31 - x

  next() {
    this.b.next()
  }

  ell(cx: number, cy: number, rx: number, ry: number, ch: string, mirror = false) {
    this.b.ell(this.X(cx), this.Y(cy), rx * this.k, ry * this.k, ch)
    if (mirror) this.b.ell(this.mx(this.X(cx)), this.Y(cy), rx * this.k, ry * this.k, ch)
  }

  tri(a: [number, number], b: [number, number], c: [number, number], ch: string, mirror = false) {
    const m = (p: [number, number]): [number, number] => [this.X(p[0]), this.Y(p[1])]
    this.b.tri(m(a), m(b), m(c), ch)
    if (mirror) {
      const r = (p: [number, number]): [number, number] => [this.mx(p[0]), p[1]]
      this.b.tri(r(m(a)), r(m(b)), r(m(c)), ch)
    }
  }

  rect(x0: number, y0: number, x1: number, y1: number, ch: string, mirror = false) {
    this.b.rect(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), ch)
    if (mirror) this.b.rect(this.mx(this.X(x1)), this.Y(y0), this.mx(this.X(x0)), this.Y(y1), ch)
  }

  pts(ch: string, list: Array<[number, number]>, mirror = false) {
    for (const [x, y] of list) {
      this.b.put(this.X(x), this.Y(y), ch)
      if (mirror) this.b.put(this.mx(this.X(x)), this.Y(y), ch)
    }
  }

  sym(x: number, y: number, ch: string) {
    this.pts(ch, [[x, y]], true)
  }

  put(x: number, y: number, ch: string) {
    this.pts(ch, [[x, y]])
  }

  line(a: [number, number], b: [number, number], ch: string, w = 1) {
    this.b.line([this.X(a[0]), this.Y(a[1])], [this.X(b[0]), this.Y(b[1])], ch, Math.max(1, Math.round(w * this.k)))
  }

  /** Two front-facing 2×3 eyes, mirrored, with a glint on the top left of each. */
  eyes(ex: number, ey: number, iris = "k") {
    const y = Math.round(this.Y(ey))
    for (const x0 of [Math.round(this.X(ex)), Math.round(this.mx(this.X(ex))) - 1]) {
      this.b.put(x0, y, "w")
      this.b.put(x0 + 1, y, "k")
      this.b.put(x0, y + 1, iris)
      this.b.put(x0 + 1, y + 1, "k")
      this.b.put(x0, y + 2, "k")
      this.b.put(x0 + 1, y + 2, "k")
    }
  }

  /** A side-view eye, for the player's scaled side drawing. */
  eye(x: number, y: number, size = 1) {
    this.b.eye(Math.round(this.X(x)), Math.round(this.Y(y)), size)
  }
}

type FrontSpecies = { body: (c: Front) => void; face: (c: Front) => void; fur?: string }

/** Two front paws and little toes under a seated body. */
function feet(c: Front, ch: string, toe = "p", y = 20) {
  c.ell(7.5, y + 1, 3, 1.9, ch)
  c.ell(15.5, y + 1, 3, 1.9, ch)
  c.pts(toe, [[6, y + 2], [8, y + 2]], false)
  c.pts(toe, [[15, y + 2], [17, y + 2]], false)
}

const blush = (c: Front, x: number, y: number) => c.pts("p", [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]], true)

/** A seated chibi: body, then head, in the given fur. */
function sitting(c: Front, ch: string, opts: { head?: [number, number, number]; body?: [number, number, number] } = {}) {
  const [hy, hrx, hry] = opts.head ?? [10.5, 8, 6.4]
  const [by, brx, bry] = opts.body ?? [17.4, 6, 4.8]
  c.ell(11.5, by, brx, bry, ch)
  c.next()
  c.ell(11.5, hy, hrx, hry, ch)
}

const FRONT: Record<string, FrontSpecies> = {
  bunny: {
    fur: "e",
    body(c) {
      c.ell(18.5, 18.5, 2.4, 2.4, "e")
      c.next()
      c.ell(8, 5.4, 2.5, 5, "e", true)
      c.next()
      c.ell(8, 5.8, 1.2, 3.8, "p", true)
      c.next()
      sitting(c, "e", { head: [13, 7.6, 5.8], body: [18.6, 5.8, 4] })
      c.next()
      feet(c, "e")
    },
    face(c) {
      c.eyes(6, 11)
      blush(c, 4, 14)
      c.pts("P", [[11, 14], [12, 14]])
      c.pts("p", [[11, 15], [12, 15]])
      c.pts("E", [[10, 16], [13, 16]])
      c.pts("E", [[9, 19], [14, 19]])
    },
  },
  kitten: {
    fur: "a",
    body(c) {
      c.pts("a", [[18, 21], [19, 21], [20, 20], [21, 19], [21, 18], [21, 17], [20, 16], [19, 16]])
      c.pts("A", [[21, 18], [21, 17], [20, 20]])
      c.next()
      c.tri([3, 11], [4, 2], [10, 7], "a", true)
      c.next()
      c.tri([4, 9], [5, 4], [8, 7], "p", true)
      c.next()
      sitting(c, "a", { head: [11.5, 8.4, 6.2], body: [18, 5.6, 4.2] })
      c.next()
      feet(c, "e")
    },
    face(c) {
      c.pts("A", [[11, 6], [12, 6], [11, 7], [12, 7], [9, 6], [14, 6], [10, 8], [13, 8]])
      c.pts("A", [[3, 11], [4, 11], [3, 13], [4, 13]], true)
      c.eyes(5, 10, "G")
      c.ell(11.5, 14.6, 3.2, 2, "e")
      c.pts("P", [[11, 13], [12, 13]])
      c.pts("k", [[10, 15], [13, 15], [11, 16], [12, 16]])
      c.pts("w", [[1, 14], [22, 14]])
      c.pts("e", [[8, 20], [15, 20], [12, 19]])
      c.pts("A", [[9, 18], [14, 18], [9, 20]])
    },
  },
  puppy: {
    fur: "f",
    body(c) {
      c.pts("f", [[19, 19], [20, 18], [21, 17], [21, 16], [20, 15]])
      c.next()
      sitting(c, "f", { head: [10.5, 7.4, 6.2], body: [17.6, 5.6, 4.6] })
      c.next()
      c.ell(11.5, 20.5, 3.2, 1.9, "o")
      c.next()
      c.ell(4.2, 11.5, 2.8, 5.4, "F", true)
      c.next()
      feet(c, "f", "F")
    },
    face(c) {
      c.ell(11.5, 13.6, 4.4, 3, "o")
      c.eyes(7, 8)
      c.pts("p", [[7, 6], [16, 6]])
      c.rect(10, 12, 13, 13, "k")
      c.pts("w", [[10, 12]])
      c.pts("E", [[11, 14], [12, 14]])
      c.pts("k", [[10, 15], [13, 15], [9, 14], [14, 14]])
      c.pts("P", [[11, 16], [12, 16], [11, 17], [12, 17]])
      c.pts("o", [[9, 20], [14, 20]])
    },
  },
  cub: {
    fur: "F",
    body(c) {
      c.ell(11.5, 17.6, 6.4, 4.8, "F")
      c.next()
      c.ell(4.4, 4.8, 3.2, 3.2, "F", true)
      c.next()
      c.ell(4.4, 5, 1.6, 1.6, "f", true)
      c.next()
      c.ell(11.5, 10.8, 8.2, 6.6, "F")
      c.next()
      c.ell(11.5, 19, 3.8, 2.6, "f")
      c.next()
      feet(c, "F", "j")
    },
    face(c) {
      c.ell(11.5, 13.8, 4.2, 3.2, "o")
      c.eyes(6, 8)
      c.pts("k", [[10, 12], [11, 12], [12, 12], [13, 12], [11, 13], [12, 13]])
      c.pts("w", [[10, 12]])
      c.pts("k", [[10, 14], [13, 14], [11, 15], [12, 15]])
      blush(c, 3, 12)
    },
  },
  fox: {
    fur: "O",
    body(c) {
      c.ell(20.4, 17.2, 2.8, 3.6, "O")
      c.next()
      c.ell(21, 19.4, 1.8, 1.8, "e")
      c.next()
      c.tri([3, 10], [4, 1], [10, 6], "O", true)
      c.next()
      c.tri([4, 8], [5, 3], [8, 6], "z", true)
      c.next()
      sitting(c, "O", { head: [11, 8.2, 6], body: [17.8, 5.4, 4.4] })
      c.next()
      c.ell(11.5, 20, 3, 2.4, "e")
      c.next()
      feet(c, "O", "z")
    },
    face(c) {
      c.tri([2, 12], [9, 10], [10, 15], "e", true)
      c.tri([4, 14], [9, 13], [10, 17], "e", true)
      c.ell(11.5, 15, 3.6, 2.8, "e")
      c.eyes(6, 9)
      c.pts("k", [[11, 13], [12, 13], [11, 14], [12, 14]])
      c.pts("w", [[11, 13]])
      c.pts("k", [[10, 15], [13, 15], [11, 16], [12, 16]])
      c.pts("O", [[11, 8], [12, 8], [11, 7], [12, 7]])
      blush(c, 4, 12)
    },
  },
  wolf: {
    fur: "a",
    body(c) {
      c.ell(20.6, 17, 2.6, 3.8, "a")
      c.next()
      c.ell(20.6, 19.4, 1.6, 1.6, "e")
      c.next()
      c.tri([3, 10], [4, 1], [10, 6], "A", true)
      c.next()
      c.tri([4, 8], [5, 3], [8, 6], "p", true)
      c.next()
      sitting(c, "a", { head: [11, 8.4, 6.2], body: [17.8, 5.6, 4.4] })
      c.next()
      c.ell(11.5, 20, 3.4, 2.4, "e")
      c.next()
      feet(c, "a", "A")
    },
    face(c) {
      c.pts("A", [[11, 5], [12, 5], [11, 6], [12, 6], [10, 7], [13, 7], [8, 6], [15, 6]])
      c.tri([2, 12], [9, 11], [10, 16], "e", true)
      c.ell(11.5, 15, 3.6, 2.8, "e")
      c.eyes(5, 9, "z")
      c.pts("k", [[10, 13], [11, 13], [12, 13], [13, 13], [11, 14], [12, 14]])
      c.pts("k", [[10, 16], [13, 16], [11, 17], [12, 17]])
    },
  },
  hedgehog: {
    fur: "o",
    body(c) {
      c.ell(11.5, 11.6, 10.6, 9.4, "j")
      c.next()
      c.ell(11.5, 13, 9.4, 7.6, "F")
      c.next()
      c.ell(11.5, 17.2, 6, 4.6, "o")
      c.next()
      c.ell(11.5, 16, 5.4, 4, "o")
      c.next()
      c.ell(4.8, 12.4, 1.8, 2, "o", true)
      c.next()
      feet(c, "o", "P")
    },
    face(c) {
      // spikes: light and dark flecks over the dome, jagged along its rim (raw 32×32 cells, so scale does not matter)
      const b = c.b
      for (let y = 1; y < 31; y++) {
        for (let x = 1; x < 31; x++) {
          const ch = b.at(x, y)
          if (ch !== "F" && ch !== "j") continue
          const r = flake(x, y, 9)
          if (r < 0.3) b.put(x, y, "t")
          else if (r < 0.5) b.put(x, y, "u")
        }
      }
      for (let x = 3; x < 29; x += 2) {
        const top = [...Array(30).keys()].find((y) => b.at(x, y + 1) !== ".")
        if (top !== undefined && top >= 1) b.put(x, top, flake(x, 1, 3) < 0.5 ? "u" : "t")
      }
      c.ell(11.5, 14.4, 6, 4.6, "o")
      c.eyes(7, 11)
      c.pts("k", [[11, 15], [12, 15], [11, 16], [12, 16]])
      c.pts("w", [[11, 15]])
      c.pts("k", [[10, 17], [13, 17], [11, 18], [12, 18]])
      blush(c, 5, 15)
    },
  },
  mouse: {
    fur: "a",
    body(c) {
      c.pts("P", [[19, 20], [20, 20], [21, 19], [21, 18], [21, 17], [21, 16], [20, 15], [19, 15], [19, 14]])
      c.pts("p", [[19, 20], [21, 17]])
      c.next()
      c.ell(5.6, 6, 3.8, 3.8, "a", true)
      c.next()
      c.ell(5.6, 6.2, 2.4, 2.4, "p", true)
      c.next()
      sitting(c, "a", { head: [11.6, 7.8, 6.2], body: [18, 5.8, 4.4] })
      c.next()
      c.ell(11.5, 18.8, 3.4, 3.4, "e")
      c.next()
      feet(c, "a", "p")
    },
    face(c) {
      c.eyes(6, 10)
      c.ell(11.5, 14.6, 3, 2.2, "e")
      c.pts("P", [[11, 13], [12, 13]])
      c.pts("p", [[11, 14], [12, 14]])
      c.pts("k", [[10, 16], [13, 16]])
      c.pts("w", [[2, 14], [3, 15], [21, 14], [20, 15]])
      blush(c, 4, 13)
    },
  },
  otter: {
    fur: "F",
    body(c) {
      c.pts("F", [[17, 21], [18, 21], [19, 21], [20, 20], [21, 19], [21, 18]])
      c.pts("F", [[18, 20], [19, 20], [20, 19], [20, 18]])
      c.next()
      c.ell(11.5, 17.6, 6, 5, "F")
      c.next()
      c.ell(11.5, 18.2, 4.2, 3.8, "f")
      c.next()
      c.ell(5.4, 5.8, 2, 2, "F", true)
      c.next()
      c.ell(11.5, 10.6, 7.6, 6.2, "F")
      c.next()
      c.ell(11.5, 13.8, 5, 4, "e")
      c.next()
      feet(c, "F", "j")
    },
    face(c) {
      c.eyes(6, 8)
      c.pts("k", [[10, 12], [11, 12], [12, 12], [13, 12], [11, 13], [12, 13]])
      c.pts("w", [[10, 12]])
      c.pts("k", [[10, 15], [13, 15], [11, 16], [12, 16]])
      c.pts("E", [[7, 14], [8, 15], [15, 15], [16, 14]])
      c.pts("w", [[3, 13], [20, 13], [3, 14], [20, 14]])
      blush(c, 4, 12)
    },
  },
  seal: {
    fur: "e",
    body(c) {
      c.ell(11.5, 15.4, 10, 7, "e")
      c.next()
      c.ell(11.5, 19, 7.4, 3.4, "l")
      c.next()
      c.ell(3.6, 17, 2.4, 3.6, "a", true)
      c.next()
      c.ell(11.5, 11, 7.6, 6, "e")
      c.next()
      c.ell(11.5, 20.6, 5, 1.6, "a")
    },
    face(c) {
      c.eyes(6, 9)
      c.pts("p", [[7, 8], [16, 8]])
      c.ell(11.5, 14, 3.2, 2.4, "l")
      c.pts("k", [[10, 13], [11, 13], [12, 13], [13, 13], [11, 14], [12, 14]])
      c.pts("k", [[10, 16], [13, 16], [11, 17], [12, 17]])
      c.pts("w", [[10, 13]])
      c.pts("a", [[5, 14], [4, 15], [18, 14], [19, 15], [5, 16], [18, 16]])
      blush(c, 4, 13)
    },
  },
  penguin: {
    fur: "z",
    body(c) {
      c.ell(3.4, 15.5, 2.4, 4.6, "z", true)
      c.next()
      c.ell(11.5, 15.4, 6.6, 6.6, "z")
      c.next()
      c.ell(11.5, 16.4, 4.8, 5.6, "l")
      c.next()
      c.ell(11.5, 8.6, 6.8, 6.2, "z")
      c.next()
      c.ell(7.8, 10, 3.2, 3.2, "l")
      c.ell(15.2, 10, 3.2, 3.2, "l")
      c.rect(9, 8, 14, 12, "l")
      c.next()
      c.ell(8, 21.4, 2.4, 1.2, "O")
      c.ell(15, 21.4, 2.4, 1.2, "O")
    },
    face(c) {
      c.eyes(7, 8)
      c.tri([9, 12], [14, 12], [11.5, 15.4], "O")
      c.pts("Q", [[10, 13], [13, 13], [11, 14], [12, 14]])
      c.pts("w", [[10, 12]])
      blush(c, 5, 11)
      c.pts("A", [[9, 19], [14, 19], [11, 20], [12, 20]])
    },
  },
  fawn: {
    fur: "f",
    body(c) {
      c.ell(19.8, 17.6, 1.8, 2.2, "f")
      c.next()
      c.tri([1, 9], [2, 3], [8, 8], "f", true)
      c.next()
      c.tri([2, 8], [3, 5], [6, 8], "p", true)
      c.next()
      sitting(c, "f", { head: [10.6, 6.6, 6.2], body: [17.8, 5.8, 4.6] })
      c.next()
      c.ell(11.5, 19.2, 3.6, 3, "e")
      c.next()
      feet(c, "f", "j")
    },
    face(c) {
      c.ell(11.5, 14.4, 3.6, 2.6, "e")
      c.eyes(6, 8)
      c.pts("k", [[10, 13], [11, 13], [12, 13], [13, 13]])
      c.pts("w", [[10, 13]])
      c.pts("k", [[10, 15], [13, 15], [11, 16], [12, 16]])
      c.pts("w", [[9, 4], [14, 4], [11, 3], [12, 5], [7, 5], [16, 5], [8, 19], [15, 18], [11, 19], [12, 17], [6, 17], [17, 20]])
      blush(c, 4, 11)
    },
  },
  foal: {
    fur: "F",
    body(c) {
      c.pts("j", [[19, 15], [20, 16], [20, 17], [20, 18], [19, 19], [19, 20]])
      c.next()
      c.tri([4, 8], [5, 1], [9, 5], "F", true)
      c.next()
      c.tri([5, 7], [6, 3], [8, 5], "p", true)
      c.next()
      sitting(c, "F", { head: [10.4, 6.6, 7.2], body: [18, 5.8, 4.4] })
      c.next()
      c.ell(11.5, 15.8, 4.2, 4.4, "f")
      c.next()
      feet(c, "F", "e")
    },
    face(c) {
      c.rect(10, 3, 13, 6, "j")
      c.pts("j", [[8, 5], [15, 5], [9, 4], [14, 4], [10, 2], [13, 2], [9, 6], [14, 6]])
      c.rect(11, 7, 12, 14, "e")
      c.eyes(6, 9)
      c.ell(11.5, 16, 3.8, 2.4, "o")
      c.pts("k", [[10, 15], [13, 15]])
      c.pts("k", [[10, 17], [13, 17]])
      blush(c, 4, 12)
    },
  },
  capybara: {
    fur: "f",
    body(c) {
      c.ell(11.5, 16.8, 8.4, 5.6, "f")
      c.next()
      c.ell(4.4, 5.4, 2.2, 2.2, "F", true)
      c.next()
      c.ell(11.5, 10.4, 8.2, 6, "f")
      c.next()
      c.ell(11.5, 20.2, 7, 1.8, "F")
      c.next()
      feet(c, "f", "j")
    },
    face(c) {
      c.ell(11.5, 14.2, 5.6, 3.4, "F")
      c.eyes(5, 7)
      c.pts("j", [[9, 13], [10, 13], [13, 13], [14, 13]])
      c.pts("j", [[10, 16], [13, 16], [11, 17], [12, 17]])
      c.pts("F", [[8, 4], [9, 4], [13, 4], [14, 4], [10, 3], [11, 3], [12, 3]])
      blush(c, 3, 10)
    },
  },
  skunk: {
    fur: "z",
    body(c) {
      c.ell(19.6, 12.6, 3.4, 8, "z")
      c.next()
      c.rect(19, 5, 20, 13, "w")
      c.pts("l", [[18, 8], [21, 9], [18, 11], [21, 12]])
      c.next()
      c.ell(5, 6.2, 2.2, 2.4, "z", true)
      c.next()
      sitting(c, "z", { head: [11.2, 7.8, 6.2], body: [17.8, 5.6, 4.6] })
      c.next()
      c.rect(11, 2, 12, 22, "w")
      c.rect(10, 12, 13, 19, "z")
      c.rect(11, 2, 12, 11, "w")
      c.next()
      feet(c, "z", "P")
    },
    face(c) {
      c.rect(11, 3, 12, 9, "w")
      c.pts("w", [[10, 4], [13, 4], [10, 5], [13, 5]])
      c.eyes(6, 9, "z")
      c.ell(11.5, 14, 2.8, 2.2, "A")
      c.pts("P", [[11, 13], [12, 13], [11, 14], [12, 14]])
      c.pts("p", [[11, 15], [12, 15]])
      c.pts("w", [[4, 3], [19, 3]])
      blush(c, 4, 12)
      c.rect(11, 17, 12, 20, "w")
    },
  },
  crow: {
    fur: "z",
    body(c) {
      c.tri([8, 19], [15, 19], [11.5, 23], "z")
      c.pts("d", [[10, 21], [13, 21]])
      c.next()
      c.ell(11.5, 15.4, 7.2, 5.6, "z")
      c.next()
      c.ell(4.6, 15, 2.4, 4.6, "z", true)
      c.next()
      c.ell(11.5, 8.8, 7.2, 6, "z")
      c.next()
      c.pts("d", [[9, 21], [14, 21], [9, 22], [14, 22]])
    },
    face(c) {
      c.pts("S", [[8, 4], [9, 3], [10, 3], [13, 3], [14, 3], [15, 4]])
      c.rect(5, 7, 7, 9, "l", true)
      c.pts("k", [[6, 8], [6, 9]], true)
      c.pts("w", [[5, 7]], true)
      c.tri([9.5, 11], [13.5, 11], [11.5, 15.4], "s")
      c.pts("w", [[10, 11], [11, 11]])
      c.pts("S", [[12, 12], [13, 12], [12, 13]])
      c.pts("d", [[11, 14], [12, 14], [11, 15]])
      c.pts("S", [[6, 14], [8, 12], [10, 17], [13, 17], [15, 12], [17, 14]])
      c.pts("S", [[4, 12], [3, 15], [19, 12], [20, 15]])
    },
  },
  owl: {
    fur: "F",
    body(c) {
      c.ell(11.5, 13.6, 9.2, 9, "F")
      c.next()
      c.tri([3, 9], [4, 1], [10, 5], "F", true)
      c.next()
      c.ell(11.5, 17, 6, 5.2, "o")
      c.next()
      c.ell(4.6, 14, 2.6, 5.8, "j", true)
      c.next()
      c.pts("O", [[8, 21], [9, 21], [10, 21], [13, 21], [14, 21], [15, 21]])
    },
    face(c) {
      c.ell(7.6, 9.8, 4.2, 4.2, "e")
      c.ell(15.4, 9.8, 4.2, 4.2, "e")
      c.rect(9, 8, 14, 13, "e")
      c.eyes(6, 8)
      c.rect(6, 8, 6, 8, "w")
      c.pts("k", [[7, 10], [16, 10]])
      c.tri([10.5, 12], [13.5, 12], [12, 16], "O")
      for (let y = 15; y < 21; y += 2) for (let x = 7; x < 17; x += 3) c.put(x + (y % 4 ? 1 : 0), y, "F")
      blush(c, 3, 12)
    },
  },
  duckling: {
    fur: "e",
    body(c) {
      c.ell(11.5, 16.6, 8, 5.6, "e")
      c.pts("e", [[19, 12], [20, 11], [21, 12]])
      c.next()
      c.ell(7, 17.8, 3.6, 3.4, "E")
      c.next()
      c.ell(11.5, 9.4, 7.2, 6.4, "e")
      c.next()
      c.ell(8, 21.2, 2.4, 1.2, "O")
      c.ell(15, 21.2, 2.4, 1.2, "O")
    },
    face(c) {
      c.eyes(6, 8)
      c.ell(11.5, 13.2, 4.4, 2.2, "O")
      c.pts("o", [[9, 12], [10, 12], [11, 12], [12, 12], [13, 12], [14, 12]])
      c.pts("Q", [[10, 13], [13, 13]])
      c.pts("Q", [[10, 15], [11, 15], [12, 15], [13, 15]])
      blush(c, 3, 11)
      c.pts("E", [[9, 18], [10, 19], [11, 19]])
    },
  },
  gosling: {
    fur: "a",
    body(c) {
      c.ell(11.5, 17, 7.8, 5, "a")
      c.pts("a", [[19, 14], [20, 13], [21, 14]])
      c.next()
      c.ell(11.5, 18.4, 5.2, 3.6, "l")
      c.next()
      c.ell(5.2, 16.6, 2.6, 3.6, "A", true)
      c.next()
      c.ell(11.5, 9.2, 7, 6.4, "a")
      c.next()
      c.ell(11.5, 11.4, 5, 3.8, "e")
      c.next()
      c.ell(8, 21.2, 2.4, 1.2, "O")
      c.ell(15, 21.2, 2.4, 1.2, "O")
    },
    face(c) {
      c.eyes(6, 7)
      c.ell(11.5, 12.4, 3.2, 1.8, "O")
      c.pts("o", [[10, 11], [11, 11], [12, 11], [13, 11]])
      c.pts("Q", [[10, 13], [13, 13]])
      blush(c, 4, 11)
      c.pts("A", [[9, 15], [14, 15]])
      c.pts("l", [[9, 19], [14, 19], [11, 18]])
    },
  },
  chick: {
    fur: "O",
    body(c) {
      c.ell(11.5, 15, 8.6, 6.8, "O")
      c.next()
      c.ell(11.5, 17.6, 5.6, 4, "o")
      c.next()
      c.ell(4.8, 14, 2.4, 4, "Q", true)
      c.next()
      c.ell(11.5, 10, 7.6, 6.6, "O")
      c.next()
      c.pts("Q", [[11, 1], [12, 1], [10, 2], [13, 2], [11, 3], [12, 3]])
      c.pts("O", [[11, 2], [12, 2]])
      c.next()
      c.ell(8, 21.2, 2.4, 1.2, "Q")
      c.ell(15, 21.2, 2.4, 1.2, "Q")
    },
    face(c) {
      c.eyes(6, 8)
      c.tri([10, 11.4], [13, 11.4], [11.5, 14.4], "R")
      c.pts("Q", [[11, 12], [12, 12]])
      blush(c, 3, 11)
      c.pts("p", [[9, 16], [14, 16]])
    },
  },
  blackduck: {
    fur: "y",
    body(c) {
      c.ell(11.5, 16.6, 8, 5.6, "y")
      c.next()
      c.ell(7, 17.8, 3.6, 3.4, "z")
      c.next()
      c.ell(11.5, 9.4, 7.2, 6.4, "y")
      c.next()
      c.ell(8, 21.2, 2.4, 1.2, "O")
      c.ell(15, 21.2, 2.4, 1.2, "O")
    },
    face(c) {
      c.rect(5, 7, 8, 11, "l", true)
      c.eyes(6, 8)
      c.ell(11.5, 13.2, 4.4, 2.2, "d")
      c.pts("S", [[9, 12], [10, 12], [11, 12], [12, 12], [13, 12], [14, 12]])
      c.pts("k", [[10, 13], [13, 13]])
      c.pts("w", [[10, 17], [11, 18], [12, 18], [13, 17]])
      c.pts("S", [[6, 17], [7, 18], [9, 19]])
    },
  },
  possum: { fur: "a", body: (c) => possumBody(c, "a", "l", "z"), face: (c) => possumFace(c, "l", "A") },
  possum2: { fur: "A", body: (c) => possumBody(c, "A", "e", "y"), face: (c) => possumFace(c, "e", "z") },
  possum3: { fur: "e", body: (c) => possumBody(c, "e", "w", "A"), face: (c) => possumFace(c, "w", "a") },
  raccoon: {
    fur: "a",
    body(c) {
      c.ell(19.6, 14, 3.2, 6.4, "a")
      c.pts("z", [[19, 10], [20, 10], [19, 13], [20, 13], [19, 16], [20, 16]])
      c.next()
      c.ell(5, 5.6, 2.4, 2.4, "a", true)
      c.next()
      sitting(c, "a", { head: [10.6, 7.6, 6], body: [17.6, 5.6, 4.6] })
      c.next()
      feet(c, "A", "z")
    },
    face(c) {
      c.rect(4, 9, 19, 11, "z")
      c.pts("z", [[5, 12], [18, 12], [4, 8], [19, 8]])
      c.eyes(6, 9)
      c.ell(11.5, 14, 3, 2.4, "e")
      c.pts("k", [[11, 13], [12, 13]])
      c.pts("p", [[11, 15], [12, 15]])
      c.pts("z", [[5, 5], [18, 5]])
      c.pts("e", [[10, 3], [13, 3]])
    },
  },
  lamb: {
    fur: "e",
    body(c) {
      c.ell(11.5, 17.6, 6.4, 5, "e")
      c.next()
      c.ell(4.2, 10.4, 2.8, 1.5, "z", true)
      c.next()
      c.ell(11.5, 9, 7, 5.6, "e")
      c.pts("E", [[7, 4], [10, 3], [13, 3], [16, 4], [6, 7], [17, 7]])
      c.next()
      c.ell(11.5, 11.4, 4.6, 4.2, "z")
      c.next()
      feet(c, "z", "z")
    },
    face(c) {
      c.eyes(7, 10, "w")
      c.pts("P", [[11, 14], [12, 14]])
      c.pts("p", [[11, 16], [12, 16]])
      c.pts("e", [[10, 4], [13, 4], [11, 3], [12, 3]])
      blush(c, 5, 13)
    },
  },
  goat: {
    fur: "f",
    body(c) {
      c.pts("f", [[19, 19], [20, 18]])
      c.next()
      c.ell(3.8, 8.4, 3, 1.4, "f", true)
      c.next()
      c.pts("E", [[7, 3], [8, 2], [15, 3], [14, 2]])
      c.next()
      sitting(c, "f", { head: [10.4, 6.6, 6], body: [17.6, 5.6, 4.6] })
      c.next()
      c.ell(11.5, 20.5, 3.4, 2, "e")
      c.next()
      feet(c, "j", "j")
    },
    face(c) {
      c.ell(11.5, 14, 3.4, 2.8, "e")
      c.eyes(6, 9, "y")
      c.pts("k", [[11, 12], [12, 12], [10, 14], [13, 14]])
      c.pts("e", [[11, 18], [12, 18], [11, 19], [12, 19]])
      c.pts("o", [[3, 9], [20, 9]])
    },
  },
  piglet: {
    fur: "p",
    body(c) {
      c.pts("P", [[18, 19], [19, 18], [19, 17], [18, 16]])
      c.next()
      c.ell(4, 6.6, 2.8, 3.4, "P", true)
      c.next()
      sitting(c, "p", { head: [10.8, 7.6, 6.2], body: [17.6, 5.8, 4.8] })
      c.next()
      c.ell(11.5, 14, 3.8, 3, "P")
      c.next()
      feet(c, "P", "k")
    },
    face(c) {
      c.eyes(6, 9)
      c.pts("k", [[10, 13], [13, 13], [10, 14], [13, 14]])
      c.pts("o", [[4, 12], [19, 12]])
      blush(c, 4, 12)
    },
  },
  shipcat: {
    fur: "z",
    body(c) {
      c.pts("z", [[18, 21], [19, 21], [20, 20], [21, 19], [21, 18], [21, 17], [20, 16], [19, 16]])
      c.next()
      c.tri([3, 11], [4, 2], [10, 7], "z", true)
      c.next()
      c.tri([4, 9], [5, 4], [8, 7], "p", true)
      c.next()
      sitting(c, "z", { head: [11.5, 8.4, 6.2], body: [18, 5.6, 4.2] })
      c.next()
      c.ell(11.5, 18.6, 3, 3.4, "e")
      c.next()
      feet(c, "e")
    },
    face(c) {
      c.eyes(5, 10, "G")
      c.ell(11.5, 14.6, 3.2, 2, "e")
      c.pts("P", [[11, 13], [12, 13]])
      c.pts("k", [[10, 15], [13, 15], [11, 16], [12, 16]])
      c.pts("w", [[1, 14], [22, 14]])
    },
  },
}

function possumBody(c: Front, coat: string, face: string, ear: string) {
  // a long bare tail curling up behind, then the body, the round ears, the head, and the white face narrowing to a pink nose
  c.line([17, 20], [20, 19], "p", 2)
  c.line([20, 19], [21, 15], "p", 2)
  c.line([21, 15], [19.6, 12.6], "p", 2)
  c.next()
  c.ell(11.5, 17.6, 6, 4.8, coat)
  c.next()
  c.ell(11.5, 18.6, 3.8, 3.4, face)
  c.next()
  c.ell(5.4, 6.4, 3.6, 3.6, ear, true)
  c.next()
  c.ell(5.4, 6.6, 2.1, 2.1, "p", true)
  c.next()
  c.ell(11.5, 10.2, 6.6, 5.4, coat)
  c.next()
  c.tri([6.6, 10], [16.4, 10], [11.5, 20], face)
  c.next()
  feet(c, coat, "p")
}

function possumFace(c: Front, face: string, patch: string) {
  c.ell(7.2, 9.4, 2.4, 2.8, patch)
  c.ell(15.8, 9.4, 2.4, 2.8, patch)
  c.eyes(6, 8)
  c.pts("P", [[11, 18], [12, 18], [11, 19], [12, 19]])
  c.pts("p", [[11, 17], [12, 17]])
  c.pts("k", [[10, 16], [13, 16]])
  c.pts(face, [[8, 13], [15, 13]])
  c.pts("w", [[2, 14], [3, 15], [21, 14], [20, 15]])
}


/** How big each baby is, front on, next to the others: a scale on the 24-unit authoring grid. */
const FRONT_SIZE: Record<string, number> = {
  capybara: 1.22, foal: 1.2, fawn: 1.1, wolf: 1.1, cub: 1.02, otter: 0.96, seal: 1.0, fox: 0.92, puppy: 0.92, penguin: 0.92,
  owl: 0.86, skunk: 0.82, kitten: 0.8, bunny: 0.82, crow: 0.82, possum: 0.78, possum2: 0.78, possum3: 0.74, hedgehog: 0.72,
  gosling: 0.74, blackduck: 0.64, duckling: 0.66, mouse: 0.58, chick: 0.54,
  raccoon: 0.84, lamb: 0.8, goat: 0.86, piglet: 0.78, shipcat: 0.8,
}

export const GAME_SPECIES = Object.keys(SPECIES)


const grids = new Map<string, string[]>()

export type SpriteView = "front" | "side" | "back"

/**
 * The letter grid for an animal, seen front on (idle, walking toward you), from the side (walking across), or from behind (walking away).
 * A friend snapped from a liked ComfyUI generation (`gen-sprites.ts`) wins over the hand drawing; `handGrid` still has that.
 */
export function spriteGrid(id: string, view: SpriteView = "front"): string[] {
  return GEN_GRIDS[id]?.[view] ?? handGrid(id, view)
}

/** The hand-drawn grid, made by the builders below. */
export function handGrid(id: string, view: SpriteView = "front"): string[] {
  if (id === "hyrax") return HYRAX_GRIDS[view]
  const key = `${id}:${view}`
  const hit = grids.get(key)
  if (hit) return hit
  const c = new Canvas()
  if (view === "side") {
    const spec = SPECIES[id]
    if (spec) {
      spec.draw(c)
      trim(c)
      shade(c)
      fur(c, spec.fur ?? "")
      trim(c)
      outline(c)
    }
  } else {
    const spec = FRONT[id]
    if (spec) {
      const f = new Front(c, FRONT_SIZE[id] ?? 0.8)
      spec.body(f)
      trim(c)
      shade(c)
      fur(c, spec.fur ?? "")
      c.next()
      if (view === "front") spec.face(f)
      else backOfHead(c, f, spec)
      trim(c)
      outline(c)
    }
  }
  const rows = c.cells.map((row) => row.map((cell) => cell.ch).join(""))
  grids.set(key, rows)
  return rows
}

/**
 * The back of a head is the front body with no face: the head ellipse stays plain fur, the pink inside the ears turns to fur, and
 * a small darker whorl and a tuft of rump fur sit where the face would be. Birds and others whose "fur" is feathers get the same.
 */
function backOfHead(c: Canvas, f: Front, _spec: FrontSpecies) {
  const count = new Map<string, number>()
  for (const row of c.cells) for (const cell of row) if (!".kpPw".includes(cell.ch)) count.set(cell.ch, (count.get(cell.ch) ?? 0) + 1)
  const ch = [...count.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? "a"
  // inner ears and cheeks were pink from the front; from behind they are the coat
  for (const row of c.cells) for (const cell of row) if (cell.ch === "p" || cell.ch === "P") cell.ch = ch
  const deep = SHADE[ch]?.[1] ?? ch
  f.pts(deep, [[11, 8], [12, 8], [11, 7]])
  f.pts(deep, [[10, 19], [11, 19], [12, 19], [13, 19]])
}

/**
 * The Center of The World: a girl drawn by the person drawer (`people/draw.ts`) from one `PersonSpec`, in the manner of a
 * village-sim farmer: big round head, auburn tails and a pink bow, a cream and pink shirt, blue overalls, brown boots. She
 * is the only inhabitant of her own universe. Front on, from the side when she walks across, from behind when she walks away.
 */
export function playerGrid(view: SpriteView = "front"): string[] {
  return playerGridOf(view)
}

/** Paint a letter grid onto a 2D context. `cell` is the pixel size of one sprite pixel. */
export function paintGrid(ctx: CanvasRenderingContext2D, grid: readonly string[], x: number, y: number, cell = 1) {
  for (let row = 0; row < grid.length; row++) {
    const line = grid[row]!
    for (let col = 0; col < line.length; col++) {
      const color = SPRITE_PALETTE[line[col]!]
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(x + col * cell, y + row * cell, cell, cell)
    }
  }
}
