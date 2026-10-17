import { describe, expect, it } from "vitest"
import { inverseRelation, relationLabel } from "@/lib/links"
import { PERSON_RELATIONS, RELATION_WORDS, relationWord } from "@/lib/person-relations"
import { getRelationDef, relationsFor } from "@/lib/relation-registry"

describe("person relation seeds", () => {
  it("gives every seed an inverse that exists", () => {
    for (const def of PERSON_RELATIONS) {
      expect(getRelationDef(def.inverse), `${def.id} → ${def.inverse}`).toBeDefined()
    }
  })

  it("reads seeds as sentences through links.ts", () => {
    expect(relationLabel("member-of")).toBe("is a member of")
    expect(inverseRelation("member-of")).toBe("has-member")
    expect(relationLabel("has-member")).toBe("has member")
    expect(inverseRelation("mother-of")).toBe("child-of")
    expect(inverseRelation("child-of")).toBe("parent-of")
    expect(inverseRelation("friends-with")).toBe("friends-with")
  })

  it("does not relabel built-ins", () => {
    expect(PERSON_RELATIONS.some((d) => d.id === "related" || d.id === "blocks")).toBe(false)
    expect(relationLabel("related")).toBe("related to")
  })

  it("puts person relations first for a person", () => {
    const ids = relationsFor("person", "person").map((d) => d.id)
    expect(ids.indexOf("friends-with")).toBeLessThan(ids.indexOf("related"))
    expect(relationsFor("task", "task").some((d) => d.id === "friends-with")).toBe(false)
    expect(relationsFor("person", "book").some((d) => d.id === "fan-of")).toBe(true)
  })
})

describe("RELATION_WORDS", () => {
  it("maps every word to seeds that exist", () => {
    for (const [w, mapped] of Object.entries(RELATION_WORDS)) {
      expect(getRelationDef(mapped.relation), w).toBeDefined()
      expect(getRelationDef(mapped.personRelation), w).toBeDefined()
    }
  })

  it("reads from Self's side", () => {
    expect(relationWord("mom")).toEqual({ relation: "child-of", personRelation: "mother-of" })
    expect(relationWord("boss")?.personRelation).toBe("manager-of")
  })

  it("lowercases, trims, and tolerates plurals", () => {
    expect(relationWord("  Sister ")?.relation).toBe("sibling-of")
    expect(relationWord("Best Friends")?.relation).toBe("best-friends-with")
    expect(relationWord("cousins")?.relation).toBe("cousin-of")
    expect(relationWord("bosses")?.relation).toBe("reports-to")
    expect(relationWord("co-worker")?.relation).toBe("works-with")
    expect(relationWord("coach")).toBeUndefined()
    expect(relationWord("")).toBeUndefined()
  })
})
