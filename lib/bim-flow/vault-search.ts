/**
 * lib/bim-flow/vault-search.ts — Find what a message is about in the vault, by its words
 *
 * The message is cut into content words (stopwords and short words dropped).
 * Each word is looked up on its own, and a record ranks by how many words it
 * matched. So "garlic confit done" finds the recipe item, the Cooking pen, and
 * the lists those items already sit on. Those lists become the only lists a
 * `choose` node may pick, so a model never reads all of them.
 */

import type { SearchHit, SearchOutput, SearchSource } from "./types"

const STOPWORDS = new Set(
  `a an the and or but if then so of to in on at by for from with without about into onto over under up down out off
  is am are was were be been being do does did done doing have has had having i me my mine we our you your he she it its
  they them their this that these those there here what which who whom when where why how all any both each few more most
  other some such no nor not only own same than too very can will just should now rn idk lol like maybe kinda really
  gonna wanna gotta im ive its dont didnt cant wont also still yet ok okay get got make made need want go going went`
    .split(/\s+/)
    .filter(Boolean),
)

/** Content words, lowercased, in first-seen order. */
export function contentWords(text: string): string[] {
  const seen = new Set<string>()
  for (const raw of text.toLowerCase().split(/[^\p{L}\p{N}']+/u)) {
    const word = raw.replace(/'/g, "")
    if (word.length < 3 || STOPWORDS.has(word) || /^\d+$/.test(word)) continue
    seen.add(word)
  }
  return [...seen]
}

/** A plain copy of what search reads, so it can run without the stores. */
export interface VaultSnapshot {
  items: { id: string; title: string; type?: string; listIds: string[] }[]
  lists: { id: string; name: string }[]
  habits: { id: string; title: string }[]
  scopes: { id: string; name: string; pens: { id: string; name: string }[] }[]
  /** Lists whose members are noise for matching (Instagram follower dumps, word banks). */
  skipListIds: Set<string>
  /** What happened and when, for questions about the person. Absent in older snapshots. */
  history?: VaultHistory
  /** Named tables of dated text from the Data screens (miss reasons, ritual answers, pushed tasks…). */
  datasets?: Record<string, Dataset>
  /** Recent phone texts (a short window; old ones are not relevant). Loaded by the lab from the hub, not the stores. */
  texts?: import("./texts").TextRow[]
  /** Recent file events (created or changed), loaded by the lab from the hub. */
  files?: import("./file-activity").FileEvent[]
  /** People with every name they go by. */
  /** Handles of secret people. Texts to or from them are never loaded. */
  secretHandles?: string[]
  people?: { id: string; title: string; names: string[]; /** Saved phone numbers and emails, for naming texts. */ handles?: string[] }[]
}

export interface HistoryEntry {
  date: string
  scope: string
  pen: string
  startMin: number
  endMin: number
  text: string
  /** False when guessed or painted by a machine (screen time, sleep, phone sync). Absent = the person's own. */
  confirmed?: boolean
  /** A point event with no length. */
  instant?: boolean
  /** `generatedBy.kind` when a machine painted it ("screentime" = Mac ActivityWatch, "phone-sync", "text", "sleep"). */
  source?: string
}

export interface VaultHistory {
  entries: HistoryEntry[]
  /** BIM / Telegram messages. `at` is ISO. */
  feed: { at: string; text: string }[]
  /** Log items. */
  logs: { at: string; text: string }[]
  dayNotes: { date: string; text: string }[]
  /** Plan / calendar events ("Elijah leaves for tour", all day). `date` is local YYYY-MM-DD; `time` is HH:mm unless all day. */
  events?: { date: string; title: string; time?: string; allDay?: boolean }[]
  /** Tracking view id → name. */
  scopeNames: Record<string, string>
  /** The iPhone Health import, by local date. */
  health?: Record<string, { steps?: number; distanceM?: number; activeKcal?: number; heartAvg?: number; heartMax?: number }>
}

const SKIP_LIST = /instagram|1000 |mots|parole|語/i
/** Lists the app fills itself (BIM's log, done items, thought process). Never a place to file. */
const SYSTEM_LIST = /^(log|completed|thought process|all items|purchased)$/i

export function skipListIdsFor(lists: { id: string; name: string }[]): Set<string> {
  return new Set(lists.filter((l) => SKIP_LIST.test(l.name) || SYSTEM_LIST.test(l.name.trim())).map((l) => l.id))
}

function wordHits(title: string, words: string[]): string[] {
  const hay = ` ${title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ")} `
  return words.filter((w) => hay.includes(` ${w}`))
}

function rank(hits: SearchHit[], limit: number): SearchHit[] {
  return hits
    .sort((a, b) => b.matched - a.matched || a.title.length - b.title.length || a.id.localeCompare(b.id))
    .slice(0, limit)
}

/**
 * A pen or list whose name is really a pasted thought ("slipping for nap bc so so hungry (sleep for lunch)
 * or maybe shower could go", a paragraph about EEG pipelines). The person's vault has dozens; offering them
 * to a PICK lets a model choose one. Kept in the vault, left out of search.
 */
export function isArtifactName(name: string): boolean {
  return name.length > 70 || name.trim().split(/\s+/).length > 9
}

/** BIM's own head aliases (`lib/ingest/parse-message.ts`): `get:` writes to the list "needed". */
const HEAD_ALIAS: Record<string, string> = { get: "needed" }
/** Words a line may open with before its real first word ("gotta get shoes"). */
const LEAD_FILLER = new Set(["gotta", "gonna", "also", "and", "i", "must", "should", "def", "really", "still", "so"])

const firstWord = (text: string): string => {
  const words = text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  return words.find((w) => !LEAD_FILLER.has(w)) ?? ""
}

/** Lists a line's head names: "Lyric: …" → Lyric, "Merch: …" → Merch, "Get: …" → needed. */
export function headLists(snap: VaultSnapshot, text: string): string[] {
  const written = /^\s*([\p{L}\p{N} ]{2,24}?)\s*(?:idea)?\s*[:\-–]/u.exec(text)?.[1]?.trim()
  if (!written) return []
  const head = written.toLowerCase()
  const want = [head, HEAD_ALIAS[head]].filter(Boolean)
  const names = [...new Set(snap.lists.filter((l) => !snap.skipListIds.has(l.id) && want.includes(l.name.trim().toLowerCase())).map((l) => l.name.trim()))]
  // "needed" and "Needed" are both lists; the one spelled as written (or as the grammar writes it) wins.
  const exact = names.filter((n) => n === written || n === HEAD_ALIAS[head])
  return exact.length ? exact : names
}

/**
 * Lists the person already keeps lines like this one on, learned from their items: of 111 items that
 * start with need / iso / get, most sit on Needed, needed, shopping list or wanted. So "Need more macbook
 * bricks" is offered those lists even though no item shares a word with it. Lists with 3+ such items, top 3.
 */
export function cueLists(snap: VaultSnapshot, text: string): string[] {
  const cue = firstWord(text)
  if (!cue || cue.length < 3 || /^\d+$/.test(cue)) return []
  const listName = new Map(snap.lists.map((l) => [l.id, l.name]))
  const counts = new Map<string, number>()
  for (const it of snap.items) {
    if (it.type === "person" || firstWord(it.title) !== cue) continue
    for (const l of it.listIds) if (!snap.skipListIds.has(l)) counts.set(listName.get(l) ?? l, (counts.get(listName.get(l) ?? l) ?? 0) + 1)
  }
  return [...counts].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name)
}

export function searchVault(
  snap: VaultSnapshot,
  text: string,
  opts: { source: SearchSource; limit?: number; all?: boolean; scopeId?: string },
): SearchOutput {
  const terms = contentWords(text)
  const limit = opts.limit ?? 12
  const listName = new Map(snap.lists.map((l) => [l.id, l.name]))
  const hits: SearchHit[] = []
  const seenNames = new Set<string>()
  const push = (id: string, title: string, extra: Partial<SearchHit> = {}) => {
    if (opts.source === "pens" || opts.source === "lists") {
      // Same name twice ("Text log" three times, three "Reading List"s) is one option; a pasted paragraph is none.
      const key = title.trim().toLowerCase()
      if (isArtifactName(title) || seenNames.has(key)) return
      seenNames.add(key)
    }
    const words = opts.all ? [] : wordHits(title, terms)
    if (opts.all || words.length > 0) hits.push({ id, title, source: opts.source, matched: words.length, words, ...extra })
  }

  if (opts.source === "items" || opts.source === "people") {
    for (const item of snap.items) {
      if (opts.source === "people" ? item.type !== "person" : item.type === "person") continue
      const listIds = item.listIds.filter((id) => !snap.skipListIds.has(id))
      if (item.listIds.length > 0 && listIds.length === 0) continue
      push(item.id, item.title, { lists: listIds.map((id) => listName.get(id) ?? id) })
    }
  } else if (opts.source === "lists") {
    for (const l of snap.lists) if (!snap.skipListIds.has(l.id)) push(l.id, l.name)
  } else if (opts.source === "habits") {
    for (const h of snap.habits) push(h.id, h.title)
  } else {
    for (const scope of snap.scopes) {
      if (opts.scopeId && scope.id !== opts.scopeId) continue
      for (const pen of scope.pens) push(pen.id, pen.name)
    }
  }

  const top = opts.all ? hits.slice(0, opts.limit ?? 200) : rank(hits, limit)
  const options =
    opts.source === "items"
      ? [...new Set([...headLists(snap, text), ...top.flatMap((h) => h.lists ?? []), ...cueLists(snap, text)])]
      : [...new Set(top.map((h) => h.title))]
  return { terms, hits: top, options }
}

/** One dated line of a dataset. `source` is the column the Data screen groups by. */
export interface DatasetRow {
  /** Local date, YYYY-MM-DD, or "" when the row has none. */
  date: string
  source: string
  text: string
}

export interface Dataset {
  id: string
  label: string
  blurb: string
  rows: DatasetRow[]
}
