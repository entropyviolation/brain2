/**
 * lib/doc-persist.ts — IndexedDB store for Docs HTML bodies
 *
 * Document HTML (especially with inline images) is too large for the Zustand
 * localStorage blob (~5–10MB origin quota). New documents were reporting
 * "Saved" after an in-memory task-store write even when persist failed, so
 * they vanished on refresh.
 *
 * IndexedDB is the canonical copy of each Docs note. The task store keeps a
 * lightweight preview for lists/search. A memory map covers tests/SSR.
 */
import { NOTE_ATTR, NOTE_TYPE_ID } from "@/lib/note-types"
import { isAllowedFont } from "@/lib/google-fonts"
import type { Task } from "@/lib/types"

const DB_NAME = "cogs-docs"
const DB_VERSION = 1
const STORE_NAME = "documents"

/** Keep task-store `body` small so localStorage persist can still succeed. */
export const DOC_BODY_PREVIEW_LIMIT = 8000

export interface PersistedDoc {
  id: string
  title: string
  folder: string
  fontFamily: string
  status: string
  body: string
  createdAt: string
  updatedAt: string
}

const memory = new Map<string, PersistedDoc>()
const writeChains = new Map<string, Promise<void>>()

function idbAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB != null
  } catch {
    return false
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error("Failed to open docs store"))
  })
}

/** Strip data-URL images and truncate so the task-store copy stays small. */
export function previewDocBody(html: string): string {
  const stripped = html.replace(/src="data:image\/[^"]+"/gi, 'src="" data-doc-img="1"')
  if (stripped.length <= DOC_BODY_PREVIEW_LIMIT) return stripped
  return `${stripped.slice(0, DOC_BODY_PREVIEW_LIMIT)}<!--cogs-doc-truncated-->`
}

export function taskToPersistedDoc(task: Task, bodyOverride?: string): PersistedDoc {
  const body = bodyOverride ?? task.body ?? ""
  const created =
    task.createdAt instanceof Date ? task.createdAt.toISOString() : new Date(task.createdAt).toISOString()
  const updatedRaw = task.attributes?.[NOTE_ATTR.updatedAt]
  const updated = typeof updatedRaw === "string" && updatedRaw ? updatedRaw : created
  const folder = task.attributes?.[NOTE_ATTR.folder]
  const font = task.attributes?.[NOTE_ATTR.fontFamily]
  const status = task.attributes?.[NOTE_ATTR.status]
  return {
    id: task.id,
    title: task.description || "Untitled document",
    folder: typeof folder === "string" ? folder.trim() : "",
    fontFamily: typeof font === "string" && isAllowedFont(font) ? font : "Merriweather",
    status: typeof status === "string" ? status : "draft",
    body,
    createdAt: created,
    updatedAt: updated,
  }
}

export async function putPersistedDoc(doc: PersistedDoc): Promise<void> {
  const record: PersistedDoc = { ...doc, updatedAt: doc.updatedAt || new Date().toISOString() }
  memory.set(record.id, record)
  const prev = writeChains.get(record.id) ?? Promise.resolve()
  const next = prev.then(
    () => persistRecord(record),
    () => persistRecord(record),
  )
  writeChains.set(record.id, next)
  await next
}

async function persistRecord(record: PersistedDoc): Promise<void> {
  // Always keep the latest in-memory snapshot; skip IDB if a newer write already landed.
  const latest = memory.get(record.id)
  if (latest && latest.updatedAt > record.updatedAt) return
  if (!idbAvailable()) return
  const db = await openDb()
  try {
    const toWrite = memory.get(record.id) ?? record
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite")
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error("Failed to store document"))
      tx.onabort = () => reject(tx.error ?? new Error("Document store aborted"))
      tx.objectStore(STORE_NAME).put(toWrite)
    })
  } finally {
    db.close()
  }
}

export async function getPersistedDoc(id: string): Promise<PersistedDoc | null> {
  const fromMemory = memory.get(id)
  if (fromMemory) return fromMemory
  if (!idbAvailable()) return null
  const db = await openDb()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly")
      const req = tx.objectStore(STORE_NAME).get(id)
      req.onsuccess = () => {
        const rec = (req.result as PersistedDoc | undefined) ?? null
        if (rec) memory.set(rec.id, rec)
        resolve(rec)
      }
      req.onerror = () => reject(req.error ?? new Error("Failed to read document"))
    })
  } finally {
    db.close()
  }
}

export async function deletePersistedDoc(id: string): Promise<void> {
  memory.delete(id)
  if (!idbAvailable()) return
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite")
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error("Failed to delete document"))
      tx.objectStore(STORE_NAME).delete(id)
    })
  } finally {
    db.close()
  }
}

export async function listPersistedDocs(): Promise<PersistedDoc[]> {
  if (!idbAvailable()) return [...memory.values()]
  const db = await openDb()
  try {
    const fromDb = await new Promise<PersistedDoc[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly")
      const req = tx.objectStore(STORE_NAME).getAll()
      req.onsuccess = () => resolve((req.result as PersistedDoc[]) ?? [])
      req.onerror = () => reject(req.error ?? new Error("Failed to list documents"))
    })
    for (const rec of fromDb) memory.set(rec.id, rec)
    const seen = new Set(fromDb.map((r) => r.id))
    for (const rec of memory.values()) {
      if (!seen.has(rec.id)) fromDb.push(rec)
    }
    return fromDb
  } finally {
    db.close()
  }
}

export async function clearAllPersistedDocs(): Promise<void> {
  memory.clear()
  if (!idbAvailable()) return
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite")
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error("Failed to clear documents"))
      tx.objectStore(STORE_NAME).clear()
    })
  } finally {
    db.close()
  }
}

export async function replaceAllPersistedDocs(docs: PersistedDoc[]): Promise<void> {
  await clearAllPersistedDocs()
  for (const doc of docs) await putPersistedDoc(doc)
}

export function persistedDocToTask(doc: PersistedDoc): Task {
  return {
    id: doc.id,
    description: doc.title || "Untitled document",
    type: NOTE_TYPE_ID,
    stage: "list",
    createdAt: new Date(doc.createdAt),
    completed: false,
    lists: [],
    body: previewDocBody(doc.body),
    attributes: {
      [NOTE_ATTR.status]: doc.status || "draft",
      [NOTE_ATTR.folder]: doc.folder || "",
      [NOTE_ATTR.fontFamily]: isAllowedFont(doc.fontFamily) ? doc.fontFamily : "Merriweather",
      [NOTE_ATTR.updatedAt]: doc.updatedAt,
    },
    links: [],
    tags: ["docs"],
  }
}
