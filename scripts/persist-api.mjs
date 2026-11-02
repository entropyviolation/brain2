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
 * `GET /api/persist/rows?since=<seq>` reads the task vault as rows with a change
 * cursor (`scripts/row-store.mjs`, a derived SQLite mirror; the blob stays the
 * source of truth). `docs/ORACLE_INTERIM_SYNC.md` → Row store.
 *
 * Storage: `BRAIN2_STORE=json|shadow|sqlite` (`scripts/vault-store.mjs`). Default
 * `shadow`: this JSON file is the truth and a SQLite copy follows it. `sqlite`:
 * SQLite is the truth and this file is a periodic export. Stage 4a in
 * `docs/ORACLE_INTERIM_SYNC.md`.
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
import zlib from "node:zlib"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { guardBrowserOrigin } from "../lib/ingest/request-origin.mjs"
import { applyVaultPatch } from "../lib/vault-guard.js"
import { readBody } from "./local-api-json.mjs"
import { openVaultStore, closeVaultStore, loadAll, writeKeys, replaceAll, storeRev, storeIsEmpty } from "./vault-store.mjs"
import { TASK_VAULT, openRowStore, closeRowStore, mirrorTaskVault, changesSince, rowOrder, patchApplied, recordPatch, rowSeqs } from "./row-store.mjs"

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
const BIM_FLOW_RUNS_DIR = path.join(ROOT, "data", "bim-flow-runs")
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
  /** Like `updatedAt` / `source`, but heartbeat keys do not move it, so a watcher pulls only for data. */
  contentAt: null,
  contentSource: null,
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
  /** Row mirror (`scripts/row-store.mjs`). Derived from the blob; off with BRAIN2_ROW_MIRROR=0. */
  rowMirror: process.env.BRAIN2_ROW_MIRROR !== "0",
  rows: null,
  /**
   * Vault store (`scripts/vault-store.mjs`). `json`: the file only. `shadow`
   * (default): the file is the truth and SQLite is kept in step and checked.
   * `sqlite`: SQLite is the truth and the file is an export.
   */
  storeMode: initialStoreMode(),
  vaults: null,
  seeded: false,
  exportTimer: null,
  exportDirty: false,
  replaceAllNext: false,
  shadow: { checked: 0, fixed: 0, lastAt: null, error: null },
}

function initialStoreMode() {
  const v = String(process.env.BRAIN2_STORE || "").toLowerCase()
  return v === "json" || v === "sqlite" ? v : "shadow"
}

/** How long a changed vault waits before the JSON export is rewritten (sqlite mode). */
const EXPORT_MS = Number(process.env.BRAIN2_EXPORT_MS) > 0 ? Number(process.env.BRAIN2_EXPORT_MS) : 5000

/** The vault store's handle, opened on first use. Null in json mode. A failure drops to json mode: the file stays the truth. */
function vaultStore() {
  if (hub.storeMode === "json") return null
  if (hub.vaults) return hub.vaults
  try {
    hub.vaults = openVaultStore(`${hub.file}.vaults.sqlite`)
  } catch (err) {
    if (hub.storeMode === "sqlite") console.error("[persist-api] vault store did not open; using the JSON file:", err)
    hub.storeMode = "json"
  }
  return hub.vaults
}

function stamps() {
  return { updatedAt: hub.updatedAt, source: hub.source, contentAt: hub.contentAt, contentSource: hub.contentSource }
}

/** The mirror's SQLite handle, opened on first use. Null when disabled or it cannot open. */
function rowStore() {
  if (!hub.rowMirror) return null
  if (hub.rows) return hub.rows
  try {
    hub.rows = openRowStore(`${hub.file}.rows.sqlite`)
  } catch {
    hub.rowMirror = false
  }
  return hub.rows
}

