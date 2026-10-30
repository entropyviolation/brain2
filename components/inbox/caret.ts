/**
 * Where the caret goes when its row leaves the pile.
 * A neighbor that is still listed stays put, so the list is not pulled to the first row.
 */

/**
 * Where the caret goes when its row leaves the pile.
 * A neighbor that is still listed stays put (`stayed`), so the list is not
 * pulled back to the first row. Search and slice fall through to the top.
 */
export function inboxCaretAfterRemoval(
  prevIds: readonly string[],
  nextIds: readonly string[],
  goneId: string,
): { id: string | null; stayed: boolean } {
  const fallback = nextIds[0] ?? null
  const at = prevIds.indexOf(goneId)
  if (at < 0) return { id: fallback, stayed: false }
  const still = new Set(nextIds)
  for (let i = at + 1; i < prevIds.length; i++) {
    const id = prevIds[i]
    if (id && still.has(id)) return { id, stayed: true }
  }
  for (let i = at - 1; i >= 0; i--) {
    const id = prevIds[i]
    if (id && still.has(id)) return { id, stayed: true }
  }
  return { id: fallback, stayed: false }
}
