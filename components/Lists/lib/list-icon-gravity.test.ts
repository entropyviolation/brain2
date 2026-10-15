import { afterEach, describe, expect, it } from "vitest"
import {
  beginGravitySettle,
  buildGravityEdges,
  capGravityEdges,
  clearAllGravitySnapshots,
  clearGravitySnapshot,
  DEFAULT_GRAVITY_FIELD_PARAMS,
  dragGravityBody,
  edgeRestLength,
  grabGravityBody,
  gravityBodiesToIconPositions,
  gravityIsLargeN,
  gravityIsSettled,
  gravityMaxSpeed,
  GRAVITY_SIM,
  GRAVITY_WEIGHT,
  makeGravityBodies,
  nodeMass,
  pairConnectionWeight,
  peekGravitySnapshot,
  releaseGravityBody,
  restoreGravitySnapshot,
  sanitizeGravityFieldParams,
  settleGravityField,
  settleGravityFieldSlice,
  settleGravityReduced,
  stepGravity,
  stirGravityField,
  takeGravitySnapshot,
  tasksToGravityItems,
  type GravityItem,
} from "@/components/Lists/lib/list-icon-gravity"
import type { IconPos } from "@/components/Lists/lib/velvet-icon-grid"

afterEach(() => {
  clearAllGravitySnapshots()
})

function item(partial: GravityItem): GravityItem {
  return partial
}

describe("list-icon-gravity weight model", () => {
  it("scores shared tags and explicit links", () => {
    const a = item({
      id: "a",
      tags: ["Focus", "work"],
      links: [{ id: "l1", relation: "supports", targetId: "b", weight: 1 }],
    })
    const b = item({
      id: "b",
      tags: ["focus", "home"],
    })
    const w = pairConnectionWeight(a, b)
    expect(w).toBeGreaterThan(GRAVITY_WEIGHT.LINK)
    expect(w).toBeGreaterThanOrEqual(GRAVITY_WEIGHT.LINK + GRAVITY_WEIGHT.TAG)
    expect(w).toBeLessThanOrEqual(GRAVITY_WEIGHT.MAX_EDGE)
  })

  it("treats dependencies and parent/child as structural weight", () => {
    const parent = item({ id: "p", dependencies: [] })
    const child = item({ id: "c", parentTaskId: "p", dependencies: ["p"] })
    const w = pairConnectionWeight(parent, child)
    expect(w).toBeGreaterThanOrEqual(GRAVITY_WEIGHT.PARENT + GRAVITY_WEIGHT.DEPENDENCY)
  })

  it("returns zero for unrelated isolates", () => {
    expect(pairConnectionWeight(item({ id: "a" }), item({ id: "b" }))).toBe(0)
  })

  it("builds undirected edges and heavier mass for hubs", () => {
    const items = [
      item({ id: "hub", links: [{ id: "1", relation: "related", targetId: "a" }] }),
      item({ id: "a", tags: ["x"] }),
      item({ id: "b", tags: ["x"] }),
      item({ id: "lone" }),
    ]
    // Also link hub↔a already; a↔b via tag.
    items[1] = item({
      id: "a",
      tags: ["x"],
      links: [{ id: "2", relation: "related", targetId: "hub" }],
    })
    const edges = buildGravityEdges(items)
    expect(edges.some((e) => (e.a === "hub" || e.b === "hub") && (e.a === "a" || e.b === "a"))).toBe(
      true,
    )
    expect(edges.some((e) => (e.a === "a" || e.b === "a") && (e.a === "b" || e.b === "b"))).toBe(true)
    expect(edges.every((e) => e.a !== "lone" && e.b !== "lone")).toBe(true)
    expect(nodeMass("hub", edges)).toBeGreaterThan(nodeMass("lone", edges))
  })

  it("counts shared list membership", () => {
    const w = pairConnectionWeight(
      item({ id: "a", lists: ["list-1", "list-2"] }),
      item({ id: "b", lists: ["list-2", "list-3"] }),
    )
    expect(w).toBe(GRAVITY_WEIGHT.SHARED_LIST)
  })

  it("defaults match GRAVITY_WEIGHT and ignore zeroed tag gain", () => {
    expect(DEFAULT_GRAVITY_FIELD_PARAMS.globalG).toBe(1)
    expect(DEFAULT_GRAVITY_FIELD_PARAMS.sources.link).toBe(GRAVITY_WEIGHT.LINK)
    expect(DEFAULT_GRAVITY_FIELD_PARAMS.sources.tag).toBe(GRAVITY_WEIGHT.TAG)
    const a = item({ id: "a", tags: ["focus"] })
    const b = item({ id: "b", tags: ["focus"] })
    expect(pairConnectionWeight(a, b)).toBe(GRAVITY_WEIGHT.TAG)
    expect(
      pairConnectionWeight(a, b, { ...DEFAULT_GRAVITY_FIELD_PARAMS.sources, tag: 0 }),
    ).toBe(0)
    const linked = pairConnectionWeight(
      item({ id: "a", links: [{ id: "1", relation: "related", targetId: "b" }] }),
      item({ id: "b" }),
      { ...DEFAULT_GRAVITY_FIELD_PARAMS.sources, tag: 0 },
    )
    expect(linked).toBe(GRAVITY_WEIGHT.LINK)
  })

  it("sanitizeGravityFieldParams heals partial blobs", () => {
    const healed = sanitizeGravityFieldParams({ globalG: 9, sources: { tag: -1 } })
    expect(healed.globalG).toBe(2.5)
    expect(healed.sources.tag).toBe(0)
    expect(healed.sources.link).toBe(GRAVITY_WEIGHT.LINK)
  })
})

