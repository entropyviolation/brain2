/**
 * Window → sand close. The pane is a field of pixel grains. A ragged front
 * lets them go from the title-bar ×; each grain is its own body (nothing
 * stays behind as a frame). Loose grains fall, bounce, and roll to a steep
 * dune in front of the window, keeping the color of the pixel they left.
 * After the dune rests, wind lifts it from the windward crest and carries
 * it off.
 *
 * Opt in per window via `useWindowSandClose`. This file is the sim and the
 * pixel painter. Loose grains are a single pixel — fine sand, not a 2px brick.
 * A few specks share each sampled pixel (its color, a slight jitter). The sim
 * stays one body per sample, inside MAX_GRAINS.
 */

export const WINDOW_SAND_FRONT_MS = 900
/** Earliest moment a hurried wind (Enter) may start. */
export const WINDOW_SAND_PILE_AT = 2000
/** When the wind starts on its own if nothing dismissed the dune. */
export const WINDOW_SAND_WIND_AT = 3100
export const WINDOW_SAND_WIND_MS = 1700
export const WINDOW_SAND_MS = WINDOW_SAND_WIND_AT + WINDOW_SAND_WIND_MS
/** How far grains travel rightward before they leave the canvas. */
export const SAND_WIND_RUN = 300

export const SAND_EMPTY = 0
export const SAND_SOLID = 1
export const SAND_LOOSE = 2
export const SAND_SETTLED = 3

const GRAVITY = 3200
const BANDS = 32
const MAX_GRAINS = 80000
/** Painted size of a loose grain. The sample cell stays coarser so the dune does not change. */
const GRAIN_PX = 1

export type WindowSandGeom = {
  left: number
  top: number
  width: number
  height: number
  originX: number
  originY: number
}

export type SandCanvasBox = {
  left: number
  top: number
  width: number
  height: number
  padX: number
  padTop: number
}

export type SandWorld = {
  n: number
  grain: number
  width: number
  height: number
  floorY: number
  windAt: number
  windArmed: number
  breakX: number
  breakY: number
  bin: number
  binsX: number
  binsZ: number
  originX: number
  originZ: number
  x: Float32Array
  y: Float32Array
  z: Float32Array
  vx: Float32Array
  vy: Float32Array
  vz: Float32Array
  homeX: Float32Array
  homeY: Float32Array
  tumble: Float32Array
  fade: Float32Array
  releaseAt: Float32Array
  blowAt: Float32Array
  state: Uint8Array
  rolls: Uint8Array
  color: Uint32Array
  pileN: Uint16Array
  mark: Uint8Array
  bandCount: Uint16Array
  bandFill: Uint32Array
  order: Uint32Array
}

type WorldOpts = {
  grain?: number
  frontMs?: number
  windAt?: number
}

export function sandCanvasBox(geom: WindowSandGeom): SandCanvasBox {
  const padX = Math.round(geom.width * 0.38 + 28)
  const padRight = Math.round(geom.width * 0.2 + SAND_WIND_RUN)
  const padTop = 140
  const padBottom = Math.round(geom.height * 0.2 + 56)
  return {
    left: geom.left - padX,
    top: geom.top - padTop,
    width: Math.round(geom.width + padX + padRight),
    height: Math.round(geom.height + padTop + padBottom),
    padX,
    padTop,
  }
}

function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

function clampByte(n: number) {
  return n < 0 ? 0 : n > 255 ? 255 : n
}

