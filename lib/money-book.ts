/**
 * lib/money-book.ts — Readings for the money book
 *
 * A budget envelope is a monthly cap. A gig's pay counts until it is marked
 * paid. Bills name their next date. Debts are not accounts. Writing a line
 * is `lib/money-apply.ts`.
 */
import type { BudgetRow } from "@/lib/budget-math"
import type { BillCadence, MoneyEnvelope, MoneyGig } from "@/lib/budget-store"

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

function parts(key: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!match) return null
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) }
}

function keyOf(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`
}

function lastDay(y: number, m: number): number {
  return new Date(y, m, 0).getDate()
}

/** Next date this bill is due, on or after `fromKey`. */
export function nextBillDate(bill: { cadence: BillCadence; day?: number }, fromKey: string): string {
  const from = parts(fromKey)
  if (!from) return fromKey
  if (bill.cadence === "weekly") {
    if (bill.day == null) {
      const date = new Date(from.y, from.m - 1, from.d + 7)
      return keyOf(date.getFullYear(), date.getMonth() + 1, date.getDate())
    }
    const want = ((bill.day % 7) + 7) % 7
    const date = new Date(from.y, from.m - 1, from.d)
    const delta = (want - date.getDay() + 7) % 7
    date.setDate(date.getDate() + delta)
    return keyOf(date.getFullYear(), date.getMonth() + 1, date.getDate())
  }
  if (bill.cadence === "yearly") {
    const date = new Date(from.y + 1, from.m - 1, Math.min(from.d, lastDay(from.y + 1, from.m)))
    return keyOf(date.getFullYear(), date.getMonth() + 1, date.getDate())
  }
  const want = bill.day == null ? 1 : Math.min(Math.max(1, bill.day), 31)
  const thisMonth = Math.min(want, lastDay(from.y, from.m))
  if (from.d <= thisMonth) return keyOf(from.y, from.m, thisMonth)
  const nextM = from.m === 12 ? 1 : from.m + 1
  const nextY = from.m === 12 ? from.y + 1 : from.y
  return keyOf(nextY, nextM, Math.min(want, lastDay(nextY, nextM)))
}

/** Received spending this month that wears the envelope's name. */
export function envelopeReading(
  envelope: Pick<MoneyEnvelope, "name" | "cents">,
  rows: readonly Pick<BudgetRow, "name" | "category" | "cents" | "kind" | "date" | "expected">[],
  monthKey: string,
): { spent: number; left: number } {
  const needle = envelope.name.trim().toLowerCase()
  let spent = 0
  for (const row of rows) {
    if (row.expected || row.kind !== "spend" || !row.date.startsWith(monthKey)) continue
    const category = row.category?.trim().toLowerCase() || ""
    const name = row.name.trim().toLowerCase()
    if (category === needle || name === needle) spent += row.cents
  }
  return { spent, left: envelope.cents - spent }
}

/** Pay still expected: open work and finished work that is not marked paid. */
export function gigExpectedPay(gigs: readonly Pick<MoneyGig, "cents" | "status">[]): number {
  return gigs.reduce((sum, gig) => (gig.status === "paid" ? sum : sum + gig.cents), 0)
}

export function gigPayWhenFinished(gig: Pick<MoneyGig, "cents" | "status">): number {
  return gig.status === "paid" ? 0 : gig.cents
}

/** True when a debt's name was stored as an account. The book must not do this. */
export function debtStoredAsAccount(
  accounts: readonly { name: string }[],
  debts: readonly { who: string }[],
): boolean {
  const names = new Set(accounts.map((account) => account.name.trim().toLowerCase()))
  return debts.some((debt) => names.has(debt.who.trim().toLowerCase()))
}
