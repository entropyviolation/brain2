import { describe, expect, it } from "vitest"
import { ITEMS } from "../items"
import { buildWorld, isSolidTile, MAP_W, NODES, T } from "../world"
import { blockFacts, validateBlockSpec, type BlockSpec } from "./block"
import { VALDIVIA_BLOCKS } from "./examples"

const ctx = { items: Object.keys(ITEMS), blocks: blockFacts(VALDIVIA_BLOCKS) }
const pick = (id: string): BlockSpec => structuredClone(VALDIVIA_BLOCKS.find((b) => b.id === id)!)
const paths = (spec: unknown) => validateBlockSpec(spec, ctx).map((e) => e.path)

describe("Valdivia blocks as BlockSpec", () => {
  it("writes ground and node blocks, each valid", () => {
    expect(VALDIVIA_BLOCKS.some((b) => b.layer === "ground")).toBe(true)
    expect(VALDIVIA_BLOCKS.some((b) => b.layer === "node")).toBe(true)
    for (const spec of VALDIVIA_BLOCKS) expect(validateBlockSpec(spec, ctx), spec.id).toEqual([])
  })

  it("matches the world: a ground block is a real tile and solid unless walkable, a node is a real node kind", () => {
    const world = buildWorld()
    const kinds = new Set(NODES.map((n) => n.kind))
    for (const spec of VALDIVIA_BLOCKS) {
      if (spec.layer === "node") {
        expect(kinds.has(spec.id as never), spec.id).toBe(true)
        continue
      }
      const tile = T[spec.id === "soil" ? "SOIL" : (spec.id.toUpperCase() as keyof typeof T)]
      expect(tile, spec.id).toBeDefined()
      const i = world.tiles.findIndex((t, at) => t === tile && !world.stationSolid.has(at))
      expect(i, spec.id).toBeGreaterThanOrEqual(0)
      expect(isSolidTile(world, i % MAP_W, Math.floor(i / MAP_W), 5), spec.id).toBe(!spec.walkable)
    }
  })
})

describe("validateBlockSpec refuses bad specs", () => {
  it("refuses things that are not objects, without throwing", () => {
    for (const bad of [null, undefined, 3, "grass", [], true]) expect(validateBlockSpec(bad).length).toBeGreaterThan(0)
  })

  it("keeps ground on look and nodes on parts", () => {
    const a = pick("grass") as Record<string, any>
    a.parts = pick("berry").parts
    expect(paths(a)).toContain("parts")
    const b = pick("berry") as Record<string, any>
    b.look = pick("grass").look
    expect(paths(b)).toContain("look")
    const c = pick("berry")
    c.parts![0]!.at = [10, 10, 10, 10]
    expect(paths(c)).toContain("parts[0].at")
  })

  it("refuses walkable water, unknown materials and patterns, and a missing accent", () => {
    const a = pick("water")
    a.walkable = true
    expect(paths(a)).toContain("walkable")
    const b = pick("grass") as Record<string, any>
    b.material = "lava"
    expect(paths(b)).toContain("material")
    const c = pick("grass") as Record<string, any>
    c.look.pattern = "plaid"
    expect(paths(c)).toContain("look.pattern")
    const d = pick("grass")
    delete d.look!.accent
    expect(paths(d)).toContain("look.accent")
  })

  it("refuses unknown drops, upside-down ranges, and a becomes that is not a ground block", () => {
    const a = pick("berry")
    a.drops[0]!.item = "dragon-egg"
    expect(paths(a)).toContain("drops[0].item")
    const b = pick("berry")
    b.drops[0] = { item: "berry", min: 3, max: 1 }
    expect(paths(b)).toContain("drops[0]")
    const c = pick("berry")
    c.becomes = "reed"
    expect(paths(c)).toContain("becomes")
    const d = pick("berry")
    d.becomes = "berry"
    expect(paths(d)).toContain("becomes")
  })

  it("survives a JSON round trip", () => {
    for (const spec of VALDIVIA_BLOCKS) expect(validateBlockSpec(JSON.parse(JSON.stringify(spec)), ctx)).toEqual([])
  })
})
