/**
 * electron/file-links.js — Linked resources: files and folders kept where they are
 *
 * Item Detail → Resources can link a file instead of copying its bytes into
 * IndexedDB (`docs/RESOURCE_LINKS.md`). This module is the main-process half:
 * stat a path, follow it after a move, open it, show it in its folder, pull
 * searchable text out of it, and stream it into the preview well through the
 * `brain2-link://` scheme.
 *
 * Following a move: the stored path wins when it still exists. Then a macOS
 * bookmark (Finder alias data, via `osascript` JXA). Then the same file ID
 * (`dev:ino`) found through Spotlight (`mdfind -name`) or a shallow walk of the
 * old folder's parent and grandparent. Then one same-name, same-size candidate.
 *
 * Every function resolves; none throws to the renderer.
 */
const fs = require("fs")
const path = require("path")
const { execFile } = require("child_process")
const { pathToFileURL } = require("url")

// Channel names. MUST match `FILE_LINK_CHANNELS` in electron/preload.js (the
// sandboxed preload cannot require this file, so the strings are duplicated).
const FILE_LINK_CHANNELS = {
  pick: "cogs:link:pick",
  stat: "cogs:link:stat",
  resolve: "cogs:link:resolve",
  open: "cogs:link:open",
  reveal: "cogs:link:reveal",
  extractText: "cogs:link:extractText",
  previewUrl: "cogs:link:previewUrl",
}

const LINK_SCHEME = "brain2-link"

/** Folder walk caps: a codebase with node_modules must not stall the shell. */
const WALK_MAX_ENTRIES = 20000
const WALK_SKIP = new Set([".git", "node_modules", ".next", "out", "dist", "build", ".cache", "__pycache__", ".DS_Store"])
/** Text pulled out of a linked file or folder for search. */
const TEXT_MAX_CHARS = 200000
const TEXT_HEAD_BYTES = 1024 * 1024
const PDF_MAX_BYTES = 300 * 1024 * 1024
/** Search for a moved file: shallow walk caps. */
const SEARCH_MAX_ENTRIES = 8000
const SEARCH_DEPTH = 3

const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|xml|html?|css|js|jsx|ts|tsx|py|rb|go|rs|java|swift|c|h|cpp|rtf|log|ya?ml|toml|ini|sh)$/i
/** `shell.openPath` on these runs code. A link is for documents. */
const EXECUTABLE_EXT = /\.(app|command|tool|terminal|sh|bash|zsh|csh|ksh|pl|py|rb|scpt|scptd|applescript|workflow|action|pkg|mpkg|dmg|exe|bat|cmd|com|msi|ps1|vbs|jar|desktop|appimage|run|bin)$/i

function isAbsolutePath(p) {
  return typeof p === "string" && p.length > 0 && path.isAbsolute(p)
}

function fileIdOf(st) {
  return st && Number.isFinite(st.ino) && st.ino > 0 ? `${st.dev}:${st.ino}` : undefined
}

/**
 * Walk a folder for a file count, byte total, and relative names. Skips VCS and
 * build folders; stops at `maxEntries` and says so with `truncated`.
 */
