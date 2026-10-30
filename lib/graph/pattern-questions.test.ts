import { describe, expect, it } from "vitest"
import { makeRule } from "@/lib/graph/relation-rules"
import { NO_TRIPLE, answerHouseQuestion } from "@/lib/graph/pattern-questions"
import { projectVault } from "@/lib/graph/vault-graph"

const graph = projectVault({
  scopes: [
    { id: "company", pens: [{ id: "sam", name: "Sam", color: "#111" }] },
    { id: "location", pens: [{ id: "park", name: "Park", color: "#0a0" }] },
  ],
  entries: [
    { id: "c1", date: "2026-10-27", scopeId: "company", penId: "sam", startMin: 600, endMin: 660 },
    { id: "l1", date: "2026-10-27", scopeId: "location", penId: "park", startMin: 600, endMin: 660 },
  ],
  items: [
    { id: "p-sam", title: "Sam", type: "person", personPipelines: [{ kind: "company-pen", penId: "sam" }] },
    { id: "trip", title: "Coast", scheduledDate: "2026-10-27", deadline: "2026-10-27" },
    { id: "loose", title: "Loose", captureOrigin: { kind: "telegram" }, createdAt: "2026-10-27", links: [] },
  ],
})

describe("house questions", () => {
  it("answers who-with from triples and stays quiet when none match", () => {
    const hit = answerHouseQuestion("who with Sam during Coast", { graph })
    expect(hit?.sentence).toMatch(/co-occurs on 1 block/)
    expect(hit?.sentence).toMatch(/Park/)
    expect(hit?.triples.length).toBeGreaterThan(0)
    expect(hit?.sentence).not.toMatch(/will|causes|should/)

    const miss = answerHouseQuestion("who with Nobody during Coast", { graph })
    expect(miss?.sentence).toBeNull()
    expect(miss?.quiet).toBe(NO_TRIPLE)
    expect(miss?.lines).toEqual([])
  })

  it("answers places, captures, day, where-from, and a ? pattern", () => {
    expect(answerHouseQuestion("places with one person", { graph })?.sentence).toMatch(/only Sam/)
    expect(answerHouseQuestion("captures never linked", { graph })?.sentence).toMatch(/1 capture /)
    expect(answerHouseQuestion("day 2026-10-27", { graph })?.triples.length).toBeGreaterThan(0)
    const from = answerHouseQuestion("where from belief strength", { graph })
    expect(from?.sentence).toMatch(/derived from/)
    expect(from?.triples.every((triple) => triple.order === "derived")).toBe(true)
    const pattern = answerHouseQuestion("? * at-place pen:park", { graph })
    expect(pattern?.triples.length).toBe(1)
    expect(answerHouseQuestion("alpha bird", { graph })).toBeNull()
  })

  it("says when message triples are absent", () => {
    const unseen = answerHouseQuestion("people unseen", { graph, asOf: "2026-10-27" })
    expect(unseen?.sentence).toBeNull()
    expect(unseen?.quiet).toMatch(/No triple supports an answer/)
    expect(unseen?.quiet).toMatch(/iPhone Texts/)
  })

  it("answers item-graph questions the spine cannot see", () => {
    const items = [
      { id: "b", title: "Rain", type: "belief", links: [] },
      { id: "held", title: "Held", type: "belief", links: [{ relation: "supported-by", targetId: "s" }] },
      { id: "s", title: "Book", type: "source" },
      { id: "a", title: "Sam", type: "person" },
      { id: "b2", title: "Sam", type: "person" },
      { id: "ada", title: "Ada", type: "person", links: [{ relation: "mother-of", targetId: "lio" }] },
      { id: "lio", title: "Lio", type: "person", links: [{ relation: "parent-of", targetId: "oey" }] },
      { id: "oey", title: "Oey", type: "person" },
    ]
    const ctx = { graph, items }
    expect(answerHouseQuestion("unsupported beliefs", ctx)?.sentence).toMatch(/1 belief has/)
    expect(answerHouseQuestion("shared names", ctx)?.sentence).toMatch(/neither links same-as/)
    const via = answerHouseQuestion("via family-of Ada", ctx)
    expect(via?.sentence).toMatch(/Ada — is the mother of Lio/)
    expect(via?.sentence).not.toMatch(/blocks/)
    const derived = answerHouseQuestion("unpinned derived", {
      graph,
      items,
      rules: [makeRule({ label: "Grandparents", chain: ["parent-of", "parent-of"], head: "grandparent-of" })],
    })
    expect(derived?.sentence).toMatch(/grandparent|grandchild/i)
    expect(derived?.triples.every((triple) => triple.order === "derived")).toBe(true)
  })
})
