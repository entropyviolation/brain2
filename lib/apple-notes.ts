/**
 * lib/apple-notes.ts — Apple Notes ingest (iCloud / iPhone + On My Mac)
 *
 * Renderer-side types + helpers for the Notes ingest flow. Mac reads happen
 * on this Mac via Notes.app (`electron/apple-notes.js`). Telegram Shortcut
 * dumps land on a separate Lists folder (iPhone Notes Store / Parked) via
 * `ensureIphoneNotesStoreDestination` — that path never talks to Notes.app.
 *
 * Pure helpers (period math, HTML strip, payload parse, item mapping) live here
 * so they stay unit-testable without osascript.
 */
import { addDays, startOfDay } from "date-fns"
import { formatLocalDateKey } from "@/lib/date-utils"
import { createListItem, withCategoryDefaults } from "@/lib/item-utils"
import { parsePathHeader } from "@/lib/smart-parse"
import type { Folder, List, Task } from "@/lib/types"
import { persistKey, readAliasedLocal, writeAliasedLocal } from "@/lib/storage-keys"

/** Attribute keys written onto ingested items so re-runs can skip duplicates. */
export const APPLE_NOTE_ATTR = {
  id: "appleNoteId",
  folder: "appleNotesFolder",
  account: "appleNotesAccount",
  source: "source",
} as const

export const APPLE_NOTES_SOURCE = "apple-notes"

export const IPHONE_NOTES_INGEST_MODULE_ID = "iphone-notes-ingest"
export const IPHONE_NOTES_INGEST_FOLDER_ID = "folder-iphone-notes-ingest"
export const IPHONE_NOTES_INGEST_FOLDER_NAME = "iPhone Notes Ingest"
export const NOTES_TO_INGEST_LIST_ID = "list-notes-to-ingest"
export const NOTES_TO_INGEST_LIST_NAME = "notes to ingest"

/** Telegram Shortcut dumps (On My iPhone) — separate from Mac From Notes parking. */
export const IPHONE_NOTES_STORE_MODULE_ID = "iphone-notes-store"
export const IPHONE_NOTES_STORE_FOLDER_ID = "folder-iphone-notes-store"
export const IPHONE_NOTES_STORE_FOLDER_NAME = "iPhone Notes Store"
export const IPHONE_NOTES_STORE_LIST_ID = "list-iphone-notes-store"
export const IPHONE_NOTES_STORE_LIST_NAME = "Parked"
export const IPHONE_NOTES_STORE_SOURCE = "iphone-notes"
export const IPHONE_NOTE_ID_PREFIX = "iphone:"

/** Simulate / Shortcut example (one note, under Telegram's 4096 cap). */
export const IPHONE_NOTES_DUMP_EXAMPLE = `iphone-notes:
id: example-note
title: Grocery
folder: On My iPhone
account: On My iPhone
---
milk
eggs`

export const FALLBACK_LIST_NAME = "From Notes"

export type NotesPeriodPreset = "24h" | "7d" | "30d" | "90d" | "year" | "custom"

export const NOTES_PERIOD_PRESETS: { id: NotesPeriodPreset; label: string }[] = [
  { id: "24h", label: "Last 24 hours" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "year", label: "This year" },
  { id: "custom", label: "Custom range" },
]

/** A single Apple Note as returned over IPC (JSON-safe). */
export interface AppleNote {
  id: string
  title: string
  body: string
  folder: string
  account: string
  createdAt: string
  modifiedAt: string
  passwordProtected?: boolean
}

export type NotesFetchMode = "preview" | "snippet" | "bodies"

export interface AppleNotesRange {
  sinceISO: string
  untilISO: string
  /** `preview` = titles/dates; `snippet` = short body; `bodies` = full text for `ids`. */
  mode?: NotesFetchMode
  /** Note ids to pull text for when `mode` is `snippet` or `bodies`. */
  ids?: string[]
}

export type FetchAppleNotesResult =
  | { ok: true; notes: AppleNote[] }
  | { ok: false; error: string; code?: string }

/** Minimal shape of the optional Electron desktop bridge we rely on. */
export interface DesktopNotesBridge {
  fetchAppleNotes?: (range: AppleNotesRange) => Promise<FetchAppleNotesResult>
}

