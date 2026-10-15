import { describe, expect, it } from "vitest"
import { VELVET_ICON_BOX, VELVET_ICON_CELL } from "@/components/Lists/lib/velvet-icon-grid"
import {
  accumulateIconPile,
  applyPileContainer,
  compactHeapPositions,
  finalizeIconPile,
  listIconPileContainerHeight,
  listIconPlayfield,
  listIconZoomScale,
  listItemsIconLocation,
  LIST_ICON_PILE_FIXED_DT,
  LIST_ICON_PILE_FLOOR_FRICTION,
  LIST_ICON_PILE_FLOOR_REST,
  LIST_ICON_PILE_INTERACT_MS,
  LIST_ICON_PILE_MAX_MS,
  LIST_ICON_PILE_MAX_STEPS,
  LIST_ICON_PILE_PAINT_MS,
  LIST_ICON_PILE_PHYSICS,
  LIST_ICON_PILE_RADIUS,
  LIST_ICON_PILE_THROW_MAX,
  makePileBodies,
  makePileBodiesFromPositions,
  makePileWorld,
  pileBodiesToIconPositions,
  pileClearMotionAfterCommit,
  pileClampThrow,
  pileContainer,
  pileContainerNeedsReshape,
  pileDragBody,
  pileFloorY,
  pileGrabBody,
  pileHitTest,
  pileIsSettled,
  pileRadiusForCount,
  pileThrowBody,
  solveIconPile,
  stepIconPile,
} from "@/components/Lists/lib/list-icon-pile"

describe("list icon pile playfield", () => {
  it("sizes the playfield from the velvet cell", () => {
    const width = 16 + 112 * 3 + 50
    const field = listIconPlayfield(width, 7)
    expect(field.cols).toBe(3)
    expect(field.rows).toBe(3)
    expect(field.playfieldHeight).toBe(3 * VELVET_ICON_CELL.h + VELVET_ICON_CELL.pad * 2)
  })

  it("zooms out only when the playfield is taller than the viewport", () => {
    expect(listIconZoomScale(400, 800)).toBe(0.5)
    expect(listIconZoomScale(900, 400)).toBe(1)
    expect(listIconZoomScale(0, 400)).toBe(1)
  })

  it("gives small lists a taller bounce container than one auto-organize row", () => {
    const width = 640
    const oneRow = listIconPlayfield(width, 3).playfieldHeight
    const boxH = listIconPileContainerHeight(width, 3)
    expect(oneRow).toBe(VELVET_ICON_CELL.h + VELVET_ICON_CELL.pad * 2)
    expect(boxH).toBeGreaterThan(oneRow)
    expect(boxH).toBe(VELVET_ICON_CELL.h * 3 + VELVET_ICON_CELL.pad * 2)
  })

  it("pins the pile floor to the velvet viewport when viewport exceeds pack height", () => {
    const width = 640
    const pack = listIconPlayfield(width, 3).playfieldHeight
    const viewport = 640
    const boxH = listIconPileContainerHeight(width, 3, viewport)
    expect(pack).toBeLessThan(viewport)
    expect(boxH).toBe(viewport)
    const box = pileContainer(width, boxH)
    expect(box.floorY).toBeGreaterThan(viewport - LIST_ICON_PILE_RADIUS - VELVET_ICON_BOX.h)
    expect(box.height).toBe(viewport)
  })

  it("keeps a tall auto-organize playfield when it exceeds the viewport", () => {
    const width = 640
    const many = 80
    const pack = listIconPlayfield(width, many).playfieldHeight
    const viewport = 400
    expect(pack).toBeGreaterThan(viewport)
    expect(listIconPileContainerHeight(width, many, viewport)).toBe(pack)
  })
})

