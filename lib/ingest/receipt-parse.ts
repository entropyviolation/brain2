/**
 * lib/ingest/receipt-parse.ts — Grocery-line extraction from receipt OCR
 *
 * Pure. Strips prices, store chrome, and totals so fuzzy grocery match sees
 * product names. Qty prefixes (`2x milk`) survive as `{ name, qty }`.
 */

export interface ReceiptLine {
  name: string
  qty: number
  raw: string
}

const SKIP =
  /^(subtotal|sub total|total|tax|sales tax|vat|change|cash|credit|debit|visa|mastercard|amex|discover|balance|amount due|thank you|thanks|store|cashier|tel|phone|www\.|http|receipt|#\s*\d|date|time|card|auth|approval|save|you saved|member|acct|account|items sold|whse|wholesal)/i

const PRICE_TAIL = /(?:\s+\$?\d{1,4}[.,]\d{2})\s*(?:[a-z]{1,3})?$/i
const PRICE_ONLY = /^\$?\d{1,4}[.,]\d{2}$/
const QTY_X = /^(\d{1,3})\s*[x×]\s+/i
const QTY_AT = /^(?:(\d{1,3})\s+)?(.+?)\s+(\d+(?:[.,]\d+)?)\s*@\s*\$?\d/i
const QTY_LEAD = /^(\d{1,2})\s+(?=[A-Za-z])/

export function parseReceiptLines(text: string): ReceiptLine[] {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)

  const out: ReceiptLine[] = []
  const seen = new Set<string>()

  for (const raw of lines) {
    if (raw.length < 3) continue
    if (PRICE_ONLY.test(raw)) continue
    if (SKIP.test(raw)) continue
    if (/^\d{1,2}[:/.-]\d{1,2}/.test(raw)) continue
    if (/^\(?\d{3}\)?[\s.-]\d{3}/.test(raw)) continue
    if (!/[a-z]/i.test(raw)) continue
    if ((raw.match(/\d/g) || []).length > raw.replace(/\s/g, "").length * 0.7) continue

    let qty = 1
    let name = raw.replace(PRICE_TAIL, "").trim()
    name = name.replace(/\s+\$?\d+[.,]\d{2}\s*$/, "").trim()

    const at = name.match(QTY_AT)
    if (at) {
      qty = Math.max(1, Number(at[1] || 1))
      name = (at[2] || "").trim()
    } else {
      const x = name.match(QTY_X)
      if (x) {
        qty = Math.max(1, Number(x[1]))
        name = name.slice(x[0].length).trim()
      } else if (!/\d\s*%/.test(name)) {
        const lead = name.match(QTY_LEAD)
        if (lead && Number(lead[1]) <= 20) {
          qty = Number(lead[1])
          name = name.slice(lead[0].length).trim()
        }
      }
    }

    name = name.replace(/^[*\-•]+/, "").replace(/[*\-•]+$/, "").trim()
    name = name.replace(/\s{2,}/g, " ")
    if (name.length < 2 || name.length > 80) continue
    if (SKIP.test(name)) continue
    if (!/[a-z]/i.test(name)) continue

    const key = name.toLowerCase()
    if (seen.has(key)) {
      const prev = out.find((row) => row.name.toLowerCase() === key)
      if (prev) prev.qty += qty
      continue
    }
    seen.add(key)
    out.push({ name, qty, raw })
  }

  return out
}

/** Heuristic: this OCR blob looks like a store receipt, not a journal page. */
export function receiptScore(text: string): number {
  const src = String(text || "")
  const lower = src.toLowerCase()
  let score = 0
  const prices = src.match(/\$?\d{1,4}[.,]\d{2}/g) || []
  if (prices.length >= 2) score += 2
  if (prices.length >= 4) score += 1
  if (/\b(subtotal|total|tax|visa|mastercard|debit)\b/i.test(lower)) score += 2
  if (/\b(receipt|cashier|change due|amount due)\b/i.test(lower)) score += 2
  const parsed = parseReceiptLines(src)
  if (parsed.length >= 2) score += 1
  if (parsed.length >= 4) score += 1
  if (src.length > 1200 && prices.length < 2) score -= 2
  return score
}

export function looksLikeReceipt(text: string): boolean {
  return receiptScore(text) >= 3
}
