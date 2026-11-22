/**
 * lib/bim-flow/web-search.mjs — Web search for BIM chat, run on the Mac hub
 *
 * The browser cannot fetch a search page (CORS), so the hub does it:
 * `/api/web-search` in `scripts/persist-api.mjs` calls `webSearch`. One search,
 * then the first few result pages are read and cut to plain text, because a
 * snippet rarely states the fact (opening hours). Only the query leaves the Mac.
 * Nothing here reads the vault.
 *
 * Providers, tried in order; one with no key is skipped, one that fails hands on to the next:
 *   1. Brave Search API, `BRAIN2_BRAVE_SEARCH_KEY` (its own index; monthly free credits).
 *   2. Tavily, `BRAIN2_TAVILY_KEY` (a free monthly allowance, no card).
 *   3. DuckDuckGo's HTML page, keyless. Since 2026-11 it often answers the hub with its
 *      bot check; that is reported as blocked, never got around.
 * Keys come from the environment or the gitignored `.env.local`, read on every search, so
 * adding a key needs no restart.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { brain2Env, brain2EnvLine } from "../brain2-env.mjs"

const SEARCH_URL = "https://html.duckduckgo.com/html/"
const BRAVE_URL = "https://api.search.brave.com/res/v1/web/search"
const TAVILY_URL = "https://api.tavily.com/search"
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
const SEARCH_TIMEOUT_MS = 10_000
const PAGE_TIMEOUT_MS = 6_000
const PAGE_MAX_BYTES = 600_000
export const PAGE_TEXT_CAP = 8_000
export const MAX_RESULTS = 8
export const MAX_READ = 4

const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", hellip: "…", middot: "·" }

/** HTML entities to characters: the named few a result page uses, and any numbered one. */
export function decodeEntities(text) {
  return String(text).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : " "
    }
    return NAMED[body.toLowerCase()] ?? whole
  })
}

const strip = (html) => decodeEntities(String(html).replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim()

/** True for an http(s) address on the public internet. A result must never make the hub fetch the Mac or the LAN. */
export function publicUrl(raw) {
  let url
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "")
  if (!host.includes(".") && !host.includes(":")) return false
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".lan")) return false
  if (host.includes(":")) return false
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])]
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false
    if (a === 192 && b === 168) return false
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 169 && b === 254) return false
    if (a === 100 && b >= 64 && b <= 127) return false
  }
  return true
}

/** The real address behind a result link: DuckDuckGo wraps some as `/l/?uddg=<address>`. */
function resultUrl(href) {
  const raw = decodeEntities(href).trim()
  const full = raw.startsWith("//") ? `https:${raw}` : raw
  try {
    const url = new URL(full)
    if (/(^|\.)duckduckgo\.com$/.test(url.hostname)) {
      const wrapped = url.searchParams.get("uddg")
      return wrapped && url.pathname.startsWith("/l/") ? wrapped : ""
    }
    return url.href
  } catch {
    return ""
  }
}

/** Title, address and snippet of each result on a DuckDuckGo HTML page. Ads and links off the public web are dropped. */
export function parseDuckResults(html, limit = MAX_RESULTS) {
  const out = []
  const seen = new Set()
  const parts = String(html).split(/class="[^"]*\bresult__a\b[^"]*"/).slice(1)
  for (const part of parts) {
    const href = /href="([^"]+)"/.exec(part.slice(0, part.indexOf(">") + 1) || part)?.[1] ?? ""
    const url = resultUrl(href)
    if (!url || !publicUrl(url) || seen.has(url)) continue
    const title = strip(part.slice(part.indexOf(">") + 1, part.indexOf("</a>")))
    const snip = /class="[^"]*\bresult__snippet\b[^"]*"[^>]*>([\s\S]*?)<\/a>/.exec(part)?.[1] ?? ""
    if (!title) continue
    seen.add(url)
    out.push({ title: title.slice(0, 160), url, snippet: strip(snip).slice(0, 400) })
    if (out.length >= limit) break
  }
  return out
}

/** A page as plain text, one block per line, without scripts, styles or markup. */
export function pageText(html, cap = PAGE_TEXT_CAP) {
  const body = String(html)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|head|template|iframe)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/?(p|div|li|ul|ol|tr|td|th|table|br|h[1-6]|section|article|header|footer|nav|main|dd|dt|dl|address|time|span)\b[^>]*>/gi, (tag) => (/^<\/?(span|time|td|th)\b/i.test(tag) ? " " : "\n"))
    .replace(/<[^>]+>/g, " ")
  const lines = decodeEntities(body)
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 1)
  const kept = []
  let size = 0
  for (const line of lines) {
    if (kept[kept.length - 1] === line) continue
    if (size + line.length + 1 > cap) break
    kept.push(line)
    size += line.length + 1
  }
  return kept.join("\n")
}

/** One page's text, or "" when it cannot be read. Redirects are followed by hand so each hop is checked. */
async function readPage(url, fetchImpl) {
  let at = url
  try {
    for (let hop = 0; hop < 4; hop++) {
      if (!publicUrl(at)) return ""
      const res = await fetchImpl(at, {
        redirect: "manual",
        signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
        headers: { "User-Agent": AGENT, Accept: "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.8" },
      })
      if (res.status >= 300 && res.status < 400) {
        const next = res.headers.get("location")
        if (!next) return ""
        at = new URL(next, at).href
        continue
      }
      if (!res.ok || !/html|text\/plain/i.test(res.headers.get("content-type") ?? "")) return ""
      const raw = await res.text()
      return pageText(raw.slice(0, PAGE_MAX_BYTES))
    }
  } catch {
    /* a page that will not load is skipped */
  }
  return ""
}

