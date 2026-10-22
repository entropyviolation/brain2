import { describe, expect, it } from "vitest"
import { formatHandle, isEmailHandle, normalizeHandle } from "./handles"

describe("normalizeHandle", () => {
  it("puts every spelling of one US number on one handle", () => {
    for (const s of ["+15551234567", "(555) 123-4567", "555.123.4567", "1 555 123 4567", "+1 (555) 123-4567"]) {
      expect(normalizeHandle(s)).toBe("+15551234567")
    }
  })

  it("keeps foreign numbers, short codes, and emails apart", () => {
    expect(normalizeHandle("+44 20 7946 0958")).toBe("+442079460958")
    expect(normalizeHandle("0044 20 7946 0958")).toBe("+442079460958")
    expect(normalizeHandle("72975")).toBe("72975")
    expect(normalizeHandle(" Jane@Example.COM ")).toBe("jane@example.com")
    expect(isEmailHandle("jane@example.com")).toBe(true)
    expect(normalizeHandle("")).toBe("")
  })

  it("formats an unknown US number for a pen name", () => {
    expect(formatHandle("5551234567")).toBe("+1 (555) 123-4567")
    expect(formatHandle("72975")).toBe("72975")
  })
})
