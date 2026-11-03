/**
 * electron/instagram-report.js — Instagram export → report pipeline
 *
 * Finds a new Instagram "Download your information" export (zip or unzipped
 * folder) in ~/Downloads, a picked folder, or Google Drive, copies it into
 * Brain2's data folder, runs the person's `analyze.py` then `build_report.py`,
 * and points the Data → Sources → Instagram view at the new `report.html`.
 * Drive files are read, not `copyfile`d: Drive cancels `copyfile` on a streamed file.
 *
 * Plain Node (no `electron` import) so `scripts/instagram-api.mjs` can serve
 * the same folder in local dev. Only the Electron main process runs ingest.
 *
 * Layout under `<userData>/instagram/`:
 *   config.json     paths and names (defaults below)
 *   state.json      current build, previous build, last error, imported keys
 *   ui-state.json   the report's ig-* localStorage keys, kept across origins
 *   exports/<date>-<id>/   unzipped copy of the export (never Downloads)
 *   builds/<stamp>/        IG_OUT for one run: report.html, summary.json,
 *                          thumbs/, media -> exports/…/media
 *
 * A run builds into a new folder and only then moves `state.current` to it,
 * so the old report, thumbs and media stay viewable until the new set exists.
 */
const path = require("path")
const os = require("os")
const nodeFs = require("fs")
const { pipeline } = require("stream/promises")
const { execFile } = require("child_process")
const { resolveElectronUserData } = require("./user-data-path")
const archive = require("./instagram-archive")

/** The report keeps these in localStorage. Brain2 keeps a copy so a new origin starts with them. */
const UI_STATE_KEYS = ["ig-matches", "ig-hide-cols", "ig-photos"]
const PY_MODULES = [
  ["emoji", "emoji"],
  ["sklearn", "scikit-learn"],
  ["vaderSentiment", "vaderSentiment"],
  ["PIL", "Pillow"],
]
const PARTIAL_SUFFIXES = [".crdownload", ".download", ".part", ".partial", ".tmp"]
/** A zip must hold the same size and mtime this long before it is opened. */
const STABLE_MS = 10_000
const ARCHIVE_RETRY_MS = 60 * 60_000
// Drive writes a daily export file by file, sometimes with long gaps.
const DRIVE_STABLE_MS = 15 * 60_000
/**
 * A canceled Drive copy is retried even when the folder has not changed.
 * The fingerprint would otherwise remember the failure forever.
 */
const COPY_RETRY_MS = 10 * 60_000
const COPY_ATTEMPTS = 5
/** macOS File Provider answers these while a streamed Drive file is not local yet. */
const COPY_TRANSIENT = new Set([
  "ECANCELED",
  "EAGAIN",
  "EBUSY",
  "EINTR",
  "EIO",
  "ETIMEDOUT",
  "ENETDOWN",
  "ENETUNREACH",
  "ECONNRESET",
  "ECONNABORTED",
  "ENOTCONN",
  "ESTALE",
])
/** A photo or video Drive will not hand over. The JSON is the export; these are not. */
const MEDIA_EXT = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".heic",
  ".heif",
  ".mp4",
  ".mov",
  ".m4v",
  ".mp3",
  ".m4a",
  ".aac",
  ".wav",
  ".ogg",
])
const RUN_TIMEOUT_MS = 45 * 60_000

/** Outside requests the report may make; both are opt-in inside the report. */
const REPORT_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://unavatar.io",
  "media-src 'self' blob:",
  "frame-src https://www.instagram.com",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
].join("; ")

function appDataDir(platform = process.platform, env = process.env, home = os.homedir()) {
  if (platform === "darwin") return path.join(home, "Library", "Application Support")
  if (platform === "win32") return env.APPDATA || path.join(home, "AppData", "Roaming")
  return env.XDG_CONFIG_HOME || path.join(home, ".config")
}

/** `<userData>/instagram`, the same folder Electron and the dev server use. */
function defaultRoot(userData) {
  return path.join(userData || resolveElectronUserData(appDataDir()), "instagram")
}

function defaultConfig(home = os.homedir()) {
  return {
    scriptsDir: path.join(home, "instagram-analysis"),
    python: path.join(home, "texts-analysis", ".venv", "bin", "python"),
    /** DM sender name that is "me" in the export (ME in analyze.py). */
    me: "alitza",
    /** Shown in the report subtitle as @handle. Also the account an export must belong to. */
    handle: "entropyviolation",
    downloadsDir: path.join(home, "Downloads"),
    /** Optional second folder to watch. */
    extraDir: "",
    /** Where manual DM matches are written for analyze.py. Empty = <scriptsDir>/matches.json. */
    matchesPath: "",
    /** Empty = found on PATH or the usual Homebrew / Anaconda folders. */
    ffmpeg: "",
    keepExports: 2,
    /** Also watch My Drive of every Google Drive for desktop account (Meta's scheduled export). */
    watchGoogleDrive: true,
  }
}

/**
 * `~/Library/CloudStorage/GoogleDrive-<email>/My Drive` for each signed-in
 * Google Drive for desktop account. Meta's scheduled export writes a
 * `meta-<YYYY>-<Mon>-<DD>-<HH>-<mm>-<ss>` folder at the top of My Drive.
 */
