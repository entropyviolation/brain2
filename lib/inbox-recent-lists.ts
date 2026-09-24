/**
 * lib/inbox-recent-lists.ts — Recently used lists for Inbox walk
 *
 * Persist the lists the user just filed onto, and fall back to lists seen on
 * newest items, so Walk can pin those picks at the top of the picker.
 */
import { uniqueNonEmpty } from "@/lib/list-merge"
import { safeToDate } from "@/lib/date-utils"

export const INBOX_RECENT_LISTS_KEY = "inbox-recent-list-ids"
export const INBOX_RECENT_LISTS_MAX = 8

export function readInboxRecentListIds(): string[] {
  if (typeof localStorage === "undefined") return []
  try {
    const raw = localStorage.getItem(INBOX_RECENT_LISTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return uniqueNonEmpty(parsed.filter((id): id is string => typeof id === "string"))
  } catch {
    return []
  }
}

export function rememberInboxListIds(listIds: string[]): string[] {
  const next = uniqueNonEmpty([...listIds, ...readInboxRecentListIds()]).slice(0, INBOX_RECENT_LISTS_MAX)
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(INBOX_RECENT_LISTS_KEY, JSON.stringify(next))
  }
  return next
}

export function recentListIdsFromItems(
  items: { lists?: string[]; createdAt?: Date | string }[],
): string[] {
  const ranked = [...items].sort((a, b) => {
    const ta = safeToDate(a.createdAt)?.getTime() ?? 0
    const tb = safeToDate(b.createdAt)?.getTime() ?? 0
    return tb - ta
  })
  return uniqueNonEmpty(ranked.flatMap((item) => item.lists ?? []))
}

export function suggestedInboxListIds(
  remembered: string[],
  fromItems: string[],
  knownIds: Iterable<string>,
  max = 6,
): string[] {
  const known = new Set(knownIds)
  return uniqueNonEmpty([...remembered, ...fromItems])
    .filter((id) => known.has(id))
    .slice(0, max)
}
