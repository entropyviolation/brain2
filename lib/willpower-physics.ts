/**
 * lib/willpower-physics.ts — Willpower gems bouncing-ball lab
 *
 * Habit gems on a slightly concave dish around the pinned willpower crystal.
 * Horizontal: spherical-bowl gravity (κ = g/R), oval wall, glassy sibling
 * bounce. Vertical: real bouncing-ball kinematics — z̈ = −g, bounce
 * v_z⁺ = −e v_z⁻. Visuals stay honest: gems keep their photographed
 * shape (no squash/stretch, no drop-shadow). Airborne gems pass over
 * neighbors so a Sunday handful never fuses into a dead puck. Each stir
 * uses a fresh seed so trajectories differ. Grab/throw: a `held` gem is
 * kinematic (follows the pointer anywhere, including off the plate).
 * Dragging above the dish raises z so drawY stays on the cursor; release
 * keeps that height and velocity so gravity, bounce, and collisions run.
 * Airborne gems skip the oval fence until they land. No extra physics
 * package. The crystal is a solid in XY — gems bounce off and do not
 * tunnel through — and a Y-sort occluder for stones around it. Gems may
 * paint past the rim (outer fence ~1.32×). Optional Physics popup shows
 * live equations, a twin plate, and editable knobs. Persist v18 resets leftover
 * scatter-bomb knobs to the calm default whirl.
 */

export type WillpowerBody = {
  id: string
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  omega: number
  theta: number
  squash: number
  r: number
  mass: number
  e: number
  pinned: boolean
  held: boolean
  restX: number
  restY: number
}

export type WillpowerWorld = {
  width: number
  height: number
  cx: number
  cy: number
  rx: number
  ry: number
  scale: number
  seed: number
  stirAge: number
  bounces: number
}

export type WillpowerPhysicsParams = {
  /** Vertical gravity g (px/s²). z̈ = −g. */
  g: number
  /** Dish curvature κ (1/s²). F_dish = −κ r. */
  dishK: number
  /** Coefficient of restitution e = −v⁺/v⁻. */
  restitution: number
  wallRestitution: number
  /** Rest mass for habit gems (crystal stays pinned and heavy). */
  mass: number
  /** Linear air drag b (1/s). F_d = −b v − c |v| v. */
  linearDrag: number
  /** Quadratic air drag c (1/px). */
  quadDrag: number
  /** Coulomb friction on the plate (px/s²), only when grounded. */
  friction: number
  repulsion: number
  /** Magnus / spin lift. F_M ∝ ω × v. */
  magnus: number
  stirSpeed: number
  /** Upward impulse on stir (px/s). */
  stirHop: number
  /** 0–1 mix of per-gem jitter so each stir is a new throw. */
  chaos: number
}

export type WillpowerPhysicsField = {
  key: keyof WillpowerPhysicsParams
  label: string
  symbol: string
  unit: string
  min: number
  max: number
  step: number
  equation: string
  explain: string
}

export type WillpowerTelemetry = {
  ke: number
  pe: number
  energy: number
  maxZ: number
  meanSpeed: number
  meanOmega: number
  momentum: number
  airborne: number
  count: number
  bounces: number
}

export const DEFAULT_WILLPOWER_PHYSICS: WillpowerPhysicsParams = {
  g: 820,
  dishK: 1.18,
  restitution: 0.84,
  wallRestitution: 0.7,
  mass: 1,
  linearDrag: 0.34,
  quadDrag: 0.0012,
  friction: 46,
  repulsion: 240,
  magnus: 0.22,
  stirSpeed: 220,
  stirHop: 160,
  chaos: 0.22,
}

