/**
 * lib/ingest/index-list.ts — A line that is only list indexes
 *
 * `1`, `1,8`, and `1, 8` select those positions. A line with any other
 * character (a title, a word, a space-separated pair) stays one piece of text.
 * Commas are the only separator. Whitespace around them is ignored.
 */

export function isIndexListLine(line: string): boolean {
  return /^\d+(?:\s*,\s*\d+)*$/.test(line.trim())
}

/** Indexes in range, de-duplicated, source order. Empty when the line is not an index list. */
export function parseIndexListLine(line: string, max: number): number[] {
  if (!isIndexListLine(line)) return []
  const out: number[] = []
  for (const token of line.split(",")) {
    const n = Number(token.trim())
    if (Number.isInteger(n) && n >= 1 && n <= max && !out.includes(n)) out.push(n)
  }
  return out
}
