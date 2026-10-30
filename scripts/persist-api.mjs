/**
 * Dev-only shared persist hub so Chrome (localhost:3000) and Electron
 * (same URL, different Chromium profile) share Zustand localStorage keys.
 *
 * The live vault is Electron Application Support/`cogs`. Chrome dumps must
 * merge through shrink guards so a 15-item seed cannot replace 2455 lists
 * items. `lib/vault-guard.js` is the shared counter.
 *
 * Tracking (`brain2-timegrid-store` / `cogs-timegrid-store`), Sleep, Lists,
 * and Habits refuse a POST that would shrink the vault to less than half
 * its records. Habits also refuse a POST whose `contentRev` is older than
 * the stored copy, so a same-sized snapshot cannot put previous titles or
 * completion values back. A Lists dump that puts 20+ items back in Inbox without that
 * many new rows is refused. Friend-pic data URLs are never stored (IndexedDB
 * holds cutouts). Incoming dumps overlay this hub's Inbox clarifications and
 * plate / hue picks. Lists / Inbox / planned-actions / plan-text keys also
 * **union by id** before shrink checks, so a stale desktop Sync cannot drop a
 * Telegram Inbox capture or Plan log entry the phone hub just wrote
 * (`removedTaskIds` keeps a real delete deleted). Dedicated Tracking day notes (`brain2-tracking-day-notes`)
 * are shrink-protected the same way; a profile that already has the key
 * keeps it instead of taking a larger historical hub map.
 * Canonical keys are `brain2-*`; `cogs-*` is a lossless alias.
 * `GET /api/persist?canon=1` sends one key per vault: the `cogs-*` twin is
 * omitted when `brain2-*` is present. The file still stores both.
 * A phone write is `POST { name, patch, source: "phone" }`. `applyVaultPatch`
 * folds that patch onto the stored blob; the result then takes the same merge
 * and recovery journal as a desktop POST. `POST { name, value, source: "phone" }`
 * is refused. Desktop `{ name, value }` is unchanged.
 * Identical values are not rewritten, so a poll tick cannot bump the file mtime.
 * Empty plan-text values (`monthPlan-*` / `weekPlan-*` / `dayPlan-*` as `""`)
 * are deleted, not stored — they re-seeded a blank Month Plan on refresh.
 *
 * GET `/api/recovery-backups` is read-only listing of `data/recovery-backups/`
 * when that folder already exists. It never mkdir, never writes persist.
 *
 * Append-only logs (Tracking, Sleep, Reviews, Metrics, Points, Regret) only
 * *grow* in this file: `mergeIntoHub` refuses a write with fewer rows than the
 * stored copy. Reads are untouched, so deleting a block in the app still
 * sticks — the shared file just keeps the superset.
 *
 * Writes that *lose* records journal the previous copy into that folder as
 * `auto-<vault>-<hour>.json`, in the Settings → Restore shape: one file per
 * vault per hour, newest 12 kept, hand-made files never pruned. The guard only
 * sees a wipe at half the vault, but the day of tracking that went missing was
 * a 3% drop — an append-only log journals on *any* loss, a curated vault at
 * 10%. Whatever the merge decides, the older copy stays restorable.
 */
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { guardBrowserOrigin } from "../lib/ingest/request-origin.mjs"
import { applyVaultPatch } from "../lib/vault-guard.js"
import { readBody } from "./local-api-json.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const {
  vaultRecordCount,
  shouldRejectVaultShrink,
  mergePersistSnapshots,
  isAppendOnlyVault,
  shouldRejectHubLogShrink,
} = require("../lib/vault-guard.js")

/** The stored copy, unless the incoming write is a legitimate step forward. */
function mergeIntoHub(existing, value, name) {
  if (shouldRejectHubLogShrink(name, value, existing)) return existing
  return mergePersistSnapshots(existing, value, name)
}

export { vaultRecordCount, shouldRejectVaultShrink, mergePersistSnapshots }

const ROOT = path.resolve(__dirname, "..")
const DEFAULT_DATA_FILE = path.join(ROOT, "data", "shared-persist.json")
const RECOVERY_DIR = path.join(ROOT, "data", "recovery-backups")
const SAFE_RECOVERY_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*\.json$/

/** Debounce for the disk write. The in-memory copy is always current. */
const DEFAULT_FLUSH_MS = 1000

