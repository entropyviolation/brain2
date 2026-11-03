import { describe, expect, it } from "vitest"
import { combine, combineLists, combineSteps, difference, intersection, union } from "./list-sets"

type Row = { id: string; lists?: string[] }
const items: Row[] = [
  { id: "1", lists: ["a"] },
  { id: "2", lists: ["a", "b"] },
  { id: "3", lists: ["b"] },
  { id: "4", lists: ["a", "b", "c"] },
  { id: "5", lists: undefined },
]
const ids = (rows: Row[]) => rows.map((r) => r.id)

describe("list-sets", () => {
  it("union is on any list", () => expect(ids(union(items, ["a", "c"]))).toEqual(["1", "2", "4"]))
  it("intersection is on every list", () => expect(ids(intersection(items, ["a", "b"]))).toEqual(["2", "4"]))
  it("difference is on the first and none of the rest", () => expect(ids(difference(items, ["a", "b", "c"]))).toEqual(["1"]))
  it("takes more than two lists", () => expect(ids(intersection(items, ["a", "b", "c"]))).toEqual(["4"]))
  it("no lists gives nothing", () => {
    expect(union(items, [])).toEqual([])
    expect(combine("difference", items, [])).toEqual([])
  })
  it("combines an expression and shows counts per step", () => {
    const expr = { all: ["a"], none: ["c"] }
    expect(ids(combineLists(items, expr))).toEqual(["1", "2"])
    expect(combineSteps(items, expr, (id) => id.toUpperCase()).map((s) => s.count)).toEqual([5, 3, 2])
  })
  it("any narrows to a union", () => expect(ids(combineLists(items, { any: ["b", "c"] }))).toEqual(["2", "3", "4"]))
})
