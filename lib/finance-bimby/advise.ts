/**
 * lib/finance-bimby/advise.ts — What the ledger says about a purchase, a shop or a question (pure)
 *
 * Every sentence here is a counted fact or the person's own words: how the last buys at a shop sat, a
 * discount still unused, what has gone out this month. No model, no opinion. The model, when one is asked,
 * is given these lines and may only rephrase them (`run.ts`).
 */

import type { BudgetRow } from "@/lib/budget-math"
import type { MoneyDebt } from "@/lib/budget-store"
import { money, moneyTokens } from "./read"
import type { MoneyAsk, Perk, Purchase, Verdict } from "./types"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
/** "2026-11-11" → "Nov 11". */
export function dayLabel(date: string): string {
  const [, m, d] = date.split("-").map(Number)
  return m && d ? `${MONTHS[m - 1]} ${d}` : date
}

export function purchaseLabel(p: Purchase): string {
  const where = p.merchant ? ` at ${p.merchant}` : ""
  return `${money(p.cents)}${where} for ${p.what} (${dayLabel(p.date)})`
}

/** Purchases that share a shop or a word with the tokens, best and newest first. */
export function relatedPurchases(purchases: readonly Purchase[], tokens: readonly string[], merchant?: string): Purchase[] {
  const want = new Set(tokens)
  const shop = merchant?.toLowerCase()
  const scored: { p: Purchase; score: number }[] = []
  for (const p of purchases) {
    let score = p.tokens.filter((t) => want.has(t)).length
    if (shop && p.merchant?.toLowerCase() === shop) score += 2
    if (score > 0) scored.push({ p, score })
  }
  return scored.sort((a, b) => b.score - a.score || b.p.at.localeCompare(a.p.at)).map((s) => s.p)
}

/**
 * The purchase a line is about. A named word wins; with no word in common, "it" / "that purchase" means the
 * newest one, but only when it was told in the last two weeks. `clear` is false when two purchases fit equally.
 */