/**
 * The hub vault lives in memory. The file is read once (and again only if another
 * process changed it), writes are debounced and atomic, and exit flushes.
 *
 * In memory each vault is stored once, under its `brain2-*` name (`items`). On
 * disk, and on a normal GET, both `brain2-*` and `cogs-*` are still emitted:
 * the Electron preload, `lib/persist-storage.ts` and the phone hub look keys up
 * by either name, and an old file with twin keys must keep loading. Reads expand
 * the one copy back to both names. `?canon=1` drops the `cogs-*` twin on the
 * wire only. If a twin pair ever disagrees on disk, the `brain2-*` copy wins,
 * as it already did for every merge.
 */
const hub = {
  file: DEFAULT_DATA_FILE,
  flushMs: DEFAULT_FLUSH_MS,
  loaded: false,
  updatedAt: null,
  source: null,
  /** canonical key -> value */
  items: {},
  /** Canonical keys changed since the last successful write. */
  dirty: new Set(),
  version: 0,
  /** mtimeMs:size of the file as we last read or wrote it. */
  sig: null,
  timer: null,
  flushing: null,
  syncGen: 0,
  tmpSeq: 0,
  hooked: false,
}

export function sharedPersistPath() {
  return hub.file
}

function ensureDataDir() {
  const dir = path.dirname(hub.file)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function stripFriendPicItems(items) {
  if (!items || typeof items !== "object") return {}
  const next = { ...items }
  for (const key of Object.keys(next)) {
    if (key.includes("friend-pic:")) delete next[key]
  }
  return next
}

/** `cogs-x` and `brain2-x` are one vault; the canonical name is `brain2-x`. */
function canonKey(name) {
  if (typeof name !== "string") return name
  if (name.startsWith("cogs-")) return "brain2-" + name.slice(5)
  return name
}

/** One copy per vault. `brain2-*` beats a `cogs-*` twin that disagrees. */
function collapseAliases(items) {
  const out = {}
  for (const key of Object.keys(items)) {
    if (!key.startsWith("cogs-")) out[key] = items[key]
  }
  for (const key of Object.keys(items)) {
    if (!key.startsWith("cogs-")) continue
    const ck = canonKey(key)
    if (!(ck in out)) out[ck] = items[key]
  }
  return out
}

/** Both names for every vault: the shape on disk and on a normal GET. */
function expandAliases(items) {
  const out = {}
  for (const key of Object.keys(items)) {
    out[key] = items[key]
    if (key.startsWith("brain2-")) out["cogs-" + key.slice(7)] = items[key]
  }
  return out
}

/** `?canon=1` wire shape. One key per vault; disk still stores both aliases. */
function omitCogsTwins(items) {
  const out = {}
  for (const key of Object.keys(items)) {
    if (key.startsWith("cogs-") && Object.prototype.hasOwnProperty.call(items, "brain2-" + key.slice(5))) continue
    out[key] = items[key]
  }
  return out
}

function persistQuery(req) {
  const raw = typeof req?.url === "string" ? req.url : ""
  const q = raw.indexOf("?")
  if (q < 0) return new URLSearchParams()
  return new URLSearchParams(raw.slice(q + 1))
}

function fileSig() {
  try {
    const st = fs.statSync(hub.file)
    return `${st.mtimeMs}:${st.size}`
  } catch {
    return null
  }
}

function parseDisk() {
  try {
    const parsed = JSON.parse(fs.readFileSync(hub.file, "utf8"))
    return {
      updatedAt: parsed.updatedAt ?? null,
      source: parsed.source ?? null,
      items: collapseAliases(stripFriendPicItems(parsed.items && typeof parsed.items === "object" ? parsed.items : {})),
    }
  } catch {
    return { updatedAt: null, source: null, items: {} }
  }
}

/**
 * Bring memory up to date with the file. Reads the file only when it is not
 * loaded yet or another process (phone hub, Chrome dump) changed it. Unwritten
 * local changes are re-applied through the merge guards on top of the disk copy.
 */
function syncFromDisk() {
  ensureDataDir()
  const sig = fileSig()
  if (hub.loaded && sig === hub.sig) return
  if (hub.loaded && sig === null) return // file removed under us: keep memory, next flush recreates it
  const disk = sig === null ? { updatedAt: null, source: null, items: {} } : parseDisk()
  if (hub.loaded && hub.dirty.size) {
    for (const key of hub.dirty) {
      const ours = hub.items[key]
      if (typeof ours !== "string") {
        delete disk.items[key]
        continue
      }
      const theirs = disk.items[key]
      if (typeof theirs === "string" && theirs !== ours) {
        const merged = mergeIntoHub(theirs, ours, key)
        disk.items[key] = typeof merged === "string" ? merged : ours
      } else {
        disk.items[key] = ours
      }
    }
    hub.updatedAt = new Date().toISOString()
  } else {
    hub.updatedAt = disk.updatedAt
    hub.source = disk.source
  }
  hub.items = disk.items
  hub.loaded = true
  hub.sig = sig
}

function serialize() {
  return JSON.stringify({ updatedAt: hub.updatedAt, source: hub.source ?? "hub", items: expandAliases(hub.items) })
}

function hubTmpPath() {
  return `${hub.file}.${process.pid}.${++hub.tmpSeq}.tmp`
}

function clearTimer() {
  if (hub.timer) {
    clearTimeout(hub.timer)
    hub.timer = null
  }
}

/** Write the file now, synchronously. For exit, signals, and the legacy `writeSharedPersist`. */
export function flushSharedPersistSync() {
  clearTimer()
  if (!hub.loaded || !hub.dirty.size) return false
  try {
    syncFromDisk()
    ensureDataDir()
    const tmp = hubTmpPath()
    hub.syncGen++
    fs.writeFileSync(tmp, serialize(), "utf8")
    fs.renameSync(tmp, hub.file)
    hub.dirty.clear()
    hub.sig = fileSig()
    return true
  } catch {
    return false
  }
}

/** Debounced async write: temp file + atomic rename. Resolves when the file is current. */
export function flushSharedPersist() {
  clearTimer()
  if (hub.flushing) return hub.flushing
  const run = (async () => {
    if (!hub.loaded || !hub.dirty.size) return
    syncFromDisk()
    const version = hub.version
    const gen = hub.syncGen
    const tmp = hubTmpPath()
    try {
      await fs.promises.writeFile(tmp, serialize(), "utf8")
      if (gen !== hub.syncGen) {
        // A sync flush (exit) wrote a newer copy meanwhile; do not rename an older one over it.
        await fs.promises.rm(tmp, { force: true })
        return
      }
      await fs.promises.rename(tmp, hub.file)
    } catch {
      await fs.promises.rm(tmp, { force: true }).catch(() => {})
      return // dirty keys stay; rescheduled below
    }
    hub.sig = fileSig()
    if (version === hub.version) hub.dirty.clear()
  })()
  // Clear after the promise settles (an async body with no await would otherwise clear first).
  // Anything still dirty (failed write, or edits made mid-write) gets the next debounce window.
  const tracked = run.finally(() => {
    if (hub.flushing === tracked) hub.flushing = null
    if (hub.dirty.size) scheduleFlush()
  })
  hub.flushing = tracked
  return tracked
}

function onProcessSignal(signal) {
  flushSharedPersistSync()
  // Only we listen: restore the default "die on signal" we suppressed.
  if (process.listenerCount(signal) <= 1) process.exit(128 + (signal === "SIGINT" ? 2 : signal === "SIGHUP" ? 1 : 15))
}

function hookProcessExit() {
  if (hub.hooked) return
  hub.hooked = true
  process.on("exit", flushSharedPersistSync)
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => onProcessSignal(signal))
}

