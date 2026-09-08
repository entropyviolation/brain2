/**
 * lib/doc-hydrate.ts — Merge IndexedDB Docs records into the task store
 *
 * Restores notes that were lost when localStorage persist failed (quota), and
 * copies legacy task-store notes into IndexedDB on first run.
 */
import { useTaskStore } from "@/lib/task-store"
import { NOTE_ATTR, NOTE_TYPE_ID } from "@/lib/note-types"
import { isAllowedFont } from "@/lib/google-fonts"
import {
  listPersistedDocs,
  persistedDocToTask,
  previewDocBody,
  putPersistedDoc,
  taskToPersistedDoc,
} from "@/lib/doc-persist"

const BLANK_BODY = "<p><br></p>"

function folderOf(doc: { attributes?: Record<string, unknown> }): string {
  const raw = doc.attributes?.[NOTE_ATTR.folder]
  return typeof raw === "string" ? raw.trim() : ""
}

function fontOf(doc: { attributes?: Record<string, unknown> }): string {
  const raw = doc.attributes?.[NOTE_ATTR.fontFamily]
  return typeof raw === "string" && isAllowedFont(raw) ? raw : "Merriweather"
}

function statusOf(doc: { attributes?: Record<string, unknown> }): string {
  const raw = doc.attributes?.[NOTE_ATTR.status]
  return typeof raw === "string" ? raw : "draft"
}

export async function hydrateDocumentsFromIdb(): Promise<void> {
  const store = useTaskStore.getState()
  const records = await listPersistedDocs()
  const byId = new Map(records.map((r) => [r.id, r]))

  for (const rec of records) {
    const existing = store.tasks.find((t) => t.id === rec.id)
    const asTask = persistedDocToTask(rec)
    if (!existing) {
      store.addTask(asTask)
      continue
    }
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
      folderOf(existing) !== rec.folder ||
      fontOf(existing) !== rec.fontFamily ||
      statusOf(existing) !== rec.status
    ) {
      store.updateTask(next)
    }
  }

  for (const task of store.tasks) {
    if (task.type !== NOTE_TYPE_ID) continue
    if (byId.has(task.id)) continue
    const record = taskToPersistedDoc(task, task.body ?? BLANK_BODY)
    await putPersistedDoc(record)
  }
}