/** Copy the task vault into rows. Never throws: the JSON file is what matters. */
function mirrorRows() {
  const store = rowStore()
  if (!store) return false
  try {
    const blob = hub.items[TASK_VAULT]
    if (typeof blob === "string") mirrorTaskVault(store, blob)
    return true
  } catch {
    return false
  }
}

function mirrorRowsSoon(keys) {
  if (!hub.rowMirror || !keys.includes(TASK_VAULT)) return
  const timer = setImmediate(mirrorRows)
  timer.unref?.()
}

export { expandAliases, collapseAliases, stripFriendPicItems }

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
  if (hub.storeMode === "sqlite") {
    const store = vaultStore()
    if (store) return `rev:${storeRev(store)}`
  }
  try {
    const st = fs.statSync(hub.file)
    return `${st.mtimeMs}:${st.size}`
  } catch {
    return null
  }
}

function parseDisk() {
  if (hub.storeMode === "sqlite") {
    const store = vaultStore()
    if (store) {
      const all = loadAll(store)
      return { ...all, items: collapseAliases(stripFriendPicItems(all.items)) }
    }
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(hub.file, "utf8"))
    return {
      updatedAt: parsed.updatedAt ?? null,
      source: parsed.source ?? null,
      contentAt: parsed.contentAt ?? null,
      contentSource: parsed.contentSource ?? null,
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
  seedVaultStore()
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
    if (disk.contentAt && (!hub.contentAt || disk.contentAt > hub.contentAt)) {
      hub.contentAt = disk.contentAt
      hub.contentSource = disk.contentSource
    }
  } else {
    hub.updatedAt = disk.updatedAt
    hub.source = disk.source
    hub.contentAt = disk.contentAt
    hub.contentSource = disk.contentSource
  }
  hub.items = disk.items
  hub.loaded = true
  hub.sig = sig
  shadowReconcile()
}

/** First run in sqlite mode: fill an empty store from the JSON file. The file is never deleted. */
function seedVaultStore() {
  if (hub.seeded || hub.storeMode !== "sqlite") return
  const store = vaultStore()
  if (!store || hub.storeMode !== "sqlite") return
  hub.seeded = true
  if (!storeIsEmpty(store) || fileSigOfJson() === null) return
  const disk = readJsonFile()
  replaceAll(store, collapseAliases(stripFriendPicItems(disk.items)), stamps2(disk))
}

function stamps2(disk) {
  return { updatedAt: disk.updatedAt, source: disk.source, contentAt: disk.contentAt, contentSource: disk.contentSource }
}

function fileSigOfJson() {
  try {
    const st = fs.statSync(hub.file)
    return `${st.mtimeMs}:${st.size}`
  } catch {
    return null
  }
}

function readJsonFile() {
  try {
    const parsed = JSON.parse(fs.readFileSync(hub.file, "utf8"))
    return {
      updatedAt: parsed.updatedAt ?? null,
      source: parsed.source ?? null,
      contentAt: parsed.contentAt ?? null,
      contentSource: parsed.contentSource ?? null,
      items: parsed.items && typeof parsed.items === "object" ? parsed.items : {},
    }
  } catch {
    return { updatedAt: null, source: null, contentAt: null, contentSource: null, items: {} }
  }
}

/**
 * Shadow mode: after the hub reads the file, make the store match it and count
 * what had drifted. Never throws; the file is the truth here.
 */
function shadowReconcile() {
  if (hub.storeMode !== "shadow") return
  const store = vaultStore()
  if (!store) return
  try {
    const diff = replaceAll(store, hub.items, stamps())
    hub.shadow.checked++
    hub.shadow.fixed += diff.missing.length + diff.differing.length + diff.extra.length
    hub.shadow.lastAt = new Date().toISOString()
    hub.shadow.error = null
  } catch (err) {
    hub.shadow.error = err instanceof Error ? err.message : String(err)
  }
}

