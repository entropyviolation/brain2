import { describe, it, expect } from "vitest"
import { resolveName, scoreName, splitNameAndRest } from "./name-resolve"

const habits = [
  { id: "task-2", name: "Exercise for at least 30 minutes" },
  { id: "task-4", name: "Drink water" },
  { id: "task-7", name: "Chess match score (+10/day)" },
  { id: "task-7-puzzle", name: "Chess puzzle score (+10/day)" },
]

describe("name resolve", () => {
  it("matches a distinctive word inside a longer habit name", () => {
    const r = resolveName("exercise", habits)
    expect(r.status).toBe("match")
    if (r.status === "match") expect(r.candidate.id).toBe("task-2")
  })

  it("calls chess ambiguous when both match and puzzle match", () => {
    const r = resolveName("chess", habits)
    expect(r.status).toBe("ambiguous")
  })

  it("returns none for garbage", () => {
    expect(resolveName("xyzzy", habits).status).toBe("none")
  })

  it("splits a known name from a trailing value", () => {
    const split = splitNameAndRest("exercise 30", habits)
    expect(split.query.toLowerCase()).toContain("exercise")
    expect(split.rest).toBe("30")
  })

  it("scores exact names highest", () => {
    expect(scoreName("Drink water", "Drink water")).toBe(1)
  })

  it("does not match on a shared stopword alone", () => {
    // These five all scored 0.55 on "to" and became a five-way picker.
    const lists = [
      { id: "l1", name: "books i want to own" },
      { id: "l2", name: "facebook marketplace items to really follow up on" },
      { id: "l3", name: "flights to book" },
      { id: "l4", name: "furniture to get" },
    ]
    for (const list of lists) expect(scoreName("iphone notes to brain2", list.name)).toBe(0)
    expect(resolveName("iphone notes to brain2", lists).status).toBe("none")
  })

  it("still matches when a real word lands beside the stopword", () => {
    expect(scoreName("flights to tokyo", "flights to book")).toBeGreaterThan(0.55)
  })
})
