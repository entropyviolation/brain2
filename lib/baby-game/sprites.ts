/**
 * lib/baby-game/sprites.ts — Twenty baby animals as 16×16 pixel sprites
 *
 * Each species is two small drawing functions on a symmetric 16×16 canvas: `body` lays down the silhouette in
 * layers, then `shade` lights the top-left rim and darkens every bottom rim (a head over a body gets a chin
 * shadow), then `face` paints eyes, cheeks, and markings, and last `outline` wraps the whole figure in warm plum.
 * That pipeline keeps all twenty in one hand: same light, same outline, same eyes with a glint.
 * The palette extends `PIXEL_PALETTE`. No yellow, no gold: chicks are apricot, ducklings are cream.
 * The twenty were drawn at random from the 25-species roster in `lib/baby-animals.ts`
 * (left out: piglet, raccoon, axolotl, lamb, goat).
 */

import { PIXEL_PALETTE } from "@/components/friend-details/PixelIcon"

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
}

/** [light, dark] for a paint letter. Letters not listed stay flat. */
const SHADE: Record<string, [string, string]> = {
  O: ["o", "Q"],
  e: ["w", "E"],
  o: ["w", "E"],
  a: ["l", "A"],
  z: ["A", "k"],
  t: ["o", "T"],
  T: ["t", "u"],
  l: ["w", "s"],
  s: ["w", "S"],
  p: ["w", "P"],
  b: ["w", "B"],
  B: ["b", "n"],
  G: ["g", "h"],
  u: ["T", "k"],
}

export const SPRITE_SIZE = 16

type Cell = { ch: string; layer: number }

class Canvas {
  cells: Cell[][] = Array.from({ length: SPRITE_SIZE }, () => Array.from({ length: SPRITE_SIZE }, () => ({ ch: ".", layer: 0 })))
  layer = 1

  next() {
    this.layer += 1
  }

  put(x: number, y: number, ch: string) {
    if (x < 0 || y < 0 || x >= SPRITE_SIZE || y >= SPRITE_SIZE) return
    this.cells[y]![x] = { ch, layer: this.layer }
  }

  sym(x: number, y: number, ch: string) {
    this.put(x, y, ch)
    this.put(SPRITE_SIZE - 1 - x, y, ch)
  }

  pts(ch: string, list: Array<[number, number]>, mirror = false) {
    for (const [x, y] of list) mirror ? this.sym(x, y, ch) : this.put(x, y, ch)
  }

  rect(x0: number, y0: number, x1: number, y1: number, ch: string) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.put(x, y, ch)
  }

  ell(cx: number, cy: number, rx: number, ry: number, ch: string, mirror = false) {
    for (let y = 0; y < SPRITE_SIZE; y++) {
      for (let x = 0; x < SPRITE_SIZE; x++) {
        const dx = (x - cx) / rx
        const dy = (y - cy) / ry
        if (dx * dx + dy * dy <= 1) this.put(x, y, ch)
        if (mirror) {
          const mx = (SPRITE_SIZE - 1 - x - cx) / rx
          if (mx * mx + dy * dy <= 1) this.put(x, y, ch)
        }
      }
    }
  }

  /** Two 2×2 eyes, glint at the top-left of each. `iris` colors the other three pixels. */
  eyes(ex: number, ey: number, iris = "k") {
    const left = SPRITE_SIZE - 2 - ex
    for (const x0 of [ex, left]) {
      this.put(x0, ey, "w")
      this.put(x0 + 1, ey, iris)
      this.put(x0, ey + 1, iris)
      this.put(x0 + 1, ey + 1, iris)
    }
  }

  each(fn: (x: number, y: number, ch: string) => string | null) {
    for (let y = 0; y < SPRITE_SIZE; y++) {
      for (let x = 0; x < SPRITE_SIZE; x++) {
        const out = fn(x, y, this.cells[y]![x]!.ch)
        if (out) this.cells[y]![x] = { ch: out, layer: this.layer }
      }
    }
  }
}