describe("pile position readback", () => {
  it("maps a settled body center to unscaled icon top-left", () => {
    const pos = pileBodiesToIconPositions([{ id: "task-1", x: 100, y: 200 }])
    expect(pos["task-1"]).toEqual({
      x: 100 - VELVET_ICON_BOX.w / 2,
      y: 200 - VELVET_ICON_BOX.h / 2,
    })
  })

  it("heaps orbs on the floor in canvas coordinates, not zoomed pixels", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h"]
    const width = 640
    const { playfieldHeight } = listIconPlayfield(width, ids.length)
    const positions = solveIconPile(ids, width, playfieldHeight)
    const floor = pileFloorY(playfieldHeight)
    const centers = ids.map((id) => {
      const pos = positions[id]
      expect(pos).toBeTruthy()
      return {
        id,
        x: pos!.x + VELVET_ICON_BOX.w / 2,
        y: pos!.y + VELVET_ICON_BOX.h / 2,
      }
    })
    for (const center of centers) {
      expect(center.x).toBeGreaterThanOrEqual(0)
      expect(center.x).toBeLessThanOrEqual(width)
      expect(center.y).toBeGreaterThan(playfieldHeight * 0.35)
      expect(center.y).toBeLessThanOrEqual(floor + 1)
    }
    const lowest = Math.max(...centers.map((center) => center.y))
    expect(lowest).toBeGreaterThan(floor - 40)
    for (let i = 0; i < centers.length; i++) {
      for (let j = i + 1; j < centers.length; j++) {
        const dist = Math.hypot(centers[i]!.x - centers[j]!.x, centers[i]!.y - centers[j]!.y)
        expect(dist).toBeGreaterThan(50)
      }
    }
    const zoom = listIconZoomScale(180, playfieldHeight)
    expect(zoom).toBeLessThan(1)
    expect(positions.a!.y).toBeGreaterThan(180 * zoom)
  })

  it("settles bodies near floorY when the velvet viewport is taller than the pack", () => {
    const ids = ["a", "b", "c", "d", "e", "f"]
    const width = 640
    const viewport = 720
    const height = listIconPileContainerHeight(width, ids.length, viewport)
    expect(height).toBe(viewport)
    const radius = pileRadiusForCount(ids.length)
    const box = pileContainer(width, height, radius)
    const positions = solveIconPile(ids, width, height)
    const centers = ids.map((id) => {
      const pos = positions[id]!
      return {
        x: pos.x + VELVET_ICON_BOX.w / 2,
        y: pos.y + VELVET_ICON_BOX.h / 2,
      }
    })
    const lowest = Math.max(...centers.map((c) => c.y))
    expect(box.floorY).toBeCloseTo(height - Math.min(Math.max(radius, VELVET_ICON_BOX.h / 2), height / 2), 5)
    expect(lowest).toBeGreaterThan(box.floorY - radius * 1.2)
    expect(lowest).toBeLessThanOrEqual(box.floorY + 1)
    // No mid-air shelf: heap is in the bottom band of the velvet box.
    expect(lowest).toBeGreaterThan(height * 0.7)
  })
})

describe("list item icon location", () => {
  it("does not collide with a folder location key", () => {
    const folderKey = "home:list-abc"
    const itemKey = `${listItemsIconLocation("list-abc")}:task-1`
    expect(itemKey).toBe("items:list-abc:task-1")
    expect(itemKey).not.toBe(folderKey)
    expect(itemKey.startsWith("items:")).toBe(true)
    expect(folderKey.startsWith("items:")).toBe(false)
  })
})

describe("pile frame budget", () => {
  it("keeps paint and duration caps in the willpower stage range", () => {
    // 0 = paint every frame during flight (DOM path); duration still capped.
    expect(LIST_ICON_PILE_PAINT_MS).toBe(0)
    expect(LIST_ICON_PILE_MAX_MS).toBeLessThanOrEqual(6000)
    expect(LIST_ICON_PILE_MAX_MS).toBeGreaterThanOrEqual(4000)
  })

  it("shrinks collision radius for large lists", () => {
    expect(pileRadiusForCount(10)).toBe(50)
    expect(pileRadiusForCount(80)).toBe(42)
    expect(pileRadiusForCount(200)).toBe(36)
  })

  it("does not run a long sync settle for large n", () => {
    const ids = Array.from({ length: 60 }, (_, i) => `t${i}`)
    const width = 640
    const { playfieldHeight } = listIconPlayfield(width, ids.length)
    const started = performance.now()
    const positions = solveIconPile(ids, width, playfieldHeight)
    const elapsed = performance.now() - started
    expect(Object.keys(positions)).toHaveLength(60)
    expect(positions).toEqual(compactHeapPositions(ids, width, playfieldHeight))
    expect(elapsed).toBeLessThan(50)
  })
})