function jitterColor(rgb: number, n: number) {
  const j = ((hash(n + 5) * 10) | 0) - 5
  const r = clampByte((rgb >> 16) + j)
  const g = clampByte(((rgb >> 8) & 255) + (((hash(n + 9) * 10) | 0) - 5))
  const b = clampByte((rgb & 255) + (((hash(n + 13) * 8) | 0) - 4))
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

function colOf(world: SandWorld, x: number, z: number) {
  let ix = ((x - world.originX) / world.bin) | 0
  let iz = ((z - world.originZ) / world.bin) | 0
  if (ix < 0) ix = 0
  else if (ix >= world.binsX) ix = world.binsX - 1
  if (iz < 0) iz = 0
  else if (iz >= world.binsZ) iz = world.binsZ - 1
  return iz * world.binsX + ix
}

function surfaceY(world: SandWorld, col: number) {
  return world.floorY - world.pileN[col] * world.grain
}

function releaseGrain(world: SandWorld, i: number, wind: boolean) {
  const { x, y, z, vx, vy, vz, homeX, homeY, state } = world
  state[i] = SAND_LOOSE
  x[i] = homeX[i]
  y[i] = homeY[i]
  z[i] = 4 + (hash(i + 2) - 0.5) * 8
  if (wind) {
    vx[i] = 120 + hash(i + 4) * 160
    vy[i] = -(140 + hash(i + 5) * 180)
    vz[i] = (hash(i + 6) - 0.5) * 70
    return
  }
  const cx = world.width * 0.5
  const cy = world.height * 0.62
  const ox = world.homeX[i] + world.grain * 0.5
  const oy = world.homeY[i] + world.grain * 0.5
  const dx = ox - world.breakX
  const dy = oy - world.breakY
  const dist = Math.hypot(dx, dy) || 1
  vx[i] = (dx / dist) * 24 + (cx - world.homeX[i]) * 2.1 + (hash(i) - 0.5) * 16
  vy[i] = (cy - world.homeY[i]) * 0.06 + 20 + hash(i + 1) * 28
  vz[i] = (10 - z[i]) * 0.4 + (hash(i + 3) - 0.5) * 14
}

/** Hurry the wind. Relative blow order stays; the dune leaves from this instant. */
export function beginWind(world: SandWorld, tMs: number) {
  if (world.windArmed || tMs >= world.windAt) {
    world.windArmed = 1
    return
  }
  const shift = world.windAt - tMs
  world.windAt = tMs
  world.windArmed = 1
  const blowAt = world.blowAt
  for (let i = 0; i < world.n; i++) blowAt[i] -= shift
}

export function createSandWorld(
  geom: WindowSandGeom,
  shot: ImageData | null,
  opts: WorldOpts = {},
): SandWorld {
  const width = Math.max(1, geom.width)
  const height = Math.max(1, geom.height)
  // Sample cell. Loose grains paint at GRAIN_PX; one body per sample
  // keeps the dune, the wind, and the MAX_GRAINS ceiling.
  let grain = opts.grain ?? 2
  while ((width / grain) * (height / grain) > MAX_GRAINS) grain += 1

  const cols = Math.max(1, Math.ceil(width / grain))
  const winRows = Math.max(1, Math.ceil(height / grain))
  const max = cols * winRows
  const bin = Math.max(grain + 1, 3)
  const originX = -Math.round(width * 0.55)
  const originZ = -14
  const binsX = Math.max(1, Math.ceil((width - originX + width * 0.55) / bin))
  const binsZ = Math.max(1, Math.ceil((70 - originZ) / bin))
  const windAt = opts.windAt ?? WINDOW_SAND_WIND_AT
  const frontMs = opts.frontMs ?? WINDOW_SAND_FRONT_MS
  const ox = geom.originX - geom.left
  const oy = geom.originY - geom.top
  const maxDist = Math.hypot(width, height) || 1
  const dpr = shot ? shot.width / width : 1

  const world: SandWorld = {
    n: 0,
    grain,
    width,
    height,
    floorY: height,
    windAt,
    windArmed: 0,
    breakX: ox,
    breakY: oy,
    bin,
    binsX,
    binsZ,
    originX,
    originZ,
    x: new Float32Array(max),
    y: new Float32Array(max),
    z: new Float32Array(max),
    vx: new Float32Array(max),
    vy: new Float32Array(max),
    vz: new Float32Array(max),
    homeX: new Float32Array(max),
    homeY: new Float32Array(max),
    tumble: new Float32Array(max),
    fade: new Float32Array(max),
    releaseAt: new Float32Array(max),
    blowAt: new Float32Array(max),
    state: new Uint8Array(max),
    rolls: new Uint8Array(max),
    color: new Uint32Array(max),
    pileN: new Uint16Array(binsX * binsZ),
    mark: new Uint8Array(binsX * binsZ),
    bandCount: new Uint16Array(BANDS),
    bandFill: new Uint32Array(BANDS),
    order: new Uint32Array(max),
  }

  let n = 0
  for (let gy = 0; gy < winRows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const px = gx * grain
      const py = gy * grain
      const sampled = shot ? sampleRgb(shot, dpr, px + grain * 0.5, py + grain * 0.5) : fallbackRgb(py)
      if (sampled == null) continue
      const i = n++
      world.homeX[i] = px
      world.homeY[i] = py
      world.x[i] = px
      world.y[i] = py
      world.fade[i] = 1
      world.state[i] = SAND_SOLID
      world.color[i] = jitterColor(sampled, i)
      world.tumble[i] = hash(i + 11) * 4
      const dist = Math.hypot(px + grain * 0.5 - ox, py + grain * 0.5 - oy)
      const ragged = 0.22 + hash(i) * 0.78
      world.releaseAt[i] = (dist / maxDist) * ragged * frontMs
      world.blowAt[i] = windAt + (px / width) * 520 + hash(i + 8) * 180
    }
  }
  world.n = n
  return world
}