export const WILLPOWER_PHYSICS_FIELDS: WillpowerPhysicsField[] = [
  { key: "g", label: "Gravity", symbol: "g", unit: "px/s²", min: 120, max: 1600, step: 10, equation: "v_z(t) = v_{z0} − g t", explain: "Downward acceleration. Higher g pulls hops back to the dish faster; lower g makes long floaty arcs." },
  { key: "restitution", label: "Bounciness", symbol: "e", unit: "", min: 0.15, max: 0.98, step: 0.01, equation: "e = −v_z⁺ / v_z⁻", explain: "Fraction of vertical speed kept after a floor hit. 1 would be a perfect bounce; values near 0.8 feel glassy." },
  { key: "mass", label: "Mass", symbol: "m", unit: "", min: 0.35, max: 3.2, step: 0.05, equation: "K = ½ m |v|²", explain: "Inertia of each habit gem. Heavier stones store more kinetic energy at the same speed and shove neighbors less." },
  { key: "dishK", label: "Dish curve", symbol: "κ", unit: "1/s²", min: 0.2, max: 4.5, step: 0.05, equation: "F_dish = −κ r", explain: "How strongly the black-mirror well pulls gems toward the crystal. This is the shallow-bowl spring, κ ≈ g/R." },
  { key: "friction", label: "Plate friction", symbol: "μN", unit: "px/s²", min: 0, max: 160, step: 1, equation: "F_f = −μN v̂  (z ≈ 0)", explain: "Coulomb drag while a gem is sitting on the lacquer. Zero and they skate; high and they park after a bounce." },
  { key: "linearDrag", label: "Air drag", symbol: "b", unit: "1/s", min: 0, max: 1.6, step: 0.02, equation: "F_d = −b v − c |v| v", explain: "Speed-proportional air resistance. Tamps wild throws without changing the bounce law." },
  { key: "quadDrag", label: "Quad drag", symbol: "c", unit: "1/px", min: 0, max: 0.008, step: 0.0001, equation: "F_d = −b v − c |v| v", explain: "Extra drag that grows with |v|². It clips the fastest throws so a stir cannot become a scatter bomb." },
  { key: "stirHop", label: "Stir hop", symbol: "Δv_z", unit: "px/s", min: 80, max: 900, step: 10, equation: "z(t) = z_0 + v_{z0} t − ½ g t²", explain: "Upward impulse when you press the plate. Keep it modest so gems hop, not leave the room." },
  { key: "stirSpeed", label: "Stir shove", symbol: "Δv_xy", unit: "px/s", min: 80, max: 900, step: 10, equation: "p = m v", explain: "In-plane whirl from a plate press. Tangential around the crystal, stronger near the click." },
  { key: "magnus", label: "Spin lift", symbol: "C_M", unit: "", min: 0, max: 0.8, step: 0.01, equation: "F_M ∝ ω × v", explain: "Sideways force from gem spin (Magnus). A little curve on the bounce; too much looks drunk." },
  { key: "chaos", label: "Chaos", symbol: "ξ", unit: "", min: 0, max: 1, step: 0.01, equation: "v ← v + ξ · U(−1,1)", explain: "Per-gem jitter so two stirs never match. Low = a clean whirl; high = a mess." },
  { key: "repulsion", label: "Crowd push", symbol: "k", unit: "", min: 40, max: 520, step: 5, equation: "F_rep ∝ (1 − d/d_0)²", explain: "Soft overlap spring between gems (and off the crystal). Stops a Sunday pile from fusing." },
  { key: "wallRestitution", label: "Rim bounce", symbol: "e_w", unit: "", min: 0.2, max: 0.95, step: 0.01, equation: "v_n⁺ = −e_w v_n⁻", explain: "How lively a hit on the chrome rim is. Softer than the floor so the oval contains the whirl." },
]

export const WILLPOWER_PHYSICS_EQUATIONS = [
  "v_z(t) = v_{z0} − g t",
  "z(t) = z_0 + v_{z0} t − ½ g t²",
  "e = −v_z⁺ / v_z⁻",
  "K = ½ m (v_x² + v_y² + v_z²)",
  "U = m g z + ½ κ r²",
  "F_d = −b v − c |v| v",
  "F_dish = −κ r̂",
  "F_M ∝ ω × v",
] as const

/** κ = g/R for a shallow spherical dish. Was a rest-orbit spring of 22. */
export const WILLPOWER_GRAVITY = DEFAULT_WILLPOWER_PHYSICS.dishK
export const WILLPOWER_DAMP = DEFAULT_WILLPOWER_PHYSICS.linearDrag
export const WILLPOWER_QUAD_DRAG = DEFAULT_WILLPOWER_PHYSICS.quadDrag
export const WILLPOWER_FRICTION = DEFAULT_WILLPOWER_PHYSICS.friction
export const WILLPOWER_RESTITUTION = DEFAULT_WILLPOWER_PHYSICS.restitution
export const WILLPOWER_WALL_RESTITUTION = DEFAULT_WILLPOWER_PHYSICS.wallRestitution
export const WILLPOWER_REPULSION = DEFAULT_WILLPOWER_PHYSICS.repulsion
export const WILLPOWER_STIR_SPEED = DEFAULT_WILLPOWER_PHYSICS.stirSpeed
export const WILLPOWER_STIR_TANGENTIAL = 0.88
export const WILLPOWER_STIR_HOP = DEFAULT_WILLPOWER_PHYSICS.stirHop
/** Collision radius of the pinned crystal at scale 1. Matches the photo core. */
export const WILLPOWER_CRYSTAL_RADIUS = 30
export const WILLPOWER_GEM_RADIUS = 6

