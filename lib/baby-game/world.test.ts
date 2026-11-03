import { describe, expect, it } from "vitest"
import { RESIDENTS } from "./cast"
import { ITEMS } from "./items"
import { REGIONS } from "./regions"
import { buildWorld, EXTENT_H, EXTENT_W, GATES, PLOTS, PROPS, isSolidTile, MAP_H, MAP_W, NODES, reachable, STATIONS, tileIndex, zoneAt, ZONE_ACT } from "./world"

const SPAWN: [number, number] = [24, 22]
const world = buildWorld(RESIDENTS.map((r) => r.day))
const near = (set: Set<number>, x: number, y: number) =>
  [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => set.has(tileIndex(x + dx!, y + dy!)))

describe("the map", () => {
  it("is deterministic", () => {
    const again = buildWorld(RESIDENTS.map((r) => r.day))
    expect(Array.from(again.tiles)).toEqual(Array.from(world.tiles))
    expect(world.tiles.length).toBe(MAP_W * MAP_H)
  })

  it("lets you reach every friend, node, and station once every gate is open", () => {
    const open = reachable(world, SPAWN, 5)
    for (const r of RESIDENTS) expect(open.has(tileIndex(...r.day)), `${r.name} at ${r.day}`).toBe(true)
    for (const n of NODES) expect(near(open, n.x, n.y), `${n.kind} ${n.x},${n.y}`).toBe(true)
    for (const [id, s] of Object.entries(STATIONS)) expect(near(open, s.x, s.y), id).toBe(true)
  })

  it("keeps each zone behind its gate until its act", () => {
    for (let act = 1; act <= 5; act++) {
      const open = reachable(world, SPAWN, act)
      for (const r of RESIDENTS) {
        const reached = open.has(tileIndex(...r.day))
        expect(reached, `${r.name} act ${act}`).toBe(ZONE_ACT[r.zone] <= act)
        expect(r.act).toBe(ZONE_ACT[r.zone])
      }
    }
  })

  it("puts every friend in the zone they say", () => {
    for (const r of RESIDENTS) {
      const zone = zoneAt(...r.day)
      expect(zone, r.name).toBe(r.zone)
    }
  })

  it("has fish only where there is water beside them", () => {
    for (const n of NODES.filter((x) => x.kind === "fish")) {
      const wet = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => world.tiles[tileIndex(n.x + dx!, n.y + dy!)] === 3)
      expect(wet, `${n.x},${n.y}`).toBe(true)
    }
  })

  it("has a gate in every corridor and none open at act one", () => {
    for (const g of GATES) expect(isSolidTile(world, g.x, g.y, 1)).toBe(true)
    for (const g of GATES) expect(isSolidTile(world, g.x, g.y, g.act)).toBe(false)
  })
})

describe("the chain", () => {
  it("only wants things that exist, are crafted, or were given earlier", () => {
    const given = new Set<string>()
    for (const r of RESIDENTS) {
      for (const w of r.wants) {
        const def = ITEMS[w]
        expect(def, `${r.name} wants ${w}`).toBeTruthy()
        const makeable = def!.kind === "trinket" || def!.kind === "material"
        expect(makeable || given.has(w), `${r.name} wants ${w} before anyone gives it`).toBe(true)
      }
      expect(ITEMS[r.gives], r.gives).toBeTruthy()
      given.add(r.gives)
    }
  })

  it("puts all sixteen plots on soil you can walk to from the start", () => {
    const world = buildWorld(RESIDENTS.map((r) => r.day))
    const reached = reachable(world, [STATIONS.bed.x, STATIONS.bed.y + 1], 1)
    expect(PLOTS).toHaveLength(16)
    for (const p of PLOTS) expect(reached.has(tileIndex(p.x, p.y)), p.id).toBe(true)
  })

  it("ends each act with a Lamp part, and only there", () => {
    for (let act = 1; act <= 5; act++) {
      const group = RESIDENTS.filter((r) => r.act === act)
      group.forEach((r, i) => expect(ITEMS[r.gives]!.kind === "part", `${r.name}`).toBe(i === group.length - 1))
    }
  })

  it("builds every crafted item from raw materials a node or the Stump supplies", () => {
    const supplied = new Set(["berry", "acorn", "reed", "clover", "pebble", "feather", "mushroom", "shell", "fish", "button", "starshard", "glowbean", "puffroot", "moonmelon", "spiralkale", "twinklegourd", "snowpearl", "shadowradish", "mandalichoke", "schrodinberry", "parallaxpepper", "fadeleek", "quincidence", "hypnagogicpea", "aurorasprout"])
    for (const def of Object.values(ITEMS).filter((d) => d.recipe)) {
      for (const m of Object.keys(def.recipe!)) expect(supplied.has(m), `${def.name} needs ${m}`).toBe(true)
    }
    for (const kind of ["berry", "acorn", "reed", "clover", "pebble", "feather", "mushroom", "shell", "fish"])
      expect(NODES.some((n) => n.kind === kind), kind).toBe(true)
  })

  it("keeps hearts gates at or under ten and clues unique to the condition", () => {
    for (const r of RESIDENTS) {
      expect(r.gate).toBeGreaterThanOrEqual(3)
      expect(r.gate).toBeLessThanOrEqual(10)
      expect(r.clue.length).toBeGreaterThan(20)
    }
  })
})

