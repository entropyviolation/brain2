import { describe, expect, it } from "vitest"
import { normalizeHandle } from "./handles"
import { normalizeHandleMjs } from "./contact-names.mjs"

describe("normalizeHandleMjs", () => {
  it("spells handles like normalizeHandle", () => {
    for (const h of ["+15551234567", "(555) 123-4567", "555.123.4567", "15551234567", "Some@Mail.com", "12345", "0044 20 7946 0958", ""]) {
      expect(normalizeHandleMjs(h)).toBe(normalizeHandle(h))
    }
  })
})
