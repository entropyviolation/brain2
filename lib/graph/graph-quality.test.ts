import { describe, expect, it } from "vitest"
import "@/lib/person-relations"
import { coTimeRows } from "@/lib/graph/densify/co-time-rows"
import { coTimeSource } from "@/lib/graph/densify/co-time"
import { linkIndexOf } from "@/lib/graph/link-index"
import { graphQuality, NOISY_SOURCE_FLOOR } from "@/lib/graph/graph-quality"
import { reciprocalSource } from "@/lib/graph/densify/reciprocal"
import type { ItemLink, ItemRecord } from "@/lib/types"

let n = 0
const link = (relation: string, targetId: string): ItemLink => ({ id: `q${++n}`, relation, targetId })
const item = (id: string, links: ItemLink[] = [], extra: Partial<ItemRecord> = {}) =>
  ({ id, title: id, links, lists: [], ...extra }) as unknown as ItemRecord

describe("co-time rows", () => {
  const scope = {
    id: "company",
    pens: [
      { id: "ada", name: "Ada", color: "#111" },
      { id: "bea", name: "Bea", color: "#222" },
    ],
  }
  const ada = { id: "p-ada", type: "person", title: "Ada", personPipelines: [{ kind: "company-pen" as const, penId: "ada" }] }
  const bea = { id: "p-bea", type: "person", title: "Bea", personPipelines: [{ kind: "company-pen" as const, penId: "bea" }] }
  const entries = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      date: `2026-01-${String(index + 1).padStart(2, "0")}`,
      scopeId: "company",
      penId: "ada",
      secondaryPenIds: ["bea"],
      startMin: 600,
      endMin: 660,
    }))

  it("counts shared Company sittings and stays under the floor", () => {
    const rows = coTimeRows(ada, [ada, bea], entries(7), [scope])
    expect(rows[0]).toMatchObject({ otherId: "p-bea", sittings: 7, since: "January 2026" })
    const ctx = { all: [], links: linkIndexOf([]), title: (id: string) => id }
    const hit = coTimeSource(ada as unknown as ItemRecord, ctx, rows, true)[0]
    expect(hit).toMatchObject({ relation: "spends-time-with", source: "co-time" })
    expect(hit.reason).toMatch(/Together 7 times since January 2026/)
    expect(coTimeSource(ada as unknown as ItemRecord, ctx, coTimeRows(ada, [ada, bea], entries(6), [scope]), true)).toEqual([])
  })
})

describe("graph quality", () => {
  const title = (id: string) => id

  it("lists unsupported beliefs, unlinked sources, and collisions", () => {
    const bare = graphQuality({
      tasks: [item("b", [], { type: "belief" }), item("s", [], { type: "source" })],
      title,
    })
    expect(bare.unsupportedBeliefs.map((row) => row.id)).toEqual(["b"])
    expect(bare.unlinkedSources.map((row) => row.id)).toEqual(["s"])

    const held = graphQuality({
      tasks: [item("b2", [link("supported-by", "s2")], { type: "belief" }), item("s2", [], { type: "source" })],
      title,
    })
    expect(held.unsupportedBeliefs).toEqual([])
    expect(held.unlinkedSources).toEqual([])

    const kids = graphQuality({
      tasks: [item("oey"), item("ida", [link("mother-of", "oey")]), item("kim", [link("mother-of", "oey")])],
      title,
    })
    expect(kids.functionalCollisions.length).toBeGreaterThan(0)
  })

  it("names a suggestion source dismissed often enough to mute", () => {
    const hub = item("hub")
    const people = Array.from({ length: NOISY_SOURCE_FLOOR }, (_, index) => item(`p${index}`))
    hub.links = people.map((person) => link("blocks", person.id))
    const tasks = [hub, ...people]
    const links = linkIndexOf(tasks)
    for (const person of people) {
      const key = reciprocalSource(person, { all: tasks, links, title })[0]?.key
      person.dismissedLinkSuggestions = key ? [key] : []
    }
    const quality = graphQuality({ tasks, title })
    expect(quality.noisySources.map((row) => row.id)).toContain("reciprocal")
  })
})