describe("list-icon-gravity snapshot reset", () => {
  it("restores the pre-sim freeform snapshot", () => {
    const location = "items:list-1"
    const before: Record<string, IconPos> = {
      a: { x: 10, y: 20 },
      b: { x: 200, y: 40 },
    }
    takeGravitySnapshot(location, before)
    before.a = { x: 99, y: 99 }
    const restored = restoreGravitySnapshot(location)
    expect(restored).toEqual({
      a: { x: 10, y: 20 },
      b: { x: 200, y: 40 },
    })
    expect(peekGravitySnapshot(location)?.a).toEqual({ x: 10, y: 20 })
    clearGravitySnapshot(location)
    expect(restoreGravitySnapshot(location)).toBeNull()
  })
})

describe("list-icon-gravity stepper", () => {
  it("pulls linked icons closer over a few steps", () => {
    const items = tasksToGravityItems([
      {
        id: "a",
        links: [{ id: "l", relation: "related", targetId: "b" }],
      },
      { id: "b" },
    ])
    const edges = buildGravityEdges(items)
    const positions = {
      a: { x: 20, y: 40 },
      b: { x: 420, y: 40 },
    }
    let bodies = makeGravityBodies(["a", "b"], positions, edges)
    const start = Math.hypot(bodies[0]!.x - bodies[1]!.x, bodies[0]!.y - bodies[1]!.y)
    const bounds = { width: 640, height: 480 }
    for (let i = 0; i < 90; i++) {
      bodies = stepGravity(bodies, edges, 1 / 60, bounds)
    }
    const end = Math.hypot(bodies[0]!.x - bodies[1]!.x, bodies[0]!.y - bodies[1]!.y)
    expect(end).toBeLessThan(start)
    const iconPos = gravityBodiesToIconPositions(bodies)
    expect(iconPos.a).toBeDefined()
    expect(iconPos.b).toBeDefined()
  })

  it("globalG=1 matches default step; globalG=0 disables spring pull", () => {
    const edges = buildGravityEdges([
      item({ id: "a", links: [{ id: "1", relation: "related", targetId: "b" }] }),
      item({ id: "b" }),
    ])
    const positions = { a: { x: 20, y: 40 }, b: { x: 420, y: 40 } }
    const bounds = { width: 640, height: 480 }
    let a = makeGravityBodies(["a", "b"], positions, edges)
    let b = makeGravityBodies(["a", "b"], positions, edges)
    for (let i = 0; i < 40; i++) {
      a = stepGravity(a, edges, 1 / 60, bounds, { globalG: 1 })
      b = stepGravity(b, edges, 1 / 60, bounds)
    }
    expect(a[0]!.x).toBeCloseTo(b[0]!.x, 5)
    expect(a[1]!.x).toBeCloseTo(b[1]!.x, 5)

    // reducedMotion = no swirl; G=0 kills springs/attract so pairs stay farther
    // than a full-G pull over the same steps.
    let zero = makeGravityBodies(["a", "b"], positions, edges)
    let full = makeGravityBodies(["a", "b"], positions, edges)
    for (let i = 0; i < 60; i++) {
      zero = stepGravity(zero, edges, 1 / 60, bounds, { globalG: 0, reducedMotion: true })
      full = stepGravity(full, edges, 1 / 60, bounds, { globalG: 1, reducedMotion: true })
    }
    const distZero = Math.hypot(zero[0]!.x - zero[1]!.x, zero[0]!.y - zero[1]!.y)
    const distFull = Math.hypot(full[0]!.x - full[1]!.x, full[0]!.y - full[1]!.y)
    expect(distFull).toBeLessThan(distZero)
  })

  it("reduced-motion settle zeroes velocity", () => {
    const edges = buildGravityEdges([
      item({ id: "a", tags: ["t"] }),
      item({ id: "b", tags: ["t"] }),
    ])
    let bodies = makeGravityBodies(
      ["a", "b"],
      { a: { x: 0, y: 0 }, b: { x: 300, y: 0 } },
      edges,
    )
    bodies = settleGravityReduced(bodies, edges, { width: 500, height: 400 })
    expect(gravityIsSettled(bodies)).toBe(true)
    expect(bodies.every((b) => b.vx === 0 && b.vy === 0)).toBe(true)
  })

  it("settleGravityField fast-forwards to stable without held bodies", () => {
    const edges = buildGravityEdges([
      item({ id: "a", links: [{ id: "1", relation: "related", targetId: "b" }] }),
      item({ id: "b" }),
      item({ id: "c", tags: ["shared"] }),
      item({ id: "d", tags: ["shared"] }),
    ])
    let bodies = makeGravityBodies(
      ["a", "b", "c", "d"],
      {
        a: { x: 10, y: 10 },
        b: { x: 480, y: 20 },
        c: { x: 30, y: 360 },
        d: { x: 450, y: 340 },
      },
      edges,
    )
    bodies = grabGravityBody(bodies, "a")
    const before = Math.hypot(bodies[0]!.x - bodies[1]!.x, bodies[0]!.y - bodies[1]!.y)
    bodies = settleGravityField(bodies, edges, { width: 520, height: 420 })
    expect(bodies.every((b) => !b.held)).toBe(true)
    expect(gravityIsSettled(bodies)).toBe(true)
    expect(gravityMaxSpeed(bodies)).toBe(0)
    expect(bodies.every((b) => b.vx === 0 && b.vy === 0)).toBe(true)
    const after = Math.hypot(bodies[0]!.x - bodies[1]!.x, bodies[0]!.y - bodies[1]!.y)
    expect(after).toBeLessThan(before)
  })

  it("idle swirl re-energizes a zeroed field (Skip must freeze the rAF stepper)", () => {
    const edges = buildGravityEdges([
      item({ id: "a", links: [{ id: "1", relation: "related", targetId: "b" }] }),
      item({ id: "b" }),
    ])
    let bodies = makeGravityBodies(
      ["a", "b"],
      { a: { x: 40, y: 80 }, b: { x: 400, y: 90 } },
      edges,
    )
    bodies = settleGravityField(bodies, edges, { width: 520, height: 400 })
    expect(gravityMaxSpeed(bodies)).toBe(0)
    // Same path the living field used after Skip before freeze — idle swirl ≠ 0.
    bodies = stepGravity(bodies, edges, 1 / 30, { width: 520, height: 400 }, { idle: true })
    expect(gravityMaxSpeed(bodies)).toBeGreaterThan(0.5)
  })

  it("post-settle pose stays nearly still under further reduced-motion steps", () => {
    const edges = buildGravityEdges([
      item({ id: "a", tags: ["cluster"] }),
      item({ id: "b", tags: ["cluster"] }),
      item({ id: "c", tags: ["cluster"] }),
      item({ id: "d", links: [{ id: "1", relation: "related", targetId: "a" }] }),
      item({ id: "e" }),
    ])
    const bounds = { width: 640, height: 480 }
    let bodies = makeGravityBodies(
      ["a", "b", "c", "d", "e"],
      {
        a: { x: 20, y: 20 },
        b: { x: 500, y: 40 },
        c: { x: 80, y: 400 },
        d: { x: 480, y: 380 },
        e: { x: 260, y: 200 },
      },
      edges,
    )
    bodies = settleGravityField(bodies, edges, bounds)
    expect(gravityMaxSpeed(bodies)).toBe(0)
    const snap = bodies.map((b) => ({ id: b.id, x: b.x, y: b.y }))
    for (let i = 0; i < 40; i++) {
      bodies = stepGravity(bodies, edges, GRAVITY_SIM.REDUCED_DT, bounds, { reducedMotion: true })
    }
    // Residual spring micro-motion may exist; Skip freezes so the user never sees it.
    for (const before of snap) {
      const after = bodies.find((b) => b.id === before.id)!
      expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(4)
    }
  })

  it("keeps a held body kinematic while neighbors still move", () => {
    const edges = buildGravityEdges([
      item({ id: "a", links: [{ id: "1", relation: "related", targetId: "b" }] }),
      item({ id: "b" }),
      item({ id: "c", tags: ["x"] }),
      item({ id: "d", tags: ["x"] }),
    ])
    let bodies = makeGravityBodies(
      ["a", "b", "c", "d"],
      {
        a: { x: 40, y: 40 },
        b: { x: 400, y: 40 },
        c: { x: 40, y: 300 },
        d: { x: 400, y: 300 },
      },
      edges,
    )
    bodies = grabGravityBody(bodies, "a")
    bodies = dragGravityBody(bodies, "a", 200, 200, 0, 0)
    const heldX = bodies.find((b) => b.id === "a")!.x
    for (let i = 0; i < 40; i++) {
      bodies = stepGravity(bodies, edges, 1 / 60, { width: 640, height: 480 })
    }
    expect(bodies.find((b) => b.id === "a")!.x).toBe(heldX)
    expect(bodies.find((b) => b.id === "a")!.held).toBe(true)
    const b = bodies.find((body) => body.id === "b")!
    expect(Math.hypot(b.vx, b.vy) + Math.abs(b.x - 400)).toBeGreaterThan(0)
  })

  it("release throws with capped impulse; stir kicks the field", () => {
    let bodies = makeGravityBodies(
      ["a", "b"],
      { a: { x: 100, y: 100 }, b: { x: 140, y: 100 } },
      [],
    )
    bodies = grabGravityBody(bodies, "a")
    bodies = releaseGravityBody(bodies, "a", 5000, 0)
    expect(bodies.find((b) => b.id === "a")!.held).toBe(false)
    expect(Math.abs(bodies.find((b) => b.id === "a")!.vx)).toBeLessThanOrEqual(
      GRAVITY_SIM.THROW_MAX * GRAVITY_SIM.THROW_GAIN + 1,
    )
    bodies = stirGravityField(bodies, 120, 100, 42)
    expect(bodies.some((b) => Math.hypot(b.vx, b.vy) > 10)).toBe(true)
  })

  it("heavier edges rest closer", () => {
    expect(edgeRestLength(3.5)).toBeLessThan(edgeRestLength(0.3))
  })
})

