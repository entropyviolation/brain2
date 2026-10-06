/**
 * lib/tracking-search.ts — Find a block by the words already on it
 *
 * Display name, notes, pen names, secondary pens, counts-as chains,
 * action-format templates, and a mood reading (word, body, vibe, shorthand,
 * reframe, about-that). Local and pure: the tracker and Analytics both
 * call this and then jump to the block they already know how to open.
 */
import { ancestorChains } from "@/lib/pen-tree"
import { assignedPenIds, isInstant, type TimeEntry } from "@/lib/time-entries"
import { findPen, type TrackScope } from "@/lib/time-tracking-store"

export interface TrackingSearchHit {
  entryId: string
  date: string
  scopeId: string
  scopeName: string
  startMin: number
  label: string
  /** The field that matched, so the list can say why this row appeared. */
  match: string
}

function haystacks(entry: TimeEntry, scopes: TrackScope[]): { match: string; text: string }[] {
  const scope = scopes.find((item) => item.id === entry.scopeId)
  const rows: { match: string; text: string }[] = []
  if (entry.title?.trim()) rows.push({ match: "name", text: entry.title })
  if (entry.notes?.trim()) rows.push({ match: "notes", text: entry.notes })
  if (entry.project?.trim()) rows.push({ match: "project", text: entry.project })
  const reading = entry.moodReading
  if (reading?.word?.trim()) rows.push({ match: "word", text: reading.word })
  if (reading?.sensation?.trim()) rows.push({ match: "body", text: reading.sensation })
  if (reading?.vibe?.trim()) rows.push({ match: "vibe", text: reading.vibe })
  if (reading?.narrative?.trim()) rows.push({ match: "shorthand", text: reading.narrative })
  if (reading?.reframe?.trim()) rows.push({ match: "reframe", text: reading.reframe })
  if (reading?.about?.trim()) rows.push({ match: "about-that", text: reading.about })
  if (!scope) return rows
  for (const penId of assignedPenIds(entry)) {
    const pen = findPen([scope], penId)
    if (!pen) continue
    const role = penId === entry.penId ? "pen" : "also"
    rows.push({ match: role, text: pen.name })
    for (const chain of ancestorChains(scope.pens, pen.id)) {
      for (const ancestor of chain) {
        if (ancestor.id === pen.id) continue
        rows.push({ match: "counts as", text: ancestor.name })
      }
    }
    for (const format of pen.actionFormats ?? []) {
      if (format.template.trim()) rows.push({ match: "action", text: format.template })
    }
  }
  return rows
}

/** Blocks whose stored words contain `query`. Newest day first, then clock time. */
export function searchTracking(
  query: string,
  entries: TimeEntry[],
  scopes: TrackScope[],
  limit = 40,
): TrackingSearchHit[] {
  const needle = query.trim().toLowerCase()
  if (needle.length < 2) return []
  const hits: TrackingSearchHit[] = []
  const ranked = [...entries].sort((a, b) => b.date.localeCompare(a.date) || a.startMin - b.startMin)
  for (const entry of ranked) {
    if (isInstant(entry) && !entry.title && !entry.notes) {
      // Instants still match on pen name below.
    }
    const scope = scopes.find((item) => item.id === entry.scopeId)
    const rows = haystacks(entry, scopes)
    const hit = rows.find((row) => row.text.toLowerCase().includes(needle))
    if (!hit) continue
    const pen = scope ? findPen([scope], entry.penId) : undefined
    hits.push({
      entryId: entry.id,
      date: entry.date,
      scopeId: entry.scopeId,
      scopeName: scope?.name ?? entry.scopeId,
      startMin: entry.startMin,
      label: entry.title?.trim() || pen?.name || "Block",
      match: hit.match,
    })
    if (hits.length >= limit) break
  }
  return hits
}
