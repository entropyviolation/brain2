import { describe, expect, it } from "vitest"
import { upscaleGrid } from "./upscale"

describe("upscaleGrid", () => {
  it("doubles the size and keeps a plain block whole", () => {
    const out = upscaleGrid(["aa", "aa"])
    expect(out).toEqual(["aaaa", "aaaa", "aaaa", "aaaa"])
  })

  it("rounds the corner of a diagonal and leaves a lone pixel square", () => {
    const out = upscaleGrid([".a.", "aa.", "..."])
    expect(out).toHaveLength(6)
    expect(out.every((row) => row.length === 6)).toBe(true)
    expect(upscaleGrid(["...", ".k.", "..."]).slice(2, 4).map((r) => r.slice(2, 4))).toEqual(["kk", "kk"])
  })
})
