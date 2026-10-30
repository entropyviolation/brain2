import { describe, expect, it } from "vitest"
import { identityCandidates, identityProposals } from "@/lib/graph/identity-match"
import type { SpineScope } from "@/lib/graph/vault-graph"

const company: SpineScope = {
  id: "company",
  pens: [{ id: "sam-pen", name: "Sam", color: "#111" }],
}

const who: SpineScope = {
  id: "activity",
  pens: [
    {
      id: "social",
      name: "Social",
      color: "#222",
      variantLabel: "Who with?",
      variants: [{ id: "v-rio", name: "Rio" }],
    },
  ],
}

describe("identity candidates", () => {
  it("proposes same-as for a shared name and does not merge", () => {
    const rows = identityCandidates({
      items: [
        { id: "a", title: "Sam", type: "person" },
        { id: "b", title: "Sam", type: "person" },
      ],
      scopes: [],
    })
    expect(rows).toEqual([
      expect.objectContaining({ sourceId: "a", targetId: "b", relation: "same-as" }),
    ])
    const proposals = identityProposals(rows, "2026-10-27T00:00:00.000Z")
    expect(proposals[0]).toMatchObject({ origin: "densify:identity", status: "open", relation: "same-as" })
    expect(proposals[0].kind).toBe("link")
  })

  it("prefers a shared external id over a different name, and does not merge", () => {
    const items = [
      { id: "a", title: "Ada", type: "person", personProfile: { wikidata: "https://www.wikidata.org/wiki/Q42" } },
      { id: "b", title: "Douglas", type: "source", attributes: { wikidata: "Q42" } },
    ]
    const before = items.map((item) => item.title)
    const rows = identityCandidates({ items, scopes: [] })
    expect(rows).toEqual([expect.objectContaining({ sourceId: "a", targetId: "b", relation: "same-as", reason: expect.stringMatching(/wikidata/) })])
    expect(items.map((item) => item.title)).toEqual(before)
  })

  it("skips a pair already same-as, different-from, dismissed, or joined by a company pen", () => {
    const joined = identityCandidates({
      items: [{ id: "a", title: "Sam", type: "person", personPipelines: [{ kind: "company-pen", penId: "sam-pen" }] }],
      scopes: [company],
    })
    expect(joined).toEqual([])

    const linked = identityCandidates({
      items: [
        { id: "a", title: "Sam", type: "person", links: [{ relation: "same-as", targetId: "b" }] },
        { id: "b", title: "Sam", type: "person" },
      ],
      scopes: [],
    })
    expect(linked).toEqual([])

    const dismissed = identityCandidates({
      items: [
        { id: "a", title: "Sam", type: "person" },
        { id: "b", title: "Sam", type: "person" },
      ],
      scopes: [],
      dismissed: [{ sourceId: "a", targetId: "b", relation: "same-as" }],
    })
    expect(dismissed).toEqual([])
  })

  it("matches a who-detail and an Instagram handle", () => {
    const whoHit = identityCandidates({
      items: [{ id: "rio", title: "Rio", type: "person" }],
      scopes: [who],
    })
    expect(whoHit[0]).toMatchObject({ sourceId: "rio", targetId: "who:activity:social:v-rio" })

    const handle = identityCandidates({
      items: [
        { id: "a", title: "Sam A", type: "person", personProfile: { instagram: "@sam" } },
        { id: "b", title: "Sam B", type: "person", personProfile: { instagram: "https://instagram.com/sam" } },
      ],
      scopes: [],
    })
    expect(handle[0].reason).toMatch(/Instagram/)
  })
})
