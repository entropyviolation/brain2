/**
 * lib/affirmations.ts — "Affirmations" list helpers (morning ritual)
 *
 * The morning affirmations ritual reads its lines from a normal Lists list named
 * "Affirmations" (visible under Lists → All). These pure helpers locate that
 * list, read its items as affirmation strings, and pick a random subset to
 * speak. `DEFAULT_AFFIRMATIONS` seed the list the first time the ritual runs so
 * it works out of the box; the user can then edit the list like any other.
 */
import type { Task, List } from "@/lib/types"

export const AFFIRMATIONS_LIST_NAME = "Affirmations"

/** Number of affirmations spoken in one morning session. */
export const AFFIRMATIONS_PER_SESSION = 5

export const DEFAULT_AFFIRMATIONS: string[] = [
  "I am calm, capable, and ready for today.",
  "I trust myself to handle whatever comes.",
  "I am focused and follow through on what matters.",
  "I am worthy of good things and growth.",
  "I choose courage over comfort.",
  "My effort today compounds into who I become.",
  "I am grateful and present in this moment.",
  "I speak with clarity and stand by my decisions.",
]

/** Find the user's "Affirmations" list (case-insensitive name match). */
export function findAffirmationsCategory(
  categories: List[],
): List | undefined {
  const wanted = AFFIRMATIONS_LIST_NAME.toLowerCase()
  return categories.find((c) => c.name.trim().toLowerCase() === wanted)
}

/** Display text for an affirmation item (prefers the unified `title`). */
export function affirmationText(task: Task): string {
  return (task.title || task.description || "").trim()
}

/** Active (non-completed) affirmation lines belonging to a list. */
export function getAffirmationItems(tasks: Task[], listId: string): Task[] {
  return tasks.filter((t) => {
    // Resilient to the in-progress category→list rename: read the new `lists`
    // field, falling back to the legacy `categories` field on un-migrated data.
    const memberships = t.lists ?? (t as { categories?: string[] }).categories ?? []
    return !t.completed && memberships.includes(listId) && !!affirmationText(t)
  })
}

/**
 * Fisher–Yates pick of up to `n` distinct items. `rng` defaults to Math.random
 * and is injectable for deterministic tests.
 */
export function pickRandom<T>(items: T[], n: number, rng: () => number = Math.random): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, Math.max(0, Math.min(n, copy.length)))
}
