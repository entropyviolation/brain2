/**
 * lib/baby-game/snap.mjs — Pixel Snapper: a liked ComfyUI image into a 32×32 game grid
 *
 * A generation is a 768² picture of one animal (or a turnaround sheet of several views) on a plain background. The
 * game draws letter grids on the `SPRITE_PALETTE`. Snapping is four pure steps on raw RGBA:
 *
 * 1. `figureMask`: flood the background in from the border (the outline stops it, so white fur stays).
 * 2. `parts`: the figures left, as 8-connected blobs in reading order, so a sheet's views can be picked by number.
 * 3. `snapPart`: one blob down to `height` rows. Every source pixel becomes its nearest palette letter, each cell
 *    takes the letter most of its pixels chose (dark cells win once a third of the cell is dark, so eyes stay), and cells under
 *    half covered are dropped.
 * 4. `place`: a fresh 1px outline in `k`, then onto a 32×32 grid, centered, feet on row 29, mirrored to face right.
 *
 * Plain `.mjs` so `scripts/baby-gen-sprites.mjs` (Node with sharp) and the tests share it.
 */

export const GRID = 32
export const FOOT = 29

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

/** Redmean distance: cheap and close enough to how eyes weigh red, green and blue. */
function dist2(a, b) {
  const rm = (a[0] + b[0]) / 2
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db
}

/**
 * The background as everything border-connected within `tol` of the border's most common color. 1 = figure. With
 * `shadow`, the flood also eats light greys (a ground shadow under the feet); leave it off for white or grey animals.
 */
export function figureMask(rgba, w, h, tol = 60, { shadow = false } = {}) {
  const counts = new Map()
  const px = (i) => [rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]]
  const border = []
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x)
  for (let y = 0; y < h; y++) border.push(y * w, y * w + w - 1)
  for (const i of border) {
    const [r, g, b] = px(i)
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
  const bg = [((top >> 10) & 31) * 8 + 4, ((top >> 5) & 31) * 8 + 4, (top & 31) * 8 + 4]
  const lim = tol * tol * 3
  const mask = new Uint8Array(w * h).fill(1)
  const stack = []
  const isBg = (c) => dist2(c, bg) < lim || (shadow && Math.max(...c) - Math.min(...c) < 20 && c[0] + c[1] + c[2] > 420)
  for (const i of border) if (isBg(px(i))) stack.push(i)
  while (stack.length) {
    const i = stack.pop()
    if (!mask[i]) continue
    if (!isBg(px(i))) continue
    mask[i] = 0
    const x = i % w
    const y = (i / w) | 0
    if (x > 0) stack.push(i - 1)
    if (x < w - 1) stack.push(i + 1)
    if (y > 0) stack.push(i - w)
    if (y < h - 1) stack.push(i + w)
  }
  return mask
}

/** The figures as `{ id, x0, y0, x1, y1, area }`, biggest-first filtered to `minArea`, then in reading order. */
export function parts(mask, w, h, minArea = Math.round(w * h * 0.002)) {
  const label = new Int32Array(w * h).fill(-1)
  const out = []
  for (let s = 0; s < w * h; s++) {
    if (!mask[s] || label[s] >= 0) continue
    const id = out.length
    const box = { id, x0: w, y0: h, x1: -1, y1: -1, area: 0 }
    const stack = [s]
    label[s] = id
    while (stack.length) {
      const i = stack.pop()
      const x = i % w
      const y = (i / w) | 0
      box.area++
      if (x < box.x0) box.x0 = x
      if (x > box.x1) box.x1 = x
      if (y < box.y0) box.y0 = y
      if (y > box.y1) box.y1 = y
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const j = ny * w + nx
          if (mask[j] && label[j] < 0) {
            label[j] = id
            stack.push(j)
          }
        }
      }
    }
    out.push(box)
  }
  const big = out.filter((b) => b.area >= minArea)
  // reading order: rows of figures whose vertical centers are within a quarter of the tallest figure
  const tall = Math.max(1, ...big.map((b) => b.y1 - b.y0))
  const cy = (b) => (b.y0 + b.y1) / 2
  big.sort((a, b) => (Math.abs(cy(a) - cy(b)) < tall / 2 ? a.x0 - b.x0 : cy(a) - cy(b)))
  return big.map((b, i) => ({ ...b, index: i, label }))
}

/**
 * One figure down to `height` rows of palette letters ("." empty). `palette` is letter → "#rrggbb"; `dark` letters
 * (the outline and near blacks) take a cell once `darkShare` of it chose them: low enough that a one-cell eye survives,
 * high enough that anti-aliased edges do not.
 */
