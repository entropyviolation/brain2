/**
 * scripts/link-peek-api.mjs — what a saved link says about itself, for the Link BIMBY.
 *
 *   GET /api/link-peek?url=<https url>  →  { ok, url, title, description, author, site, image, via }
 *   GET /api/link-peek?url=…&watch=1    →  the same, plus `watch: { watched, transcript, onScreen, … }`
 *       &batch=1                          from Guess all: never uses the Instagram sign-in (`reel-watch.mjs` guard)
 *                                          (`scripts/reel-watch.mjs`: video → whisper + on-screen text)
 *
 * The browser cannot read an Instagram or TikTok page (CORS), so this Mac reads it.
 * It asks the public oEmbed door first (TikTok, YouTube), then the page's own
 * `og:` / `twitter:` / `<title>` tags. Instagram serves a reel's caption in
 * `og:description` to the link-preview crawler user agent, so that is the one sent.
 * No sign-in, no cookies, no video download.
 *
 * Loopback only. Public `http(s)` hosts only: a name that resolves to a private,
 * loopback, or link-local address is refused, so the route cannot reach the LAN.
 * Answers are kept in memory for the life of the server.
 * Not a Next.js route (`output: "export"` has none). Both dev and prod servers call it.
 */
import dns from "node:dns/promises"
import net from "node:net"
import { guardBrowserOrigin } from "../lib/ingest/request-origin.mjs"
import { isLoopbackRemoteAddress } from "./screentime-api.mjs"
import { isInstagram, readStill, watchReel } from "./reel-watch.mjs"

const PATH = "/api/link-peek"
const CRAWLER_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"
const MAX_HTML = 1_500_000
const TIMEOUT_MS = 9000
const cache = new Map()

function sendJson(res, status, body) {
  const json = JSON.stringify(body)
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(json),
    "Cache-Control": "no-store",
  })
  res.end(json)
}

/** True for 10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, 0/8, 100.64/10, ::1, fc00::/7, fe80::/10. */
export function isPrivateAddress(ip) {
  const v = net.isIP(ip)
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number)
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  }
  if (v === 6) {
    const s = ip.toLowerCase()
    if (s === "::1" || s === "::") return true
    if (s.startsWith("::ffff:")) return isPrivateAddress(s.slice(7))
    return /^f[cd]/.test(s) || /^fe[89ab]/.test(s)
  }
  return true
}

async function publicUrl(raw) {
  let u
  try {
    u = new URL(String(raw || ""))
  } catch {
    return null
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null
  if (u.username || u.password) return null
  const host = u.hostname.replace(/^\[|\]$/g, "")
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return null
  const addrs = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true }).catch(() => [])).map((a) => a.address)
  if (!addrs.length || addrs.some(isPrivateAddress)) return null
  return u
}

const decode = (s) =>
  String(s || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim()

/** The page's own description tags. Exported for the test. */
export function readMeta(html) {
  const meta = {}
  for (const m of String(html).matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0]
    const key = /\b(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase()
    const content = /\bcontent\s*=\s*"([^"]*)"|\bcontent\s*=\s*'([^']*)'/i.exec(tag)
    if (key && content && !(key in meta)) meta[key] = decode(content[1] ?? content[2])
  }
  const title = decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "")
  return {
    title: meta["og:title"] || meta["twitter:title"] || title,
    description: meta["og:description"] || meta["twitter:description"] || meta.description || "",
    site: meta["og:site_name"] || "",
    image: meta["og:image"] || meta["twitter:image"] || "",
    keywords: meta.keywords || "",
  }
}

function oembedFor(u) {
  const h = u.hostname.replace(/^www\./, "")
  const q = encodeURIComponent(u.toString())
  if (h === "tiktok.com" || h.endsWith(".tiktok.com")) return `https://www.tiktok.com/oembed?url=${q}`
  if (h === "youtube.com" || h.endsWith(".youtube.com") || h === "youtu.be") return `https://www.youtube.com/oembed?format=json&url=${q}`
  return null
}

