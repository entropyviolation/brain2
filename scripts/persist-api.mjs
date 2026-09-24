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
const DATA_DIR = path.join(ROOT, "data")
const DATA_FILE = path.join(DATA_DIR, "shared-persist.json")
const RECOVERY_DIR = path.join(DATA_DIR, "recovery-backups")
const SAFE_RECOVERY_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*\.json$/

export function sharedPersistPath() {
  return DATA_FILE
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function stripFriendPicItems(items) {
  if (!items || typeof items !== "object") return {}
  const next = { ...items }
  for (const key of Object.keys(next)) {
    if (key.includes("friend-pic:")) delete next[key]
  }
  return next
}

export function readSharedPersist() {
  ensureDataDir()
  if (!fs.existsSync(DATA_FILE)) {
    return { updatedAt: null, source: null, items: {} }
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"))
    return {
      updatedAt: parsed.updatedAt ?? null,
      source: parsed.source ?? null,
      items: stripFriendPicItems(parsed.items && typeof parsed.items === "object" ? parsed.items : {}),
    }
  } catch {
    return { updatedAt: null, source: null, items: {} }
  }
}

export function writeSharedPersist(next) {
  ensureDataDir()
  const payload = {
    updatedAt: new Date().toISOString(),
    source: next.source ?? readSharedPersist().source ?? "hub",
    items: stripFriendPicItems(next.items && typeof next.items === "object" ? next.items : {}),
  }
  const tmp = `${DATA_FILE}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(payload), "utf8")
  fs.renameSync(tmp, DATA_FILE)
  return payload
}

function persistAliases(name) {
  if (typeof name !== "string") return []
  if (name.includes("friend-pic:")) return [name]
  if (name.startsWith("brain2-")) return [name, "cogs-" + name.slice(7)]
  if (name.startsWith("cogs-")) return ["brain2-" + name.slice(5), name]
  return [name]
}

function isFriendPicPersistName(name) {
  return typeof name === "string" && name.includes("friend-pic:")
}

function isPlanTextPersistName(name) {
  const bare = name.startsWith("brain2-") ? name.slice(7) : name.startsWith("cogs-") ? name.slice(5) : name
  return /^(day|week|month)Plan-/.test(bare)
}

function existingVaultItem(items, name) {
  for (const key of persistAliases(name)) {
    if (typeof items[key] === "string") return items[key]
  }
  return undefined
}

function writeVaultItem(items, name, value) {
  if (isFriendPicPersistName(name)) {
    for (const key of persistAliases(name)) delete items[key]
    return
  }
  if (isPlanTextPersistName(name) && typeof value === "string" && value === "") {
    for (const key of persistAliases(name)) delete items[key]
    return
  }
  for (const key of persistAliases(name)) items[key] = value
}

export function mergeSharedPersistItems(incoming, source) {
  const current = readSharedPersist()
  const items = { ...current.items }
  let skipped = 0
  for (const key of Object.keys(items)) {
    if (!isFriendPicPersistName(key)) continue
    delete items[key]
    skipped++
  }
  for (const [name, value] of Object.entries(incoming || {})) {
    if (typeof name !== "string" || typeof value !== "string") continue
    if (isFriendPicPersistName(name)) {
      for (const key of persistAliases(name)) delete items[key]
      skipped++
      continue
    }
    const existing = existingVaultItem(items, name)
    const merged = mergeIntoHub(existing, value, name)
    if (typeof merged !== "string") {
      skipped++
      continue
    }
    if (existing === value) {
      writeVaultItem(items, name, merged)
      continue
    }
    if (merged === existing && existing !== value) {
      journalVaultDrop(name, existing, value, true)
      skipped++
      continue
    }
    journalVaultDrop(name, existing, merged, false)
    writeVaultItem(items, name, merged)
  }
  const stored = writeSharedPersist({ items, source: source ?? current.source ?? "hub" })
  return { ...stored, skipped }
}

export function upsertSharedPersistItem(name, value, source) {
  if (isFriendPicPersistName(name)) {
    const current = readSharedPersist()
    const items = { ...current.items }
    for (const key of persistAliases(name)) delete items[key]
    if (JSON.stringify(items) === JSON.stringify(current.items)) return { ...current, skipped: "friend-pic" }
    return { ...writeSharedPersist({ items, source: source ?? current.source ?? "hub" }), skipped: "friend-pic" }
  }
  const current = readSharedPersist()
  const existing = existingVaultItem(current.items, name)
  const merged = mergeIntoHub(existing, value, name)
  if (typeof merged !== "string") {
    return { ...current, skipped: "empty" }
  }
  if (existing === value) {
    const items = { ...current.items }
    writeVaultItem(items, name, merged)
    if (JSON.stringify(items) === JSON.stringify(current.items)) return current
    return writeSharedPersist({ items, source: source ?? current.source ?? "hub" })
  }
  if (merged === existing && existing !== value) {
    journalVaultDrop(name, existing, value, true)
    return { ...current, skipped: "shrink" }
  }
  journalVaultDrop(name, existing, merged, false)
  const items = { ...current.items }
  writeVaultItem(items, name, merged)
  return writeSharedPersist({ items, source: source ?? current.source ?? "hub" })
}

function sendJson(res, status, body) {
  const json = JSON.stringify(body)
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(json),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
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

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on("data", (c) => chunks.push(c))
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
    req.on("error", reject)
  })
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
  if (pathname === "/api/recovery-backups" || pathname.startsWith("/api/recovery-backups/")) {
    return handleRecoveryBackupsApi(req, res, pathname)
  }
  if (pathname !== "/api/persist" && pathname !== "/api/persist/health") return false

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    })
    res.end()
    return true
  }

  if (pathname === "/api/persist/health" && req.method === "GET") {
    const store = readSharedPersist()
    sendJson(res, 200, {
      ok: true,
      keyCount: Object.keys(store.items).length,
      updatedAt: store.updatedAt,
      source: store.source,
    })
    return true
  }

  if (req.method === "GET") {
    sendJson(res, 200, { ok: true, ...readSharedPersist() })
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
        keyCount: Object.keys(stored.items).length,
        skipped: stored.skipped,
      })
    } catch (err) {
      sendJson(res, 400, { ok: false, error: err instanceof Error ? err.message : "Invalid JSON" })
    }
    return true
  }

  if (req.method === "POST") {
    try {
      const body = JSON.parse((await readBody(req)) || "{}")
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
