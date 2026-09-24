/** Width-aware velvet desktop grid — stocks the cabinet instead of a tight pile. */

export const VELVET_ICON_CELL = { w: 112, h: 118, pad: 16 }

/** Drawn icon box inside a cell — used to prove packed slots never overlap. */
export const VELVET_ICON_BOX = { w: 104, h: 112 }

/** Used when the canvas has not been measured yet (jsdom, first paint). */
export const VELVET_GRID_FALLBACK_WIDTH = 840

export type IconPos = { x: number; y: number }

/** Auto packs to canvas width. Freeform keeps every saved coordinate. */
export type IconLayoutMode = "auto" | "freeform"

/**
 * How many columns fit in `width`.
 * `cols = floor((W − pad) / C)` so the first icon sits at `pad` and every
 * extra column is a full cell. Remainder on the right is always &lt; C
 * (no leftover empty column).
 */
export function velvetGridColumns(
  width: number,
  cellW = VELVET_ICON_CELL.w,
  pad = VELVET_ICON_CELL.pad,
): number {
  const usable = Math.max(0, width - pad)
  return Math.max(1, Math.floor(usable / cellW))
}

export function layoutVelvetIconGrid(
  entryKeys: string[],
  width: number,
): Record<string, IconPos> {
  const { w, h, pad } = VELVET_ICON_CELL
  const cols = velvetGridColumns(width)
  const map: Record<string, IconPos> = {}
  entryKeys.forEach((key, i) => {
    map[key] = {
      x: pad + (i % cols) * w,
      y: pad + Math.floor(i / cols) * h,
    }
  })
  return map
}

/** Known auto-arrange lattices (current velvet + the old 8×96 store grid). */
const AUTO_LATTICES = [
  { w: VELVET_ICON_CELL.w, h: VELVET_ICON_CELL.h, pad: VELVET_ICON_CELL.pad },
  { w: 96, h: 100, pad: 16 },
] as const

function onLattice(pos: IconPos, cellW: number, cellH: number, pad: number, slop = 1): boolean {
  const rx = pos.x - pad
  const ry = pos.y - pad
  if (rx < -slop || ry < -slop) return false
  const ox = ((rx % cellW) + cellW) % cellW
  const oy = ((ry % cellH) + cellH) % cellH
  const onX = ox <= slop || cellW - ox <= slop
  const onY = oy <= slop || cellH - oy <= slop
  return onX && onY
}

/**
 * True when saved coords look like an auto-arrange / default pack (including
 * the broken fixed-column grids), not a freeform drag. Fresh folders (no
 * saved coords) pack. A single off-lattice drag is freeform — never treat a
 * sparse save as “mostly missing, so re-pack everyone.”
 */
export function savedPositionsLookLikeAutoGrid(
  keys: string[],
  saved: Record<string, IconPos>,
): boolean {
  if (keys.length === 0) return true
  const present = keys.filter((k) => saved[k])
  if (present.length === 0) return true
  return AUTO_LATTICES.some((lat) =>
    present.every((k) => onLattice(saved[k]!, lat.w, lat.h, lat.pad)),
  )
}

/** Stored mode wins. Otherwise infer from coords (legacy vaults with no flag). */
export function inferIconLayoutMode(
  keys: string[],
  saved: Record<string, IconPos>,
  stored?: IconLayoutMode,
): IconLayoutMode {
  if (stored === "auto" || stored === "freeform") return stored
  return savedPositionsLookLikeAutoGrid(keys, saved) ? "auto" : "freeform"
}

/**
 * Snapshot every icon, then move only `draggedKey`. Sibling coords stay
 * bit-identical — this is the freeze that drag must use.
 */
export function freezeVelvetPositions(
  current: Record<string, IconPos>,
  draggedKey: string,
  draggedPos: IconPos,
): Record<string, IconPos> {
  return { ...current, [draggedKey]: draggedPos }
}

/** Pull `${location}:${key}` records down to a key → pos map. */
export function positionsForLocation(
  iconPositions: Record<string, IconPos>,
  location: string,
  keys: string[],
): Record<string, IconPos> {
  const prefix = `${location}:`
  const out: Record<string, IconPos> = {}
  for (const key of keys) {
    const pos = iconPositions[prefix + key]
    if (pos) out[key] = pos
  }
  return out
}

/**
 * Default / auto-arrange: pack to `width` (resize may re-flow).
 * Freeform: keep saved coords exactly. New keys drop into the live pack so
 * they don't pile at (16, 16) — existing icons do not move.
 *
 * `mode` is explicit when the store knows; omit it to infer from coords.
 */
export function resolveVelvetIconPositions(
  keys: string[],
  width: number,
  saved: Record<string, IconPos>,
  mode?: IconLayoutMode,
): Record<string, IconPos> {
  const packed = layoutVelvetIconGrid(keys, width)
  const resolved = inferIconLayoutMode(keys, saved, mode)
  if (resolved === "auto") return packed
  const map: Record<string, IconPos> = {}
  for (const key of keys) {
    map[key] = saved[key] ?? packed[key] ?? { x: VELVET_ICON_CELL.pad, y: VELVET_ICON_CELL.pad }
  }
  return map
}

export function iconBoxesOverlap(
  a: IconPos,
  b: IconPos,
  boxW = VELVET_ICON_BOX.w,
  boxH = VELVET_ICON_BOX.h,
): boolean {
  return a.x < b.x + boxW && a.x + boxW > b.x && a.y < b.y + boxH && a.y + boxH > b.y
}

export function listDisplayCaption(display: string): string {
  if (display === "table") return "Details"
  if (display === "spreadsheet") return "Spreadsheet"
  if (!display) return "Default"
  return display.charAt(0).toUpperCase() + display.slice(1)
}

export function formatInspectorDate(value: Date | string | number | undefined): string {
  if (value == null) return "—"
  const dt = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(dt.getTime())) return "—"
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}
