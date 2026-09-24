/**
 * electron/activitywatch.js — Query a local ActivityWatch install (loopback only)
 *
 * Talks to a running aw-server at 127.0.0.1:5600. Never embeds or starts
 * ActivityWatch. Returns a structured result rather than throwing so the
 * renderer can show unreachable / forbidden messages.
 *
 * CommonJS (matches electron/main.js).
 */

const DEFAULT_BASE = "http://127.0.0.1:5600"
const TIMEOUT_MS = 5000
const FORBIDDEN = {
  ok: false,
  code: "forbidden",
  error: "ActivityWatch is only queried on this machine.",
}

function loopbackHost(hostname) {
  const h = String(hostname || "")
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
  return h === "127.0.0.1" || h === "localhost" || h === "::1"
}

/** True when `url` is http(s) to 127.0.0.1, localhost, or ::1. */
function isLoopbackUrl(url) {
  try {
    const u = new URL(String(url || ""))
    if (u.protocol !== "http:" && u.protocol !== "https:") return false
    return loopbackHost(u.hostname)
  } catch {
    return false
  }
}

const isAllowedActivityWatchUrl = isLoopbackUrl

function resolveBase(url) {
  const raw = typeof url === "string" && url.trim() ? url.trim() : DEFAULT_BASE
  let u
  try {
    u = new URL(raw)
  } catch {
    return { ok: false, ...FORBIDDEN }
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, ...FORBIDDEN }
  }
  if (!loopbackHost(u.hostname)) {
    return { ok: false, ...FORBIDDEN }
  }
  if (!u.port) u.port = "5600"
  const host = u.hostname.includes(":") && !u.hostname.startsWith("[") ? `[${u.hostname}]` : u.hostname
  return { ok: true, base: `${u.protocol}//${host}:${u.port}` }
}

function classifyFetchError(err) {
  const code = err && err.cause && err.cause.code
  const msg = `${(err && err.message) || ""} ${code || ""}`.toLowerCase()
  if (
    code === "ECONNREFUSED" ||
    msg.includes("econnrefused") ||
    msg.includes("fetch failed") ||
    (err && err.name === "AbortError")
  ) {
    return {
      ok: false,
      code: "unreachable",
      error: "ActivityWatch is not reachable on this machine. Start ActivityWatch and retry.",
    }
  }
  return {
    ok: false,
    code: "unreachable",
    error: ((err && err.message) || "ActivityWatch request failed.").slice(0, 400),
  }
}

function mapEvents(list) {
  if (!Array.isArray(list)) return []
  return list.map((ev) => ({
    timestamp: ev && ev.timestamp,
    duration: ev && ev.duration,
    data: ev && ev.data,
  }))
}

async function getJson(url, hops = 0) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "manual" })
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location")
      if (!loc || hops >= 2) {
        return { ok: false, code: "unreachable", error: "ActivityWatch redirected without a location." }
      }
      const next = new URL(loc, url).href
      if (!isLoopbackUrl(next)) return { ...FORBIDDEN }
      return getJson(next, hops + 1)
    }
    if (!res.ok) {
      return {
        ok: false,
        code: "unreachable",
        error: `ActivityWatch responded ${res.status}.`,
      }
    }
    return { ok: true, json: await res.json() }
  } catch (err) {
    return classifyFetchError(err)
  } finally {
    clearTimeout(timer)
  }
}

function bucketId(bucket, key) {
  if (!bucket) return ""
  if (typeof key === "string") return key
  return String(bucket.id || "")
}

function pickBuckets(buckets, includeWeb) {
  const entries = buckets && typeof buckets === "object" ? Object.entries(buckets) : []
  const windowIds = []
  const afkIds = []
  const webIds = []
  for (const [key, bucket] of entries) {
    const id = bucketId(bucket, key)
    if (id.startsWith("aw-watcher-window")) windowIds.push(id)
    else if (id.startsWith("aw-watcher-afk")) afkIds.push(id)
    else if (includeWeb && id.includes("aw-watcher-web")) webIds.push(id)
  }
  return { windowIds, afkIds, webIds }
}

async function fetchBucketEvents(base, ids, startISO, endISO) {
  const q = new URLSearchParams()
  if (startISO) q.set("start", startISO)
  if (endISO) q.set("end", endISO)
  const qs = q.toString() ? `?${q}` : ""
  const out = []
  for (const id of ids) {
    const got = await getJson(`${base}/api/0/buckets/${encodeURIComponent(id)}/events${qs}`)
    if (!got.ok) return got
    out.push(...mapEvents(got.json))
  }
  return { ok: true, events: out }
}

/**
 * @param {{ url?: string, startISO?: string, endISO?: string, mode?: "health" | "events", includeWeb?: boolean }} range
 */
function fetchScreenTime(range) {
  const req = range && typeof range === "object" ? range : {}
  const resolved = resolveBase(req.url)
  if (!resolved.ok) return Promise.resolve(resolved)

  const hasRange = typeof req.startISO === "string" && typeof req.endISO === "string"
  const mode = req.mode === "health" || req.mode === "events" ? req.mode : hasRange ? "events" : "health"

  return (async () => {
    if (mode === "health") {
      const got = await getJson(`${resolved.base}/api/0/info`)
      if (!got.ok) return got
      const info = got.json && typeof got.json === "object" ? got.json : {}
      return {
        ok: true,
        mode: "health",
        reachable: true,
        hostname: info.hostname,
        version: info.version,
      }
    }

    const bucketsRes = await getJson(`${resolved.base}/api/0/buckets`)
    if (!bucketsRes.ok) return bucketsRes
    const { windowIds, afkIds, webIds } = pickBuckets(bucketsRes.json, Boolean(req.includeWeb))

    const windowGot = await fetchBucketEvents(resolved.base, windowIds, req.startISO, req.endISO)
    if (!windowGot.ok) return windowGot
    const afkGot = await fetchBucketEvents(resolved.base, afkIds, req.startISO, req.endISO)
    if (!afkGot.ok) return afkGot
    const webGot = await fetchBucketEvents(resolved.base, webIds, req.startISO, req.endISO)
    if (!webGot.ok) return webGot

    return {
      ok: true,
      mode: "events",
      windowEvents: windowGot.events,
      afkEvents: afkGot.events,
      webEvents: webGot.events,
    }
  })()
}

module.exports = { fetchScreenTime, isLoopbackUrl, isAllowedActivityWatchUrl }
