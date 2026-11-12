/**
 * lib/ingest/lan-gate.mjs — Who may reach the vault over the network
 *
 * Two rules, shared by the dev server, the prod server and the phone hub:
 *
 * 1. Listen address (`listenHost`). `BRAIN2_BIND` wins when set. Otherwise
 *    the server listens on the LAN (`0.0.0.0`) only when a hub token exists,
 *    and on this Mac only (`127.0.0.1`) when it does not.
 * 2. Vault routes (`vaultRequestAllowed`). A caller on this Mac passes. A
 *    caller from any other address needs `Authorization: Bearer <token>`.
 *    With no token set, a remote caller is refused. It used to be let in.
 *
 * The token is `BRAIN2_PHONE_HUB_TOKEN`, from the environment or from the
 * gitignored `.env.local` / `.env` at the repo root.
 */
import fs from "node:fs"
import path from "node:path"
import { timingSafeEqual } from "node:crypto"
import { fileURLToPath } from "node:url"
import { brain2Env, brain2EnvLine } from "../brain2-env.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")

/** True for 127.0.0.0/8, ::1 and their IPv4-mapped forms. */
export function isLoopbackAddress(address) {
  if (typeof address !== "string" || !address) return false
  const a = address.toLowerCase().replace(/^::ffff:/, "")
  return a === "::1" || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(a)
}

/** The hub token, or "" when none is configured. */
export function readHubToken(env = process.env, root = ROOT) {
  const fromEnv = brain2Env("PHONE_HUB_TOKEN", env)
  if (fromEnv && fromEnv.trim()) return fromEnv.trim()
  for (const name of [".env.local", ".env"]) {
    try {
      const line = brain2EnvLine(fs.readFileSync(path.join(root, name), "utf8"), "PHONE_HUB_TOKEN")
      if (line) return line.trim()
    } catch {
      /* no file */
    }
  }
  return ""
}

/** `BRAIN2_BIND`, else the LAN only when a token exists. */
export function listenHost(token = readHubToken(), env = process.env) {
  const bind = brain2Env("BIND", env)
  if (bind && bind.trim()) return bind.trim()
  return token ? "0.0.0.0" : "127.0.0.1"
}

function bearerOf(req) {
  const header = Array.isArray(req.headers?.authorization) ? req.headers.authorization[0] : req.headers?.authorization
  const match = /^Bearer\s+(.+)$/i.exec(typeof header === "string" ? header : "")
  return match ? match[1].trim() : ""
}

/** A caller on this Mac, or a remote caller with the token. */
export function vaultRequestAllowed(req, token = readHubToken()) {
  if (isLoopbackAddress(req.socket?.remoteAddress)) return true
  if (!token) return false
  const given = Buffer.from(bearerOf(req))
  const want = Buffer.from(token)
  return given.length === want.length && timingSafeEqual(given, want)
}

/** Answer 401 and return false when the caller may not use a vault route. */
export function guardVaultRequest(req, res, token) {
  if (vaultRequestAllowed(req, token)) return true
  res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" })
  res.end(JSON.stringify({ ok: false, error: "hub token required" }))
  return false
}