export const APPLE_NOTES_HUB_PATH = "/api/notes"

export function getDesktopNotesBridge(): DesktopNotesBridge | undefined {
  if (typeof window === "undefined") return undefined
  return (window as unknown as { desktop?: DesktopNotesBridge }).desktop
}

/** True on this machine's browser (dev hub) — not a phone hitting the LAN IP. */
export function isLocalNotesHubOrigin(location: Pick<Location, "hostname"> | undefined = typeof window === "undefined" ? undefined : window.location): boolean {
  if (!location) return false
  const host = location.hostname
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]"
}

export function canFetchAppleNotes(bridge = getDesktopNotesBridge()): boolean {
  return typeof bridge?.fetchAppleNotes === "function" || isLocalNotesHubOrigin()
}

const MAC_NOTES_UNAVAILABLE =
  "Apple Notes are read on this Mac through Notes.app (iCloud / iPhone + On My Mac). Open Brain2 at http://localhost:3000 or the desktop window, then try again."

async function fetchAppleNotesViaHub(range: AppleNotesRange): Promise<FetchAppleNotesResult> {
  if (typeof fetch !== "function") {
    return { ok: false, code: "unavailable", error: MAC_NOTES_UNAVAILABLE }
  }
  try {
    const res = await fetch(APPLE_NOTES_HUB_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(range),
    })
    const result = (await res.json()) as FetchAppleNotesResult
    if (!result || typeof result !== "object") {
      return { ok: false, code: "parse", error: "Notes.app returned an unexpected payload." }
    }
    if (!result.ok) {
      return {
        ok: false,
        code: result.code,
        error: result.error || "Failed to read Apple Notes.",
      }
    }
    return { ok: true, notes: parseAppleNotesPayload(result.notes) }
  } catch {
    return { ok: false, code: "unavailable", error: MAC_NOTES_UNAVAILABLE }
  }
}

export async function fetchAppleNotes(
  range: AppleNotesRange,
  bridge = getDesktopNotesBridge(),
): Promise<FetchAppleNotesResult> {
  if (bridge?.fetchAppleNotes) {
    try {
      const result = await bridge.fetchAppleNotes(range)
      if (!result || typeof result !== "object") {
        return { ok: false, code: "parse", error: "Notes.app returned an unexpected payload." }
      }
      if (!result.ok) {
        return {
          ok: false,
          code: result.code,
          error: result.error || "Failed to read Apple Notes.",
        }
      }
      return { ok: true, notes: parseAppleNotesPayload(result.notes) }
    } catch (err) {
      return {
        ok: false,
        code: "osascript",
        error: err instanceof Error ? err.message : "Failed to read Apple Notes.",
      }
    }
  }
  if (!isLocalNotesHubOrigin()) {
    return { ok: false, code: "unavailable", error: MAC_NOTES_UNAVAILABLE }
  }
  return fetchAppleNotesViaHub(range)
}

/**
 * Strip Notes.app HTML (or pass through plaintext) into readable list text.
 * Best-effort: never throws.
 */
export function stripNoteHtml(input: string | null | undefined): string {
  if (!input) return ""
  let s = String(input)
  s = s.replace(/<br\s*\/?>/gi, "\n")
  s = s.replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, "\n")
  s = s.replace(/<[^>]+>/g, "")
  s = s.replace(/&nbsp;/gi, " ")
  s = s.replace(/&amp;/gi, "&")
  s = s.replace(/&lt;/gi, "<")
  s = s.replace(/&gt;/gi, ">")
  s = s.replace(/&quot;/gi, '"')
  s = s.replace(/&#(\d+);/g, (_, n) => {
    const code = Number(n)
    return Number.isFinite(code) ? String.fromCharCode(code) : ""
  })
  s = s.replace(/\n{3,}/g, "\n\n")
  return s.trim()
}

const GENERIC_FOLDERS = new Set([
  "notes",
  "icloud",
  "on my mac",
  "on my iphone",
  "recently deleted",
  "all icloud",
])

export function isGenericNotesFolder(name: string | null | undefined): boolean {
  return GENERIC_FOLDERS.has(String(name || "").trim().toLowerCase())
}