const MAX_DT = 1 / 30
const MAX_SPEED = 720
const MAX_VZ = 1400
const REST_SPEED = 8
const GROUND_Z = 0.45
const COLLISION_PASSES = 3
const GOLDEN = Math.PI * (3 - Math.sqrt(5))
const PERSPECTIVE = 0.26

/** Painter's foreshortening: drawY = y − z · P. */
export const WILLPOWER_PERSPECTIVE = PERSPECTIVE
/** Peak height a grabbed gem may be lifted (px). Stir hops stay well below. */
export const WILLPOWER_MAX_Z = 900
/** Hover height while a gem is held on the dish. */
export const WILLPOWER_HELD_Z = 12

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

export function sanitizeWillpowerPhysics(raw: unknown): WillpowerPhysicsParams {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const next = { ...DEFAULT_WILLPOWER_PHYSICS }
  for (const field of WILLPOWER_PHYSICS_FIELDS) {
    const v = o[field.key]
    const n = typeof v === "number" && Number.isFinite(v) ? v : DEFAULT_WILLPOWER_PHYSICS[field.key]
    next[field.key] = clamp(n, field.min, field.max) as never
  }
  return next
}

export function emptyWillpowerWorld(): WillpowerWorld {
  return { width: 160, height: 96, cx: 80, cy: 50, rx: 74, ry: 40, scale: 1, seed: 1, stirAge: 99, bounces: 0 }
}

export function restOrbit(
  count: number,
  cx: number,
  cy: number,
  radius: number,
  hole = 0,
): Array<{ x: number; y: number }> {
  if (count <= 0) return []
  const pts: Array<{ x: number; y: number }> = []
  const inner = Math.max(hole, count === 1 ? radius * 0.55 : radius * 0.18)
  const outer = Math.max(radius, inner + 6)
  const span = Math.max(outer - inner, radius * 0.16)
  for (let i = 0; i < count; i++) {
    const t = Math.sqrt((i + 0.5) / count)
    const r = inner + span * t
    const a = i * GOLDEN - Math.PI / 2
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r })
  }
  return pts
}

export function kineticEnergy(bodies: WillpowerBody[]): number {
  return bodies.reduce((sum, b) => {
    if (b.pinned) return sum
    return sum + 0.5 * b.mass * (b.vx * b.vx + b.vy * b.vy + b.vz * b.vz)
  }, 0)
}

export function potentialEnergy(bodies: WillpowerBody[], world: WillpowerWorld, params: WillpowerPhysicsParams): number {
  return bodies.reduce((sum, b) => {
    if (b.pinned) return sum
    const r2 = (b.x - world.cx) ** 2 + (b.y - world.cy) ** 2
    return sum + b.mass * params.g * Math.max(b.z, 0) + 0.5 * params.dishK * r2
  }, 0)
}

export function willpowerTelemetry(
  bodies: WillpowerBody[],
  world: WillpowerWorld,
  params: WillpowerPhysicsParams,
): WillpowerTelemetry {
  const gems = bodies.filter((b) => !b.pinned)
  const ke = kineticEnergy(gems)
  const pe = potentialEnergy(gems, world, params)
  let maxZ = 0
  let speed = 0
  let airborne = 0
  let omega = 0
  let momentum = 0
  for (const b of gems) {
    if (b.z > maxZ) maxZ = b.z
    const sp = Math.hypot(b.vx, b.vy, b.vz)
    speed += sp
    omega += Math.abs(b.omega)
    momentum += b.mass * sp
    if (b.z > GROUND_Z) airborne += 1
  }
  const n = gems.length || 1
  return {
    ke,
    pe,
    energy: ke + pe,
    maxZ,
    meanSpeed: speed / n,
    meanOmega: omega / n,
    momentum,
    airborne,
    count: gems.length,
    bounces: world.bounces,
  }
}