function neighborSteep(world: SandWorld, col: number, repose: number) {
  const { binsX, binsZ } = world
  const iz = (col / binsX) | 0
  const ix = col - iz * binsX
  const here = surfaceY(world, col)
  let best = -1
  let bestDrop = repose
  for (let dz = -1; dz <= 1; dz++) {
    const nz = iz + dz
    if (nz < 0 || nz >= binsZ) continue
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dz === 0) continue
      const nx = ix + dx
      if (nx < 0 || nx >= binsX) continue
      const nCol = nz * binsX + nx
      const drop = surfaceY(world, nCol) - here
      if (drop > bestDrop) {
        bestDrop = drop
        best = nCol
      }
    }
  }
  return best
}

function placeInColumn(world: SandWorld, i: number, col: number) {
  const { bin, binsX, originX, originZ } = world
  const iz = (col / binsX) | 0
  const ix = col - iz * binsX
  const jx = (hash(i + 3) - 0.5) * bin * 0.7
  const jz = (hash(i + 7) - 0.5) * bin * 0.7
  world.x[i] = originX + (ix + 0.5) * bin + jx
  world.z[i] = originZ + (iz + 0.5) * bin + jz
}

function settleGrain(world: SandWorld, i: number, col: number) {
  const y = surfaceY(world, col) - world.grain
  world.y[i] = y
  world.pileN[col]++
  world.state[i] = SAND_SETTLED
  world.rolls[i] = 0
  world.vx[i] = 0
  world.vy[i] = 0
  world.vz[i] = 0
  placeInColumn(world, i, col)
  const crest = Math.max(0, Math.min(1, (world.floorY - y) / (world.grain * 26)))
  const nx = Math.max(0, Math.min(1, world.x[i] / world.width))
  world.blowAt[i] = world.windAt + nx * 460 + (1 - crest) * 240 + hash(i + 8) * 100
}

function trySettle(world: SandWorld, i: number) {
  let col = colOf(world, world.x[i], world.z[i])
  const repose = world.bin * 1.35
  for (let s = 0; s < 8; s++) {
    const lower = neighborSteep(world, col, repose)
    if (lower < 0) break
    col = lower
  }
  const lower = world.rolls[i] < 6 ? neighborSteep(world, col, repose) : -1
  if (lower >= 0) {
    world.rolls[i]++
    const { binsX, bin, originX, originZ } = world
    const iz = (lower / binsX) | 0
    const ix = lower - iz * binsX
    const tx = originX + (ix + 0.5) * bin
    const tz = originZ + (iz + 0.5) * bin
    world.y[i] = surfaceY(world, col) - world.grain
    world.vx[i] = (tx - world.x[i]) * 7
    world.vz[i] = (tz - world.z[i]) * 7
    world.vy[i] = 70 + hash(i + world.rolls[i]) * 40
    return
  }
  settleGrain(world, i, col)
}

function blowGrain(world: SandWorld, i: number, col: number) {
  if (world.pileN[col] > 0) world.pileN[col]--
  world.state[i] = SAND_LOOSE
  const crest = Math.max(0, Math.min(1, (world.floorY - world.y[i]) / (world.grain * 28)))
  world.vx[i] = 240 + hash(i + 4) * 160
  world.vy[i] = -(200 + crest * 260 + hash(i + 5) * 90)
  world.vz[i] = (hash(i + 6) - 0.35) * 36
}

