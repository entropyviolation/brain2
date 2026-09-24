import { describe, expect, it } from "vitest"
import {
  bouncingBallApex,
  bouncingBallTimeToApex,
  bouncingBallTimeToFloor,
  DEFAULT_WILLPOWER_PHYSICS,
  dishPeriod,
  gemVariation,
  kineticEnergy,
  makeWillpowerCrystal,
  makeWillpowerGem,
  predictedArc,
  restOrbit,
  sanitizeWillpowerPhysics,
  sortWillpowerPaintOrder,
  stepWillpowerWorld,
  stirCrowdFactor,
  stirWillpower,
  stoneIsBehindCrystal,
  grabWillpowerGem,
  dragWillpowerGem,
  releaseWillpowerGem,
  poseWillpowerGrab,
  hitWillpowerGem,
  mapWillpowerPoint,
  viewWillpowerBody,
  WILLPOWER_CRYSTAL_RADIUS,
  WILLPOWER_FRICTION,
  WILLPOWER_GRAVITY,
  WILLPOWER_HELD_Z,
  WILLPOWER_MAX_Z,
  WILLPOWER_PERSPECTIVE,
  WILLPOWER_RESTITUTION,
  WILLPOWER_STIR_SPEED,
  WILLPOWER_STIR_TANGENTIAL,
  worldIsLive,
  type WillpowerBody,
  type WillpowerWorld,
} from "@/lib/willpower-physics"

function worldOf(partial: Partial<WillpowerWorld> = {}): WillpowerWorld {
  return {
    width: 180,
    height: 120,
    cx: 90,
    cy: 60,
    rx: 80,
    ry: 52,
    scale: 1,
    seed: 7,
    stirAge: 99,
    bounces: 0,
    ...partial,
  }
}

const world = worldOf()

function stone(partial: Partial<WillpowerBody> & Pick<WillpowerBody, "id">): WillpowerBody {
  const x = partial.x ?? 90
  const y = partial.y ?? 30
  return {
    x,
    y,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    omega: 0,
    theta: 0,
    squash: 0,
    r: 6,
    mass: 1,
    e: DEFAULT_WILLPOWER_PHYSICS.restitution,
    pinned: false,
    held: false,
    restX: x,
    restY: y,
    ...partial,
  }
}

function radii(bodies: WillpowerBody[], cx = world.cx, cy = world.cy) {
  return bodies.filter((b) => !b.pinned).map((b) => Math.hypot(b.x - cx, b.y - cy))
}

