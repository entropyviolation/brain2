/**
 * lib/bim-flow/web-lane.ts — BIM chat looks something up on the web
 *
 * The code half of the chat lane's `web` tool (`chat-lane.ts`). All of it is rules, no model:
 *
 *   - `splitAside`   "i prob will have to do my laundry can you find out what time …?" is two things:
 *                    something to do ("do laundry") and a question. The to-do is only ever proposed.
 *   - `webCue`       sure signs a question is about the outside world (opening hours, "find out", "near me").
 *   - `needsHome`    the question leans on where the person lives ("by my house").
 *   - `parseHomeTell` "I live in North Park, San Diego" as a told fact.
 *   - `webLines`     search results and page text cut to the passages that bear on the question.
 *   - `hubSearch`    the call to the Mac hub's `/api/web-search` (`web-search.mjs`). Only the query leaves the Mac.
 */

import { contentWords } from "./vault-search"

export interface WebResult {
  title: string
  url: string
  snippet: string
}

export interface WebFound {
  query: string
  results: WebResult[]
  pages: { url: string; text: string }[]
}

export type WebSearch = (query: string) => Promise<WebFound | null>

// ---------------------------------------------------------------- the line

const LEAD =
  /^(?:(?:also|and|oh|btw|so|ok|okay|ugh|hmm|plus)[,\s]+)*(?:i|we)(?:['’]ll|\s+will)?\s+(?:(?:prob|probs|probably|might|also|really|still|def|definitely|will|just|kinda|kind of)\s+)*(?:have to|need to|gotta|got to|should|must|ought to|am going to|['’]m going to|gonna|want to|wanna)\s+/i
const ASK =
  /(?:^|[\s,.;!]+)(?:(?:and|so|but|then)\s+)?((?:can|could|would|will)\s+(?:you|u)\b|do you know\b|find out\b|look up\b|(?:what|when|where|how|who|which)\b|(?:is|are)\s+there\b)/i
/** A "to-do" that is really the asking itself ("I need to find out when …"). */
const RESEARCH = /^(figure out|find out|find|know|check|see|look up|look into|ask|google|search|remember|decide)\b/i

export interface Aside {
  /** The thing to do, as a To Do title ("do laundry"). Never filed here; the chat only offers it. */
  todo?: string
  /** The part that asks. The whole line when it is not two things. */
  question: string
}

/** Split "I'll have to <do a thing> <question>?" into the thing and the question. Anything else comes back whole. */
export function splitAside(text: string): Aside {
  const whole = text.trim()
  const lead = LEAD.exec(whole)
  if (!lead) return { question: whole }
  const rest = whole.slice(lead[0].length)
  const ask = ASK.exec(rest)
  if (!ask || ask.index === 0) return { question: whole }
  const question = rest.slice(ask.index + ask[0].length - ask[1]!.length).trim()
  let todo = rest
    .slice(0, ask.index)
    .replace(/[\s,.;!]+$/g, "")
    .replace(/\s+(and|so|but|then|today|tonight|soon|too|as well)$/i, (m) => (/today|tonight/i.test(m) ? m : ""))
    .replace(/^do (my|the|our) /i, "do ")
    .trim()
  todo = todo.replace(/\s+/g, " ")
  const words = todo.split(" ").filter(Boolean).length
  if (!question || !todo || todo.length > 60 || words > 8 || RESEARCH.test(todo)) return { question: whole }
  return { todo, question }
}

const HOME = /\b(?:by|near|around|close to|closest to|next to|from)\s+(?:my|our)\s+(?:house|home|place|apartment|apt|flat|condo)\b|\bnear\s+(?:me|us|here)\b|\bnearby\b|\baround here\b|\bin my (?:area|neighbou?rhood|town|city)\b/i
const LOOKUP = /\b(?:find out|look (?:it|that|this) up|look up|search (?:the web|online|the internet)|google it|on the (?:web|internet))\b/i
const HOURS =
  /\b(?:what time|how late|how early|until when|till when)\b.*\b(?:open|opens|close|closes|closed|closing|opening)\b|\bwhen (?:do|does|will|is|are)\b.*\b(?:open|opens|close|closes|closing|opening)\b|\b(?:opening|closing|business|store) (?:hours|times?)\b|\b(?:is|are)\b.*\b(?:open|closed)\b.*\b(?:right now|now|today|tonight|tomorrow|late)\b/i

/** True when the question leans on where the person lives. "Near me" is read as near home. */
export function needsHome(text: string): boolean {
  return HOME.test(text)
}

/** Sure signs, in code, that a question is about the outside world and worth a web search. */
export function webCue(text: string): boolean {
  return LOOKUP.test(text) || HOURS.test(text) || HOME.test(text)
}

