/**
 * electron/sweep.js — Sweep disk walk (desktop only)
 *
 * Scan and duplicate search for the Sweep workspace. A path is cleaned only
 * when it was in the last result for this window and its real path still sits
 * under that result's allowlisted root. Trash rows are deleted in place, and
 * only after the renderer says the permanent step was confirmed. Everything
 * else goes through `shell.trashItem`.
 *
 * `sweepRules` mirrors `lib/sweep-rules.ts`. The unit tests call both.
 */
const fs = require("fs")
const crypto = require("crypto")
const { execFile } = require("child_process")

const SWEEP_CHANNELS = {
  defaults: "cogs:sweep:defaults",
  scan: "cogs:sweep:scan",
  cancel: "cogs:sweep:cancel",
  clean: "cogs:sweep:clean",
  duplicates: "cogs:sweep:duplicates",
  cleanDuplicates: "cogs:sweep:cleanDuplicates",
  textHead: "cogs:sweep:textHead",
  progress: "cogs:sweep:progress",
}

const MEASURE_CAP = 200000
const DUP_FILE_CAP = 150000
const XCODE_GROUPS = ["DerivedData", "Archives", "iOS DeviceSupport"]

const sweepRules = (function sweepRulesFactory() {
  const SWEEP_TEXT_HEAD_CHARS = 2000
  const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "heic", "heif"])
  const VIDEO_EXT = new Set(["mp4", "m4v", "mov", "webm"])
  const AUDIO_EXT = new Set(["mp3", "m4a", "wav", "aiff", "aif", "flac", "ogg", "aac"])
  const TEXT_EXT = new Set([
    "txt", "md", "markdown", "csv", "tsv", "json", "xml", "html", "htm", "css",
    "js", "jsx", "ts", "tsx", "py", "rb", "go", "rs", "java", "swift", "c", "h",
    "cpp", "rtf", "log", "yml", "yaml", "toml", "ini", "sh",
  ])
  const DUP_SKIP = new Set(["library", ".trash", ".git", "node_modules"])

  function stripSlash(p) {
    if (typeof p !== "string" || p.length <= 1) return typeof p === "string" ? p : ""
    return p.replace(/[/\\]+$/, "")
  }
  function pathSegments(p) {
    return String(p).split(/[/\\]+/).filter(Boolean)
  }
  function pathBase(p) {
    const parts = pathSegments(p)
    return parts[parts.length - 1] || p
  }
  function underHome(home, ...parts) {
    const h = stripSlash(home)
    const sep = h.includes("\\") && !h.includes("/") ? "\\" : "/"
    return [h, ...parts.filter((part) => part !== "")].join(sep)
  }
  function pathStaysInside(realChild, realRoot) {
    const child = stripSlash(realChild)
    const root = stripSlash(realRoot)
    if (!child || !root) return false
    if (child === root) return true
    const sep = root.includes("\\") && !root.includes("/") ? "\\" : "/"
    return child.startsWith(root + sep)
  }
  function isSweepPath(p) {
    return typeof p === "string" && p.startsWith("/") && !p.includes("\0") && p.length > 1 && p.length < 4096
  }
  function isDownloadsPath(p) {
    return pathSegments(p).includes("Downloads")
  }
  function isCacheDenied(name) {
    const n = String(name || "").toLowerCase()
    return n.includes("cloudkit") || n.includes("homekit") || n.includes("account")
  }
  function isLanguagePackPath(realPath) {
    return pathSegments(realPath).some((part) => part.endsWith(".lproj") || part.endsWith(".app"))
  }
  function preferenceSkipped(name) {
    const base = pathBase(name)
    if (base.startsWith("com.apple.")) return true
    if (base === "ByHost" || base.includes(".ByHost.")) return true
    return pathSegments(name).includes("ByHost")
  }
  function plistBundleId(filename) {
    const base = pathBase(filename)
    if (!base.endsWith(".plist")) return null
    if (preferenceSkipped(base)) return null
    const id = base.slice(0, -".plist".length)
    if (!id) return null
    return id
  }
  function isOrphanPreference(filename, bundleIds) {
    const id = plistBundleId(filename)
    if (!id) return false
    return !bundleIds.has(id)
  }
  function scanGroupChecked(category, name) {
    if (category === "caches") return !isCacheDenied(name)
    if (category === "logs") return name !== "DiagnosticReports"
    if (category === "xcode") return name === "DerivedData"
    return false
  }
  function forbiddenScanPaths(home) {
    const h = stripSlash(home)
    return [
      "/System",
      "/usr",
      "/Library",
      underHome(h, "Library", "Mail"),
      underHome(h, "Library", "Photos"),
      underHome(h, "Library", "Containers", "com.apple.mail"),
      underHome(h, "Library", "Application Support", "MobileSync"),
      underHome(h, "Library", "LaunchAgents"),
      underHome(h, "Pictures", "Photos Library.photoslibrary"),
      underHome(h, "Documents"),
      underHome(h, "Desktop"),
      underHome(h, "Downloads"),
    ]
  }
  function isForbiddenScanPath(realPath, home, extraRoots) {
    const extra = extraRoots || []
    const p = stripSlash(realPath)
    if (!p) return true
    if (isLanguagePackPath(p)) return true
    const roots = forbiddenScanPaths(home).concat(extra)
    for (const root of roots) {
      if (root && pathStaysInside(p, root)) return true
    }
    return false
  }
  function scanAllowRoot(home, category) {
    if (category === "caches") return underHome(home, "Library", "Caches")
    if (category === "logs") return underHome(home, "Library", "Logs")
    if (category === "xcode") return underHome(home, "Library", "Developer", "Xcode")
    if (category === "trash") return underHome(home, ".Trash")
    return underHome(home, "Library", "Preferences")
  }
  function isDeletableSweepPath(realPath, allowRoot, home, extraRoots) {
    const p = stripSlash(realPath)
    const root = stripSlash(allowRoot)
    const h = stripSlash(home)
    if (!p || !root || p === "/" || p === h || p === root) return false
    if (!pathStaysInside(p, root)) return false
    if (isForbiddenScanPath(p, h, extraRoots)) return false
    return true
  }
  function cleanPathAllowed(realPath, allowRoot, home, category, extraRoots) {
    if (!isDeletableSweepPath(realPath, allowRoot, home, extraRoots)) return false
    const base = pathBase(realPath)
    if (category === "caches" && isCacheDenied(base)) return false
    if (category === "preferences" && preferenceSkipped(base)) return false
    if (isLanguagePackPath(realPath)) return false
    return true
  }
  function duplicateDirSkipped(name) {
    return DUP_SKIP.has(String(name || "").toLowerCase())
  }
  function duplicateRootAllowed(realPath, home) {
    const p = stripSlash(realPath)
    const h = stripSlash(home)
    if (!p || p === "/" || p === h) return false
    if (pathStaysInside(p, "/System") || pathStaysInside(p, "/usr") || pathStaysInside(p, "/Library")) return false
    if (pathStaysInside(p, underHome(h, "Library"))) return false
    if (pathStaysInside(p, underHome(h, ".Trash"))) return false
    if (duplicateDirSkipped(pathBase(p))) return false
    return true
  }
  function duplicateCleanAllowed(realPath, root, home) {
    const p = stripSlash(realPath)
    const r = stripSlash(root)
    const h = stripSlash(home)
    if (!p || !r || p === "/" || p === h || p === r) return false
    if (!pathStaysInside(p, r)) return false
    if (!duplicateRootAllowed(r, h)) return false
    return true
  }
  function defaultDuplicateRoots(home) {
    return ["Desktop", "Documents", "Downloads", "Pictures", "Movies", "Music"].map((name) => underHome(home, name))
  }
  function chooseKeptPath(copies) {
    if (!copies.length) return ""
    const sorted = copies.slice().sort((a, b) => {
      const dt = (Number.isFinite(a.mtimeMs) ? a.mtimeMs : 0) - (Number.isFinite(b.mtimeMs) ? b.mtimeMs : 0)
      if (dt !== 0) return dt
      return a.path < b.path ? -1 : a.path > b.path ? 1 : 0
    })
    const oldest = sorted[0]
    const oldestMs = Number.isFinite(oldest.mtimeMs) ? oldest.mtimeMs : 0
    const outside = copies.filter((copy) => !isDownloadsPath(copy.path))
    if (outside.length === 1) {
      const only = outside[0]
      const ms = Number.isFinite(only.mtimeMs) ? only.mtimeMs : 0
      if (ms > oldestMs) return only.path
    }
    return oldest.path
  }
  function removableDuplicatePaths(copies, requested) {
    if (copies.length < 2) return []
    const keep = chooseKeptPath(copies)
    const inGroup = new Set(copies.map((copy) => copy.path))
    const out = []
    const seen = new Set()
    for (const p of requested) {
      if (p === keep || !inGroup.has(p) || seen.has(p)) continue
      seen.add(p)
      out.push(p)
    }
    if (out.length >= copies.length) return []
    return out
  }
  function pathsFromLastResult(requested, known) {
    const out = []
    const seen = new Set()
    for (const p of requested) {
      if (!known.has(p) || seen.has(p) || !isSweepPath(p)) continue
      seen.add(p)
      out.push(p)
    }
    return out
  }
  function sizesWorthHashing(files) {
    const counts = new Map()
    for (const file of files) {
      if (!file || !(file.size > 0)) continue
      counts.set(file.size, (counts.get(file.size) || 0) + 1)
    }
    return files.filter((file) => file && (counts.get(file.size) || 0) > 1)
  }
  function previewKindForPath(filePath) {
    const base = pathBase(filePath).toLowerCase()
    const dot = base.lastIndexOf(".")
    const ext = dot >= 0 ? base.slice(dot + 1) : ""
    if (IMAGE_EXT.has(ext)) return "image"
    if (VIDEO_EXT.has(ext)) return "video"
    if (AUDIO_EXT.has(ext)) return "audio"
    if (TEXT_EXT.has(ext)) return "text"
    return "file"
  }
  function formatSweepBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
    const units = ["B", "KB", "MB", "GB", "TB"]
    let n = bytes
    let i = 0
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024
      i += 1
    }
    if (i === 0) return `${Math.round(n)} B`
    const text = n >= 10 || Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1)
    return `${text} ${units[i]}`
  }

  return {
    SWEEP_TEXT_HEAD_CHARS,
    stripSlash,
    pathSegments,
    pathBase,
    underHome,
    pathStaysInside,
    isSweepPath,
    isDownloadsPath,
    isCacheDenied,
    isLanguagePackPath,
    preferenceSkipped,
    plistBundleId,
    isOrphanPreference,
    scanGroupChecked,
    forbiddenScanPaths,
    isForbiddenScanPath,
    scanAllowRoot,
    isDeletableSweepPath,
    cleanPathAllowed,
    duplicateDirSkipped,
    duplicateRootAllowed,
    duplicateCleanAllowed,
    defaultDuplicateRoots,
    chooseKeptPath,
    removableDuplicatePaths,
    pathsFromLastResult,
    sizesWorthHashing,
    previewKindForPath,
    formatSweepBytes,
  }
})()

