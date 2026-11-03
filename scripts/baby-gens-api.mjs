/**
 * scripts/baby-gens-api.mjs — The Baby animal game's ComfyUI generation log, on the local app.
 *
 * `GET /api/baby-gens` lists every PNG in the ComfyUI output folder (and its first level of subfolders), newest
 * first, each with the recipe its metadata carries, plus the saved notes. `GET /api/baby-gens/img/<path>` is one
 * image. `POST /api/baby-gens/note` with `{ file, patch }` changes one output's like, kind, tags or note.
 *
 * The folder is `BABY_GENS_DIR`, else `~/ComfyUI-Shared/output`. Notes live in `data/baby-game-gens.json` (gitignored)
 * so Claude and, later, the game's own generation BIMBY can read which recipes won. Paths cannot leave the folder.
 * A public website Origin is refused. Not a Next.js route (`output: "export"` has none). Both `cogs-dev-server.mjs`
 * and `cogs-prod-server.mjs` call it.
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { guardBrowserOrigin } from "../lib/ingest/request-origin.mjs"
import { applyOverrides, rawPromptOf, readGen, withGenNote } from "../lib/baby-game/comfy-png.mjs"
import { graph as defaultGraph } from "./baby-gens-queue.mjs"
import { readBody, sendJson } from "./local-api-json.mjs"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const NOTES_PATH = path.join(ROOT, "data", "baby-game-gens.json")
const PREFIX = "/api/baby-gens"

export const gensDir = () => process.env.BABY_GENS_DIR || path.join(os.homedir(), "ComfyUI-Shared", "output")

/** Parsed metadata by path, dropped when the file's mtime changes. */
const cache = new Map()

/** The chunks before the image data only: text chunks come first, so a 2 MB PNG costs a few KB of reading. */
function readHead(abs) {
  const fd = fs.openSync(abs, "r")
  try {
    const parts = [Buffer.alloc(8)]
    fs.readSync(fd, parts[0], 0, 8, 0)
    let pos = 8
    const head = Buffer.alloc(8)
    for (let guard = 0; guard < 64; guard++) {
      if (fs.readSync(fd, head, 0, 8, pos) < 8) break
      const len = head.readUInt32BE(0)
      const type = head.toString("latin1", 4, 8)
      if (type === "IDAT" || type === "IEND" || len > 32 * 1024 * 1024) {
        parts.push(Buffer.from(head))
        break
      }
      const chunk = Buffer.alloc(12 + len)
      fs.readSync(fd, chunk, 0, 12 + len, pos)
      parts.push(chunk)
      pos += 12 + len
    }
    return new Uint8Array(Buffer.concat(parts))
  } finally {
    fs.closeSync(fd)
  }
}

function listPngs(dir) {
  const out = []
  const walk = (rel, depth) => {
    let entries = []
    try {
      entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue
      const r = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory() && depth < 1) walk(r, depth + 1)
      else if (e.isFile() && /\.png$/i.test(e.name)) out.push(r)
    }
  }
  walk("", 0)
  return out
}

export function listGens(dir = gensDir()) {
  if (!fs.existsSync(dir)) return { missing: true, gens: [] }
  const gens = []
  for (const file of listPngs(dir)) {
    const abs = path.join(dir, file)
    let st
    try {
      st = fs.statSync(abs)
    } catch {
      continue
    }
    const hit = cache.get(abs)
    let meta = hit && hit.mtime === st.mtimeMs ? hit.meta : null
    if (!meta) {
      try {
        meta = readGen(readHead(abs))
      } catch {
        meta = { recipe: null, workflowNotes: [] }
      }
      cache.set(abs, { mtime: st.mtimeMs, meta })
    }
    gens.push({ file, at: st.mtimeMs, bytes: st.size, ...meta })
  }
  gens.sort((a, b) => b.at - a.at || b.file.localeCompare(a.file))
  return { missing: false, gens }
}

/** A path inside `dir`, or null. */
export function safeGenPath(dir, rel) {
  if (!rel || rel.includes("\0") || !/\.png$/i.test(rel)) return null
  const abs = path.resolve(dir, rel)
  const base = path.resolve(dir) + path.sep
  return abs.startsWith(base) ? abs : null
}

export function loadGenNotes(file = NOTES_PATH) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"))
    return parsed && typeof parsed === "object" && parsed.notes && typeof parsed.notes === "object" ? parsed.notes : {}
  } catch {
    return {}
  }
}

function saveGenNotes(notes, file = NOTES_PATH) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, dir: gensDir(), notes }, null, 2))
  fs.renameSync(tmp, file)
}

const comfyUrl = () => process.env.COMFY_URL || "http://127.0.0.1:8188"

