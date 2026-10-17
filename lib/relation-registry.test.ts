import { afterEach, describe, expect, it } from "vitest"
import { inverseRelation, inverseRelationLabel, isKnownRelation, RELATIONS, relationLabel } from "@/lib/links"
import {
  allRelations,
  createRelationPair,
  getRelationDef,
  rawRelationDef,
  registerCustomRelations,
  registerRelationOverrides,
  relationsFor,
} from "@/lib/relation-registry"
import { useItemTypeStore } from "@/lib/item-type-store"

afterEach(() => {
  registerCustomRelations([])
  registerRelationOverrides({})
  useItemTypeStore.setState({ relations: [], relationOverrides: {} })
})

describe("relation registry", () => {
  it("keeps built-in labels and inverses, and leaves unknown ids symmetric", () => {
    expect(relationLabel("blocks")).toBe("blocks")
    expect(inverseRelation("blocks")).toBe("blocked-by")
    expect(inverseRelationLabel("blocks")).toBe("blocked by")
    expect(inverseRelation("made-up")).toBe("made-up")
    expect(relationLabel("made-up")).toBe("made-up")
  })

  it("reads a custom pair through relationLabel and inverseRelation", () => {
    const [member, has] = createRelationPair({
      label: "is a member of",
      inverseLabel: "has member",
      symmetric: false,
      fromTypes: ["person"],
    })
    registerCustomRelations([member, has])
    expect(member.id).toMatch(/^rel-is-a-member-of-[a-z0-9]{4}$/)
    expect(relationLabel(member.id)).toBe("is a member of")
    expect(inverseRelation(member.id)).toBe(has.id)
    expect(inverseRelation(has.id)).toBe(member.id)
    expect(inverseRelationLabel(member.id)).toBe("has member")
    expect(has.toTypes).toEqual(["person"])
    expect(isKnownRelation(member.id)).toBe(false)
  })

  it("makes one def for a symmetric relation", () => {
    const pair = createRelationPair({ label: "is roommates with", symmetric: true })
    expect(pair).toHaveLength(1)
    expect(pair[0].inverse).toBe(pair[0].id)
  })

  it("lists scoped relations first, then open ones, and hides archived", () => {
    registerCustomRelations([
      { id: "rel-plays-in", label: "plays in", inverse: "rel-plays-in", inverseLabel: "plays in", fromTypes: ["person"], toTypes: ["band"] },
      { id: "rel-old", label: "old", inverse: "rel-old", inverseLabel: "old", archived: true },
      { id: "rel-owns", label: "owns", inverse: "rel-owns", inverseLabel: "owns", fromTypes: ["book"] },
    ])
    const ids = relationsFor("person", "band").map((r) => r.id)
    // Person seeds (5.2) are scoped too, so check order against an open relation.
    expect(ids.indexOf("rel-plays-in")).toBeGreaterThanOrEqual(0)
    expect(ids.indexOf("rel-plays-in")).toBeLessThan(ids.indexOf("blocks"))
    expect(ids).not.toContain("rel-old")
    expect(ids).not.toContain("rel-owns")
    expect(relationsFor("person", "task").map((r) => r.id)).not.toContain("rel-plays-in")
    // Archived still resolves, so old links keep a label.
    expect(getRelationDef("rel-old")?.label).toBe("old")
  })

  it("never lets a custom def relabel a built-in", () => {
    registerCustomRelations([{ id: "blocks", label: "hijack", inverse: "blocks", inverseLabel: "hijack" }])
    expect(relationLabel("blocks")).toBe("blocks")
    expect(allRelations().filter((r) => r.id === "blocks")).toHaveLength(1)
  })

  it("registers store relations as they change, and archives instead of deleting", () => {
    const [def] = createRelationPair({ label: "coaches", symmetric: true })
    useItemTypeStore.getState().addRelations([def])
    useItemTypeStore.getState().addRelations([def])
    expect(useItemTypeStore.getState().relations).toHaveLength(1)
    expect(relationLabel(def.id)).toBe("coaches")
    useItemTypeStore.getState().archiveRelation(def.id)
    expect(useItemTypeStore.getState().relations[0].archived).toBe(true)
    expect(relationLabel(def.id)).toBe("coaches")
    expect(relationsFor(undefined).map((r) => r.id)).not.toContain(def.id)
  })
})