describe("pile container resize", () => {
  it("updates world bounds and keeps bodies inside when the box shrinks", () => {
    const ids = ["a", "b", "c", "d"]
    const wide = 720
    const tall = listIconPlayfield(wide, ids.length).playfieldHeight
    const radius = pileRadiusForCount(ids.length)
    const world = makePileWorld(wide, tall, radius)
    let bodies = makePileBodies(ids, wide, tall, world)
    // Park one body near the right wall so a shrink must push it in.
    bodies[0]!.x = wide - 20
    bodies[0]!.vx = 120
    const narrow = 280
    const short = listIconPlayfield(narrow, ids.length).playfieldHeight
    const box = applyPileContainer(world, bodies, narrow, short, radius)
    expect(world.width).toBe(box.width)
    expect(world.height).toBe(box.height)
    expect(box.width).toBeLessThan(wide)
    for (const body of bodies) {
      expect(body.x).toBeGreaterThanOrEqual(box.minX - 0.01)
      expect(body.x).toBeLessThanOrEqual(box.maxX + 0.01)
      expect(body.y).toBeGreaterThanOrEqual(box.ceilY - 0.01)
      expect(body.y).toBeLessThanOrEqual(box.floorY + 0.01)
    }
    // After a step in the new box, bodies still stay inside.
    bodies = stepIconPile(bodies, world, 1 / 30, box)
    for (const body of bodies) {
      expect(body.x).toBeGreaterThanOrEqual(box.minX - 0.01)
      expect(body.x).toBeLessThanOrEqual(box.maxX + 0.01)
      expect(body.y).toBeLessThanOrEqual(box.floorY + 0.01)
    }
  })

  it("widens the container without inventing a morph heap", () => {
    const ids = ["a", "b"]
    const radius = pileRadiusForCount(ids.length)
    const world = makePileWorld(300, 400, radius)
    const bodies = makePileBodies(ids, 300, 400, world)
    const before = bodies.map((b) => ({ id: b.id, x: b.x, y: b.y }))
    const box = applyPileContainer(world, bodies, 600, 500, radius)
    expect(box.width).toBe(600)
    expect(box.height).toBe(500)
    expect(pileContainer(600, 500, radius).maxX).toBeGreaterThan(pileContainer(300, 400, radius).maxX)
    // Bodies that were already inside keep their centers (no compact-heap snap).
    for (const prev of before) {
      const body = bodies.find((b) => b.id === prev.id)!
      expect(body.x).toBeCloseTo(prev.x, 5)
      expect(body.y).toBeCloseTo(prev.y, 5)
    }
  })

  it("freezes playfield reshape until width actually changes", () => {
    expect(pileContainerNeedsReshape(640, 640)).toBe(false)
    expect(pileContainerNeedsReshape(640, 641)).toBe(false)
    expect(pileContainerNeedsReshape(640, 650, 8)).toBe(true)
    expect(pileContainerNeedsReshape(640, 649, 8)).toBe(true)
    expect(pileContainerNeedsReshape(640, 647, 8)).toBe(false)
  })
})

describe("pile feel pack", () => {
  it("keeps collision diameter near the velvet icon box (~104px)", () => {
    expect(LIST_ICON_PILE_RADIUS * 2).toBeGreaterThanOrEqual(96)
    expect(LIST_ICON_PILE_RADIUS * 2).toBeLessThanOrEqual(VELVET_ICON_BOX.w + 4)
  })

  it("uses fixed-timestep accumulator bounds", () => {
    expect(LIST_ICON_PILE_FIXED_DT).toBeCloseTo(1 / 60, 6)
    expect(LIST_ICON_PILE_MAX_STEPS).toBe(6)
    const ids = ["a", "b", "c"]
    const width = 640
    const height = listIconPileContainerHeight(width, ids.length)
    const radius = pileRadiusForCount(ids.length)
    const world = makePileWorld(width, height, radius)
    const bodies = makePileBodies(ids, width, height, world)
    const bounds = pileContainer(width, height, radius)
    const advanced = accumulateIconPile(bodies, world, bounds, 1 / 20, 0)
    expect(advanced.steps).toBeLessThanOrEqual(LIST_ICON_PILE_MAX_STEPS)
    expect(advanced.steps).toBeGreaterThan(0)
  })

  it("bounces the floor with restitution + rest cutoff, not wall e + vx*=0.88", () => {
    expect(LIST_ICON_PILE_PHYSICS.restitution).toBeGreaterThanOrEqual(0.55)
    expect(LIST_ICON_PILE_PHYSICS.restitution).toBeLessThanOrEqual(0.7)
    expect(LIST_ICON_PILE_PHYSICS.wallRestitution).toBeGreaterThanOrEqual(0.65)
    expect(LIST_ICON_PILE_PHYSICS.wallRestitution).toBeLessThanOrEqual(0.7)
    expect(LIST_ICON_PILE_PHYSICS.repulsion).toBeGreaterThanOrEqual(150)
    expect(LIST_ICON_PILE_PHYSICS.linearDrag).toBeGreaterThanOrEqual(0.28)
    expect(LIST_ICON_PILE_PHYSICS.dishK).toBe(0)
    expect(LIST_ICON_PILE_FLOOR_REST).toBe(28)
    expect(LIST_ICON_PILE_FLOOR_FRICTION).toBeGreaterThanOrEqual(46)
    expect(LIST_ICON_PILE_FLOOR_FRICTION).toBeLessThanOrEqual(140)

    const ids = ["solo"]
    const width = 400
    const height = 500
    const radius = pileRadiusForCount(1)
    const world = makePileWorld(width, height, radius)
    const bodies = makePileBodies(ids, width, height, world)
    const bounds = pileContainer(width, height, radius)
    bodies[0]!.x = width / 2
    bodies[0]!.y = bounds.floorY + 10
    bodies[0]!.vx = 80
    bodies[0]!.vy = 200
    // stepWillpowerWorld clones — assert on the returned bodies.
    const next = stepIconPile(bodies, world, LIST_ICON_PILE_FIXED_DT, bounds)
    expect(next[0]!.y).toBeLessThanOrEqual(bounds.floorY + 0.01)
    // Rest cutoff or bounce — not stuck with wall e on floor.
    expect(next[0]!.vy).toBeLessThanOrEqual(0)
  })

  it("keeps seed X but always drops from the ceiling for a visible fall", () => {
    const ids = ["seeded"]
    const width = 640
    const height = 600
    const seedY = 420
    const world = makePileWorld(width, height)
    const bodies = makePileBodies(ids, width, height, world, {
      seedPositions: { seeded: { x: 200, y: seedY } },
    })
    const box = pileContainer(width, height)
    expect(bodies[0]!.x).toBeCloseTo(200 + VELVET_ICON_BOX.w / 2, 5)
    expect(bodies[0]!.y).toBeLessThan(box.ceilY + bodies[0]!.r * 3)
    expect(bodies[0]!.y).toBeLessThan(seedY)
  })

  it("finalize keeps a floor pile without compact-heap morph", () => {
    const ids = ["a", "b", "c", "d"]
    const width = 640
    const height = 500
    const radius = pileRadiusForCount(ids.length)
    const world = makePileWorld(width, height, radius)
    const bounds = pileContainer(width, height, radius)
    const bodies = makePileBodies(ids, width, height, world)
    for (const body of bodies) {
      body.y = bounds.floorY - 4
      body.vy = 0
      body.vx = 0
    }
    const placed = finalizeIconPile(bodies, world, bounds, ids, width, height)
    expect(placed).not.toEqual(compactHeapPositions(ids, width, height))
    for (const id of ids) {
      expect(placed[id]!.y + VELVET_ICON_BOX.h / 2).toBeGreaterThan(height * 0.5)
    }
  })

  it("clears motionPos after freeform commit so pointer drag can begin", () => {
    expect(pileClearMotionAfterCommit()).toBeNull()
  })
})

