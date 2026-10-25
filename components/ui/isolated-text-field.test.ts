import { describe, expect, it } from "vitest"
import { textareaSizeMemory } from "@/components/ui/isolated-text-field"

describe("textareaSizeMemory", () => {
  it("stores a height and reads it back", () => {
    textareaSizeMemory.write("k", 180)
    expect(textareaSizeMemory.read("k")).toBe(180)
  })
})
