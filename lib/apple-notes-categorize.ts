/**
 * lib/apple-notes-categorize.ts — Autocategorize Apple Notes onto lists
 *
 * Classical (no LLM) scoring: Notes folder name, smart-parse `Category:` hints,
 * title/body overlap with existing list names. Notes that don't clear the
 * threshold become a new list named after the Notes folder (or "From Notes").
 *
 * Pure + deterministic so the swipe → bulk-add review can be unit-tested.
 */
import { FALLBACK_LIST_NAME, isGenericNotesFolder, noteDisplayTitle, type AppleNote } from "@/lib/apple-notes"
import { parseSmartCapture } from "@/lib/smart-parse"

export interface CategorizeListHint {
  id: string
  name: string
}

export interface NoteCategoryAssignment {
  noteId: string
  listId?: string
  listName: string
  create: boolean
  score: number
}

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "to", "of", "in", "on", "for", "with", "at", "from",
  "is", "it", "my", "me", "we", "our", "this", "that", "new", "note", "notes", "icloud",
])

const MATCH_THRESHOLD = 40

function tokenize(s: string): string[] {
  return String(s || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t))
}

function normalize(s: string): string {
  return String(s || "").trim().toLowerCase()
}

function scoreAgainstList(note: AppleNote, list: CategorizeListHint): number {
  const listName = normalize(list.name)
  if (!listName) return 0

  const folder = normalize(note.folder)
  if (folder && folder === listName) return 100
  if (folder && !isGenericNotesFolder(folder) && listName.length >= 3) {
    if (folder.includes(listName) || listName.includes(folder)) return 80
  }

  const title = normalize(noteDisplayTitle(note))
  if (title === listName) return 90
  if (listName.length >= 3 && title.includes(listName)) return 70

  const parsed = parseSmartCapture(`${note.title}\n${note.body.slice(0, 240)}`)
  const hinted = normalize(parsed.suggestion.category || "")
  if (hinted && hinted === listName) return 85

  const noteTokens = new Set([...tokenize(note.title), ...tokenize(note.body.slice(0, 800)), ...tokenize(folder)])
  const listTokens = tokenize(list.name)
  if (listTokens.length === 0) return 0
  const hits = listTokens.filter((t) => noteTokens.has(t)).length
  return (hits / listTokens.length) * 50
}

function fallbackListName(note: AppleNote): string {
  if (note.folder && !isGenericNotesFolder(note.folder)) return note.folder.trim()
  return FALLBACK_LIST_NAME
}

/** Best list for a single note (existing match or a name to create). */
export function categorizeNote(note: AppleNote, lists: CategorizeListHint[]): NoteCategoryAssignment {
  let best: { list: CategorizeListHint; score: number } | null = null
  for (const list of lists) {
    const score = scoreAgainstList(note, list)
    if (!best || score > best.score) best = { list, score }
  }
  if (best && best.score >= MATCH_THRESHOLD) {
    return {
      noteId: note.id,
      listId: best.list.id,
      listName: best.list.name,
      create: false,
      score: best.score,
    }
  }
  const name = fallbackListName(note)
  const existing = lists.find((l) => normalize(l.name) === normalize(name))
  if (existing) {
    return {
      noteId: note.id,
      listId: existing.id,
      listName: existing.name,
      create: false,
      score: best?.score ?? 0,
    }
  }
  return {
    noteId: note.id,
    listName: name,
    create: true,
    score: best?.score ?? 0,
  }
}

export function categorizeNotes(notes: AppleNote[], lists: CategorizeListHint[]): NoteCategoryAssignment[] {
  return notes.map((note) => categorizeNote(note, lists))
}

export interface BulkAddGroup {
  listId?: string
  listName: string
  create: boolean
  noteIds: string[]
}

/** Group assignments by destination list (stable order = first appearance). */
export function groupAssignments(assignments: NoteCategoryAssignment[]): BulkAddGroup[] {
  const groups: BulkAddGroup[] = []
  const index = new Map<string, number>()
  for (const a of assignments) {
    const key = a.listId ? `id:${a.listId}` : `new:${normalize(a.listName)}`
    const existing = index.get(key)
    if (existing != null) {
      groups[existing].noteIds.push(a.noteId)
      continue
    }
    index.set(key, groups.length)
    groups.push({
      listId: a.listId,
      listName: a.listName,
      create: a.create,
      noteIds: [a.noteId],
    })
  }
  return groups
}