/** Queue `count` jobs, one seed apart, and return their prompt ids. Throws a plain message for the page. */
export async function queueGens(body, dir, fetchFn = fetch) {
  const o = body && typeof body === "object" ? body : {}
  let base = null
  if (o.file) {
    const abs = safeGenPath(dir, String(o.file))
    if (!abs || !fs.existsSync(abs)) throw new Error("source image not found")
    base = rawPromptOf(new Uint8Array(readHead(abs)))
    if (!base) throw new Error("that image carries no graph to start from")
  }
  const count = Math.min(8, Math.max(1, Math.floor(Number(o.count) || 1)))
  const first = Number.isFinite(Number(o.seed)) && o.seed !== null && o.seed !== "" ? Number(o.seed) : Math.floor(Math.random() * 2 ** 31)
  const ids = []
  for (let i = 0; i < count; i++) {
    const seed = first + i
    const g = base ? applyOverrides(base, { ...o, seed }) : applyOverrides(defaultGraph(String(o.positive ?? ""), String(o.negative ?? ""), seed, "try"), { ...o, seed })
    let res
    try {
      res = await fetchFn(`${comfyUrl()}/prompt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: g }) })
    } catch {
      throw new Error(`ComfyUI is not answering at ${comfyUrl()}`)
    }
    if (!res.ok) throw new Error(`ComfyUI ${res.status}: ${(await res.text()).slice(0, 300)}`)
    ids.push({ id: (await res.json()).prompt_id, seed })
  }
  return ids
}

export async function handleBabyGensApi(req, res, pathname, deps = {}) {
  const route = String(pathname || "").replace(/\/+$/, "") || "/"
  if (route !== PREFIX && !route.startsWith(`${PREFIX}/`)) return false
  if (!guardBrowserOrigin(req, res)) return true
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {})
    return true
  }
  const dir = deps.dir || gensDir()
  const notesPath = deps.notesPath || NOTES_PATH

  if (route === PREFIX && req.method === "GET") {
    const listed = listGens(dir)
    sendJson(res, 200, { ok: true, dir, missing: listed.missing, gens: listed.gens, notes: loadGenNotes(notesPath) })
    return true
  }

  if (route === `${PREFIX}/note` && req.method === "POST") {
    let body
    try {
      body = JSON.parse((await readBody(req)) || "{}")
    } catch {
      sendJson(res, 400, { ok: false, error: "bad json" })
      return true
    }
    const file = typeof body.file === "string" ? body.file : ""
    if (!safeGenPath(dir, file) || !body.patch || typeof body.patch !== "object") {
      sendJson(res, 400, { ok: false, error: "bad note" })
      return true
    }
    const notes = withGenNote(loadGenNotes(notesPath), file, body.patch)
    saveGenNotes(notes, notesPath)
    sendJson(res, 200, { ok: true, note: notes[file] })
    return true
  }

  if (route === `${PREFIX}/queue` && req.method === "GET") {
    try {
      const q = await (await fetch(`${comfyUrl()}/queue`)).json()
      sendJson(res, 200, { ok: true, running: (q.queue_running || []).length, pending: (q.queue_pending || []).length })
    } catch {
      sendJson(res, 200, { ok: false, error: `ComfyUI is not answering at ${comfyUrl()}` })
    }
    return true
  }

  if (route === `${PREFIX}/queue` && req.method === "POST") {
    let body
    try {
      body = JSON.parse((await readBody(req)) || "{}")
    } catch {
      sendJson(res, 400, { ok: false, error: "bad json" })
      return true
    }
    try {
      sendJson(res, 200, { ok: true, queued: await queueGens(body, dir) })
    } catch (e) {
      sendJson(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) })
    }
    return true
  }

  if (route.startsWith(`${PREFIX}/raw/`) && req.method === "GET") {
    let rel = ""
    try {
      rel = decodeURIComponent(route.slice(`${PREFIX}/raw/`.length))
    } catch {
      rel = ""
    }
    const abs = safeGenPath(dir, rel)
    if (!abs || !fs.existsSync(abs)) {
      sendJson(res, 404, { ok: false, error: "not found" })
      return true
    }
    sendJson(res, 200, { ok: true, prompt: rawPromptOf(new Uint8Array(readHead(abs))) })
    return true
  }

  if (route.startsWith(`${PREFIX}/img/`) && req.method === "GET") {
    let rel = ""
    try {
      rel = decodeURIComponent(route.slice(`${PREFIX}/img/`.length))
    } catch {
      rel = ""
    }
    const abs = safeGenPath(dir, rel)
    if (!abs || !fs.existsSync(abs)) {
      sendJson(res, 404, { ok: false, error: "not found" })
      return true
    }
    const body = fs.readFileSync(abs)
    res.writeHead(200, {
      "Content-Type": "image/png",
      "Content-Length": body.length,
      "Cache-Control": "max-age=60",
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*",
    })
    res.end(body)
    return true
  }

  sendJson(res, 405, { ok: false, error: "method" })
  return true
}
