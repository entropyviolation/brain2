import { describe, expect, it } from "vitest"
import { bimGraph, itemGraph, namedIn, nameIndex, searchItems } from "./build"
import type { BimLine } from "@/lib/ingest/bim-chat"
import type { ItemRecord } from "@/lib/types"

const item = (id: string, title: string, extra: Partial<ItemRecord> = {}): ItemRecord =>
  ({ id, title, description: title, stage: "list", lists: [], completed: false, createdAt: new Date(2026, 10, 1), ...extra }) as unknown as ItemRecord

const now = new Date(2026, 10, 24, 12)
const project = item("fox", "Foxtide CDs", {
  deadline: new Date(2026, 10, 20),
  subtasks: [{ id: "s1", description: "print sleeves", completed: true }, { id: "s2", description: "ship boxes", completed: false }],
  noteLog: [{ id: "n1", date: "2026-11-22", text: "client wants matte" }],
  links: [{ id: "l1", targetId: "elijah", relation: "related" }],
  lists: ["work"],
} as Partial<ItemRecord>)
const elijah = item("elijah", "Elijah Stone", { personProfile: { fullName: "Elijah Stone" } } as Partial<ItemRecord>)
const art = item("art", "Cover art", { parentTaskId: "fox", completed: true } as Partial<ItemRecord>)
const all = [project, elijah, art]

describe("itemGraph", () => {
  it("draws an item with its parts, steps, link, list, deadline and note", () => {
    const g = itemGraph("fox", all, [{ id: "work", name: "Work" }], now)
    const kinds = Object.fromEntries(g.nodes.map((n) => [n.id, n.kind]))
    expect(kinds.fox).toBe("project")
    expect(kinds.art).toBe("item")
    expect(kinds.elijah).toBe("person")
    expect(g.nodes.filter((n) => n.kind === "step")).toHaveLength(2)
    expect(g.nodes.some((n) => n.kind === "list" && n.label === "Work")).toBe(true)
    expect(g.nodes.some((n) => n.kind === "note" && n.label.includes("matte"))).toBe(true)
    const center = g.nodes.find((n) => n.id === "fox")!
    expect(center.facts).toContain("1 of 1 parts done")
    expect(center.facts).toContain("1 of 2 steps done")
    expect(center.facts.some((f) => f.includes("overdue"))).toBe(true)
    expect(g.edges.every((e) => e.a === "fox")).toBe(true)
  })

  it("adds items that mention it and chat turns that named it", () => {
    const mail = item("mail", "Mail the Foxtide CDs")
    const lines: BimLine[] = [{ id: "y9", at: now.toISOString(), who: "you", text: "foxtide cds are extremely overdue" }]
    const g = itemGraph("fox", [...all, mail], [], now, lines)
    expect(g.edges).toEqual(expect.arrayContaining([{ a: "fox", b: "mail", label: "mentions it" }, { a: "fox", b: "turn:y9", label: "said in chat" }]))
  })

  it("an unknown center is an empty graph", () => {
    expect(itemGraph("nope", all).nodes).toEqual([])
  })
})

describe("names in chat", () => {
  it("finds whole titles and a person's unique first name", () => {
    const index = nameIndex(all)
    expect(namedIn("are the foxtide cds done? ask elijah", index)).toEqual(["fox", "elijah"])
    expect(namedIn("elijahs", index)).toEqual([])
  })
})

describe("bimGraph", () => {
  it("links hub → lane → turn → named items and evidence", () => {
    const lines: BimLine[] = [
      { id: "y1", at: now.toISOString(), who: "you", text: "when is Foxtide CDs due?" },
      { id: "b1", at: now.toISOString(), who: "bim", text: "Nov 20.", replyTo: "y1", route: "ASK · code · 1.2s", evidence: ["Foxtide CDs deadline Nov 20"], traceId: "tr-1" },
    ]
    const g = bimGraph(lines, all, now)
    const ids = g.nodes.map((n) => n.id)
    expect(ids).toEqual(expect.arrayContaining(["bim", "lane:ASK", "turn:y1", "fox", "ev:y1:0"]))
    expect(g.nodes.find((n) => n.id === "turn:y1")?.traceId).toBe("tr-1")
    expect(g.edges).toEqual(expect.arrayContaining([{ a: "bim", b: "lane:ASK", label: undefined }, { a: "turn:y1", b: "fox", label: "named" }]))
  })
})

describe("searchItems", () => {
  it("puts people first", () => {
    expect(searchItems("e", all)).toEqual([])
    expect(searchItems("st", all).map((t) => t.id)[0]).toBe("elijah")
  })
})
