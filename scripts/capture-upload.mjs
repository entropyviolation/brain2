/**
 * scripts/capture-upload.mjs — Sealed uploads from the phone app, on the Oracle capture box
 *
 * The iPhone app seals each batch (location today, Health later) to the same
 * public key as the Telegram queue and posts it here. This box cannot open
 * it. The hub pulls and acks like the Telegram queue, from its own file, so
 * the two never share sequence numbers.
 *
 * Plain Node, no npm install. `capture-box.mjs` mounts it:
 *
 *   import { createUploadRoutes } from "./capture-upload.mjs"
 *   const uploads = createUploadRoutes({ dir: DIR, uploadToken: env("BRAIN2_CAPTURE_UPLOAD_TOKEN"), pullToken: TOKEN })
 *   if (await uploads.handle(req, res, url)) return   // first line inside the request handler's try
 *
 * Routes:
 *   POST /upload {kind, sealed}        upload token (the phone). 401 / 400 / 413 / 507.
 *   GET  /uploads?after=N&limit=M      pull token (the hub).
 *   POST /uploads/ack {upto}           pull token. Drops rows up to and including `upto`.
 *
 * The phone holds only the upload token: it can add rows, not read or drop them.
 * The only clear-text fields are the kind and the arrival time.
 */
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

export const UPLOAD_KINDS = new Set(["location", "health"])
const MAX_BODY_BYTES = 512 * 1024
const SEALED_RE = /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

function tokenMatches(req, token) {
  if (!token) return false
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || "")
  if (!m) return false
  const a = Buffer.from(m[1].trim())
  const b = Buffer.from(token)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function send(res, status, body) {
  const json = JSON.stringify(body)
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(json) })
  res.end(json)
}

/** Answer and tell the caller the route was ours. */
function reply(res, status, body) {
  send(res, status, body)
  return true
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on("data", (c) => {
      size += c.length
      if (size > limit) {
        const err = new Error("too large")
        err.code = "TOO_LARGE"
        reject(err)
        req.destroy()
      } else chunks.push(c)
    })
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
    req.on("error", reject)
  })
}

/**
 * @param {{ dir: string, uploadToken: string, pullToken: string, maxBytes?: number, now?: () => Date }} opts
 */
export function createUploadRoutes(opts) {
  const file = path.join(opts.dir, "uploads.jsonl")
  const stateFile = path.join(opts.dir, "uploads-state.json")
  const maxBytes = opts.maxBytes ?? 50 * 1024 * 1024
  const now = opts.now ?? (() => new Date())
  fs.mkdirSync(opts.dir, { recursive: true, mode: 0o700 })

  let nextSeq = 1
  try {
    nextSeq = Number(JSON.parse(fs.readFileSync(stateFile, "utf8")).nextSeq) || 1
  } catch {
    /* first run */
  }

  const fileBytes = () => {
    try {
      return fs.statSync(file).size
    } catch {
      return 0
    }
  }
  const readRows = () => {
    let text = ""
    try {
      text = fs.readFileSync(file, "utf8")
    } catch {
      return []
    }
    const rows = []
    for (const line of text.split("\n")) {
      if (!line) continue
      try {
        rows.push(JSON.parse(line))
      } catch {
        /* torn last line after a crash */
      }
    }
    return rows
  }
  // Rows survive a restart even if the state file is older than the queue.
  for (const row of readRows()) nextSeq = Math.max(nextSeq, Number(row.seq) + 1)

  /** Append and fsync before the phone is told it can forget the batch. */
  const append = (row) => {
    const fd = fs.openSync(file, "a", 0o600)
    try {
      fs.writeSync(fd, JSON.stringify(row) + "\n")
      fs.fsyncSync(fd)
    } finally {
      fs.closeSync(fd)
    }
    fs.writeFileSync(stateFile, JSON.stringify({ nextSeq }), { mode: 0o600 })
  }

  async function handle(req, res, url) {
    if (url.pathname === "/upload" && req.method === "POST") {
      if (!tokenMatches(req, opts.uploadToken)) return reply(res, 401, { ok: false })
      if (fileBytes() >= maxBytes) return reply(res, 507, { ok: false, error: "upload queue full" })
      let body
      try {
        body = JSON.parse((await readBody(req, MAX_BODY_BYTES)) || "{}")
      } catch (err) {
        return reply(res, err && err.code === "TOO_LARGE" ? 413 : 400, { ok: false })
      }
      const kind = String(body.kind || "")
      const sealed = String(body.sealed || "")
      if (!UPLOAD_KINDS.has(kind) || !SEALED_RE.test(sealed)) return reply(res, 400, { ok: false })
      const row = { seq: nextSeq++, at: now().toISOString(), kind, sealed }
      append(row)
      return reply(res, 200, { ok: true, seq: row.seq })
    }
    if (url.pathname === "/uploads" && req.method === "GET") {
      if (!tokenMatches(req, opts.pullToken)) return reply(res, 401, { ok: false })
      const after = Number(url.searchParams.get("after")) || 0
      const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200)
      const kind = url.searchParams.get("kind")
      const items = readRows().filter((r) => r.seq > after && (!kind || r.kind === kind))
      return reply(res, 200, { ok: true, items: items.slice(0, limit) })
    }
    if (url.pathname === "/uploads/ack" && req.method === "POST") {
      if (!tokenMatches(req, opts.pullToken)) return reply(res, 401, { ok: false })
      let upto
      let kind = ""
      try {
        const ack = JSON.parse((await readBody(req, 4096)) || "{}")
        upto = Number(ack.upto)
        kind = typeof ack.kind === "string" ? ack.kind : ""
      } catch {
        return reply(res, 400, { ok: false })
      }
      if (!Number.isFinite(upto)) return reply(res, 400, { ok: false })
      // With a kind, only that kind's rows go: a location ack never drops a Health row.
      const keep = readRows().filter((r) => r.seq > upto || (kind !== "" && r.kind !== kind))
      const tmp = file + ".tmp"
      fs.writeFileSync(tmp, keep.map((r) => JSON.stringify(r) + "\n").join(""), { mode: 0o600 })
      fs.renameSync(tmp, file)
      return reply(res, 200, { ok: true, remaining: keep.length })
    }
    return false
  }

  return { handle, count: () => readRows().length }
}