function googleDriveDirs(home = os.homedir(), { fs = nodeFs } = {}) {
  const base = path.join(home, "Library", "CloudStorage")
  let entries = []
  try {
    entries = fs.readdirSync(base, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((e) => e.isDirectory() && e.name.startsWith("GoogleDrive-"))
    .map((e) => path.join(base, e.name, "My Drive"))
    .filter((d) => fs.existsSync(d))
}

/** Every folder the watcher reads: Downloads, the picked folder, and Google Drive when on. */
function watchedDirs(config, { fs = nodeFs, home } = {}) {
  const dirs = [config.downloadsDir, config.extraDir]
  if (config.watchGoogleDrive !== false) dirs.push(...googleDriveDirs(home, { fs }))
  return [...new Set(dirs.filter(Boolean))]
}

function readJson(fs, p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"))
  } catch {
    return fallback
  }
}

/** Write through a temp file and rename, so a crash never leaves half a JSON file. */
function writeJson(fs, p, value) {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  const tmp = `${p}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(value, null, 1))
  fs.renameSync(tmp, p)
}

function loadConfig(root, { fs = nodeFs, home } = {}) {
  const saved = readJson(fs, path.join(root, "config.json"), {})
  const cfg = { ...defaultConfig(home), ...(saved && typeof saved === "object" ? saved : {}) }
  if (!cfg.matchesPath) cfg.matchesPath = path.join(cfg.scriptsDir, "matches.json")
  return cfg
}

function saveConfigPatch(root, patch, { fs = nodeFs } = {}) {
  const saved = readJson(fs, path.join(root, "config.json"), {})
  const allowed = Object.keys(defaultConfig())
  const next = { ...saved }
  for (const [k, v] of Object.entries(patch || {})) {
    if (allowed.includes(k)) next[k] = v
  }
  writeJson(fs, path.join(root, "config.json"), next)
  return next
}

function loadState(root, { fs = nodeFs } = {}) {
  const s = readJson(fs, path.join(root, "state.json"), {})
  return { current: null, previous: null, lastError: null, imported: {}, ...(s && typeof s === "object" ? s : {}) }
}

function saveState(root, state, { fs = nodeFs } = {}) {
  writeJson(fs, path.join(root, "state.json"), state)
}

/**
 * `instagram-<account>-<YYYY-MM-DD>-<id>` with an optional part suffix and
 * `.zip`. The account is often wrapped in underscores (`_entropyviolation_`).
 */
function parseExportName(name) {
  if (typeof name !== "string") return null
  const m = /^instagram-(.+?)-(\d{4}-\d{2}-\d{2})-([A-Za-z0-9]+)(?:[-_ ](?:part)?\s*\(?\d+\)?)?(\.zip)?$/i.exec(name)
  if (!m) return null
  const id = m[3]
  return {
    key: `instagram-${m[1]}-${m[2]}-${id}`,
    account: m[1].replace(/^_+|_+$/g, ""),
    date: m[2],
    id,
    zip: !!m[4],
  }
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

/**
 * Meta's scheduled export folder in Google Drive: `meta-2026-Oct-22-20-23-37`.
 * The account is not in the name; the zips or folders inside may carry it.
 */
function parseMetaFolderName(name) {
  const m = /^meta-(\d{4})-([A-Za-z]{3})-(\d{1,2})-(\d{1,2})-(\d{1,2})-(\d{1,2})$/.exec(String(name || ""))
  if (!m) return null
  const mon = MONTHS.indexOf(m[2].toLowerCase())
  if (mon < 0) return null
  const pad = (n) => String(n).padStart(2, "0")
  return {
    key: name,
    date: `${m[1]}-${pad(mon + 1)}-${pad(m[3])}`,
    id: `${pad(m[4])}${pad(m[5])}${pad(m[6])}`,
  }
}

function accountMatches(account, handle) {
  const norm = (s) => String(s || "").replace(/^@/, "").replace(/^_+|_+$/g, "").toLowerCase()
  return !norm(handle) || norm(account) === norm(handle)
}

/** The folder inside an unzipped export that holds `your_instagram_activity/`. */
function findExportRoot(dir, { fs = nodeFs, depth = 2 } = {}) {
  const looksLikeRoot = (d) =>
    fs.existsSync(path.join(d, "your_instagram_activity")) || fs.existsSync(path.join(d, "personal_information"))
  if (looksLikeRoot(dir)) return dir
  if (depth <= 0) return null
  let entries = []
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return null
  }
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith(".") || e.name === "__MACOSX") continue
    const found = findExportRoot(path.join(dir, e.name), { fs, depth: depth - 1 })
    if (found) return found
  }
  return null
}

/**
 * The username inside an unzipped export, from
 * `personal_information/personal_information.json`. "" when it is not there.
 */
function exportAccount(exportRoot, { fs = nodeFs } = {}) {
  const file = path.join(exportRoot, "personal_information", "personal_information", "personal_information.json")
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"))
    const user = (data.profile_user || [])[0] || {}
    const u = (user.string_map_data || {}).Username || (user.string_map_data || {}).username
    return (u && u.value) || ""
  } catch {
    return ""
  }
}

/** File count, total size and newest mtime under `dir`, stopping after `limit` entries. */
function treeStats(dir, { fs = nodeFs, limit = 50_000 } = {}) {
  const out = { count: 0, size: 0, mtimeMs: 0 }
  const stack = [dir]
  while (stack.length && out.count < limit) {
    const d = stack.pop()
    let entries = []
    try {
      entries = fs.readdirSync(d, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) stack.push(p)
      else if (e.isFile()) {
        try {
          const st = fs.statSync(p)
          out.count++
          out.size += st.size
          out.mtimeMs = Math.max(out.mtimeMs, st.mtimeMs)
        } catch {
          // gone between readdir and stat; the next scan sees the change
        }
      }
    }
  }
  return out
}

/**
 * One `meta-…` folder from a scheduled Drive export. Meta keeps one such
 * folder and adds each day's export inside it as an unzipped
 * `instagram-<account>-<date>-<id>` folder (seen 2026-10-25), so every
 * export inside is its own candidate. Also taken: the folder itself as one
 * unzipped export, or plain zips as the parts of one export (named by the
 * folder). Drive may still be syncing, so each candidate carries a tree
 * fingerprint and one with no files yet is skipped.
 */
function scanMetaFolder(folder, meta, { fs = nodeFs } = {}) {
  const base = { key: meta.key, account: "", accountUnknown: true, date: meta.date, id: meta.id, paths: [], size: 0, mtimeMs: 0, fromDrive: true }
  const st = (p) => {
    try {
      return fs.statSync(p)
    } catch {
      return null
    }
  }
  const withTree = (c) => {
    if (c.kind !== "dir") return c
    const t = treeStats(c.paths[0], { fs })
    if (!t.count) return null
    const s = st(c.paths[0])
    return { ...c, size: t.size, treeCount: t.count, mtimeMs: Math.max(t.mtimeMs, s ? s.mtimeMs : 0) }
  }
  if (findExportRoot(folder, { fs, depth: 0 })) {
    const c = withTree({ ...base, kind: "dir", paths: [folder] })
    return c ? [c] : []
  }
  const inner = scanForExports([folder], { fs })
  if (inner.length) return inner.map((c) => withTree({ ...c, fromDrive: true })).filter(Boolean)
  if (findExportRoot(folder, { fs, depth: 2 })) {
    const c = withTree({ ...base, kind: "dir", paths: [folder] })
    return c ? [c] : []
  }
  let names = []
  try {
    names = fs.readdirSync(folder)
  } catch {
    return []
  }
  if (names.some((n) => PARTIAL_SUFFIXES.some((s) => n.toLowerCase().endsWith(s)))) return []
  const zips = names.filter((n) => n.toLowerCase().endsWith(".zip")).sort()
  if (!zips.length) return []
  const c = { ...base, kind: "zip" }
  for (const z of zips) {
    const s = st(path.join(folder, z))
    if (!s || !s.isFile()) continue
    c.paths.push(path.join(folder, z))
    c.size += s.size
    c.mtimeMs = Math.max(c.mtimeMs, s.mtimeMs)
  }
  return c.paths.length ? [c] : []
}

/**
 * Exports sitting in the watched folders, grouped by export key (several zips
 * of one export share a key). Partial downloads are skipped.
 */
function scanForExports(dirs, { fs = nodeFs } = {}) {
  const groups = new Map()
  for (const dir of dirs) {
    if (!dir) continue
    let entries = []
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      if (PARTIAL_SUFFIXES.some((s) => e.name.toLowerCase().endsWith(s))) continue
      const meta = e.isDirectory() ? parseMetaFolderName(e.name) : null
      if (meta) {
        for (const c of scanMetaFolder(path.join(dir, e.name), meta, { fs })) groups.set(c.key, c)
        continue
      }
      const parsed = parseExportName(e.name)
      if (!parsed) continue
      const full = path.join(dir, e.name)
      let st
      try {
        st = fs.statSync(full)
      } catch {
        continue
      }
      if (parsed.zip ? !st.isFile() : !st.isDirectory()) continue
      if (!parsed.zip && !findExportRoot(full, { fs })) continue
      const g = groups.get(parsed.key) || {
        key: parsed.key,
        account: parsed.account,
        date: parsed.date,
        id: parsed.id,
        kind: parsed.zip ? "zip" : "dir",
        paths: [],
        size: 0,
        mtimeMs: 0,
      }
      // A folder and its zip side by side: take the folder, it is already open.
      if (g.kind !== (parsed.zip ? "zip" : "dir")) {
        if (parsed.zip) continue
        g.kind = "dir"
        g.paths = []
        g.size = 0
        g.mtimeMs = 0
      }
      g.paths.push(full)
      g.size += parsed.zip ? st.size : 0
      g.mtimeMs = Math.max(g.mtimeMs, st.mtimeMs)
      groups.set(parsed.key, g)
    }
  }
  for (const g of groups.values()) g.paths.sort()
  return [...groups.values()].sort((a, b) => (a.date === b.date ? a.mtimeMs - b.mtimeMs : a.date < b.date ? -1 : 1))
}

/** Fingerprint used to skip an export that was already imported (or already failed unchanged). */
function exportFingerprint(c) {
  const tree = c.treeCount != null ? `:${c.treeCount}` : ""
  return `${c.kind}:${c.paths.length}:${c.size}:${Math.round(c.mtimeMs)}${tree}`
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isSkippableMedia(name) {
  return MEDIA_EXT.has(path.extname(String(name || "")).toLowerCase())
}

function isTransientCopyError(err) {
  return !!(err && COPY_TRANSIENT.has(err.code))
}

/** A failed copy or unzip can be tried again. An analyze or build failure waits until the export changes. */
function copyRetryPending(seen, now) {
  if (!seen || seen.ok !== false) return false
  if (seen.step !== "copy" && seen.step !== "unzip") return false
  const at = Date.parse(seen.at || "")
  if (!Number.isFinite(at)) return false
  return now - at < COPY_RETRY_MS
}

function copyErrorMessage(err, rel) {
  if (isTransientCopyError(err)) {
    return `Google Drive did not finish downloading ${rel}. Leave the Meta folder in Drive; it does not need to be copied onto this Mac or into iCloud. The next check will try again.`
  }
  return (err && err.message) || `Could not copy ${rel}.`
}

async function withCopyTries(fn, { attempts, pause }) {
  let last
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      last = err
      if (!isTransientCopyError(err) || i === attempts - 1) throw err
      await pause(Math.min(8000, 400 * 2 ** i))
    }
  }
  throw last
}

/**
 * Copy one file by reading it. `fs.cp` / `copyfile` is what Google Drive's
 * file provider cancels (`ECANCELED`) on a streamed, online-only file. A
 * normal read is how that file gets downloaded.
 */
async function copyOneFile(fs, src, dest, opts) {
  await withCopyTries(async () => {
    const tmp = `${dest}.${process.pid}.part`
    try {
      await fs.promises.mkdir(path.dirname(dest), { recursive: true })
      const size = (await fs.promises.stat(src)).size
      await pipeline(fs.createReadStream(src), fs.createWriteStream(tmp))
      const got = (await fs.promises.stat(tmp)).size
      if (size > 0 && got !== size) {
        const err = new Error(`short read of ${path.basename(src)} (${got} of ${size})`)
        err.code = "ECANCELED"
        throw err
      }
      await fs.promises.rename(tmp, dest)
    } catch (err) {
      await fs.promises.rm(tmp, { force: true }).catch(() => {})
      throw err
    }
  }, opts)
}

/**
 * Copy a directory tree into `dest` (which already exists). Returns relative
 * paths of media files that Drive still would not give up. A JSON file that
 * fails still throws: that is the export.
 */
async function copyExportTree(src, dest, { fs = nodeFs, attempts = COPY_ATTEMPTS, pause = sleep } = {}) {
  const skipped = []
  const opts = { attempts, pause }
  async function walk(from, to) {
    let entries
    try {
      entries = await withCopyTries(() => fs.promises.readdir(from, { withFileTypes: true }), opts)
    } catch (err) {
      const rel = path.relative(src, from) || path.basename(src)
      const wrapped = new Error(copyErrorMessage(err, rel))
      wrapped.step = "copy"
      wrapped.code = err && err.code
      throw wrapped
    }
    await fs.promises.mkdir(to, { recursive: true })
    for (const ent of entries) {
      if (ent.name.startsWith(".") || ent.name === "__MACOSX") continue
      const fromChild = path.join(from, ent.name)
      const toChild = path.join(to, ent.name)
      if (ent.isDirectory()) {
        await walk(fromChild, toChild)
        continue
      }
      if (!ent.isFile()) continue
      try {
        await copyOneFile(fs, fromChild, toChild, opts)
      } catch (err) {
        const rel = path.relative(src, fromChild)
        if (isTransientCopyError(err) && isSkippableMedia(ent.name)) {
          skipped.push(rel)
          continue
        }
        const wrapped = new Error(copyErrorMessage(err, rel))
        wrapped.step = "copy"
        wrapped.code = err && err.code
        throw wrapped
      }
    }
  }
  await walk(src, dest)
  return skipped
}

/** Local folders use `cpSync` (fast). Drive, and any canceled copy, is read file by file. */
async function placeExportDir(src, dest, { fs, fromDrive, attempts, pause }) {
  if (!fromDrive) {
    try {
      fs.cpSync(src, dest, { recursive: true })
      return []
    } catch (err) {
      if (!isTransientCopyError(err)) {
        if (!err.step) err.step = "copy"
        throw err
      }
      fs.rmSync(dest, { recursive: true, force: true })
      fs.mkdirSync(dest, { recursive: true })
    }
  }
  return copyExportTree(src, dest, { fs, attempts, pause })
}

function clearPartialExports(root, fs) {
  const dir = path.join(root, "exports")
  let names = []
  try {
    names = fs.readdirSync(dir)
  } catch {
    return
  }
  for (const name of names) {
    if (String(name).endsWith(".partial")) fs.rmSync(path.join(dir, name), { recursive: true, force: true })
  }
}

/**
 * The newest export that belongs to the configured account and has not been
 * imported, and is not older than the report on screen. A copy or unzip that
 * failed is tried again after `COPY_RETRY_MS` even when the folder is unchanged.
 */
function failureStep(seen, state, key) {
  if (seen && typeof seen.step === "string") return seen.step
  const err = state && state.lastError
  if (err && err.exportName === key && typeof err.step === "string") return err.step
  return ""
}

function pickExportToImport(candidates, state, config, now = Date.now()) {
  const fresh = candidates.filter((c) => {
    if (!c.accountUnknown && !accountMatches(c.account, config.handle)) return false
    const seen = state.imported && state.imported[c.key]
    if (seen && seen.fingerprint === exportFingerprint(c)) {
      const step = failureStep(seen, state, c.key)
      const retryable = seen.ok === false && (step === "copy" || step === "unzip")
      if (!retryable || copyRetryPending({ ...seen, step }, now)) return false
    }
    if (state.current && state.current.exportDate && c.date < state.current.exportDate) return false
    return true
  })
  return fresh.length ? fresh[fresh.length - 1] : null
}

/** Remembers sizes between scans; a zip is ready once it held still for STABLE_MS. */
function createStabilityTracker(now = () => Date.now()) {
  const seen = new Map()
  return {
    isStable(c) {
      if (c.kind === "dir" && !c.fromDrive) return true
      const fp = exportFingerprint(c)
      const prev = seen.get(c.key)
      if (!prev || prev.fp !== fp) {
        seen.set(c.key, { fp, since: now() })
        return false
      }
      return now() - prev.since >= (c.fromDrive ? DRIVE_STABLE_MS : STABLE_MS)
    },
  }
}

function defaultRun(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      { maxBuffer: 64 * 1024 * 1024, timeout: RUN_TIMEOUT_MS, ...opts },
      (err, stdout, stderr) => {
        resolve({
          code: err ? (typeof err.code === "number" ? err.code : 1) : 0,
          stdout: String(stdout || ""),
          stderr: String(stderr || (err && err.message) || ""),
        })
      },
    )
  })
}

/** Finder-launched Electron has a short PATH; look in the usual places too. */
function findFfmpeg(config, { fs = nodeFs, env = process.env } = {}) {
  if (config.ffmpeg) return fs.existsSync(config.ffmpeg) ? config.ffmpeg : null
  const dirs = [
    ...String(env.PATH || "").split(path.delimiter),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/opt/anaconda3/bin",
    "/usr/bin",
  ]
  for (const d of dirs) {
    if (!d) continue
    const p = path.join(d, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg")
    if (fs.existsSync(p)) return p
  }
  return null
}

/** What the pipeline needs, and what is missing. Never throws. */
async function checkDependencies(config, { fs = nodeFs, run = defaultRun, env } = {}) {
  const out = {
    python: config.python,
    pythonFound: fs.existsSync(config.python),
    scriptsFound:
      fs.existsSync(path.join(config.scriptsDir, "analyze.py")) &&
      fs.existsSync(path.join(config.scriptsDir, "build_report.py")),
    missingModules: [],
    ffmpeg: findFfmpeg(config, { fs, env }),
  }
  if (out.pythonFound) {
    const code = `import importlib.util,json;print(json.dumps([m for m in ${JSON.stringify(
      PY_MODULES.map(([m]) => m),
    )} if importlib.util.find_spec(m) is None]))`
    const r = await run(config.python, ["-I", "-c", code])
    try {
      const missing = JSON.parse(r.stdout.trim().split("\n").pop() || "[]")
      out.missingModules = PY_MODULES.filter(([m]) => missing.includes(m)).map(([, pkg]) => pkg)
    } catch {
      out.missingModules = PY_MODULES.map(([, pkg]) => pkg)
    }
  } else {
    out.missingModules = PY_MODULES.map(([, pkg]) => pkg)
  }
  out.ok = out.pythonFound && out.scriptsFound && out.missingModules.length === 0
  return out
}

/** ig-matches as stored by the report (a JSON string of {thread path: username}). */
function matchesFromUiState(ui) {
  const raw = ui && ui["ig-matches"]
  if (typeof raw !== "string") return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
    return Object.fromEntries(Object.entries(parsed).filter(([, u]) => typeof u === "string" && u))
  } catch {
    return null
  }
}

function loadUiState(root, config, { fs = nodeFs } = {}) {
  const saved = readJson(fs, path.join(root, "ui-state.json"), {})
  const ui = {}
  for (const k of UI_STATE_KEYS) if (typeof saved[k] === "string") ui[k] = saved[k]
  // First time inside Brain2: start from the matches.json the standalone report downloaded.
  if (ui["ig-matches"] === undefined && config && fs.existsSync(config.matchesPath)) {
    const m = readJson(fs, config.matchesPath, null)
    if (m && typeof m === "object" && !Array.isArray(m)) ui["ig-matches"] = JSON.stringify(m)
  }
  return ui
}

/**
 * Save one report key. Matches are also written to matches.json so the next
 * analyze run uses them.
 */
function saveUiState(root, config, patch, { fs = nodeFs } = {}) {
  const ui = loadUiState(root, config, { fs })
  for (const [k, v] of Object.entries(patch || {})) {
    if (!UI_STATE_KEYS.includes(k)) continue
    if (v === null || v === undefined) delete ui[k]
    else if (typeof v === "string" && v.length < 5_000_000) ui[k] = v
  }
  writeJson(fs, path.join(root, "ui-state.json"), ui)
  if ("ig-matches" in (patch || {})) writeMatchesFile(config, ui, { fs })
  return ui
}

function writeMatchesFile(config, ui, { fs = nodeFs } = {}) {
  const m = matchesFromUiState(ui)
  if (!m) return false
  try {
    writeJson(fs, config.matchesPath, m)
    return true
  } catch (err) {
    console.warn("[brain2] matches.json not written:", err && err.message)
    return false
  }
}

function tail(text, n = 4000) {
  const s = String(text || "")
  return s.length > n ? s.slice(-n) : s
}

function stamp(now) {
  return new Date(now).toISOString().replace(/[:.]/g, "-")
}

/** Copy last run's thumbs so an unchanged photo is not decoded again. */
function seedThumbs(fs, fromBuild, toBuild) {
  if (!fromBuild) return
  const src = path.join(fromBuild, "thumbs")
  if (!fs.existsSync(src)) return
  try {
    fs.cpSync(src, path.join(toBuild, "thumbs"), { recursive: true })
  } catch {
    /* thumbs are rebuilt by analyze.py */
  }
}

async function extractExport(candidate, dest, config, { fs, run, attempts, pause } = {}) {
  const tmp = `${dest}.partial`
  fs.rmSync(tmp, { recursive: true, force: true })
  fs.mkdirSync(tmp, { recursive: true })
  let skipped = []
  if (candidate.kind === "dir") {
    try {
      skipped = await placeExportDir(candidate.paths[0], tmp, {
        fs,
        fromDrive: !!candidate.fromDrive,
        attempts,
        pause,
      })
    } catch (err) {
      fs.rmSync(tmp, { recursive: true, force: true })
      if (!err.step) err.step = "copy"
      throw err
    }
    if (skipped.length) {
      console.warn(
        `[brain2] instagram: ${skipped.length} file(s) stayed in Drive after retries (the export was still copied): ${skipped.slice(0, 8).join(", ")}`,
      )
    }
  } else {
    // Python's zipfile drops absolute paths and `..` parts, so a zip cannot write outside tmp.
    for (const zip of candidate.paths) {
      const r = await run(config.python, ["-I", "-m", "zipfile", "-e", zip, tmp])
      if (r.code !== 0) {
        fs.rmSync(tmp, { recursive: true, force: true })
        const err = new Error(`Could not unzip ${path.basename(zip)}.`)
        err.step = "unzip"
        err.stderr = r.stderr
        throw err
      }
    }
  }
  fs.rmSync(dest, { recursive: true, force: true })
  fs.renameSync(tmp, dest)
  return skipped
}

/** Keep the builds and exports in use, plus the newest `keepExports` exports. */
function prune(root, state, config, { fs = nodeFs } = {}) {
  const keepBuilds = new Set([state.current, state.previous].filter(Boolean).map((b) => b.buildId))
  const keepExports = new Set([state.current, state.previous].filter(Boolean).map((b) => b.exportDir))
  const exportsDir = path.join(root, "exports")
  const buildsDir = path.join(root, "builds")
  let exportNames = []
  try {
    exportNames = fs.readdirSync(exportsDir).filter((n) => !n.endsWith(".partial")).sort()
  } catch {
    /* none yet */
  }
  const keepN = Math.max(1, Number(config.keepExports) || 2)
  for (const n of exportNames.slice(-keepN)) keepExports.add(n)
  for (const n of exportNames) {
    if (!keepExports.has(n)) fs.rmSync(path.join(exportsDir, n), { recursive: true, force: true })
  }
  let buildNames = []
  try {
    buildNames = fs.readdirSync(buildsDir)
  } catch {
    /* none yet */
  }
  for (const n of buildNames) {
    if (!keepBuilds.has(n)) fs.rmSync(path.join(buildsDir, n), { recursive: true, force: true })
  }
}

/**
 * Import one export and build its report. On any failure the current report
 * stays and `state.lastError` says which step failed.
 */
async function ingestExport(candidate, { root, config, fs = nodeFs, run = defaultRun, now = () => Date.now(), env = process.env } = {}) {
  const state = loadState(root, { fs })
  const exportDirName = `${candidate.date}-${candidate.id}`
  const exportDir = path.join(root, "exports", exportDirName)
  const buildId = stamp(now())
  const buildDir = path.join(root, "builds", buildId)
  const fingerprint = exportFingerprint(candidate)
  const fail = (step, message, stderr) => {
    const s = loadState(root, { fs })
    s.lastError = { at: new Date(now()).toISOString(), step, message, stderr: tail(stderr), exportName: candidate.key }
    s.imported = { ...(s.imported || {}), [candidate.key]: { fingerprint, at: s.lastError.at, ok: false, step } }
    saveState(root, s, { fs })
    fs.rmSync(buildDir, { recursive: true, force: true })
    return { ok: false, step, message }
  }

  const deps = await checkDependencies(config, { fs, run, env })
  if (!deps.pythonFound) return fail("python", `Python not found at ${config.python}.`, "")
  if (!deps.scriptsFound) return fail("scripts", `analyze.py or build_report.py not found in ${config.scriptsDir}.`, "")
  if (deps.missingModules.length)
    return fail("python", `Python is missing: ${deps.missingModules.join(", ")}.`, `pip install ${deps.missingModules.join(" ")}`)

  const reusingCurrent = state.current && state.current.exportDir === exportDirName
  let skipped = []
  if (!reusingCurrent) {
    try {
      skipped = (await extractExport(candidate, exportDir, config, { fs, run })) || []
    } catch (err) {
      return fail(err.step || "copy", err.message || "Could not copy the export.", err.stderr || "")
    }
  }
  const exportRoot = findExportRoot(exportDir, { fs })
  if (!exportRoot) return fail("unzip", "The export has no your_instagram_activity folder. Was it requested as JSON?", "")
  if (candidate.accountUnknown) {
    const account = exportAccount(exportRoot, { fs })
    if (account && !accountMatches(account, config.handle)) {
      // Drop the copy, or archiveAll at the next start would archive it.
      if (!reusingCurrent) fs.rmSync(exportDir, { recursive: true, force: true })
      return fail("account", `This export is for @${account}, not @${String(config.handle).replace(/^@/, "")}.`, "")
    }
  }

  writeMatchesFile(config, loadUiState(root, config, { fs }), { fs })
  fs.mkdirSync(buildDir, { recursive: true })
  seedThumbs(fs, state.current && path.join(root, "builds", state.current.buildId), buildDir)

  const pyEnv = {
    PATH: env.PATH || "/usr/bin:/bin",
    HOME: env.HOME || os.homedir(),
    LANG: env.LANG || "en_US.UTF-8",
    LC_ALL: env.LC_ALL || "en_US.UTF-8",
    TZ: env.TZ || "",
    IG_OUT: buildDir,
    IG_ME: config.me,
    IG_HANDLE: config.handle,
    IG_MATCHES: config.matchesPath,
    IG_FFMPEG: deps.ffmpeg || "",
  }
  if (!pyEnv.TZ) delete pyEnv.TZ
  const opts = { cwd: config.scriptsDir, env: pyEnv }
  const a = await run(config.python, ["-I", path.join(config.scriptsDir, "analyze.py"), exportRoot], opts)
  if (a.code !== 0) return fail("analyze", "analyze.py failed.", a.stderr || a.stdout)
  const b = await run(config.python, ["-I", path.join(config.scriptsDir, "build_report.py")], opts)
  if (b.code !== 0) return fail("build", "build_report.py failed.", b.stderr || b.stdout)
  if (!fs.existsSync(path.join(buildDir, "report.html"))) return fail("build", "build_report.py wrote no report.html.", b.stdout)

  const done = loadState(root, { fs })
  const at = new Date(now()).toISOString()
  done.previous = done.current
  done.current = {
    buildId,
    exportDir: exportDirName,
    exportName: candidate.key,
    exportDate: candidate.date,
    account: candidate.account,
    builtAt: at,
    ffmpeg: !!deps.ffmpeg,
    ...(skipped.length ? { skipped: skipped.length } : {}),
  }
  done.lastError = null
  done.imported = { ...(done.imported || {}), [candidate.key]: { fingerprint, at, ok: true } }
  saveState(root, done, { fs })
  // Keep every export for good (`instagram-archive.js`) before prune drops old folders.
  try {
    await archive.archiveExport(root, { exportDir: exportDirName, exportRoot, date: candidate.date }, { fs, now })
  } catch (err) {
    console.warn("[brain2] instagram archive:", err && err.message)
  }
  try {
    prune(root, done, config, { fs })
  } catch (err) {
    console.warn("[brain2] instagram prune:", err && err.message)
  }
  return { ok: true, buildId }
}

/**
 * Absolute path for a URL path inside the current build, or null. Follows the
 * `media` symlink but never leaves the Brain2 instagram folder.
 */
function resolveReportPath(root, state, urlPath, { fs = nodeFs } = {}) {
  if (!state || !state.current) return null
  let rel
  try {
    rel = decodeURIComponent(String(urlPath || "").replace(/^\/+/, ""))
  } catch {
    return null
  }
  if (!rel) rel = "report.html"
  if (rel.includes("\0")) return null
  const buildDir = path.join(root, "builds", state.current.buildId)
  const target = path.resolve(buildDir, rel)
  if (target !== buildDir && !target.startsWith(buildDir + path.sep)) return null
  let real
  let realRoot
  try {
    real = fs.realpathSync(target)
    realRoot = fs.realpathSync(root)
  } catch {
    return null
  }
  if (!real.startsWith(realRoot + path.sep)) return null
  try {
    if (!fs.statSync(real).isFile()) return null
  } catch {
    return null
  }
  return real
}

// Frame side of the account card's Person link. Runs in the report; plain ES5.
// After the report's own `openAcct` draws a card, it adds a bar to the card's
// header (`#aact`) and talks to the parent with `{brain2Instagram:"account"}`.
const ACCOUNT_BAR = [
  'var cur=null,last=null;',
  'function send(o){o.brain2Instagram="account";try{parent.postMessage(o,"*")}catch(e){}}',
  'function el(t,text,fn){var n=document.createElement(t);if(text)n.textContent=text;if(fn)n.onclick=fn;return n}',
  'function slot(){var a=document.getElementById("aact");if(!a)return null;',
  'var b=document.getElementById("b2-person");',
  'if(!b){b=document.createElement("span");b.id="b2-person";b.style.cssText="display:inline-flex;gap:6px;align-items:center;margin-right:8px";a.insertBefore(b,a.firstChild)}return b}',
  'function draw(){var b=slot();if(!b||!cur)return;b.textContent="";var st=last&&last.handle===cur?last:null;',
  'if(!st){b.append(el("span","Person…"));return}',
  'if(st.linked){b.append(el("span","Person: "+st.linked.name),',
  'el("button","Open",function(){send({action:"open-person",personId:st.linked.id})}),',
  'el("button","Unlink",function(){send({action:"detach",handle:cur,personId:st.linked.id})}));',
  'Array.prototype.forEach.call(b.querySelectorAll("button"),function(x){x.className="btn"});return}',
  'var sel=document.createElement("select");sel.className="btn";sel.setAttribute("aria-label","Attach to Person");',
  'sel.append(new Option("Attach to Person…",""));st.people.forEach(function(p){sel.append(new Option(p.name,p.id))});',
  'var at=el("button","Attach",function(){if(sel.value)send({action:"attach",handle:cur,personId:sel.value})});',
  'var nw=el("button","New person",function(){var n="";try{n=acctName(cur)||""}catch(e){}send({action:"create",handle:cur,name:n})});',
  'at.className="btn";nw.className="btn";b.append(sel,at,nw)}',
  'function wrap(){var o=window.openAcct;if(typeof o!=="function"||o.b2)return;',
  'var w=function(u){var r=o.apply(this,arguments);cur=String(u||"");draw();send({action:"opened",handle:cur});return r};w.b2=1;window.openAcct=w}',
  'addEventListener("message",function(e){var d=e.data;if(e.source!==parent||!d||d.brain2Instagram!=="person-state")return;last=d;draw()});',
  'document.readyState==="complete"?wrap():addEventListener("load",wrap);',
].join("")

/**
 * The report HTML with a small script in front of the report's own: it seeds
 * the ig-* keys from Brain2's copy and tells the parent view when one changes.
 * It also opens one account's card when the parent asks (`open-account`, from a
 * Person's Instagram handle) and adds the Person link bar to that card
 * (`ACCOUNT_BAR`). It draws nothing else.
 */
function injectBridge(html, ui) {
  const payload = JSON.stringify(ui || {}).replace(/</g, "\\u003c")
  const script =
    `<script>/* brain2 */(function(){var s=${payload},K=${JSON.stringify(UI_STATE_KEYS)};` +
    `try{for(var k in s)localStorage.setItem(k,s[k])}catch(e){}` +
    `function tell(k,v){if(window.parent!==window)try{parent.postMessage({brain2Instagram:"state",key:k,value:v},"*")}catch(e){}}` +
    `try{K.forEach(function(k){var v=localStorage.getItem(k);if(v!==null&&!(k in s))tell(k,v)})}catch(e){}` +
    `var P=Storage.prototype,set=P.setItem,rm=P.removeItem;` +
    `P.setItem=function(k,v){set.call(this,k,v);if(this===window.localStorage&&K.indexOf(k)>=0)tell(k,String(v))};` +
    `P.removeItem=function(k){rm.call(this,k);if(this===window.localStorage&&K.indexOf(k)>=0)tell(k,null)};` +
    ACCOUNT_BAR +
    `addEventListener("message",function(e){var d=e.data;if(e.source!==parent||!d||d.brain2Instagram!=="open-account"||typeof d.handle!=="string")return;` +
    `var go=function(){if(typeof window.openAcct==="function")try{window.openAcct(d.handle)}catch(x){}};` +
    `document.readyState==="complete"?go():addEventListener("load",go)})})()</script>`
  const at = html.search(/<head[^>]*>/i)
  if (at < 0) return script + html
  const end = html.indexOf(">", at) + 1
  return html.slice(0, end) + script + html.slice(end)
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
}

function mimeFor(p) {
  return MIME[path.extname(p).toLowerCase()] || "application/octet-stream"
}

/** What the view shows. Paths stay in main; the view gets names and dates. */
function publicStatus(root, { fs = nodeFs, running = false, deps = null, config } = {}) {
  const state = loadState(root, { fs })
  const cfg = config || loadConfig(root, { fs })
  return {
    hasReport: !!(state.current && resolveReportPath(root, state, "report.html", { fs })),
    current: state.current
      ? {
          buildId: state.current.buildId,
          exportName: state.current.exportName,
          exportDate: state.current.exportDate,
          builtAt: state.current.builtAt,
          ffmpeg: state.current.ffmpeg !== false,
          ...(state.current.skipped ? { skipped: state.current.skipped } : {}),
        }
      : null,
    lastError: state.lastError,
    running,
    deps,
    watching: [cfg.downloadsDir, cfg.extraDir].filter(Boolean),
    drive: cfg.watchGoogleDrive !== false ? googleDriveDirs(undefined, { fs }) : [],
    handle: cfg.handle,
  }
}

/**
 * The Electron-side watcher: scan at start, on folder changes, and every
 * minute; one run at a time.
 */
function createInstagramWatcher({ root, fs = nodeFs, run = defaultRun, onChange = () => {}, now = () => Date.now(), env = process.env, intervalMs = 60_000, home } = {}) {
  const tracker = createStabilityTracker(now)
  // Backlog exports that failed to archive: retried hourly, or at once if they change.
  const archiveTried = new Map()
  let running = false
  let deps = null
  let watchers = []
  let timer = null
  let debounce = null
  let stopped = false

  const status = () => publicStatus(root, { fs, running, deps })

  async function refreshDeps() {
    deps = await checkDependencies(loadConfig(root, { fs }), { fs, run, env })
    return deps
  }

  /** Copy or unzip one export, archive it, and drop the copy unless the report uses it. */
  async function archiveOnly(c, config) {
    const dirName = `${c.date}-${c.id}`
    const dest = path.join(root, "exports", dirName)
    const existed = fs.existsSync(dest)
    try {
      if (!existed) await extractExport(c, dest, config, { fs, run })
      const exportRoot = findExportRoot(dest, { fs })
      const account = exportRoot && c.accountUnknown ? exportAccount(exportRoot, { fs }) : ""
      if (account && !accountMatches(account, config.handle)) console.warn(`[brain2] instagram archive ${c.key}: export is for @${account}, skipped`)
      else if (exportRoot) await archive.archiveExport(root, { exportDir: dirName, exportRoot, date: c.date }, { fs, now })
    } catch (err) {
      console.warn(`[brain2] instagram archive ${c.key}:`, err && err.message)
    } finally {
      const s = loadState(root, { fs })
      const inUse = [s.current, s.previous].some((b) => b && b.exportDir === dirName)
      if (!existed && !inUse) fs.rmSync(dest, { recursive: true, force: true })
    }
  }

  async function scan({ force = false } = {}) {
    if (running || stopped) return { ok: false, busy: running }
    // A canceled copy leaves `<date>-<id>.partial`. Nothing reads it.
    clearPartialExports(root, fs)
    const config = loadConfig(root, { fs })
    const candidates = scanForExports(watchedDirs(config, { fs, home }), { fs })
    let state = loadState(root, { fs })
    if (force && candidates.length) {
      // "Check again" retries the newest export even if it failed before.
      const newest = candidates.filter((c) => c.accountUnknown || accountMatches(c.account, config.handle)).pop()
      if (newest && state.imported[newest.key] && !state.imported[newest.key].ok) {
        delete state.imported[newest.key]
        saveState(root, state, { fs })
        state = loadState(root, { fs })
      }
    }
    const pick = pickExportToImport(candidates, state, config, now())
    // Exports the report skips (older than the one on screen, or passed over
    // while Brain2 was closed) still go into the archive.
    const backlog = candidates.filter((c) => {
      const seen = state.imported && state.imported[c.key]
      if (copyRetryPending(seen, now())) return false
      const tried = archiveTried.get(c.key)
      const due = force || !tried || tried.fp !== exportFingerprint(c) || now() - tried.at >= ARCHIVE_RETRY_MS
      return (
        c !== pick &&
        due &&
        (c.accountUnknown || accountMatches(c.account, config.handle)) &&
        !archive.isArchived(root, `${c.date}-${c.id}`, { fs })
      )
    })
    if (backlog.length && !running) {
      running = true
      try {
        for (const c of backlog) {
          if (!tracker.isStable(c)) continue
          await archiveOnly(c, config)
          archiveTried.set(c.key, { fp: exportFingerprint(c), at: now() })
        }
      } finally {
        running = false
      }
    }
    if (!pick) return { ok: true, imported: false }
    if (!tracker.isStable(pick)) {
      setTimeout(() => scan(), (pick.fromDrive ? DRIVE_STABLE_MS : STABLE_MS) + 500).unref?.()
      return { ok: true, imported: false, waiting: pick.key }
    }
    running = true
    onChange(status())
    try {
      const r = await ingestExport(pick, { root, config, fs, run, now, env })
      await refreshDeps()
      return { ...r, imported: r.ok }
    } catch (err) {
      const s = loadState(root, { fs })
      s.lastError = { at: new Date(now()).toISOString(), step: "ingest", message: String((err && err.message) || err), stderr: "", exportName: pick.key }
      saveState(root, s, { fs })
      return { ok: false, imported: false }
    } finally {
      running = false
      onChange(status())
    }
  }

  function watchDirs() {
    for (const w of watchers) w.close()
    watchers = []
    const config = loadConfig(root, { fs })
    for (const dir of watchedDirs(config, { fs, home })) {
      if (!dir) continue
      try {
        const w = fs.watch(dir, { persistent: false }, (_event, name) => {
          const n = String(name || "").toLowerCase()
          if (name && !n.startsWith("instagram-") && !n.startsWith("meta-")) return
          clearTimeout(debounce)
          debounce = setTimeout(() => scan(), 2000)
        })
        w.on("error", () => {})
        watchers.push(w)
      } catch (err) {
        console.warn(`[brain2] instagram: cannot watch ${dir}:`, err && err.message)
      }
    }
  }

  return {
    async start() {
      fs.mkdirSync(root, { recursive: true })
      await refreshDeps()
      await archive.archiveAll(root, { fs, findExportRoot, now }).catch((err) => console.warn("[brain2] instagram archive:", err && err.message))
      watchDirs()
      timer = setInterval(() => scan(), intervalMs)
      timer.unref?.()
      await scan()
    },
    stop() {
      stopped = true
      clearInterval(timer)
      clearTimeout(debounce)
      for (const w of watchers) w.close()
      watchers = []
    },
    scan,
    status,
    rewatch: watchDirs,
    refreshDeps,
  }
}

module.exports = {
  REPORT_CSP,
  COPY_RETRY_MS,
  DRIVE_STABLE_MS,
  STABLE_MS,
  copyExportTree,
  UI_STATE_KEYS,
  accountMatches,
  appDataDir,
  checkDependencies,
  createInstagramWatcher,
  createStabilityTracker,
  defaultConfig,
  defaultRoot,
  exportAccount,
  exportFingerprint,
  findExportRoot,
  findFfmpeg,
  googleDriveDirs,
  ingestExport,
  injectBridge,
  loadConfig,
  loadState,
  loadUiState,
  matchesFromUiState,
  mimeFor,
  parseExportName,
  parseMetaFolderName,
  pickExportToImport,
  publicStatus,
  resolveReportPath,
  saveConfigPatch,
  saveUiState,
  scanForExports,
  watchedDirs,
}
