/**
 * lib/idea-swarm/store.ts — Where the idea lab keeps its things: configs, passages, gold sets, runs
 *
 * One IndexedDB database with a store per kind, so a run with a long passage never fights localStorage's size. Every
 * call falls back to memory when IndexedDB is missing or blocked (private windows, tests), and the page works for the
 * visit. Values are plain JSON objects with an `id`.
 */

export type Kind = "configs" | "passages" | "golds" | "runs" | "books" | "chunks"
const KINDS: Kind[] = ["configs", "passages", "golds", "runs", "books", "chunks"]
const DB = "brain2-idea-swarm"

const memory: Record<Kind, Map<string, unknown>> = { configs: new Map(), passages: new Map(), golds: new Map(), runs: new Map(), books: new Map(), chunks: new Map() }
let dbp: Promise<IDBDatabase | null> | null = null

function open(): Promise<IDBDatabase | null> {
  if (dbp) return dbp
  dbp = new Promise((ok) => {
    try {
      if (typeof indexedDB === "undefined") return ok(null)
      const req = indexedDB.open(DB, 2)
      req.onupgradeneeded = () => KINDS.forEach((k) => { if (!req.result.objectStoreNames.contains(k)) req.result.createObjectStore(k, { keyPath: "id" }) })
      req.onsuccess = () => ok(req.result)
      req.onerror = () => ok(null)
      req.onblocked = () => ok(null)
    } catch {
      ok(null)
    }
  })
  return dbp
}

function tx<T>(kind: Kind, mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise<T | undefined>((ok) => {
        if (!db) return ok(undefined)
        try {
          const r = f(db.transaction(kind, mode).objectStore(kind))
          r.onsuccess = () => ok(r.result)
          r.onerror = () => ok(undefined)
        } catch {
          ok(undefined)
        }
      }),
  )
}

export async function putOne<T extends { id: string }>(kind: Kind, v: T): Promise<void> {
  memory[kind].set(v.id, v)
  await tx(kind, "readwrite", (s) => s.put(v))
}

export async function allOf<T extends { id: string }>(kind: Kind): Promise<T[]> {
  const got = (await tx(kind, "readonly", (s) => s.getAll() as IDBRequest<T[]>)) ?? [...(memory[kind].values() as Iterable<T>)]
  return got
}

export async function dropOne(kind: Kind, id: string): Promise<void> {
  memory[kind].delete(id)
  await tx(kind, "readwrite", (s) => s.delete(id))
}