/** Title shown on a swipe card / list item. */
export function noteDisplayTitle(note: Pick<AppleNote, "title" | "body">): string {
  const t = String(note.title || "").trim()
  if (t && !/^new note$/i.test(t)) return t
  const first = stripNoteHtml(note.body)
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0)
  if (!first) return "Untitled note"
  return first.length > 80 ? `${first.slice(0, 77)}…` : first
}

function asIso(value: unknown): string {
  if (typeof value !== "string" || !value) return ""
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? "" : d.toISOString()
}

/** Coerce an unknown IPC payload into `AppleNote[]` (drops junk rows). */
export function parseAppleNotesPayload(raw: unknown): AppleNote[] {
  if (!Array.isArray(raw)) return []
  const out: AppleNote[] = []
  for (const row of raw) {
    if (!row || typeof row !== "object") continue
    const r = row as Record<string, unknown>
    const title = typeof r.title === "string" ? r.title : ""
    const body = stripNoteHtml(typeof r.body === "string" ? r.body : "")
    const folder = typeof r.folder === "string" ? r.folder : ""
    if (folder && /recently deleted/i.test(folder)) continue
    const givenId = typeof r.id === "string" ? r.id : ""
    const id = givenId || `note-${out.length}-${title}-${asIso(r.modifiedAt)}`
    out.push({
      id,
      title,
      body,
      folder,
      account: typeof r.account === "string" ? r.account : "",
      createdAt: asIso(r.createdAt),
      modifiedAt: asIso(r.modifiedAt),
      passwordProtected: r.passwordProtected === true,
    })
  }
  out.sort((a, b) => {
    if (a.modifiedAt < b.modifiedAt) return 1
    if (a.modifiedAt > b.modifiedAt) return -1
    return 0
  })
  return out
}

export function endOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

export function startOfLocalDay(date: Date): Date {
  return startOfDay(date)
}

/** Inclusive local date range for a preset (or custom YYYY-MM-DD fields). */
export function notesPeriodRange(
  preset: NotesPeriodPreset,
  now: Date = new Date(),
  customFrom?: string,
  customTo?: string,
): { since: Date; until: Date } {
  const until = now
  if (preset === "custom") {
    const from = customFrom ? new Date(`${customFrom}T00:00:00`) : addDays(startOfLocalDay(now), -7)
    const toRaw = customTo ? new Date(`${customTo}T00:00:00`) : now
    const to = endOfLocalDay(Number.isNaN(toRaw.getTime()) ? now : toRaw)
    const since = Number.isNaN(from.getTime()) ? addDays(startOfLocalDay(now), -7) : startOfLocalDay(from)
    return since <= to ? { since, until: to } : { since: startOfLocalDay(to), until: endOfLocalDay(since) }
  }
  if (preset === "24h") return { since: new Date(now.getTime() - 24 * 60 * 60 * 1000), until }
  if (preset === "7d") return { since: addDays(now, -7), until }
  if (preset === "30d") return { since: addDays(now, -30), until }
  if (preset === "90d") return { since: addDays(now, -90), until }
  // this year
  return { since: new Date(now.getFullYear(), 0, 1), until }
}

export function notesPeriodLabel(
  preset: NotesPeriodPreset,
  customFrom?: string,
  customTo?: string,
  now: Date = new Date(),
): string {
  const { since, until } = notesPeriodRange(preset, now, customFrom, customTo)
  if (preset !== "custom" && preset !== "year") {
    const found = NOTES_PERIOD_PRESETS.find((p) => p.id === preset)
    return found?.label ?? preset
  }
  return `${formatLocalDateKey(since)} → ${formatLocalDateKey(until)}`
}

/** Overlay full-text pulls onto the preview rows the user already kept. */
export function mergeNoteBodies(previews: AppleNote[], full: AppleNote[]): AppleNote[] {
  const byId = new Map(full.map((n) => [n.id, n]))
  return previews.map((preview) => {
    const pulled = byId.get(preview.id)
    if (!pulled) return preview
    return {
      ...preview,
      ...pulled,
      title: pulled.title || preview.title,
      folder: pulled.folder || preview.folder,
      account: pulled.account || preview.account,
      body: pulled.body || preview.body,
    }
  })
}