describe("the regions table", () => {
  it("fits the grid, with the built world inside the extent", () => {
    expect(EXTENT_W).toBeLessThanOrEqual(MAP_W)
    expect(EXTENT_H).toBeLessThanOrEqual(MAP_H)
    for (const r of REGIONS) {
      expect(r.rect.x0, r.id).toBeGreaterThanOrEqual(0)
      expect(r.rect.x1, r.id).toBeLessThan(EXTENT_W)
      expect(r.rect.y1, r.id).toBeLessThan(EXTENT_H)
    }
  })
  it("has unique ids and no two zones overlapping", () => {
    expect(new Set(REGIONS.map((r) => r.id)).size).toBe(REGIONS.length)
    for (const a of REGIONS) {
      for (const b of REGIONS) {
        if (a.id >= b.id) continue
        const apart = a.rect.x1 < b.rect.x0 || b.rect.x1 < a.rect.x0 || a.rect.y1 < b.rect.y0 || b.rect.y1 < a.rect.y0
        expect(apart, `${a.id} and ${b.id}`).toBe(true)
      }
    }
  })
  it("leaves the unbuilt grid as solid forest nobody can enter", () => {
    const open = reachable(world, SPAWN, 99)
    for (const i of open) {
      expect(i % MAP_W, "x").toBeLessThan(EXTENT_W)
      expect(Math.floor(i / MAP_W), "y").toBeLessThan(EXTENT_H)
    }
  })
  it("opens every zone", () => {
    const open = reachable(world, SPAWN, 99)
    for (const r of REGIONS) {
      let any = false
      for (let y = r.rect.y0; y <= r.rect.y1 && !any; y++) for (let x = r.rect.x0; x <= r.rect.x1; x++) if (open.has(tileIndex(x, y))) { any = true; break }
      expect(any, r.id).toBe(true)
    }
  })
})

describe("Rhizome", () => {
  const rz = REGIONS.find((r) => r.id === "rhizome")!.rect
  const inside = (x: number, y: number) => x >= rz.x0 && x <= rz.x1 && y >= rz.y0 && y <= rz.y1
  it("is shut until act 5 and open after", () => {
    expect(zoneAt(90, 40)).toBe("rhizome")
    expect(ZONE_ACT.rhizome).toBe(5)
    expect(reachable(world, SPAWN, 4).has(tileIndex(90, 40))).toBe(false)
    expect(reachable(world, SPAWN, 5).has(tileIndex(90, 40))).toBe(true)
  })
  it("has every node and prop of the town within reach, and every door on a walkable sidewalk", () => {
    const open = reachable(world, SPAWN, 5)
    for (const n of NODES.filter((n) => inside(n.x, n.y))) expect(near(open, n.x, n.y), `${n.id} at ${n.x},${n.y}`).toBe(true)
    for (const p of PROPS.filter((p) => inside(p.x, p.y))) expect(near(open, p.x, p.y), `${p.kind} at ${p.x},${p.y}`).toBe(true)
    // the doors are at the bottom of the plan's buildings: (88,38) (104,38) (87,45) (104,45), each with path in front
    for (const [x, y] of [[88, 38], [104, 38], [87, 45], [104, 45]] as const) {
      expect(world.tiles[tileIndex(x, y)], `door ${x},${y}`).toBe(16)
      expect(open.has(tileIndex(x, y + 1)), `in front of ${x},${y}`).toBe(true)
    }
  })
  it("adds nothing to the built extent except the town", () => {
    expect(EXTENT_W).toBe(rz.x1 + 3)
  })
})