/** Painter's algorithm: smaller draw-Y (toward the top) sits behind the crystal PNG. */
export function drawY(body: Pick<WillpowerBody, "y" | "z">): number {
  return body.y - Math.max(body.z, 0) * PERSPECTIVE
}

export function stoneIsBehindCrystal(stoneY: number, crystalY: number): boolean {
  return stoneY < crystalY
}

export function sortWillpowerPaintOrder(bodies: WillpowerBody[]): WillpowerBody[] {
  return [...bodies].sort((a, b) => drawY(a) - drawY(b) || a.x - b.x)
}

/** Soft crowd scale: a Sunday handful still gets a real kick. */
export function stirCrowdFactor(n: number): number {
  return 0.42 + 0.58 * Math.min(1, (14 / Math.max(n, 1)) ** 0.28)
}

export function bouncingBallApex(z: number, vz: number, g: number): number {
  if (g <= 0) return Math.max(z, 0)
  if (vz <= 0) return Math.max(z, 0)
  return z + (vz * vz) / (2 * g)
}

export function bouncingBallTimeToApex(vz: number, g: number): number {
  if (g <= 0 || vz <= 0) return 0
  return vz / g
}

/** First future t where z(t) = z + v_z t − ½ g t² hits the dish. */
export function bouncingBallTimeToFloor(z: number, vz: number, g: number): number {
  if (g <= 0) return 0
  if (z <= GROUND_Z && vz <= 0) return 0
  const disc = vz * vz + 2 * g * Math.max(z, 0)
  if (disc <= 0) return 0
  return (vz + Math.sqrt(disc)) / g
}

/** Small-angle period of the dish spring, T = 2π / √κ. */
export function dishPeriod(kappa: number): number {
  if (kappa <= 0) return 0
  return (2 * Math.PI) / Math.sqrt(kappa)
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function unitHash(i: number, salt = 0): number {
  const x = Math.sin(i * 12.9898 + 78.233 + salt * 0.17) * 43758.5453
  return x - Math.floor(x)
}

export function gemVariation(id: string, params: WillpowerPhysicsParams): { mass: number; e: number } {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const u = (h >>> 0) / 4294967296
  const v = ((h * 1597334677) >>> 0) / 4294967296
  const chaos = params.chaos
  const mass = params.mass * (1 + (u - 0.5) * 0.7 * chaos)
  const e = clamp(params.restitution * (1 + (v - 0.5) * 0.22 * chaos), 0.12, 0.98)
  return { mass: Math.max(0.2, mass), e }
}

function separate(a: WillpowerBody, b: WillpowerBody, params: WillpowerPhysicsParams) {
  if (a.pinned && b.pinned) return
  if (a.held && b.held) return
  const crystal = a.pinned || b.pinned
  // Sibling gems may hop over each other. The crystal is a solid: never tunnel.
  if (!crystal && Math.abs(b.z - a.z) > (a.r + b.r) * 0.85) return
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dist = Math.hypot(dx, dy) || 0.0001
  const min = a.r + b.r
  if (dist >= min) return
  const nx = dx / dist
  const ny = dy / dist
  const overlap = min - dist
  const invA = a.held || a.pinned ? 0 : 1 / a.mass
  const invB = b.held || b.pinned ? 0 : 1 / b.mass
  const inv = invA + invB || 1
  const corr = overlap / inv
  if (!a.held && !a.pinned) {
    a.x -= nx * corr * invA
    a.y -= ny * corr * invA
  }
  if (!b.held && !b.pinned) {
    b.x += nx * corr * invB
    b.y += ny * corr * invB
  }
  if (a.held || b.held) return
  const rvx = b.vx - a.vx
  const rvy = b.vy - a.vy
  const vn = rvx * nx + rvy * ny
  if (vn > 0) return
  const e = crystal ? Math.max(a.e, b.e, params.wallRestitution) : Math.min(a.e, b.e)
  const j = (-(1 + e) * vn) / inv
  if (!a.pinned) {
    a.vx -= (j * nx) / a.mass
    a.vy -= (j * ny) / a.mass
  }
  if (!b.pinned) {
    b.vx += (j * nx) / b.mass
    b.vy += (j * ny) / b.mass
  }
  const pop = Math.abs(vn) * 0.18 * (0.45 + params.chaos * 0.7)
  if (!a.pinned && a.z < GROUND_Z * 2) a.vz += pop
  if (!b.pinned && b.z < GROUND_Z * 2) b.vz += pop
  if (!a.pinned) a.omega += vn * 0.02
  if (!b.pinned) b.omega -= vn * 0.02
}

function clampOval(b: WillpowerBody, world: WillpowerWorld, params: WillpowerPhysicsParams) {
  if (b.pinned || b.held) return
  // Held gems follow the pointer with no fence. Airborne throws may leave the
  // dish (the 1.32× rim is the grounded wall); a wider leash keeps stir hops
  // from escaping to infinity.
  const fence = b.z > 22 ? 2.8 : 1.32
  const dx = b.x - world.cx
  const dy = b.y - world.cy
  const rx = Math.max(world.rx * fence - b.r, 8)
  const ry = Math.max(world.ry * fence - b.r, 8)
  const e = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry)
  if (e <= 1) return
  const inv = 1 / Math.sqrt(e)
  b.x = world.cx + dx * inv
  b.y = world.cy + dy * inv
  const nx = dx / (rx * rx)
  const ny = dy / (ry * ry)
  const nlen = Math.hypot(nx, ny) || 1
  const ux = nx / nlen
  const uy = ny / nlen
  const vn = b.vx * ux + b.vy * uy
  if (vn > 0) {
    b.vx -= (1 + params.wallRestitution) * vn * ux
    b.vy -= (1 + params.wallRestitution) * vn * uy
    b.vz += Math.abs(vn) * 0.12
  }
}

