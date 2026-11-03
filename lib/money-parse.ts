/**
 * lib/money-parse.ts — One line into a money-book phrase
 *
 * "earned $970 cash", "spent $12 coffee", "owe Elijah $40", "bill rent $1400
 * monthly". A line with an amount and no verb still keeps the amount. A line
 * with no amount is left unparsed. Nothing here writes the store.
 */
import { parseSpendAmount } from "@/lib/spend"
import type { AccountKind, BillCadence } from "@/lib/budget-store"

export type MoneyPhrase =
  | { type: "earning"; cents: number; name: string; source: string; accountKind: AccountKind | null; date: string }
  | { type: "spend"; cents: number; name: string; source: string; accountKind: AccountKind | null; date: string; uncertain: boolean }
  | { type: "debt"; direction: "owe" | "owed"; who: string; cents: number; note?: string }
  | { type: "bill"; name: string; cents: number; cadence: BillCadence }
  | { type: "envelope"; name: string; cents: number }
  | { type: "plan"; name: string; cents: number; date: string }
  | { type: "gig"; name: string; cents: number }
  | { type: "account"; name: string; kind: AccountKind }

export type MoneyParse =
  | { ok: true; phrase: MoneyPhrase }
  | { ok: false; reason: "blank" | "no-amount" | "no-name" }

