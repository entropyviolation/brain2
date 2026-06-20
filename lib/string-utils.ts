/** Stable string hash for deterministic indexing (orbs, icon slots, etc.). */
export function hashString(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

/** Deterministic grid position from a stable key (used when no preset/stored position). */
export function hashIconSlot(key: string): { x: number; y: number } {
  const h = hashString(key)
  const COLS = 8
  const ICON_W = 96
  const ICON_H = 100
  const slot = h % 32
  return { x: 16 + (slot % COLS) * ICON_W, y: 16 + Math.floor(slot / COLS) * ICON_H }
}
