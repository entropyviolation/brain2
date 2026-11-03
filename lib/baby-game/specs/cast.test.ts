import { describe, expect, it } from "vitest"
import { CONDITION_TEXT, resident, temper } from "../cast"
import { ITEMS } from "../items"
import { GAME_SPECIES } from "../sprites"
import { CONDITIONS } from "./common"
import { validateCastSpec, type CastSpec } from "./cast"
import { VALDIVIA_CAST } from "./examples"

const ctx = { items: Object.keys(ITEMS) }
const base = (): CastSpec => structuredClone(VALDIVIA_CAST[0]!)
const paths = (spec: unknown) => validateCastSpec(spec, ctx).map((e) => e.path)

describe("Valdivia residents as CastSpec", () => {
  it("copies the condition list", () => {
    expect([...CONDITIONS].sort()).toEqual(Object.keys(CONDITION_TEXT).sort())
  })

  it("writes at least five real residents, each valid", () => {
    expect(VALDIVIA_CAST.length).toBeGreaterThanOrEqual(5)
    for (const spec of VALDIVIA_CAST) expect(validateCastSpec(spec, ctx), spec.id).toEqual([])
  })

  it("matches cast.ts and the friend personality, field for field", () => {
    for (const spec of VALDIVIA_CAST) {
      const r = resident(spec.id)!
      expect(r, spec.id).toBeDefined()
      expect(GAME_SPECIES).toContain(spec.id)
      const t = temper(spec.id)
      expect({ name: spec.name, title: spec.title, tone: spec.tone, cadence: spec.cadence }, spec.id).toEqual({ name: r.name, title: r.title, tone: t.tone, cadence: t.cadence })
      expect(spec.want, spec.id).toEqual({ items: r.wants, gives: r.gives, hearts: r.gate, condition: r.condition })
      expect(spec.likes, spec.id).toEqual(r.likes)
      expect(spec.hates, spec.id).toEqual([r.hates])
      expect(spec.habits, spec.id).toEqual({ social: r.social, ...(r.sleeps ? { sleeps: r.sleeps } : {}), ...(r.rainLover ? { rainLover: true } : {}) })
    }
  })
})

describe("validateCastSpec refuses bad specs", () => {
  it("refuses things that are not objects, without throwing", () => {
    for (const bad of [null, undefined, 0, "Ada", [], false]) expect(validateCastSpec(bad).length).toBeGreaterThan(0)
  })

  it("refuses an unknown template, tone, cadence or ramp", () => {
    const a = base() as Record<string, any>
    a.body.template = "dragon"
    a.tone = "sarcastic"
    a.cadence = "loud"
    a.palette.fur = "gold"
    expect(paths(a)).toEqual(expect.arrayContaining(["body.template", "tone", "cadence", "palette.fur"]))
  })

  it("refuses ears on a bird and a size out of range", () => {
    const a = base()
    a.body.ears = "point"
    a.body.size = 3
    expect(paths(a)).toEqual(expect.arrayContaining(["body.ears", "body.size"]))
  })

  it("refuses unknown items, a keepsake they also want, and a gate past ten hearts", () => {
    const a = base()
    a.want = { items: ["dragon-egg"], gives: "dragon-egg", hearts: 11, condition: "morning" }
    expect(paths(a)).toEqual(expect.arrayContaining(["want.items[0]", "want.gives", "want.hearts"]))
  })

  it("refuses a tag both liked and hated, unknown tags, and repeats", () => {
    const a = base()
    a.likes = ["sweet", "sweet"]
    a.hates = ["sweet"]
    expect(paths(a)).toEqual(expect.arrayContaining(["likes", "hates"]))
    const b = base() as Record<string, any>
    b.likes = ["spicy"]
    expect(paths(b)).toContain("likes[0]")
  })

  it("refuses an accessory with no ramp, a ramp with no accessory, and extra fields", () => {
    const a = base()
    a.accessory = { kind: "scarf" }
    expect(paths(a)).toContain("accessory.ramp")
    const b = base()
    b.accessory = { kind: "none", ramp: "teal" }
    expect(paths(b)).toContain("accessory.ramp")
    const c = { ...base(), lines: ["hi"] }
    expect(paths(c)).toContain("lines")
  })

  it("refuses sleep hours that are not hours", () => {
    const a = base()
    a.habits.sleeps = [25, 25]
    expect(paths(a)).toEqual(expect.arrayContaining(["habits.sleeps[0]", "habits.sleeps"]))
  })
})
