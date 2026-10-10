import { describe, expect, it } from "vitest"
import { formatCrtNumber } from "@/lib/crt-number"

describe("formatCrtNumber", () => {
  it("keeps integers and one-decimal values", () => {
    expect(formatCrtNumber(1960)).toBe("1960")
    expect(formatCrtNumber(12.5)).toBe("12.5")
  })

  it("kills float trails", () => {
    expect(formatCrtNumber(1960.0000000000002)).toBe("1960")
    expect(formatCrtNumber(0.1 + 0.2)).toBe("0.3")
  })

  it("marks non-finite as em dash", () => {
    expect(formatCrtNumber(Number.NaN)).toBe("—")
    expect(formatCrtNumber(Number.POSITIVE_INFINITY)).toBe("—")
  })
})
