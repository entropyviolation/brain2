import { describe, it, expect } from "vitest"
import { parseReceiptLines, looksLikeReceipt, receiptScore } from "./receipt-parse"

const RECEIPT = `WHOLE FOODS MARKET
Store #104
(555) 010-0199
MILK 2% GAL          4.99
ORG BANANAS          1.29
2x BREAD SOURDOUGH   8.98
SUBTOTAL            15.26
TAX                  1.12
TOTAL               16.38
VISA XXXX1234       16.38
THANK YOU
`

describe("parseReceiptLines", () => {
  it("keeps product names and drops totals", () => {
    const lines = parseReceiptLines(RECEIPT)
    expect(lines.map((row) => row.name.toLowerCase())).toEqual(
      expect.arrayContaining(["milk 2% gal", "org bananas", "bread sourdough"]),
    )
    expect(lines.find((row) => /sourdough/i.test(row.name))?.qty).toBe(2)
    expect(lines.some((row) => /total/i.test(row.name))).toBe(false)
    expect(looksLikeReceipt(RECEIPT)).toBe(true)
    expect(receiptScore("Dear diary\nI walked to the lake and thought about milk.")).toBeLessThan(3)
  })
})