function avalanche(world: SandWorld) {
  const { n, state, y, rolls, mark, grain } = world
  const repose = world.bin * 1.35
  mark.fill(0)
  for (let i = 0; i < n; i++) {
    if (state[i] !== SAND_SETTLED || rolls[i] > 6) continue
    const col = colOf(world, world.x[i], world.z[i])
    if (mark[col]) continue
    if (Math.abs(y[i] - surfaceY(world, col)) > 0.8) continue
    const lower = neighborSteep(world, col, repose)
    if (lower < 0) continue
    mark[col] = 1
    if (world.pileN[col] > 0) world.pileN[col]--
    state[i] = SAND_LOOSE
    rolls[i]++
    const iz = (lower / world.binsX) | 0
    const ix = lower - iz * world.binsX
    const tx = world.originX + (ix + 0.5) * world.bin
    const tz = world.originZ + (iz + 0.5) * world.bin
    world.vx[i] = (tx - world.x[i]) * 6
    world.vz[i] = (tz - world.z[i]) * 6
    world.vy[i] = 50
  }
}

function substep(world: SandWorld, tMs: number, dt: number) {
  const { n, state, releaseAt, x, y, z, vx, vy, vz, fade, blowAt, grain, width } = world
  const wind = tMs >= world.windAt
  const reposeTouch = 90

  for (let i = 0; i < n; i++) {
    const s = state[i]
    if (s === SAND_SOLID && (wind || releaseAt[i] <= tMs)) releaseGrain(world, i, wind)
  }

  if (wind) {
    for (let i = 0; i < n; i++) {
      if (state[i] !== SAND_SETTLED || blowAt[i] > tMs) continue
      const col = colOf(world, x[i], z[i])
      if (Math.abs(y[i] - surfaceY(world, col)) > 0.8) {
        blowAt[i] = tMs + 28
        continue
      }
      blowGrain(world, i, col)
    }
  }

  for (let i = 0; i < n; i++) {
    if (state[i] !== SAND_LOOSE) continue
    vy[i] += GRAVITY * dt
    const drag = Math.max(0, 1 - 0.85 * dt)
    vx[i] *= drag
    vz[i] *= drag
    if (wind && tMs >= blowAt[i]) {
      vx[i] += 780 * dt
      vx[i] += (hash(i + ((tMs / 40) | 0)) - 0.5) * 160 * dt
      const age = tMs - blowAt[i]
      if (x[i] > width * 0.45) fade[i] -= dt * 1.15
      if (age > 650) fade[i] -= dt * 1.35
    }
    const windAge = wind ? tMs - world.windAt : 0
    if (windAge > WINDOW_SAND_WIND_MS * 0.5) fade[i] -= dt * 2.4

    x[i] += vx[i] * dt
    y[i] += vy[i] * dt
    z[i] += vz[i] * dt
    world.tumble[i] += (Math.abs(vx[i]) + Math.abs(vy[i]) + Math.abs(vz[i])) * dt * 0.02

    if (fade[i] < 0.04 || x[i] > width + SAND_WIND_RUN || y[i] > world.floorY + 240) {
      state[i] = SAND_EMPTY
      continue
    }

    const col = colOf(world, x[i], z[i])
    const surf = surfaceY(world, col)
    if (y[i] + grain < surf) continue

    if (wind) {
      y[i] = surf - grain
      vy[i] = -(70 + hash(i + ((tMs / 30) | 0)) * 90)
      vx[i] += 140
      continue
    }

    const cx = width * 0.5
    const centerSurf = surfaceY(world, colOf(world, cx, 8))
    if (
      centerSurf > world.floorY - grain * 6 &&
      Math.abs(x[i] - cx) > world.bin * 2.2 &&
      world.rolls[i] < 14
    ) {
      const dir = x[i] > cx ? -1 : 1
      const pull = Math.min(Math.abs(x[i] - cx), 32)
      x[i] += dir * pull * 0.5
      vx[i] = dir * (150 + Math.abs(x[i] - cx) * 0.4)
      vy[i] = 42
      y[i] = surf - grain
      world.rolls[i]++
      continue
    }

    if (vy[i] > reposeTouch) {
      y[i] = surf - grain
      let bounce = -vy[i] * 0.18
      if (bounce < -260) bounce = -260
      vy[i] = bounce
      vx[i] += (hash(i + 17) - 0.5) * 36
      vz[i] += (hash(i + 19) - 0.5) * 36
      continue
    }
    trySettle(world, i)
  }

  if (!wind) avalanche(world)
}

