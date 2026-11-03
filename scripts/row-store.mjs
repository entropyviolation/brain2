/**
 * Row mirror: the task vault as one SQLite row per item, with a change cursor.
 *
 * The hub keeps `brain2-task-storage` as one JSON blob. This file copies that
 * blob into rows (`tasks`, `lists`, `folders`) in a SQLite file beside it
 * (`<hub file>.rows.sqlite`). Each row carries a `seq`: a counter that only
 * goes up, bumped when the row's content changes. A client asks "what changed
 * since seq N" and gets only those rows, plus tombstones for deleted ones.
 *
 * The blob stays the source of truth. The mirror is derived and can be deleted;
 * the next mirror rebuilds it. A mirror failure never touches the blob.
 * A deleted row is kept as a tombstone with its last JSON, never dropped.
 *
 * `owner` is on every row so a second user can share the file later.
 * Uses Node's built-in `node:sqlite` (no native dependency for Electron).
 */
import { createRequire } from "node:module"
import { randomUUID } from "node:crypto"

const { describeVault } = createRequire(import.meta.url)("../lib/row-vault.js")

// Through `require`, not `import`: the hub is loaded by jiti, which rewrites `node:sqlite` to `sqlite`.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite")

export const TASK_VAULT = "brain2-task-storage"
const ROW_KINDS = { tasks: "task", lists: "list", folders: "folder" }
const STATE_KIND = "state"
const STATE_ID = "state"
const DEFAULT_OWNER = "me"
const DEFAULT_LIMIT = 5000

export function openRowStore(file) {
  const db = new DatabaseSync(file)
  db.exec("PRAGMA journal_mode = WAL")
  db.exec("PRAGMA synchronous = NORMAL")
  db.exec(`
    CREATE TABLE IF NOT EXISTS rows (
      owner TEXT NOT NULL,
      vault TEXT NOT NULL,
      kind TEXT NOT NULL,
      id TEXT NOT NULL,
      json TEXT NOT NULL,
      seq INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (owner, vault, kind, id)
    );
    CREATE INDEX IF NOT EXISTS rows_seq ON rows (owner, vault, seq);
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS applied_patches (
      owner TEXT NOT NULL,
      patch_id TEXT NOT NULL,
      applied_at TEXT NOT NULL,
      PRIMARY KEY (owner, patch_id)
    );
  `)
  // The epoch names this database. A client holding a cursor from another one starts over.
  db.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('epoch', ?)").run(randomUUID())
  const epoch = db.prepare("SELECT value FROM meta WHERE key = 'epoch'").get().value
  return { db, cache: new Map(), lastBlob: null, epoch, head: null }
}

export function closeRowStore(store) {
  try {
    store.db.close()
  } catch {
    /* already closed */
  }
}

function nextSeqFrom(db) {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'seq'").get()
  return row ? Number(row.value) : 0
}

/** id -> { json, deleted } for one owner and vault, loaded once per handle. */
function cacheFor(store, owner, vault) {
  const key = `${owner}\u0000${vault}`
  let map = store.cache.get(key)
  if (map) return map
  map = new Map()
  const stmt = store.db.prepare("SELECT kind, id, json, deleted FROM rows WHERE owner = ? AND vault = ?")
  for (const r of stmt.all(owner, vault)) map.set(`${r.kind}\u0000${r.id}`, { json: r.json, deleted: r.deleted === 1 })
  store.cache.set(key, map)
  return map
}

/** Split a persisted task-vault blob into row JSON strings plus the leftover state. */
export function splitTaskVault(blob) {
  const parsed = JSON.parse(blob)
  const state = parsed && typeof parsed === "object" ? parsed.state : null
  if (!state || typeof state !== "object" || !Array.isArray(state.tasks)) return null
  const rows = new Map()
  let skipped = 0
  const described = describeVault(state)
  for (const [field, kind] of Object.entries(ROW_KINDS)) {
    const list = Array.isArray(state[field]) ? state[field] : []
    for (const row of list) {
      if (!row || typeof row !== "object" || typeof row.id !== "string" || !row.id) {
        skipped++
        continue
      }
      rows.set(`${kind}\u0000${row.id}`, JSON.stringify(row))
    }
  }
  const rest = { version: parsed.version }
  for (const [k, v] of Object.entries(state)) if (!(k in ROW_KINDS)) rest[k] = v
  rows.set(`${STATE_KIND}\u0000${STATE_ID}`, JSON.stringify(rest))
  return { rows, skipped, described }
}

/**
 * Bring the mirror up to date with a blob. One transaction. Only rows whose
 * JSON changed (or that came back after a delete) get a new seq; rows missing
 * from the blob become tombstones. Returns counts. A blob that does not parse
 * as a task vault changes nothing.
 */