function addRepulsion(fx: number[], fy: number[], bodies: WillpowerBody[], params: WillpowerPhysicsParams) {
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i]
    if (!a) continue
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j]
      if (!b) continue
      if (a.pinned && b.pinned) continue
      const crystal = a.pinned || b.pinned
      if (!crystal && Math.abs(b.z - a.z) > (a.r + b.r) * 1.4) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.hypot(dx, dy) || 0.0001
      const range = (a.r + b.r) * (crystal ? 1.85 : 2.35)
      if (dist >= range) continue
      const n = 1 - dist / range
      const force = params.repulsion * n * n * (crystal ? 1.35 : 1)
      const nx = dx / dist
      const ny = dy / dist
      if (!a.pinned) {
        fx[i] -= (nx * force) / a.mass
        fy[i] -= (ny * force) / a.mass
      }
      if (!b.pinned) {
        fx[j] += (nx * force) / b.mass
        fy[j] += (ny * force) / b.mass
      }
    }
  }
}

function bounceFloor(b: WillpowerBody, params: WillpowerPhysicsParams, world?: WillpowerWorld) {
  if (b.z >= 0) return
  b.z = 0
  if (b.vz < 0) {
    const incoming = b.vz
    b.vz = -incoming * b.e
    b.squash = clamp(Math.abs(incoming) / 380, 0, 0.55)
    if (Math.abs(b.vz) < 28) {
      b.vz = 0
      b.z = 0
    } else {
      if (world) world.bounces += 1
      b.vx += b.omega * 4.2 * params.magnus
      b.vy -= b.omega * 3.1 * params.magnus
    }
  }
}

