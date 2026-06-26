/** Grid layout for freeform icon view — used by store + organize animation. */
export function computeIconGridPositions(entryKeys: string[]): Record<string, { x: number; y: number }> {
  const COLS = 8
  const ICON_W = 96
  const ICON_H = 100
  const map: Record<string, { x: number; y: number }> = {}
  entryKeys.forEach((key, i) => {
    map[key] = {
      x: 16 + (i % COLS) * ICON_W,
      y: 16 + Math.floor(i / COLS) * ICON_H,
    }
  })
  return map
}
