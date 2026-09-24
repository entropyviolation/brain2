/**
 * Falling-sand close. A window is a grid of tiny grains. A ragged front
 * releases them from the title-bar × outward; loose grains drop and slide
 * like powder (the same rule as a powder-toy / sand cellular automaton)
 * and heap up, keeping the color of the pixel they came from.
 *
 * Opt in per window via `useWindowSandClose`. This file is the sim only.
 */

export const WINDOW_SAND_MS = 3600
/** How long the crumble takes to walk from the × to the far corner. */
export const WINDOW_SAND_FRONT_MS = 2400

export const SAND_EMPTY = 0
export const SAND_SOLID = 1
export const SAND_LOOSE = 2

export type WindowSandGeom = {
  left: number
  top: number
  width: number
  height: number
  originX: number
  originY: number
}

export type SandGrid = {
  cols: number
  rows: number
  /** Window rows; rows below this are the pile basin. */
  winRows: number
  grain: number
  state: Uint8Array
  color: Uint32Array
  spawnAt: Float32Array
}

type GridOpts = {
  grain?: number
  frontMs?: number
  extraRatio?: number
}

function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

function clampByte(n: number) {
  return n < 0 ? 0 : n > 255 ? 255 : n
}

function jitterColor(rgb: number, n: number) {
  const j = ((hash(n + 5) * 14) | 0) - 7
  const r = clampByte((rgb >> 16) + j)
  const g = clampByte(((rgb >> 8) & 255) + (((hash(n + 9) * 14) | 0) - 7))
  const b = clampByte((rgb & 255) + (((hash(n + 13) * 10) | 0) - 5))
  return (r << 16) | (g << 8) | b
}

function fallbackRgb(localY: number) {
  return localY < 26 ? 0x000080 : 0xc0c0c0
}

function sampleRgb(img: ImageData, dpr: number, x: number, y: number): number | null {
  const ix = Math.min(img.width - 1, Math.max(0, Math.floor(x * dpr)))
  const iy = Math.min(img.height - 1, Math.max(0, Math.floor(y * dpr)))
  const i = (iy * img.width + ix) * 4
  const a = img.data[i + 3] ?? 0
  if (a < 24) return null
  const r = img.data[i] ?? 0
  const g = img.data[i + 1] ?? 0
  const b = img.data[i + 2] ?? 0
  return (r << 16) | (g << 8) | b
}

export function createSandGrid(
  geom: WindowSandGeom,
  shot: ImageData | null,
  opts: GridOpts = {},
): SandGrid {
  const width = Math.max(1, geom.width)
  const height = Math.max(1, geom.height)
  let grain = opts.grain ?? 2
  while ((width / grain) * (height / grain) > 90000) grain += 1

  const cols = Math.max(1, Math.ceil(width / grain))
  const winRows = Math.max(1, Math.ceil(height / grain))
  const extra = Math.max(8, Math.ceil(winRows * (opts.extraRatio ?? 0.5)))
  const rows = winRows + extra
  const state = new Uint8Array(cols * rows)
  const color = new Uint32Array(cols * rows)
  const spawnAt = new Float32Array(cols * rows)
  spawnAt.fill(Number.POSITIVE_INFINITY)

  const dpr = shot ? shot.width / width : 1
  const ox = (geom.originX - geom.left) / grain
  const oy = (geom.originY - geom.top) / grain
  const maxDist = Math.hypot(cols, winRows) || 1
  const frontMs = opts.frontMs ?? WINDOW_SAND_FRONT_MS

  for (let y = 0; y < winRows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x
      const px = (x + 0.5) * grain
      const py = (y + 0.5) * grain
      const sampled = shot ? sampleRgb(shot, dpr, px, py) : fallbackRgb(py)
      if (sampled == null) continue
      state[i] = SAND_SOLID
      color[i] = jitterColor(sampled, i)
      const dist = Math.hypot(x + 0.5 - ox, y + 0.5 - oy)
      const ragged = 0.42 + hash(i) * 0.58
      spawnAt[i] = (dist / maxDist) * ragged * frontMs
    }
  }

  return { cols, rows, winRows, grain, state, color, spawnAt }
}

/** Turn solid grains whose crumble time has arrived into loose sand. */
export function releaseSand(grid: SandGrid, tMs: number) {
  const { state, spawnAt } = grid
  for (let i = 0; i < spawnAt.length; i++) {
    if (state[i] === SAND_SOLID && spawnAt[i] <= tMs) state[i] = SAND_LOOSE
  }
}

function moveGrain(grid: SandGrid, from: number, to: number) {
  grid.state[to] = SAND_LOOSE
  grid.color[to] = grid.color[from] ?? 0
  grid.state[from] = SAND_EMPTY
  grid.color[from] = 0
}

/**
 * One powder pass, bottom-up, so a grain can fall through air in a single
 * step and will slide into a lower neighbor instead of floating as a stack.
 */
export function stepSand(grid: SandGrid, leftToRight: boolean) {
  const { cols, rows, state } = grid
  for (let y = rows - 2; y >= 0; y--) {
    const x0 = leftToRight ? 0 : cols - 1
    const xEnd = leftToRight ? cols : -1
    const dir = leftToRight ? 1 : -1
    for (let x = x0; x !== xEnd; x += dir) {
      const i = y * cols + x
      if (state[i] !== SAND_LOOSE) continue
      const below = i + cols
      if (state[below] === SAND_EMPTY) {
        moveGrain(grid, i, below)
        continue
      }
      const slide = (hash(i + y * 13) > 0.5 ? 1 : -1)
      const a = x + slide
      const b = x - slide
      const ia = a >= 0 && a < cols ? below + (a - x) : -1
      const ib = b >= 0 && b < cols ? below + (b - x) : -1
      if (ia >= 0 && state[ia] === SAND_EMPTY) moveGrain(grid, i, ia)
      else if (ib >= 0 && state[ib] === SAND_EMPTY) moveGrain(grid, i, ib)
    }
  }
}

/** Recolor grains still sitting in the window once a pixel snapshot arrives. */
export function applySnapshotColors(grid: SandGrid, geom: WindowSandGeom, shot: ImageData) {
  const { cols, winRows, grain, state, color } = grid
  const dpr = geom.width > 0 ? shot.width / geom.width : 1
  for (let y = 0; y < winRows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x
      if (state[i] !== SAND_SOLID) continue
      const sampled = sampleRgb(shot, dpr, (x + 0.5) * grain, (y + 0.5) * grain)
      if (sampled != null) color[i] = jitterColor(sampled, i)
    }
  }
}

export function countState(grid: SandGrid, kind: number) {
  let n = 0
  for (let i = 0; i < grid.state.length; i++) if (grid.state[i] === kind) n++
  return n
}
