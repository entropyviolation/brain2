import { describe, it, expect } from "vitest"
import { searchItems, displayTitle, type SearchResult } from "@/lib/search"
import type { Item, Task } from "@/lib/types"

/** Minimal Task factory — only the fields search cares about. */
function task(partial: Partial<Task> & { id: string }): Task {
  return {
    category: "list",
    createdAt: new Date("2024-01-01"),
    completed: false,
    categories: [],
    description: "",
    ...partial,
  } as Task
}

function ids(results: SearchResult[]): string[] {
  return results.map((r) => r.item.id)
}

describe("searchItems — basics", () => {
  it("returns [] for an empty query", () => {
    const items = [task({ id: "a", description: "Buy milk" })]
    expect(searchItems("", items)).toEqual([])
    expect(searchItems("   ", items)).toEqual([])
  })

  it("returns [] when nothing matches", () => {
    const items = [task({ id: "a", description: "Buy milk" })]
    expect(searchItems("xyzzy", items)).toEqual([])
  })

  it("is case-insensitive", () => {
    const items = [task({ id: "a", description: "Buy Milk" })]
    expect(ids(searchItems("milk", items))).toEqual(["a"])
    expect(ids(searchItems("MILK", items))).toEqual(["a"])
    expect(ids(searchItems("MiLk", items))).toEqual(["a"])
  })

  it("matches on the title/description field", () => {
    const items = [
      task({ id: "a", description: "Write report" }),
      task({ id: "b", description: "Read book" }),
    ]
    expect(ids(searchItems("report", items))).toEqual(["a"])
  })

  it("matches the generic Item.title field", () => {
    const items: Item[] = [{ id: "n1", title: "Project Roadmap", createdAt: new Date() }]
    expect(ids(searchItems("roadmap", items))).toEqual(["n1"])
  })
})

describe("searchItems — ranking (title beats tag beats notes)", () => {
  it("title match outranks tag match outranks notes match", () => {
    const items = [
      task({ id: "notes", description: "Unrelated", notes: "remember the alpha plan" }),
      task({ id: "tag", description: "Unrelated", tags: ["alpha"] }),
      task({ id: "title", description: "alpha launch" }),
    ]
    const results = searchItems("alpha", items)
    expect(ids(results)).toEqual(["title", "tag", "notes"])
    // Scores strictly decrease across the three field tiers.
    expect(results[0].score).toBeGreaterThan(results[1].score)
    expect(results[1].score).toBeGreaterThan(results[2].score)
  })

  it("reports matchedOn for the field that contributed", () => {
    const items = [
      task({ id: "title", description: "alpha" }),
      task({ id: "tag", description: "z", tags: ["alpha"] }),
      task({ id: "attr", description: "z", notes: "alpha" }),
    ]
    const byId = Object.fromEntries(searchItems("alpha", items).map((r) => [r.item.id, r]))
    expect(byId["title"].matchedOn).toEqual(["title"])
    expect(byId["tag"].matchedOn).toEqual(["tag"])
    expect(byId["attr"].matchedOn).toEqual(["attribute"])
  })

  it("gives an exact-title match the top score", () => {
    const items = [
      task({ id: "exact", description: "report" }),
      task({ id: "prefix", description: "report draft" }),
      task({ id: "mid", description: "the quarterly report draft" }),
    ]
    const results = searchItems("report", items)
    expect(results[0].item.id).toBe("exact")
    expect(results[0].score).toBeGreaterThan(results[1].score)
    expect(results[1].score).toBeGreaterThan(results[2].score)
  })
})

describe("searchItems — multi-term AND", () => {
  it("requires every term to match somewhere", () => {
    const items = [
      task({ id: "both", description: "buy milk and bread" }),
      task({ id: "one", description: "buy milk" }),
    ]
    expect(ids(searchItems("milk bread", items))).toEqual(["both"])
  })

  it("terms can match across different fields", () => {
    const items = [
      task({ id: "split", description: "buy milk", tags: ["urgent"] }),
      task({ id: "title-only", description: "buy milk" }),
    ]
    // "milk" hits title, "urgent" hits tag — only `split` has both.
    expect(ids(searchItems("milk urgent", items))).toEqual(["split"])
  })

  it("accumulates score across terms", () => {
    const items = [
      task({ id: "two", description: "alpha beta" }),
      task({ id: "one", description: "alpha gamma", tags: ["beta"] }),
    ]
    const results = searchItems("alpha beta", items)
    // `two` matches both terms in the title; `one` matches title + tag.
    expect(ids(results)).toEqual(["two", "one"])
    expect(results[0].score).toBeGreaterThan(results[1].score)
  })
})

describe("searchItems — tags and attributes", () => {
  it("matches a tag value", () => {
    const items = [task({ id: "a", description: "thing", tags: ["work", "errand"] })]
    expect(ids(searchItems("errand", items))).toEqual(["a"])
  })

  it("matches free-text attribute fields (why/context/attributes)", () => {
    const items = [
      task({ id: "why", description: "z", why: "because it matters" }),
      task({ id: "ctx", description: "z", context: "@home" }),
      task({ id: "attr", description: "z", attributes: { author: "Tolkien" } }),
    ]
    expect(ids(searchItems("matters", items))).toEqual(["why"])
    expect(ids(searchItems("home", items))).toEqual(["ctx"])
    expect(ids(searchItems("tolkien", items))).toEqual(["attr"])
  })
})

describe("searchItems — determinism & options", () => {
  it("is deterministic with a stable tie-break (title asc, then id asc)", () => {
    const items = [
      task({ id: "b", description: "alpha" }),
      task({ id: "a", description: "alpha" }),
    ]
    // Equal scores + equal titles → ordered by id asc.
    expect(ids(searchItems("alpha", items))).toEqual(["a", "b"])
  })

  it("respects the limit option", () => {
    const items = [
      task({ id: "a", description: "alpha one" }),
      task({ id: "b", description: "alpha two" }),
      task({ id: "c", description: "alpha three" }),
    ]
    expect(searchItems("alpha", items, { limit: 2 })).toHaveLength(2)
    expect(searchItems("alpha", items, { limit: 0 })).toHaveLength(0)
  })
})

describe("displayTitle", () => {
  it("prefers title, then description, then id", () => {
    expect(displayTitle({ id: "x", title: "T", createdAt: new Date() })).toBe("T")
    expect(displayTitle(task({ id: "x", description: "D" }))).toBe("D")
    expect(displayTitle({ id: "x", createdAt: new Date() })).toBe("x")
  })
})
