/**
 * components/Docs/doc-actions.ts — Create / rename / folder / font mutations
 *
 * Imperative helpers for the Docs tab. They only CALL `useTaskStore` actions and
 * never edit store files. Notes are `type: "note"` items (see `lib/note-types.ts`).
 */
"use client"

import { useTaskStore } from "@/lib/task-store"
import { NOTE_TYPE_ID, NOTE_ATTR } from "@/lib/note-types"
import type { Task } from "@/lib/types"
import { isAllowedFont } from "@/lib/google-fonts"

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

const STARTER_BODY = `<h1>Welcome to Brainclip Docs</h1>
<p>Plan, write, and organize documents in a single rich-text page — highlight any text to change <strong>font</strong> or <strong>size</strong>, like Google Docs.</p>
<h2>Quick tips</h2>
<ul>
<li>Use the toolbar for bold, italic, headings, and lists</li>
<li>Highlight a phrase → pick <em>Font</em> or <em>Size</em> (only that selection)</li>
<li>Use <em>H-font</em> to style the current heading differently</li>
<li>Upload images from your computer or phone, or paste a screenshot</li>
<li>Upload a PDF to ingest it as editable text (best-effort formatting)</li>
</ul>
<p>Start writing your plan below.</p>`

/** Create a new Docs note; returns the created task. */
export function createDocument(title = "Untitled document", folder = ""): Task {
  const store = useTaskStore.getState()
  const doc: Task = {
    id: genId("doc"),
    description: title.trim() || "Untitled document",
    type: NOTE_TYPE_ID,
    stage: "list",
    createdAt: new Date(),
    completed: false,
    lists: [],
    body: STARTER_BODY,
    attributes: {
      [NOTE_ATTR.status]: "draft",
      [NOTE_ATTR.folder]: folder.trim(),
      [NOTE_ATTR.fontFamily]: "Merriweather",
    },
    links: [],
    tags: ["docs"],
  }
  store.addTask(doc)
  return doc
}

export function renameDocument(docId: string, title: string): void {
  const next = title.trim()
  if (!next) return
  const store = useTaskStore.getState()
  const doc = store.tasks.find((t) => t.id === docId)
  if (!doc) return
  store.updateTask({ ...doc, description: next })
}

export function setDocumentFolder(docId: string, folder: string): void {
  const store = useTaskStore.getState()
  const doc = store.tasks.find((t) => t.id === docId)
  if (!doc) return
  store.updateTask({
    ...doc,
    attributes: { ...(doc.attributes ?? {}), [NOTE_ATTR.folder]: folder.trim() },
  })
}

export function setDocumentFont(docId: string, font: string): void {
  if (!isAllowedFont(font)) return
  const store = useTaskStore.getState()
  const doc = store.tasks.find((t) => t.id === docId)
  if (!doc) return
  store.updateTask({
    ...doc,
    attributes: { ...(doc.attributes ?? {}), [NOTE_ATTR.fontFamily]: font },
  })
}

export function setDocumentBody(docId: string, body: string): void {
  const store = useTaskStore.getState()
  const doc = store.tasks.find((t) => t.id === docId)
  if (!doc || doc.body === body) return
  store.updateTask({ ...doc, body })
}

export function setDocumentStatus(docId: string, status: "draft" | "evergreen" | "archived"): void {
  const store = useTaskStore.getState()
  const doc = store.tasks.find((t) => t.id === docId)
  if (!doc) return
  store.updateTask({
    ...doc,
    attributes: { ...(doc.attributes ?? {}), [NOTE_ATTR.status]: status },
  })
}

export function deleteDocument(docId: string): void {
  useTaskStore.getState().deleteTask(docId)
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