const {
  pathBase,
  underHome,
  pathStaysInside,
  isSweepPath,
  isCacheDenied,
  isLanguagePackPath,
  preferenceSkipped,
  isOrphanPreference,
  scanGroupChecked,
  forbiddenScanPaths,
  isForbiddenScanPath,
  scanAllowRoot,
  cleanPathAllowed,
  duplicateDirSkipped,
  duplicateRootAllowed,
  duplicateCleanAllowed,
  defaultDuplicateRoots,
  chooseKeptPath,
  removableDuplicatePaths,
  pathsFromLastResult,
  sizesWorthHashing,
  previewKindForPath,
  SWEEP_TEXT_HEAD_CHARS,
} = sweepRules

function macError() {
  return { ok: false, error: "Sweep scans this Mac from the desktop app.", groups: [], removed: [], skipped: [], roots: [] }
}

function displayPath(p, home) {
  const h = sweepRules.stripSlash(home)
  const s = sweepRules.stripSlash(p)
  if (s === h) return "~"
  if (h && s.startsWith(h + "/")) return "~" + s.slice(h.length)
  return s
}

async function realOf(p) {
  try {
    return await fs.promises.realpath(p)
  } catch {
    return ""
  }
}

async function realHome(app) {
  const logical = app.getPath("home")
  return (await realOf(logical)) || logical
}

