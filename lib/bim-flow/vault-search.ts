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

export function searchVault(
  snap: VaultSnapshot,
  text: string,
  opts: { source: SearchSource; limit?: number; all?: boolean; scopeId?: string },
): SearchOutput {
  const terms = contentWords(text)
  const limit = opts.limit ?? 12
  const listName = new Map(snap.lists.map((l) => [l.id, l.name]))
  const hits: SearchHit[] = []
  const push = (id: string, title: string, extra: Partial<SearchHit> = {}) => {
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
      ? [...new Set(top.flatMap((h) => h.lists ?? []))]
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