/** After a file write in shadow mode: the keys just written go to the store too. */
function shadowWrite(keys) {
  if (hub.storeMode !== "shadow" || !keys.length) return
  const store = vaultStore()
  if (!store) return
  try {
    writeKeys(store, hub.items, keys, stamps())
    hub.shadow.error = null
  } catch (err) {
    hub.shadow.error = err instanceof Error ? err.message : String(err)
  }
}

/**
 * sqlite mode: commit the dirty keys in one transaction. False when the store
 * would not take them (they stay dirty and retry). Schedules the JSON export.
 */
function commitToStore() {
  const store = vaultStore()
  if (!store || hub.storeMode !== "sqlite") return false
  try {
    syncFromDisk()
    if (hub.replaceAllNext) {
      replaceAll(store, hub.items, stamps())
      hub.replaceAllNext = false
    } else if (hub.dirty.size) {
      writeKeys(store, hub.items, [...hub.dirty], stamps())
    }
    if (hub.dirty.size || hub.exportDirty) {
      hub.exportDirty = true
      scheduleExport()
    }
    hub.dirty.clear()
    hub.sig = fileSig()
    return true
  } catch (err) {
    console.error("[persist-api] vault store write failed; will retry:", err)
    return false
  }
}

/** sqlite mode: rewrite the JSON file for the readers that still open it. */
export function exportJsonSync() {
  if (hub.exportTimer) {
    clearTimeout(hub.exportTimer)
    hub.exportTimer = null
  }
  if (!hub.loaded || !hub.exportDirty) return false
  try {
    ensureDataDir()
    const tmp = hubTmpPath()
    fs.writeFileSync(tmp, serialize(), "utf8")
    fs.renameSync(tmp, hub.file)
    hub.exportDirty = false
    return true
  } catch {
    return false
  }
}

function scheduleExport() {
  hookProcessExit()
  if (hub.exportTimer) return
  hub.exportTimer = setTimeout(() => {
    hub.exportTimer = null
    exportJsonSync()
    if (hub.exportDirty) scheduleExport()
  }, EXPORT_MS)
  hub.exportTimer.unref?.()
}

