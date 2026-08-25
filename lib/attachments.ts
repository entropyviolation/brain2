/**
 * lib/attachments.ts — Blob store behind FileValue.uri
 *
 * File bytes used to live as data URLs inside the Zustand JSON (localStorage,
 * ~5–10MB origin quota). New attachments are stored in IndexedDB (or an
 * in-memory map when IDB is missing — tests/SSR) and `FileValue.uri` holds
 * `idb:<id>`. Existing `data:` URLs keep working and are migrated on hydrate.
 *
 * Electron's renderer is Chromium, so IndexedDB is the shared web/desktop path.
 * A native userData file store can reuse the same uri field later.
 */
import type { FileValue, Task } from "@/lib/types"

export const ATTACHMENT_URI_PREFIX = "idb:"
const DB_NAME = "cogs-attachments"
const DB_VERSION = 1
const STORE_NAME = "blobs"

export type AttachmentExport = {
  name: string
  mime: string
  dataUrl: string
}

export type AttachmentRecord = {
  id: string
  name: string
  mime: string
  blob: Blob
}

const memory = new Map<string, AttachmentRecord>()

export function isAttachmentRef(uri: string | undefined | null): boolean {
  return typeof uri === "string" && uri.startsWith(ATTACHMENT_URI_PREFIX)
}

export function isDataUrl(uri: string | undefined | null): boolean {
  return typeof uri === "string" && uri.startsWith("data:")
}

export function attachmentIdFromUri(uri: string): string | null {
  if (!isAttachmentRef(uri)) return null
  return uri.slice(ATTACHMENT_URI_PREFIX.length) || null
}

export function attachmentUri(id: string): string {
  return `${ATTACHMENT_URI_PREFIX}${id}`
}

function isFileValue(v: unknown): v is FileValue {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    typeof (v as FileValue).uri === "string" &&
    typeof (v as FileValue).mime === "string"
  )
}

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
    req.onerror = () => reject(req.error ?? new Error("Failed to open attachment store"))
  })
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",")
  if (comma === -1 || !dataUrl.startsWith("data:")) return new Blob()
  const meta = dataUrl.slice(5, comma)
  const data = dataUrl.slice(comma + 1)
  const mime = meta.split(";")[0] || "application/octet-stream"
  if (/;base64/i.test(meta)) {
    const binary = atob(data)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type: mime })
  }
  try {
    return new Blob([decodeURIComponent(data)], { type: mime })
  } catch {
    return new Blob([data], { type: mime })
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read blob"))
    reader.readAsDataURL(blob)
  })
}

export async function putAttachment(id: string, blob: Blob, meta: { name: string; mime: string }): Promise<string> {
  const record: AttachmentRecord = {
    id,
    name: meta.name || "file",
    mime: meta.mime || blob.type || "application/octet-stream",
    blob,
  }
  if (!idbAvailable()) {
    memory.set(id, record)
    return attachmentUri(id)
  }
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite")
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error("Failed to store attachment"))
      tx.onabort = () => reject(tx.error ?? new Error("Attachment store aborted"))
      tx.objectStore(STORE_NAME).put(record)
    })
  } finally {
    db.close()
  }
  return attachmentUri(id)
}

export async function getAttachment(uri: string): Promise<AttachmentRecord | null> {
  if (isDataUrl(uri)) {
    return {
      id: "inline",
      name: "file",
      mime: uri.slice(5).split(";")[0] || "application/octet-stream",
      blob: dataUrlToBlob(uri),
    }
  }
  const id = attachmentIdFromUri(uri)
  if (!id) return null
  const fromMemory = memory.get(id)
  if (fromMemory) return fromMemory
  if (!idbAvailable()) return null
  const db = await openDb()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly")
      const req = tx.objectStore(STORE_NAME).get(id)
      req.onsuccess = () => resolve((req.result as AttachmentRecord | undefined) ?? null)
      req.onerror = () => reject(req.error ?? new Error("Failed to read attachment"))
    })
  } finally {
    db.close()
  }
}

