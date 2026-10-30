/**
 * Serve the experimental UI lab with the app's real CSS.
 * Run: npm run ui-lab
 *
 * Root-absolute urls such as /fonts/... live in public/. file:// cannot load them.
 * Those files are served from public/. Everything else is served from the repo root
 * so /app/win95.css, /components/...css, and /docs/mockups/ui-lab/*.html resolve.
 */
import { spawn } from "node:child_process"
import { createReadStream, existsSync, statSync } from "node:fs"
import { createServer } from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(here, "..")
const publicRoot = path.join(repoRoot, "public")
const host = "127.0.0.1"
const port = 4173
const indexUrl = `http://${host}:${port}/docs/mockups/ui-lab/index.html`

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".otf": "font/otf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
}

/**
 * @param {string} root
 * @param {string} urlPath
 */
function resolveInside(root, urlPath) {
  let decoded
  try {
    decoded = decodeURIComponent(urlPath)
  } catch {
    return null
  }
  if (decoded.includes("\0")) return null
  const rel = decoded.replace(/^\/+/, "")
  const full = path.resolve(root, rel)
  const base = path.resolve(root)
  if (full !== base && !full.startsWith(base + path.sep)) return null
  return full
}

/**
 * @param {string} file
 */
function contentType(file) {
  return MIME[path.extname(file).toLowerCase()] || "application/octet-stream"
}

/**
 * @param {string} file
 */
function isFile(file) {
  if (!file || !existsSync(file)) return false
  try {
    return statSync(file).isFile()
  } catch {
    return false
  }
}

/**
 * Public assets win when the file exists there (/fonts, /pcb, /newvelv.jpg, …).
 * Otherwise the same path is a repo file (/app, /components, /docs).
 * @param {string} urlPath
 */
function locate(urlPath) {
  const fromPublic = resolveInside(publicRoot, urlPath)
  if (isFile(fromPublic)) return fromPublic
  const fromRepo = resolveInside(repoRoot, urlPath)
  if (isFile(fromRepo)) return fromRepo
  return null
}

function openBrowser(url) {
  const child = spawn("open", [url], { stdio: "ignore", detached: true })
  child.on("error", () => {
    console.error(`Open this in a browser: ${url}`)
  })
  child.unref()
}

const server = createServer((req, res) => {
  const urlPath = (req.url || "/").split("?")[0]
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "content-type": "text/plain; charset=utf-8" })
    res.end("method")
    return
  }
  if (urlPath === "/") {
    res.writeHead(302, { location: "/docs/mockups/ui-lab/index.html" })
    res.end()
    return
  }
  const file = locate(urlPath)
  if (!file) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" })
    res.end("Not found")
    return
  }
  res.writeHead(200, {
    "content-type": contentType(file),
    "cache-control": "no-store",
  })
  if (req.method === "HEAD") {
    res.end()
    return
  }
  createReadStream(file).pipe(res)
})

server.on("error", (error) => {
  if (error && error.code === "EADDRINUSE") {
    console.error(
      `Port ${port} is already in use on ${host}. Stop the other process, then run npm run ui-lab again.`,
    )
    process.exit(1)
  }
  console.error(error)
  process.exit(1)
})

server.listen(port, host, () => {
  console.log(indexUrl)
  openBrowser(indexUrl)
})
