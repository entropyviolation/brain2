import { describe, it, expect } from "vitest"
import {
  RELATIONS,
  isKnownRelation,
  inverseRelation,
  relationLabel,
  makeLink,
  hasLink,
  addLink,
  removeLink,
  removeLinkByTarget,
  normalizeTag,
  addTag,
  removeTag,
} from "@/lib/links"
import type { ItemLink } from "@/lib/types"

describe("relation catalog", () => {
  it("every relation's inverse resolves back to itself", () => {
    for (const r of RELATIONS) {
      expect(inverseRelation(r.id)).toBe(r.inverse)
      expect(inverseRelation(r.inverse)).toBe(r.id)
    }
  })

  it("treats unknown relations as symmetric", () => {
    expect(isKnownRelation("frobnicates")).toBe(false)
    expect(inverseRelation("frobnicates")).toBe("frobnicates")
  })

  it("'related' is symmetric", () => {
    expect(inverseRelation("related")).toBe("related")
  })

  it("relationLabel falls back to the raw id", () => {
    expect(relationLabel("blocks")).toBe("blocks")
    expect(relationLabel("custom")).toBe("custom")
  })
})

describe("link helpers", () => {
  it("makeLink produces unique ids", () => {
    const a = makeLink("blocks", "t1")
    const b = makeLink("blocks", "t1")
    expect(a.id).not.toBe(b.id)
    expect(a.relation).toBe("blocks")
    expect(a.targetId).toBe("t1")
  })

  it("addLink appends and dedupes (relation,target)", () => {
    let links: ItemLink[] = []
    links = addLink(links, "blocks", "t2")
    expect(links).toHaveLength(1)
    const same = addLink(links, "blocks", "t2")
    expect(same).toBe(links) // unchanged reference on dup
  })

  it("addLink rejects self-links", () => {
    const links = addLink([], "blocks", "t1", "t1")
    expect(links).toHaveLength(0)
  })

  it("addLink allows the same target under a different relation", () => {
    let links: ItemLink[] = []
    links = addLink(links, "blocks", "t2")
    links = addLink(links, "supports", "t2")
    expect(links).toHaveLength(2)
  })

  it("hasLink detects existing pairs", () => {
    const links = addLink([], "reviews", "r1")
    expect(hasLink(links, "reviews", "r1")).toBe(true)
    expect(hasLink(links, "reviews", "r2")).toBe(false)
  })

  it("removeLink removes by id and is a no-op when absent", () => {
    const links = addLink([], "blocks", "t2")
    const removed = removeLink(links, links[0].id)
    expect(removed).toHaveLength(0)
    expect(removeLink(links, "missing")).toBe(links)
  })

  it("removeLinkByTarget removes all matching pairs", () => {
    let links: ItemLink[] = []
    links = addLink(links, "blocks", "t2")
    links = addLink(links, "supports", "t2")
    const next = removeLinkByTarget(links, "blocks", "t2")
    expect(next).toHaveLength(1)
    expect(next[0].relation).toBe("supports")
  })
})

describe("tag helpers", () => {
  it("normalizeTag trims, collapses whitespace, lowercases", () => {
    expect(normalizeTag("  To   Schedule ")).toBe("to schedule")
  })

  it("addTag normalizes and dedupes", () => {
    let tags = addTag([], "Urgent")
    expect(tags).toEqual(["urgent"])
    const same = addTag(tags, "URGENT")
    expect(same).toBe(tags)
  })

  it("addTag ignores empty/whitespace", () => {
    expect(addTag([], "   ")).toEqual([])
  })

  it("removeTag matches after normalization", () => {
    const tags = addTag(addTag([], "home"), "errand")
    expect(removeTag(tags, "HOME")).toEqual(["errand"])
    expect(removeTag(tags, "nope")).toBe(tags)
  })
})
