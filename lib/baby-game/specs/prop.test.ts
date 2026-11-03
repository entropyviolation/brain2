import { describe, expect, it } from "vitest"
import { newGame } from "../engine"
import { ITEMS, TAGS as ITEM_TAGS } from "../items"
import { SKILL_IDS } from "../farm"
import { propLabel, PROP_SCREEN } from "../props"
import { SPRITE_PALETTE } from "../sprites"
import { FLAT_PROPS, PROPS, type PropKind } from "../world"
import { SKILLS, TAGS } from "./common"
import { VALDIVIA_PROPS } from "./examples"
import { RAMPS, type RampName } from "./ramps"
import { validatePropSpec, VERBS, type PropSpec } from "./prop"

const items = Object.keys(ITEMS)
const ctx = { items }
const clone = <T,>(v: T): T => structuredClone(v)
const base = (): PropSpec => clone(VALDIVIA_PROPS.find((p) => p.id === "mailbox")!)
const paths = (spec: unknown) => validatePropSpec(spec, ctx).map((e) => e.path)

/** Which ramp each sprite paint letter sits on. */
const LETTER_RAMP: Record<string, RampName> = {
  w: "paper", l: "paper", s: "silver", S: "silver", d: "silver", e: "cream", E: "cream", a: "ash", A: "ash", z: "ash", y: "ash",
  o: "apricot", O: "apricot", Q: "apricot", f: "fawn", F: "fawn", j: "fawn", t: "wood", T: "wood", u: "wood",
  p: "pink", P: "pink", q: "pink", r: "red", R: "red", g: "leaf", G: "leaf", h: "leaf", b: "sky", B: "sky", n: "sky",
  v: "lilac", V: "lilac", x: "lilac", c: "teal", C: "teal", m: "teal", k: "plum", i: "yellow", I: "yellow", J: "yellow",
}

describe("the closed lists match the game", () => {
  it("copies the item tags and skills", () => {
    expect([...TAGS]).toEqual([...ITEM_TAGS])
    expect([...SKILLS]).toEqual([...SKILL_IDS])
  })

  it("puts every sprite color on a named ramp, with no gold ramp", () => {
    for (const [letter, hex] of Object.entries(SPRITE_PALETTE)) {
      const ramp = LETTER_RAMP[letter]
      expect(ramp, `letter ${letter}`).toBeDefined()
      expect(RAMPS[ramp!] as readonly string[], `letter ${letter}`).toContain(hex)
    }
    expect(Object.keys(RAMPS).some((n) => /gold/.test(n))).toBe(false)
  })
})

describe("Valdivia props as PropSpec", () => {
  it("writes at least five real props, each valid", () => {
    expect(VALDIVIA_PROPS.length).toBeGreaterThanOrEqual(5)
    for (const spec of VALDIVIA_PROPS) expect(validatePropSpec(spec, ctx), spec.id).toEqual([])
  })

  it("matches the world: a placed kind, solid unless flat, the same label, the same screen", () => {
    const s = newGame()
    for (const spec of VALDIVIA_PROPS) {
      const index = PROPS.findIndex((p) => p.kind === spec.id)
      expect(index, spec.id).toBeGreaterThanOrEqual(0)
      expect(spec.solid, spec.id).toBe(!FLAT_PROPS.has(spec.id as PropKind))
      expect(spec.use.label, spec.id).toBe(propLabel(s, index))
      expect(spec.use.screen, spec.id).toBe(PROP_SCREEN[spec.id as PropKind])
    }
  })

  it("uses most of the verb list", () => {
    const used = new Set(VALDIVIA_PROPS.map((p) => p.use.verb))
    expect(used.size).toBeGreaterThanOrEqual(VERBS.length - 1)
  })
})

describe("validatePropSpec refuses bad specs", () => {
  it("refuses things that are not objects, without throwing", () => {
    for (const bad of [null, undefined, 3, "well", [], true]) expect(validatePropSpec(bad).length).toBeGreaterThan(0)
  })

  it("refuses a missing or unknown verb", () => {
    const a = base() as Record<string, any>
    a.use.verb = "explode"
    expect(paths(a)).toContain("use.verb")
    const b = base() as Record<string, any>
    delete b.use.verb
    expect(paths(b)).toContain("use.verb")
  })

  it("refuses arguments that belong to another verb, and missing required ones", () => {
    const a = base()
    a.use.screen = "fish"
    expect(paths(a)).toContain("use.screen")
    const b = { ...base(), use: { verb: "heal", label: "Drink" } }
    expect(paths(b)).toContain("use.amount")
    const c = { ...base(), use: { verb: "give", label: "Take", item: "honey", pool: "seed" } }
    expect(paths(c)).toContain("use")
  })

  it("refuses unknown ramps, steps off the ramp, and parts outside the box", () => {
    const a = base()
    a.parts[0]!.ramp = "gold" as RampName
    expect(paths(a)).toContain("parts[0].ramp")
    const b = base()
    b.parts[0]!.step = 9
    expect(paths(b)).toContain("parts[0].step")
    const c = base()
    c.parts[0]!.at = [10, 10, 10, 10]
    expect(paths(c)).toContain("parts[0].at")
    const d = base()
    d.parts[0]!.at = [1, 2, 3]
    expect(paths(d)).toContain("parts[0].at")
  })

  it("refuses unknown items, extra fields, bad sizes and too many parts", () => {
    const a = base()
    a.use.extra = { item: "dragon-egg", chance: 0.5 }
    expect(paths(a)).toContain("use.extra.item")
    const b = { ...base(), code: "alert(1)" }
    expect(paths(b)).toContain("code")
    const c = base()
    c.size = { w: 3, h: 1 }
    expect(paths(c)).toContain("size.w")
    const d = base()
    d.parts = Array.from({ length: 30 }, () => clone(d.parts[0]!))
    expect(paths(d)).toContain("parts")
    const e = base()
    e.id = "Big Well!"
    expect(paths(e)).toContain("id")
  })

  it("refuses a risk with no cost, and an open that also acts", () => {
    const a = base()
    a.use.risk = { energy: 3, chance: 0.5 }
    expect(paths(a)).toContain("use.risk")
    const b = clone(VALDIVIA_PROPS.find((p) => p.use.verb === "open")!)
    b.use.energy = 2
    expect(paths(b)).toContain("use.energy")
  })

  it("survives a JSON round trip", () => {
    for (const spec of VALDIVIA_PROPS) expect(validatePropSpec(JSON.parse(JSON.stringify(spec)), ctx)).toEqual([])
  })
})
