/**
 * lib/ingest/apply-iphone-notes.ts — Park iOS Shortcut note dumps
 *
 * Telegram cannot read Notes.app. The iPhone Shortcut sends `iphone-notes:`
 * wire-format text (one note per message, continuations for long bodies).
 * This module parks the full note on Lists → iPhone Notes Store → Parked.
 */
import {
  APPLE_NOTE_ATTR,
  IPHONE_NOTES_STORE_FOLDER_NAME,
  IPHONE_NOTES_STORE_SOURCE,
  ensureIphoneNotesStoreDestination,
  ingestedIphoneNoteIds,
  iphoneNoteAttrId,
  noteDisplayTitle,
  noteToParkedItem,
  persistIphoneNoteIds,
  type AppleNote,
} from "@/lib/apple-notes"
import { useTaskStore } from "@/lib/task-store"
import { taskStoreMutators } from "./apply-capture"
import type { ApplyResult } from "./types"

const PART_RE = /^\s*(\d+)\s*\/\s*(\d+)\s*:?\s*/

export interface IphoneNoteDump {
  id: string
  title: string
  folder: string
  account: string
  createdAt: string
  modifiedAt: string
  body: string
  partIndex: number
  partTotal: number
}

export type ParseIphoneNoteDumpResult =
  | { ok: true; dump: IphoneNoteDump }
  | { ok: false; error: string }

type PendingDump = {
  total: number
  parts: Map<number, string>
  dump: IphoneNoteDump
}

const pendingById = new Map<string, PendingDump>()

/** Test hook — continuation buffers are in-memory only. */
export function resetIphoneNoteContinuations(): void {
  pendingById.clear()
}

export function parseIphoneNoteDump(payload: string): ParseIphoneNoteDumpResult {
  let rest = String(payload ?? "").replace(/^\uFEFF/, "")
  if (!rest.trim()) {
    return { ok: false, error: "Nothing to park. Send iphone-notes: then id/title headers and the note body." }
  }

  let partIndex = 1
  let partTotal = 1
  const partHit = rest.match(PART_RE)
  if (partHit) {
    partIndex = Number(partHit[1])
    partTotal = Number(partHit[2])
    if (!Number.isInteger(partIndex) || !Number.isInteger(partTotal) || partIndex < 1 || partTotal < 1) {
      return { ok: false, error: "iphone-notes continuation must look like 2/3." }
    }
    if (partIndex > partTotal) {
      return { ok: false, error: `iphone-notes part ${partIndex}/${partTotal} is past the end.` }
    }
    rest = rest.slice(partHit[0].length)
  }

  const sep = rest.search(/^\s*---\s*$/m)
  let headerBlock = rest
  let body = ""
  if (sep >= 0) {
    headerBlock = rest.slice(0, sep)
    body = rest.slice(sep).replace(/^\s*---\s*/, "")
  } else {
    const blank = rest.search(/\n[ \t]*\n/)
    if (blank >= 0) {
      headerBlock = rest.slice(0, blank)
      body = rest.slice(blank).replace(/^\s+/, "")
    }
  }

  const headers = parseHeaders(headerBlock)
  const title = String(headers.title || "").trim()
  const folder = String(headers.folder || "").trim()
  const modifiedAt = String(headers.modified || headers.modifiedat || "").trim()
  // NoteEntity no longer exposes Identifier. The Shortcut sends Name|Folder|Modified.
  // Also accept a missing id when title/body still identify the note.
  const id = resolveDumpId(headers.id, title, folder, modifiedAt, body)
  if (!id) {
    return {
      ok: false,
      error:
        "iphone-notes needs an id: header (Name|Folder|Modified from the Shortcut) or a title/body to park.",
    }
  }

  return {
    ok: true,
    dump: {
      id,
      title,
      folder,
      account: headers.account || "On My iPhone",
      createdAt: headers.created || headers.createdat || "",
      modifiedAt,
      body,
      partIndex,
      partTotal,
    },
  }
}

/** Empty / pipe-only ids from broken magic variables are treated as missing. */
function resolveDumpId(
  rawId: string | undefined,
  title: string,
  folder: string,
  modifiedAt: string,
  body: string,
): string {
  const explicit = String(rawId ?? "").trim()
  if (explicit && !/^\|+$/.test(explicit)) return explicit
  const composite = [title, folder, modifiedAt].filter((p) => p.length > 0).join("|")
  if (composite) return composite
  const snippet = String(body ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 48)
  return snippet ? `body:${snippet}` : ""
}

