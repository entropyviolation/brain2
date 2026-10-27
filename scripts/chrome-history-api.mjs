/**
 * scripts/chrome-history-api.mjs — Inbox for the Brain2 Chrome extension.
 *
 * The extension POSTs one local day. The open app GETs it and acks.
 * Loopback only. A chrome-extension origin is allowed here and nowhere else.
 * Files live in data/chrome-history-inbox/ and are not part of the vault backup
 * the app reads; IndexedDB is the kept copy.
 */
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { guardBrowserOrigin } from "../lib/ingest/request-origin.mjs"
import { isLoopbackRemoteAddress } from "./screentime-api.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const DEFAULT_INBOX = path.join(ROOT, "data", "chrome-history-inbox")
const MAX_BODY = 32_000_000
const MAX_VISITS = 100_000
const MAX_FILES = 8

function sendJson(res, status, body, origin) {
  const json = JSON.stringify(body)
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(json),
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  }
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin
    headers.Vary = "Origin"
  }
  res.writeHead(status, headers)
  res.end(json)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on("data", (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("too large"), { code: "too-large" }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
    req.on("error", reject)
  })
}

function header(req, name) {
  const value = req.headers?.[name]
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : ""
  return typeof value === "string" ? value : ""
}

export function safeHistoryId(day, profile) {
  const who = String(profile || "Chrome")
    .replace(/[^\w .'-]+/g, "")
    .trim()
    .slice(0, 40) || "Chrome"
  return `${day}__${who}.json`
}

export function acceptHistoryEnvelope(body) {
  if (!body || body.brain2 !== "chrome-history") return null
  if (typeof body.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.day)) return null
  if (!Array.isArray(body.visits) || body.visits.length > MAX_VISITS) return null
  const profile = String(body.profile || "Chrome").trim().slice(0, 80) || "Chrome"
  const visits = []
  for (const row of body.visits) {
    if (!row || typeof row.url !== "string" || typeof row.visitTime !== "number") continue
    if (!row.url || row.url.length > 8000 || !Number.isFinite(row.visitTime)) continue
    visits.push({
      url: row.url,
      title: typeof row.title === "string" ? row.title.slice(0, 500) : "",
      visitTime: row.visitTime,
      transition: typeof row.transition === "string" ? row.transition.slice(0, 40) : "link",
    })
  }
  if (!visits.length) return null
  return { brain2: "chrome-history", profile, day: body.day, visits }
}

function fileIdOk(id) {
  return typeof id === "string" && /^[\w .'-]+__[\w .'-]+\.json$/.test(id) && !id.includes("..")
}

async function listInbox(dir) {
  let names = []
  try {
    names = await fs.readdir(dir)
  } catch (err) {
    if (err && err.code === "ENOENT") return []
    throw err
  }
  const files = []
  for (const name of names.filter((item) => item.endsWith(".json")).sort()) {
    if (files.length >= MAX_FILES) break
    try {
      const parsed = JSON.parse(await fs.readFile(path.join(dir, name), "utf8"))
      const envelope = acceptHistoryEnvelope(parsed)
      if (!envelope) continue
      files.push({ id: name, ...envelope })
    } catch {
      continue
    }
  }
  return files
}

export async function handleChromeHistoryApi(req, res, pathname, deps = {}) {
  const route = String(pathname || "").replace(/\/$/, "") || "/"
  if (route !== "/api/chrome-history" && route !== "/api/chrome-history/ack") return false

  const origin = header(req, "origin")
  const extension = origin.startsWith("chrome-extension://")
  if (!extension && !guardBrowserOrigin(req, res)) return true
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {}, extension ? origin : "")
    return true
  }
  if (!isLoopbackRemoteAddress(req.socket?.remoteAddress)) {
    sendJson(res, 403, { ok: false, code: "forbidden", error: "Chrome history is only accepted on this computer." }, extension ? origin : "")
    return true
  }

  const dir = deps.inboxDir || DEFAULT_INBOX

  if (route === "/api/chrome-history" && req.method === "GET") {
    const files = await listInbox(dir)
    sendJson(res, 200, { ok: true, files }, extension ? origin : "")
    return true
  }

  if (route === "/api/chrome-history" && req.method === "POST") {
    let body = null
    try {
      body = JSON.parse((await readBody(req)) || "")
    } catch (err) {
      const tooLarge = err && err.code === "too-large"
      sendJson(res, tooLarge ? 413 : 400, { ok: false, error: tooLarge ? "That day is too large." : "Request body must be JSON." }, extension ? origin : "")
      return true
    }
    const envelope = acceptHistoryEnvelope(body)
    if (!envelope) {
      sendJson(res, 400, { ok: false, error: "Expected one day of Chrome visits." }, extension ? origin : "")
      return true
    }
    await fs.mkdir(dir, { recursive: true })
    const id = safeHistoryId(envelope.day, envelope.profile)
    await fs.writeFile(path.join(dir, id), JSON.stringify(envelope))
    sendJson(res, 200, { ok: true, id, visits: envelope.visits.length }, extension ? origin : "")
    return true
  }

  if (route === "/api/chrome-history/ack" && req.method === "POST") {
    let body = {}
    try {
      body = JSON.parse((await readBody(req)) || "{}")
    } catch {
      sendJson(res, 400, { ok: false, error: "Request body must be JSON." }, extension ? origin : "")
      return true
    }
    const ids = Array.isArray(body.ids) ? body.ids.filter(fileIdOk) : []
    await Promise.all(ids.map((id) => fs.rm(path.join(dir, id), { force: true })))
    sendJson(res, 200, { ok: true, removed: ids.length }, extension ? origin : "")
    return true
  }

  sendJson(res, 404, { ok: false, error: "unknown chrome history route" }, extension ? origin : "")
  return true
}