async function walkDir(root, { maxEntries = WALK_MAX_ENTRIES } = {}) {
  let fileCount = 0
  let bytes = 0
  let seen = 0
  let truncated = false
  const names = []
  const stack = [""]
  while (stack.length) {
    const rel = stack.pop()
    let entries
    try {
      entries = await fs.promises.readdir(path.join(root, rel), { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      if (WALK_SKIP.has(e.name)) continue
      if (++seen > maxEntries) {
        truncated = true
        break
      }
      const child = rel ? path.join(rel, e.name) : e.name
      if (e.isDirectory()) {
        stack.push(child)
        names.push(`${child}/`)
      } else if (e.isFile()) {
        fileCount++
        names.push(child)
        try {
          bytes += (await fs.promises.stat(path.join(root, child))).size
        } catch {
          /* vanished mid-walk */
        }
      }
    }
    if (truncated) break
  }
  names.sort()
  return { fileCount, bytes, names, truncated }
}

// ---- macOS bookmarks (Finder alias data) ---------------------------------

const BOOKMARK_JXA = `
ObjC.import('Foundation')
function run(argv) {
  if (argv[0] === 'create') {
    var url = $.NSURL.fileURLWithPath(argv[1])
    var data = url.bookmarkDataWithOptionsIncludingResourceValuesForKeysRelativeToURLError(0, $(), $(), $())
    if (!data || data.isNil()) return ''
    return data.base64EncodedStringWithOptions(0).js
  }
  if (argv[0] === 'resolve') {
    var bytes = $.NSData.alloc.initWithBase64EncodedStringOptions(argv[1], 0)
    if (!bytes || bytes.isNil()) return ''
    // 256 = WithoutUI, 512 = WithoutMounting
    var resolved = $.NSURL.URLByResolvingBookmarkDataOptionsRelativeToURLBookmarkDataIsStaleError(bytes, 768, $(), $(), $())
    if (!resolved || resolved.isNil()) return ''
    return resolved.path.js
  }
  return ''
}
`

function runOsascript(args, { timeout = 4000 } = {}) {
  return new Promise((resolve) => {
    execFile("osascript", ["-l", "JavaScript", "-e", BOOKMARK_JXA, ...args], { timeout }, (err, stdout) => {
      resolve(err ? "" : String(stdout || "").trim())
    })
  })
}

async function createBookmark(p, platform = process.platform) {
  if (platform !== "darwin") return undefined
  const b64 = await runOsascript(["create", p])
  return b64 || undefined
}

async function resolveBookmark(b64, platform = process.platform) {
  if (platform !== "darwin" || !b64) return ""
  return runOsascript(["resolve", b64])
}

// ---- stat ----------------------------------------------------------------

/** Describe a path for a new link. `null` when it does not exist. */
async function statLink(p, { platform = process.platform, bookmark = true } = {}) {
  if (!isAbsolutePath(p)) return null
  let st
  try {
    st = await fs.promises.stat(p)
  } catch {
    return null
  }
  const isDir = st.isDirectory()
  const out = {
    path: p,
    name: path.basename(p) || p,
    isDir,
    size: st.size,
    mtimeMs: st.mtimeMs,
    fileId: fileIdOf(st),
  }
  if (isDir) {
    const walk = await walkDir(p)
    out.size = walk.bytes
    out.fileCount = walk.fileCount
    if (walk.truncated) out.truncated = true
  }
  if (bookmark) {
    const b = await createBookmark(p, platform)
    if (b) out.bookmark = b
  }
  return out
}

// ---- resolve after a move ------------------------------------------------

function spotlightByName(name, { timeout = 4000 } = {}) {
  return new Promise((resolve) => {
    execFile("mdfind", ["-name", name], { timeout, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      if (err) return resolve([])
      resolve(
        String(stdout || "")
          .split("\n")
          .map((s) => s.trim())
          .filter((s) => s && path.basename(s) === name)
          .slice(0, 200),
      )
    })
  })
}

/** Shallow breadth-first walk for entries named `name` under `roots`. */
async function walkForName(roots, name, { maxEntries = SEARCH_MAX_ENTRIES, depth = SEARCH_DEPTH } = {}) {
  const hits = new Set()
  let seen = 0
  const queue = roots.filter(Boolean).map((r) => ({ dir: r, d: 0 }))
  const visited = new Set()
  while (queue.length && seen < maxEntries) {
    const { dir, d } = queue.shift()
    if (visited.has(dir)) continue
    visited.add(dir)
    let entries
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      if (++seen > maxEntries) break
      const full = path.join(dir, e.name)
      if (e.name === name) hits.add(full)
      if (e.isDirectory() && d < depth && !WALK_SKIP.has(e.name)) queue.push({ dir: full, d: d + 1 })
    }
  }
  return [...hits]
}

/**
 * Find a linked file again. Returns `{ status: "ok" | "moved" | "missing", link?, how? }`.
 * `link` is a fresh stat (with the old bookmark kept) when found.
 */
async function resolveLink(link, { platform = process.platform, spotlight = spotlightByName } = {}) {
  if (!link || !isAbsolutePath(link.path)) return { status: "missing" }
  const keep = (found, status, how) => ({
    status,
    how,
    link: { ...found, bookmark: found.bookmark || link.bookmark },
  })

  const here = await statLink(link.path, { platform, bookmark: false })
  if (here && here.isDir === !!link.isDir) return keep(here, "ok", "path")

  if (link.bookmark) {
    const p = await resolveBookmark(link.bookmark, platform)
    if (p && p !== link.path) {
      const found = await statLink(p, { platform, bookmark: false })
      if (found) return keep(found, "moved", "bookmark")
    }
  }

  const name = path.basename(link.path)
  const candidates = new Set()
  if (platform === "darwin") for (const c of await spotlight(name)) candidates.add(c)
  const parent = path.dirname(link.path)
  const grand = path.dirname(parent)
  for (const c of await walkForName([parent, grand, path.dirname(grand)], name)) candidates.add(c)
  candidates.delete(link.path)

  const stats = []
  for (const c of candidates) {
    try {
      const st = await fs.promises.stat(c)
      if (st.isDirectory() !== !!link.isDir) continue
      stats.push({ p: c, st })
    } catch {
      /* gone */
    }
  }
  if (link.fileId) {
    const same = stats.find(({ st }) => fileIdOf(st) === link.fileId)
    if (same) {
      const found = await statLink(same.p, { platform, bookmark: false })
      if (found) return keep(found, "moved", "fileId")
    }
  }
  if (!link.isDir && Number.isFinite(link.size)) {
    const bySize = stats.filter(({ st }) => st.size === link.size)
    if (bySize.length === 1) {
      const found = await statLink(bySize[0].p, { platform, bookmark: false })
      if (found) return keep(found, "moved", "name-size")
    }
  }
  return { status: "missing" }
}

// ---- text ----------------------------------------------------------------

/** Searchable text from a linked file or folder. "" when there is none. */
async function extractLinkText(p, { pdfParse } = {}) {
  if (!isAbsolutePath(p)) return ""
  try {
    const st = await fs.promises.stat(p)
    if (st.isDirectory()) {
      const walk = await walkDir(p)
      return walk.names.join("\n").slice(0, TEXT_MAX_CHARS)
    }
    if (/\.pdf$/i.test(p)) {
      if (st.size > PDF_MAX_BYTES) return ""
      // eslint-disable-next-line global-require
      const parse = pdfParse || require("pdf-parse")
      const result = await parse(await fs.promises.readFile(p))
      return (result && typeof result.text === "string" ? result.text : "").trim().slice(0, TEXT_MAX_CHARS)
    }
    if (TEXT_EXT.test(p)) {
      const fh = await fs.promises.open(p, "r")
      try {
        const buf = Buffer.alloc(Math.min(st.size, TEXT_HEAD_BYTES))
        await fh.read(buf, 0, buf.length, 0)
        return buf.toString("utf8").slice(0, TEXT_MAX_CHARS)
      } finally {
        await fh.close()
      }
    }
  } catch {
    /* best effort */
  }
  return ""
}

// ---- open / preview ------------------------------------------------------

function isExecutablePath(p) {
  return EXECUTABLE_EXT.test(p.replace(/[/\\]+$/, ""))
}

/**
 * Canonical path for Open, or an error string. A symlink is judged by its
 * target, so a document name cannot point at a program.
 */
async function pathForOpen(p, fsImpl = fs) {
  if (!isAbsolutePath(p)) return { error: "Not a full path." }
  let real
  try {
    real = await fsImpl.promises.realpath(p)
  } catch {
    return { error: "The file is not at that path." }
  }
  if (isExecutablePath(p) || isExecutablePath(real)) {
    return { error: "Brain2 does not open programs. Use Show in folder." }
  }
  return { path: real }
}

/** Token → path for the preview scheme. Only issued tokens are served. */
function createPreviewRegistry() {
  const byToken = new Map()
  const byPath = new Map()
  return {
    urlFor(p) {
      if (!isAbsolutePath(p)) return ""
      let token = byPath.get(p)
      if (!token) {
        token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
        byToken.set(token, p)
        byPath.set(p, token)
      }
      return `${LINK_SCHEME}://f/${token}/${encodeURIComponent(path.basename(p))}`
    },
    pathFor(url) {
      try {
        const { pathname } = new URL(url)
        const token = pathname.split("/").filter(Boolean)[0]
        return (token && byToken.get(token)) || ""
      } catch {
        return ""
      }
    },
  }
}

const LINK_SCHEME_PRIVILEGES = {
  scheme: LINK_SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
}

/** Wire the IPC channels and the preview scheme. Call after `app` is ready. */
function registerFileLinkIpc({ ipcMain, dialog, shell, protocol, net, getWindow }) {
  const previews = createPreviewRegistry()

  protocol.handle(LINK_SCHEME, async (request) => {
    const p = previews.pathFor(request.url)
    if (!p) return new Response("Not found", { status: 404 })
    try {
      const st = await fs.promises.stat(p)
      if (st.isDirectory()) return new Response("Folder", { status: 404 })
    } catch {
      return new Response("Missing", { status: 404 })
    }
    // net.fetch on file:// serves Range requests, so video can seek.
    return net.fetch(pathToFileURL(p).toString(), { headers: request.headers })
  })

  ipcMain.handle(FILE_LINK_CHANNELS.pick, async (_event, opts) => {
    const folders = !!(opts && opts.folders)
    const win = getWindow()
    const options = {
      title: folders ? "Link folders" : "Link files",
      buttonLabel: "Link",
      properties: [folders ? "openDirectory" : "openFile", "multiSelections"],
    }
    try {
      const res = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
      if (res.canceled) return []
      const out = []
      for (const p of res.filePaths || []) {
        const s = await statLink(p)
        if (s) out.push(s)
      }
      return out
    } catch (err) {
      console.warn("[cogs] link pick failed:", err && err.message)
      return []
    }
  })
  ipcMain.handle(FILE_LINK_CHANNELS.stat, (_event, p) => statLink(p))
  ipcMain.handle(FILE_LINK_CHANNELS.resolve, (_event, link) => resolveLink(link))
  ipcMain.handle(FILE_LINK_CHANNELS.extractText, (_event, p) => extractLinkText(p))
  ipcMain.handle(FILE_LINK_CHANNELS.previewUrl, (_event, p) => previews.urlFor(p))
  ipcMain.handle(FILE_LINK_CHANNELS.open, async (_event, p) => {
    const opened = await pathForOpen(p)
    if (opened.error) return opened.error
    return shell.openPath(opened.path)
  })
  ipcMain.on(FILE_LINK_CHANNELS.reveal, (_event, p) => {
    if (isAbsolutePath(p)) shell.showItemInFolder(p)
  })
}

module.exports = {
  FILE_LINK_CHANNELS,
  LINK_SCHEME,
  LINK_SCHEME_PRIVILEGES,
  createPreviewRegistry,
  extractLinkText,
  isExecutablePath,
  pathForOpen,
  registerFileLinkIpc,
  resolveLink,
  statLink,
  walkDir,
  walkForName,
}
