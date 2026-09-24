/**
 * lib/ingest/apply-scan-doc.ts — Park a scan as a real Docs note
 *
 * Same parking idea as From Notes: a `note` Item with searchable HTML, not a
 * camera-roll leftover. Optional PDF lives in the attachment blob store.
 */
import { putAttachment, attachmentUri } from "@/lib/attachments"
import { previewDocBody, putPersistedDoc, taskToPersistedDoc } from "@/lib/doc-persist"
import { NOTE_ATTR, NOTE_TYPE_ID } from "@/lib/note-types"
import { useTaskStore } from "@/lib/task-store"
import type { FileValue, Task } from "@/lib/types"

export const SCAN_DOCS_FOLDER = "From phone"

function genId(prefix: string) {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `${prefix}_${crypto.randomUUID()}`
    }
  } catch {
    /* fall through */
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function parkScanDocument(opts: {
  title: string
  body: string
  folder?: string
  scanPdf?: FileValue
  extractedText?: string
  now?: Date
}): Task {
  const now = opts.now ?? new Date()
  const title = opts.title.trim() || "Untitled scan"
  const folder = (opts.folder ?? SCAN_DOCS_FOLDER).trim()
  const doc: Task = {
    id: genId("doc"),
    description: title,
    type: NOTE_TYPE_ID,
    stage: "list",
    createdAt: now,
    completed: false,
    lists: [],
    body: previewDocBody(opts.body),
    attributes: {
      [NOTE_ATTR.status]: "draft",
      [NOTE_ATTR.folder]: folder,
      [NOTE_ATTR.fontFamily]: "Merriweather",
      [NOTE_ATTR.updatedAt]: now.toISOString(),
      [NOTE_ATTR.summary]: opts.extractedText?.slice(0, 240) || undefined,
      ...(opts.scanPdf ? { scanPdf: opts.scanPdf } : {}),
    },
    links: [],
    tags: ["docs", "scan"],
  }
  useTaskStore.getState().addTask(doc)
  void putPersistedDoc(taskToPersistedDoc(doc, opts.body))
  return doc
}

export async function createScanDocument(opts: {
  title: string
  body: string
  folder?: string
  pdf?: { bytes: Uint8Array; name: string; extractedText?: string }
  now?: Date
}): Promise<Task> {
  let scanPdf: FileValue | undefined
  if (opts.pdf && opts.pdf.bytes.length > 0) {
    const id = genId("scan")
    const copy = new Uint8Array(opts.pdf.bytes.byteLength)
    copy.set(opts.pdf.bytes)
    const blob = new Blob([copy], { type: "application/pdf" })
    const uri = await putAttachment(id, blob, { name: opts.pdf.name, mime: "application/pdf" })
    scanPdf = {
      id,
      name: opts.pdf.name,
      mime: "application/pdf",
      uri: uri || attachmentUri(id),
      size: opts.pdf.bytes.byteLength,
      extractedText: opts.pdf.extractedText,
    }
  }
  return parkScanDocument({
    title: opts.title,
    body: opts.body,
    folder: opts.folder,
    scanPdf,
    extractedText: opts.pdf?.extractedText,
    now: opts.now,
  })
}
