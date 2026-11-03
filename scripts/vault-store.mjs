/**
 * Vault store: every persisted vault (`brain2-*` key -> JSON string) in SQLite.
 *
 * Stage 4a of the row store plan (`docs/ORACLE_INTERIM_SYNC.md`). The hub keeps
 * its vaults in memory and used to rewrite the whole 27 MB JSON file on each
 * save. With this store a save is one transaction over the keys that changed.
 *
 * Modes (`BRAIN2_STORE`, read by `scripts/persist-api.mjs`):
 *   json    the JSON file only, as before.
 *   shadow  (default) the JSON file is the truth; this store is kept in step
 *           and checked against it. Nothing reads from here.
 *   sqlite  this store is the truth; the JSON file is a generated export for
 *           the readers that still open it (Electron preload, screen-time
 *           scripts, backups).
 *
 * Values are stored exactly as the hub holds them (strings). `hash` lets a
 * check compare 27 MB without reading it back. `rev` is a counter over the
 * whole store: another process learns it changed by reading one number.
 * Uses Node's built-in `node:sqlite`.
 */
import { createHash } from "node:crypto"
import { createRequire } from "node:module"

// Through `require`, not `import`: the hub is loaded by jiti, which rewrites `node:sqlite` to `sqlite`.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite")

const DEFAULT_OWNER = "me"
const META_FIELDS = ["updatedAt", "source", "contentAt", "contentSource"]

export function hashValue(value) {
  return createHash("sha1").update(value).digest("hex")
}

export function openVaultStore(file) {
  const db = new DatabaseSync(file)
  db.exec("PRAGMA journal_mode = WAL")
  db.exec("PRAGMA synchronous = FULL")
  db.exec("PRAGMA busy_timeout = 5000")
  db.exec(`
    CREATE TABLE IF NOT EXISTS vaults (
      owner TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      hash TEXT NOT NULL,
      rev INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (owner, key)
    );
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `)
  return { db, owner: DEFAULT_OWNER }
}

export function closeVaultStore(store) {
  try {
    store.db.close()
  } catch {
    /* already closed */
  }
}

function metaGet(db, key) {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key)
  return row ? row.value : null
}

function metaSet(db, key, value) {
  db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(
    key,
    value == null ? "" : String(value),
  )
}

/** The store-wide revision. Changes on every committed write. */
export function storeRev(store) {
  return Number(metaGet(store.db, "rev") ?? 0)
}

export function storeIsEmpty(store) {
  return !store.db.prepare("SELECT 1 AS hit FROM vaults WHERE owner = ? LIMIT 1").get(store.owner)
}

/** Every vault plus the hub's stamps, in the shape `parseDisk` returns. */
export function loadAll(store) {
  const items = {}
  for (const row of store.db.prepare("SELECT key, value FROM vaults WHERE owner = ?").all(store.owner)) items[row.key] = row.value
  const stamps = {}
  for (const field of META_FIELDS) stamps[field] = metaGet(store.db, field) || null
  return { ...stamps, items }
}

/**
 * Commit `keys` of `items` in one transaction: a string value is upserted (rev
 * bumped only when its hash changed), anything else deletes the key. Stamps are
 * saved with it. Returns how many keys changed.
 */
export function writeKeys(store, items, keys, stamps = {}) {
  const { db, owner } = store
  const now = new Date().toISOString()
  const upsert = db.prepare(
    `INSERT INTO vaults (owner, key, value, hash, rev, updated_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (owner, key) DO UPDATE SET value = excluded.value, hash = excluded.hash, rev = excluded.rev, updated_at = excluded.updated_at`,
  )
  const getHash = db.prepare("SELECT hash FROM vaults WHERE owner = ? AND key = ?")
  const del = db.prepare("DELETE FROM vaults WHERE owner = ? AND key = ?")
  let changed = 0
  db.exec("BEGIN IMMEDIATE")
  try {
    const rev = storeRev(store) + 1
    for (const key of keys) {
      const value = items[key]
      const had = getHash.get(owner, key)
      if (typeof value !== "string") {
        if (had) {
          del.run(owner, key)
          changed++
        }
        continue
      }
      const hash = hashValue(value)
      if (had && had.hash === hash) continue
      upsert.run(owner, key, value, hash, rev, now)
      changed++
    }
    for (const field of META_FIELDS) if (field in stamps) metaSet(db, field, stamps[field])
    if (changed) metaSet(db, "rev", rev)
    db.exec("COMMIT")
  } catch (err) {
    try {
      db.exec("ROLLBACK")
    } catch {
      /* no open transaction */
    }
    throw err
  }
  return changed
}

/**
 * Compare in-memory vaults with the store. `missing` are in memory only,
 * `extra` in the store only, `differing` in both with different content.
 */
export function compareItems(store, items) {
  const have = new Map()
  for (const row of store.db.prepare("SELECT key, hash FROM vaults WHERE owner = ?").all(store.owner)) have.set(row.key, row.hash)
  const missing = []
  const differing = []
  for (const [key, value] of Object.entries(items)) {
    if (typeof value !== "string") continue
    const hash = have.get(key)
    if (hash === undefined) missing.push(key)
    else if (hash !== hashValue(value)) differing.push(key)
    have.delete(key)
  }
  return { missing, differing, extra: [...have.keys()] }
}

/** Bring the store to exactly `items`: write what is missing or different, delete what is extra. */
export function replaceAll(store, items, stamps = {}) {
  const diff = compareItems(store, items)
  const keys = [...diff.missing, ...diff.differing, ...diff.extra]
  return { ...diff, changed: keys.length ? writeKeys(store, items, keys, stamps) : writeKeys(store, items, [], stamps) }
}
