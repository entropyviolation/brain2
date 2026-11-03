import { describe, expect, it } from "vitest"
import { evidenceMissingFromSpine } from "@/lib/graph/evidence-watch"
import { projectVault } from "@/lib/graph/vault-graph"

describe("evidence missing from the spine", () => {
  it("raises an address that is not on the spine and leaves the item alone", () => {
    const graph = projectVault({
      entries: [{ id: "b1", date: "2026-10-27", scopeId: "activity", penId: "work", startMin: 0, endMin: 30 }],
    })
    const items = [
      { id: "belief", title: "Mornings are quiet", links: [{ relation: "supported-by", targetId: "block:gone@2026-01-01" }, { relation: "supported-by", targetId: "block:b1@2026-10-27" }] },
    ]
    expect(evidenceMissingFromSpine(items, graph.triples)).toEqual([
      { itemId: "belief", title: "Mornings are quiet", missing: ["block:gone@2026-01-01"] },
    ])
  })
})
