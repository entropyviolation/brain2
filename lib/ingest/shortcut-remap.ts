/**
 * lib/ingest/shortcut-remap.ts — Remap retired bare-`g` grocery expansions
 *
 * Custom Settings shortcuts may still expand to `g` from before grocery moved
 * to `groc`. Rewrite those values without touching `gps` / `got` / `grocery`.
 */
export function remapRetiredGroceryExpansion(expansion: string): string {
  const t = expansion.trim()
  if (/^g$/i.test(t)) return "groc"
  const spaced = /^g(\s+)([\s\S]*)$/i.exec(t)
  if (spaced) return `groc${spaced[1]}${spaced[2]}`
  const colon = /^g([:：]\s*)([\s\S]*)$/i.exec(t)
  if (colon) return `groc${colon[1]}${colon[2]}`
  return expansion
}

export function remapRetiredGroceryShortcuts(
  shortcuts: Record<string, string>,
): Record<string, string> {
  const next: Record<string, string> = {}
  let changed = false
  for (const [alias, value] of Object.entries(shortcuts)) {
    if (typeof value !== "string") continue
    const remapped = remapRetiredGroceryExpansion(value)
    next[alias] = remapped
    if (remapped !== value) changed = true
  }
  return changed ? next : shortcuts
}