describe("pile grab / throw", () => {
  it("opens interact window before the hard settle cap", () => {
    expect(LIST_ICON_PILE_INTERACT_MS).toBeLessThan(MIN_VISIBLE_PLACEHOLDER())
    expect(LIST_ICON_PILE_INTERACT_MS).toBeLessThan(LIST_ICON_PILE_MAX_MS)
  })

  it("hit-tests the nearest orb and keeps held bodies out of settle", () => {
    const ids = ["a", "b"]
    const width = 640
    const height = 500
    const world = makePileWorld(width, height)
    let bodies = makePileBodies(ids, width, height, world)
    bodies[0]!.x = 100
    bodies[0]!.y = 200
    bodies[1]!.x = 300
    bodies[1]!.y = 200
    expect(pileHitTest(bodies, 110, 205)).toBe("a")
    bodies = pileGrabBody(bodies, "a")
    expect(bodies[0]!.held).toBe(true)
    expect(pileIsSettled(bodies)).toBe(false)
    bodies = pileDragBody(bodies, "a", 160, 240, 50, -20)
    expect(bodies[0]!.x).toBeCloseTo(160, 5)
    expect(bodies[0]!.y).toBeCloseTo(240, 5)
    bodies = pileThrowBody(bodies, "a", 2000, -2000)
    expect(bodies[0]!.held).toBe(false)
    const speed = Math.hypot(bodies[0]!.vx, bodies[0]!.vy)
    expect(speed).toBeLessThanOrEqual(LIST_ICON_PILE_THROW_MAX + 0.01)
  })

  it("clamps throw impulse and seeds a wake from freeform poses", () => {
    expect(pileClampThrow(10, 0)).toEqual({ vx: 10, vy: 0 })
    const clamped = pileClampThrow(3000, 0)
    expect(clamped.vx).toBeCloseTo(LIST_ICON_PILE_THROW_MAX, 5)
    const ids = ["a", "b"]
    const width = 640
    const height = 500
    const bodies = makePileBodiesFromPositions(
      ids,
      {
        a: { x: 40, y: 300 },
        b: { x: 200, y: 320 },
      },
      width,
      height,
    )
    expect(bodies).toHaveLength(2)
    expect(bodies[0]!.y).toBeGreaterThan(300)
  })
})

/** Local stand-in so the interact window test stays readable without importing UI constants. */
function MIN_VISIBLE_PLACEHOLDER() {
  return 900
}