function integrate(b: WillpowerBody, accelX: number, accelY: number, t: number, params: WillpowerPhysicsParams, world: WillpowerWorld) {
  if (b.held) return
  const grounded = b.z <= GROUND_Z && b.vz <= 12
  const speed = Math.hypot(b.vx, b.vy, b.vz)
  if (grounded && speed < REST_SPEED) {
    const f = Math.hypot(accelX, accelY)
    if (f <= params.friction) {
      b.vx = 0
      b.vy = 0
      b.vz = 0
      b.z = 0
      b.squash *= 0.72
      return
    }
    const s = (f - params.friction) / f
    b.vx += accelX * s * t
    b.vy += accelY * s * t
  } else {
    const inv = 1 / Math.max(speed, 0.0001)
    const drag = params.linearDrag + params.quadDrag * speed
    let ax = accelX - b.vx * drag
    let ay = accelY - b.vy * drag
    if (grounded) {
      ax -= b.vx * inv * params.friction
      ay -= b.vy * inv * params.friction
    }
    const lift = params.magnus * b.omega
    ax += -b.vy * lift
    ay += b.vx * lift
    b.vx += ax * t
    b.vy += ay * t
  }
  b.vz += -params.g * t - b.vz * params.linearDrag * 0.55 * t
  const xy = Math.hypot(b.vx, b.vy)
  if (xy > MAX_SPEED) {
    const k = MAX_SPEED / xy
    b.vx *= k
    b.vy *= k
  }
  if (b.vz > MAX_VZ) b.vz = MAX_VZ
  if (b.vz < -MAX_VZ) b.vz = -MAX_VZ
  b.x += b.vx * t
  b.y += b.vy * t
  b.z += b.vz * t
  if (b.z > WILLPOWER_MAX_Z) {
    b.z = WILLPOWER_MAX_Z
    if (b.vz > 0) b.vz *= -0.2
  }
  bounceFloor(b, params, world)
  b.theta += b.omega * t
  b.omega *= 1 - 0.55 * t
  const stretch = grounded ? 0 : clamp(Math.abs(b.vz) / 520, 0, 0.38)
  b.squash = b.squash * (1 - 8 * t) + stretch * 0.15
}

function keepAlive(bodies: WillpowerBody[], world: WillpowerWorld, params: WillpowerPhysicsParams, rng: () => number) {
  if (world.stirAge > 5.2) return
  const gems = bodies.filter((b) => !b.pinned)
  const n = gems.length
  if (n < 2) return
  const decay = 1 - world.stirAge / 5.2
  const ke = kineticEnergy(gems)
  const meanKe = ke / n
  const crowded = n > 10
  if (crowded && meanKe < 90 * decay) {
    const hops = Math.min(4, 1 + Math.floor(n / 14))
    for (let k = 0; k < hops; k++) {
      const b = gems[Math.floor(rng() * n)]
      if (!b) continue
      b.vz += (48 + rng() * 90) * decay * (0.32 + params.chaos)
      b.vx += (rng() - 0.5) * 70 * decay
      b.vy += (rng() - 0.5) * 70 * decay
      b.omega += (rng() - 0.5) * 8
    }
  }
}

export function worldIsLive(bodies: WillpowerBody[]): boolean {
  return bodies.some((b) => {
    if (b.pinned) return false
    if (b.held) return true
    return b.z > GROUND_Z || b.vx * b.vx + b.vy * b.vy + b.vz * b.vz > 64
  })
}

export function stepWillpowerWorld(
  bodies: WillpowerBody[],
  world: WillpowerWorld,
  dt: number,
  params: WillpowerPhysicsParams = DEFAULT_WILLPOWER_PHYSICS,
): WillpowerBody[] {
  const t = Math.min(Math.max(dt, 0), MAX_DT)
  const next = bodies.map((b) => ({ ...b }))
  const fx = next.map(() => 0)
  const fy = next.map(() => 0)
  for (let i = 0; i < next.length; i++) {
    const b = next[i]
    if (!b || b.pinned) continue
    const k = b.z > GROUND_Z ? params.dishK * 0.42 : params.dishK
    fx[i] = (world.cx - b.x) * k
    fy[i] = (world.cy - b.y) * k
  }
  addRepulsion(fx, fy, next, params)
  for (let i = 0; i < next.length; i++) {
    const b = next[i]
    if (!b || b.pinned) continue
    integrate(b, fx[i] ?? 0, fy[i] ?? 0, t, params, world)
  }
  for (let pass = 0; pass < COLLISION_PASSES; pass++) {
    for (let i = 0; i < next.length; i++) {
      for (let j = i + 1; j < next.length; j++) {
        separate(next[i], next[j], params)
      }
    }
  }
  for (const b of next) clampOval(b, world, params)
  world.stirAge += t
  keepAlive(next, world, params, mulberry32((world.seed + Math.floor(world.stirAge * 60)) | 0))
  return next
}

/** Push overlapping gems (and gems inside the crystal) apart without integrating. */
export function resolveWillpowerOverlaps(
  bodies: WillpowerBody[],
  params: WillpowerPhysicsParams = DEFAULT_WILLPOWER_PHYSICS,
): WillpowerBody[] {
  const next = bodies.map((b) => ({ ...b }))
  for (let pass = 0; pass < COLLISION_PASSES * 2; pass++) {
    for (let i = 0; i < next.length; i++) {
      for (let j = i + 1; j < next.length; j++) {
        separate(next[i], next[j], params)
      }
    }
  }
  return next
}

