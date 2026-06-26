/**
 * lib/book-match.ts — Fuzzy match a PDF's text/title to a book item
 *
 * The Book-Tasting module attaches PDFs (e-books, papers) to a Reading List and
 * needs to figure out *which* book a freshly added PDF belongs to. This module
 * is the pure, dependency-free matcher behind that flow (and the `matcher` view
 * kind): given a query string (a PDF's title, file name, or extracted text) and
 * a set of candidate books, it returns the most likely book plus a 0–1 score.
 *
 * Scoring blends three cheap, deterministic signals so it works offline and is
 * unit-testable:
 *   - **Token overlap** (Jaccard over normalized word sets) — order-independent.
 *   - **Substring containment** — a candidate title appearing verbatim in the
 *     query (common when matching extracted body text) is a strong signal.
 *   - **Author bonus** — the author surname appearing in the query nudges ties.
 *
 * `findBookMatch` enforces a confidence threshold and returns `null` below it,
 * which is exactly what a workflow needs to "error/throw when nothing matches".
 */

/** A book the matcher can link a PDF to. `title` is required; author optional. */
export interface BookMatchCandidate {
  id: string
  title: string
  author?: string
}

/** A scored match: which candidate, its 0–1 confidence, and the matched title. */
export interface BookMatchResult {
  candidateId: string
  title: string
  /** Confidence in [0, 1]; higher is a better match. */
  score: number
}

/** Default confidence below which a match is treated as "no match". */
export const DEFAULT_MATCH_THRESHOLD = 0.34

/** Tokens too generic to carry matching signal (dropped before scoring). */
const STOPWORDS = new Set([
  "the", "a", "an", "of", "and", "or", "to", "in", "on", "for", "with", "by",
  "pdf", "epub", "draft", "final", "copy", "ed", "edition", "vol", "volume",
])

/** Lowercase, strip punctuation, split into meaningful tokens (stopwords removed). */
export function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[_\-./\\]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
}

/** A normalized, comparable form of a string (collapsed whitespace, lowercased). */
export function normalizeText(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

/** Jaccard similarity of two token sets (|A∩B| / |A∪B|); 0 when either empty. */
function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const setA = new Set(a)
  const setB = new Set(b)
  let inter = 0
  for (const t of setA) if (setB.has(t)) inter += 1
  const union = setA.size + setB.size - inter
  return union === 0 ? 0 : inter / union
}

/** Fraction of the candidate's tokens that appear anywhere in the query tokens. */
function containmentOfCandidate(queryTokens: string[], candidateTokens: string[]): number {
  if (candidateTokens.length === 0) return 0
  const querySet = new Set(queryTokens)
  let hit = 0
  for (const t of candidateTokens) if (querySet.has(t)) hit += 1
  return hit / candidateTokens.length
}

/**
 * Score how well `query` matches a single candidate book, in [0, 1]. Pure and
 * deterministic — the same inputs always yield the same score.
 */
export function scoreBookMatch(query: string, candidate: BookMatchCandidate): number {
  const queryNorm = normalizeText(query)
  const queryTokens = tokenize(query)
  const titleTokens = tokenize(candidate.title)
  const titleNorm = normalizeText(candidate.title)

  if (queryTokens.length === 0 || titleTokens.length === 0) return 0

  const jac = jaccard(queryTokens, titleTokens)
  const containment = containmentOfCandidate(queryTokens, titleTokens)
  // Verbatim title appearing in the (often long) extracted query body.
  const substring = titleNorm.length > 0 && queryNorm.includes(titleNorm) ? 1 : 0

  let score = 0.45 * jac + 0.45 * containment + 0.5 * substring

  // Author surname appearing in the query is a small tie-breaking bonus.
  if (candidate.author) {
    const authorTokens = tokenize(candidate.author)
    const querySet = new Set(queryTokens)
    if (authorTokens.some((t) => querySet.has(t))) score += 0.12
  }

  return Math.max(0, Math.min(1, score))
}

/**
 * Rank every candidate against `query`, best first. Ties broken by the longer
 * title (more specific). Candidates scoring 0 are still included (sorted last).
 */
export function rankBookMatches(query: string, candidates: BookMatchCandidate[]): BookMatchResult[] {
  return candidates
    .map((c) => ({ candidateId: c.id, title: c.title, score: scoreBookMatch(query, c) }))
    .sort((a, b) => b.score - a.score || b.title.length - a.title.length)
}

/** The single best candidate for `query`, or `null` when there are none. */
export function bestBookMatch(query: string, candidates: BookMatchCandidate[]): BookMatchResult | null {
  if (candidates.length === 0) return null
  return rankBookMatches(query, candidates)[0] ?? null
}

/**
 * The best candidate **only if** it clears `threshold`; otherwise `null`. This
 * is the "error if no match" gate: a `null` result means a workflow should
 * `throw`/flag the PDF as unmatched.
 */
export function findBookMatch(
  query: string,
  candidates: BookMatchCandidate[],
  threshold: number = DEFAULT_MATCH_THRESHOLD,
): BookMatchResult | null {
  const best = bestBookMatch(query, candidates)
  if (!best || best.score < threshold) return null
  return best
}
