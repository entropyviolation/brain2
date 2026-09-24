import { describe, it, expect } from "vitest"
import { chunkTelegramText } from "./chunk-text"

describe("chunkTelegramText", () => {
  it("returns a single chunk when short", () => {
    expect(chunkTelegramText("hello")).toEqual(["hello"])
  })

  it("splits on newlines before the cap", () => {
    const text = `${"a".repeat(20)}\n${"b".repeat(20)}\n${"c".repeat(20)}`
    expect(chunkTelegramText(text, 30)).toEqual(["a".repeat(20), "b".repeat(20), "c".repeat(20)])
  })

  it("hard-splits a line longer than the cap", () => {
    const text = "x".repeat(50)
    const parts = chunkTelegramText(text, 20)
    expect(parts.join("")).toBe(text)
    expect(parts.every((p) => p.length <= 20)).toBe(true)
  })
})
