import { beforeEach, describe, expect, it } from "vitest"
import { parseStatementCsv } from "./bank-statement"
import { budgetRows } from "./budget-math"
import { EMPTY_MONEY_BOOK, sanitizeMoneyBook, useBudgetStore } from "./budget-store"
import { applyMoneyPhrase } from "./money-apply"
import { debtStoredAsAccount, envelopeReading, gigExpectedPay, gigPayWhenFinished, nextBillDate } from "./money-book"
import { parseMoneyPhrase } from "./money-parse"
import { useTimeTrackingStore } from "./time-tracking-store"
import { resetAllStores } from "@/tests/test-utils"

const day = "2026-10-28"

function phrase(line: string) {
  const parsed = parseMoneyPhrase(line, day)
  if (!parsed.ok) throw new Error(parsed.reason)
  return parsed.phrase
}

describe("money book", () => {
  beforeEach(() => {
    resetAllStores()
    useBudgetStore.setState({ ...EMPTY_MONEY_BOOK })
  })

  it("keeps an older budget line and drops a debt filed as an account", () => {
    const book = sanitizeMoneyBook({
      lines: [{ id: "pay", date: "2026-10-01", name: "Pay", cents: 100, kind: "earning", source: "Cash" }],
      accounts: [{ id: "bad", name: "Elijah", kind: "debt" }],
      debts: [{ id: "elijah", who: "Elijah", direction: "owe", cents: 4000 }],
    })
    expect(book.lines).toHaveLength(1)
    expect(book.lines[0]).toMatchObject({ name: "Pay", cents: 100, kind: "earning" })
    expect(book.accounts).toEqual([])
    expect(book.debts).toEqual([{ id: "elijah", who: "Elijah", direction: "owe", cents: 4000 }])
    expect(book.bills).toEqual([])
  })

  it("stores an earning in cash and a debt that is not an account", () => {
    applyMoneyPhrase(phrase("earned $970 cash"))
    applyMoneyPhrase(phrase("owe Elijah $40"))
    const book = useBudgetStore.getState()
    expect(book.lines[0]).toMatchObject({ kind: "earning", cents: 97000, source: "Cash", name: "Earned" })
    expect(book.accounts).toEqual([expect.objectContaining({ name: "Cash", kind: "cash" })])
    expect(book.debts[0]).toMatchObject({ who: "Elijah", direction: "owe", cents: 4000 })
    expect(debtStoredAsAccount(book.accounts, book.debts)).toBe(false)
  })

  it("logs a spend on the tracking log", () => {
    applyMoneyPhrase(phrase("spent $12 coffee"))
    const saved = useTimeTrackingStore.getState().entries.find((entry) => entry.eventKind === "spend")
    expect(saved).toMatchObject({ spendAmount: 1200, spendOn: "Coffee", spendSource: "Cash", date: day })
  })

  it("keeps a monthly bill and names the next due date", () => {
    applyMoneyPhrase(phrase("bill rent $1400 monthly"))
    const bill = useBudgetStore.getState().bills[0]
    expect(bill).toMatchObject({ name: "Rent", cents: 140000, cadence: "monthly" })
    expect(nextBillDate({ cadence: "monthly", day: 1 }, day)).toBe("2026-11-01")
    expect(nextBillDate({ cadence: "weekly" }, day)).toBe("2026-11-04")
    expect(nextBillDate({ cadence: "yearly" }, day)).toBe("2027-10-28")
  })

  it("measures a budget against spending that wears its name", () => {
    applyMoneyPhrase(phrase("budget groceries $400"))
    const envelope = useBudgetStore.getState().envelopes[0]
    const reading = envelopeReading(
      envelope,
      [
        { name: "Groceries", cents: 12500, kind: "spend", date: "2026-10-03", expected: false },
        { name: "Groceries", cents: 8000, kind: "spend", date: "2026-11-01", expected: false },
        { name: "Dinner", cents: 8000, kind: "spend", date: "2026-10-28", expected: true },
      ],
      "2026-10",
    )
    expect(reading).toEqual({ spent: 12500, left: 27500 })
  })

  it("counts gig pay until the gig is paid", () => {
    applyMoneyPhrase(phrase("gig mix $500"))
    const gig = useBudgetStore.getState().gigs[0]
    expect(gigPayWhenFinished(gig)).toBe(50000)
    expect(gigExpectedPay([gig, { cents: 20000, status: "finished" }, { cents: 90000, status: "paid" }])).toBe(70000)
    useBudgetStore.getState().setGigStatus(gig.id, "paid")
    expect(gigPayWhenFinished(useBudgetStore.getState().gigs[0])).toBe(0)
  })

  it("keeps a future spend out of received totals", () => {
    applyMoneyPhrase(phrase("plan $80 dinner"))
    const line = useBudgetStore.getState().lines[0]
    expect(line).toMatchObject({ kind: "spend", status: "expected", cents: 8000, name: "Dinner" })
    const totals = budgetRows([], useBudgetStore.getState().lines)
    expect(totals[0].expected).toBe(true)
  })

  it("keeps a csv statement on the device and proposes its rows", () => {
    const text = "Date,Description,Amount\n10/01/2026,COFFEE,-3.50\n10/02/2026,PAYCHECK,970.00\n"
    useBudgetStore.getState().rememberStatement({ name: "october.csv", text })
    const saved = useBudgetStore.getState().statements[0]
    expect(saved.name).toBe("october.csv")
    expect(parseStatementCsv(saved.text)).toEqual([
      expect.objectContaining({ date: "2026-10-01", cents: 350, kind: "spend" }),
      expect.objectContaining({ date: "2026-10-02", cents: 97000, kind: "earning" }),
    ])
  })
})
