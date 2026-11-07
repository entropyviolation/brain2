/**
 * lib/habit-word-feed-apply.ts — Put today's document words into the habits that listen
 *
 * `noteDocWords` is called after a Docs body is saved (`components/Docs/doc-actions.ts`). It steps the
 * ledger (`lib/habit-word-feed.ts`) for that document and adds only the newly earned units to each
 * daily habit with a matching `wordFeeds` row. A habit with no row for the document costs one filter.
 * `seedDocWords` records the starting count when a rule is accepted, so words already there do not count.
 */
"use client"

import { formatLocalDateKey } from "@/lib/date-utils"
import { useHabitsStore } from "@/lib/habits-store"
import { persistKey } from "@/lib/storage-keys"
import { htmlWordCount } from "@/lib/doc-html"
import { activeWordFeeds, feedMatchesDoc, owed, stepLedger, type WordLedger } from "@/lib/habit-word-feed"

const KEY = () => persistKey("doc-word-ledger")

function load(): WordLedger {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(KEY())
    return raw ? (JSON.parse(raw) as WordLedger) : {}
  } catch {
    return {}
  }
}

function save(ledger: WordLedger): void {
  try {
    localStorage.setItem(KEY(), JSON.stringify(ledger))
  } catch {
    /* quota or private mode: the next save starts from what it has */
  }
}

/** Start counting a document from its words right now. Keeps today's tally if one exists. */
export function seedDocWords(docId: string, html: string, now = new Date()): void {
  const ledger = load()
  ledger[docId] = stepLedger(ledger[docId], htmlWordCount(html), formatLocalDateKey(now))
  save(ledger)
}

/** One saved body. Returns what was added to each habit, for tests and logs. */
export function noteDocWords(doc: { id: string; title: string }, html: string, now = new Date()): { habitId: string; add: number }[] {
  const store = useHabitsStore.getState()
  const listeners = store.tasks.filter((t) => (t.frequency ?? "daily") === "daily" && activeWordFeeds(t).some((f) => feedMatchesDoc(f, doc)))
  if (!listeners.length) return []
  const day = formatLocalDateKey(now)
  const ledger = load()
  const entry = stepLedger(ledger[doc.id], htmlWordCount(html), day)
  const wrote: { habitId: string; add: number }[] = []
  for (const task of listeners) {
    for (const feed of activeWordFeeds(task).filter((f) => feedMatchesDoc(f, doc))) {
      const { add, total } = owed(entry, task.id, feed)
      if (add <= 0) continue
      const have = useHabitsStore.getState().weeklyData[day]?.[task.id]?.value ?? 0
      useHabitsStore.getState().updateCompletion(task.id, now, { value: have + add })
      entry.credited[task.id] = total
      wrote.push({ habitId: task.id, add })
    }
  }
  ledger[doc.id] = entry
  save(ledger)
  return wrote
}
