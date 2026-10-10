import { describe, expect, it } from "vitest"
import {
  formatSpendAmount,
  parseSpendAmount,
  spendAmountInput,
  spendSourceOptions,
  summarizeSpend,
} from "./spend"

describe("parseSpendAmount", () => {
  it("reads dollars and cents", () => {
    expect(parseSpendAmount("4.50")).toBe(450)
    expect(parseSpendAmount("$4.50")).toBe(450)
    expect(parseSpendAmount("4.5")).toBe(450)
    expect(parseSpendAmount("12")).toBe(1200)
    expect(parseSpendAmount("1,200.00")).toBe(120000)
    expect(parseSpendAmount("  $0.50 ")).toBe(50)
  })

  it("rejects empty, zero, and other text", () => {
    expect(parseSpendAmount("")).toBeNull()
    expect(parseSpendAmount("   ")).toBeNull()
    expect(parseSpendAmount("0")).toBeNull()
    expect(parseSpendAmount("0.00")).toBeNull()
    expect(parseSpendAmount("-4")).toBeNull()
    expect(parseSpendAmount("abc")).toBeNull()
    expect(parseSpendAmount("4.555")).toBeNull()
    expect(parseSpendAmount("12.")).toBeNull()
  })
})

describe("formatSpendAmount", () => {
  it("prints grouped dollars", () => {
    expect(formatSpendAmount(450)).toBe("$4.50")
    expect(formatSpendAmount(120000)).toBe("$1,200.00")
    expect(spendAmountInput(450)).toBe("4.50")
    expect(spendAmountInput(undefined)).toBe("")
  })
})

describe("summarizeSpend", () => {
  it("totals by source and by what", () => {
    const summary = summarizeSpend([
      { spendAmount: 450, spendOn: "Coffee", spendSource: "Cash" },
      { spendAmount: 800, spendOn: "Groceries", spendSource: "Card" },
      { spendAmount: 200, spendOn: "Coffee", spendSource: "Cash" },
      { spendAmount: 0, spendOn: "Skip", spendSource: "Cash" },
    ])
    expect(summary.total).toBe(1450)
    expect(summary.bySource).toEqual([
      { label: "Card", amount: 800 },
      { label: "Cash", amount: 650 },
    ])
    expect(summary.byWhat).toEqual([
      { label: "Groceries", amount: 800 },
      { label: "Coffee", amount: 650 },
    ])
  })

  it("offers sources already used, then cash, card, and account", () => {
    expect(spendSourceOptions([{ spendSource: "Alex" }, { spendSource: "cash" }])).toEqual([
      "Alex",
      "cash",
      "Card",
      "Account",
    ])
  })
})
