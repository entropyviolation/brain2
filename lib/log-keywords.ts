/**
 * lib/log-keywords.ts — Saved phrases for `log` / `log:`
 *
 * Matching is longest-phrase-first. The remainder must be empty or a log-line
 * date/time; otherwise the line stays a free-form log. A bare phrase with no
 * `log` prefix is not matched here.
 */

export function normalizeLogKeyword(raw: string): string {
  return raw.trim().replace(/\s+/g, " ")
}

export function isLogKeywordListQuery(payload: string): boolean {
  return payload.trim().toLowerCase() === "keywords"
}

export function formatLogKeywordList(keywords: readonly string[]): string {
  if (keywords.length === 0) return "No log keywords saved."
  const lines = keywords.map((phrase, index) => `${index + 1}. ${phrase}`)
  return ["Log keywords", ...lines].join("\n")
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export interface SavedLogKeywordHit {
  /** Stored phrase, including its saved capitalization. */
  phrase: string
  /** Text after the phrase. Empty means “at send time”. */
  rest: string
}

/**
 * Longest saved phrase that begins the line and leaves a remainder `restIsWhen`
 * accepts (including an empty remainder). A shorter word cannot eat a longer one.
 */
export function matchSavedLogKeyword(
  line: string,
  keywords: readonly string[],
  restIsWhen: (rest: string) => boolean,
): SavedLogKeywordHit | null {
  const ranked = keywords
    .map((raw) => ({ raw, phrase: normalizeLogKeyword(raw) }))
    .filter((row) => row.phrase.length > 0)
    .sort((a, b) => b.phrase.length - a.phrase.length || a.phrase.localeCompare(b.phrase))

  const hay = line.trim()
  for (const row of ranked) {
    const words = row.phrase.split(" ")
    const body = words.map(escapeRegExp).join(String.raw`\s+`)
    const match = new RegExp(`^${body}(?=\\s|$)`, "i").exec(hay)
    if (!match) continue
    const rest = hay.slice(match[0].length).trim()
    if (!restIsWhen(rest)) continue
    return { phrase: row.phrase, rest }
  }
  return null
}
