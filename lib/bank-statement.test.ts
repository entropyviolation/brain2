import { describe, expect, it } from "vitest"
import { cleanStatementName, parseStatementCsv, parseStatementText } from "./bank-statement"

const SAMPLE = `
Deposits and other additions
Date           Description                                                                 Amount
09/28/26       BKOFAMERICA ATM 09/26 #000009432 DEPOSIT OCEAN BEACH   SAN DIEGO   CA       200.00
Total deposits and other additions                                                         $200.00

ATM and debit card subtractions
Date           Description                                                                 Amount
09/28/26       PURCHASE 0927 DD *DOORDASH GROCERYOU 855-973-1040 CA                        -46.79
09/28/26       PURCHASE 0927 MIDJOURNEY INC. MIDJOURNEY.COCA                               -10.00
10/05/26       RALPHS # 0212 10/05 #000870531 MOBILE PURCHASE RALPHS # 0212 166 SAN DIEGO  CA   -8.53
10/05/26       PURCHASE 1005 UBER *EATS H San FranciscoCA                                  -4.75
Total ATM and debit card subtractions                                                      -$139.68

Service fees
09/11/26       Monthly Maintenance Fee                                                     -4.95
Total service fees                                                                         -$4.95
`

describe("parseStatementText", () => {
  const lines = parseStatementText(SAMPLE)
  it("marks deposits as earnings and skips totals", () => {
    expect(lines).toHaveLength(6)
    expect(lines[0]).toMatchObject({ kind: "earning", cents: 20000 })
    expect(lines.filter((l) => l.kind === "spend")).toHaveLength(5)
  })
  it("reads dates and cents", () => {
    expect(lines[1]).toMatchObject({ date: "2026-09-28", cents: 4679 })
    expect(lines[5]).toMatchObject({ date: "2026-09-11", cents: 495, name: "Monthly Maintenance Fee" })
  })
  it("cleans card noise", () => {
    expect(lines[1].name).toBe("Doordash Groceryou")
    expect(lines[3].name).toBe("Ralphs")
  })
})

describe("parseStatementCsv", () => {
  it("marks negatives spend and positives earning", () => {
    const rows = parseStatementCsv('Date,Description,Amount\n10/01/2026,"COFFEE, INC",-3.50\n10/02/2026,PAYCHECK,100.00')
    expect(rows).toEqual([
      { date: "2026-10-01", name: "Coffee, Inc", raw: "COFFEE, INC", cents: 350, kind: "spend" },
      { date: "2026-10-02", name: "Paycheck", raw: "PAYCHECK", cents: 10000, kind: "earning" },
    ])
  })
})

describe("cleanStatementName", () => {
  it("falls back to the raw text", () => {
    expect(cleanStatementName("PURCHASE 0101")).toBeTruthy()
  })
})