export function applyIphoneNotes(payload: string, now = new Date()): ApplyResult {
  const parsed = parseIphoneNoteDump(payload)
  if (!parsed.ok) {
    return { status: "error", kind: "iphone-notes", reply: parsed.error }
  }

  let dump = parsed.dump
  const attrId = iphoneNoteAttrId(dump.id)
  const title = dumpTitle(dump)

  const existing = ingestedIphoneNoteIds(useTaskStore.getState().tasks)
  if (existing.has(attrId)) {
    pendingById.delete(attrId)
    return {
      status: "ok",
      kind: "iphone-notes",
      reply: `Already stored: ${title}`,
      summary: `Already stored ${title}`,
    }
  }

  if (dump.partTotal > 1) {
    const assembled = assembleContinuation(dump, attrId)
    if (assembled.status === "waiting") {
      return {
        status: "ok",
        kind: "iphone-notes",
        reply: `Got part ${dump.partIndex}/${dump.partTotal} of ${title}. Send the rest.`,
        summary: `Part ${dump.partIndex}/${dump.partTotal} of ${title}`,
      }
    }
    dump = assembled.dump
  }

  return parkDump(dump, attrId, now)
}

function assembleContinuation(
  dump: IphoneNoteDump,
  attrId: string,
): { status: "waiting" } | { status: "ready"; dump: IphoneNoteDump } {
  const pending = pendingById.get(attrId) ?? {
    total: dump.partTotal,
    parts: new Map<number, string>(),
    dump,
  }
  pending.total = dump.partTotal
  pending.parts.set(dump.partIndex, dump.body)
  pending.dump = mergeDumpHeaders(pending.dump, dump)
  pendingById.set(attrId, pending)

  for (let i = 1; i <= pending.total; i++) {
    if (!pending.parts.has(i)) return { status: "waiting" }
  }

  const bodies: string[] = []
  for (let i = 1; i <= pending.total; i++) bodies.push(pending.parts.get(i) ?? "")
  pendingById.delete(attrId)
  return {
    status: "ready",
    dump: { ...pending.dump, body: bodies.join(""), partIndex: pending.total, partTotal: pending.total },
  }
}

/**
 * Park free text that named nothing in the vault. The Mac From Notes rule:
 * keep the words and sort them in the app, rather than interrogating the
 * sender with a list of near-misses.
 */
export function parkLooseText(text: string, now = new Date()): ApplyResult {
  const body = String(text ?? "").trim()
  if (!body) {
    return { status: "error", kind: "iphone-notes", reply: "Nothing to park." }
  }
  const id = `loose-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  return parkDump(
    {
      id,
      title: "",
      folder: "",
      account: "Telegram",
      createdAt: now.toISOString(),
      modifiedAt: now.toISOString(),
      body,
      partIndex: 1,
      partTotal: 1,
    },
    iphoneNoteAttrId(id),
    now,
  )
}

function parkDump(dump: IphoneNoteDump, attrId: string, now: Date): ApplyResult {
  const mut = taskStoreMutators()
  const { list } = ensureIphoneNotesStoreDestination(mut)
  const note: AppleNote = {
    id: attrId,
    title: dump.title,
    body: dump.body,
    folder: dump.folder,
    account: dump.account,
    createdAt: dump.createdAt || now.toISOString(),
    modifiedAt: dump.modifiedAt || now.toISOString(),
  }
  const item = noteToParkedItem(note, list, IPHONE_NOTES_STORE_SOURCE)
  useTaskStore.getState().addTask(item)
  persistIphoneNoteIds([attrId])
  const title = noteDisplayTitle(note)
  return {
    status: "ok",
    kind: "iphone-notes",
    reply: `Parked in ${IPHONE_NOTES_STORE_FOLDER_NAME}: ${title}`,
    summary: `Parked ${title}`,
    itemIds: [item.id],
  }
}

function mergeDumpHeaders(base: IphoneNoteDump, incoming: IphoneNoteDump): IphoneNoteDump {
  return {
    ...base,
    title: base.title || incoming.title,
    folder: base.folder || incoming.folder,
    account: base.account || incoming.account,
    createdAt: base.createdAt || incoming.createdAt,
    modifiedAt: base.modifiedAt || incoming.modifiedAt,
    partTotal: incoming.partTotal || base.partTotal,
  }
}

function dumpTitle(dump: IphoneNoteDump): string {
  return noteDisplayTitle({ title: dump.title, body: dump.body })
}

function parseHeaders(block: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of String(block || "").split("\n")) {
    const m = line.match(/^\s*([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/)
    if (!m) continue
    out[m[1].toLowerCase()] = m[2].trim()
  }
  return out
}

export function parkedIphoneNoteAttrId(task: { attributes?: Record<string, unknown> }): string | null {
  const source = task.attributes?.[APPLE_NOTE_ATTR.source]
  const id = task.attributes?.[APPLE_NOTE_ATTR.id]
  if (source !== IPHONE_NOTES_STORE_SOURCE || typeof id !== "string" || !id) return null
  return iphoneNoteAttrId(id)
}
