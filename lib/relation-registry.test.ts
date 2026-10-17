import { afterEach, describe, expect, it } from "vitest"
import { inverseRelation, inverseRelationLabel, isKnownRelation, relationLabel } from "@/lib/links"
import {
  allRelations,
  createRelationPair,
  getRelationDef,
  registerCustomRelations,
  relationsFor,
} from "@/lib/relation-registry"
import { useItemTypeStore } from "@/lib/item-type-store"

afterEach(() => {
  registerCustomRelations([])
  useItemTypeStore.setState({ relations: [] })
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
