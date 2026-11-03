/**
 * Competency questions for the vault graph (Hogan et al. §6.5).
 * A source with trust and a supports link changes belief strength.
 * A same-as proposal does not delete either person.
 * A private item is absent from the snapshot.
 */
import { describe, expect, it } from "vitest"
import { computeBeliefStrength } from "@/lib/belief-strength"
import { identityCandidates } from "@/lib/graph/identity-match"
import { graphSnapshot } from "@/lib/graph/graph-snapshot"
import { SOURCE_ATTR } from "@/lib/second-brain-types"
import type { ItemRecord } from "@/lib/types"

describe("competency questions", () => {
  it("a source with trust and a supports link changes belief strength", () => {
    const bare = computeBeliefStrength({ links: [] }, [])
    expect(bare).toBe(0.5)
    const linked = computeBeliefStrength(
      { links: [{ id: "l", relation: "supported-by", targetId: "s" }] },
      [{ id: "s", attributes: { [SOURCE_ATTR.trust]: 1 } }],
    )
    expect(linked).toBeGreaterThan(0.5)
  })

  it("a same-as proposal does not delete either person", () => {
    const items = [
      { id: "a", title: "Sam", type: "person" },
      { id: "b", title: "Sam", type: "person" },
    ]
    const rows = identityCandidates({ items, scopes: [] })
    expect(rows).toHaveLength(1)
    expect(rows[0].relation).toBe("same-as")
    expect(items.map((item) => item.id)).toEqual(["a", "b"])
  })

  it("a private item is absent from the snapshot", () => {
    const snap = graphSnapshot({
      tasks: [
        { id: "a", title: "Ada", links: [], lists: [], tags: [], notes: "diary" },
        { id: "s", title: "Night", links: [], lists: ["sleep-log"], tags: [], notes: "asleep" },
      ] as unknown as ItemRecord[],
      relations: [],
      rules: [],
      title: (item) => item.title ?? item.id,
    })
    expect(snap.items.map((item) => item.id)).toEqual(["a"])
    expect(snap.leftOut.privateItems).toBe(1)
    expect(snap.items.every((item) => !("notes" in item))).toBe(true)
  })
})
