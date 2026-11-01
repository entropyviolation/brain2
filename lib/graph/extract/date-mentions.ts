/**
 * lib/graph/extract/date-mentions.ts — Explicit dates written in text, as
 * `day:YYYY-MM-DD` addresses (KG-D2, KG-N10). Pure and conservative.
 *
 * Reads `2026-10-03`, `Oct 3 2026`, `October 3rd, 2026`, `3 October`,
 * `3 Oct 2026`, and `today` / `yesterday` / `tomorrow` against `now` (local
 * calendar). A date with no year takes `now`'s year. Impossible dates are
 * dropped. Weekday names, "last week", and numeric `3/10` are not read: they
 * are ambiguous.
 */
import { formatLocalDateKey } from "@/lib/date-utils"

export interface DateMention {
  address: `day:${string}`
  /** YYYY-MM-DD. */
  date: string
  span: string
  start: number
  end: number
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
const MONTH = "(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
const B = "(?<![\\p{L}\\p{N}])"
const E = "(?![\\p{L}\\p{N}])"
const ORD = "(?:st|nd|rd|th)?"

const PATTERNS: { re: RegExp; read: (m: RegExpExecArray, now: Date) => Date | null }[] = [
  { re: new RegExp(`${B}(\\d{4})-(\\d{2})-(\\d{2})${E}`, "gu"), read: (m) => day(+m[1], +m[2] - 1, +m[3]) },
  {
    re: new RegExp(`${B}${MONTH}\\.?\\s+(\\d{1,2})${ORD}(?:,?\\s+(\\d{4}))?${E}`, "giu"),
    read: (m, now) => day(m[3] ? +m[3] : now.getFullYear(), monthIndex(m[1]), +m[2]),
  },
  {
    re: new RegExp(`${B}(\\d{1,2})${ORD}\\s+(?:of\\s+)?${MONTH}\\.?(?:,?\\s+(\\d{4}))?${E}`, "giu"),
    read: (m, now) => day(m[3] ? +m[3] : now.getFullYear(), monthIndex(m[2]), +m[1]),
  },
  {
    re: new RegExp(`${B}(today|yesterday|tomorrow)${E}`, "giu"),
    read: (m, now) => {
      const shift = { today: 0, yesterday: -1, tomorrow: 1 }[m[1].toLowerCase() as "today"]
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() + shift)
    },
  },
]

function monthIndex(word: string): number {
  return MONTHS.indexOf(word.slice(0, 3).toLowerCase())
}

function day(year: number, month: number, date: number): Date | null {
  if (month < 0 || month > 11 || date < 1 || date > 31 || year < 1000) return null
  const d = new Date(year, month, date)
  return d.getFullYear() === year && d.getMonth() === month && d.getDate() === date ? d : null
}

export function extractDateMentions(text: string, now: Date): DateMention[] {
  const found: DateMention[] = []
  for (const { re, read } of PATTERNS) {
    const rx = new RegExp(re.source, re.flags)
    for (let m = rx.exec(text); m; m = rx.exec(text)) {
      const d = read(m, now)
      if (!d) continue
      const date = formatLocalDateKey(d)
      found.push({ address: `day:${date}`, date, span: m[0], start: m.index, end: m.index + m[0].length })
    }
  }
  found.sort((a, b) => a.start - b.start || b.end - a.end)
  const out: DateMention[] = []
  for (const hit of found) {
    const last = out[out.length - 1]
    if (last && hit.start < last.end) continue
    out.push(hit)
  }
  return out
}
