import { describe, expect, it } from "vitest"
import { RELATIONS, type RelationDef } from "@/lib/links"
import { allRelations } from "@/lib/relation-registry"
import { linkIndexOf } from "@/lib/graph/link-index"
import { edgeKey } from "@/lib/link-graph"
import { mergeSuggestions } from "@/lib/graph/densify"
import { mentionSource } from "@/lib/graph/densify/mention"
import { relationWordSource } from "@/lib/graph/densify/relation-word"
import { buildPhraseTable, extractRelationSentences, resolveRelationWord } from "@/lib/graph/extract/relation-phrases"
import { extractWikiLinks } from "@/lib/graph/extract/wiki-links"
import { extractDateMentions } from "@/lib/graph/extract/date-mentions"
import { extractProposals } from "@/lib/graph/extract/vault-extract"
import type { ItemRecord } from "@/lib/types"

const item = (id: string, title: string, extra: Partial<ItemRecord> = {}) => ({ id, title, links: [], lists: [], ...extra }) as unknown as ItemRecord
const titles = [
  { id: "tax", title: "Tax return" },
  { id: "dentist", title: "Dentist" },
  { id: "house", title: "House" },
  { id: "kitchen", title: "Kitchen" },
  { id: "kitchen-sink", title: "Kitchen sink" },
]
const lexical: RelationDef = { id: "root-of", label: "root of", inverse: "derived-from", inverseLabel: "derived from", phrases: { forward: ["$s is the root of $o"], inverse: ["$o comes from $s"] } }
const table = buildPhraseTable([...RELATIONS, lexical])

describe("relation phrases", () => {
  it("reads labels, inverse labels, and templates as 'A phrase B'", () => {
    expect(table.byPhrase.get("blocks")).toBe("blocks")
    expect(table.byPhrase.get("blocked by")).toBe("blocked-by")
    expect(table.byPhrase.get("the root of")).toBe("root-of")
    expect(table.byPhrase.get("comes from")).toBe("derived-from")
    expect(table.inverseOf("blocks")).toBe("blocked-by")
    expect(resolveRelationWord("part-of", table)).toBe("part-of")
    expect(resolveRelationWord("Part of", table)).toBe("part-of")
    expect(resolveRelationWord("nope", table)).toBeUndefined()
  })

  it("drops a phrase two relations claim", () => {
    const t = buildPhraseTable([{ id: "x", label: "with", inverse: "x", inverseLabel: "with" }, { id: "y", label: "with", inverse: "y", inverseLabel: "with" }])
    expect(t.byPhrase.has("with")).toBe(false)
  })

  it("finds A phrase B, with a copula, longest title first", () => {
    const hits = extractRelationSentences("Note. The kitchen sink is part of House! Dentist blocks Tax return.", titles, table, { field: "notes" })
    expect(hits.map((h) => [h.subjectId, h.relation, h.objectId])).toEqual([
      ["kitchen-sink", "part-of", "house"],
      ["dentist", "blocks", "tax"],
    ])
    expect(hits[0]).toMatchObject({ field: "notes", span: "kitchen sink is part of House", phrase: "part of" })
  })

  it("reads a subject-less phrase as the item itself", () => {
    expect(extractRelationSentences("- [ ] blocked by Tax return", titles, table, { selfId: "dentist" })).toEqual([
      expect.objectContaining({ subjectId: "dentist", relation: "blocked-by", objectId: "tax", span: "blocked by Tax return" }),
    ])
    expect(extractRelationSentences("blocked by Tax return", titles, table)).toEqual([])
  })

  it("stays quiet on negation, words between, and unknown titles", () => {
    expect(extractRelationSentences("Dentist is not part of House", titles, table)).toEqual([])
    expect(extractRelationSentences("Dentist blocks my whole Tax return", titles, table)).toEqual([])
    expect(extractRelationSentences("Dentist blocks Groceries", titles, table)).toEqual([])
  })

  it("reads an item's own title past its full name", () => {
    const own = [...titles, { id: "call", title: "Dentist blocked by Tax return" }]
    expect(extractRelationSentences("Dentist blocked by Tax return", own, table, { selfId: "call" })).toEqual([
      expect.objectContaining({ subjectId: "dentist", relation: "blocked-by", objectId: "tax" }),
    ])
  })
})

describe("wiki links", () => {
  it("reads plain, aliased, and typed links", () => {
    const text = "See [[Tax return|taxes]], [[part of::house]], [[frobs::Dentist]], [[Nobody]], [[Kitchen]]."
    expect(extractWikiLinks(text, titles, table, { selfId: "kitchen" }).map((l) => [l.targetId, l.relation, l.typed])).toEqual([
      ["tax", "mentioned", false],
      ["house", "part-of", true],
      ["dentist", "mentioned", false],
    ])
  })
})