function hashFile(filePath, isCancelled) {
  return new Promise((resolve) => {
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    const hash = crypto.createHash("sha256")
    const stream = fs.createReadStream(filePath)
    stream.on("data", (chunk) => {
      if (isCancelled()) {
        stream.destroy()
        finish("")
        return
      }
      hash.update(chunk)
    })
    stream.on("end", () => finish(hash.digest("hex")))
    stream.on("error", () => finish(""))
  })
}

function plutilXml(plistPath) {
  return new Promise((resolve) => {
    execFile(
      "/usr/bin/plutil",
      ["-convert", "xml1", "-o", "-", plistPath],
      { timeout: 4000, maxBuffer: 2 * 1024 * 1024 },
      (err, stdout) => resolve(err ? "" : String(stdout || "")),
    )
  })
}

async function readBundleId(appPath) {
  const plist = underHome(appPath, "Contents", "Info.plist")
  let st
  try {
    st = await fs.promises.stat(plist)
  } catch {
    return ""
  }
  if (!st.isFile() || st.size > 2 * 1024 * 1024) return ""
  let buf
  try {
    buf = await fs.promises.readFile(plist)
  } catch {
    return ""
  }
  let text = ""
  if (buf.slice(0, 6).toString() === "bplist") text = await plutilXml(plist)
  else text = buf.toString("utf8")
  const match = text.match(/<key>\s*CFBundleIdentifier\s*<\/key>\s*<string>([^<]*)<\/string>/)
  return match && match[1] ? match[1].trim() : ""
}