function scheduleFlush() {
  hookProcessExit()
  if (hub.timer || hub.flushing) return
  hub.timer = setTimeout(() => {
    hub.timer = null
    void flushSharedPersist()
  }, hub.flushMs)
  hub.timer.unref?.()
}

function touch(key, source) {
  hub.dirty.add(key)
  hub.version++
  hub.updatedAt = new Date().toISOString()
  hub.source = source ?? hub.source ?? "hub"
  scheduleFlush()
}

function expandedKeyCount() {
  const keys = Object.keys(hub.items)
  return keys.length + keys.filter((k) => k.startsWith("brain2-")).length
}

/** Result of a read or write: lazy `items` so a POST does not expand 12 MB it never uses. */
function view(extra) {
  return {
    updatedAt: hub.updatedAt,
    source: hub.source,
    keyCount: expandedKeyCount(),
    get items() {
      return expandAliases(hub.items)
    },
    ...extra,
  }
}

export function readSharedPersist() {
  syncFromDisk()
  return { updatedAt: hub.updatedAt, source: hub.source, items: expandAliases(hub.items) }
}

/** Replace the whole hub copy and write it now. Kept for scripts; the API paths use the merge functions. */
export function writeSharedPersist(next) {
  syncFromDisk()
  const items = collapseAliases(stripFriendPicItems(next.items && typeof next.items === "object" ? next.items : {}))
  hub.items = items
  hub.dirty = new Set(Object.keys(items))
  hub.version++
  hub.updatedAt = new Date().toISOString()
  hub.source = next.source ?? hub.source ?? "hub"
  flushSharedPersistSync()
  return { updatedAt: hub.updatedAt, source: hub.source, items: expandAliases(hub.items) }
}

