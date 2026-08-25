/**
 * lib/spreadsheet-file.ts — Load a user-uploaded spreadsheet into headers + rows
 *
 * Supports CSV / TSV / TXT (via `parseSpreadsheetText`) and Excel `.xlsx` / `.xls`
 * (via SheetJS). Used by Lists "Import spreadsheet".
 */
import { parseSpreadsheetText, type ParsedCsv } from "@/lib/csv"

const EXCEL_EXT = /\.(xlsx|xls)$/i

export function isExcelSpreadsheetName(fileName: string): boolean {
  return EXCEL_EXT.test(fileName)
}

/** Read an uploaded File into a headered table. */
export async function parseSpreadsheetFile(file: File): Promise<ParsedCsv> {
  if (isExcelSpreadsheetName(file.name) || looksLikeExcelMime(file.type)) {
    return parseExcelArrayBuffer(await file.arrayBuffer())
  }
  const text = await file.text()
  return parseSpreadsheetText(text, file.name)
}

function looksLikeExcelMime(mime: string): boolean {
  return (
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "application/vnd.ms-excel"
  )
}

async function parseExcelArrayBuffer(buffer: ArrayBuffer): Promise<ParsedCsv> {
  const XLSX = await import("xlsx")
  const workbook = XLSX.read(buffer, { type: "array" })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return { headers: [], rows: [] }
  const sheet = workbook.Sheets[sheetName]
  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null | undefined)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown as Array<Array<string | number | boolean | null | undefined>>
  const cleaned = matrix
    .map((row) => row.map((c) => (c == null ? "" : String(c))))
    .filter((r) => r.some((c) => c.trim() !== ""))
  if (cleaned.length === 0) return { headers: [], rows: [] }
  return {
    headers: cleaned[0].map((h) => h.trim()),
    rows: cleaned.slice(1).map((r) => {
      // Pad short rows to the header width so column indices stay aligned.
      const padded = [...r]
      while (padded.length < cleaned[0].length) padded.push("")
      return padded
    }),
  }
}
