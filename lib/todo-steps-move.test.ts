import { describe, expect, it } from "vitest"
import type { Subtask } from "@/lib/types"
import { moveSteps, stepParentId, topMostSelected } from "@/lib/todo-steps"

const s = (id: string, kids?: Subtask[], extra: Partial<Subtask> = {}): Subtask => ({
  id,
  description: id,
  completed: false,
  ...(kids ? { subtasks: kids } : {}),
  ...extra,
})
const shape = (list: Subtask[]): unknown => list.map((x) => (x.subtasks?.length ? { [x.id]: shape(x.subtasks) } : x.id))

describe("moveSteps", () => {
  const tree = () => [s("a", [s("a1"), s("a2")]), s("b"), s("c", [s("c1")], { dependsOn: ["b"] })]

  it("reorders before and after, keeping children and fields", () => {
    expect(shape(moveSteps(tree(), ["c"], { id: "a", where: "before" }))).toEqual([{ c: ["c1"] }, { a: ["a1", "a2"] }, "b"])
    const moved = moveSteps(tree(), ["a1"], { id: "b", where: "after" })
    expect(shape(moved)).toEqual([{ a: ["a2"] }, "b", "a1", { c: ["c1"] }])
    expect(moved.find((x) => x.id === "c")!.dependsOn).toEqual(["b"])
  })

  it("nests onto a row, as its last child", () => {
    expect(shape(moveSteps(tree(), ["b"], { id: "a", where: "inside" }))).toEqual([{ a: ["a1", "a2", "b"] }, { c: ["c1"] }])
    expect(shape(moveSteps(tree(), ["b"], { where: "end", parentId: "c" }))).toEqual([{ a: ["a1", "a2"] }, { c: ["c1", "b"] }])
  })

  it("moves a multi-selection by its top-most steps, in tree order", () => {
    expect(topMostSelected(tree(), ["c1", "a", "a2", "c"])).toEqual(["a", "c"])
    expect(shape(moveSteps(tree(), ["c", "a2", "b"], { id: "a1", where: "before" }))).toEqual([{ a: ["a2", "b", { c: ["c1"] }, "a1"] }])
  })

  it("refuses a step into itself or its descendant, and a missing target", () => {
    const t = tree()
    expect(moveSteps(t, ["a"], { id: "a1", where: "inside" })).toBe(t)
    expect(moveSteps(t, ["a"], { id: "a", where: "after" })).toBe(t)
    expect(moveSteps(t, ["a"], { where: "end", parentId: "a2" })).toBe(t)
    expect(moveSteps(t, ["b"], { id: "nope", where: "before" })).toBe(t)
    expect(moveSteps(t, [], { id: "a", where: "before" })).toBe(t)
  })

  it("finds a parent", () => {
    expect(stepParentId(tree(), "c1")).toBe("c")
    expect(stepParentId(tree(), "b")).toBeNull()
    expect(stepParentId(tree(), "zz")).toBeUndefined()
  })
})