/** Short preview line for swipe cards. */
export function notePreviewSnippet(note: Pick<AppleNote, "title" | "body">, max = 420): string {
  const title = noteDisplayTitle(note)
  const body = stripNoteHtml(note.body)
  if (!body || body === title) return ""
  const rest = body.startsWith(title) ? body.slice(title.length).trim() : body
  if (!rest) return ""
  return rest.length > max ? `${rest.slice(0, max - 1)}…` : rest
}

/** Full parked text: title plus body so later ingest has the whole note, not just the title. */
export function noteFullText(note: Pick<AppleNote, "title" | "body">): string {
  const title = noteDisplayTitle(note)
  const body = stripNoteHtml(note.body)
  if (!body) return title
  if (body === title || body.startsWith(title)) return body
  return `${title}\n\n${body}`
}

/**
 * Prefill the bulk-add editor. If the note already looks like `List:\nitem` syntax,
 * keep it; otherwise use the title as a list heading and each remaining line as an item.
 */
export function noteToBulkAddDraft(note: Pick<AppleNote, "title" | "body">): string {
  const title = noteDisplayTitle(note)
  const body = stripNoteHtml(note.body)
  const lines = (body || title)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length === 0) return `${title}:\n`
  if (lines[0].endsWith(":")) return lines.join("\n")
  const items = lines.filter((l) => l !== title)
  if (items.length === 0) return `${title}:\n`
  return `${title}:\n${items.join("\n")}`
}

export interface BulkAddBlock {
  /** Ancestor folder names, outermost first. Empty means a root-level list. */
  folderPath: string[]
  listName: string
  items: string[]
}

/**
 * Bulk-add syntax, same rule as Quick/Bulk Add (`parsePathHeader`): a line
 * ending in `:` starts a block. Extra colons are folders, so
 * `Trip ideas: Packing:` files a new **Packing** list inside a new
 * **Trip ideas** folder. Following lines are items.
 */
export function parseBulkAddText(text: string): BulkAddBlock[] {
  const lines = String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const result: BulkAddBlock[] = []
  let current: BulkAddBlock | null = null
  const ensure = (folderPath: string[], listName: string) => {
    const key = [...folderPath, listName].join("/").toLowerCase()
    let block = result.find((b) => [...b.folderPath, b.listName].join("/").toLowerCase() === key)
    if (!block) {
      block = { folderPath, listName, items: [] }
      result.push(block)
    }
    return block
  }

  for (const line of lines) {
    const header = parsePathHeader(line)
    if (header) {
      current = ensure(header.folderPath, header.listName)
    } else {
      current = current ?? ensure([], "General")
      current.items.push(line)
    }
  }
  return result.filter((b) => b.items.length > 0)
}

export function summarizeBulkAdd(text: string): { lists: number; items: number; folders: number } {
  const blocks = parseBulkAddText(text)
  const folders = new Set(blocks.filter((b) => b.folderPath.length > 0).map((b) => b.folderPath.join("/")))
  return {
    lists: blocks.length,
    items: blocks.reduce((n, b) => n + b.items.length, 0),
    folders: folders.size,
  }
}

const LIST_COLORS = ["#3B82F6", "#EF4444", "#10B981", "#8B5CF6", "#F59E0B", "#06B6D4", "#EC4899", "#6366F1"]

export function nextListColor(index = 0): string {
  return LIST_COLORS[Math.abs(index) % LIST_COLORS.length]
}

export function newListFromName(name: string, colorIndex = 0): List {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    color: nextListColor(colorIndex),
    description: `Auto-created from Apple Notes (${name})`,
    createdAt: new Date(),
  }
}

/** Build a parked note for later ingest — full text in description + body, not title-only. */
export function noteToParkedItem(note: AppleNote, list: List, source = APPLE_NOTES_SOURCE): Task {
  const title = noteDisplayTitle(note)
  const full = noteFullText(note)
  const createdAt = note.createdAt ? new Date(note.createdAt) : new Date()
  const base = withCategoryDefaults(createListItem(full, [list.id]), list)
  return {
    ...base,
    title,
    description: full,
    body: stripNoteHtml(note.body) || full,
    createdAt: Number.isNaN(createdAt.getTime()) ? base.createdAt : createdAt,
    tags: note.folder && !isGenericNotesFolder(note.folder) ? [note.folder] : [],
    attributes: {
      ...(base.attributes || {}),
      [APPLE_NOTE_ATTR.source]: source,
      ingestStatus: "parked",
      ...(note.id ? { [APPLE_NOTE_ATTR.id]: note.id } : {}),
      ...(note.folder ? { [APPLE_NOTE_ATTR.folder]: note.folder } : {}),
      ...(note.account ? { [APPLE_NOTE_ATTR.account]: note.account } : {}),
    },
  }
}