describe("willpower physics", () => {
  it("keeps dish gravity weak so friction can freeze a handful mid-plate", () => {
    expect(WILLPOWER_GRAVITY).toBeLessThan(6)
    expect(WILLPOWER_FRICTION / WILLPOWER_GRAVITY).toBeGreaterThan(30)
    expect(WILLPOWER_STIR_TANGENTIAL).toBeGreaterThan(0.7)
    expect(WILLPOWER_RESTITUTION).toBeGreaterThan(0.75)
  })

  it("packs a sunflower handful across the dish, not a single orbit", () => {
    const pts = restOrbit(4, 90, 60, 30)
    expect(pts).toHaveLength(4)
    const rs = pts.map((p) => Math.hypot(p.x - 90, p.y - 60))
    expect(Math.max(...rs)).toBeLessThanOrEqual(30.01)
    expect(new Set(rs.map((r) => Math.round(r * 5) / 5)).size).toBeGreaterThan(1)
  })

  it("spreads a crowded Sunday pack over many radii", () => {
    const pts = restOrbit(21, 90, 60, 28)
    expect(pts).toHaveLength(21)
    const unique = [...new Set(pts.map((p) => Math.round(Math.hypot(p.x - 90, p.y - 60))))]
    expect(unique.length).toBeGreaterThan(4)
  })

  it("still fills the dish when many same-habit copies collect", () => {
    const pts = restOrbit(30, 90, 60, 28)
    expect(pts).toHaveLength(30)
    const rs = pts.map((p) => Math.hypot(p.x - 90, p.y - 60))
    expect(Math.min(...rs)).toBeGreaterThan(1)
    expect(Math.max(...rs)).toBeLessThanOrEqual(28.01)
    expect(Math.max(...rs) - Math.min(...rs)).toBeGreaterThan(10)
  })

  it("stir raises kinetic energy and a step exists", () => {
    const w = worldOf({ stirAge: 0 })
    const bodies = [
      stone({ id: "crystal", x: 90, y: 60, r: 18, mass: 40, pinned: true, restX: 90, restY: 60 }),
      stone({ id: "a", x: 90, y: 28, restX: 90, restY: 28 }),
      stone({ id: "b", x: 120, y: 60, restX: 120, restY: 60 }),
    ]
    const stirred = stirWillpower(bodies, w, 90, 60, DEFAULT_WILLPOWER_PHYSICS, 42)
    expect(kineticEnergy(stirred)).toBeGreaterThan(kineticEnergy(bodies))
    expect(stirred.find((b) => b.id === "crystal")?.vx).toBe(0)
    expect(stirred.find((b) => b.id === "a")!.vz).toBeGreaterThan(80)
    const moved = stepWillpowerWorld(stirred, w, 1 / 60)
    expect(moved.find((b) => b.id === "a")).toBeTruthy()
    expect(moved).toHaveLength(3)
  })

  it("each stir seed throws a different handful", () => {
    const bodies = [
      stone({ id: "crystal", x: 90, y: 60, r: 18, mass: 40, pinned: true }),
      stone({ id: "a", x: 90, y: 28 }),
      stone({ id: "b", x: 120, y: 60 }),
      stone({ id: "c", x: 70, y: 70 }),
    ]
    const a = stirWillpower(bodies, worldOf(), 90, 60, DEFAULT_WILLPOWER_PHYSICS, 11)
    const b = stirWillpower(bodies, worldOf(), 90, 60, DEFAULT_WILLPOWER_PHYSICS, 99)
    const gemA = a.find((g) => g.id === "a")!
    const gemB = b.find((g) => g.id === "a")!
    expect(Math.abs(gemA.vx - gemB.vx) + Math.abs(gemA.vz - gemB.vz)).toBeGreaterThan(5)
  })

  it("crowded stir injects real energy with a strong tangential whirl", () => {
    const w = worldOf()
    const orbit = restOrbit(28, w.cx, w.cy, 28)
    const bodies = [
      stone({ id: "crystal", x: w.cx, y: w.cy, r: 18, mass: 40, pinned: true, restX: w.cx, restY: w.cy }),
      ...orbit.map((p, i) => stone({ id: `s${i}`, x: p.x, y: p.y, restX: p.x, restY: p.y })),
    ]
    expect(stirCrowdFactor(28)).toBeGreaterThan(0.7)
    const stirred = stirWillpower(bodies, w, w.cx, w.cy, DEFAULT_WILLPOWER_PHYSICS, 3)
    const ke = kineticEnergy(stirred)
    expect(ke).toBeGreaterThan(WILLPOWER_STIR_SPEED * 80)
    let radial = 0
    let tang = 0
    let hops = 0
    for (const b of stirred) {
      if (b.pinned) continue
      if (b.vz > 40) hops += 1
      const dx = b.x - w.cx
      const dy = b.y - w.cy
      const dist = Math.hypot(dx, dy) || 1
      const nx = dx / dist
      const ny = dy / dist
      const vr = b.vx * nx + b.vy * ny
      const vt = b.vx * -ny + b.vy * nx
      radial += vr * vr
      tang += vt * vt
    }
    expect(tang).toBeGreaterThan(radial * 0.45)
    expect(hops).toBeGreaterThan(20)
  })

  it("pushes overlapping stones apart", () => {
    const bodies = [
      stone({ id: "a", x: 90, y: 40, restX: 70, restY: 40 }),
      stone({ id: "b", x: 92, y: 40, restX: 110, restY: 40 }),
    ]
    const next = stepWillpowerWorld(bodies, worldOf({ stirAge: 99 }), 1 / 60)
    const a = next.find((b) => b.id === "a")!
    const b = next.find((b) => b.id === "b")!
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(Math.hypot(2, 0))
  })

  it("collision bounce reverses approach with glassy restitution", () => {
    const bodies = [
      stone({ id: "a", x: 78, y: 40, vx: 140, restX: 78, restY: 40 }),
      stone({ id: "b", x: 90, y: 40, vx: -140, restX: 90, restY: 40 }),
    ]
    const incoming = 280
    let next = bodies
    const w = worldOf({ stirAge: 99 })
    for (let i = 0; i < 4; i++) next = stepWillpowerWorld(next, w, 1 / 60)
    const a = next.find((b) => b.id === "a")!
    const b = next.find((b) => b.id === "b")!
    const separating = b.vx - a.vx
    expect(separating).toBeGreaterThan(incoming * WILLPOWER_RESTITUTION * 0.28)
    expect(a.vx).toBeLessThan(0)
    expect(b.vx).toBeGreaterThan(0)
  })

  it("lets a mid-plate marble stay put because static friction beats dish gravity", () => {
    const start = stone({ id: "a", x: 90 + 24, y: 60, restX: 90 + 24, restY: 60 })
    let next = [start]
    const w = worldOf({ stirAge: 99 })
    for (let i = 0; i < 50; i++) next = stepWillpowerWorld(next, w, 1 / 60)
    expect(Math.hypot(next[0]!.x - 90, next[0]!.y - 60)).toBeGreaterThan(20)
    expect(kineticEnergy(next)).toBeLessThan(8)
  })

  it("rolls a rim marble inward then stops short of a center huddle", () => {
    const start = stone({ id: "a", x: 90 + 70, y: 60, restX: 90 + 70, restY: 60 })
    let next = [start]
    const w = worldOf({ stirAge: 99 })
    for (let i = 0; i < 240; i++) next = stepWillpowerWorld(next, w, 1 / 60)
    const r = Math.hypot(next[0]!.x - 90, next[0]!.y - 60)
    const freeze = WILLPOWER_FRICTION / WILLPOWER_GRAVITY
    expect(r).toBeLessThan(70)
    expect(r).toBeGreaterThan(freeze - 18)
  })

  it("keeps a crowded stir inside the oval and settled stones spread out", () => {
    const w = worldOf({ stirAge: 0 })
    const orbit = restOrbit(21, w.cx, w.cy, 28)
    const bodies = [
      stone({ id: "crystal", x: w.cx, y: w.cy, r: 18, mass: 40, pinned: true, restX: w.cx, restY: w.cy }),
      ...orbit.map((p, i) => stone({ id: `s${i}`, x: p.x, y: p.y, restX: p.x, restY: p.y })),
    ]
    let next = stirWillpower(bodies, w, w.cx, w.cy, DEFAULT_WILLPOWER_PHYSICS, 5)
    expect(kineticEnergy(next)).toBeGreaterThan(kineticEnergy(bodies))
    for (let i = 0; i < 36; i++) next = stepWillpowerWorld(next, w, 1 / 60)
    const rx = w.rx
    const ry = w.ry
    for (const b of next) {
      if (b.pinned) continue
      const e = ((b.x - w.cx) ** 2) / (rx * rx) + ((b.y - w.cy) ** 2) / (ry * ry)
      expect(e).toBeLessThanOrEqual(b.z > 22 ? 8 : 1.8)
    }
    w.stirAge = 99
    for (let i = 0; i < 220; i++) next = stepWillpowerWorld(next, w, 1 / 60)
    for (const b of next) {
      if (b.pinned) continue
      const e = ((b.x - w.cx) ** 2) / (rx * rx) + ((b.y - w.cy) ** 2) / (ry * ry)
      expect(e).toBeLessThanOrEqual(1.8)
    }
    const rs = radii(next, w.cx, w.cy)
    expect(Math.max(...rs) - Math.min(...rs)).toBeGreaterThan(8)
    expect(rs.filter((r) => r > 14).length).toBeGreaterThan(6)
    const mean = rs.reduce((s, r) => s + r, 0) / rs.length
    expect(mean).toBeGreaterThan(12)
  })

  it("a hop follows bouncing-ball kinematics z = z0 + vz t − ½ g t²", () => {
    const g = DEFAULT_WILLPOWER_PHYSICS.g
    const start = stone({ id: "a", x: 90, y: 60, z: 0, vz: 400, restX: 90, restY: 60 })
    const apex = bouncingBallApex(0, 400, g)
    expect(apex).toBeCloseTo((400 * 400) / (2 * g), 5)
    expect(bouncingBallTimeToApex(400, g)).toBeCloseTo(400 / g, 5)
    const w = worldOf({ stirAge: 99 })
    let next = [start]
    let peak = 0
    for (let i = 0; i < 80; i++) {
      next = stepWillpowerWorld(next, w, 1 / 60)
      peak = Math.max(peak, next[0]!.z)
    }
    expect(peak).toBeGreaterThan(apex * 0.55)
    expect(peak).toBeLessThan(apex * 1.15)
  })

  it("floor bounce reverses vz with coefficient e = −v⁺/v⁻", () => {
    const start = stone({ id: "a", x: 90, y: 60, z: 8, vz: -220, restX: 90, restY: 60, e: 0.8 })
    const w = worldOf({ stirAge: 99 })
    let next = [start]
    let bounced: WillpowerBody | null = null
    for (let i = 0; i < 12; i++) {
      next = stepWillpowerWorld(next, w, 1 / 60)
      if (next[0]!.vz > 0) {
        bounced = next[0]!
        break
      }
    }
    expect(bounced).toBeTruthy()
    expect(bounced!.vz).toBeGreaterThan(80)
    expect(bounced!.squash).toBeGreaterThan(0)
  })

  it("airborne gems pass over neighbors instead of fusing", () => {
    const bodies = [
      stone({ id: "low", x: 90, y: 40, z: 0 }),
      stone({ id: "high", x: 91, y: 40, z: 28, vz: 10 }),
    ]
    const next = stepWillpowerWorld(bodies, worldOf({ stirAge: 99 }), 1 / 60)
    const low = next.find((b) => b.id === "low")!
    const high = next.find((b) => b.id === "high")!
    expect(Math.abs(high.x - 91)).toBeLessThan(4)
    expect(low.z).toBeLessThan(8)
    expect(high.z).toBeGreaterThan(20)
  })

  it("editing g changes the predicted apex", () => {
    const low = bouncingBallApex(0, 300, 400)
    const highG = bouncingBallApex(0, 300, 1200)
    expect(low).toBeGreaterThan(highG * 2)
    const arc = predictedArc(0, 300, 820)
    expect(arc.length).toBeGreaterThan(8)
    expect(arc[0]!.z).toBe(0)
    expect(Math.max(...arc.map((p) => p.z))).toBeGreaterThan(10)
    expect(bouncingBallTimeToFloor(12, 0, 820)).toBeGreaterThan(0.1)
    expect(bouncingBallTimeToFloor(0, -10, 820)).toBe(0)
    expect(dishPeriod(1.18)).toBeGreaterThan(5)
    expect(dishPeriod(1.18)).toBeLessThan(7)
  })

  it("heavier mass and lower e are sanitizable lab knobs", () => {
    const raw = sanitizeWillpowerPhysics({ g: 9999, restitution: -2, mass: 0.01, chaos: 4 })
    expect(raw.g).toBe(1600)
    expect(raw.restitution).toBe(0.15)
    expect(raw.mass).toBe(0.35)
    expect(raw.chaos).toBe(1)
    const a = gemVariation("drink:2026-09-21", DEFAULT_WILLPOWER_PHYSICS)
    const b = gemVariation("other:2026-09-21", DEFAULT_WILLPOWER_PHYSICS)
    expect(a.mass).not.toBe(b.mass)
  })

  it("a crowded stir stays live mid-air instead of freezing as a puck", () => {
    const w = worldOf({ stirAge: 0, seed: 4 })
    const orbit = restOrbit(36, w.cx, w.cy, 30)
    const bodies = [
      makeWillpowerCrystal(w),
      ...orbit.map((p, i) => makeWillpowerGem(`s${i}`, p.x, p.y, w, DEFAULT_WILLPOWER_PHYSICS)),
    ]
    let next = stirWillpower(bodies, w, w.cx, w.cy, DEFAULT_WILLPOWER_PHYSICS, 8)
    for (let i = 0; i < 24; i++) next = stepWillpowerWorld(next, w, 1 / 60)
    expect(worldIsLive(next)).toBe(true)
    expect(next.filter((b) => !b.pinned && b.z > 1).length).toBeGreaterThan(4)
  })

  it("paints stones with smaller Y behind the crystal", () => {
    expect(stoneIsBehindCrystal(30, 60)).toBe(true)
    expect(stoneIsBehindCrystal(80, 60)).toBe(false)
    const painted = sortWillpowerPaintOrder([
      stone({ id: "front", x: 90, y: 90 }),
      stone({ id: "crystal", x: 90, y: 60, pinned: true }),
      stone({ id: "back", x: 90, y: 20 }),
    ])
    expect(painted.map((b) => b.id)).toEqual(["back", "crystal", "front"])
  })

  it("a held gem follows the pointer and throws with that velocity", () => {
    const start = stone({ id: "a", x: 90, y: 60, restX: 90, restY: 60 })
    const grabbed = grabWillpowerGem([start], "a")
    expect(grabbed[0]!.held).toBe(true)
    expect(grabbed[0]!.z).toBeGreaterThan(0)
    const dragged = dragWillpowerGem(grabbed, "a", 130, 40, 200, -80)
    expect(dragged[0]!.x).toBe(130)
    expect(dragged[0]!.y).toBe(40)
    const stepped = stepWillpowerWorld(dragged, worldOf({ stirAge: 99 }), 1 / 60)
    expect(stepped[0]!.x).toBeCloseTo(130, 0)
    expect(stepped[0]!.held).toBe(true)
    const thrown = releaseWillpowerGem(stepped, "a", 200, -80)
    expect(thrown[0]!.held).toBe(false)
    expect(thrown[0]!.vx).toBe(200)
    expect(thrown[0]!.vz).toBeGreaterThan(0)
  })

  it("lifts a grabbed gem in z when the pointer is above the dish", () => {
    const start = stone({ id: "a", x: 90, y: 60, restX: 90, restY: 60 })
    const grabbed = grabWillpowerGem([start], "a")
    const pose = poseWillpowerGrab(60, 90, -40)
    expect(pose.y).toBe(60)
    expect(pose.z).toBeGreaterThan(WILLPOWER_HELD_Z)
    expect(pose.z).toBeLessThanOrEqual(WILLPOWER_MAX_Z)
    expect(pose.z).toBeCloseTo((60 - -40) / WILLPOWER_PERSPECTIVE, 5)
    const dragged = dragWillpowerGem(grabbed, "a", pose.x, pose.y, 0, 0, pose.z, 80)
    expect(dragged[0]!.z).toBeCloseTo(pose.z, 5)
    expect(dragged[0]!.y).toBe(60)
    const thrown = releaseWillpowerGem(dragged, "a", 12, 0, 0)
    expect(thrown[0]!.held).toBe(false)
    expect(thrown[0]!.z).toBeCloseTo(pose.z, 5)
    expect(thrown[0]!.vz).toBe(0)
  })

  it("does not snap an airborne gem back to the oval mid-flight", () => {
    const w = worldOf({ stirAge: 99 })
    const startX = w.cx + w.rx * 2.2
    const gem = stone({
      id: "a",
      x: startX,
      y: w.cy,
      z: 220,
      vz: 0,
      r: 6,
      restX: w.cx + 40,
      restY: w.cy,
    })
    const next = stepWillpowerWorld([makeWillpowerCrystal(w), gem], w, 1 / 60)
    const a = next.find((b) => b.id === "a")!
    expect(a.z).toBeGreaterThan(100)
    expect(Math.abs(a.x - startX)).toBeLessThan(30)
    const e = ((a.x - w.cx) ** 2) / (w.rx * w.rx) + ((a.y - w.cy) ** 2) / (w.ry * w.ry)
    expect(e).toBeGreaterThan(1.4)
  })

  it("hit-tests the frontmost gem under a point", () => {
    const a = stone({ id: "a", x: 90, y: 40, r: 6 })
    const b = stone({ id: "b", x: 92, y: 70, r: 6 })
    expect(hitWillpowerGem([a, b], 92, 70)?.id).toBe("b")
    expect(hitWillpowerGem([a, b], 10, 10)).toBeNull()
  })

  it("maps a lab-plate point back onto the sim plate", () => {
    const sim = worldOf()
    const view = worldOf({ cx: 140, cy: 90, rx: 120, ry: 78, scale: 1.5 })
    const p = mapWillpowerPoint(sim.cx, sim.cy, sim, view)
    expect(p.x).toBeCloseTo(view.cx, 5)
    expect(p.y).toBeCloseTo(view.cy, 5)
    const back = mapWillpowerPoint(p.x, p.y, view, sim)
    expect(back.x).toBeCloseTo(sim.cx, 5)
    const shown = viewWillpowerBody(stone({ id: "a", x: sim.cx, y: sim.cy }), sim, view)
    expect(shown.x).toBeCloseTo(view.cx, 5)
    expect(shown.r).toBeGreaterThan(6)
  })

  it("keeps rest-orbit stones outside a crystal hole even when the hole is larger than the dish radius", () => {
    const hole = 36
    const pts = restOrbit(10, 90, 60, 28, hole)
    expect(pts).toHaveLength(10)
    for (const p of pts) {
      expect(Math.hypot(p.x - 90, p.y - 60)).toBeGreaterThanOrEqual(hole - 0.01)
    }
  })

  it("treats the crystal as a solid so gems cannot tunnel through", () => {
    const w = worldOf({ stirAge: 99 })
    const crystal = makeWillpowerCrystal(w)
    const gem = stone({
      id: "a",
      x: w.cx + 3,
      y: w.cy + 2,
      r: 6,
      restX: w.cx + 50,
      restY: w.cy,
    })
    let next = [crystal, gem]
    for (let i = 0; i < 10; i++) next = stepWillpowerWorld(next, w, 1 / 60)
    const a = next.find((b) => b.id === "a")!
    const c = next.find((b) => b.pinned)!
    expect(Math.hypot(a.x - c.x, a.y - c.y)).toBeGreaterThanOrEqual(c.r + a.r - 0.6)
    expect(c.x).toBeCloseTo(w.cx, 5)
    expect(c.y).toBeCloseTo(w.cy, 5)
  })

  it("keeps a thrown gem outside the crystal core after it hits", () => {
    const w = worldOf({ stirAge: 99 })
    const crystal = makeWillpowerCrystal(w)
    const gem = stone({
      id: "a",
      x: w.cx + crystal.r + 10,
      y: w.cy,
      vx: -420,
      r: 6,
      restX: w.cx + 60,
      restY: w.cy,
    })
    let next = [crystal, gem]
    for (let i = 0; i < 40; i++) next = stepWillpowerWorld(next, w, 1 / 60)
    const a = next.find((b) => b.id === "a")!
    expect(Math.hypot(a.x - crystal.x, a.y - crystal.y)).toBeGreaterThanOrEqual(crystal.r + a.r - 0.8)
    expect(WILLPOWER_CRYSTAL_RADIUS).toBeGreaterThan(20)
  })
})
