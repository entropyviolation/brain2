/**
 * lib/csv.ts — Minimal CSV / TSV spreadsheet parser
 *
 * Dependency-free delimited-table reader for user spreadsheet exports: handles
 * quoted fields, escaped double-quotes (""), delimiters inside quotes, and
 * CRLF/LF line endings. Returns the header row plus the data rows. Used by the
 * Lists panel's "Import spreadsheet" (create/update a list whose attributes
 * match the column headers).
 */

export interface ParsedCsv {
  headers: string[]
  rows: string[][]
}

/** Parse comma-separated values (default spreadsheet download format). */
export function parseCsv(text: string): ParsedCsv {
  return parseDelimited(text, ",")
}

/** Parse tab-separated values (TSV / Excel / Sheets clipboard dumps saved as files). */
export function parseTsv(text: string): ParsedCsv {
  return parseDelimited(text, "\t")
}

/**
 * Parse a spreadsheet file by extension, falling back to delimiter detection
 * when the name is ambiguous (e.g. `.txt`).
 */
export function parseSpreadsheetText(text: string, fileName = ""): ParsedCsv {
  if (/\.tsv$/i.test(fileName)) return parseTsv(text)
  if (/\.csv$/i.test(fileName)) return parseCsv(text)
  return parseDelimited(text, detectDelimiter(text))
}

/** Prefer tab when the first data line has more tabs than commas. */
export function detectDelimiter(text: string): "," | "\t" {
  const first = text.replace(/^\uFEFF/, "").split(/\r?\n/).find((l) => l.trim() !== "") ?? ""
  let tabs = 0
  let commas = 0
  let inQuotes = false
  for (let i = 0; i < first.length; i++) {
    const ch = first[i]
    if (ch === '"') {
      if (inQuotes && first[i + 1] === '"') {
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (inQuotes) continue
    if (ch === "\t") tabs++
    else if (ch === ",") commas++
  }
  return tabs > commas ? "\t" : ","
}

export function parseDelimited(text: string, delimiter: string): ParsedCsv {
  const rows: string[][] = []
  let field = ""
  let row: string[] = []
  let inQuotes = false

  // Strip a leading BOM if present.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === delimiter) {
        row.push(field)
        field = ""
      } else if (ch === "\n") {
        row.push(field)
        rows.push(row)
        row = []
        field = ""
      } else if (ch === "\r") {
        // ignore; handled by \n
      } else {
        field += ch
      }
    }
  }
  // Flush trailing field/row.
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  // Drop fully-empty trailing rows.
  const cleaned = rows.filter((r) => r.some((c) => c.trim() !== ""))
  if (cleaned.length === 0) return { headers: [], rows: [] }

  const headers = cleaned[0].map((h) => h.trim())
  return { headers, rows: cleaned.slice(1) }
}

/** Guess an attribute type from a column's values. */
export function inferColumnType(
  header: string,
  values: string[],
): "string" | "number" | "link" {
  const h = header.toLowerCase()
  const nonEmpty = values.map((v) => v.trim()).filter(Boolean)
  if (h.includes("url") || h.includes("link") || (nonEmpty.every((v) => /^https?:\/\//.test(v)) && nonEmpty.length > 0))
    return "link"
  if (
    h.includes("price") ||
    h.includes("cost") ||
    h.includes("$") ||
    (nonEmpty.length > 0 && nonEmpty.every((v) => !isNaN(Number(v.replace(/[$,]/g, "")))))
  )
    return "number"
  return "string"
}