async function collectApps(root, depthLeft, out, current) {
  if (current.cancelled) return
  let entries
  try {
    entries = await fs.promises.readdir(root, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (current.cancelled) return
    if (entry.name.startsWith(".")) continue
    const abs = underHome(root, entry.name)
    if (entry.name.endsWith(".app")) {
      out.push(abs)
      continue
    }
    if (depthLeft > 0 && entry.isDirectory()) await collectApps(abs, depthLeft - 1, out, current)
  }
}

async function mapPool(items, limit, fn) {
  if (!items.length) return
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor
      cursor += 1
      await fn(items[idx])
    }
  }
  const n = Math.min(limit, items.length)
  await Promise.all(Array.from({ length: n }, () => worker()))
}

function startProgress(event, current, mode, home) {
  let folder = ""
  let bytes = 0
  const send = () => {
    if (!event.sender || event.sender.isDestroyed()) {
      current.cancelled = true
      return
    }
    event.sender.send(SWEEP_CHANNELS.progress, { jobId: current.id, mode, folder, bytes })
  }
  const timer = setInterval(send, 200)
  return {
    setFolder(p) {
      folder = displayPath(p, home)
    },
    addBytes(n) {
      bytes += n
    },
    flush: send,
    stop() {
      clearInterval(timer)
    },
  }
}

async function measure(start, allowReal, ctx) {
  let bytes = 0
  let files = 0
  let partial = false
  let visits = 0
  const stack = [start]
  const seenDir = new Set()
  const seenFile = new Set()

  function addFile(st) {
    if (partial) return
    visits += 1
    if (visits > MEASURE_CAP) {
      partial = true
      return
    }
    const id = `${st.dev}:${st.ino}`
    if (seenFile.has(id)) return
    seenFile.add(id)
    bytes += st.size
    files += 1
    ctx.progress.addBytes(st.size)
  }

  async function pushDir(dir) {
    if (partial) return
    visits += 1
    if (visits > MEASURE_CAP) {
      partial = true
      return
    }
    ctx.progress.setFolder(dir)
    let names
    try {
      names = await fs.promises.readdir(dir)
    } catch {
      return
    }
    for (const name of names) {
      if (name === ".DS_Store") continue
      if (ctx.denyName && ctx.denyName(name)) continue
      if (name.endsWith(".lproj") || name.endsWith(".app")) continue
      stack.push(underHome(dir, name))
    }
  }

  while (stack.length) {
    if (ctx.current.cancelled) return { cancelled: true, bytes, files, partial }
    const currentPath = stack.pop()
    let lst
    try {
      lst = await fs.promises.lstat(currentPath)
    } catch {
      continue
    }
    if (lst.isSymbolicLink()) {
      const real = await realOf(currentPath)
      if (!real || !pathStaysInside(real, allowReal)) continue
      if (isForbiddenScanPath(real, ctx.home, ctx.extra) || isLanguagePackPath(real)) continue
      let st
      try {
        st = await fs.promises.stat(currentPath)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        if (seenDir.has(real)) continue
        seenDir.add(real)
        await pushDir(real)
      } else if (st.isFile()) addFile(st)
      continue
    }
    if (lst.isDirectory()) {
      const real = await realOf(currentPath)
      if (!real || !pathStaysInside(real, allowReal)) continue
      if (isForbiddenScanPath(real, ctx.home, ctx.extra)) continue
      if (seenDir.has(real)) continue
      seenDir.add(real)
      await pushDir(currentPath)
    } else if (lst.isFile()) addFile(lst)
  }
  return { cancelled: false, bytes, files, partial }
}