const AMOUNT = /\$?\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\$?\d+(?:\.\d{1,2})?/
const SOURCE_KIND: Record<string, AccountKind> = {
  cash: "cash",
  card: "card",
  credit: "card",
  debit: "card",
  bank: "bank",
  checking: "bank",
  savings: "bank",
  account: "bank",
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

function titleCase(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
}

function pullAmount(text: string): { cents: number; rest: string } | null {
  const match = AMOUNT.exec(text)
  if (!match) return null
  const cents = parseSpendAmount(match[0])
  if (cents == null) return null
  const rest = `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}`.replace(/\s+/g, " ").trim()
  return { cents, rest }
}

function pullDate(rest: string, fallback: string): { date: string; rest: string } {
  const iso = /\b(20\d{2}-\d{2}-\d{2})\b/.exec(rest)
  if (iso?.[1] && DATE_KEY.test(iso[1])) {
    return { date: iso[1], rest: rest.replace(iso[0], " ").replace(/\s+/g, " ").trim() }
  }
  const slash = /\b(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\b/.exec(rest)
  if (slash) {
    const year = slash[3].length === 2 ? 2000 + Number(slash[3]) : Number(slash[3])
    const month = Number(slash[1])
    const day = Number(slash[2])
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      return { date, rest: rest.replace(slash[0], " ").replace(/\s+/g, " ").trim() }
    }
  }
  return { date: DATE_KEY.test(fallback) ? fallback : fallback, rest }
}

function pullCadence(rest: string): { cadence: BillCadence | null; rest: string } {
  const match = /\b(weekly|every week|a week|monthly|every month|a month|per month|yearly|every year|a year|per year)\b/i.exec(rest)
  if (!match) return { cadence: null, rest }
  const word = match[1].toLowerCase()
  const cadence: BillCadence = word.includes("week") ? "weekly" : word.includes("year") ? "yearly" : "monthly"
  return { cadence, rest: rest.replace(match[0], " ").replace(/\s+/g, " ").trim() }
}

function pullSource(rest: string): { source: string | null; kind: AccountKind | null; rest: string } {
  const prep = /\b(?:on|from|via|in|by|with)\s+(cash|card|credit|debit|bank|checking|savings|account)\b/i.exec(rest)
  if (prep?.[1]) {
    const word = prep[1].toLowerCase()
    return {
      source: titleCase(word),
      kind: SOURCE_KIND[word] ?? null,
      rest: rest.replace(prep[0], " ").replace(/\s+/g, " ").trim(),
    }
  }
  const parts = rest.split(/\s+/).filter(Boolean)
  const last = parts[parts.length - 1]?.toLowerCase()
  if (last && SOURCE_KIND[last]) {
    return {
      source: titleCase(last),
      kind: SOURCE_KIND[last],
      rest: parts.slice(0, -1).join(" "),
    }
  }
  return { source: null, kind: null, rest }
}

function named(rest: string, fallback: string): string {
  const cleaned = rest.replace(/^(?:for|on|at)\s+/i, "").trim()
  return titleCase(cleaned || fallback)
}

type Lead = "earning" | "spend" | "owe" | "bill" | "envelope" | "plan" | "gig" | "account"

function leadOf(text: string): { lead: Lead | null; rest: string } {
  const rules: [RegExp, Lead][] = [
    [/^(?:i\s+)?(?:earned|earn|got paid|income|payday)\b\s*/i, "earning"],
    [/^(?:i\s+)?(?:spent|spend|bought)\b\s*/i, "spend"],
    [/^(?:i\s+)?owe\b\s*/i, "owe"],
    [/^(?:bill|bills)\b\s*/i, "bill"],
    [/^(?:budget|envelope)\b\s*/i, "envelope"],
    [/^(?:plan|planning)\b\s*/i, "plan"],
    [/^(?:gig|job)\b\s*/i, "gig"],
    [/^account\b\s*/i, "account"],
  ]
  for (const [pattern, lead] of rules) {
    const match = pattern.exec(text)
    if (match) return { lead, rest: text.slice(match[0].length).trim() }
  }
  return { lead: null, rest: text }
}

export function parseMoneyPhrase(raw: string, fallbackDate: string): MoneyParse {
  const text = raw.replace(/\s+/g, " ").trim()
  if (!text) return { ok: false, reason: "blank" }

  const owed = /^(.*?)\s+owes(?:\s+me)?\b\s*(.*)$/i.exec(text)
  if (owed) {
    const amount = pullAmount(`${owed[1]} ${owed[2]}`)
    const who = titleCase((owed[1] ?? "").replace(AMOUNT, " "))
    if (!amount) return { ok: false, reason: "no-amount" }
    if (!who) return { ok: false, reason: "no-name" }
    const note = amount.rest.replace(new RegExp(who, "i"), "").replace(/\bowes(?:\s+me)?\b/i, "").trim()
    return { ok: true, phrase: { type: "debt", direction: "owed", who, cents: amount.cents, ...(note ? { note } : {}) } }
  }

  const { lead, rest } = leadOf(text)
  if (lead === "account") {
    const name = titleCase(rest)
    if (!name) return { ok: false, reason: "no-name" }
    const kind = SOURCE_KIND[name.toLowerCase()] ?? (/\b(card|credit|debit)\b/i.test(name) ? "card" : /\bcash\b/i.test(name) ? "cash" : "bank")
    return { ok: true, phrase: { type: "account", name, kind } }
  }

  const amount = pullAmount(lead ? rest : text)
  if (!amount) return { ok: false, reason: "no-amount" }
  const dated = pullDate(amount.rest, fallbackDate)
  const cadence = pullCadence(dated.rest)
  const source = pullSource(cadence.rest)
  const words = source.rest

  if (lead === "owe") {
    const who = named(words, "")
    if (!who) return { ok: false, reason: "no-name" }
    return { ok: true, phrase: { type: "debt", direction: "owe", who, cents: amount.cents } }
  }
  if (lead === "bill") {
    const name = named(words, "")
    if (!name) return { ok: false, reason: "no-name" }
    return { ok: true, phrase: { type: "bill", name, cents: amount.cents, cadence: cadence.cadence ?? "monthly" } }
  }
  if (lead === "envelope") {
    const name = named(words, "")
    if (!name) return { ok: false, reason: "no-name" }
    return { ok: true, phrase: { type: "envelope", name, cents: amount.cents } }
  }
  if (lead === "plan") {
    const name = named(words, "Plan")
    return { ok: true, phrase: { type: "plan", name, cents: amount.cents, date: dated.date } }
  }
  if (lead === "gig") {
    const name = named(words, "Gig")
    return { ok: true, phrase: { type: "gig", name, cents: amount.cents } }
  }
  if (lead === "earning") {
    return {
      ok: true,
      phrase: {
        type: "earning",
        cents: amount.cents,
        name: named(words, "Earned"),
        source: source.source ?? "Cash",
        accountKind: source.kind ?? (source.source ? null : "cash"),
        date: dated.date,
      },
    }
  }
  if (lead === "spend") {
    return {
      ok: true,
      phrase: {
        type: "spend",
        cents: amount.cents,
        name: named(words, "Spent"),
        source: source.source ?? "Cash",
        accountKind: source.kind ?? (source.source ? null : "cash"),
        date: dated.date,
        uncertain: false,
      },
    }
  }
  const name = named(words, "Uncategorized")
  return {
    ok: true,
    phrase: {
      type: "spend",
      cents: amount.cents,
      name,
      source: source.source ?? "Cash",
      accountKind: source.kind ?? (source.source ? null : "cash"),
      date: dated.date,
      uncertain: true,
    },
  }
}
