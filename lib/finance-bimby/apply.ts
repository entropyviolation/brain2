/**
 * lib/finance-bimby/apply.ts — Write one money reading where it belongs, and take it back
 *
 * Spending goes on the Tracking log, as the money book does it (`lib/money-apply.ts`), and a `Purchase` is
 * kept beside it for the shop, the receipt and the verdict. Debts and earnings go to `brain2-budget`. A perk
 * is kept here. Every write returns the step that undoes it; the last one is held so "undo that" works.
 */

import { submitTrackingLog } from "@/components/Home/Tracking/tracking-log-model"
import { budgetRows } from "@/lib/budget-math"
import { useBudgetStore, type MoneyDebt } from "@/lib/budget-store"
import { useCueStore } from "@/lib/cues/store"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { adviceFor, livePerks, perkLabel, type Ledger } from "./advise"
import { money, moneyTokens } from "./read"
import { financeId, patchPerk, patchPurchase, useFinanceBimby, type FinanceChoice } from "./store"
import type { MoneyRead, Perk, Purchase, Verdict } from "./types"

export interface Applied {
  text: string
  choices?: FinanceChoice[]
  purchaseId?: string
  /** A perk the reply asked about ("did you use it?"). */
  askPerkId?: string
  wrote: boolean
}

type Undo = { label: string; at: number; run: () => void }
let last: Undo | null = null

/** How long "undo that" still means the last money write. */
export const UNDO_TTL_MS = 30 * 60 * 1000

/** Take back the last money write. Null when there is none fresh enough. */
export function undoLastMoney(now = new Date()): string | null {
  if (!last || now.getTime() - last.at > UNDO_TTL_MS) return null
  const { label, run } = last
  last = null
  run()
  return `Undone: ${label}.`
}

export function resetFinanceUndoForTests(): void {
  last = null
}

/** Both ledgers and this BIMBY's own records, read fresh. */
export function ledgerNow(): Ledger {
  const book = useBudgetStore.getState()
  const mine = useFinanceBimby.getState()
  return { purchases: mine.purchases, perks: mine.perks, debts: book.debts, rows: budgetRows(useTimeTrackingStore.getState().entries, book.lines) }
}