describe("relation vocabulary v2 (L1.1)", () => {
  it("keeps built-in labels when an override adds traits, and never mutates RELATIONS", () => {
    const before = JSON.stringify(RELATIONS)
    registerRelationOverrides({
      "part-of": {
        traits: { transitive: true, acyclic: true },
        description: "a piece of something larger",
        // Not overridable: dropped.
        label: "hijack",
        inverse: "blocks",
      } as never,
    })
    const def = getRelationDef("part-of")
    expect(def?.traits).toEqual({ transitive: true, acyclic: true })
    expect(def?.description).toBe("a piece of something larger")
    expect(def?.label).toBe("part of")
    expect(def?.inverse).toBe("has-part")
    expect(relationLabel("part-of")).toBe("part of")
    expect(inverseRelation("part-of")).toBe("has-part")
    expect(JSON.stringify(RELATIONS)).toBe(before)
    expect(rawRelationDef("part-of")?.traits).toBeUndefined()
  })

  it("resolves an alias to its target's label and inverse, keeping the asked id", () => {
    const [cw] = createRelationPair({ label: "is a coworker of", symmetric: true })
    registerCustomRelations([{ ...cw, aliasOf: "works-with", archived: true }])
    const def = getRelationDef(cw.id)
    expect(def?.id).toBe(cw.id)
    expect(def?.aliasOf).toBe("works-with")
    expect(def?.label).toBe(getRelationDef("works-with")?.label)
    expect(relationLabel(cw.id)).toBe(getRelationDef("works-with")?.label)
    expect(inverseRelation(cw.id)).toBe("works-with")
    expect(rawRelationDef(cw.id)?.label).toBe("is a coworker of")
    // Merged relations are archived: still resolve, hidden from pickers.
    expect(relationsFor(undefined).map((r) => r.id)).not.toContain(cw.id)
  })

  it("resolves an alias once, never along a chain", () => {
    registerCustomRelations([
      { id: "rel-a", label: "a", inverse: "rel-a", inverseLabel: "a", aliasOf: "rel-b" },
      { id: "rel-b", label: "b", inverse: "rel-b", inverseLabel: "b", aliasOf: "rel-c" },
      { id: "rel-c", label: "c", inverse: "rel-c", inverseLabel: "c" },
    ])
    expect(relationLabel("rel-a")).toBe("b")
    expect(relationLabel("rel-b")).toBe("c")
  })

  it("keeps archived relations resolving with their overrides", () => {
    registerCustomRelations([{ id: "rel-old", label: "old", inverse: "rel-old", inverseLabel: "old", archived: true }])
    registerRelationOverrides({ "rel-old": { reciprocity: "quiet" } })
    expect(getRelationDef("rel-old")?.label).toBe("old")
    expect(getRelationDef("rel-old")?.reciprocity).toBe("quiet")
  })

  it("feeds store overrides into the registry, and drops non-overridable keys", () => {
    const store = useItemTypeStore.getState()
    store.setRelationOverride("blocks", { traits: { transitive: true }, label: "nope" } as never)
    expect(useItemTypeStore.getState().relationOverrides.blocks).toEqual({ traits: { transitive: true } })
    // Override traits layer onto the side table's (blocks is acyclic there).
    expect(getRelationDef("blocks")?.traits).toEqual({ acyclic: true, transitive: true })
    expect(relationLabel("blocks")).toBe("blocks")
    useItemTypeStore.getState().clearRelationOverride("blocks")
    expect(getRelationDef("blocks")?.traits).toEqual({ acyclic: true })
  })

  it("accepts v2 fields through updateRelation", () => {
    const [def] = createRelationPair({ label: "coaches", symmetric: true })
    useItemTypeStore.getState().addRelations([def])
    useItemTypeStore.getState().updateRelation({ ...def, parent: "knows", phrases: { forward: ["coaches"] } })
    expect(getRelationDef(def.id)?.parent).toBe("knows")
    expect(getRelationDef(def.id)?.phrases?.forward).toEqual(["coaches"])
  })
})