function makeRow(abs, category, bytes, fileCount, partial) {
  const name = pathBase(abs)
  return {
    id: `${category}:${abs}`,
    categoryId: category,
    label: name,
    path: abs,
    bytes,
    fileCount,
    checked: scanGroupChecked(category, name),
    permanent: category === "trash",
    partial: !!partial,
  }
}

async function considerTree(abs, category, ctx) {
  if (ctx.current.cancelled) return { cancelled: true }
  if (!isSweepPath(abs)) return null
  const real = await realOf(abs)
  if (!real || !pathStaysInside(real, ctx.allowReal)) return null
  if (!cleanPathAllowed(real, ctx.allowReal, ctx.home, category, ctx.extra)) return null
  const measured = await measure(abs, ctx.allowReal, ctx)
  if (measured.cancelled) return { cancelled: true }
  return makeRow(abs, category, measured.bytes, measured.files, measured.partial)
}

async function forbiddenExtra(home) {
  const extra = []
  for (const p of forbiddenScanPaths(home)) {
    const real = await realOf(p)
    if (real && real !== sweepRules.stripSlash(p)) extra.push(real)
  }
  return extra
}

async function openCategory(home, category, extra) {
  const logical = scanAllowRoot(home, category)
  const allowReal = await realOf(logical)
  if (!allowReal || allowReal === "/" || allowReal === home) return null
  if (!pathStaysInside(allowReal, home)) return null
  if (isForbiddenScanPath(allowReal, home, extra)) return null
  return { logical, allowReal }
}

async function installedBundleIds(home, current, progress) {
  const apps = []
  progress.setFolder("/Applications")
  await collectApps("/Applications", 1, apps, current)
  const userApps = underHome(home, "Applications")
  progress.setFolder(userApps)
  await collectApps(userApps, 1, apps, current)
  const ids = new Set()
  await mapPool(apps, 8, async (appPath) => {
    if (current.cancelled) return
    const id = await readBundleId(appPath)
    if (id) ids.add(id)
  })
  return ids
}

function remember(groups, meta, row, allowReal, category) {
  if (!row || row.cancelled) return row
  groups.push(row)
  meta.set(row.path, { allowRoot: allowReal, category, permanent: category === "trash" })
  return row
}

async function scanCategory(category, ctx, groups, meta) {
  const opened = await openCategory(ctx.home, category, ctx.extra)
  if (!opened) return
  const local = { ...ctx, allowReal: opened.allowReal, denyName: category === "caches" ? isCacheDenied : null }
  ctx.progress.setFolder(opened.logical)

  if (category === "xcode") {
    for (const name of XCODE_GROUPS) {
      const row = await considerTree(underHome(opened.logical, name), category, local)
      if (row && row.cancelled) return
      remember(groups, meta, row, opened.allowReal, category)
    }
    return
  }

  if (category === "preferences") {
    let names
    try {
      names = await fs.promises.readdir(opened.logical)
    } catch {
      return
    }
    ctx.progress.setFolder("/Applications")
    const bundles = await installedBundleIds(ctx.home, ctx.current, ctx.progress)
    if (ctx.current.cancelled) return
    ctx.progress.setFolder(opened.logical)
    for (const name of names) {
      if (ctx.current.cancelled) return
      if (!isOrphanPreference(name, bundles)) continue
      const abs = underHome(opened.logical, name)
      let lst
      try {
        lst = await fs.promises.lstat(abs)
      } catch {
        continue
      }
      if (!lst.isFile() && !lst.isSymbolicLink()) continue
      const real = await realOf(abs)
      if (!real || !cleanPathAllowed(real, opened.allowReal, ctx.home, category, ctx.extra)) continue
      let size = lst.size
      if (lst.isSymbolicLink()) {
        try {
          size = (await fs.promises.stat(abs)).size
        } catch {
          continue
        }
      }
      remember(groups, meta, makeRow(abs, category, size, 1, false), opened.allowReal, category)
    }
    return
  }

  let names
  try {
    names = await fs.promises.readdir(opened.logical)
  } catch {
    return
  }
  for (const name of names) {
    if (ctx.current.cancelled) return
    if (name.endsWith(".lproj") || name.endsWith(".app")) continue
    if (category === "caches" && (isCacheDenied(name) || name === ".DS_Store")) continue
    if (category === "logs" && name === ".DS_Store") continue
    const row = await considerTree(underHome(opened.logical, name), category, local)
    if (row && row.cancelled) return
    remember(groups, meta, row, opened.allowReal, category)
  }
}

