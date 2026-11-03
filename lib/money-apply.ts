/**
 * lib/money-apply.ts — Write one parsed money line
 *
 * Spending lands on the Tracking log. Earnings, plans, debts, bills, budgets,
 * gigs, and accounts land in `brain2-budget`. A debt never becomes an account.
 */
import { submitTrackingLog } from "@/components/Home/Tracking/tracking-log-model"
import type { AccountKind } from "@/lib/budget-store"
import { useBudgetStore } from "@/lib/budget-store"
import type { MoneyPhrase } from "@/lib/money-parse"
import { formatSpendAmount } from "@/lib/spend"

function rememberAccount(source: string, kind: AccountKind | null) {
  if (!kind) return
  useBudgetStore.getState().ensureAccount({ name: source, kind })
}

/** Returns a short fact about what was stored. */
export function applyMoneyPhrase(phrase: MoneyPhrase): string {
  const book = useBudgetStore.getState()
  switch (phrase.type) {
    case "earning": {
      book.addLines([{ date: phrase.date, name: phrase.name, cents: phrase.cents, kind: "earning", source: phrase.source }])
      rememberAccount(phrase.source, phrase.accountKind)
      return `Saved ${formatSpendAmount(phrase.cents)} earned, source ${phrase.source}.`
    }
    case "spend": {
      const id = submitTrackingLog({
        date: phrase.date,
        title: phrase.name,
        mode: "spend",
        clock: "unknown",
        minute: 0,
        spendAmount: phrase.cents,
        spendOn: phrase.name,
        spendSource: phrase.source,
      })
      if (!id) return `Could not store ${formatSpendAmount(phrase.cents)}.`
      rememberAccount(phrase.source, phrase.accountKind)
      return phrase.uncertain
        ? `Saved ${formatSpendAmount(phrase.cents)} as ${phrase.name}. The month book can change the category.`
        : `Saved ${formatSpendAmount(phrase.cents)} spent on ${phrase.name}, source ${phrase.source}.`
    }
    case "debt": {
      book.addDebt({ who: phrase.who, direction: phrase.direction, cents: phrase.cents, ...(phrase.note ? { note: phrase.note } : {}) })
      return phrase.direction === "owe"
        ? `Saved a debt: you owe ${phrase.who} ${formatSpendAmount(phrase.cents)}.`
        : `Saved a debt: ${phrase.who} owes ${formatSpendAmount(phrase.cents)}.`
    }
    case "bill": {
      book.addBill({ name: phrase.name, cents: phrase.cents, cadence: phrase.cadence })
      return `Saved ${phrase.name}, ${formatSpendAmount(phrase.cents)} ${phrase.cadence}.`
    }
    case "envelope": {
      book.addEnvelope({ name: phrase.name, cents: phrase.cents })
      return `Saved a budget for ${phrase.name}, ${formatSpendAmount(phrase.cents)} a month.`
    }
    case "plan": {
      book.addLines([{ date: phrase.date, name: phrase.name, cents: phrase.cents, kind: "spend", source: "Plan", status: "expected", certainty: "sure", category: phrase.name }])
      return `Saved a plan: ${phrase.name}, ${formatSpendAmount(phrase.cents)} on ${phrase.date}.`
    }
    case "gig": {
      book.addGig({ name: phrase.name, cents: phrase.cents, status: "open" })
      return `Saved ${phrase.name}. Pay when it finishes: ${formatSpendAmount(phrase.cents)}.`
    }
    case "account": {
      book.ensureAccount({ name: phrase.name, kind: phrase.kind })
      return `Saved the ${phrase.kind} account ${phrase.name}.`
    }
  }
}