/** Advance the world. `tMs` is sim time at the end of this slice. */
export function stepSandWorld(world: SandWorld, tMs: number, dtMs: number) {
  let left = dtMs > 100 ? 100 : dtMs < 0 ? 0 : dtMs
  let t = tMs - left
  while (left > 0.01) {
    const h = left > 16 ? 16 : left
    t += h
    substep(world, t, h / 1000)
    left -= h
  }
}

export function countState(world: SandWorld, kind: number) {
  let n = 0
  const state = world.state
  for (let i = 0; i < world.n; i++) if (state[i] === kind) n++
  return n
}

/** Recolor grains from a pixel snapshot of the live window. */
export function applySnapshotColors(world: SandWorld, geom: WindowSandGeom, shot: ImageData) {
  const { n, grain, state, color, homeX, homeY } = world
  const dpr = geom.width > 0 ? shot.width / geom.width : 1
  for (let i = 0; i < n; i++) {
    if (state[i] === SAND_EMPTY) continue
    const sampled = sampleRgb(shot, dpr, homeX[i] + grain * 0.5, homeY[i] + grain * 0.5)
    if (sampled != null) color[i] = jitterColor(sampled, i)
  }
}

const shadeRgb = { r: 0, g: 0, b: 0 }

function shade(rgb: number, scale: number, lift: number) {
  shadeRgb.r = clampByte(((rgb >> 16) & 255) * scale + lift)
  shadeRgb.g = clampByte(((rgb >> 8) & 255) * scale + lift)
  shadeRgb.b = clampByte((rgb & 255) * scale + lift)
}

function plot(
  data: Uint8ClampedArray,
  W: number,
  H: number,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a: number,
) {
  x = x | 0
  y = y | 0
  if (a < 2 || x < 0 || y < 0 || x >= W || y >= H) return
  const o = (y * W + x) * 4
  const da = data[o + 3]
  if (da === 0 || a >= 250) {
    data[o] = r
    data[o + 1] = g
    data[o + 2] = b
    data[o + 3] = a
    return
  }
  const sa = a / 255
  const inv = (1 - sa) * (da / 255)
  const outA = sa + inv
  data[o] = (r * sa + data[o] * inv) / outA
  data[o + 1] = (g * sa + data[o + 1] * inv) / outA
  data[o + 2] = (b * sa + data[o + 2] * inv) / outA
  data[o + 3] = outA * 255
}

const speckPos = { x: 0, y: 0 }

/**
 * 1px specks that share one sample. Two is enough that a pour is not a single
 * dot; more would rebuild the old brick or multiply the sim.
 */
function speckCount(grain: number) {
  if (grain <= GRAIN_PX) return 1
  return 2
}

/** Two 1px grains in the sample, slightly jittered. One reused point — no allocation. */
function placeSpeck(i: number, k: number, grain: number) {
  if (grain <= GRAIN_PX) {
    speckPos.x = 0
    speckPos.y = 0
    return
  }
  const jx = (hash(i + k * 17 + 3) - 0.5) * 0.4
  const jy = (hash(i + k * 29 + 8) - 0.5) * 0.4
  const ox = k === 0 ? 0.2 : grain - 0.8
  const oy = k === 0 ? 0.25 : 1.1
  speckPos.x = ox + jx
  speckPos.y = oy + jy
}

function fillGrain(
  data: Uint8ClampedArray,
  W: number,
  H: number,
  sx: number,
  sy: number,
  grain: number,
  rgb: number,
  sun: number,
  flat: boolean,
  tumble: number,
  i: number,
) {
  if (flat) {
    shade(rgb, 1, 0)
    for (let py = 0; py < grain; py++) {
      for (let px = 0; px < grain; px++) {
        plot(data, W, H, sx + px, sy + py, shadeRgb.r, shadeRgb.g, shadeRgb.b, 255)
      }
    }
    return
  }
  const span = grain > 1 ? grain - 1 : 1
  const spin = ((tumble % 4) + 4) % 4
  const lx = spin < 1 || spin >= 3 ? -1 : 1
  const ly = spin < 2 ? -1 : 1
  const count = speckCount(grain)
  for (let k = 0; k < count; k++) {
    placeSpeck(i, k, grain)
    const nx = grain <= 1 ? 0 : (speckPos.x / span) * 2 - 1
    const ny = grain <= 1 ? 0 : (speckPos.y / span) * 2 - 1
    const ndot = nx * lx + ny * ly
    let light = 1 - ndot * 0.2
    if (light < 0.7) light = 0.7
    if (light > 1.14) light = 1.14
    const scale = sun * light
    shade(rgb, scale, light > 1.05 ? 12 : 0)
    plot(data, W, H, sx + speckPos.x, sy + speckPos.y, shadeRgb.r, shadeRgb.g, shadeRgb.b, 255)
  }
}

