/**
 * lib/bank-statement.ts — Read spending out of a bank statement.
 *
 * Takes the text of a statement (PDF text lines, or a CSV export) and returns
 * dated lines in cents, each marked spend or earning. Balances are skipped. Nothing here touches the store; the Spending dialog previews the
 * lines and the user chooses what to import.
 */
import { parseSpendAmount } from "@/lib/spend"

export interface StatementLine {
  /** Local date key, `YYYY-MM-DD`. */
  date: string
  /** Cleaned merchant text. Editable in the preview. */
  name: string
  /** The statement's own text, kept for the preview tooltip. */
  raw: string
  /** Positive cents. */
  cents: number
  /** Money out (`spend`) or money in (`earning`: deposits, pay, refunds). */
  kind: "spend" | "earning"
}

const DATE_LEAD = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\s+/
const AMOUNT_TAIL = /\s(-?\$?\(?[\d,]+\.\d{2}\)?)\s*$/

function dateKey(month: string, day: string, year: string): string | null {
  const y = year.length === 2 ? 2000 + Number(year) : Number(year)
  const m = Number(month)
  const d = Number(day)
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

function titleCase(text: string): string {
  if (text !== text.toUpperCase()) return text
  return text.toLowerCase().replace(/(^|[\s*.\-/])([a-z])/g, (_, lead: string, ch: string) => lead + ch.toUpperCase())
}

/** Strip the card-network noise from a description: purchase tags, store numbers, phones, trailing places. */
export function cleanStatementName(raw: string): string {
  let text = raw.replace(/\s+/g, " ").trim()
  text = text.replace(/^(PURCHASE|CHECKCARD|POS|DEBIT CARD|RECURRING)\s+(\d{4}\s+)?/i, "")
  text = text.replace(/^(DD|SQ|TST|PY|PP|GOOGLE)\s?\*\s?/i, "")
  text = text.replace(/\s#\s?\d.*$/, "")
  text = text.replace(/\s\d{3}[-.]\d{3}[-.]\d{4}.*$/, "")
  text = text.replace(/\s\d{5,}.*$/, "")
  text = text.replace(/\s+[A-Z][a-z]+(?: [A-Z][a-z]+)*\s?[A-Z]{2}$/, "")
  text = text.trim() || raw.trim()
  return titleCase(text)
}

type Section = "out" | "in" | "none"

function sectionFor(line: string): Section | null {
  const text = line.trim().toLowerCase()
  if (/^total\b/.test(text)) return "none"
  if (/^deposits and other additions/.test(text)) return "in"
  if (/^(withdrawals|atm and debit card subtractions|other subtractions|service fees|checks|purchases|payments and other debits)\b/.test(text)) return "out"
  return null
}

function fromLine(line: string, section: Section): StatementLine | null {
  const lead = DATE_LEAD.exec(line)
  if (!lead) return null
  const date = dateKey(lead[1], lead[2], lead[3])
  if (!date) return null
  const rest = line.slice(lead[0].length)
  const tail = AMOUNT_TAIL.exec(` ${rest}`)
  if (!tail) return null
  const amountText = tail[1]
  if (section === "none") return null
  const negative = amountText.includes("-") || amountText.startsWith("(")
  const kind: StatementLine["kind"] = section === "in" || (section !== "out" && !negative) ? "earning" : "spend"
  const cents = parseSpendAmount(amountText.replace(/[-()]/g, ""))
  if (cents == null) return null
  const description = rest.slice(0, rest.length - (tail[0].length - 1)).trim()
  if (!description) return null
  return { date, name: cleanStatementName(description), raw: description, cents, kind }
}

/** Parse statement text, one transaction per line. Lines outside a spending section are skipped. */
export function parseStatementText(text: string): StatementLine[] {
  const out: StatementLine[] = []
  let section: Section = "out"
  let sawHeading = false
  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    const heading = sectionFor(line)
    if (heading) {
      section = heading
      sawHeading = true
      continue
    }
    const parsed = fromLine(line.trim(), sawHeading ? section : "out")
    if (parsed) out.push(parsed)
  }
  return out
}

function splitCsv(line: string): string[] {
  const cells: string[] = []
  let cell = ""
  let quoted = false
  for (const ch of line) {
    if (ch === '"') quoted = !quoted
    else if (ch === "," && !quoted) {
      cells.push(cell)
      cell = ""
    } else cell += ch
  }
  cells.push(cell)
  return cells.map((c) => c.trim())
}

/** CSV exports: finds the date, amount, and description cells per row. Negative amounts are spending, positive are earnings. */
export function parseStatementCsv(text: string): StatementLine[] {
  const out: StatementLine[] = []
  for (const row of text.split(/\r?\n/)) {
    if (!row.trim()) continue
    const cells = splitCsv(row)
    const dateCell = cells.find((c) => /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(c))
    if (!dateCell) continue
    const [m, d, y] = dateCell.split("/")
    const date = dateKey(m, d, y)
    const amountCell = [...cells].reverse().find((c) => /^-?\$?\(?[\d,]+\.\d{2}\)?$/.test(c))
    if (!date || !amountCell) continue
    const kind: StatementLine["kind"] = amountCell.includes("-") || amountCell.startsWith("(") ? "spend" : "earning"
    const cents = parseSpendAmount(amountCell.replace(/[-()]/g, ""))
    const description = cells.filter((c) => c && c !== dateCell && c !== amountCell && !/^-?[\d,.]+$/.test(c)).sort((a, b) => b.length - a.length)[0]
    if (cents == null || !description) continue
    out.push({ date, name: cleanStatementName(description), raw: description, cents, kind })
  }
  return out
}

/** Text of a statement PDF, one visual line per row. pdfjs loads only when a PDF is imported. */
export async function pdfToStatementText(data: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist")
  const version = (pdfjs as { version?: string }).version ?? "4.10.38"
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise
  const pages: string[] = []
  for (let n = 1; n <= pdf.numPages; n++) {
    const content = await (await pdf.getPage(n)).getTextContent()
    const runs: { str: string; x: number; y: number }[] = []
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue
      const t = item.transform as number[]
      runs.push({ str: item.str, x: t[4] ?? 0, y: t[5] ?? 0 })
    }
    runs.sort((a, b) => b.y - a.y || a.x - b.x)
    const rows: { y: number; parts: typeof runs }[] = []
    for (const run of runs) {
      const row = rows.find((r) => Math.abs(r.y - run.y) < 3)
      if (row) row.parts.push(run)
      else rows.push({ y: run.y, parts: [run] })
    }
    for (const row of rows) pages.push(row.parts.sort((a, b) => a.x - b.x).map((p) => p.str.trim()).join("  "))
  }
  return pages.join("\n")
}

export async function readStatementFile(file: File): Promise<StatementLine[]> {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name)
  if (isPdf) return parseStatementText(await pdfToStatementText(await file.arrayBuffer()))
  const text = await file.text()
  if (/\.csv$/i.test(file.name) || file.type === "text/csv") return parseStatementCsv(text)
  return parseStatementText(text)
}