export function stirWillpower(
  bodies: WillpowerBody[],
  world: WillpowerWorld,
  clickX: number,
  clickY: number,
  params: WillpowerPhysicsParams = DEFAULT_WILLPOWER_PHYSICS,
  seed = (Math.random() * 0x7fffffff) | 0,
): WillpowerBody[] {
  const n = bodies.reduce((sum, b) => sum + (b.pinned ? 0 : 1), 0)
  const crowd = stirCrowdFactor(n)
  const rng = mulberry32(seed || 1)
  world.seed = seed || 1
  world.stirAge = 0
  world.bounces = 0
  return bodies.map((b, i) => {
    if (b.pinned) return { ...b }
    const dx = b.x - clickX
    const dy = b.y - clickY
    const dist = Math.hypot(dx, dy) || 1
    const nx = dx / dist
    const ny = dy / dist
    const h = rng()
    const swirl = rng() < 0.5 ? 1 : -1
    const jitter = (h - 0.5) * 2
    const power =
      params.stirSpeed *
      crowd *
      (0.42 + 0.58 * (1 - Math.min(dist / Math.max(world.rx, 1), 1))) *
      (0.78 + rng() * 0.32 * params.chaos)
    const tang = power * WILLPOWER_STIR_TANGENTIAL * swirl
    const kick = 22 * crowd * jitter * (0.18 + params.chaos * 0.7)
    const hop = params.stirHop * crowd * (0.38 + rng() * (0.22 + params.chaos * 0.28))
    const spin = (rng() - 0.5) * 4.2 * params.chaos
    return {
      ...b,
      vx: b.vx + nx * power + -ny * tang + -ny * kick,
      vy: b.vy + ny * power + nx * tang + nx * kick,
      vz: Math.max(b.vz, 0) + hop,
      omega: b.omega + spin,
      squash: 0.28,
    }
  })
}

export function scaleWillpowerBodies(
  bodies: WillpowerBody[],
  prev: WillpowerWorld,
  next: WillpowerWorld,
): WillpowerBody[] {
  const sx = next.rx / Math.max(prev.rx, 1)
  const sy = next.ry / Math.max(prev.ry, 1)
  return bodies.map((b) => ({
    ...b,
    x: next.cx + (b.x - prev.cx) * sx,
    y: next.cy + (b.y - prev.cy) * sy,
    restX: next.cx + (b.restX - prev.cx) * sx,
    restY: next.cy + (b.restY - prev.cy) * sy,
    r: (b.pinned ? WILLPOWER_CRYSTAL_RADIUS : WILLPOWER_GEM_RADIUS) * next.scale,
    held: b.held,
  }))
}

export function mapWillpowerPoint(
  x: number,
  y: number,
  from: Pick<WillpowerWorld, "cx" | "cy" | "rx" | "ry">,
  to: Pick<WillpowerWorld, "cx" | "cy" | "rx" | "ry">,
): { x: number; y: number } {
  return {
    x: to.cx + (x - from.cx) * (to.rx / Math.max(from.rx, 1)),
    y: to.cy + (y - from.cy) * (to.ry / Math.max(from.ry, 1)),
  }
}

export function viewWillpowerBody(body: WillpowerBody, sim: WillpowerWorld, view: WillpowerWorld): WillpowerBody {
  const p = mapWillpowerPoint(body.x, body.y, sim, view)
  const rest = mapWillpowerPoint(body.restX, body.restY, sim, view)
  const s = view.scale / Math.max(sim.scale, 0.0001)
  return {
    ...body,
    x: p.x,
    y: p.y,
    restX: rest.x,
    restY: rest.y,
    r: body.r * s,
    z: body.z * s,
  }
}

export function hitWillpowerGem(bodies: WillpowerBody[], x: number, y: number): WillpowerBody | null {
  const gems = bodies.filter((b) => !b.pinned).sort((a, b) => drawY(b) - drawY(a) || b.x - a.x)
  for (const b of gems) {
    const dx = x - b.x
    const dy = y - drawY(b)
    const reach = b.r * 1.45
    if (dx * dx + dy * dy <= reach * reach) return b
  }
  return null
}