export async function getAttachmentDataUrl(uri: string): Promise<string> {
  if (isDataUrl(uri)) return uri
  const rec = await getAttachment(uri)
  if (!rec) return ""
  return blobToDataUrl(rec.blob)
}

export async function getAttachmentObjectUrl(uri: string): Promise<string> {
  if (isDataUrl(uri) || uri.startsWith("blob:") || uri.startsWith("http")) return uri
  const rec = await getAttachment(uri)
  if (!rec) return ""
  return URL.createObjectURL(rec.blob)
}

export async function deleteAttachment(uri: string): Promise<void> {
  const id = attachmentIdFromUri(uri)
  if (!id) return
  memory.delete(id)
  if (!idbAvailable()) return
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite")
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error("Failed to delete attachment"))
      tx.objectStore(STORE_NAME).delete(id)
    })
  } finally {
    db.close()
  }
}

export async function exportAllAttachments(): Promise<Record<string, AttachmentExport>> {
  const records: AttachmentRecord[] = [...memory.values()]
  if (idbAvailable()) {
    const db = await openDb()
    try {
      const fromDb = await new Promise<AttachmentRecord[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly")
        const req = tx.objectStore(STORE_NAME).getAll()
        req.onsuccess = () => resolve((req.result as AttachmentRecord[]) ?? [])
        req.onerror = () => reject(req.error ?? new Error("Failed to export attachments"))
      })
      const seen = new Set(records.map((r) => r.id))
      for (const rec of fromDb) {
        if (!seen.has(rec.id)) records.push(rec)
      }
    } finally {
      db.close()
    }
  }
  const out: Record<string, AttachmentExport> = {}
  for (const rec of records) {
    out[rec.id] = {
      name: rec.name,
      mime: rec.mime,
      dataUrl: await blobToDataUrl(rec.blob),
    }
  }
  return out
}

export async function clearAllAttachments(): Promise<void> {
  memory.clear()
  if (!idbAvailable()) return
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite")
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error("Failed to clear attachments"))
      tx.objectStore(STORE_NAME).clear()
    })
  } finally {
    db.close()
  }
}

export async function importAttachments(attachments: Record<string, AttachmentExport>): Promise<void> {
  for (const [id, rec] of Object.entries(attachments)) {
    const blob = dataUrlToBlob(rec.dataUrl)
    await putAttachment(id, blob, { name: rec.name, mime: rec.mime })
  }
}

export async function replaceAllAttachments(attachments: Record<string, AttachmentExport>): Promise<void> {
  await clearAllAttachments()
  await importAttachments(attachments)
}

export async function migrateFileValue(file: FileValue): Promise<{ file: FileValue; migrated: boolean }> {
  if (!isDataUrl(file.uri)) return { file, migrated: false }
  const id = file.id || `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const blob = dataUrlToBlob(file.uri)
  const uri = await putAttachment(id, blob, { name: file.name, mime: file.mime })
  return { file: { ...file, id, uri }, migrated: true }
}

export async function migrateTaskFileValues(tasks: Task[]): Promise<{ tasks: Task[]; migrated: number }> {
  let migrated = 0
  const next = await Promise.all(
    tasks.map(async (task) => {
      const attrs = task.attributes
      if (!attrs) return task
      let changed = false
      const nextAttrs: Record<string, (typeof attrs)[string]> = { ...attrs }
      for (const [key, value] of Object.entries(attrs)) {
        if (isFileValue(value)) {
          const result = await migrateFileValue(value)
          if (result.migrated) {
            nextAttrs[key] = result.file
            changed = true
            migrated += 1
          }
        } else if (Array.isArray(value) && value.some(isFileValue)) {
          const files = await Promise.all(
            value.map(async (entry) => {
              if (!isFileValue(entry)) return entry
              const result = await migrateFileValue(entry)
              if (result.migrated) {
                changed = true
                migrated += 1
              }
              return result.file
            }),
          )
          nextAttrs[key] = files as typeof value
        }
      }
      return changed ? { ...task, attributes: nextAttrs } : task
    }),
  )
  return { tasks: next, migrated }
}
