import { afterEach, describe, expect, it } from "vitest"
import { getRelationDef, inverseRelation, inverseRelationLabel, registerRelationDefs, relationLabel } from "@/lib/links"
import { createRelationPair, guessInverseLabel, relationFamily, relationsFor } from "@/lib/relation-registry"
import { PERSON_RELATIONS, relationForWord, RELATION_WORDS } from "@/lib/person-relations"
import { useItemTypeStore } from "@/lib/item-type-store"

afterEach(() => {
  registerRelationDefs([])
  useItemTypeStore.setState({ relations: [] })
})

describe("relation registry", () => {
  it("keeps catalog labels and inverses", () => {
    expect(relationLabel("blocks")).toBe("blocks")
    expect(inverseRelation("blocks")).toBe("blocked-by")
    expect(inverseRelation("made-up")).toBe("made-up")
    expect(relationLabel("made-up")).toBe("made-up")
  })

  it("reads person seeds both ways", () => {
    expect(relationLabel("member-of")).toBe("is a member of")
    expect(inverseRelation("member-of")).toBe("has-member")
    expect(inverseRelation("mother-of")).toBe("child-of")
    expect(inverseRelationLabel("mother-of")).toBe("is the child of")
    expect(inverseRelation("friends-with")).toBe("friends-with")
    for (const def of PERSON_RELATIONS) expect(getRelationDef(def.inverse)).toBeDefined()
  })

  it("maps every relation word to a known relation", () => {
    for (const id of Object.values(RELATION_WORDS)) expect(getRelationDef(id)).toBeDefined()
    expect(relationForWord(" Sisters ")).toBe("sibling-of")
    expect(relationForWord("coach")).toBeUndefined()
  })

  it("creates a two-way pair and a symmetric relation", () => {
    const pair = createRelationPair({ label: "is the drummer of", inverseLabel: "has drummer", fromTypes: ["person"] })
    expect(pair).toHaveLength(2)
    expect(pair[0].inverse).toBe(pair[1].id)
    expect(pair[1].inverse).toBe(pair[0].id)
    expect(pair[1].fromTypes).toBeUndefined()
    const same = createRelationPair({ label: "jams with", symmetric: true })
    expect(same).toHaveLength(1)
    expect(same[0].inverse).toBe(same[0].id)
  })

  it("custom relations from the store read through the label helpers, and cannot relabel the catalog", () => {
    const pair = createRelationPair({ label: "is the drummer of", inverseLabel: "has drummer" })
    useItemTypeStore.getState().addRelations([...pair, { ...pair[0], id: "blocks", label: "nope" }])
    expect(relationLabel(pair[0].id)).toBe("is the drummer of")
    expect(inverseRelation(pair[0].id)).toBe(pair[1].id)
    expect(relationLabel("blocks")).toBe("blocks")
    expect(relationsFor("person").yours.map((d) => d.id)).toContain(pair[0].id)
    useItemTypeStore.getState().archiveRelation(pair[0].id)
    expect(relationsFor("person").yours.map((d) => d.id)).not.toContain(pair[0].id)
    expect(relationLabel(pair[0].id)).toBe("is the drummer of")
  })

  it("scopes by type and names families", () => {
    const forPerson = relationsFor("person", "band")
    expect(forPerson.forType.map((d) => d.id)).toContain("member-of")
    expect(forPerson.forType.map((d) => d.id)).not.toContain("friends-with")
    expect(relationsFor("task").forType).toHaveLength(0)
    expect(relationFamily("blocks")).toBe("task")
    expect(relationFamily("supports")).toBe("evidence")
    expect(relationFamily("sibling-of")).toBe("family")
    expect(guessInverseLabel("is a member of")).toBe("has member")
  })
})