describe("list-icon-gravity large-N + Skip settings", () => {
  it("time-sliced settle reaches done with per-slice step caps", () => {
    const edges = buildGravityEdges([
      item({ id: "a", links: [{ id: "1", relation: "related", targetId: "b" }] }),
      item({ id: "b" }),
      item({ id: "c", tags: ["t"] }),
      item({ id: "d", tags: ["t"] }),
    ])
    const bodies = makeGravityBodies(
      ["a", "b", "c", "d"],
      {
        a: { x: 10, y: 10 },
        b: { x: 480, y: 20 },
        c: { x: 30, y: 360 },
        d: { x: 450, y: 340 },
      },
      edges,
    )
    let progress = beginGravitySettle(bodies)
    let slices = 0
    while (!progress.done && slices < 400) {
      const before = progress.stepsDone
      progress = settleGravityFieldSlice(progress, edges, { width: 520, height: 420 }, {
        globalG: 1.25,
        maxStepsThisSlice: GRAVITY_SIM.SETTLE_SLICE_STEPS,
        timeBudgetMs: Number.POSITIVE_INFINITY,
      })
      expect(progress.stepsDone - before).toBeLessThanOrEqual(GRAVITY_SIM.SETTLE_SLICE_STEPS)
      slices += 1
    }
    expect(progress.done).toBe(true)
    expect(gravityMaxSpeed(progress.bodies)).toBe(0)
    expect(slices).toBeGreaterThan(1)
  })

  it("Skip settle / step path applies current globalG to spring forces", () => {
    const edges = buildGravityEdges([
      item({ id: "a", links: [{ id: "1", relation: "related", targetId: "b" }] }),
      item({ id: "b" }),
    ])
    const seed = {
      a: { x: 20, y: 200 },
      b: { x: 500, y: 200 },
    }
    const bounds = { width: 540, height: 400 }
    const base = makeGravityBodies(["a", "b"], seed, edges)
    const after0 = stepGravity(base, edges, GRAVITY_SIM.REDUCED_DT, bounds, {
      reducedMotion: true,
      globalG: 0,
    })
    const after1 = stepGravity(base, edges, GRAVITY_SIM.REDUCED_DT, bounds, {
      reducedMotion: true,
      globalG: 1.5,
    })
    // Stretched link: springs × G accelerate harder when G > 0.
    expect(gravityMaxSpeed(after1)).toBeGreaterThan(gravityMaxSpeed(after0) + 5)

    const settled0 = settleGravityField(base, edges, bounds, { globalG: 0 })
    const settled1 = settleGravityField(base, edges, bounds, { globalG: 1.5 })
    const dist = (bodies: typeof settled0) =>
      Math.hypot(bodies[0]!.x - bodies[1]!.x, bodies[0]!.y - bodies[1]!.y)
    // Different G → different Skip pose (not hardcoded defaults).
    expect(Math.abs(dist(settled1) - dist(settled0))).toBeGreaterThan(8)
  })

  it("Skip settle with stronger link gain pulls closer than weak link gain", () => {
    const items = [
      item({ id: "a", links: [{ id: "1", relation: "related", targetId: "b" }] }),
      item({ id: "b" }),
    ]
    const weak = buildGravityEdges(items, { ...DEFAULT_GRAVITY_FIELD_PARAMS.sources, link: 0.2 })
    const strong = buildGravityEdges(items, { ...DEFAULT_GRAVITY_FIELD_PARAMS.sources, link: 2 })
    expect(strong[0]!.weight).toBeGreaterThan(weak[0]!.weight)
    const seed = { a: { x: 30, y: 180 }, b: { x: 490, y: 180 } }
    const bounds = { width: 540, height: 400 }
    const weakPose = settleGravityField(
      makeGravityBodies(["a", "b"], seed, weak),
      weak,
      bounds,
      { globalG: 1 },
    )
    const strongPose = settleGravityField(
      makeGravityBodies(["a", "b"], seed, strong),
      strong,
      bounds,
      { globalG: 1 },
    )
    const dist = (bodies: typeof weakPose) =>
      Math.hypot(bodies[0]!.x - bodies[1]!.x, bodies[0]!.y - bodies[1]!.y)
    expect(dist(strongPose)).toBeLessThan(dist(weakPose))
  })

  it("capGravityEdges keeps the heaviest springs", () => {
    const edges = [
      { a: "a", b: "b", weight: 0.2 },
      { a: "a", b: "c", weight: 3 },
      { a: "b", b: "c", weight: 1.1 },
    ]
    const capped = capGravityEdges(edges, 2)
    expect(capped).toHaveLength(2)
    expect(capped.map((e) => e.weight).sort((x, y) => y - x)).toEqual([3, 1.1])
  })

  it("large-N edge build stays under a click-path budget", () => {
    const items: GravityItem[] = Array.from({ length: 220 }, (_, i) =>
      item({
        id: `t${i}`,
        tags: i % 7 === 0 ? ["hub"] : i % 3 === 0 ? ["leaf"] : undefined,
        links:
          i > 0 && i % 11 === 0
            ? [{ id: `l${i}`, relation: "related", targetId: `t${i - 1}` }]
            : undefined,
      }),
    )
    const started = performance.now()
    const edges = buildGravityEdges(items, DEFAULT_GRAVITY_FIELD_PARAMS.sources)
    const elapsed = performance.now() - started
    expect(edges.length).toBeLessThanOrEqual(GRAVITY_SIM.MAX_EDGES)
    expect(elapsed).toBeLessThan(80)
    expect(gravityIsLargeN(items.length)).toBe(true)
  })

  it("large-N settle slice budget yields before burning the frame", () => {
    const ids = Array.from({ length: 120 }, (_, i) => `n${i}`)
    const items = ids.map((id, i) =>
      item({
        id,
        tags: ["room"],
        links:
          i > 0 ? [{ id: `l${i}`, relation: "related", targetId: ids[i - 1]! }] : undefined,
      }),
    )
    const edges = buildGravityEdges(items)
    const positions = Object.fromEntries(
      ids.map((id, i) => [id, { x: (i % 12) * 40, y: Math.floor(i / 12) * 40 }]),
    )
    const bodies = makeGravityBodies(ids, positions, edges)
    let progress = beginGravitySettle(bodies, { maxSteps: 40 })
    const t0 = performance.now()
    progress = settleGravityFieldSlice(progress, edges, { width: 800, height: 700 }, {
      globalG: 1,
      maxStepsThisSlice: GRAVITY_SIM.SETTLE_SLICE_STEPS,
      timeBudgetMs: GRAVITY_SIM.SETTLE_SLICE_MS,
    })
    const elapsed = performance.now() - t0
    expect(progress.done).toBe(false)
    expect(progress.stepsDone).toBeGreaterThan(0)
    expect(progress.stepsDone).toBeLessThanOrEqual(GRAVITY_SIM.SETTLE_SLICE_STEPS)
    // Soft guard — slice must not look like a multi-second sync settle.
    expect(elapsed).toBeLessThan(40)
  })
})
