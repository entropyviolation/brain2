/**
 * lib/ingest/request-origin.mjs — Browser Origin gate for local HTTP APIs
 *
 * The dev server and phone hub bind on the LAN so a phone can open the app.
 * `Access-Control-Allow-Origin: *` let any website the browser was showing
 * read those responses (the vault, Notes, screen time) from loopback.
 *
 * A request with no Origin is a non-browser client (Shortcuts, curl, the
 * hub process) and stays allowed. A browser Origin is allowed when it is
 * the same host as the request, or a local app origin (loopback, a private
 * LAN address, `.local`, Capacitor). A public website origin is refused.
 * Allowed browser responses echo that origin. They do not echo `*`.
 */
import { Buffer } from "node:buffer"

function firstHeader(value) {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : ""
  return typeof value === "string" ? value : ""
}

function hostName(parsed) {
  return parsed.hostname.toLowerCase().replace(/\.$/, "")
}

function isPrivateIpv4(host) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!m) return false
  const n = m.slice(1).map((part) => Number(part))
  if (n.some((part) => !Number.isInteger(part) || part > 255)) return false
  if (n[0] === 10 || n[0] === 127) return true
  if (n[0] === 192 && n[1] === 168) return true
  if (n[0] === 172 && n[1] >= 16 && n[1] <= 31) return true
  if (n[0] === 169 && n[1] === 254) return true
  return false
}

function trustedLocalOrigin(parsed) {
  const host = hostName(parsed)
  if ((parsed.protocol === "capacitor:" || parsed.protocol === "ionic:") && host === "localhost") return true
  if (parsed.protocol === "app:" && host === "local") return true
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true
  if (host.endsWith(".localhost") || host.endsWith(".local")) return true
  return isPrivateIpv4(host)
}

/** Same scheme host and port as the request's Host header. */
function sameOrigin(parsed, hostHeader) {
  if (!hostHeader || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) return false
  const host = String(hostHeader).trim().toLowerCase()
  const name = hostName(parsed)
  const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80")
  const withPort = name.includes(":") ? `[${name}]:${port}` : `${name}:${port}`
  if (host === withPort) return true
  if ((port === "80" && parsed.protocol === "http:") || (port === "443" && parsed.protocol === "https:")) {
    return host === name || host === withPort
  }
  return false
}

/**
 * @param {string | null | undefined} origin
 * @param {string | null | undefined} host
 * @returns {{ ok: boolean, reflect: string | null }}
 */
export function decideBrowserOrigin(origin, host) {
  if (origin == null || origin === "") return { ok: true, reflect: null }
  const raw = String(origin).trim()
  if (!raw) return { ok: true, reflect: null }
  if (raw === "null") return { ok: false, reflect: null }
  let parsed
  try {
    parsed = new URL(raw)
  } catch {
    return { ok: false, reflect: null }
  }
  if (sameOrigin(parsed, host) || trustedLocalOrigin(parsed)) return { ok: true, reflect: raw }
  return { ok: false, reflect: null }
}

/**
 * Refuse a public website Origin. When the Origin is allowed, later
 * `writeHead` calls echo it and drop a blanket `*`.
 * @returns {boolean} false when the response is already finished
 */
export function guardBrowserOrigin(req, res) {
  const headers = (req && req.headers) || {}
  const decision = decideBrowserOrigin(firstHeader(headers.origin), firstHeader(headers.host))
  if (!decision.ok) {
    const body = "forbidden origin"
    res.writeHead(403, {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Length": Buffer.byteLength(body),
    })
    res.end(body)
    return false
  }
  if (res.__brain2OriginGuarded) return true
  res.__brain2OriginGuarded = true
  const prev = res.writeHead
  res.writeHead = function patchedWriteHead(status, maybeHeaders, ...rest) {
    if (maybeHeaders && typeof maybeHeaders === "object" && !Array.isArray(maybeHeaders)) {
      if (decision.reflect) {
        maybeHeaders["Access-Control-Allow-Origin"] = decision.reflect
        maybeHeaders.Vary = "Origin"
      } else if (maybeHeaders["Access-Control-Allow-Origin"] === "*") {
        delete maybeHeaders["Access-Control-Allow-Origin"]
      }
    }
    return prev.call(this, status, maybeHeaders, ...rest)
  }
  return true
}