async function runScan(event, session, app) {
  if (process.platform !== "darwin") return macError()
  if (session.job) session.job.cancelled = true
  const current = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, cancelled: false }
  session.job = current
  session.lastScan = null
  const home = await realHome(app)
  const extra = await forbiddenExtra(home)
  const progress = startProgress(event, current, "scan", home)
  const groups = []
  const meta = new Map()
  try {
    const ctx = { home, extra, progress, current }
    for (const category of ["caches", "logs", "xcode", "trash", "preferences"]) {
      if (current.cancelled) break
      await scanCategory(category, ctx, groups, meta)
    }
  } catch (err) {
    console.warn("[brain2] sweep scan stopped:", err && err.message)
    return { ok: false, error: "The scan stopped.", groups: [] }
  } finally {
    progress.stop()
    progress.flush()
  }
  if (current.cancelled || session.job !== current) return { ok: false, cancelled: true, groups: [] }
  session.lastScan = { id: current.id, paths: new Set(groups.map((g) => g.path)), meta, home, extra }
  return { ok: true, scanId: current.id, groups, truncated: groups.some((g) => g.partial) }
}

async function cleanScan(session, req, shell) {
  if (process.platform !== "darwin") return macError()
  const last = session.lastScan
  if (!last || !req || req.scanId !== last.id) {
    return { ok: false, removed: [], skipped: [], error: "Scan again before cleaning." }
  }
  const raw = Array.isArray(req.paths) ? req.paths : []
  const accepted = pathsFromLastResult(raw, last.paths)
  const removed = []
  const skipped = raw.filter((p) => !last.paths.has(p))
  let needConfirm = false
  const confirm = req.confirmPermanent === true
  for (const p of accepted) {
    const meta = last.meta.get(p)
    if (!meta) {
      skipped.push(p)
      continue
    }
    if (meta.permanent && !confirm) {
      needConfirm = true
      skipped.push(p)
      continue
    }
    const real = await realOf(p)
    if (!cleanPathAllowed(real, meta.allowRoot, last.home, meta.category, last.extra)) {
      skipped.push(p)
      continue
    }
    try {
      if (meta.permanent) await fs.promises.rm(p, { recursive: true, force: true })
      else await shell.trashItem(p)
      removed.push(p)
      last.paths.delete(p)
    } catch (err) {
      skipped.push(p)
      console.warn("[brain2] sweep left a path in place:", pathBase(p), err && err.message)
    }
  }
  return {
    ok: removed.length > 0 || !needConfirm,
    removed,
    skipped,
    error: needConfirm && removed.length === 0 ? "Emptying the Trash deletes those files permanently." : undefined,
  }
}

