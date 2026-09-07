#!/usr/bin/env node
/**
 * Snapshot Chrome's http://localhost:3000 localStorage into data/shared-persist.json.
 *
 * Read-only on Chrome: copies LevelDB to a temp dir, never writes the profile.
 * Electron hydrates from the hub file (preload + /api/persist).
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { execSync } from "node:child_process"
import { ClassicLevel } from "classic-level"
import { writeSharedPersist, sharedPersistPath } from "./persist-api.mjs"

const ORIGIN_PREFIX = "_http://localhost:3000\u0000\u0001"
const CHROME_LS = path.join(
  os.homedir(),
  "Library/Application Support/Google/Chrome/Default/Local Storage/leveldb",
)
const CHROME_IDB = path.join(
  os.homedir(),
  "Library/Application Support/Google/Chrome/Default/IndexedDB/http_localhost_3000.indexeddb.leveldb",
)
const IDB_SNAPSHOT = path.join(path.dirname(sharedPersistPath()), "chrome-idb-snapshot")

function storageKeyFromDbKey(keyBuf) {
  const key = keyBuf.toString("utf8")
  if (!key.startsWith(ORIGIN_PREFIX)) return null
  return key.slice(ORIGIN_PREFIX.length) || null
}

function decodeValue(buf) {
  if (!Buffer.isBuffer(buf) || buf.length === 0) return ""
  // Chromium localStorage values: first byte is a charset tag
  // (0 = UTF-16LE, 1 = 8-bit/UTF-8), then the string payload.
  const tag = buf[0]
  const payload = buf.subarray(1)
  if (tag === 1) {
    return payload.toString("utf8")
  }
  if (tag === 0) {
    const even = payload.length % 2 === 0 ? payload : payload.subarray(0, payload.length - 1)
    return even.toString("utf16le")
  }
  const as8 = buf.toString("utf8")
  if (as8.startsWith("{") || as8.startsWith("[") || as8.startsWith("\"")) return as8
  return as8.replace(/\u0000+$/g, "")
}

function inboxCount(taskRaw) {
  try {
    const parsed = JSON.parse(taskRaw)
    const tasks = parsed?.state?.tasks
    if (!Array.isArray(tasks)) return null
    return tasks.filter((t) => t && t.stage === "inbox" && !t.completed).length
  } catch {
    return null
  }
}

async function dumpChromeLocalStorage() {
  if (!fs.existsSync(CHROME_LS)) {
    throw new Error(`Chrome Local Storage not found at ${CHROME_LS}`)
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cogs-chrome-ls-"))
  const copy = path.join(tmp, "leveldb")
  execSync(`cp -R ${JSON.stringify(CHROME_LS)} ${JSON.stringify(copy)}`)
  const lock = path.join(copy, "LOCK")
  if (fs.existsSync(lock)) fs.rmSync(lock)

  const db = new ClassicLevel(copy, { keyEncoding: "buffer", valueEncoding: "buffer" })
  await db.open()
  const items = {}
  for await (const [keyBuf, valBuf] of db.iterator()) {
    const name = storageKeyFromDbKey(keyBuf)
    if (!name) continue
    items[name] = decodeValue(valBuf)
  }
  await db.close()
  fs.rmSync(tmp, { recursive: true, force: true })
  return items
}

function snapshotChromeIndexedDB() {
  if (!fs.existsSync(CHROME_IDB)) {
    console.log("[dump-chrome] no Chrome IndexedDB for localhost:3000 — skipped")
    return
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cogs-chrome-idb-"))
  const copy = path.join(tmp, "leveldb")
  execSync(`cp -R ${JSON.stringify(CHROME_IDB)} ${JSON.stringify(copy)}`)
  const lock = path.join(copy, "LOCK")
  if (fs.existsSync(lock)) fs.rmSync(lock)
  fs.rmSync(IDB_SNAPSHOT, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(IDB_SNAPSHOT), { recursive: true })
  fs.cpSync(copy, IDB_SNAPSHOT, { recursive: true })
  fs.rmSync(tmp, { recursive: true, force: true })
  console.log(`[dump-chrome] IndexedDB snapshot → ${IDB_SNAPSHOT}`)
}

const items = await dumpChromeLocalStorage()
if (!items["cogs-task-storage"]) {
  throw new Error("Chrome dump missing cogs-task-storage — refusing to write an empty hub")
}
try {
  JSON.parse(items["cogs-task-storage"])
} catch {
  throw new Error("Chrome dump cogs-task-storage is not valid JSON — refusing to overwrite the hub")
}
const stored = writeSharedPersist({ items, source: "chrome-localhost" })
const inbox = inboxCount(items["cogs-task-storage"] || "")
console.log(`[dump-chrome] wrote ${Object.keys(items).length} keys → ${sharedPersistPath()}`)
console.log(`[dump-chrome] source=${stored.source} updatedAt=${stored.updatedAt}`)
console.log(`[dump-chrome] cogs-task-storage inbox(active)=${inbox}`)
console.log(`[dump-chrome] keys: ${Object.keys(items).sort().join(", ")}`)
snapshotChromeIndexedDB()