function serialize() {
  return JSON.stringify({
    updatedAt: hub.updatedAt,
    source: hub.source ?? "hub",
    contentAt: hub.contentAt,
    contentSource: hub.contentSource,
    items: expandAliases(hub.items),
  })
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
  if (hub.storeMode === "sqlite" && hub.loaded) {
    const ok = hub.dirty.size || hub.replaceAllNext ? commitToStore() : true
    if (hub.exportDirty) exportJsonSync()
    return ok
  }
  if (!hub.loaded || !hub.dirty.size) return false
  const written = [...hub.dirty]
  try {
    syncFromDisk()
    ensureDataDir()
    const tmp = hubTmpPath()
    hub.syncGen++
    fs.writeFileSync(tmp, serialize(), "utf8")
    fs.renameSync(tmp, hub.file)
    hub.dirty.clear()
    hub.sig = fileSig()
    shadowWrite(written)
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
    if (hub.storeMode === "sqlite") {
      if (hub.loaded && (hub.dirty.size || hub.replaceAllNext)) {
        const keys = [...hub.dirty]
        if (commitToStore()) mirrorRowsSoon(keys)
      }
      return
    }
    if (!hub.loaded || !hub.dirty.size) return
    syncFromDisk()
    const version = hub.version
    const gen = hub.syncGen
    const flushed = [...hub.dirty]
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
    shadowWrite(flushed)
    mirrorRowsSoon(flushed)
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
  process.on("exit", () => {
    flushSharedPersistSync()
    exportJsonSync()
  })
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
  if (!isHeartbeatKey(key)) {
    hub.contentAt = hub.updatedAt
    hub.contentSource = hub.source
  }
  scheduleFlush()
}

/** Stamps a writer refreshes on its own; they say nothing changed in the vault. */
function isHeartbeatKey(key) {
  return typeof key === "string" && key.endsWith("last-persist-ok")
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
  hub.replaceAllNext = true
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
  if (hub.rows) closeRowStore(hub.rows)
  hub.rows = null
  hub.rowMirror = opts.rowMirror === true
  if (hub.exportTimer) clearTimeout(hub.exportTimer)
  hub.exportTimer = null
  if (hub.vaults) closeVaultStore(hub.vaults)
  hub.vaults = null
  hub.storeMode = opts.store === "shadow" || opts.store === "sqlite" ? opts.store : "json"
  hub.seeded = false
  hub.exportDirty = false
  hub.replaceAllNext = false
  hub.shadow = { checked: 0, fixed: 0, lastAt: null, error: null }
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
  const patchId = typeof body.patchId === "string" && body.patchId ? body.patchId : null
  const store = patchId || body.baseCursor != null ? rowStore() : null
  // A retry after a lost answer: already applied, so say so and do nothing.
  try {
    if (store && patchId && patchApplied(store, patchId)) {
      sendJson(res, 200, { ok: true, duplicate: true, skipped: false, updatedAt: hub.updatedAt })
      return
    }
  } catch {
    /* the mirror is optional; apply the patch */
  }
  const stale = staleRows(store, body)
  const patch = body.strict === true && stale.length ? withoutStale(body.patch, stale) : body.patch
  const storedJson = existingVaultItem(body.name)
  let result
  try {
    result = applyVaultPatch(body.name, storedJson, patch)
  } catch (err) {
    rejectPhoneWrite(res, err instanceof Error ? err.message : "patch refused")
    return
  }
  if (!result || result.ok !== true || typeof result.value !== "string") {
    rejectPhoneWrite(res, phonePatchReason(result))
    return
  }
  const stored = upsertSharedPersistItem(body.name, result.value, body.source)
  try {
    if (store && patchId && !stored.skipped) recordPatch(store, patchId)
  } catch {
    /* a missed record only means a retry applies twice, which a field merge tolerates */
  }
  sendJson(res, 200, {
    ok: true,
    skipped: stored.skipped ?? false,
    updatedAt: stored.updatedAt,
    ...(stale.length ? { stale, refused: body.strict === true } : {}),
  })
}

/**
 * Task-vault rows this patch touches that changed on the hub after the
 * writer's `baseCursor` (its last row pull). Other vaults and writers without a
 * cursor report none. A field patch merges onto the newer row anyway; `strict`
 * refuses those rows instead, which is what a second writer needs.
 */
function staleRows(store, body) {
  if (!store || body.name !== TASK_VAULT || !Number.isFinite(body.baseCursor)) return []
  const patch = body.patch
  const ids = []
  for (const row of Array.isArray(patch.upserts) ? patch.upserts : []) if (row && typeof row.id === "string") ids.push(row.id)
  for (const id of Array.isArray(patch.removedIds) ? patch.removedIds : []) if (typeof id === "string") ids.push(id)
  if (!ids.length) return []
  try {
    mirrorRows()
    const seqs = rowSeqs(store, ids)
    return [...new Set(ids)].filter((id) => (seqs.get(id) ?? 0) > body.baseCursor)
  } catch {
    return []
  }
}

function withoutStale(patch, stale) {
  const drop = new Set(stale)
  return {
    ...patch,
    upserts: (patch.upserts ?? []).filter((row) => !drop.has(row?.id)),
    removedIds: (patch.removedIds ?? []).filter((id) => !drop.has(id)),
  }
}

/** The vault read is ~16 MB of JSON; the phone gets it gzipped (about a tenth) when it asks. */
function acceptsGzip(req) {
  return /\bgzip\b/.test(String(req?.headers?.["accept-encoding"] ?? ""))
}

function sendJson(res, status, body, req) {
  const json = JSON.stringify(body)
  if (req && json.length > 256 * 1024 && acceptsGzip(req)) {
    zlib.gzip(json, { level: 1 }, (err, zipped) => {
      if (err) {
        res.writeHead(500)
        res.end()
        return
      }
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Encoding": "gzip",
        Vary: "Accept-Encoding",
        "Content-Length": zipped.length,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      })
      res.end(zipped)
    })
    return
  }
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

