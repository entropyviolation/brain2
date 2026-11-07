import { describe, expect, it } from "vitest"
import { chunkText, gateChunk } from "./book"

describe("chunkText", () => {
  it("covers the text without gaps and prefers paragraph breaks", () => {
    const text = Array.from({ length: 30 }, (_, i) => `Paragraph ${i} ${"word ".repeat(40)}`).join("\n\n")
    const cuts = chunkText(text, 1000)
    expect(cuts[0]!.from).toBe(0)
    expect(cuts.at(-1)!.to).toBe(text.length)
    cuts.slice(1).forEach((c, k) => expect(c.from).toBe(cuts[k]!.to))
    expect(text.slice(cuts[0]!.to - 2, cuts[0]!.to)).toBe("\n\n")
  })
})

describe("gateChunk", () => {
  it("reads the yes/no answer and keeps the chunk when unsure", async () => {
    expect((await gateChunk(async () => ({ useful: false }), "m", "x")).useful).toBe(false)
    expect((await gateChunk(async () => null, "m", "x")).useful).toBe(true)
    expect((await gateChunk(async () => { throw new Error("down") }, "m", "x")).useful).toBe(true)
  })
})