async function walkDuplicateRoot(root, allowReal, ctx, out) {
  const stack = [root]
  const seenDir = new Set()
  while (stack.length) {
    if (ctx.current.cancelled || ctx.truncated) return
    const dir = stack.pop()
    const realDir = await realOf(dir)
    if (!realDir || !pathStaysInside(realDir, allowReal) || seenDir.has(realDir)) continue
    seenDir.add(realDir)
    ctx.progress.setFolder(dir)
    let entries
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (ctx.current.cancelled) return
      if (out.length >= DUP_FILE_CAP) {
        ctx.truncated = true
        return
      }
      if (entry.name === ".DS_Store") continue
      const abs = underHome(dir, entry.name)
      if (entry.isSymbolicLink()) {
        const real = await realOf(abs)
        if (!real || !pathStaysInside(real, allowReal)) continue
        let st
        try {
          st = await fs.promises.stat(abs)
        } catch {
          continue
        }
        if (st.isDirectory()) {
          if (!duplicateDirSkipped(entry.name)) stack.push(abs)
        } else if (st.isFile() && st.size > 0) pushFile(abs, st)
        continue
      }
      if (entry.isDirectory()) {
        if (!duplicateDirSkipped(entry.name)) stack.push(abs)
        continue
      }
      if (!entry.isFile()) continue
      let st
      try {
        st = await fs.promises.lstat(abs)
      } catch {
        continue
      }
      if (st.size > 0) pushFile(abs, st)
    }
  }

  function pushFile(abs, st) {
    const id = `${st.dev}:${st.ino}`
    if (ctx.seenFile.has(id)) return
    ctx.seenFile.add(id)
    out.push({ path: abs, size: st.size, mtimeMs: st.mtimeMs, root: allowReal })
    ctx.progress.addBytes(st.size)
  }
}

async function runDuplicates(event, session, app, roots) {
  if (process.platform !== "darwin") return macError()
  if (session.job) session.job.cancelled = true
  const current = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, cancelled: false }
  session.job = current
  session.lastDup = null
  const home = await realHome(app)
  const { accepted, refused } = await acceptRoots(home, roots)
  if (!accepted.length && refused.length) {
    return { ok: false, error: "Those folders stay out of duplicate search.", groups: [], refusedRoots: refused }
  }
  const progress = startProgress(event, current, "duplicates", home)
  const files = []
  const ctx = { current, progress, truncated: false, seenFile: new Set() }
  try {
    for (const root of accepted) {
      if (current.cancelled || ctx.truncated) break
      await walkDuplicateRoot(root.given, root.real, ctx, files)
    }
    if (current.cancelled) return { ok: false, cancelled: true, groups: [], refusedRoots: refused }
    const hashThese = sizesWorthHashing(files)
    const hashed = []
    for (const file of hashThese) {
      if (current.cancelled) break
      progress.setFolder(file.path)
      const hash = await hashFile(file.path, () => current.cancelled)
      if (!hash) continue
      hashed.push({ ...file, hash })
    }
    if (current.cancelled || session.job !== current) {
      return { ok: false, cancelled: true, groups: [], refusedRoots: refused }
    }
    const byHash = new Map()
    for (const file of hashed) {
      const list = byHash.get(file.hash) || []
      list.push(file)
      byHash.set(file.hash, list)
    }
    const groups = []
    const rootByPath = new Map()
    const paths = new Set()
    for (const [hash, list] of byHash) {
      if (list.length < 2) continue
      const copies = list.map((file) => ({ path: file.path, size: file.size, mtimeMs: file.mtimeMs }))
      const keepPath = chooseKeptPath(copies)
      const groupFiles = list
        .map((file) => ({
          path: file.path,
          name: pathBase(file.path),
          size: file.size,
          mtimeMs: file.mtimeMs,
          hash,
        }))
        .sort((a, b) => (a.path === keepPath ? -1 : b.path === keepPath ? 1 : a.path < b.path ? -1 : 1))
      groups.push({ hash, size: list[0].size, keepPath, files: groupFiles })
      for (const file of list) {
        paths.add(file.path)
        rootByPath.set(file.path, file.root)
      }
    }
    groups.sort((a, b) => b.size - a.size || (a.hash < b.hash ? -1 : 1))
    session.lastDup = { id: current.id, paths, groups: groups.map((g) => ({ hash: g.hash, files: g.files })), rootByPath, home }
    return { ok: true, resultId: current.id, groups, truncated: ctx.truncated, refusedRoots: refused }
  } catch (err) {
    console.warn("[brain2] sweep duplicate search stopped:", err && err.message)
    return { ok: false, error: "The search stopped.", groups: [], refusedRoots: refused }
  } finally {
    progress.stop()
    progress.flush()
  }
}

