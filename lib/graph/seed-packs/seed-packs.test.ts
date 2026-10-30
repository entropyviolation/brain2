import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { RELATIONS, inverseRelation, isKnownRelation, relationLabel, type RelationDef } from "@/lib/links"
import { getRelationDef } from "@/lib/relation-registry"
import { useItemTypeStore } from "@/lib/item-type-store"
import { LEXICAL_RELATIONS } from "./lexical"
import { TAXONOMY_RELATIONS, addSeedPack, archiveSeedPack, seedPackOn } from "./taxonomy"

function pairsPointBack(defs: RelationDef[]) {
  const byId = new Map(defs.map((d) => [d.id, d]))
  for (const def of defs) {
    const back = byId.get(def.inverse)
    expect(back, def.id).toBeDefined()
    expect(back!.inverse).toBe(def.id)
    expect(def.origin).toBe("seed")
    expect(def.parent).toBe("related")
    if (def.inverse === def.id) expect(def.inverseLabel).toBe(def.label)
  }
}

describe("seed packs", () => {
  beforeEach(() => {
    useItemTypeStore.setState({ relations: [] })
  })

  afterEach(() => {
    useItemTypeStore.setState({ relations: [] })
  })

  it("gives every taxonomy and lexical def an inverse that points back", () => {
    pairsPointBack(TAXONOMY_RELATIONS)
    pairsPointBack(LEXICAL_RELATIONS)
    expect(TAXONOMY_RELATIONS.find((d) => d.id === "broader")?.traits).toEqual({ transitive: true, acyclic: true })
    expect(TAXONOMY_RELATIONS.find((d) => d.id === "narrower")?.traits).toEqual({ transitive: true, acyclic: true })
    expect(TAXONOMY_RELATIONS.find((d) => d.id === "see-also")?.inverse).toBe("see-also")
    expect(LEXICAL_RELATIONS.find((d) => d.id === "antonym-of")?.traits?.disjointWith).toEqual(["synonym-of"])
    expect(LEXICAL_RELATIONS.find((d) => d.id === "root-of")?.inverse).toBe("derived-from")
    expect(LEXICAL_RELATIONS.find((d) => d.id === "false-friend-of")?.inverse).toBe("false-friend-of")
    expect(RELATIONS.some((d) => d.id === "broader" || d.id === "synonym-of")).toBe(false)
  })

  it("keeps taxonomy off until addRelations", () => {
    expect(getRelationDef("broader")).toBeUndefined()
    expect(isKnownRelation("broader")).toBe(false)
    expect(relationLabel("related")).toBe("related to")
    expect(seedPackOn(TAXONOMY_RELATIONS, useItemTypeStore.getState().relations)).toBe(false)

    useItemTypeStore.getState().addRelations(TAXONOMY_RELATIONS)
    expect(seedPackOn(TAXONOMY_RELATIONS, useItemTypeStore.getState().relations)).toBe(true)
    expect(getRelationDef("broader")?.origin).toBe("seed")
    expect(getRelationDef("broader")?.parent).toBe("related")
    expect(getRelationDef("broader")?.traits).toEqual({ transitive: true, acyclic: true })
    expect(inverseRelation("broader")).toBe("narrower")
    expect(inverseRelation("narrower")).toBe("broader")
    expect(inverseRelation("see-also")).toBe("see-also")
    expect(relationLabel("related")).toBe("related to")
    expect(relationLabel("blocks")).toBe("blocks")
  })

  it("archive keeps the def id and does not drop the row", () => {
    useItemTypeStore.getState().addRelations(TAXONOMY_RELATIONS)
    const before = useItemTypeStore.getState().relations.map((r) => r.id)
    archiveSeedPack(TAXONOMY_RELATIONS)
    const stored = useItemTypeStore.getState().relations
    expect(stored.map((r) => r.id)).toEqual(before)
    for (const id of before) {
      expect(stored.find((r) => r.id === id)?.archived).toBe(true)
      expect(getRelationDef(id)?.id).toBe(id)
    }
    expect(seedPackOn(TAXONOMY_RELATIONS, stored)).toBe(false)
  })

  it("adding a live pack does not rewrite it, and a second add restores an archive", () => {
    addSeedPack(LEXICAL_RELATIONS)
    const row = useItemTypeStore.getState().relations.find((r) => r.id === "synonym-of")!
    useItemTypeStore.getState().updateRelation({ ...row, label: "means the same as" })
    const live = useItemTypeStore.getState().relations
    addSeedPack(LEXICAL_RELATIONS)
    expect(useItemTypeStore.getState().relations).toBe(live)
    expect(useItemTypeStore.getState().relations.find((r) => r.id === "synonym-of")?.label).toBe("means the same as")

    archiveSeedPack(LEXICAL_RELATIONS)
    addSeedPack(LEXICAL_RELATIONS)
    const restored = useItemTypeStore.getState().relations.find((r) => r.id === "synonym-of")
    expect(restored?.archived).toBeUndefined()
    expect(restored?.id).toBe("synonym-of")
    expect(restored?.label).toBe("means the same as")
    expect(inverseRelation("translation-of")).toBe("translation-of")
    expect(inverseRelation("derived-from")).toBe("root-of")
  })
})