export function grabWillpowerGem(bodies: WillpowerBody[], id: string): WillpowerBody[] {
  return bodies.map((b) =>
    b.id === id && !b.pinned
      ? { ...b, held: true, vx: 0, vy: 0, vz: 0, z: Math.max(b.z, WILLPOWER_HELD_Z) }
      : b,
  )
}

/**
 * Pointer mapped into sim space → kinematic grab pose.
 * Dragging above the dish raises z so drawY follows the pointer; xy may
 * leave the oval (clampOval ignores held + airborne).
 */
export function poseWillpowerGrab(
  plateY: number,
  mappedX: number,
  mappedY: number,
): { x: number; y: number; z: number; plateY: number } {
  const hover = WILLPOWER_HELD_Z * PERSPECTIVE
  if (mappedY < plateY - hover) {
    const z = clamp((plateY - mappedY) / PERSPECTIVE, WILLPOWER_HELD_Z, WILLPOWER_MAX_Z)
    return { x: mappedX, y: plateY, z, plateY }
  }
  return { x: mappedX, y: mappedY, z: WILLPOWER_HELD_Z, plateY: mappedY }
}

export function dragWillpowerGem(
  bodies: WillpowerBody[],
  id: string,
  x: number,
  y: number,
  vx: number,
  vy: number,
  z?: number,
  vz?: number,
): WillpowerBody[] {
  return bodies.map((b) =>
    b.id === id && b.held
      ? {
          ...b,
          x,
          y,
          vx,
          vy,
          vz: vz ?? b.vz,
          z: clamp(z ?? Math.max(b.z, WILLPOWER_HELD_Z), WILLPOWER_HELD_Z, WILLPOWER_MAX_Z),
          omega: b.omega + vx * 0.002,
        }
      : b,
  )
}

export function releaseWillpowerGem(
  bodies: WillpowerBody[],
  id: string,
  vx: number,
  vy: number,
  vz?: number,
): WillpowerBody[] {
  const speed = Math.hypot(vx, vy)
  return bodies.map((b) => {
    if (b.id !== id) return b
    const lifted = b.z > WILLPOWER_HELD_Z * 2
    const hop = lifted ? 0 : Math.min(speed * 0.22, 420)
    const nextVz = vz ?? b.vz
    return {
      ...b,
      held: false,
      vx,
      vy,
      vz: hop ? Math.max(nextVz, hop) : nextVz,
    }
  })
}

export function makeWillpowerCrystal(world: WillpowerWorld): WillpowerBody {
  return {
    id: "willpower-crystal",
    x: world.cx,
    y: world.cy,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    omega: 0,
    theta: 0,
    squash: 0,
    r: WILLPOWER_CRYSTAL_RADIUS * world.scale,
    mass: 48,
    e: 0.62,
    pinned: true,
    held: false,
    restX: world.cx,
    restY: world.cy,
  }
}

export function makeWillpowerGem(
  id: string,
  x: number,
  y: number,
  world: WillpowerWorld,
  params: WillpowerPhysicsParams,
  last?: WillpowerBody,
): WillpowerBody {
  const vary = gemVariation(id, params)
  return {
    id,
    x: last?.x ?? x,
    y: last?.y ?? y,
    z: last?.z ?? 0,
    vx: last?.vx ?? 0,
    vy: last?.vy ?? 0,
    vz: last?.vz ?? 0,
    omega: last?.omega ?? 0,
    theta: last?.theta ?? 0,
    squash: last?.squash ?? 0,
    r: WILLPOWER_GEM_RADIUS * world.scale,
    mass: vary.mass,
    e: vary.e,
    pinned: false,
    held: last?.held ?? false,
    restX: x,
    restY: y,
  }
}

export function predictedArc(
  z0: number,
  vz0: number,
  g: number,
  samples = 12,
): Array<{ t: number; z: number }> {
  const pts: Array<{ t: number; z: number }> = []
  let tEnd = 0.9
  if (g > 1) {
    const disc = vz0 * vz0 + 2 * g * Math.max(z0, 0)
    tEnd = disc > 0 ? (vz0 + Math.sqrt(disc)) / g : 0.4
    tEnd = clamp(tEnd, 0.12, 1.6)
  }
  for (let i = 0; i <= samples; i++) {
    const t = (tEnd * i) / samples
    const z = z0 + vz0 * t - 0.5 * g * t * t
    pts.push({ t, z: Math.max(z, 0) })
  }
  return pts
}