async function timedFetch(url, init = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, redirect: "follow" })
  } finally {
    clearTimeout(t)
  }
}

// Signed-out page reads of instagram.com still come from this Mac's IP, which the person's
// own phone and browser share. Keep them at least 15 s apart, one at a time.
const IG_PAGE_GAP_MS = 15_000
let igChain = Promise.resolve()
let igLast = 0
function igPaced(fn) {
  const run = igChain.then(async () => {
    const wait = igLast + IG_PAGE_GAP_MS - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    try {
      return await fn()
    } finally {
      igLast = Date.now()
    }
  })
  igChain = run.catch(() => {})
  return run
}

async function peek(u) {
  const out = { ok: true, url: u.toString(), title: "", description: "", author: "", site: "", image: "", via: [] }
  const oe = oembedFor(u)
  if (oe) {
    try {
      const r = await timedFetch(oe, { headers: { Accept: "application/json" } })
      if (r.ok) {
        const j = await r.json()
        out.title = String(j.title || "")
        out.author = String(j.author_name || "")
        out.site = String(j.provider_name || "")
        out.image = String(j.thumbnail_url || "")
        out.via.push("oembed")
      }
    } catch {
      /* fall through to the page */
    }
  }
  try {
    const r = await timedFetch(u.toString(), {
      headers: { "User-Agent": CRAWLER_UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.8" },
    })
    // A redirect may land somewhere private; check where it ended.
    if (r.ok && (await publicUrl(r.url || u.toString()))) {
      const html = (await r.text()).slice(0, MAX_HTML)
      const m = readMeta(html)
      if (!out.title) out.title = m.title
      out.description = m.description
      if (!out.site) out.site = m.site
      if (!out.image) out.image = m.image
      if (m.keywords) out.keywords = m.keywords
      out.via.push("page")
    }
  } catch {
    /* nothing from the page */
  }
  if (!out.via.length) return { ok: false, url: out.url, error: "the link did not answer" }
  for (const k of ["title", "description", "author", "site", "keywords"]) if (out[k]) out[k] = String(out[k]).slice(0, 1200)
  return out
}

/** @returns {Promise<boolean>} true if handled */
export async function handleLinkPeekApi(req, res, pathname, deps = {}) {
  if (String(pathname || "").replace(/\/+$/, "") !== PATH) return false
  if (!guardBrowserOrigin(req, res)) return true
  const remote = deps.remoteAddress ?? req.socket?.remoteAddress
  if (!isLoopbackRemoteAddress(remote)) {
    sendJson(res, 403, { ok: false, error: "loopback only" })
    return true
  }
  if (req.method !== "GET") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" })
    return true
  }
  const params = new URL(req.url || "/", "http://local").searchParams
  const raw = params.get("url")
  const u = await publicUrl(raw)
  if (!u) {
    sendJson(res, 400, { ok: false, error: "a public http(s) link only" })
    return true
  }
  const key = u.toString()
  if (!cache.has(key)) cache.set(key, await (isInstagram(key) ? igPaced(() => peek(u)) : peek(u)))
  const hit = cache.get(key)
  if (!hit.ok) cache.delete(key)
  if (params.get("watch") === "1") {
    let watch = await watchReel(key, { batch: params.get("batch") === "1" }).catch((e) => ({ watched: false, error: String(e?.message || e) }))
    if (!watch.watched && /no video formats/i.test(watch.error || "") && hit.ok && hit.image && (await publicUrl(hit.image))) {
      watch = (await readStill(key, hit.image)) || watch
    }
    if (hit.ok || watch.watched) {
      sendJson(res, 200, { ...(hit.ok ? hit : { url: key, title: "", description: watch.description || "", author: watch.uploader || "", site: "", via: [] }), ok: true, watch })
      return true
    }
    sendJson(res, 502, { ...hit, watch })
    return true
  }
  sendJson(res, hit.ok ? 200 : 502, hit)
  return true
}