/**
 * BIM flow archive: every local-model call, flow run, and test result is
 * appended as one JSON line to `data/bim-flow-runs/YYYY-MM-DD.jsonl`. Append
 * only, so no run is ever lost to the browser's size cap or a cleared storage.
 */
async function handleBimFlowArchive(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" })
    res.end()
    return true
  }
  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" })
    return true
  }
  try {
    const body = JSON.parse((await readBody(req)) || "{}")
    const rows = Array.isArray(body.rows) ? body.rows : [body]
    fs.mkdirSync(BIM_FLOW_RUNS_DIR, { recursive: true })
    const day = new Date().toISOString().slice(0, 10)
    const lines = rows.map((r) => JSON.stringify({ archivedAt: new Date().toISOString(), ...r }) + "\n").join("")
    fs.appendFileSync(path.join(BIM_FLOW_RUNS_DIR, `${day}.jsonl`), lines)
    sendJson(res, 200, { ok: true, written: rows.length })
  } catch (err) {
    sendJson(res, 400, { ok: false, error: err instanceof Error ? err.message : "Invalid JSON" })
  }
  return true
}

/**
 * Phone texts for the BIM flow lab, read only. Streams `data/phone-sync/messages.jsonl`
 * and returns compact rows for a recent window. Old texts are not relevant to
 * what the person is doing now, so the window is capped: `days` defaults to 14
 * and never exceeds 60. `day=YYYY-MM-DD` returns that one local day (it must
 * fall inside the cap). `index=1` returns text counts per local day instead.
 */
const TEXTS_FILE = path.join(ROOT, "data", "phone-sync", "messages.jsonl")
const TEXTS_MAX_DAYS = 60
async function handlePhoneTexts(req, res) {
  if (req.method !== "GET") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" })
    return true
  }
  const q = persistQuery(req)
  const days = Math.min(TEXTS_MAX_DAYS, Math.max(1, Number(q.get("days")) || 14))
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const floor = startOfToday.getTime() - (days - 1) * 86400000
  const dayParam = q.get("day")
  let from = floor
  let to = Infinity
  if (dayParam && /^\d{4}-\d\d-\d\d$/.test(dayParam)) {
    const d = new Date(`${dayParam}T00:00:00`)
    from = Math.max(floor, d.getTime())
    to = d.getTime() + 86400000
  }
  const index = q.get("index") === "1"
  const counts = {}
  const rows = []
  if (fs.existsSync(TEXTS_FILE)) {
    const rl = (await import("node:readline")).createInterface({ input: fs.createReadStream(TEXTS_FILE), crlfDelay: Infinity })
    for await (const line of rl) {
      if (!line.includes('"type":"message"')) continue
      let r
      try { r = JSON.parse(line) } catch { continue }
      if (typeof r.at !== "number" || r.at < from || r.at >= to) continue
      if (index) {
        const d = new Date(r.at)
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        counts[k] = (counts[k] ?? 0) + 1
      } else {
        rows.push({ at: r.at, dir: r.direction, h: r.party?.handle ?? "", th: r.threadId ?? "", ...(r.members?.length ? { g: 1 } : {}), t: String(r.body ?? "").slice(0, 600) })
      }
    }
  }
  rows.sort((a, b) => a.at - b.at)
  sendJson(res, 200, index ? { ok: true, days, counts } : { ok: true, days, rows })
  return true
}

/**
 * File activity for the BIM flow lab, read only. Walks the home folder for files
 * created or modified in a recent window and returns `{ at, k: "new" | "mod", p }`
 * (`p` is relative to home). Bursts of 100+ files in one minute and one top
 * folder (a git checkout, an install, a sync) are collapsed to one event.
 * Folders that are machine-written or private are skipped. The walk takes
 * several seconds, so the result is cached for ten minutes. `days` defaults to
 * 14 and never exceeds 60.
 */