/** Shops and account names already known, so "on instacart" and "on the sapphire" read right. */
export function readContext(): { accounts: string[]; merchants: string[] } {
  const merchants = [...new Set(useFinanceBimby.getState().purchases.map((p) => p.merchant).filter((m): m is string => !!m))]
  return { accounts: useBudgetStore.getState().accounts.map((a) => a.name), merchants }
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
const nameFits = (a: string, b: string) => {
  const x = a.trim().toLowerCase()
  const y = b.trim().toLowerCase()
  return x === y || x.includes(y) || y.includes(x)
}

function addDebt(draft: Omit<MoneyDebt, "id">): MoneyDebt | null {
  const before = new Set(useBudgetStore.getState().debts.map((d) => d.id))
  useBudgetStore.getState().addDebt(draft)
  return useBudgetStore.getState().debts.find((d) => !before.has(d.id)) ?? null
}

/** Receipts sent in the last quarter hour with no purchase to go on. */
const LOOSE_TTL_MS = 15 * 60 * 1000

function applySpend(read: Extract<MoneyRead, { kind: "spend" }>, now: Date, opts: { receipts?: string[]; receiptText?: string }): Applied {
  const today = read.date === formatLocalDateKey(now)
  const paidWith = read.account ?? "Card"
  const title = read.merchant && !read.what.toLowerCase().includes(read.merchant.toLowerCase()) ? `${read.what} · ${read.merchant}` : read.what
  const entryId = submitTrackingLog({
    date: read.date,
    title,
    mode: "spend",
    clock: today ? "estimated" : "unknown",
    minute: today ? now.getHours() * 60 + now.getMinutes() : 0,
    spendAmount: read.cents,
    spendOn: title,
    spendSource: paidWith,
    logSource: "bim",
  })
  if (!entryId) return { text: `I could not store ${money(read.cents)}.`, wrote: false }
  if (read.account && read.accountKind) useBudgetStore.getState().ensureAccount({ name: read.account, kind: read.accountKind })

  const mine = useFinanceBimby.getState()
  const waiting = mine.loose.filter((r) => now.getTime() - new Date(r.at).getTime() <= LOOSE_TTL_MS)
  const purchase: Purchase = {
    id: financeId("buy"),
    at: now.toISOString(),
    date: read.date,
    cents: read.cents,
    what: read.what,
    ...(read.merchant ? { merchant: read.merchant } : {}),
    ...(read.account ? { account: read.account } : {}),
    entryId,
    receipts: [...(opts.receipts ?? []), ...waiting.map((r) => r.uri)],
    ...(opts.receiptText || waiting[0]?.text ? { receiptText: opts.receiptText ?? waiting[0]!.text } : {}),
    tokens: moneyTokens(`${read.what} ${read.merchant ?? ""}`),
  }
  useFinanceBimby.setState({ purchases: [...mine.purchases, purchase], loose: [] })
  last = {
    label: `${money(read.cents)} spent on ${read.what}`,
    at: now.getTime(),
    run: () => {
      useTimeTrackingStore.getState().removeEntry(entryId)
      useFinanceBimby.setState((s) => ({ purchases: s.purchases.filter((p) => p.id !== purchase.id), loose: [...s.loose, ...waiting] }))
    },
  }

  const head = `Spent ${money(read.cents)}${read.merchant ? ` at ${read.merchant}` : ""} on ${read.what}${read.account ? `, paid with ${read.account}` : ""}${today ? "" : ` (${read.date})`}. On the Tracking log.`
  const lines = [head]
  if (purchase.receipts.length) lines.push(purchase.receipts.length === 1 ? "Receipt attached." : `${purchase.receipts.length} receipts attached.`)
  else lines.push("Send the receipt as a photo and I will attach it.")
  const ledger = ledgerNow()
  const facts = adviceFor({ tokens: purchase.tokens, merchant: read.merchant }, ledger, now, { skipPurchaseId: purchase.id }).filter((l) => !/^You have .* waiting\.$/.test(l))
  if (facts.length) lines.push("", ...facts)
  // A discount for this shop: was it used? The answer closes the perk and its reminder.
  const perk = livePerks(ledger.perks, purchase.tokens, read.merchant).find((p) => !read.merchant || !p.merchant || sameName(p.merchant, read.merchant))
  if (perk) {
    lines.push("", `You had ${perkLabel(perk).replace(/^A discount/, "a discount")}. Did you use it?`)
    return { text: lines.join("\n"), purchaseId: purchase.id, askPerkId: perk.id, wrote: true, choices: [{ label: "used it", text: "used it" }, { label: "still have it", text: "still have it" }] }
  }
  return { text: lines.join("\n"), purchaseId: purchase.id, wrote: true }
}

/** Write a reading. `receipts` are attachment URIs sent with the line. */
export function applyMoney(read: MoneyRead, now: Date, opts: { receipts?: string[]; receiptText?: string } = {}): Applied {
  const book = useBudgetStore.getState()
  switch (read.kind) {
    case "spend":
      return applySpend(read, now, opts)

    case "earning": {
      const before = new Set(book.lines.map((l) => l.id))
      const added = book.addLines([{ date: read.date, name: read.what, cents: read.cents, kind: "earning", source: read.from ?? "Cash" }])
      if (!added) return { text: `I could not store ${money(read.cents)}.`, wrote: false }
      const line = useBudgetStore.getState().lines.find((l) => !before.has(l.id))
      last = { label: `${money(read.cents)} earned`, at: now.getTime(), run: () => line && useBudgetStore.getState().removeLine(line.id) }
      return { text: `Earned ${money(read.cents)}${read.from ? ` from ${read.from}` : ""}${read.what !== "Earned" ? ` for ${read.what}` : ""}. In the money book.`, wrote: true }
    }

    case "debt": {
      const twin = book.debts.find((d) => d.direction === read.direction && sameName(d.who, read.who) && d.cents === read.cents)
      const says = read.direction === "owed" ? `${read.who} owes you ${money(read.cents)}` : `You owe ${read.who} ${money(read.cents)}`
      if (twin) return { text: `I already have that: ${says}${twin.note ? ` for ${twin.note}` : ""}.`, wrote: false }
      const debt = addDebt({ who: read.who, direction: read.direction, cents: read.cents, ...(read.note ? { note: read.note } : {}) })
      if (!debt) return { text: "I could not store that debt.", wrote: false }
      last = { label: says, at: now.getTime(), run: () => useBudgetStore.getState().removeDebt(debt.id) }
      const others = book.debts.filter((d) => d.direction === read.direction && sameName(d.who, read.who))
      const total = others.reduce((n, d) => n + d.cents, read.cents)
      const more = others.length ? ` That makes ${money(total)} with ${read.who} in all.` : ""
      const tail = read.direction === "owed" ? ` Say “${read.who} paid me” when it lands.` : ` Say “I paid ${read.who} back” when it is settled.`
      return { text: `${says}${read.note ? ` for ${read.note}` : ""}. In the money book, under Debts.${more}${tail}`, wrote: true }
    }

    case "settle": {
      const open = book.debts.filter((d) => d.direction === read.direction && nameFits(d.who, read.who))
      if (!open.length) {
        if (read.direction === "owed" && read.cents) return applyMoney({ kind: "earning", cents: read.cents, what: "Earned", from: read.who, date: read.date }, now)
        return { text: read.direction === "owed" ? `I have nothing saying ${read.who} owes you. How much was it?` : `I have nothing saying you owe ${read.who}.`, wrote: false }
      }
      // The debt of that exact amount, else the oldest.
      const debt = open.find((d) => d.cents === read.cents) ?? open[0]!
      const paid = Math.min(read.cents ?? debt.cents, debt.cents)
      const left = debt.cents - paid
      const beforeLines = new Set(book.lines.map((l) => l.id))
      book.removeDebt(debt.id)
      const rest = left > 0 ? addDebt({ who: debt.who, direction: debt.direction, cents: left, ...(debt.note ? { note: debt.note } : {}) }) : null
      if (read.direction === "owed") book.addLines([{ date: read.date, name: debt.note || "Paid back", cents: paid, kind: "earning", source: debt.who }])
      const line = useBudgetStore.getState().lines.find((l) => !beforeLines.has(l.id))
      last = {
        label: `${debt.who} settling ${money(paid)}`,
        at: now.getTime(),
        run: () => {
          const b = useBudgetStore.getState()
          if (rest) b.removeDebt(rest.id)
          if (line) b.removeLine(line.id)
          b.addDebt({ who: debt.who, direction: debt.direction, cents: debt.cents, ...(debt.note ? { note: debt.note } : {}) })
        },
      }
      const what = debt.note ? ` for ${debt.note}` : ""
      if (read.direction === "owed") return { text: `${debt.who} paid you ${money(paid)}${what}. Logged as earned${left ? `; ${money(left)} still owed` : ", and the debt is cleared"}.`, wrote: true }
      return { text: `You paid ${debt.who} ${money(paid)}${what}. ${left ? `${money(left)} still owed.` : "That debt is cleared."} Tell me how you paid it if you want it on the log (“spent ${money(paid).slice(1)} on venmo paying ${debt.who} back”).`, wrote: true }
    }

    case "perk": {
      const perk: Perk = {
        id: financeId("perk"),
        at: now.toISOString(),
        text: read.text,
        ...(read.cents ? { cents: read.cents } : {}),
        ...(read.percent ? { percent: read.percent } : {}),
        ...(read.what ? { what: read.what } : {}),
        ...(read.merchant ? { merchant: read.merchant } : {}),
        tokens: moneyTokens(`${read.what ?? ""} ${read.merchant ?? ""}`),
      }
      useFinanceBimby.setState((s) => ({ perks: [...s.perks, perk] }))
      last = { label: perkLabel(perk), at: now.getTime(), run: () => dropPerk(perk.id) }
      return { text: `Kept: ${perkLabel(perk)}. I will bring it up when you log or weigh a buy${read.merchant ? ` at ${read.merchant}` : " it fits"}.`, wrote: true }
    }
  }
}

/** The perk a line just made, so the caller can tie a cue to it. */
export function newestPerk(): Perk | null {
  return useFinanceBimby.getState().perks.at(-1) ?? null
}

export function dropPerk(id: string): void {
  const perk = useFinanceBimby.getState().perks.find((p) => p.id === id)
  if (perk?.cueId) useCueStore.getState().drop(perk.cueId)
  useFinanceBimby.setState((s) => ({ perks: s.perks.filter((p) => p.id !== id) }))
}

/** A perk is used up: it stops coming up, and so does its reminder. */
export function markPerkUsed(id: string, now = new Date()): Perk | null {
  const perk = useFinanceBimby.getState().perks.find((p) => p.id === id)
  if (!perk) return null
  patchPerk(id, (p) => ({ ...p, usedAt: now.toISOString() }))
  if (perk.cueId) useCueStore.getState().done(perk.cueId, now)
  return perk
}

/** How a purchase sat. The words are the person's; an earlier verdict is replaced and can be put back. */
export function setVerdict(purchaseId: string, kind: Verdict, why: string | undefined, now = new Date()): Purchase | null {
  const before = useFinanceBimby.getState().purchases.find((p) => p.id === purchaseId)
  if (!before) return null
  patchPurchase(purchaseId, (p) => ({ ...p, verdict: { kind, at: now.toISOString(), ...(why?.trim() ? { why: why.trim() } : {}) } }))
  last = {
    label: `the ${kind} verdict`,
    at: now.getTime(),
    run: () =>
      patchPurchase(purchaseId, (p) => {
        const { verdict: _gone, ...rest } = p
        return before.verdict ? { ...rest, verdict: before.verdict } : rest
      }),
  }
  return useFinanceBimby.getState().purchases.find((p) => p.id === purchaseId) ?? null
}

/** Add receipt pictures to a purchase. */
export function attachReceipts(purchaseId: string, uris: string[], text?: string): void {
  patchPurchase(purchaseId, (p) => ({ ...p, receipts: [...new Set([...p.receipts, ...uris])], ...(text && !p.receiptText ? { receiptText: text.slice(0, 4000) } : {}) }))
}

/** Keep receipts until their purchase is told. */
export function holdReceipts(uris: string[], now: Date, text?: string): void {
  useFinanceBimby.setState((s) => ({ loose: [...s.loose, ...uris.map((uri) => ({ uri, at: now.toISOString(), ...(text ? { text: text.slice(0, 4000) } : {}) }))] }))
}
