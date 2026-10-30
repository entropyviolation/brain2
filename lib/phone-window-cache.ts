/**
 * lib/phone-window-cache.ts — Small phone cache and patch outbox.
 *
 * IndexedDB `brain2-phone-window` keeps the launch slices (task store, habits,
 * goals, sleep, settings, theme, time grid) and the phase-3 outbox. It is not
 * the file of record. One alias per vault. The message archive, docs, modules,
 * photos, and threads stay out. Open matches `lib/attachments.ts`. When
 * IndexedDB is missing (tests, SSR) the same records sit in memory for this
 * process only.
 */
import { idbAvailable, isQuotaExceededError } from "@/lib/storage-keys"

export const PHONE_WINDOW_DB = "brain2-phone-window"
const DB_VERSION = 1
const SLICES = "slices"
const OUTBOX = "outbox"

const LAUNCH_SUFFIXES = new Set([
  "task-storage",
  "habits-store",
  "goals-store",
  "sleep-store",
  "user-settings",
  "theme-store",
  "timegrid-store",
])

export type PhonePatch = {
  upserts: Array<Record<string, unknown> & { id: string }>
  removedIds: string[]
}

export type PhoneOutboxRow = {
  id: string
  name: string
  source: "phone"
  patch: PhonePatch
}

type SliceRow = { name: string; value: string }

const memorySlices = new Map<string, string>()
const memoryOutbox: PhoneOutboxRow[] = []

function canonicalKey(name: string): string {
  if (name.startsWith("cogs-")) return `brain2-${name.slice(5)}`
  return name
}

/** Launch slices only, one `brain2-*` key each. `cogs-*` fills in when that is the only copy. */
export function selectLaunchSlices(items: ReadonlyMap<string, string>): Map<string, string> {
  const out = new Map<string, string>()
  const legacy: Array<[string, string]> = []
  for (const [name, value] of items) {
    if (!value) continue
    const canon = canonicalKey(name)
    if (!canon.startsWith("brain2-") || canon.startsWith("brain2-demo-")) continue
    if (!LAUNCH_SUFFIXES.has(canon.slice("brain2-".length))) continue
    if (name.startsWith("cogs-")) legacy.push([canon, value])
    else out.set(canon, value)
  }
  for (const [name, value] of legacy) {
    if (!out.has(name)) out.set(name, value)
  }
  return out
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PHONE_WINDOW_DB, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(SLICES)) db.createObjectStore(SLICES, { keyPath: "name" })
      if (!db.objectStoreNames.contains(OUTBOX)) db.createObjectStore(OUTBOX, { keyPath: "id" })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error("Failed to open phone window"))
  })
}

function runWrite(db: IDBDatabase, store: string, write: (objectStore: IDBObjectStore, mark: (req: IDBRequest) => void) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    let failed: unknown = null
    const tx = db.transaction(store, "readwrite")
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(failed ?? tx.error ?? new Error("phone window cache failed"))
    tx.onabort = () => reject(failed ?? tx.error ?? new Error("phone window cache aborted"))
    const mark = (req: IDBRequest) => {
      req.onerror = () => {
        failed = req.error ?? failed
      }
    }
    write(tx.objectStore(store), mark)
  })
}

function readAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly")
    const req = tx.objectStore(store).getAll()
    req.onsuccess = () => resolve((req.result as T[] | undefined) ?? [])
    req.onerror = () => reject(req.error ?? new Error("phone window cache read failed"))
  })
}

async function withDb<T>(fn: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await openDb()
  try {
    return await fn(db)
  } finally {
    db.close()
  }
}

async function clearSlices(): Promise<void> {
  memorySlices.clear()
  if (!idbAvailable()) return
  await withDb((db) =>
    runWrite(db, SLICES, (store, mark) => {
      mark(store.clear())
    }),
  )
}

/** Replace the launch cache. A quota error clears it and leaves the live fetch in place. */
export async function writeLaunchCache(items: ReadonlyMap<string, string>): Promise<"ok" | "dropped"> {
  const slices = selectLaunchSlices(items)
  if (!idbAvailable()) {
    memorySlices.clear()
    for (const [name, value] of slices) memorySlices.set(name, value)
    return "ok"
  }
  try {
    await withDb((db) =>
      runWrite(db, SLICES, (store, mark) => {
        mark(store.clear())
        for (const [name, value] of slices) mark(store.put({ name, value } satisfies SliceRow))
      }),
    )
    return "ok"
  } catch (error) {
    if (isQuotaExceededError(error)) {
      try {
        await clearSlices()
      } catch {
        memorySlices.clear()
      }
      return "dropped"
    }
    return "ok"
  }
}

export async function readLaunchCache(): Promise<Map<string, string>> {
  if (!idbAvailable()) return new Map(memorySlices)
  try {
    const rows = await withDb((db) => readAll<SliceRow>(db, SLICES))
    const out = new Map<string, string>()
    for (const row of rows) {
      if (!row || typeof row.name !== "string" || typeof row.value !== "string") continue
      const slices = selectLaunchSlices(new Map([[row.name, row.value]]))
      for (const [name, value] of slices) out.set(name, value)
    }
    return out
  } catch {
    return new Map()
  }
}

export async function enqueueOutbox(row: PhoneOutboxRow): Promise<void> {
  if (!idbAvailable()) {
    memoryOutbox.push(row)
    return
  }
  await withDb((db) =>
    runWrite(db, OUTBOX, (store, mark) => {
      mark(store.put(row))
    }),
  )
}

export async function listOutbox(): Promise<PhoneOutboxRow[]> {
  if (!idbAvailable()) return memoryOutbox.map((row) => ({ ...row, patch: { ...row.patch, upserts: row.patch.upserts.map((item) => ({ ...item })), removedIds: [...row.patch.removedIds] } }))
  try {
    const rows = await withDb((db) => readAll<PhoneOutboxRow>(db, OUTBOX))
    return rows.filter((row) => row && typeof row.id === "string" && row.patch && Array.isArray(row.patch.upserts))
  } catch {
    return []
  }
}

export async function deleteOutbox(id: string): Promise<void> {
  if (!idbAvailable()) {
    const at = memoryOutbox.findIndex((row) => row.id === id)
    if (at >= 0) memoryOutbox.splice(at, 1)
    return
  }
  await withDb((db) =>
    runWrite(db, OUTBOX, (store, mark) => {
      mark(store.delete(id))
    }),
  )
}

export function resetPhoneWindowCacheForTests(): void {
  memorySlices.clear()
  memoryOutbox.splice(0, memoryOutbox.length)
}
