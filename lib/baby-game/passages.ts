/**
 * lib/baby-game/passages.ts — Searching a friend's bookshelf for passages (the study tools)
 *
 * The two search tools a studying friend has (`study-llm.ts`): across the whole shelf, or inside one book. Each book's
 * words are cut into ~700-character passages that remember their page. A query is scored with BM25 (keywords) and the
 * best few are, when an embedding model is available (`Library.embed`), re-ranked by meaning (cosine), so "what makes
 * a person brave" can find a passage about courage that never uses the word "brave". Without an embedding model the
 * keyword order stands. Pure apart from the caches and the injected loaders.
 */

import type { Book } from "./shelf"
import { pageAt } from "./shelf"

export type Passage = {
  bookId: string
  title: string
  page: number
  from: number
  text: string
  /** Term counts, for scoring. */
  tf: Map<string, number>
  len: number
}

/** What a studying friend can reach: the books, how to open one, and optionally how to embed text. */
export type Library = {
  books: Book[]
  text: (b: Book) => Promise<string | null>
  /** One vector per text, or null when no embedding model answers. */
  embed?: (texts: string[]) => Promise<number[][] | null>
}

export const PASSAGE = 700
const OVERLAP = 120
export const SHORTLIST = 14

const STOP = new Set("the a an and or of to in on for with is are was were be it that this as at by from you your their they them we our i my me he she his her its not but so if then than into out also can will would should could there what which who whom how why when where about have has had been being does did done more most some any all one two".split(" "))

const stem = (w: string) => w.replace(/(ing|edly|ed|es|s)$/, (m, _x, off: number) => (off >= 3 ? "" : m))

export const terms = (t: string): string[] => (t.toLowerCase().match(/[a-z]{3,}/g) ?? []).filter((w) => !STOP.has(w)).map(stem)

const cache = new Map<string, Passage[]>()

/** Cut a book into overlapping passages that end on a sentence when one is close. */
export function chunkBook(book: Pick<Book, "id" | "title" | "pageStarts">, text: string): Passage[] {
  const out: Passage[] = []
  let from = 0
  while (from < text.length) {
    let to = Math.min(text.length, from + PASSAGE)
    if (to < text.length) {
      const cut = text.slice(from + Math.floor(PASSAGE * 0.6), to).search(/[.!?]\s[^.!?]*$/)
      if (cut >= 0) to = from + Math.floor(PASSAGE * 0.6) + cut + 1
    }
    const body = text.slice(from, to).trim()
    if (body.length >= 40) {
      const tf = new Map<string, number>()
      const ts = terms(body)
      for (const w of ts) tf.set(w, (tf.get(w) ?? 0) + 1)
      out.push({ bookId: book.id, title: book.title, page: pageAt(book, from), from, text: body, tf, len: ts.length })
    }
    if (to >= text.length) break
    from = Math.max(from + 1, to - OVERLAP)
  }
  return out
}

async function passagesOf(lib: Library, b: Book): Promise<Passage[]> {
  const key = `${b.id}:${b.chars}:${b.title}`
  const hit = cache.get(key)
  if (hit) return hit
  const text = await lib.text(b)
  if (!text) return []
  const ps = chunkBook(b, text)
  cache.set(key, ps)
  return ps
}

/** BM25 over a set of passages. Returns each with its score, best first (zero scores dropped). */
export function rank(ps: Passage[], query: string): Array<{ p: Passage; score: number }> {
  const q = [...new Set(terms(query))]
  if (!q.length || !ps.length) return []
  const df = new Map<string, number>()
  for (const w of q) df.set(w, ps.reduce((n, p) => n + (p.tf.has(w) ? 1 : 0), 0))
  const avg = ps.reduce((n, p) => n + p.len, 0) / ps.length || 1
  const out: Array<{ p: Passage; score: number }> = []
  for (const p of ps) {
    let score = 0
    for (const w of q) {
      const f = p.tf.get(w) ?? 0
      if (!f) continue
      const idf = Math.log(1 + (ps.length - df.get(w)! + 0.5) / (df.get(w)! + 0.5))
      score += idf * ((f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (p.len / avg))))
    }
    if (score > 0) out.push({ p, score })
  }
  return out.sort((x, y) => y.score - x.score)
}

const cos = (a: number[], b: number[]) => {
  let d = 0
  let x = 0
  let y = 0
  for (let i = 0; i < a.length; i++) {
    d += a[i]! * b[i]!
    x += a[i]! * a[i]!
    y += b[i]! * b[i]!
  }
  return x && y ? d / Math.sqrt(x * y) : 0
}

const vecs = new Map<string, number[]>()

/**
 * The best `k` passages for a query across the shelf, or inside `only`. The keyword shortlist is re-ranked by meaning
 * when `lib.embed` answers; if it does not, the keyword order is kept.
 */
export async function searchLibrary(lib: Library, query: string, opts: { only?: Book; k?: number } = {}): Promise<Passage[]> {
  const k = opts.k ?? 3
  const books = opts.only ? [opts.only] : lib.books
  const all = (await Promise.all(books.map((b) => passagesOf(lib, b)))).flat()
  const ranked = rank(all, query)
  const short = ranked.slice(0, SHORTLIST)
  if (!short.length) return []
  if (lib.embed && short.length > k) {
    const need = short.filter((x) => !vecs.has(`${x.p.bookId}:${x.p.from}`))
    try {
      const got = await lib.embed([query, ...need.map((x) => x.p.text)])
      if (got && got.length === need.length + 1) {
        need.forEach((x, i) => vecs.set(`${x.p.bookId}:${x.p.from}`, got[i + 1]!))
        const top = short[0]!.score || 1
        return short
          .map((x) => ({ x, s: 0.3 * (x.score / top) + 0.7 * cos(got[0]!, vecs.get(`${x.p.bookId}:${x.p.from}`)!) }))
          .sort((a, b) => b.s - a.s)
          .slice(0, k)
          .map((r) => r.x.p)
      }
    } catch {
      // no embedding model: the keyword order stands
    }
  }
  return short.slice(0, k).map((x) => x.p)
}

/** Does `quote` appear word for word in `text` (case, spacing and curly quotes aside)? */
export function hasQuote(text: string, quote: string): boolean {
  const norm = (t: string) => t.toLowerCase().replace(/[“”"‘’']/g, "").replace(/\s+/g, " ").trim()
  const q = norm(quote)
  return q.length >= 20 && norm(text).includes(q)
}