/** Test hook: point the hub at another file, drop the in-memory copy. */
export function _resetSharedPersistForTests(file = DEFAULT_DATA_FILE, opts = {}) {
  clearTimer()
  hub.file = file
  hub.flushMs = opts.flushMs ?? DEFAULT_FLUSH_MS
  hub.loaded = false
  hub.updatedAt = null
  hub.source = null
  hub.items = {}
  hub.dirty = new Set()
  hub.sig = null
}

function isFriendPicPersistName(name) {
  return typeof name === "string" && name.includes("friend-pic:")
}

function isPlanTextPersistName(name) {
  const bare = name.startsWith("brain2-") ? name.slice(7) : name.startsWith("cogs-") ? name.slice(5) : name
  return /^(day|week|month)Plan-/.test(bare)
}

function existingVaultItem(name) {
  const v = hub.items[canonKey(name)]
  return typeof v === "string" ? v : undefined
}

/** Set or drop one vault in memory. Returns true when the stored copy changed. */
function writeVaultItem(name, value, source) {
  const key = canonKey(name)
  if (isFriendPicPersistName(name) || (isPlanTextPersistName(name) && typeof value === "string" && value === "")) {
    if (!(key in hub.items)) return false
    delete hub.items[key]
    touch(key, source)
    return true
  }
  if (hub.items[key] === value) return false
  hub.items[key] = value
  touch(key, source)
  return true
}

export function mergeSharedPersistItems(incoming, source) {
  syncFromDisk()
  let skipped = 0
  for (const [name, value] of Object.entries(incoming || {})) {
    if (typeof name !== "string" || typeof value !== "string") continue
    if (isFriendPicPersistName(name)) {
      writeVaultItem(name, value, source)
      skipped++
      continue
    }
    const existing = existingVaultItem(name)
    const merged = mergeIntoHub(existing, value, name)
    if (typeof merged !== "string") {
      skipped++
      continue
    }
    if (existing === value) {
      writeVaultItem(name, merged, source)
      continue
    }
    if (merged === existing && existing !== value) {
      journalVaultDrop(name, existing, value, true)
      skipped++
      continue
    }
    journalVaultDrop(name, existing, merged, false)
    writeVaultItem(name, merged, source)
  }
  return view({ skipped })
}

export function upsertSharedPersistItem(name, value, source) {
  syncFromDisk()
  if (isFriendPicPersistName(name)) {
    writeVaultItem(name, value, source)
    return view({ skipped: "friend-pic" })
  }
  const existing = existingVaultItem(name)
  const merged = mergeIntoHub(existing, value, name)
  if (typeof merged !== "string") {
    return view({ skipped: "empty" })
  }
  if (existing === value) {
    writeVaultItem(name, merged, source)
    return view()
  }
  if (merged === existing && existing !== value) {
    journalVaultDrop(name, existing, value, true)
    return view({ skipped: "shrink" })
  }
  journalVaultDrop(name, existing, merged, false)
  writeVaultItem(name, merged, source)
  return view()
}

function phonePatchReason(result) {
  if (result && typeof result.reason === "string" && result.reason) return result.reason
  if (result && typeof result.error === "string" && result.error) return result.error
  return "patch refused"
}

function rejectPhoneWrite(res, reason) {
  sendJson(res, 409, { ok: false, error: reason, reason })
}

/**
 * Phone saves are a patch, then the same merge a desktop POST uses.
 * A whole-store body is refused before that merge, so it cannot write.
 */
function handlePhonePersistPost(res, body) {
  if (Object.prototype.hasOwnProperty.call(body, "value")) {
    rejectPhoneWrite(res, "phone whole-store write refused")
    return
  }
  if (typeof body.name !== "string" || !body.patch || typeof body.patch !== "object" || Array.isArray(body.patch)) {
    sendJson(res, 400, { ok: false, error: "Expected { name, patch }" })
    return
  }
  syncFromDisk()
  const storedJson = existingVaultItem(body.name)
  let result
  try {
    result = applyVaultPatch(body.name, storedJson, body.patch)
  } catch (err) {
    rejectPhoneWrite(res, err instanceof Error ? err.message : "patch refused")
    return
  }
  if (!result || result.ok !== true || typeof result.value !== "string") {
    rejectPhoneWrite(res, phonePatchReason(result))
    return
  }
  const stored = upsertSharedPersistItem(body.name, result.value, body.source)
  sendJson(res, 200, {
    ok: true,
    skipped: stored.skipped ?? false,
    updatedAt: stored.updatedAt,
  })
}

