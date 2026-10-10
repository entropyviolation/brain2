/**
 * lib/spend.ts — Money spent on a tracking-log instant
 *
 * Amount is integer cents. What it was spent on and the source are short
 * strings. Omitted fields mean the instant is not a spend. No second ledger.
 */

export const SPEND_EVENT_KIND = "spend"

/** Suggestions when the vault has not named a source yet. A typed source is kept as written. */
export const SPEND_SOURCE_HINTS = ["Cash", "Card", "Account"] as const

export type SpendFields = {
  spendAmount?: number
  spendOn?: string
  spendSource?: string
}

/** Dollars and cents, such as 4.50, $4.50, or 1,200. Empty, zero, and other text are unset. */
export function parseSpendAmount(raw: string): number | null {
  const text = raw.trim().replace(/[$,\s]/g, "")
  if (!text || !/^\d+(\.\d{1,2})?$/.test(text)) return null
  const [whole, frac = ""] = text.split(".")
  const cents = Number(whole) * 100 + Number((frac + "00").slice(0, 2))
  if (!Number.isSafeInteger(cents) || cents <= 0) return null
  return cents
}

/** Editor field for a stored cent amount. Two decimals, no dollar sign. */
export function spendAmountInput(cents: number | undefined): string {
  if (typeof cents !== "number" || !Number.isInteger(cents) || cents <= 0) return ""
  const dollars = Math.floor(cents / 100)
  const frac = String(cents % 100).padStart(2, "0")
  return `${dollars}.${frac}`
}

export function formatSpendAmount(cents: number): string {
  if (!Number.isFinite(cents)) return "$0.00"
  const rounded = Math.round(cents)
  const sign = rounded < 0 ? "-" : ""
  const abs = Math.abs(rounded)
  const dollars = Math.floor(abs / 100)
  const frac = String(abs % 100).padStart(2, "0")
  const grouped = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return `${sign}$${grouped}.${frac}`
}

export function isSpendEntry(entry: { eventKind?: string; spendAmount?: number }): boolean {
  if (entry.eventKind?.trim() === SPEND_EVENT_KIND) return true
  return typeof entry.spendAmount === "number" && Number.isInteger(entry.spendAmount) && entry.spendAmount > 0
}

/** Keep a complete spend. Anything else drops the three fields. */
export function compactSpend(input: SpendFields): Required<SpendFields> | undefined {
  const on = input.spendOn?.trim() ?? ""
  const source = input.spendSource?.trim() ?? ""
  const amount = input.spendAmount
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0 || !on || !source) return undefined
  return { spendAmount: amount, spendOn: on, spendSource: source }
}

export function spendSourceOptions(entries: readonly SpendFields[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (source: string) => {
    const key = source.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(source)
  }
  for (const entry of entries) {
    const source = entry.spendSource?.trim()
    if (source) push(source)
  }
  for (const hint of SPEND_SOURCE_HINTS) push(hint)
  return out
}

export type SpendTotal = { label: string; amount: number }

export function summarizeSpend(rows: readonly SpendFields[]): {
  total: number
  bySource: SpendTotal[]
  byWhat: SpendTotal[]
} {
  const sources = new Map<string, { label: string; amount: number }>()
  const whats = new Map<string, { label: string; amount: number }>()
  let total = 0
  for (const row of rows) {
    const packed = compactSpend(row)
    if (!packed) continue
    total += packed.spendAmount
    addShare(sources, packed.spendSource, packed.spendAmount)
    addShare(whats, packed.spendOn, packed.spendAmount)
  }
  return { total, bySource: shares(sources), byWhat: shares(whats) }
}

function addShare(map: Map<string, { label: string; amount: number }>, label: string, amount: number) {
  const key = label.toLowerCase()
  const current = map.get(key)
  if (current) current.amount += amount
  else map.set(key, { label, amount })
}

function shares(map: Map<string, { label: string; amount: number }>): SpendTotal[] {
  return [...map.values()].sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label))
}
