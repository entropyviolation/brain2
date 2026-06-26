import { describe, it, expect } from "vitest"
import {
  findAffirmationsCategory,
  affirmationText,
  getAffirmationItems,
  pickRandom,
  DEFAULT_AFFIRMATIONS,
  AFFIRMATIONS_PER_SESSION,
} from "./affirmations"
import type { Task, List } from "@/lib/types"

const cat = (over: Partial<List>): List => ({
  id: "c",
  name: "List",
  color: "#fff",
  createdAt: new Date(),
  ...over,
})

const task = (over: Partial<Task>): Task => ({
  id: "t",
  description: "desc",
  stage: "list",
  createdAt: new Date(),
  completed: false,
  lists: [],
  ...over,
})

describe("findAffirmationsCategory", () => {
  it("matches by name case-insensitively, trimming whitespace", () => {
    const cats = [cat({ id: "a", name: "Books" }), cat({ id: "b", name: "  affirmations " })]
    expect(findAffirmationsCategory(cats)?.id).toBe("b")
  })

  it("returns undefined when no Affirmations list exists", () => {
    expect(findAffirmationsCategory([cat({ name: "Habits" })])).toBeUndefined()
  })
})

describe("affirmationText", () => {
  it("prefers title over description", () => {
    expect(affirmationText(task({ title: "I am bold", description: "old" }))).toBe("I am bold")
  })

  it("falls back to description and trims", () => {
    expect(affirmationText(task({ title: undefined, description: "  I am here  " }))).toBe("I am here")
  })
})

describe("getAffirmationItems", () => {
  it("returns active items in the list with non-empty text", () => {
    const tasks = [
      task({ id: "1", title: "I am calm", lists: ["aff"] }),
      task({ id: "2", title: "done one", lists: ["aff"], completed: true }),
      task({ id: "3", title: "", description: "", lists: ["aff"] }),
      task({ id: "4", title: "other list", lists: ["x"] }),
    ]
    expect(getAffirmationItems(tasks, "aff").map((t) => t.id)).toEqual(["1"])
  })
})

describe("pickRandom", () => {
  it("returns n distinct items from the source", () => {
    const picked = pickRandom([1, 2, 3, 4, 5, 6], 3)
    expect(picked).toHaveLength(3)
    expect(new Set(picked).size).toBe(3)
    picked.forEach((p) => expect([1, 2, 3, 4, 5, 6]).toContain(p))
  })

  it("caps at the source length", () => {
    expect(pickRandom([1, 2], 5)).toHaveLength(2)
    expect(pickRandom([], 3)).toEqual([])
    expect(pickRandom([1, 2, 3], 0)).toEqual([])
  })

  it("is deterministic with an injected rng", () => {
    const rng = () => 0 // always swaps toward index 0
    expect(pickRandom([10, 20, 30], 2, rng)).toEqual(pickRandom([10, 20, 30], 2, rng))
  })
})

describe("defaults", () => {
  it("ship enough affirmations to fill a session", () => {
    expect(DEFAULT_AFFIRMATIONS.length).toBeGreaterThanOrEqual(AFFIRMATIONS_PER_SESSION)
    DEFAULT_AFFIRMATIONS.forEach((a) => expect(a.length).toBeGreaterThan(0))
  })
})
