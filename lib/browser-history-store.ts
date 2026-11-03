/**
 * lib/browser-history-store.ts — Chrome visits kept on this computer.
 *
 * IndexedDB `brain2-browser-history`, key `visits`. A later file only adds
 * visits. The old key `all` (one array of files) is read once and folded in.
 */
import { mergeInto, type HistoryFile, type Visit } from "@/lib/browser-history"

const DB = "brain2-browser-history"

function idb<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1)
    open.onupgradeneeded = () => open.result.createObjectStore("files")
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const req = run(open.result.transaction("files", mode).objectStore("files"))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    }
  })
}

export async function loadKeptVisits(): Promise<Visit[]> {
  const kept = await idb<Visit[] | undefined>("readonly", (store) => store.get("visits") as IDBRequest<Visit[] | undefined>)
  if (kept) return kept
  const old = await idb<HistoryFile[] | undefined>("readonly", (store) => store.get("all") as IDBRequest<HistoryFile[] | undefined>)
  const migrated = old?.length ? mergeInto([], old) : []
  if (migrated.length) await idb("readwrite", (store) => store.put(migrated, "visits")).catch(() => {})
  return migrated
}

export async function saveKeptVisits(visits: Visit[]): Promise<void> {
  await idb("readwrite", (store) => store.put(visits, "visits"))
}

/** Merge files into the kept set. The same array comes back when nothing was new. */
export async function addHistoryFiles(files: HistoryFile[]): Promise<{ added: number; visits: Visit[] }> {
  const base = await loadKeptVisits()
  const next = mergeInto(base, files)
  if (next === base) return { added: 0, visits: base }
  await saveKeptVisits(next)
  return { added: next.length - base.length, visits: next }
}
