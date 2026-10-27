#!/usr/bin/env node
/**
 * Production window server: the static `out/` export plus the same `/api`
 * handlers as `cogs-dev-server.mjs`, on one port (3000).
 *
 * `output: "export"` has no `next start`. This file is that host.
 * `electron:dev` does not call it. Keep the `/api` chain in step with
 * `cogs-dev-server.mjs`.
 */
import { createReadStream } from "node:fs"
import fs from "node:fs"
import { createServer } from "node:http"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parse } from "node:url"
import { handleSyncApi, syncDataPath } from "./sync-api.mjs"
import { handlePersistApi } from "./persist-api.mjs"
import { handleIngestApi, ingestDataPath } from "./ingest-api.mjs"
import { handleNotesApi } from "./notes-api.mjs"
import { handleScreenTimeApi } from "./screentime-api.mjs"
import { handleChromeHistoryApi } from "./chrome-history-api.mjs"
import { handleInstagramApi } from "./instagram-api.mjs"
import { handlePhoneSyncApi } from "./phone-sync-api.mjs"
import { handleCodeDocsApi } from "./code-docs-api.mjs"

const require = createRequire(import.meta.url)
const { createStaticFileResolver } = require("../electron/static-file.js")

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const OUT = path.join(ROOT, "out")
const hostname = "0.0.0.0"
const port = Number(process.env.PORT || 3000)

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".pdf": "application/pdf",
  ".wasm": "application/wasm",
}

if (!fs.existsSync(path.join(OUT, "index.html"))) {
  console.error("[cogs-prod] No production build in out/. Run npm run build first.")
  process.exit(1)
}

const resolveFile = createStaticFileResolver(fs, OUT)

const server = createServer(async (req, res) => {
  try {
    const parsedUrl = parse(req.url || "/", true)
    const pathname = parsedUrl.pathname || "/"
    if (pathname === "/api/health") {
      res.statusCode = 200
      res.setHeader("content-type", "text/plain")
      res.end("ok")
      return
    }
    if (await handlePersistApi(req, res, pathname)) return
    if (await handleSyncApi(req, res, pathname)) return
    if (await handleIngestApi(req, res, pathname)) return
    if (await handleNotesApi(req, res, pathname)) return
    if (await handleScreenTimeApi(req, res, pathname)) return
    if (await handleChromeHistoryApi(req, res, pathname)) return
    if (await handleInstagramApi(req, res, pathname)) return
    if (await handlePhoneSyncApi(req, res, pathname)) return
    if (await handleCodeDocsApi(req, res, pathname)) return
    if (pathname.startsWith("/api/")) {
      res.statusCode = 404
      res.setHeader("content-type", "text/plain")
      res.end("not found")
      return
    }
    const file = resolveFile(pathname)
    const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream"
    res.statusCode = 200
    res.setHeader("content-type", type)
    createReadStream(file).pipe(res)
  } catch (err) {
    console.error("[cogs-prod] request error", err)
    if (!res.headersSent) {
      res.statusCode = 500
      res.end("internal server error")
    }
  }
})

server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error("")
    console.error(`[cogs-prod] port ${port} is already in use.`)
    console.error(`[cogs-prod] electron:local will not take it. Leave the current server running.`)
    console.error(`[cogs-prod] Find it:  lsof -nP -iTCP:${port} -sTCP:LISTEN`)
    console.error("")
    process.exit(1)
  }
  throw err
})

let shuttingDown = false
function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 2000).unref()
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)

server.listen(port, hostname, () => {
  console.log("")
  console.log(`[cogs-prod] Ready — production out/ + the same /api handlers, on ONE port`)
  console.log(`[cogs-prod] local:   http://127.0.0.1:${port}`)
  console.log(`[cogs-prod] ingest:  http://127.0.0.1:${port}/api/ingest/*  (${ingestDataPath()})`)
  console.log(`[cogs-prod] notes:   http://127.0.0.1:${port}/api/notes  (loopback, Notes.app)`)
  console.log(`[cogs-prod] screentime: http://127.0.0.1:${port}/api/screentime  (loopback, ActivityWatch)`)
  console.log(`[cogs-prod] chrome-history: http://127.0.0.1:${port}/api/chrome-history  (loopback, extension)`)
  console.log(`[cogs-prod] phone-sync: http://127.0.0.1:${port}/api/phone-sync/status  (loopback, run log)`)
  console.log(`[cogs-prod] data:    ${syncDataPath()}`)
  console.log("")
})