export function snapPart(rgba, w, part, palette, height, { dark = "kyz", darkShare = 0.35, cover = 0.5, skip = "" } = {}) {
  const letters = Object.keys(palette).filter((k) => !skip.includes(k))
  const rgb = letters.map((k) => hex(palette[k]))
  const memo = new Map()
  const nearest = (r, g, b) => {
    const key = (r << 16) | (g << 8) | b
    let hit = memo.get(key)
    if (hit !== undefined) return hit
    let best = 0
    let bd = Infinity
    for (let i = 0; i < rgb.length; i++) {
      const d = dist2([r, g, b], rgb[i])
      if (d < bd) {
        bd = d
        best = i
      }
    }
    memo.set(key, best)
    return best
  }
  const bw = part.x1 - part.x0 + 1
  const bh = part.y1 - part.y0 + 1
  const scale = bh / height
  const width = Math.max(1, Math.round(bw / scale))
  const rows = []
  for (let gy = 0; gy < height; gy++) {
    let row = ""
    for (let gx = 0; gx < width; gx++) {
      const sx0 = part.x0 + Math.floor(gx * scale)
      const sy0 = part.y0 + Math.floor(gy * scale)
      const sx1 = Math.min(part.x1 + 1, part.x0 + Math.floor((gx + 1) * scale))
      const sy1 = Math.min(part.y1 + 1, part.y0 + Math.floor((gy + 1) * scale))
      const votes = new Map()
      let inside = 0
      let total = 0
      for (let y = sy0; y < sy1; y++) {
        for (let x = sx0; x < sx1; x++) {
          total++
          const i = y * w + x
          if (part.label[i] !== part.id) continue
          inside++
          const l = letters[nearest(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2])]
          votes.set(l, (votes.get(l) ?? 0) + 1)
        }
      }
      if (!total || inside / total < cover) {
        row += "."
        continue
      }
      const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1])
      const light = ranked.find(([l]) => !dark.includes(l))
      const darkVotes = ranked.filter(([l]) => dark.includes(l)).reduce((n, [, c]) => n + c, 0)
      row += darkVotes / inside > darkShare || !light ? ranked[0][0] : light[0]
    }
    rows.push(row)
  }
  return rows
}

/** Outline in `k`, mirror if asked, and center on a 32×32 grid with the bottom of the outline on row `FOOT`. */
export function place(rows, { flip = false } = {}) {
  let body = rows.map((r) => (flip ? [...r].reverse().join("") : r))
  // drop empty edges
  while (body.length && !/[^.]/.test(body[0])) body.shift()
  while (body.length && !/[^.]/.test(body[body.length - 1])) body.pop()
  const w0 = Math.max(...body.map((r) => r.length))
  let l = w0
  let r = -1
  for (const row of body) for (let x = 0; x < row.length; x++) if (row[x] !== ".") ((l = Math.min(l, x)), (r = Math.max(r, x)))
  body = body.map((row) => row.padEnd(w0, ".").slice(l, r + 1))
  const h = body.length + 2
  const w = body[0].length + 2
  const pad = [".".repeat(w), ...body.map((row) => `.${row}.`), ".".repeat(w)].map((row) => row.split(""))
  const lined = pad.map((row) => row.slice())
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (pad[y][x] !== ".") continue
      const near = [pad[y - 1]?.[x], pad[y + 1]?.[x], pad[y][x - 1], pad[y][x + 1]]
      if (near.some((c) => c && c !== ".")) lined[y][x] = "k"
    }
  }
  if (h > FOOT + 1 || w > GRID - 2) throw new Error(`figure ${w}×${h} does not fit a ${GRID}² grid with feet on row ${FOOT}`)
  const grid = Array.from({ length: GRID }, () => new Array(GRID).fill("."))
  const ox = Math.floor((GRID - w) / 2)
  const oy = FOOT - h + 1
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (lined[y][x] !== ".") grid[oy + y][ox + x] = lined[y][x]
  return grid.map((row) => row.join(""))
}

/**
 * A back view from a front one, for a sheet with no back: in the upper two thirds, eyes, beak and blush (dark,
 * orange and pink letters, but not the outline) become the coat's most common letter. Feet and the outline stay.
 */
export function faceless(grid, face = "kyzOQoPpqrR") {
  const cells = grid.map((r) => r.split(""))
  const count = new Map()
  for (const row of cells) for (const ch of row) if (ch !== "." && !face.includes(ch)) count.set(ch, (count.get(ch) ?? 0) + 1)
  const coat = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "a"
  const filled = cells.flatMap((row, y) => (row.some((c) => c !== ".") ? [y] : []))
  const top = filled[0] ?? 0
  const cut = top + Math.round(((filled[filled.length - 1] ?? 0) - top) * 0.66)
  const rim = (x, y) => [cells[y - 1]?.[x], cells[y + 1]?.[x], cells[y][x - 1], cells[y][x + 1]].some((c) => !c || c === "." || c === "k")
  const out = cells.map((row) => row.slice())
  for (let y = top; y <= cut; y++) {
    for (let x = 0; x < GRID; x++) {
      const ch = cells[y][x]
      if (face.includes(ch) && (ch !== "k" || !rim(x, y))) out[y][x] = coat
    }
  }
  return out.map((row) => row.join(""))
}