/** A `BRAIN2_` setting from the environment, else from `.env.local` / `.env` at the repo root. "" when unset. */
export function searchKey(suffix, env = process.env, root = ROOT) {
  const fromEnv = brain2Env(suffix, env)
  if (fromEnv && fromEnv.trim()) return fromEnv.trim()
  for (const name of [".env.local", ".env"]) {
    try {
      const line = brain2EnvLine(fs.readFileSync(path.join(root, name), "utf8"), suffix)
      if (line) return line.trim()
    } catch {
      /* no file */
    }
  }
  return ""
}

/** Brave's results (`web.results`): its `description` carries <strong> marks. */
export function parseBraveResults(body, limit = MAX_RESULTS) {
  const rows = Array.isArray(body?.web?.results) ? body.web.results : []
  return tidyRows(rows.map((r) => ({ title: strip(r?.title ?? ""), url: String(r?.url ?? ""), snippet: strip([r?.description, ...(Array.isArray(r?.extra_snippets) ? r.extra_snippets : [])].filter(Boolean).join(" … ")) })), limit)
}

/** Tavily's results (`results`, with `content` as the snippet). */
export function parseTavilyResults(body, limit = MAX_RESULTS) {
  const rows = Array.isArray(body?.results) ? body.results : []
  return tidyRows(rows.map((r) => ({ title: strip(r?.title ?? ""), url: String(r?.url ?? ""), snippet: strip(r?.content ?? "") })), limit)
}

function tidyRows(rows, limit) {
  const out = []
  const seen = new Set()
  for (const r of rows) {
    if (!r.title || !r.url || !publicUrl(r.url) || seen.has(r.url)) continue
    seen.add(r.url)
    out.push({ title: r.title.slice(0, 160), url: r.url, snippet: r.snippet.slice(0, 400) })
    if (out.length >= limit) break
  }
  return out
}

async function braveSearch(q, key, fetchImpl) {
  const url = `${BRAVE_URL}?${new URLSearchParams({ q, count: String(MAX_RESULTS), extra_snippets: "true" })}`
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS), headers: { Accept: "application/json", "X-Subscription-Token": key } })
  if (!res.ok) throw new Error(`brave ${res.status}`)
  return parseBraveResults(await res.json())
}

async function tavilySearch(q, key, fetchImpl) {
  const res = await fetchImpl(TAVILY_URL, {
    method: "POST",
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query: q, max_results: MAX_RESULTS, search_depth: "basic" }),
  })
  if (!res.ok) throw new Error(`tavily ${res.status}`)
  return parseTavilyResults(await res.json())
}

async function duckSearch(q, fetchImpl) {
  const res = await fetchImpl(SEARCH_URL, {
    method: "POST",
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    headers: { "User-Agent": AGENT, "Content-Type": "application/x-www-form-urlencoded", Accept: "text/html" },
    body: new URLSearchParams({ q }).toString(),
  })
  if (!res.ok) throw new Error(`duckduckgo ${res.status}`)
  const html = await res.text()
  const results = parseDuckResults(html)
  // DuckDuckGo answers a request it takes for a bot with a challenge page (202, "anomaly"), not results. Say so,
  // so BIM does not report "no results" for a search that never ran. It is not got around.
  if (!results.length && (res.status === 202 || /anomaly(?:\.js|-modal)/i.test(html))) throw new Error("duckduckgo blocked by its bot check")
  return results
}

/** The providers that can run now, in order. */
export function searchProviders(keyOf = searchKey) {
  const brave = keyOf("BRAVE_SEARCH_KEY")
  const tavily = keyOf("TAVILY_KEY")
  return [
    ...(brave ? [{ name: "brave", run: (q, f) => braveSearch(q, brave, f) }] : []),
    ...(tavily ? [{ name: "tavily", run: (q, f) => tavilySearch(q, tavily, f) }] : []),
    { name: "duckduckgo", run: (q, f) => duckSearch(q, f) },
  ]
}

/**
 * Search the web for `query` and read the first `read` result pages.
 * Returns `{ query, results: [{ title, url, snippet }], pages: [{ url, text }] }`. Throws when the search itself fails.
 */
export async function webSearch(query, { read = 3, fetchImpl = fetch, keyOf = searchKey } = {}) {
  const q = String(query ?? "").replace(/\s+/g, " ").trim().slice(0, 200)
  if (!q) throw new Error("empty query")
  // The first provider that answers wins, even with no results; one that throws hands on, and every failure is named.
  const failed = []
  let results = null
  let provider = ""
  for (const p of searchProviders(keyOf)) {
    try {
      results = await p.run(q, fetchImpl)
      provider = p.name
      break
    } catch (error) {
      failed.push(error instanceof Error ? error.message : String(error))
    }
  }
  if (!results) throw new Error(failed.join("; "))
  const want = results.slice(0, Math.max(0, Math.min(MAX_READ, Number(read) || 0)))
  const texts = await Promise.all(want.map((r) => readPage(r.url, fetchImpl)))
  const pages = want.map((r, i) => ({ url: r.url, text: texts[i] })).filter((p) => p.text)
  return { query: q, provider, results, pages, ...(failed.length ? { skipped: failed } : {}) }
}
