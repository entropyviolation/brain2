/**
 * lib/finance-bimby/receipt.ts — The total and the shop from a receipt's OCR text (pure)
 *
 * A screenshot of an order page or a photo of a paper receipt. The total is the amount on a "total" line
 * (never a subtotal); with no such line it stays unknown rather than guessed from the largest number, since
 * a screenshot is full of other numbers. The shop is a known name anywhere in the text, else the first line
 * that reads as a name.
 */

import { KNOWN_MERCHANTS, properName } from "./read"

export interface ReceiptRead {
  totalCents?: number
  merchant?: string
}

const AMOUNT = /\$?\s?(\d{1,3}(?:,\d{3})*|\d+)[.,](\d{2})\b/g

function lastAmount(line: string): number | null {
  let cents: number | null = null
  for (const m of line.matchAll(AMOUNT)) cents = Number(m[1]!.replace(/,/g, "")) * 100 + Number(m[2])
  return cents && cents > 0 ? cents : null
}

/** Strongest first: a later, stronger line replaces a weaker one. */
const TOTAL_LINES: RegExp[] = [/\b(?:order|grand)\s+total\b|\btotal\s+(?:charged|paid|due)\b|\bamount\s+(?:charged|paid|due)\b|\byou\s+paid\b|\bcharged\b/i, /\btotal\b/i]

export function readReceipt(ocr: string, knownMerchants: readonly string[] = []): ReceiptRead {
  const lines = ocr.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  let total: number | undefined
  for (const pattern of TOTAL_LINES) {
    for (const [i, line] of lines.entries()) {
      if (!pattern.test(line) || /\bsub\s?-?total\b|\btotal\s+(?:savings|saved|items|discount)|\bitems?\s+total\b/i.test(line)) continue
      // The amount is on the line, or alone on the next one (a two-column layout read top to bottom).
      const cents = lastAmount(line) ?? (lines[i + 1] && /^\$?\s?[\d,]+[.,]\d{2}$/.test(lines[i + 1]!) ? lastAmount(lines[i + 1]!) : null)
      if (cents) total = cents
    }
    if (total) break
  }

  const lower = ocr.toLowerCase()
  const names = [...knownMerchants, ...KNOWN_MERCHANTS].sort((a, b) => b.length - a.length)
  let merchant = names.find((n) => new RegExp(`\\b${n.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(lower))
  if (!merchant) {
    const first = lines.find((l) => /^[A-Za-z][A-Za-z'&. -]{2,30}$/.test(l) && !/\b(?:receipt|order|total|thank|welcome|invoice|details|summary)\b/i.test(l))
    if (first) merchant = first
  }
  return { ...(total ? { totalCents: total } : {}), ...(merchant ? { merchant: properName(merchant) } : {}) }
}