function sendJson(res, status, body) {
  const json = JSON.stringify(body)
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(json),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  })
  res.end(json)
}

/** Newest auto snapshots kept. Hand-made files in the folder are never pruned. */
const AUTO_RECOVERY_KEEP = 12
const AUTO_RECOVERY_PREFIX = "auto-"

/** One file per vault per hour: the first copy of the hour is the pre-damage one. */
function autoRecoveryName(name, at) {
  const hour = at.toISOString().slice(0, 13).replace(/[:T]/g, "-")
  const vault = String(name).replace(/[^A-Za-z0-9._-]/g, "-")
  return `${AUTO_RECOVERY_PREFIX}${vault}-${hour}.json`
}

function pruneAutoRecoveryBackups(dir, keep = AUTO_RECOVERY_KEEP) {
  const files = fs
    .readdirSync(dir)
    .filter((n) => n.startsWith(AUTO_RECOVERY_PREFIX) && n.endsWith(".json"))
    .map((n) => ({ n, at: fs.statSync(path.join(dir, n)).mtimeMs }))
    .sort((a, b) => b.at - a.at)
  for (const stale of files.slice(keep)) fs.rmSync(path.join(dir, stale.n), { force: true })
}

/**
 * Keep the copy we are about to lose. Written in the Settings → Restore shape,
 * so a vault that shrank — or that something tried to wipe — is one click back
 * even when the guard's verdict was wrong. Best-effort: a hub write must never
 * fail because the journal could not be written.
 */
export function journalVaultSnapshot(name, previous, reason, dir = RECOVERY_DIR) {
  if (typeof previous !== "string" || !previous) return null
  try {
    fs.mkdirSync(dir, { recursive: true })
    const at = new Date()
    const file = safeRecoveryBackupPath(autoRecoveryName(name, at), dir)
    if (!file) return null
    if (fs.existsSync(file)) return file
    const body = { app: "brain2", exportedAt: at.toISOString(), reason, vault: name, stores: { [name]: previous } }
    fs.writeFileSync(file, JSON.stringify(body), "utf8")
    pruneAutoRecoveryBackups(dir)
    return file
  } catch {
    return null
  }
}

/**
 * `"refused"` — a write was turned away, so something out there holds a thin
 * copy of this vault. `"shrunk"` — the write went through but took records with
 * it. Either way the hub's current copy is worth keeping.
 */
export function vaultDropReason(name, existing, incoming, refused) {
  if (typeof existing !== "string" || !existing) return null
  const prev = vaultRecordCount(name, existing)
  if (prev == null || prev < 2) return null
  if (refused) return "refused"
  const next = vaultRecordCount(name, incoming)
  if (next == null) return null
  // A log only accumulates, so *any* loss is worth a copy — the day of tracking
  // that went missing was a 3% drop, nowhere near the shrink guard. A curated
  // vault loses rows on purpose, so only a real bite is journaled.
  const floor = isAppendOnlyVault(name) ? prev : prev * 0.9
  return next < floor ? "shrunk" : null
}

function journalVaultDrop(name, existing, incoming, refused) {
  const reason = vaultDropReason(name, existing, incoming, refused)
  if (reason) journalVaultSnapshot(name, existing, reason)
}

/** Safe filename only — never creates the folder, never writes a snapshot. */
export function safeRecoveryBackupPath(name, dir = RECOVERY_DIR) {
  if (typeof name !== "string" || !SAFE_RECOVERY_NAME.test(name) || name.includes("..")) return null
  const root = path.resolve(dir)
  const resolved = path.resolve(root, name)
  const prefix = root.endsWith(path.sep) ? root : root + path.sep
  if (!resolved.startsWith(prefix)) return null
  return resolved
}

function summarizeRecoveryJson(name, raw, bytes) {
  try {
    const data = JSON.parse(raw)
    if (data.app !== "brain2" && data.app !== "cogs") return null
    if (!data.stores || typeof data.stores !== "object") return null
    return {
      name,
      exportedAt: typeof data.exportedAt === "string" ? data.exportedAt : null,
      storeKeys: Object.keys(data.stores).sort(),
      planTextKeys: data.planText && typeof data.planText === "object" ? Object.keys(data.planText).length : 0,
      bytes,
    }
  } catch {
    return null
  }
}