export function mirrorTaskVault(store, blob, opts = {}) {
  const owner = opts.owner ?? DEFAULT_OWNER
  const vault = opts.vault ?? TASK_VAULT
  if (typeof blob !== "string") return { changed: 0, deleted: 0, skipped: 0, ok: false }
  if (store.lastBlob === blob) return { changed: 0, deleted: 0, skipped: 0, ok: true }
  let split
  try {
    split = splitTaskVault(blob)
  } catch {
    return { changed: 0, deleted: 0, skipped: 0, ok: false }
  }
  if (!split) return { changed: 0, deleted: 0, skipped: 0, ok: false }

  store.head = split.described
  const { db } = store
  const cache = cacheFor(store, owner, vault)
  const now = new Date().toISOString()
  let seq = nextSeqFrom(db)
  let changed = 0
  let deleted = 0
  const upsert = db.prepare(
    `INSERT INTO rows (owner, vault, kind, id, json, seq, updated_at, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT (owner, vault, kind, id) DO UPDATE SET json = excluded.json, seq = excluded.seq, updated_at = excluded.updated_at, deleted = 0`,
  )
  const tombstone = db.prepare(
    "UPDATE rows SET seq = ?, updated_at = ?, deleted = 1 WHERE owner = ? AND vault = ? AND kind = ? AND id = ?",
  )
  const pending = []
  db.exec("BEGIN")
  try {
    for (const [key, json] of split.rows) {
      const prev = cache.get(key)
      if (prev && !prev.deleted && prev.json === json) continue
      const [kind, id] = key.split("\u0000")
      seq++
      upsert.run(owner, vault, kind, id, json, seq, now)
      pending.push([key, { json, deleted: false }])
      changed++
    }
    for (const [key, prev] of cache) {
      if (prev.deleted || split.rows.has(key)) continue
      const [kind, id] = key.split("\u0000")
      seq++
      tombstone.run(seq, now, owner, vault, kind, id)
      pending.push([key, { json: prev.json, deleted: true }])
      deleted++
    }
    db.prepare("INSERT INTO meta (key, value) VALUES ('seq', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(
      String(seq),
    )
    db.exec("COMMIT")
  } catch (err) {
    try {
      db.exec("ROLLBACK")
    } catch {
      /* no open transaction */
    }
    throw err
  }
  for (const [key, entry] of pending) cache.set(key, entry)
  store.lastBlob = blob
  return { changed, deleted, skipped: split.skipped, ok: true }
}

/**
 * Rows changed after `since`, oldest first. A client keeps `cursor` and sends
 * it back. `more` means the page was full: ask again from `cursor`.
 */
export function changesSince(store, since, opts = {}) {
  const owner = opts.owner ?? DEFAULT_OWNER
  const vault = opts.vault ?? TASK_VAULT
  const limit = Math.max(1, Math.min(Number(opts.limit) || DEFAULT_LIMIT, 50000))
  const from = Number.isFinite(Number(since)) && Number(since) > 0 ? Math.floor(Number(since)) : 0
  const found = store.db
    .prepare(
      "SELECT kind, id, json, seq, updated_at, deleted FROM rows WHERE owner = ? AND vault = ? AND seq > ? ORDER BY seq LIMIT ?",
    )
    .all(owner, vault, from, limit + 1)
  const more = found.length > limit
  const page = more ? found.slice(0, limit) : found
  const rows = page.map((r) => ({
    kind: r.kind,
    id: r.id,
    seq: r.seq,
    updatedAt: r.updated_at,
    deleted: r.deleted === 1,
    ...(r.deleted === 1 ? {} : { row: JSON.parse(r.json) }),
  }))
  const cursor = page.length ? page[page.length - 1].seq : from
  return {
    rows,
    cursor,
    more,
    head: nextSeqFrom(store.db),
    epoch: store.epoch,
    counts: store.head ? store.head.counts : null,
    hashes: store.head ? store.head.hashes : null,
  }
}

/** Row ids in blob order per kind, for a client whose order hash differs. */
export function rowOrder(store) {
  return store.head ? store.head.order : null
}

const PATCH_KEEP = 5000

/** True when this patch id was applied before (a retry after a lost answer). */
export function patchApplied(store, patchId, owner = DEFAULT_OWNER) {
  return !!store.db.prepare("SELECT 1 AS hit FROM applied_patches WHERE owner = ? AND patch_id = ?").get(owner, patchId)
}

/** Remember an applied patch id. Keeps the newest few thousand. */
export function recordPatch(store, patchId, owner = DEFAULT_OWNER) {
  store.db
    .prepare("INSERT OR IGNORE INTO applied_patches (owner, patch_id, applied_at) VALUES (?, ?, ?)")
    .run(owner, patchId, new Date().toISOString())
  store.db
    .prepare(
      "DELETE FROM applied_patches WHERE owner = ? AND rowid NOT IN (SELECT rowid FROM applied_patches WHERE owner = ? ORDER BY rowid DESC LIMIT ?)",
    )
    .run(owner, owner, PATCH_KEEP)
}

/** id -> highest seq of any row with that id. Ids the mirror has never seen are absent. */
export function rowSeqs(store, ids, opts = {}) {
  const owner = opts.owner ?? DEFAULT_OWNER
  const vault = opts.vault ?? TASK_VAULT
  const out = new Map()
  for (let i = 0; i < ids.length; i += 400) {
    const chunk = ids.slice(i, i + 400)
    const marks = chunk.map(() => "?").join(",")
    const found = store.db
      .prepare(`SELECT id, MAX(seq) AS seq FROM rows WHERE owner = ? AND vault = ? AND id IN (${marks}) GROUP BY id`)
      .all(owner, vault, ...chunk)
    for (const r of found) out.set(r.id, r.seq)
  }
  return out
}