/** Build a list item from a kept note, assigned to `list`. */
export function noteToListItem(note: AppleNote, list: List): Task {
  return noteToParkedItem(note, list)
}

const INGESTED_IDS_KEY = persistKey("apple-notes-ingested-ids")

export function readPersistedIngestedIds(): Set<string> {
  if (typeof localStorage === "undefined") return new Set()
  try {
    const raw = readAliasedLocal(INGESTED_IDS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string" && id) : [])
  } catch {
    return new Set()
  }
}

export function persistIngestedNoteIds(ids: Iterable<string>): void {
  if (typeof localStorage === "undefined") return
  const next = readPersistedIngestedIds()
  for (const id of ids) if (id) next.add(id)
  writeAliasedLocal(INGESTED_IDS_KEY, JSON.stringify([...next]))
}

/** Ids of Apple Notes already stored as list items (skip on re-ingest). */
export function ingestedAppleNoteIds(tasks: Array<{ attributes?: Record<string, unknown> }>): Set<string> {
  const ids = readPersistedIngestedIds()
  for (const task of tasks) {
    const id = task.attributes?.[APPLE_NOTE_ATTR.id]
    if (typeof id === "string" && id) ids.add(id)
  }
  return ids
}

export function filterNewNotes(notes: AppleNote[], existingIds: Set<string>): AppleNote[] {
  if (existingIds.size === 0) return notes
  return notes.filter((n) => !n.id || !existingIds.has(n.id))
}

export interface IngestDestinationMutators {
  lists: List[]
  folders: Folder[]
  addList: (list: List) => void
  addFolder: (folder: Folder) => void
  addListToFolder: (folderId: string, listId: string) => void
}

/** Auto-create the iPhone Notes Ingest folder + "notes to ingest" list if missing. */
export function ensureIphoneNotesIngestDestination(mut: IngestDestinationMutators): { folder: Folder; list: List } {
  let folder = mut.folders.find((f) => f.id === IPHONE_NOTES_INGEST_FOLDER_ID)
    ?? mut.folders.find((f) => f.name.toLowerCase() === IPHONE_NOTES_INGEST_FOLDER_NAME.toLowerCase())
  if (!folder) {
    folder = {
      id: IPHONE_NOTES_INGEST_FOLDER_ID,
      name: IPHONE_NOTES_INGEST_FOLDER_NAME,
      createdAt: new Date(),
      listIds: [],
      color: "#0ea5e9",
      description: "Parked Apple Notes waiting to be bulk-added into lists.",
      createdByModuleId: IPHONE_NOTES_INGEST_MODULE_ID,
      hiddenFromGlobalAll: false,
    }
    mut.addFolder(folder)
  }

  let list = mut.lists.find((l) => l.id === NOTES_TO_INGEST_LIST_ID)
    ?? mut.lists.find((l) => l.name.toLowerCase() === NOTES_TO_INGEST_LIST_NAME.toLowerCase())
  if (!list) {
    list = {
      id: NOTES_TO_INGEST_LIST_ID,
      name: NOTES_TO_INGEST_LIST_NAME,
      color: "#38bdf8",
      description: "Apple Notes saved for later ingest. Edit into bulk-add syntax, then extract items.",
      createdAt: new Date(),
      createdByModuleId: IPHONE_NOTES_INGEST_MODULE_ID,
      hiddenFromGlobalAll: false,
    }
    mut.addList(list)
  }

  const folderId = folder.id
  const alreadyFiled = mut.folders.some((f) => f.listIds.includes(list!.id))
  if (!alreadyFiled) mut.addListToFolder(folderId, list.id)

  return { folder, list }
}

/** Prefix Shortcuts Note Identifier so it never collides with Notes.app ids. */
export function iphoneNoteAttrId(rawId: string): string {
  const trimmed = String(rawId ?? "").trim()
  if (!trimmed) return ""
  if (/^iphone:/i.test(trimmed)) return `${IPHONE_NOTE_ID_PREFIX}${trimmed.replace(/^iphone:/i, "")}`
  return `${IPHONE_NOTE_ID_PREFIX}${trimmed}`
}

const IPHONE_STORE_INGESTED_IDS_KEY = persistKey("iphone-notes-ingested-ids")

export function readPersistedIphoneNoteIds(): Set<string> {
  if (typeof localStorage === "undefined") return new Set()
  try {
    const raw = readAliasedLocal(IPHONE_STORE_INGESTED_IDS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string" && id) : [])
  } catch {
    return new Set()
  }
}

export function persistIphoneNoteIds(ids: Iterable<string>): void {
  if (typeof localStorage === "undefined") return
  const next = readPersistedIphoneNoteIds()
  for (const id of ids) if (id) next.add(iphoneNoteAttrId(id))
  writeAliasedLocal(IPHONE_STORE_INGESTED_IDS_KEY, JSON.stringify([...next]))
}

/** Ids already parked or bulk-added from the iPhone Notes Store dump. */
export function ingestedIphoneNoteIds(tasks: Array<{ attributes?: Record<string, unknown> }>): Set<string> {
  const ids = readPersistedIphoneNoteIds()
  for (const task of tasks) {
    const source = task.attributes?.[APPLE_NOTE_ATTR.source]
    const id = task.attributes?.[APPLE_NOTE_ATTR.id]
    if (typeof id !== "string" || !id) continue
    if (source === IPHONE_NOTES_STORE_SOURCE || /^iphone:/i.test(id)) ids.add(iphoneNoteAttrId(id))
  }
  return ids
}

/** Auto-create the iPhone Notes Store folder + Parked list if missing. */
export function ensureIphoneNotesStoreDestination(mut: IngestDestinationMutators): { folder: Folder; list: List } {
  let folder = mut.folders.find((f) => f.id === IPHONE_NOTES_STORE_FOLDER_ID)
    ?? mut.folders.find((f) => f.name.toLowerCase() === IPHONE_NOTES_STORE_FOLDER_NAME.toLowerCase())
  if (!folder) {
    folder = {
      id: IPHONE_NOTES_STORE_FOLDER_ID,
      name: IPHONE_NOTES_STORE_FOLDER_NAME,
      createdAt: new Date(),
      listIds: [],
      color: "#a855f7",
      description: "On My iPhone notes dumped via Telegram Shortcut, waiting to be bulk-added.",
      createdByModuleId: IPHONE_NOTES_STORE_MODULE_ID,
      hiddenFromGlobalAll: false,
    }
    mut.addFolder(folder)
  }

  let list = mut.lists.find((l) => l.id === IPHONE_NOTES_STORE_LIST_ID)
    ?? mut.lists.find((l) => l.name.toLowerCase() === IPHONE_NOTES_STORE_LIST_NAME.toLowerCase())
  if (!list) {
    list = {
      id: IPHONE_NOTES_STORE_LIST_ID,
      name: IPHONE_NOTES_STORE_LIST_NAME,
      color: "#c084fc",
      description: "Phone notes parked from the iOS Shortcut. Edit into bulk-add syntax, then extract items.",
      createdAt: new Date(),
      createdByModuleId: IPHONE_NOTES_STORE_MODULE_ID,
      hiddenFromGlobalAll: false,
    }
    mut.addList(list)
  }

  const folderId = folder.id
  const alreadyFiled = mut.folders.some((f) => f.listIds.includes(list!.id))
  if (!alreadyFiled) mut.addListToFolder(folderId, list.id)

  return { folder, list }
}

/** Open (not completed) items on the iPhone Notes Store Parked list, oldest first. */
export function parkedIphoneStoreItems<T extends { completed?: boolean; lists?: string[]; createdAt?: Date | string | number }>(
  tasks: T[],
  listId = IPHONE_NOTES_STORE_LIST_ID,
): T[] {
  return tasks
    .filter((t) => !t.completed && (t.lists ?? []).includes(listId))
    .slice()
    .sort((a, b) => {
      const ta = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt ?? 0).getTime()
      const tb = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt ?? 0).getTime()
      return ta - tb
    })
}