describe("date mentions", () => {
  const now = new Date(2026, 10, 1, 9)
  it("normalizes explicit dates to day addresses", () => {
    const hits = extractDateMentions("Filed 2026-10-03, met Oct 3 2026, again 3 October, then October 5th, 2025 and yesterday.", now)
    expect(hits.map((h) => h.address)).toEqual(["day:2026-10-03", "day:2026-10-03", "day:2026-10-03", "day:2025-10-05", "day:2026-10-31"])
    expect(hits[1].span).toBe("Oct 3 2026")
  })
  it("drops impossible and ambiguous dates", () => {
    expect(extractDateMentions("2026-02-30, Feb 30, 3/10, Tuesday, Octopus 3", now)).toEqual([])
  })
})

describe("relation-word shelf source", () => {
  it("offers the written relation above a mention", () => {
    const all = [item("dentist", "Dentist", { notes: "Blocked by Tax return. Ask Sam." }), item("tax", "Tax return"), item("sam", "Sam")]
    const ctx = { all, links: linkIndexOf(all), title: (id: string) => all.find((i) => i.id === id)?.title ?? "" }
    const rows = relationWordSource(all[0], ctx)
    expect(rows).toEqual([expect.objectContaining({ otherId: "tax", relation: "blocked-by", source: "relation-word", score: 1 })])
    expect(rows[0].reason).toBe('Written in the notes: "Blocked by Tax return"')
    const shelf = mergeSuggestions(all[0], [rows, mentionSource(all[0], ctx)], { links: ctx.links })
    expect(shelf.find((s) => s.otherId === "tax")?.source).toBe("relation-word")
    expect(relationWordSource(all[0], { ...ctx, scopeOk: () => false })).toEqual([])
  })

  it("reads a sentence naming this item as the object from this side", () => {
    const all = [item("tax", "Tax return", { body: "Dentist blocks Tax return" }), item("dentist", "Dentist")]
    const ctx = { all, links: linkIndexOf(all), title: (id: string) => all.find((i) => i.id === id)?.title ?? "" }
    expect(relationWordSource(all[0], ctx)).toEqual([expect.objectContaining({ otherId: "dentist", relation: "blocked-by" })])
    expect(allRelations().some((d) => d.id === "blocked-by")).toBe(true)
  })
})

describe("vault extract", () => {
  const now = new Date(2026, 10, 1, 9)
  it("proposes deduped open link rows with reasons and evidence", () => {
    const items = [
      item("dentist", "Dentist", { notes: "Blocked by Tax return. [[part of::House]]" }),
      item("tax", "Tax return", { body: "Tax return blocks Dentist. Kitchen is part of House on 2026-10-03." }),
      item("house", "House"),
      item("kitchen", "Kitchen", { links: [{ id: "l1", relation: "part-of", targetId: "house" }] }),
    ]
    const rows = extractProposals(items, RELATIONS, now)
    expect(rows.map((r) => `${r.sourceId} ${r.relation} ${r.targetId} ${r.origin}`)).toEqual([
      "dentist blocked-by tax extract:relation-word",
      "dentist part-of house extract:wiki-link",
    ])
    expect(rows[0]).toMatchObject({ kind: "link", status: "open", createdAt: now.toISOString(), evidence: { itemId: "dentist", field: "notes", span: "Blocked by Tax return" } })
    expect(rows[0].reason).toBe('Written in the notes of Dentist: "Blocked by Tax return"')
    const withDays = extractProposals(items, RELATIONS, now, { days: true })
    expect(withDays.filter((r) => r.origin === "extract:date").map((r) => [r.sourceId, r.relation, r.targetId])).toEqual([["tax", "mentioned", "day:2026-10-03"]])
  })

  it("skips dismissed and out-of-scope rows", () => {
    const items = [item("a", "Alpha", { notes: "Alpha blocks Beta", dismissedLinkSuggestions: [edgeKey("b", "blocks")] }), item("b", "Beta")]
    expect(extractProposals(items, RELATIONS, now)).toEqual([])
    const scoped = RELATIONS.map((d) => (d.id === "blocks" ? { ...d, toTypes: ["goal"] } : d))
    const fresh = [item("a", "Alpha", { notes: "Alpha blocks Beta" }), item("b", "Beta")]
    expect(extractProposals(fresh, scoped, now, { typeOf: () => "task" })).toEqual([])
    expect(extractProposals(fresh, scoped, now)).toHaveLength(1)
  })
})
