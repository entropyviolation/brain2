import { describe, expect, it } from "vitest"
import { ITEMS } from "../items"
import { blockFacts, MATERIALS } from "./block"
import { HAND_TOOLS, VALDIVIA_BLOCKS } from "./examples"
import { EFFECT_ON, EFFECTS, MOTION_KEYS, MOTIONS, validateToolSpec, type ToolSpec } from "./tool"

const ctx = { items: Object.keys(ITEMS), blocks: blockFacts(VALDIVIA_BLOCKS) }
const pick = (id: string): ToolSpec => structuredClone(HAND_TOOLS.find((t) => t.id === id)!)
const paths = (spec: unknown) => validateToolSpec(spec, ctx).map((e) => e.path)

describe("the motion and effect tables", () => {
  it("gives every motion two to six sane frames", () => {
    for (const m of MOTIONS) {
      const keys = MOTION_KEYS[m]
      expect(keys.length, m).toBeGreaterThanOrEqual(2)
      expect(keys.length, m).toBeLessThanOrEqual(6)
      for (const k of keys) expect(Math.abs(k.angle) <= 120 && Math.abs(k.dx) <= 4 && Math.abs(k.dy) <= 4, m).toBe(true)
    }
  })

  it("lets every effect touch at least one material, and only real ones", () => {
    for (const e of EFFECTS) {
      expect(EFFECT_ON[e].length, e).toBeGreaterThan(0)
      for (const m of EFFECT_ON[e]) expect(MATERIALS).toContain(m)
    }
  })
})

describe("hand-made tools as ToolSpec", () => {
  it("writes a few tools, each valid against the Valdivia blocks", () => {
    expect(HAND_TOOLS.length).toBeGreaterThanOrEqual(3)
    for (const spec of HAND_TOOLS) expect(validateToolSpec(spec, ctx), spec.id).toEqual([])
  })

  it("uses several motions and effects", () => {
    expect(new Set(HAND_TOOLS.map((t) => t.motion.kind)).size).toBeGreaterThanOrEqual(3)
    expect(new Set(HAND_TOOLS.flatMap((t) => t.effects.map((e) => e.does))).size).toBeGreaterThanOrEqual(3)
  })

  it("survives a JSON round trip", () => {
    for (const spec of HAND_TOOLS) expect(validateToolSpec(JSON.parse(JSON.stringify(spec)), ctx)).toEqual([])
  })
})

describe("validateToolSpec refuses tools that could not work", () => {
  it("refuses things that are not objects, without throwing", () => {
    for (const bad of [null, undefined, 3, "hoe", [], true]) expect(validateToolSpec(bad).length).toBeGreaterThan(0)
  })

  it("refuses an effect on the wrong material", () => {
    const a = pick("watering-can")
    a.effects[0] = { material: "stone", does: "water", power: 1 }
    expect(paths(a)).toContain("effects[0].material")
    const b = pick("watering-can")
    b.effects[0] = { block: "rock", does: "water", power: 1 }
    expect(paths(b)).toContain("effects[0].block")
  })

  it("refuses a tool too weak for everything it names", () => {
    const a = pick("pebble-tap")
    a.effects[0] = { block: "rock", does: "break", power: 2 }
    expect(paths(a)).toContain("effects[0].power")
  })

  it("refuses a turn with no ground to turn into, and into on other effects", () => {
    const a = pick("trowel")
    delete a.effects[0]!.into
    expect(paths(a)).toContain("effects[0].into")
    const b = pick("trowel")
    b.effects[0]!.into = "berry"
    expect(paths(b)).toContain("effects[0].into")
    const c = pick("trowel")
    c.effects[1]!.into = "soil"
    expect(paths(c)).toContain("effects[1].into")
  })

  it("refuses both or neither target, unknown blocks, and repeats", () => {
    const a = pick("trowel")
    a.effects[1] = { block: "dig", material: "soil", does: "harvest", power: 1 }
    expect(paths(a)).toContain("effects[1]")
    const b = pick("trowel")
    b.effects[1] = { block: "lava-pit", does: "harvest", power: 1 }
    expect(paths(b)).toContain("effects[1].block")
    const c = pick("trowel")
    c.effects.push(structuredClone(c.effects[1]!))
    expect(paths(c)).toContain("effects[2]")
  })

  it("refuses a grip outside the box, unknown motions, extra fields and unknown recipe items", () => {
    const a = pick("trowel")
    a.grip = [16, 3]
    expect(paths(a)).toContain("grip")
    const b = pick("trowel") as Record<string, any>
    b.motion.kind = "teleport"
    expect(paths(b)).toContain("motion.kind")
    const c = { ...pick("trowel"), frames: [[0, 0]] }
    expect(paths(c)).toContain("frames")
    const d = pick("trowel")
    d.recipe = ["mithril"]
    expect(paths(d)).toContain("recipe[0]")
  })
})
