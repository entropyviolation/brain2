/**
 * lib/pen-tree.test.ts — Parent/child rollup for Tracking pens
 */
import { describe, expect, it } from "vitest"
import type { TreePen } from "./pen-tree"
import {
  ancestorChain,
  DEFAULT_DEPTH_LABELS,
  depthOptions,
  maxTreeDepth,
  penAtDepth,
  validParents,
  wouldCycle,
} from "./pen-tree"

const mexico: TreePen = { id: "mx", name: "Mexico", color: "#c00" }
const out: TreePen = { id: "out", name: "Out", color: "#f90", parentId: "mx" }
const park: TreePen = { id: "park", name: "At the park", color: "#0a0", parentId: "out" }
const balboa: TreePen = { id: "balboa", name: "Balboa Park", color: "#06c", parentId: "park" }
const pens = [mexico, out, park, balboa]

describe("pen tree", () => {
  it("walks root to leaf", () => {
    expect(ancestorChain(pens, "balboa").map((p) => p.id)).toEqual(["mx", "out", "park", "balboa"])
  })

  it("collapses to the requested depth and stays put when shallower", () => {
    expect(penAtDepth(pens, "balboa", 0)?.name).toBe("Mexico")
    expect(penAtDepth(pens, "balboa", 1)?.name).toBe("Out")
    expect(penAtDepth(pens, "balboa", 2)?.name).toBe("At the park")
    expect(penAtDepth(pens, "balboa", 3)?.name).toBe("Balboa Park")
    expect(penAtDepth(pens, "balboa", null)?.name).toBe("Balboa Park")
    expect(penAtDepth(pens, "mx", 2)?.name).toBe("Mexico")
  })

  it("refuses a parent that would loop", () => {
    expect(wouldCycle(pens, "mx", "balboa")).toBe(true)
    expect(wouldCycle(pens, "balboa", "mx")).toBe(false)
    expect(wouldCycle(pens, "park", "park")).toBe(true)
    expect(validParents(pens, "mx").map((p) => p.id)).toEqual([])
  })

  it("names Exact as the finest button", () => {
    const options = depthOptions(pens, ["Country", "Area", "Place", "Exact"])
    expect(options[0]).toEqual({ depth: 0, label: "Country" })
    expect(options.at(-1)).toEqual({ depth: null, label: "Exact" })
    expect(maxTreeDepth(pens)).toBe(3)
  })

  it("labels Screen Time rungs Category / App / Exact", () => {
    expect(DEFAULT_DEPTH_LABELS.screentime).toEqual(["Category", "App", "Exact"])
    expect(DEFAULT_DEPTH_LABELS["iphone-screentime"]).toEqual(["Category", "App", "Exact"])
    expect(DEFAULT_DEPTH_LABELS["iphone-calls"]).toEqual(["Who", "Exact"])
    expect(DEFAULT_DEPTH_LABELS["iphone-texts"]).toEqual(["Who", "Exact"])
  })
})