/** Read-only listing. Does not mkdir. Missing dir → `{ exists: false }`. */
export function listRecoveryBackupsFromDir(dir = RECOVERY_DIR) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    return { exists: false, backups: [] }
  }
  const backups = []
  for (const name of fs.readdirSync(dir)) {
    const file = safeRecoveryBackupPath(name, dir)
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) continue
    const raw = fs.readFileSync(file, "utf8")
    const info = summarizeRecoveryJson(name, raw, Buffer.byteLength(raw))
    if (info) backups.push(info)
  }
  backups.sort((a, b) => String(b.exportedAt ?? "").localeCompare(String(a.exportedAt ?? "")))
  return { exists: true, backups }
}

function handleRecoveryBackupsApi(req, res, pathname) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Accept",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    })
    res.end()
    return true
  }
  if (req.method !== "GET") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" })
    return true
  }
  if (pathname === "/api/recovery-backups" || pathname === "/api/recovery-backups/") {
    sendJson(res, 200, { ok: true, ...listRecoveryBackupsFromDir() })
    return true
  }
  const name = decodeURIComponent(pathname.slice("/api/recovery-backups/".length))
  const file = safeRecoveryBackupPath(name)
  if (!file || !fs.existsSync(file)) {
    sendJson(res, 404, { ok: false, error: "Recovery backup not found" })
    return true
  }
  const raw = fs.readFileSync(file, "utf8")
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(raw),
    "Access-Control-Allow-Origin": "*",
  })
  res.end(raw)
  return true
}

/** @returns {Promise<boolean>} true if handled */
export async function handlePersistApi(req, res, pathname) {
  const recovery = pathname === "/api/recovery-backups" || pathname.startsWith("/api/recovery-backups/")
  const persist = pathname === "/api/persist" || pathname === "/api/persist/health"
  if (!recovery && !persist) return false
  if (!guardBrowserOrigin(req, res)) return true
  if (recovery) return handleRecoveryBackupsApi(req, res, pathname)
  if (pathname !== "/api/persist" && pathname !== "/api/persist/health") return false

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    })
    res.end()
    return true
  }

  if (pathname === "/api/persist/health" && req.method === "GET") {
    syncFromDisk()
    const store = view()
    sendJson(res, 200, {
      ok: true,
      keyCount: store.keyCount,
      updatedAt: store.updatedAt,
      source: store.source,
    })
    return true
  }

  if (req.method === "GET") {
    const stored = readSharedPersist()
    if (persistQuery(req).get("canon") === "1") stored.items = omitCogsTwins(stored.items)
    sendJson(res, 200, { ok: true, ...stored })
    return true
  }

  if (req.method === "PUT") {
    try {
      const body = JSON.parse((await readBody(req)) || "{}")
      if (!body.items || typeof body.items !== "object") {
        sendJson(res, 400, { ok: false, error: "Expected { items }" })
        return true
      }
      const stored = mergeSharedPersistItems(body.items, body.source ?? "put")
      sendJson(res, 200, {
        ok: true,
        updatedAt: stored.updatedAt,
        keyCount: stored.keyCount,
        skipped: stored.skipped,
      })
    } catch (err) {
      sendJson(res, 400, { ok: false, error: err instanceof Error ? err.message : "Invalid JSON" })
    }
    return true
  }

  if (req.method === "POST") {
    let body
    try {
      body = JSON.parse((await readBody(req)) || "{}")
    } catch (err) {
      sendJson(res, 400, { ok: false, error: err instanceof Error ? err.message : "Invalid JSON" })
      return true
    }
    if (body && body.source === "phone") {
      handlePhonePersistPost(res, body)
      return true
    }
    try {
      if (typeof body.name !== "string" || typeof body.value !== "string") {
        sendJson(res, 400, { ok: false, error: "Expected { name, value }" })
        return true
      }
      const stored = upsertSharedPersistItem(body.name, body.value, body.source)
      sendJson(res, 200, {
        ok: true,
        skipped: stored.skipped ?? false,
        updatedAt: stored.updatedAt,
      })
    } catch (err) {
      sendJson(res, 400, { ok: false, error: err instanceof Error ? err.message : "Invalid JSON" })
    }
    return true
  }

  sendJson(res, 405, { ok: false, error: "Method not allowed" })
  return true
}
