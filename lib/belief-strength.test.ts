import { describe, it, expect } from "vitest"
import {
  computeBeliefStrength,
  computeBeliefStrengthDetailed,
  getSourceTrust,
  type SourceLike,
  type BeliefLike,
} from "@/lib/belief-strength"
import { SOURCE_ATTR } from "@/lib/second-brain-types"
import type { ItemLink, LinkStance } from "@/lib/types"

function source(id: string, trust?: number): SourceLike {
  return { id, attributes: trust === undefined ? {} : { [SOURCE_ATTR.trust]: trust } }
}

let linkSeq = 0
function link(relation: string, targetId: string, stance?: LinkStance): ItemLink {
  return { id: `l${linkSeq++}`, relation, targetId, stance }
}

function belief(links: ItemLink[]): BeliefLike {
  return { id: "b1", links }
}

describe("getSourceTrust", () => {
  it("defaults to 0.5 when unset/blank/invalid", () => {
    expect(getSourceTrust(source("s"))).toBe(0.5)
    expect(getSourceTrust(undefined)).toBe(0.5)
    expect(getSourceTrust({ id: "s", attributes: { [SOURCE_ATTR.trust]: "" } })).toBe(0.5)
    expect(getSourceTrust({ id: "s", attributes: { [SOURCE_ATTR.trust]: "nope" as never } })).toBe(0.5)
  })

  it("clamps to [0,1] and coerces numeric strings", () => {
    expect(getSourceTrust(source("s", 0.8))).toBe(0.8)
    expect(getSourceTrust(source("s", 2))).toBe(1)
    expect(getSourceTrust(source("s", -1))).toBe(0)
    expect(getSourceTrust({ id: "s", attributes: { [SOURCE_ATTR.trust]: "0.3" as never } })).toBeCloseTo(0.3)
  })
})

describe("computeBeliefStrength", () => {
  it("empty: no links → neutral 0.5", () => {
    expect(computeBeliefStrength(belief([]), [])).toBe(0.5)
    expect(computeBeliefStrength({ id: "b" }, [])).toBe(0.5)
  })

  it("supporting-only → above 0.5", () => {
    const links = [link("supported-by", "s1", "strong-support")]
    const s = computeBeliefStrength(belief(links), [source("s1", 1)])
    expect(s).toBeGreaterThan(0.5)
    expect(s).toBeCloseTo(0.75) // direction 1, confidence 1/(1+1)=0.5
  })

  it("refuting-only → below 0.5 (mirror of supporting)", () => {
    const links = [link("refuted-by", "s1", "strong-refute")]
    const s = computeBeliefStrength(belief(links), [source("s1", 1)])
    expect(s).toBeLessThan(0.5)
    expect(s).toBeCloseTo(0.25)
  })

  it("mixed equal support/refute → balanced 0.5", () => {
    const links = [
      link("supported-by", "s1", "strong-support"),
      link("refuted-by", "s2", "strong-refute"),
    ]
    const s = computeBeliefStrength(belief(links), [source("s1", 1), source("s2", 1)])
    expect(s).toBeCloseTo(0.5)
  })

  it("trust-weighting: high-trust support beats low-trust refute", () => {
    const links = [
      link("supported-by", "s1", "strong-support"),
      link("refuted-by", "s2", "strong-refute"),
    ]
    const s = computeBeliefStrength(belief(links), [source("s1", 0.9), source("s2", 0.1)])
    // net=0.8, mass=1.0, direction=0.8, confidence=0.5 → 0.5 + 0.5*0.8*0.5 = 0.7
    expect(s).toBeCloseTo(0.7)
  })

  it("more supporting sources push strength higher (count matters)", () => {
    const one = computeBeliefStrength(
      belief([link("supported-by", "s1", "strong-support")]),
      [source("s1", 1)],
    )
    const many = computeBeliefStrength(
      belief([
        link("supported-by", "s1", "strong-support"),
        link("supported-by", "s2", "strong-support"),
        link("supported-by", "s3", "strong-support"),
      ]),
      [source("s1", 1), source("s2", 1), source("s3", 1)],
    )
    expect(many).toBeGreaterThan(one)
  })

  it("weak stance moves strength less than strong stance", () => {
    const weak = computeBeliefStrength(
      belief([link("supported-by", "s1", "weak-support")]),
      [source("s1", 1)],
    )
    const strong = computeBeliefStrength(
      belief([link("supported-by", "s1", "strong-support")]),
      [source("s1", 1)],
    )
    expect(weak).toBeGreaterThan(0.5)
    expect(weak).toBeLessThan(strong)
  })

  it("ignores links to unknown sources and non-evidence relations", () => {
    const links = [
      link("supported-by", "unknown", "strong-support"),
      link("related", "s1", "strong-support"),
      link("blocks", "s1"),
    ]
    expect(computeBeliefStrength(belief(links), [source("s1", 1)])).toBe(0.5)
  })

  it("falls back to relation-implied stance when none set", () => {
    const supported = computeBeliefStrength(
      belief([link("supported-by", "s1")]),
      [source("s1", 1)],
    )
    const refuted = computeBeliefStrength(
      belief([link("refuted-by", "s1")]),
      [source("s1", 1)],
    )
    expect(supported).toBeCloseTo(0.75)
    expect(refuted).toBeCloseTo(0.25)
  })

  it("stance:none contributes no evidence mass", () => {
    const r = computeBeliefStrengthDetailed(
      belief([link("supported-by", "s1", "none")]),
      [source("s1", 1)],
    )
    expect(r.mass).toBe(0)
    expect(r.strength).toBe(0.5)
  })

  it("zero-trust sources contribute nothing", () => {
    const s = computeBeliefStrength(
      belief([link("supported-by", "s1", "strong-support")]),
      [source("s1", 0)],
    )
    expect(s).toBe(0.5)
  })

  it("respects an explicit links argument over belief.links", () => {
    const b = belief([link("refuted-by", "s1", "strong-refute")])
    const override = [link("supported-by", "s1", "strong-support")]
    expect(computeBeliefStrength(b, [source("s1", 1)], override)).toBeCloseTo(0.75)
  })

  it("evidenceHalfMass tunes how fast confidence grows", () => {
    const links = [link("supported-by", "s1", "strong-support")]
    const sources = [source("s1", 1)]
    const sharp = computeBeliefStrength(belief(links), sources, links, { evidenceHalfMass: 0.1 })
    const flat = computeBeliefStrength(belief(links), sources, links, { evidenceHalfMass: 10 })
    expect(sharp).toBeGreaterThan(flat)
  })

  it("detailed result reports net/mass/contributingLinks", () => {
    const links = [
      link("supported-by", "s1", "strong-support"),
      link("refuted-by", "s2", "weak-refute"),
    ]
    const r = computeBeliefStrengthDetailed(belief(links), [source("s1", 1), source("s2", 1)])
    expect(r.contributingLinks).toBe(2)
    expect(r.net).toBeCloseTo(0.5) // +1*1 + (-0.5*1)
    expect(r.mass).toBeCloseTo(1.5) // 1 + 0.5
    expect(r.strength).toBeGreaterThan(0.5)
  })

  it("always returns a value within [0,1]", () => {
    const links = Array.from({ length: 50 }, (_, i) => link("supported-by", `s${i}`, "strong-support"))
    const sources = Array.from({ length: 50 }, (_, i) => source(`s${i}`, 1))
    const s = computeBeliefStrength(belief(links), sources)
    expect(s).toBeGreaterThan(0.9)
    expect(s).toBeLessThanOrEqual(1)
  })
})
