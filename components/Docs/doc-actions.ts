/**
 * components/Docs/doc-actions.ts — Create / rename / folder / font mutations
 *
 * Imperative helpers for the Docs tab. They CALL `useTaskStore` actions and
 * also write the canonical HTML body to IndexedDB (`lib/doc-persist.ts`) so
 * new documents survive refresh even when localStorage quota is exhausted.
 */
"use client"

import { useTaskStore } from "@/lib/task-store"
import { NOTE_TYPE_ID, NOTE_ATTR } from "@/lib/note-types"
import type { Task } from "@/lib/types"
import { isAllowedFont } from "@/lib/google-fonts"
import {
  deletePersistedDoc,
  getPersistedDoc,
  listPersistedDocs,
  persistedDocToTask,
  previewDocBody,
  putPersistedDoc,
  taskToPersistedDoc,
} from "@/lib/doc-persist"
import { hydrateDocumentsFromIdb } from "@/lib/doc-hydrate"
import { pdfArrayBufferToHtml } from "@/lib/pdf-to-html"

function genId(prefix = "doc"): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `${prefix}_${crypto.randomUUID()}`
    }
  } catch {
    /* fall through */
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

const BLANK_BODY = "<p><br></p>"

function stampUpdated(doc: Task, extra?: Record<string, string | number | boolean | undefined>): Task {
  return {
    ...doc,
    attributes: {
      ...(doc.attributes ?? {}),
      ...(extra ?? {}),
      [NOTE_ATTR.updatedAt]: new Date().toISOString(),
    },
  }
}

async function writePersisted(doc: Task, body?: string): Promise<void> {
  const record = taskToPersistedDoc(doc, body)
  record.updatedAt = new Date().toISOString()
  await putPersistedDoc(record)
}

/** Create a new Docs note; returns the created task. Persists to IndexedDB. */
export function createDocument(title = "Untitled document", folder = "", body = BLANK_BODY): Task {
  const store = useTaskStore.getState()
  const now = new Date()
  const doc: Task = {
    id: genId("doc"),
    description: title.trim() || "Untitled document",
    type: NOTE_TYPE_ID,
    stage: "list",
    createdAt: now,
    completed: false,
    lists: [],
    body: previewDocBody(body),
    attributes: {
      [NOTE_ATTR.status]: "draft",
      [NOTE_ATTR.folder]: folder.trim(),
      [NOTE_ATTR.fontFamily]: "Merriweather",
      [NOTE_ATTR.updatedAt]: now.toISOString(),
    },
    links: [],
    tags: ["docs"],
  }
  store.addTask(doc)
  void writePersisted(doc, body)
  return doc
}

/** Create a note from an uploaded PDF (new document, not an insert). */
export async function createDocumentFromPdf(file: File, folder = ""): Promise<Task> {
  const buf = await file.arrayBuffer()
  const result = await pdfArrayBufferToHtml(buf)
  const title = file.name.replace(/\.pdf$/i, "").trim() || "Untitled document"
  const header = `<p><strong>From PDF: ${file.name.replace(/</g, "")}</strong></p>`
  const body = `${header}${result.html}`
  const doc = createDocument(title, folder, body)
  if (result.dominantFont) setDocumentFont(doc.id, result.dominantFont)
  await writePersisted(
    useTaskStore.getState().tasks.find((t) => t.id === doc.id) ?? doc,
    body,
  )
  return useTaskStore.getState().tasks.find((t) => t.id === doc.id) ?? doc
}

export function renameDocument(docId: string, title: string): void {
  const next = title.trim()
  if (!next) return
  const store = useTaskStore.getState()
  const doc = store.tasks.find((t) => t.id === docId)
  if (!doc) return
  const updated = stampUpdated({ ...doc, description: next })
  store.updateTask(updated)
  void (async () => {
    const rec = await getPersistedDoc(docId)
    await writePersisted(updated, rec?.body ?? doc.body)
  })()
}

export function setDocumentFolder(docId: string, folder: string): void {
  const store = useTaskStore.getState()
  const doc = store.tasks.find((t) => t.id === docId)
  if (!doc) return
  const updated = stampUpdated(doc, { [NOTE_ATTR.folder]: folder.trim() })
  store.updateTask(updated)
  void (async () => {
    const rec = await getPersistedDoc(docId)
    await writePersisted(updated, rec?.body ?? doc.body)
  })()
}

export function setDocumentFont(docId: string, font: string): void {
  if (!isAllowedFont(font)) return
  const store = useTaskStore.getState()
  const doc = store.tasks.find((t) => t.id === docId)
  if (!doc) return
  const updated = stampUpdated(doc, { [NOTE_ATTR.fontFamily]: font })
  store.updateTask(updated)
  void (async () => {
    const rec = await getPersistedDoc(docId)
    await writePersisted(updated, rec?.body ?? doc.body)
  })()
}

export async function setDocumentBody(docId: string, body: string): Promise<boolean> {
  const store = useTaskStore.getState()
  const doc = store.tasks.find((t) => t.id === docId)
  if (!doc) {
    // Task-store persist may have dropped the note; recreate from IDB cache.
    const rec = await getPersistedDoc(docId)
    if (!rec) return false
    const restored = persistedDocToTask({ ...rec, body, updatedAt: new Date().toISOString() })
    store.addTask(restored)
    await writePersisted(restored, body)
    return true
  }
  const updated = stampUpdated({ ...doc, body: previewDocBody(body) })
  store.updateTask(updated)
  await writePersisted(updated, body)
  return true
}

export function setDocumentStatus(docId: string, status: "draft" | "evergreen" | "archived"): void {
  const store = useTaskStore.getState()
  const doc = store.tasks.find((t) => t.id === docId)
  if (!doc) return
  const updated = stampUpdated(doc, { [NOTE_ATTR.status]: status })
  store.updateTask(updated)
  void (async () => {
    const rec = await getPersistedDoc(docId)
    await writePersisted(updated, rec?.body ?? doc.body)
  })()
}

export function deleteDocument(docId: string): void {
  useTaskStore.getState().deleteTask(docId)
  void deletePersistedDoc(docId)
}

/** Load the canonical HTML body (IndexedDB), falling back to the task preview. */
export async function loadDocumentBody(docId: string, fallback = ""): Promise<string> {
  const rec = await getPersistedDoc(docId)
  if (rec?.body) return rec.body
  return fallback
}

/**
 * Merge IndexedDB docs into the task store (restore notes lost when
 * localStorage persist failed) and copy legacy task-store notes into IDB.
 */
export async function hydrateDocumentsFromIdb(): Promise<void> {
  const store = useTaskStore.getState()
  const records = await listPersistedDocs()
  const byId = new Map(records.map((r) => [r.id, r]))

  for (const rec of records) {
    const existing = store.tasks.find((t) => t.id === rec.id)
    const asTask = persistedDocToTask(rec)
    if (!existing) {
      store.addTask(asTask)
    } else {
      const next = {
        ...existing,
        description: rec.title || existing.description,
        body: previewDocBody(rec.body),
        type: NOTE_TYPE_ID,
        attributes: {
          ...(existing.attributes ?? {}),
          [NOTE_ATTR.folder]: rec.folder,
          [NOTE_ATTR.fontFamily]: rec.fontFamily,
          [NOTE_ATTR.status]: rec.status,
          [NOTE_ATTR.updatedAt]: rec.updatedAt,
        },
      }
      if (
        existing.description !== next.description ||
        existing.body !== next.body ||
        documentFolder(existing) !== rec.folder ||
        documentFont(existing) !== rec.fontFamily ||
        documentStatus(existing) !== rec.status
      ) {
        store.updateTask(next)
      }
    }
  }

  for (const task of store.tasks) {
    if (task.type !== NOTE_TYPE_ID) continue
    if (byId.has(task.id)) continue
    await writePersisted(task, task.body ?? BLANK_BODY)
  }
}

/** Folder label stored on a note, or empty string for Unfiled. */
export function documentFolder(doc: Task): string {
  const raw = doc.attributes?.[NOTE_ATTR.folder]
  return typeof raw === "string" ? raw.trim() : ""
}

export function documentFont(doc: Task): string {
  const raw = doc.attributes?.[NOTE_ATTR.fontFamily]
  return typeof raw === "string" && isAllowedFont(raw) ? raw : "Merriweather"
}

export function documentStatus(doc: Task): string {
  const raw = doc.attributes?.[NOTE_ATTR.status]
  return typeof raw === "string" ? raw : "draft"
}

export function documentUpdatedAt(doc: Task): Date | null {
  const raw = doc.attributes?.[NOTE_ATTR.updatedAt]
  if (typeof raw === "string" && raw) {
    const d = new Date(raw)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt)
}

/** All note-typed items, newest first. */
export function listDocuments(tasks: Task[]): Task[] {
  return tasks
    .filter((t) => t.type === NOTE_TYPE_ID)
    .slice()
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
}

/** Unique folder names (non-empty), sorted. */
export function listDocumentFolders(docs: Task[]): string[] {
  const set = new Set<string>()
  for (const d of docs) {
    const f = documentFolder(d)
    if (f) set.add(f)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}
