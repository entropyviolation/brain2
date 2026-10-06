/**
 * Serve the screenshot evolution reel and feature notes.
 * Run: npm run screenshot-reel
 *
 * Refreshes reel.js, fills missing feature-notes.json fields, then listens.
 * Markdown reads stay inside the repo. Notes writes stay in feature-notes.json.
 */
import { createServer } from "node:http"
import { existsSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  readFeatureNotes,
  resolveRepoAsset,
  safeRepoFile,
  saveFeatureNotes,
  writeReelIndex,
} from "./screenshot-archive.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(here, "..")
const outDir = path.join(repoRoot, "docs", "screenshots")

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".css": "text/css; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
}

/**
 * @param {{ repoRoot?: string, outDir?: string, port?: number }} [options]
 */
export function startReelServer(options = {}) {
  const root = options.repoRoot || repoRoot
  const shots = options.outDir || outDir
  const port = options.port || Number(process.env.SCREENSHOT_REEL_PORT) || 4173
  const written = writeReelIndex(shots)
  console.log(`Wrote ${written.path} (${written.shotCount} shots, ${written.frameCount} frames)`)
  const server = createReelServer(root, shots)
  server.listen(port, "127.0.0.1", () => {
    const shown = server.address().port
    console.log(`http://127.0.0.1:${shown}/viewer.html`)
  })
  return server
}

/**
 * @param {string} root
 * @param {string} shots
 */
export function createReelServer(root, shots) {
  return createServer((req, res) => {
    dispatch(req, res, { repoRoot: root, outDir: shots }).catch((error) => {
      const status = error instanceof SyntaxError || /rejected|bad /.test(error.message || "") ? 400 : 500
      sendText(res, status, error.message || "error")
    })
  })
}

async function dispatch(req, res, ctx) {
  const url = new URL(req.url || "/", "http://127.0.0.1")
  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(302, { location: "/viewer.html" })
    res.end()
    return
  }
  if (url.pathname === "/api/notes") {
    if (req.method === "GET") {
      sendJson(res, 200, readFeatureNotes(ctx.outDir))
      return
    }
    if (req.method === "POST") {
      const body = JSON.parse(await readBody(req))
      const notes = saveFeatureNotes(ctx.outDir, ctx.repoRoot, body)
      sendJson(res, 200, notes)
      return
    }
    sendText(res, 405, "method")
    return
  }
  if (req.method === "GET" && url.pathname === "/api/doc") {
    sendDoc(res, ctx.repoRoot, url.searchParams.get("path") || "")
    return
  }
  if (req.method === "GET" && url.pathname === "/api/asset") {
    sendAsset(res, ctx.repoRoot, url.searchParams.get("doc") || "", url.searchParams.get("src") || "")
    return
  }
  if (req.method === "GET") {
    sendScreenshot(res, ctx.outDir, decodeURIComponent(url.pathname))
    return
  }
  sendText(res, 405, "method")
}

function sendDoc(res, root, rel) {
  const safe = safeRepoFile(root, rel, { ext: ".md" })
  if (!safe) {
    sendText(res, 400, "doc path rejected")
    return
  }
  if (!existsSync(safe.abs) || !statSync(safe.abs).isFile()) {
    sendText(res, 404, "missing")
    return
  }
  sendText(res, 200, readFileSync(safe.abs), "text/markdown; charset=utf-8")
}

function sendAsset(res, root, docPath, src) {
  const safe = resolveRepoAsset(root, docPath, src)
  if (!safe) {
    sendText(res, 400, "asset path rejected")
    return
  }
  if (!existsSync(safe.abs) || !statSync(safe.abs).isFile()) {
    sendText(res, 404, "missing")
    return
  }
  const ext = path.extname(safe.abs).toLowerCase()
  sendBytes(res, 200, readFileSync(safe.abs), MIME[ext] || "application/octet-stream")
}

function sendScreenshot(res, shots, pathname) {
  const rel = pathname.replace(/^\/+/, "")
  if (!rel) {
    sendText(res, 404, "missing")
    return
  }
  const safe = safeRepoFile(shots, rel)
  if (!safe || !existsSync(safe.abs) || !statSync(safe.abs).isFile()) {
    sendText(res, 404, "missing")
    return
  }
  const ext = path.extname(safe.abs).toLowerCase()
  sendBytes(res, 200, readFileSync(safe.abs), MIME[ext] || "application/octet-stream")
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on("data", (chunk) => {
      size += chunk.length
      if (size > 2_000_000) {
        reject(new Error("bad notes"))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8") || "{}"))
    req.on("error", reject)
  })
}

function sendJson(res, status, value) {
  sendText(res, status, JSON.stringify(value), "application/json; charset=utf-8")
}

function sendText(res, status, body, type = "text/plain; charset=utf-8") {
  if (res.headersSent) return
  sendBytes(res, status, body, type)
}

function sendBytes(res, status, body, type) {
  if (res.headersSent) return
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" })
  res.end(body)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) startReelServer()
