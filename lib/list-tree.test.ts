import { describe, it, expect } from "vitest"
import type { List } from "@/lib/types"
import {
  getParent,
  getAncestors,
  getAncestorIds,
  getChildren,
  getDescendants,
  getDescendantIds,
  isDescendantOf,
  getRootLists,
  getDepth,
  getListPath,
  canMoveList,
  moveList,
  buildListTree,
  flattenListTree,
} from "@/lib/list-tree"

const cat = (id: string, parentListId?: string, order?: number): List => ({
  id,
  name: id.toUpperCase(),
  color: "#000000",
  createdAt: new Date("2026-06-23T00:00:00.000Z"),
  ...(parentListId ? { parentListId } : {}),
  ...(order != null ? { order } : {}),
})

//  root
//  ├─ a
//  │  ├─ a1
//  │  └─ a2
//  └─ b
const sample = (): List[] => [
  cat("root"),
  cat("a", "root"),
  cat("a1", "a"),
  cat("a2", "a"),
  cat("b", "root"),
]

describe("list-tree", () => {
  describe("getParent", () => {
    it("returns the immediate parent", () => {
      expect(getParent(sample(), "a1")?.id).toBe("a")
    })
    it("returns undefined for a root", () => {
      expect(getParent(sample(), "root")).toBeUndefined()
    })
    it("returns undefined for a dangling parent", () => {
      expect(getParent([cat("x", "ghost")], "x")).toBeUndefined()
    })
  })

  describe("getAncestors", () => {
    it("orders nearest parent → root", () => {
      expect(getAncestorIds(sample(), "a1")).toEqual(["a", "root"])
    })
    it("is empty for a root", () => {
      expect(getAncestors(sample(), "root")).toEqual([])
    })
    it("terminates on a cycle without looping forever", () => {
      const cyclic = [cat("x", "y"), cat("y", "x")]
      expect(getAncestorIds(cyclic, "x")).toEqual(["y"])
    })
  })

  describe("getChildren / getDescendants", () => {
    it("returns direct children only", () => {
      expect(getChildren(sample(), "a").map((c) => c.id)).toEqual(["a1", "a2"])
    })
    it("returns all transitive descendants", () => {
      expect(getDescendantIds(sample(), "root").sort()).toEqual(["a", "a1", "a2", "b"])
    })
    it("returns [] for a leaf", () => {
      expect(getDescendants(sample(), "a1")).toEqual([])
    })
    it("is cycle-safe", () => {
      const cyclic = [cat("x", "y"), cat("y", "x")]
      expect(getDescendantIds(cyclic, "x")).toEqual(["y"])
    })
  })

  describe("isDescendantOf", () => {
    it("detects nested descendants", () => {
      expect(isDescendantOf(sample(), "a1", "root")).toBe(true)
      expect(isDescendantOf(sample(), "a1", "a")).toBe(true)
    })
    it("is false for self and unrelated nodes", () => {
      expect(isDescendantOf(sample(), "a", "a")).toBe(false)
      expect(isDescendantOf(sample(), "a", "b")).toBe(false)
    })
  })

  describe("getRootLists", () => {
    it("returns nodes with no resolvable parent", () => {
      expect(getRootLists(sample()).map((c) => c.id)).toEqual(["root"])
    })
    it("treats dangling parents as roots", () => {
      const cats = [cat("a"), cat("orphan", "missing")]
      expect(getRootLists(cats).map((c) => c.id)).toEqual(["a", "orphan"])
    })
  })

  describe("getDepth / getListPath", () => {
    it("computes depth", () => {
      expect(getDepth(sample(), "root")).toBe(0)
      expect(getDepth(sample(), "a")).toBe(1)
      expect(getDepth(sample(), "a1")).toBe(2)
    })
    it("builds a root→self breadcrumb path", () => {
      expect(getListPath(sample(), "a1").map((c) => c.id)).toEqual(["root", "a", "a1"])
    })
    it("returns [] for an unknown id", () => {
      expect(getListPath(sample(), "nope")).toEqual([])
    })
  })

  describe("canMoveList", () => {
    it("allows moving to an unrelated parent", () => {
      expect(canMoveList(sample(), "a1", "b")).toBe(true)
    })
    it("allows detaching to root", () => {
      expect(canMoveList(sample(), "a1", null)).toBe(true)
    })
    it("rejects self-parenting", () => {
      expect(canMoveList(sample(), "a", "a")).toBe(false)
    })
    it("rejects moving under own descendant (cycle)", () => {
      expect(canMoveList(sample(), "a", "a1")).toBe(false)
    })
    it("rejects unknown source or parent", () => {
      expect(canMoveList(sample(), "ghost", "root")).toBe(false)
      expect(canMoveList(sample(), "a", "ghost")).toBe(false)
    })
  })

  describe("moveList", () => {
    it("re-parents and is immutable", () => {
      const cats = sample()
      const next = moveList(cats, "a1", "b")
      expect(next).not.toBe(cats)
      expect(getParent(next, "a1")?.id).toBe("b")
      expect(getParent(cats, "a1")?.id).toBe("a") // original untouched
    })
    it("detaches to root when parent is null", () => {
      const next = moveList(sample(), "a1", null)
      expect(next.find((c) => c.id === "a1")?.parentListId).toBeUndefined()
    })
    it("returns the same reference for an invalid move", () => {
      const cats = sample()
      expect(moveList(cats, "a", "a1")).toBe(cats)
    })
  })

  describe("buildListTree", () => {
    it("nests children under roots", () => {
      const tree = buildListTree(sample())
      expect(tree).toHaveLength(1)
      expect(tree[0].list.id).toBe("root")
      expect(tree[0].children.map((n) => n.list.id)).toEqual(["a", "b"])
      const a = tree[0].children.find((n) => n.list.id === "a")!
      expect(a.depth).toBe(1)
      expect(a.children.map((n) => n.list.id)).toEqual(["a1", "a2"])
    })
    it("orders children by order field", () => {
      const cats = [cat("root"), cat("x", "root", 2), cat("y", "root", 1)]
      const tree = buildListTree(cats)
      expect(tree[0].children.map((n) => n.list.id)).toEqual(["y", "x"])
    })
    it("flattens pre-order with depth", () => {
      const flat = flattenListTree(buildListTree(sample()))
      expect(flat.map((n) => n.list.id)).toEqual(["root", "a", "a1", "a2", "b"])
      expect(flat.map((n) => n.depth)).toEqual([0, 1, 2, 2, 1])
    })
  })
})
