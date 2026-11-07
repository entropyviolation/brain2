/**
 * lib/habit-word-feed.ts — "Every 300 words I add to a document in a day counts as 1 page"
 *
 * A habit's `wordFeeds` rows say which Docs document feeds it and at what rate. The document itself
 * keeps no per-day history, so a small ledger (below) watches each save: it adds up the words that
 * were ADDED today (a deletion never takes credit back), and says how many whole units that earns.
 * The habit cell gets only the difference since last credited, so other sources (Speed Read, a typed
 * number) stay in the cell. Pure. The writer is `lib/habit-word-feed-apply.ts`.
 */

export interface HabitWordFeed {
  /** The document's title as the person said it. Matched without case or extra spaces. */
  docTitle: string
  /** The Docs item id, once known. Survives a rename. */
  docId?: string
  /** Words that earn one `amount`. */
  wordsPer: number
  /** What each block of `wordsPer` words counts for (1 page). */
  amount: number
  enabled?: boolean
}

/** What the ledger knows about one document today. */
export interface DocDay {
  /** `YYYY-MM-DD` the numbers below are for. */
  day: string
  /** Word count at the last save seen. */
  last: number
  /** Words added today, summed over saves. */
  added: number
  /** Units already put in the habit cell today, by habit id. */
  credited: Record<string, number>
}

export type WordLedger = Record<string, DocDay>

export const normTitle = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase()

export function activeWordFeeds(task: { wordFeeds?: HabitWordFeed[] | null }): HabitWordFeed[] {
  return (task.wordFeeds ?? []).filter((f) => f && f.enabled !== false && f.wordsPer > 0 && f.amount > 0 && (f.docTitle || f.docId))
}

export function feedMatchesDoc(feed: HabitWordFeed, doc: { id: string; title: string }): boolean {
  return (feed.docId && feed.docId === doc.id) || (!!feed.docTitle && normTitle(feed.docTitle) === normTitle(doc.title))
}

/** Whole blocks earned: 650 words at 300 per page is 2 pages. */
export function unitsFor(added: number, feed: Pick<HabitWordFeed, "wordsPer" | "amount">): number {
  if (!(feed.wordsPer > 0)) return 0
  return Math.floor(Math.max(0, added) / feed.wordsPer) * feed.amount
}

/**
 * One save. `count` is the document's words now. A first sight of a document starts at zero added (the
 * words already there were not written today). A new day carries the last count and starts `added` at 0.
 */
export function stepLedger(prev: DocDay | undefined, count: number, day: string): DocDay {
  if (!prev) return { day, last: count, added: 0, credited: {} }
  const base = prev.day === day ? prev : { day, last: prev.last, added: 0, credited: {} }
  const delta = count - base.last
  return { ...base, last: count, added: base.added + (delta > 0 ? delta : 0) }
}

/** What to add to a habit cell now, and the new credited total. */
export function owed(entry: DocDay, habitId: string, feed: HabitWordFeed): { add: number; total: number } {
  const total = unitsFor(entry.added, feed)
  return { add: Math.max(0, total - (entry.credited[habitId] ?? 0)), total }
}