async function acceptRoots(home, requested) {
  const list = Array.isArray(requested) && requested.length ? requested : defaultDuplicateRoots(home)
  const accepted = []
  const refused = []
  const seen = new Set()
  for (const raw of list) {
    if (typeof raw !== "string" || !isSweepPath(raw)) {
      if (raw) refused.push(String(raw))
      continue
    }
    const real = await realOf(raw)
    if (!real) continue
    if (!duplicateRootAllowed(real, home)) {
      refused.push(raw)
      continue
    }
    if (seen.has(real)) continue
    seen.add(real)
    let st
    try {
      st = await fs.promises.stat(real)
    } catch {
      continue
    }
    if (!st.isDirectory()) continue
    accepted.push({ given: raw, real })
  }
  return { accepted, refused }
}

async function cleanDuplicates(session, req, shell) {
  if (process.platform !== "darwin") return macError()
  const last = session.lastDup
  if (!last || !req || req.resultId !== last.id) {
    return { ok: false, removed: [], skipped: [], error: "Search again before cleaning." }
  }
  const raw = Array.isArray(req.paths) ? req.paths : []
  const accepted = pathsFromLastResult(raw, last.paths)
  const allowed = new Set()
  for (const group of last.groups) {
    const copies = group.files.map((file) => ({ path: file.path, size: file.size, mtimeMs: file.mtimeMs }))
    for (const p of removableDuplicatePaths(copies, accepted)) allowed.add(p)
  }
  const removed = []
  const skipped = raw.filter((p) => typeof p !== "string" || !last.paths.has(p))
  for (const p of accepted) {
    if (!allowed.has(p)) continue
    const root = last.rootByPath.get(p)
    const real = await realOf(p)
    if (!duplicateCleanAllowed(real, root, last.home)) {
      skipped.push(p)
      continue
    }
    try {
      await shell.trashItem(p)
      removed.push(p)
      last.paths.delete(p)
    } catch (err) {
      if (!skipped.includes(p)) skipped.push(p)
      console.warn("[brain2] sweep left a copy in place:", pathBase(p), err && err.message)
    }
  }
  return { ok: true, removed, skipped }
}

async function textHead(session, p) {
  if (process.platform !== "darwin") return ""
  const last = session.lastDup
  if (!last || typeof p !== "string" || !last.paths.has(p)) return ""
  if (previewKindForPath(p) !== "text") return ""
  const real = await realOf(p)
  const root = last.rootByPath.get(p)
  if (!duplicateCleanAllowed(real, root, last.home)) return ""
  let fh
  try {
    fh = await fs.promises.open(p, "r")
    const buf = Buffer.alloc(8192)
    const { bytesRead } = await fh.read(buf, 0, buf.length, 0)
    const slice = buf.subarray(0, bytesRead)
    if (slice.includes(0)) return ""
    return slice.toString("utf8").slice(0, SWEEP_TEXT_HEAD_CHARS)
  } catch {
    return ""
  } finally {
    if (fh) await fh.close().catch(() => {})
  }
}

const sessions = new Map()

function sessionFor(event) {
  const id = event.sender.id
  let session = sessions.get(id)
  if (!session) {
    session = { job: null, lastScan: null, lastDup: null }
    sessions.set(id, session)
    event.sender.once("destroyed", () => sessions.delete(id))
  }
  return session
}

function registerSweepIpc({ ipcMain, shell, app }) {
  ipcMain.handle(SWEEP_CHANNELS.defaults, async () => {
    if (process.platform !== "darwin") return { roots: [] }
    const home = await realHome(app)
    return { roots: defaultDuplicateRoots(home) }
  })
  ipcMain.handle(SWEEP_CHANNELS.scan, (event) => runScan(event, sessionFor(event), app))
  ipcMain.handle(SWEEP_CHANNELS.clean, (event, req) => cleanScan(sessionFor(event), req, shell))
  ipcMain.handle(SWEEP_CHANNELS.duplicates, (event, roots) => runDuplicates(event, sessionFor(event), app, roots))
  ipcMain.handle(SWEEP_CHANNELS.cleanDuplicates, (event, req) => cleanDuplicates(sessionFor(event), req, shell))
  ipcMain.handle(SWEEP_CHANNELS.textHead, (event, p) => textHead(sessionFor(event), p))
  ipcMain.on(SWEEP_CHANNELS.cancel, (event) => {
    const session = sessions.get(event.sender.id)
    if (session && session.job) session.job.cancelled = true
  })
}

module.exports = { registerSweepIpc, sweepRules, SWEEP_CHANNELS }
