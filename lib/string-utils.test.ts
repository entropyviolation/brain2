import { describe, expect, it } from "vitest"
import { hashString, hashIconSlot } from "@/lib/string-utils"

describe("hashString", () => {
  it("returns a stable hash for the same input", () => {
    expect(hashString("abc")).toBe(hashString("abc"))
  })

  it("returns different hashes for different inputs", () => {
    expect(hashString("a")).not.toBe(hashString("b"))
  })
})

describe("hashIconSlot", () => {
  it("returns positions within the grid bounds", () => {
    const pos = hashIconSlot("list-123")
    expect(pos.x).toBeGreaterThanOrEqual(16)
    expect(pos.y).toBeGreaterThanOrEqual(16)
  })

  it("is stable for the same key", () => {
    expect(hashIconSlot("folder-1")).toEqual(hashIconSlot("folder-1"))
  })
})