export function findPurchase(purchases: readonly Purchase[], text: string, now: Date, opts: { allowNewest?: boolean } = {}): { purchase: Purchase; clear: boolean; others: Purchase[] } | null {
  const tokens = moneyTokens(text)
  const want = new Set(tokens)
  const scored = purchases
    .map((p) => ({ p, score: p.tokens.filter((t) => want.has(t)).length }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || b.p.at.localeCompare(a.p.at))
  if (scored.length) {
    const top = scored[0]!
    // The same words twice (two Instacart orders) means the newest, said plainly in the reply.
    const tied = scored.filter((s) => s.score === top.score).map((s) => s.p)
    return { purchase: top.p, clear: tied.length === 1, others: tied.slice(1) }
  }
  if (!opts.allowNewest) return null
  const newest = [...purchases].sort((a, b) => b.at.localeCompare(a.at))[0]
  if (!newest || now.getTime() - new Date(newest.at).getTime() > 14 * 86_400_000) return null
  return { purchase: newest, clear: true, others: [] }
}

const VERDICT_WORD: Record<Verdict, string> = { regret: "regretted", satisfied: "were glad of", mixed: "had mixed feelings about" }

/** How earlier buys like this one sat, in the person's words. Newest two verdicts, then the count. */
export function verdictLines(related: readonly Purchase[], label: string): string[] {
  const judged = related.filter((p) => p.verdict)
  if (!judged.length) return []
  const count = (k: Verdict) => judged.filter((p) => p.verdict!.kind === k).length
  const parts = (["regret", "satisfied", "mixed"] as Verdict[]).filter((k) => count(k)).map((k) => `${count(k)} you ${VERDICT_WORD[k]}`)
  const out = [`${label}: of ${judged.length} you told me about, ${parts.join(", ")}.`]
  for (const p of judged.slice(0, 2)) {
    const why = p.verdict!.why ? `: “${p.verdict!.why}”` : ""
    out.push(`• ${purchaseLabel(p)}, ${p.verdict!.kind}${why}`)
  }
  return out
}

/** Perks not yet used that bear on a shop or on these words. */
export function livePerks(perks: readonly Perk[], tokens: readonly string[], merchant?: string): Perk[] {
  const want = new Set(tokens)
  const shop = merchant?.toLowerCase()
  return perks.filter((p) => !p.usedAt && ((shop && p.merchant?.toLowerCase() === shop) || p.tokens.some((t) => want.has(t))))
}

export function perkLabel(p: Perk): string {
  const amount = p.cents ? `${money(p.cents)} off` : p.percent ? `${p.percent}% off` : "A discount"
  return `${amount}${p.what ? ` ${p.what}` : ""}${p.merchant ? ` on ${p.merchant}` : ""}`
}

export interface Ledger {
  purchases: readonly Purchase[]
  perks: readonly Perk[]
  debts: readonly MoneyDebt[]
  /** Received spending and earnings from both ledgers (`budgetRows`). */
  rows: readonly BudgetRow[]
}

const spentIn = (rows: readonly BudgetRow[], from: string, to: string) => rows.filter((r) => r.kind === "spend" && !r.expected && r.date >= from && r.date <= to)

/** Facts worth saying before or after a buy: earlier verdicts, an unused discount, the month so far. */
export function adviceFor(topic: { tokens: readonly string[]; merchant?: string; cents?: number }, ledger: Ledger, now: Date, opts: { skipPurchaseId?: string } = {}): string[] {
  const out: string[] = []
  const related = relatedPurchases(ledger.purchases.filter((p) => p.id !== opts.skipPurchaseId), topic.tokens, topic.merchant)
  out.push(...verdictLines(related, topic.merchant ? `Earlier ${topic.merchant} buys` : "Earlier buys like this"))
  for (const perk of livePerks(ledger.perks, topic.tokens, topic.merchant)) out.push(`You have ${perkLabel(perk).replace(/^A discount/, "a discount")} waiting.`)
  if (topic.merchant) {
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const shop = topic.merchant.toLowerCase()
    const here = ledger.purchases.filter((p) => p.id !== opts.skipPurchaseId && p.date.startsWith(key) && p.merchant?.toLowerCase() === shop)
    if (here.length) out.push(`${topic.merchant} this month before this: ${money(here.reduce((n, p) => n + p.cents, 0))} over ${here.length} ${here.length === 1 ? "buy" : "buys"}.`)
  }
  return out
}

/** The answer to a question the ledger can settle in code. */
export function answerAsk(ask: MoneyAsk, ledger: Ledger): string {
  switch (ask.kind) {
    case "owed": {
      const owed = ledger.debts.filter((d) => d.direction === "owed")
      if (ask.who) {
        const name = ask.who.toLowerCase()
        const hit = owed.filter((d) => d.who.toLowerCase().includes(name) || name.includes(d.who.toLowerCase()))
        if (!hit.length) return `I have nothing saying ${ask.who} owes you.`
        return hit.map((d) => `${d.who} owes you ${money(d.cents)}${d.note ? ` for ${d.note}` : ""}.`).join("\n")
      }
      if (!owed.length) return "Nobody owes you anything that I know of."
      const total = owed.reduce((n, d) => n + d.cents, 0)
      return [`You are owed ${money(total)}:`, ...owed.map((d) => `• ${d.who}: ${money(d.cents)}${d.note ? ` for ${d.note}` : ""}`)].join("\n")
    }
    case "owe": {
      const owe = ledger.debts.filter((d) => d.direction === "owe")
      if (!owe.length) return "You owe nobody that I know of."
      const total = owe.reduce((n, d) => n + d.cents, 0)
      return [`You owe ${money(total)}:`, ...owe.map((d) => `• ${d.who}: ${money(d.cents)}${d.note ? ` for ${d.note}` : ""}`)].join("\n")
    }
    case "spent": {
      let rows = spentIn(ledger.rows, ask.from, ask.to)
      let about = ""
      if (ask.about.length) {
        const want = new Set(ask.about)
        const ids = new Set(ledger.purchases.filter((p) => p.tokens.some((t) => want.has(t))).map((p) => p.entryId))
        rows = rows.filter((r) => ids.has(r.id) || moneyTokens(`${r.name} ${r.source} ${r.category ?? ""}`).some((t) => want.has(t)))
        about = ` on ${ask.about.join(" ")}`
      }
      if (!rows.length) return `Nothing spent${about} ${ask.label} that I know of.`
      const total = rows.reduce((n, r) => n + r.cents, 0)
      const top = [...rows].sort((a, b) => b.cents - a.cents).slice(0, 5)
      return [`${cap(ask.label)} you spent ${money(total)}${about}, over ${rows.length} ${rows.length === 1 ? "line" : "lines"}:`, ...top.map((r) => `• ${money(r.cents)} ${r.name} (${dayLabel(r.date)}, ${r.source})`)].join("\n")
    }
    case "regrets": {
      const bad = ledger.purchases.filter((p) => p.verdict?.kind === "regret" || p.verdict?.kind === "mixed").sort((a, b) => b.at.localeCompare(a.at))
      if (!bad.length) return "You have not told me about a purchase you regret."
      const total = bad.filter((p) => p.verdict!.kind === "regret").reduce((n, p) => n + p.cents, 0)
      return [`Purchases you were not happy with${total ? ` (${money(total)} regretted)` : ""}:`, ...bad.slice(0, 8).map((p) => `• ${purchaseLabel(p)}, ${p.verdict!.kind}${p.verdict!.why ? `: “${p.verdict!.why}”` : ""}`)].join("\n")
    }
    case "perks": {
      const live = ledger.perks.filter((p) => !p.usedAt)
      if (!live.length) return "No discounts waiting that I know of."
      return ["Discounts waiting:", ...live.map((p) => `• ${perkLabel(p)} (told ${dayLabel(p.at.slice(0, 10))})`)].join("\n")
    }
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** The facts a model is given to talk from: short, counted, and nothing it could not check. */
export function factSheet(ledger: Ledger, now: Date, focus?: Purchase): string {
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const month = ledger.rows.filter((r) => r.kind === "spend" && !r.expected && r.date.startsWith(key))
  const lines: string[] = [`Spent this month: ${money(month.reduce((n, r) => n + r.cents, 0))} over ${month.length} lines.`]
  if (focus) lines.push(`The purchase in question: ${purchaseLabel(focus)}${focus.account ? `, paid with ${focus.account}` : ""}${focus.verdict ? `, verdict ${focus.verdict.kind}${focus.verdict.why ? ` (“${focus.verdict.why}”)` : ""}` : ""}.`)
  const judged = ledger.purchases.filter((p) => p.verdict && p.id !== focus?.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8)
  if (judged.length) lines.push("Earlier verdicts:", ...judged.map((p) => `- ${purchaseLabel(p)}: ${p.verdict!.kind}${p.verdict!.why ? ` (“${p.verdict!.why}”)` : ""}`))
  const recent = ledger.purchases.filter((p) => !p.verdict && p.id !== focus?.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6)
  if (recent.length) lines.push("Recent purchases with no verdict yet:", ...recent.map((p) => `- ${purchaseLabel(p)}`))
  const owed = ledger.debts.filter((d) => d.direction === "owed")
  const owe = ledger.debts.filter((d) => d.direction === "owe")
  if (owed.length) lines.push(`Owed to the person: ${owed.map((d) => `${d.who} ${money(d.cents)}`).join(", ")}.`)
  if (owe.length) lines.push(`The person owes: ${owe.map((d) => `${d.who} ${money(d.cents)}`).join(", ")}.`)
  const live = ledger.perks.filter((p) => !p.usedAt)
  if (live.length) lines.push(`Unused discounts: ${live.map(perkLabel).join("; ")}.`)
  return lines.join("\n")
}