/** "I live in North Park, San Diego" / "my address is 12 Elm St": where home is, in the person's words. Null otherwise. */
export function parseHomeTell(text: string): string | null {
  const m = /^(?:i|we) live (?:at|in|on|near|by|off)\s+(.+)$|^(?:my|our) (?:home )?address is\s+(.+)$|^(?:my|our) (?:house|home|place|apartment|apt) is (?:at|in|on|near|by|off)\s+(.+)$/i.exec(text.trim())
  const said = (m?.[1] ?? m?.[2] ?? m?.[3] ?? "").trim()
  return said && !/\?\s*$/.test(said) ? cleanHome(said) : null
}

/** A typed answer to "where do you live?", trimmed to the place. */
export function cleanHome(text: string): string {
  return text
    .trim()
    .replace(/^(?:(?:i|we) live (?:at|in|on|near|by|off)|it['’]?s|its|at|in|on|near|by)\s+/i, "")
    .replace(/[.!\s]+$/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 120)
}

/** A query from the question alone, for when no model writes one: the content words, then home. */
export function codeQuery(question: string, home?: string): string {
  const q = question
    .replace(LOOKUP, " ")
    .replace(HOME, " ")
    .replace(/\b(?:can|could|would|will) (?:you|u)\b|\bdo you know\b|\bplease\b/gi, " ")
    .replace(/[?!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return [q, needsHome(question) && home ? `near ${home}` : ""].filter(Boolean).join(" ").slice(0, 160)
}

// ---------------------------------------------------------------- the results

const CLOCK = /\b\d{1,2}(?::\d\d)?\s?(?:a\.?m\.?|p\.?m\.?)\b|\b24[\s-]?(?:hours|hrs|hr|\/7)\b|\b(?:open|opens|close|closes|closed|hours)\b/i
const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

/** The lines of a page that bear on the query: its words, and clock times when the question is about hours. */
export function pickPassages(text: string, query: string, opts: { clock?: boolean; cap?: number } = {}): string {
  const cap = opts.cap ?? 480
  const words = contentWords(query)
  const lines = text.split("\n").flatMap((l) => (l.length > 260 ? l.split(/(?<=[.!?])\s+/) : [l]))
  const scored = lines
    .map((line, i) => {
      const lower = line.toLowerCase()
      const hits = words.filter((w) => lower.includes(w)).length
      const timed = opts.clock && CLOCK.test(line) ? (/\d/.test(line) ? 3 : 1) : 0
      return { line: line.slice(0, 260), i, score: hits + timed }
    })
    .filter((s) => s.score > (opts.clock ? 1 : 0))
    .sort((a, b) => b.score - a.score || a.i - b.i)
  const kept: typeof scored = []
  let size = 0
  for (const s of scored) {
    if (size + s.line.length > cap) continue
    kept.push(s)
    size += s.line.length + 3
  }
  return kept.sort((a, b) => a.i - b.i).map((s) => s.line).join(" | ")
}

export interface WebLines {
  /** What the reply model reads: one numbered block per source. */
  lines: string[]
  /** What the chat's evidence fold shows: the query, then each source. */
  sources: string[]
}

/** Cut a search to what the model can use in a small context: snippets, and the best passages of the pages read. */
export function webLines(found: WebFound, question: string, cap = 3600): WebLines {
  const clock = HOURS.test(question) || /\b(?:hours|open|close)\b/i.test(question)
  const byUrl = new Map(found.pages.map((p) => [p.url, p.text]))
  const lines: string[] = []
  let size = 0
  for (const [i, r] of found.results.entries()) {
    const page = byUrl.get(r.url)
    const passage = page ? pickPassages(page, `${found.query} ${question}`, { clock }) : ""
    const block = `[${i + 1}] ${r.title} (${host(r.url)})${r.snippet ? `: ${r.snippet.slice(0, 300)}` : ""}${passage ? `\n    page says: ${passage}` : ""}`
    if (size + block.length > cap) break
    lines.push(block)
    size += block.length
  }
  return {
    lines,
    sources: [`searched the web: ${found.query}`, ...found.results.slice(0, lines.length).map((r) => `${r.title} · ${r.url}`)].slice(0, 9),
  }
}

// ---------------------------------------------------------------- the hub

/** Ask the hub to search. `base` and `headers` are the hub's address and token on the iPhone; default same origin. Null when it cannot. */
export async function hubSearch(query: string, opts: { base?: string; headers?: Record<string, string>; signal?: AbortSignal } = {}): Promise<WebFound | null> {
  try {
    const q = new URLSearchParams({ q: query.slice(0, 200), read: "3" })
    const res = await fetch(`${opts.base ?? ""}/api/web-search?${q}`, { headers: opts.headers, signal: opts.signal ?? AbortSignal.timeout(30_000) })
    if (!res.ok) return null
    const body = (await res.json()) as Partial<WebFound> & { ok?: boolean }
    if (!body.ok || !Array.isArray(body.results)) return null
    return { query: body.query ?? query, results: body.results, pages: Array.isArray(body.pages) ? body.pages : [] }
  } catch {
    return null
  }
}
