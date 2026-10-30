#!/usr/bin/env node
// Nightly backup of data/ into a timestamped tar.gz. Node built-ins plus the system `tar`.
// Usage: node scripts/backup-data.mjs [destDir]   (or BRAIN2_BACKUP_DIR; default ~/Brain2Backups)
// Env: BRAIN2_BACKUP_KEEP (default 14), BRAIN2_BACKUP_SRC (default <repo>/data),
//      BRAIN2_BACKUP_PUBLIC_KEY (else ~/.brain2/backup-public.key). With a key the tar is encrypted (.b2enc).
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { ENCRYPTED_SUFFIX, encryptFile } from "./backup-crypt.mjs"
import { brain2Env } from "../lib/brain2-env.mjs"

export const BACKUP_PREFIX = "brain2-data-"
export const BACKUP_SUFFIX = ".tar.gz"
export const DEFAULT_KEEP = 14
/** chrome-idb-snapshot is included only if it is smaller than this. */
export const IDB_SNAPSHOT_MAX_BYTES = 50 * 1024 * 1024
export const PRIVATE_KEY_PATH = path.join(os.homedir(), ".brain2", "capture-private.key")
export const BACKUP_PUBLIC_KEY_PATH = path.join(os.homedir(), ".brain2", "backup-public.key")
export const BACKUP_PRIVATE_KEY_PATH = path.join(os.homedir(), ".brain2", "backup-private.key")
/** Never archived, wherever they sit under data/. */
export const ALWAYS_EXCLUDE = ["node_modules", ".DS_Store", "capture-private.key", "backup-private.key", "*.partial"]

const pad = (n) => String(n).padStart(2, "0")

/** brain2-data-20261020-030000.tar.gz, in local time so it matches the clock on the wall. */
export function backupName(date = new Date()) {
  const d = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
  const t = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  return `${BACKUP_PREFIX}${d}-${t}${BACKUP_SUFFIX}`
}

export function isBackupName(name) {
  return /^brain2-data-\d{8}-\d{6}\.tar\.gz(\.b2enc)?$/.test(name)
}

/** Returns the backup names to delete: everything but the newest `keep`. Plain and encrypted count alike. Ignores other files. */
export function pruneList(names, keep = DEFAULT_KEEP) {
  const k = Math.max(1, Math.floor(Number(keep)) || DEFAULT_KEEP)
  const stamp = (n) => n.slice(BACKUP_PREFIX.length, BACKUP_PREFIX.length + 15)
  const mine = names.filter(isBackupName).sort((a, b) => (stamp(a) < stamp(b) ? 1 : stamp(a) > stamp(b) ? -1 : 0))
  return mine.slice(k)
}

export function dirSize(dir) {
  let total = 0
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) total += dirSize(p)
    else if (e.isFile()) total += fs.statSync(p).size
  }
  return total
}

/**
 * The backup public key from the env or ~/.brain2/backup-public.key, or null.
 * @param {Record<string, string | undefined>} [env]
 * @param {string} [file]
 */
export function readBackupPublicKey(env = process.env, file = BACKUP_PUBLIC_KEY_PATH) {
  const fromEnv = (brain2Env("BACKUP_PUBLIC_KEY", env) || "").trim()
  if (fromEnv) return fromEnv
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim() || null : null
}

/** @param {{ src?: string, destDir?: string, keep?: number, now?: Date, idbMax?: number, publicKey?: string | null, log?: (...args: any[]) => void }} [opts] */
export function runBackup({ src, destDir, keep = DEFAULT_KEEP, now = new Date(), idbMax = IDB_SNAPSHOT_MAX_BYTES, publicKey = null, log = console.log } = {}) {
  const persist = path.join(src, "shared-persist.json")
  if (!fs.existsSync(persist) || fs.statSync(persist).size === 0) {
    throw new Error(`Refusing to back up: ${persist} is missing or empty.`)
  }
  fs.mkdirSync(destDir, { recursive: true })

  const excludes = [...ALWAYS_EXCLUDE]
  const idb = path.join(src, "chrome-idb-snapshot")
  if (fs.existsSync(idb) && dirSize(idb) >= idbMax) {
    excludes.push("chrome-idb-snapshot")
    log(`Skipping chrome-idb-snapshot (over ${Math.round(idbMax / 1048576)} MB cap).`)
  }

  const name = backupName(now)
  const tarPath = path.join(destDir, name)
  const final = publicKey ? `${tarPath}${ENCRYPTED_SUFFIX}` : tarPath
  const partial = `${tarPath}.partial`
  const encPartial = `${final}.partial`
  fs.rmSync(partial, { force: true })
  const args = ["-czf", partial, ...excludes.flatMap((e) => ["--exclude", e]), "-C", path.dirname(src), path.basename(src)]
  const r = spawnSync("tar", args, { encoding: "utf8" })
  if (r.status !== 0) {
    fs.rmSync(partial, { force: true })
    throw new Error(`tar failed: ${r.stderr || r.error}`)
  }
  if (publicKey) {
    // The plain tar never gets a real name: it lives only as .partial until encrypted, then goes.
    try {
      encryptFile(publicKey, partial, encPartial)
    } catch (e) {
      fs.rmSync(encPartial, { force: true })
      throw new Error(`encrypt failed: ${e.message}`)
    } finally {
      fs.rmSync(partial, { force: true })
    }
    fs.renameSync(encPartial, final)
  } else {
    fs.renameSync(partial, final)
  }

  // Clear leftovers from crashed runs, then prune old backups.
  for (const f of fs.readdirSync(destDir)) {
    if (f.endsWith(".partial") && f.startsWith(BACKUP_PREFIX)) fs.rmSync(path.join(destDir, f), { force: true })
  }
  const pruned = pruneList(fs.readdirSync(destDir), keep)
  for (const f of pruned) fs.rmSync(path.join(destDir, f), { force: true })

  log(`Backed up ${src} -> ${final} (${(fs.statSync(final).size / 1048576).toFixed(1)} MB${publicKey ? ", encrypted" : ""}). Pruned ${pruned.length}.`)
  return { path: final, pruned, excludes, encrypted: Boolean(publicKey) }
}

function main() {
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const src = path.resolve(brain2Env("BACKUP_SRC") || path.join(repo, "data"))
  const destDir = path.resolve(process.argv[2] || brain2Env("BACKUP_DIR") || path.join(os.homedir(), "Brain2Backups"))
  const keep = Number(brain2Env("BACKUP_KEEP")) || DEFAULT_KEEP
  const publicKey = readBackupPublicKey()
  if (!publicKey) {
    console.warn("WARNING: no backup key, so this backup is NOT encrypted. Run: node scripts/backup-keygen.mjs")
  }
  try {
    runBackup({ src, destDir, keep, publicKey })
  } catch (e) {
    console.error(e.message)
    process.exitCode = 1
    return
  }
  if (fs.existsSync(PRIVATE_KEY_PATH)) {
    console.log(`Reminder: ${PRIVATE_KEY_PATH} is NOT in this backup. Keep a separate offline copy.`)
  }
  if (publicKey && fs.existsSync(BACKUP_PRIVATE_KEY_PATH)) {
    console.log(`Reminder: ${BACKUP_PRIVATE_KEY_PATH} opens these backups. Keep an offline copy; lose it and they stay locked.`)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