const FILES_MAX_DAYS = 60
const FILES_SKIP = new Set(["node_modules", ".git", ".next", "Library", ".Trash", ".cache", ".npm", ".claude", ".cursor", "Applications", "Applications (Parallels)", "Parallels", "Brain2Backups", "cogs-backups", "google-cloud-sdk", "Resilio Sync", "Creative Cloud Files", "__pycache__", "venv", ".venv", "dist", "build", "nltk_data"])
const FILES_CACHE_MS = 600_000
let filesCache = null
async function walkFiles(dir, since, out) {
  let items
  try { items = await fs.promises.readdir(dir, { withFileTypes: true }) } catch { return }
  await Promise.all(items.map(async (it) => {
    if (it.name.startsWith(".") || FILES_SKIP.has(it.name)) return
    const full = path.join(dir, it.name)
    if (it.isDirectory()) return walkFiles(full, since, out)
    if (!it.isFile()) return
    try {
      const st = await fs.promises.stat(full)
      if (st.mtimeMs >= since) out.push({ at: Math.round(st.mtimeMs), k: "mod", p: full })
      if (st.birthtimeMs >= since) out.push({ at: Math.round(st.birthtimeMs), k: "new", p: full })
    } catch {}
  }))
}
async function collectFileActivity(days) {
  const home = process.env.HOME || ""
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const since = startOfToday.getTime() - (days - 1) * 86400000
  if (filesCache && filesCache.days >= days && Date.now() - filesCache.at < FILES_CACHE_MS) return filesCache.rows.filter((r) => r.at >= since)
  const raw = []
  await walkFiles(home, since, raw)
  const bursts = new Map()
  for (const r of raw) {
    const top = path.relative(home, r.p).split(path.sep)[0]
    const key = `${Math.floor(r.at / 60000)}|${top}`
    bursts.set(key, (bursts.get(key) ?? 0) + 1)
  }
  const seen = new Set()
  const rows = []
  for (const r of raw.sort((a, b) => a.at - b.at)) {
    const rel = path.relative(home, r.p)
    const key = `${Math.floor(r.at / 60000)}|${rel.split(path.sep)[0]}`
    if ((bursts.get(key) ?? 0) > 100) {
      if (seen.has(key)) continue
      seen.add(key)
    }
    rows.push({ at: r.at, k: r.k, p: rel.slice(0, 200) })
  }
  filesCache = { days, at: Date.now(), rows: rows.slice(-40000) }
  return filesCache.rows
}
async function handleFileActivity(req, res) {
  if (req.method !== "GET") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" })
    return true
  }
  const days = Math.min(FILES_MAX_DAYS, Math.max(1, Number(persistQuery(req).get("days")) || 14))
  sendJson(res, 200, { ok: true, days, rows: await collectFileActivity(days) })
  return true
}

const OLLAMA_DAEMON = "http://127.0.0.1:11434"
const OLLAMA_PATHS = new Set(["/api/ollama/api/chat", "/api/ollama/api/tags"])

/** Bearer check for the model proxy. Open when no hub token is set, like the vault routes. */
function ollamaProxyAuthorized(req) {
  const token = process.env.BRAIN2_PHONE_HUB_TOKEN || ""
  if (!token) return true
  const header = Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization
  const given = typeof header === "string" ? header.replace(/^Bearer\s+/i, "") : ""
  const a = Buffer.from(token)
  const b = Buffer.from(given)
  return a.length === b.length && require("node:crypto").timingSafeEqual(a, b)
}

/**
 * BIM chat on the iPhone runs its flows on the phone and sends only model calls
 * here, to this Mac's Ollama. Two paths, no streaming, a body cap. Not used by Telegram.
 */