/** Paint grains into a cleared RGBA buffer the size of `sandCanvasBox`. */
export function paintSand(
  world: SandWorld,
  pixels: Uint8ClampedArray,
  viewW: number,
  viewH: number,
  padX: number,
  padTop: number,
) {
  pixels.fill(0)
  const { n, grain, state, color, homeX, homeY, x, y, z, tumble, fade, vx } = world
  for (let i = 0; i < n; i++) {
    if (state[i] !== SAND_SOLID) continue
    fillGrain(pixels, viewW, viewH, padX + homeX[i], padTop + homeY[i], grain, color[i], 1, true, 0, i)
  }

  const bandCount = world.bandCount
  const bandFill = world.bandFill
  bandCount.fill(0)
  for (let i = 0; i < n; i++) {
    const s = state[i]
    if (s !== SAND_LOOSE && s !== SAND_SETTLED) continue
    let b = ((z[i] + 40) / 5) | 0
    if (b < 0) b = 0
    else if (b >= BANDS) b = BANDS - 1
    bandCount[b]++
  }
  let sum = 0
  for (let b = 0; b < BANDS; b++) {
    bandFill[b] = sum
    sum += bandCount[b]
  }
  for (let i = 0; i < n; i++) {
    const s = state[i]
    if (s !== SAND_LOOSE && s !== SAND_SETTLED) continue
    let b = ((z[i] + 40) / 5) | 0
    if (b < 0) b = 0
    else if (b >= BANDS) b = BANDS - 1
    world.order[bandFill[b]++] = i
  }

  for (let k = 0; k < sum; k++) {
    const i = world.order[k]
    const s = state[i]
    const zz = z[i]
    const sx = (padX + x[i] + zz * 0.42) | 0
    const sy = (padTop + y[i] + zz * 0.5) | 0
    const separated =
      Math.abs(x[i] - homeX[i]) > grain ||
      Math.abs(y[i] - homeY[i]) > grain ||
      s === SAND_SETTLED
    const rgb = color[i]
    if (!separated) {
      fillGrain(pixels, viewW, viewH, padX + homeX[i], padTop + homeY[i], grain, rgb, 1, true, 0, i)
      continue
    }
    const col = colOf(world, x[i], zz)
    const air = s === SAND_LOOSE ? Math.max(0, surfaceY(world, col) - grain - y[i]) : 0
    const drop = grain + Math.min(6, air * 0.05)
    const shadowA = Math.min(110, (s === SAND_SETTLED ? 96 : 64) * fade[i])
    const sr = ((rgb >> 16) & 255) * 0.28
    const sg = ((rgb >> 8) & 255) * 0.28
    const sb = (rgb & 255) * 0.28
    const specks = speckCount(grain)
    for (let s = 0; s < specks; s++) {
      placeSpeck(i, s, grain)
      plot(
        pixels,
        viewW,
        viewH,
        sx + speckPos.x + grain,
        sy + speckPos.y + drop,
        sr,
        sg,
        sb,
        shadowA,
      )
    }
    const crest = Math.max(0, Math.min(1, (world.floorY - y[i]) / (grain * 24)))
    const ao = s === SAND_SETTLED ? 0.84 + 0.16 * crest : 1
    const near = 1 + Math.max(-20, Math.min(70, zz)) * 0.0025
    fillGrain(pixels, viewW, viewH, sx, sy, grain, rgb, ao * near, !separated, tumble[i], i)
    if (s === SAND_LOOSE && vx[i] > 140 && fade[i] > 0.25) {
      shade(rgb, 0.8, 0)
      const a = (90 * fade[i]) | 0
      plot(pixels, viewW, viewH, sx - grain, sy, shadeRgb.r, shadeRgb.g, shadeRgb.b, a)
      plot(pixels, viewW, viewH, sx - grain * 2, sy + 1, shadeRgb.r, shadeRgb.g, shadeRgb.b, a * 0.45)
    }
  }
}