const empty = (cell: Cell | undefined) => !cell || cell.ch === "."

function shade(c: Canvas) {
  const next = c.cells.map((row) => row.map((cell) => ({ ...cell })))
  for (let y = 0; y < SPRITE_SIZE; y++) {
    for (let x = 0; x < SPRITE_SIZE; x++) {
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

/** Keep a 1px margin for the outline: whatever reaches the top or bottom row is cut off. */
function trim(c: Canvas) {
  for (const y of [0, SPRITE_SIZE - 1]) c.cells[y] = Array.from({ length: SPRITE_SIZE }, () => ({ ch: ".", layer: 0 }))
}

function outline(c: Canvas) {
  const next = c.cells.map((row) => row.map((cell) => ({ ...cell })))
  for (let y = 0; y < SPRITE_SIZE; y++) {
    for (let x = 0; x < SPRITE_SIZE; x++) {
      if (!empty(c.cells[y]![x])) continue
      const near = [c.cells[y - 1]?.[x], c.cells[y + 1]?.[x], c.cells[y]?.[x - 1], c.cells[y]?.[x + 1]]
      if (near.some((cell) => !empty(cell))) next[y]![x]!.ch = "k"
    }
  }
  c.cells = next
}

type Species = { body: (c: Canvas) => void; face: (c: Canvas) => void }

/** Cheeks: two blush pixels under each eye. */
const blush = (c: Canvas, x: number, y: number) => c.pts("p", [[x, y], [x + 1, y]], true)

const SPECIES: Record<string, Species> = {
  bunny: {
    body(c) {
      c.ell(7.5, 12.6, 4.6, 2.6, "e")
      c.next()
      c.ell(4.6, 3.4, 1.6, 3.2, "e", true)
      c.next()
      c.ell(4.6, 3.8, 0.8, 2.2, "p", true)
      c.next()
      c.ell(7.5, 8.4, 5.9, 4.2, "e")
    },
    face(c) {
      c.eyes(3, 7)
      blush(c, 2, 9)
      c.sym(7, 9, "P")
      c.pts("w", [[7, 10], [8, 10]])
      c.pts("e", [[6, 13], [9, 13]])
    },
  },
  kitten: {
    body(c) {
      c.pts("a", [[13, 13], [14, 12], [14, 11], [14, 10], [13, 9]])
      c.next()
      c.ell(7.5, 12.6, 4.4, 2.5, "a")
      c.next()
      c.pts("a", [[3, 1], [2, 2], [3, 2], [4, 2], [2, 3], [3, 3], [4, 3], [5, 3]], true)
      c.next()
      c.ell(7.5, 7.6, 6, 4.5, "a")
    },
    face(c) {
      c.pts("z", [[13, 9], [14, 10]])
      c.pts("p", [[3, 2], [3, 3]], true)
      c.pts("z", [[7, 3], [8, 3], [7, 4], [8, 4], [5, 3], [10, 3]])
      c.pts("z", [[2, 8], [2, 10]], true)
      c.eyes(4, 6)
      c.ell(7.5, 9.6, 2.4, 1.4, "e")
      c.sym(7, 9, "P")
      c.pts("z", [[7, 10], [8, 10]])
    },
  },
  puppy: {
    body(c) {
      c.pts("T", [[13, 12], [14, 11], [14, 10]])
      c.next()
      c.ell(7.5, 12.6, 4.4, 2.5, "o")
      c.next()
      c.ell(7.5, 7.6, 5.8, 4.5, "o")
      c.next()
      c.ell(2.4, 7.4, 1.7, 3, "T", true)
    },
    face(c) {
      c.eyes(4, 6)
      c.pts("T", [[3, 5], [4, 5], [3, 6], [4, 4]])
      c.ell(7.5, 9.8, 3, 1.9, "e")
      c.sym(7, 9, "z")
      c.pts("P", [[8, 11]])
      c.pts("e", [[6, 13], [9, 13]])
    },
  },
  cub: {
    body(c) {
      c.ell(7.5, 12.6, 4.6, 2.5, "T")
      c.next()
      c.ell(3.4, 3.2, 2, 2, "T", true)
      c.next()
      c.ell(7.5, 7.7, 6, 4.6, "T")
    },
    face(c) {
      c.ell(3.4, 3.3, 0.9, 0.9, "o", true)
      c.ell(7.5, 13, 2.6, 1.5, "o")
      c.eyes(4, 6)
      c.ell(7.5, 9.8, 2.8, 1.9, "o")
      c.sym(7, 9, "z")
      c.pts("z", [[7, 10], [8, 10]])
    },
  },
  fox: {
    body(c) {
      c.ell(12.8, 11.4, 2, 3.2, "O")
      c.next()
      c.ell(7.5, 12.6, 4.2, 2.5, "O")
      c.next()
      c.pts("O", [[3, 1], [3, 2], [4, 2], [2, 3], [3, 3], [4, 3], [5, 3], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4]], true)
      c.next()
      c.ell(7.5, 7.8, 6, 4.2, "O")
    },
    face(c) {
      c.pts("e", [[13, 13], [14, 13], [13, 14], [14, 12]])
      c.pts("z", [[3, 1], [3, 2]], true)
      c.pts("Q", [[4, 3], [4, 4]], true)
      c.ell(7.5, 13.2, 2, 1.4, "e")
      c.ell(4.2, 10, 2.6, 1.5, "e", true)
      c.ell(7.5, 10, 2.4, 1.7, "e")
      c.eyes(4, 6)
      c.sym(7, 9, "z")
    },
  },
  wolf: {
    body(c) {
      c.ell(7.5, 12.6, 4.6, 2.5, "a")
      c.next()
      c.pts("a", [[3, 1], [3, 2], [4, 2], [2, 3], [3, 3], [4, 3], [5, 3], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4]], true)
      c.next()
      c.ell(7.5, 7.8, 6, 4.4, "a")
      c.next()
      c.pts("a", [[1, 10], [1, 11], [2, 12]], true)
    },
    face(c) {
      c.pts("A", [[3, 2], [4, 3], [4, 4]], true)
      c.pts("A", [[7, 3], [8, 3], [7, 4], [8, 4]])
      c.ell(7.5, 10, 2.8, 2, "l")
      c.eyes(4, 6, "n")
      c.sym(7, 9, "z")
      c.pts("l", [[3, 10], [2, 11]], true)
    },
  },
  hedgehog: {
    body(c) {
      c.pts("T", [[4, 2], [6, 1], [7, 1], [8, 1], [9, 1], [11, 2], [2, 4], [13, 4], [1, 7], [14, 7]])
      c.ell(7.5, 8.2, 6.4, 5.8, "T")
      c.next()
      c.ell(7.5, 11, 3.9, 3, "o")
      c.next()
      c.ell(4.6, 8.4, 1, 1, "o", true)
    },
    face(c) {
      c.each((x, y, ch) => {
        if (y < 9 && "Tt".includes(ch)) {
          if ((x + y) % 4 === 0) return "u"
          if ((x + y) % 4 === 2) return "t"
        }
        return null
      })
      c.eyes(5, 9)
      blush(c, 4, 11)
      c.sym(7, 11, "k")
    },
  },
  mouse: {
    body(c) {
      c.pts("p", [[13, 13], [14, 13], [14, 12], [14, 11], [14, 10]])
      c.next()
      c.ell(7.5, 12.6, 4.2, 2.5, "a")
      c.next()
      c.ell(3.6, 3.8, 2.5, 2.5, "a", true)
      c.next()
      c.ell(3.6, 4, 1.4, 1.4, "p", true)
      c.next()
      c.ell(7.5, 8.2, 5.4, 4.2, "a")
    },
    face(c) {
      c.ell(7.5, 13.2, 2.4, 1.3, "e")
      c.eyes(4, 7)
      blush(c, 3, 9)
      c.sym(7, 9, "P")
      c.pts("w", [[7, 10], [8, 10]])
    },
  },
  otter: {
    body(c) {
      c.pts("u", [[13, 13], [14, 12], [14, 11]])
      c.next()
      c.ell(7.5, 12.4, 4.8, 2.7, "u")
      c.next()
      c.ell(3.2, 4.5, 1.1, 1.1, "u", true)
      c.next()
      c.ell(7.5, 7.9, 5.6, 4.3, "u")
    },
    face(c) {
      c.ell(7.5, 12.8, 3, 1.8, "e")
      c.ell(7.5, 10, 3.4, 2.2, "e")
      c.eyes(4, 6)
      c.sym(7, 9, "z")
      c.pts("k", [[6, 11], [9, 11]])
      c.pts("e", [[2, 10], [13, 10]])
    },
  },
  seal: {
    body(c) {
      c.ell(7.5, 12, 5.6, 2.8, "s")
      c.next()
      c.ell(2.4, 12.8, 1.6, 1.2, "S", true)
      c.next()
      c.ell(7.5, 7.8, 5.8, 4.5, "s")
    },
    face(c) {
      c.pts("S", [[4, 3], [10, 4], [3, 12], [11, 12], [7, 14]])
      c.ell(7.5, 10.2, 3.2, 1.9, "w")
      c.eyes(4, 6)
      blush(c, 2, 9)
      c.sym(7, 9, "z")
      c.pts("S", [[5, 10], [10, 10], [4, 11], [11, 11]])
    },
  },
  penguin: {
    body(c) {
      c.ell(2.5, 10.8, 1.3, 2.4, "A", true)
      c.next()
      c.ell(7.5, 10.8, 5, 3.8, "a")
      c.next()
      c.ell(7.5, 11.8, 3.2, 2.8, "w")
      c.next()
      c.ell(7.5, 6, 4.8, 3.8, "a")
    },
    face(c) {
      c.ell(7.5, 7, 3.6, 2.6, "w")
      c.eyes(5, 5)
      c.pts("O", [[7, 8], [8, 8]])
      c.pts("Q", [[7, 9], [8, 9]])
      blush(c, 4, 7)
      c.pts("O", [[4, 14], [5, 14], [6, 14]], true)
    },
  },
  fawn: {
    body(c) {
      c.ell(7.5, 12.4, 4.6, 2.7, "t")
      c.next()
      c.ell(2.6, 4.6, 1.9, 1.4, "t", true)
      c.next()
      c.ell(7.5, 8, 5.6, 4.4, "t")
    },
    face(c) {
      c.ell(2.6, 4.7, 1, 0.6, "p", true)
      c.pts("T", [[5, 2]], true)
      c.pts("e", [[4, 3], [6, 2], [9, 4], [11, 3], [4, 12], [10, 13], [6, 14]])
      c.ell(7.5, 13, 2.2, 1.3, "e")
      c.ell(7.5, 10.6, 2.4, 1.6, "e")
      c.eyes(4, 6)
      c.sym(7, 9, "z")
    },
  },
  foal: {
    body(c) {
      c.ell(7.5, 12.8, 4.4, 2.3, "t")
      c.next()
      c.pts("t", [[4, 1], [4, 2], [5, 2], [4, 3], [5, 3], [6, 3]], true)
      c.next()
      c.ell(7.5, 7.4, 4.8, 5.2, "t")
    },
    face(c) {
      c.pts("u", [[7, 2], [8, 2], [6, 3], [7, 3], [8, 3], [9, 3], [5, 4], [10, 4]])
      c.pts("p", [[4, 2]], true)
      c.pts("e", [[7, 5], [8, 5], [7, 6], [8, 6], [7, 7], [8, 7]])
      c.ell(7.5, 10.8, 3, 1.8, "o")
      c.eyes(4, 6)
      c.pts("u", [[6, 11], [9, 11]])
      blush(c, 3, 9)
    },
  },
  capybara: {
    body(c) {
      c.ell(7.5, 12.4, 5.6, 2.8, "T")
      c.next()
      c.ell(3.4, 4.6, 1, 0.9, "T", true)
      c.next()
      c.ell(7.5, 8.4, 6, 4.4, "T")
      c.next()
      c.ell(7.5, 2.7, 1.9, 1.5, "O")
    },
    face(c) {
      c.pts("G", [[9, 1], [10, 1], [10, 2]])
      c.ell(7.5, 10.4, 3.8, 2.4, "t")
      c.pts("k", [[3, 7], [4, 7]], true)
      blush(c, 2, 8)
      c.pts("u", [[6, 9], [9, 9]])
      c.pts("k", [[7, 11], [8, 11]])
    },
  },
  skunk: {
    body(c) {
      c.ell(12.4, 9.4, 2.2, 4, "z")
      c.next()
      c.ell(7.5, 12.4, 4.4, 2.6, "z")
      c.next()
      c.ell(4.2, 3.6, 1.4, 1.4, "z", true)
      c.next()
      c.ell(7.5, 7.8, 5.4, 4.4, "z")
    },
    face(c) {
      c.pts("e", [[13, 6], [13, 7], [12, 8], [13, 9], [13, 10]])
      c.ell(4.2, 3.7, 0.7, 0.7, "p", true)
      c.pts("e", [[7, 2], [8, 2], [7, 3], [8, 3], [7, 4], [8, 4], [7, 5], [8, 5], [7, 11], [8, 11], [7, 12], [8, 12], [7, 13], [8, 13]])
      c.eyes(3, 6, "B")
      blush(c, 2, 9)
      c.ell(7.5, 9.6, 1.6, 1.1, "a")
      c.sym(7, 9, "P")
    },
  },
  crow: {
    body(c) {
      c.ell(7.5, 12.2, 4.8, 2.9, "z")
      c.next()
      c.ell(2.6, 12, 1.5, 2.6, "z", true)
      c.next()
      c.ell(7.5, 7.6, 5.6, 4.6, "z")
      c.next()
      c.pts("z", [[7, 1], [8, 1], [6, 2], [9, 2]])
    },
    face(c) {
      c.eyes(3, 5, "b")
      c.pts("o", [[6, 8], [7, 8], [8, 8], [9, 8]])
      c.pts("O", [[6, 9], [7, 9], [8, 9], [9, 9]])
      c.pts("Q", [[7, 10], [8, 10]])
      c.pts("A", [[7, 13], [8, 13], [4, 12], [11, 12]])
    },
  },
  owl: {
    body(c) {
      c.ell(2.8, 11.6, 1.6, 2.6, "u", true)
      c.next()
      c.ell(7.5, 11.8, 5, 3.6, "T")
      c.next()
      c.pts("T", [[2, 1], [3, 1], [2, 2], [3, 2], [4, 2], [3, 3]], true)
      c.next()
      c.ell(7.5, 7.2, 6, 4.6, "T")
      c.next()
      c.ell(7.5, 7.8, 5.2, 3.6, "o")
    },
    face(c) {
      c.ell(7.5, 12.6, 3, 2, "o")
      c.pts("T", [[6, 12], [9, 13], [7, 14]])
      c.ell(4.7, 7, 2, 2, "e", true)
      c.eyes(4, 6)
      c.pts("O", [[7, 9], [8, 9]])
      c.pts("Q", [[7, 10], [8, 10]])
    },
  },
  duckling: {
    body(c) {
      c.ell(7.5, 11.8, 5, 2.6, "e")
      c.next()
      c.ell(2.6, 12, 1.4, 2, "E", true)
      c.next()
      c.ell(7.5, 7.4, 5.2, 4.4, "e")
      c.next()
      c.pts("e", [[7, 1], [8, 1], [7, 2], [8, 2], [6, 2], [9, 2]])
    },
    face(c) {
      c.eyes(3, 6)
      c.pts("o", [[5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9]])
      c.pts("O", [[6, 10], [7, 10], [8, 10], [9, 10]])
      blush(c, 2, 8)
      c.rect(4, 12, 11, 12, "C")
      c.pts("m", [[5, 13], [6, 13]])
      c.pts("O", [[4, 14], [5, 14]], true)
    },
  },
  gosling: {
    body(c) {
      c.ell(7.5, 11.6, 5.2, 3.6, "a")
      c.next()
      c.ell(2.8, 11.2, 1.4, 2.4, "A", true)
      c.next()
      c.ell(7.5, 5.6, 4.2, 3.6, "a")
      c.next()
      c.sym(7, 1, "a")
    },
    face(c) {
      c.ell(7.5, 12.6, 3.2, 2, "l")
      c.eyes(4, 4)
      c.pts("O", [[6, 7], [7, 7], [8, 7], [9, 7], [7, 8], [8, 8]])
      blush(c, 3, 6)
      c.pts("O", [[4, 14], [5, 14]], true)
    },
  },
  chick: {
    body(c) {
      c.ell(7.5, 8.8, 6, 5.2, "o")
      c.next()
      c.ell(2.4, 10.2, 1.3, 2, "O", true)
      c.next()
      c.ell(7.5, 3.6, 4.8, 2.6, "e")
    },
    face(c) {
      c.pts("e", [[3, 5], [5, 5], [7, 5], [9, 5], [11, 5]])
      c.pts("E", [[4, 4], [6, 4], [8, 4], [10, 4]])
      c.eyes(4, 7)
      blush(c, 2, 10)
      c.pts("O", [[7, 10], [8, 10]])
      c.pts("Q", [[7, 11], [8, 11]])
      c.pts("O", [[5, 14], [10, 14]])
    },
  },
}

export const GAME_SPECIES = Object.keys(SPECIES)

/** The 16×16 letter grid for a species. Cached. */
const grids = new Map<string, string[]>()

export function spriteGrid(id: string): string[] {
  const hit = grids.get(id)
  if (hit) return hit
  const spec = SPECIES[id]
  const c = new Canvas()
  if (spec) {
    spec.body(c)
    trim(c)
    shade(c)
    c.next()
    spec.face(c)
    trim(c)
    outline(c)
  }
  const rows = c.cells.map((row) => row.map((cell) => cell.ch).join(""))
  grids.set(id, rows)
  return rows
}

/** The Nestkeeper: the human the player is. */
export function playerGrid(): string[] {
  const cached = grids.get("__player")
  if (cached) return cached
  const c = new Canvas()
  c.ell(7.5, 12.6, 3.6, 2.4, "B")
  c.next()
  c.ell(7.5, 8.4, 4.2, 3.4, "o")
  c.next()
  c.ell(7.5, 4.6, 4.8, 2.6, "T")
  c.rect(3, 4, 4, 7, "T")
  c.rect(11, 4, 12, 7, "T")
  shade(c)
  c.next()
  c.sym(5, 8, "k")
  c.pts("p", [[4, 10]], true)
  c.pts("P", [[7, 10], [8, 10]])
  c.rect(5, 11, 10, 11, "R")
  c.pts("R", [[9, 12], [9, 13]])
  c.pts("V", [[7, 3], [8, 3]])
  trim(c)
  outline(c)
  const rows = c.cells.map((row) => row.map((cell) => cell.ch).join(""))
  grids.set("__player", rows)
  return rows
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