async function handleOllamaProxy(req, res, pathname) {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {})
    return true
  }
  if (!ollamaProxyAuthorized(req)) {
    sendJson(res, 401, { ok: false, error: "hub token required" })
    return true
  }
  const target = `${OLLAMA_DAEMON}${pathname.slice("/api/ollama".length)}`
  try {
    let upstream
    if (pathname.endsWith("/tags")) {
      if (req.method !== "GET") {
        sendJson(res, 405, { ok: false, error: "Method not allowed" })
        return true
      }
      upstream = await fetch(target)
    } else {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: "Method not allowed" })
        return true
      }
      const raw = await readBody(req)
      if (raw.length > 256 * 1024) {
        sendJson(res, 413, { ok: false, error: "body too large" })
        return true
      }
      const body = JSON.parse(raw || "{}")
      upstream = await fetch(target, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, stream: false }),
      })
    }
    const text = await upstream.text()
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = { ok: false, error: text.slice(0, 200) }
    }
    sendJson(res, upstream.status, parsed)
  } catch (error) {
    sendJson(res, 502, { ok: false, error: `Ollama: ${error instanceof Error ? error.message : String(error)}` })
  }
  return true
}

/** @returns {Promise<boolean>} true if handled */
export async function handlePersistApi(req, res, pathname) {
  if (OLLAMA_PATHS.has(pathname)) {
    if (!guardBrowserOrigin(req, res)) return true
    return handleOllamaProxy(req, res, pathname)
  }
  if (pathname === "/api/phone-texts") {
    if (!guardBrowserOrigin(req, res)) return true
    return handlePhoneTexts(req, res)
  }
  if (pathname === "/api/file-activity") {
    if (!guardBrowserOrigin(req, res)) return true
    return handleFileActivity(req, res)
  }
  if (pathname === "/api/bim-flow-archive") {
    if (!guardBrowserOrigin(req, res)) return true
    return handleBimFlowArchive(req, res)
  }
  const recovery = pathname === "/api/recovery-backups" || pathname.startsWith("/api/recovery-backups/")
  const persist = pathname === "/api/persist" || pathname === "/api/persist/health" || pathname === "/api/persist/rows"
  if (!recovery && !persist) return false
  if (!guardBrowserOrigin(req, res)) return true
  if (recovery) return handleRecoveryBackupsApi(req, res, pathname)
  if (pathname !== "/api/persist" && pathname !== "/api/persist/health" && pathname !== "/api/persist/rows") return false

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
      contentAt: hub.contentAt ?? store.updatedAt,
      contentSource: hub.contentSource ?? store.source,
      store: { mode: hub.storeMode, shadow: hub.shadow },
    })
    return true
  }

  if (pathname === "/api/persist/rows") {
    if (req.method !== "GET") {
      sendJson(res, 405, { ok: false, error: "Method not allowed" })
      return true
    }
    syncFromDisk()
    const store = rowStore()
    if (!store || !mirrorRows()) {
      sendJson(res, 503, { ok: false, error: "Row mirror is off" })
      return true
    }
    const q = persistQuery(req)
    try {
      const page = changesSince(store, q.get("since"), { limit: q.get("limit") })
      sendJson(res, 200, { ok: true, ...page, ...(q.get("order") === "1" ? { order: rowOrder(store) } : {}) }, req)
    } catch (err) {
      sendJson(res, 500, { ok: false, error: err instanceof Error ? err.message : "Row read failed" })
    }
    return true
  }

  if (req.method === "GET") {
    const stored = readSharedPersist()
    if (persistQuery(req).get("canon") === "1") stored.items = omitCogsTwins(stored.items)
    // `skip=<vault>,…` leaves whole vaults out: a client that pulls them as rows does not download them twice.
    const skip = (persistQuery(req).get("skip") || "").split(",").map((n) => canonKey(n.trim())).filter(Boolean)
    if (skip.length) {
      const kept = {}
      for (const [k, v] of Object.entries(stored.items)) if (!skip.includes(canonKey(k))) kept[k] = v
      stored.items = kept
    }
    sendJson(res, 200, { ok: true, ...stored }, req)
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
