/**
 * components/Home/Tracking/tracking-tool-mode.ts — Draw / Erase / Scissors
 *
 * Three mutually exclusive paint tools. Hide / View / Tags are independent
 * and do not live here. The pen tray (search, beads, new pen, selected strip)
 * is Draw-only: `showPenTray(tool)` is the parent visibility rule.
 *
 * Time Grid still reads `ERASE` / `SCISSORS` on `selectedPenId` for erase and
 * split. Draw is any other id (or none) — default on Tracking load.
 */
export const ERASE = "ERASE"
export const SCISSORS = "SCISSORS"

export const TRACKING_PAINT_TOOLS = ["draw", "erase", "scissors"] as const
export type TrackingPaintTool = (typeof TRACKING_PAINT_TOOLS)[number]

let lastDrawPenId: string | null = null

export function isTrackingPaintSentinel(id: string | null | undefined): boolean {
  return id === ERASE || id === SCISSORS
}

/** Null or a real pen is Draw so first-open still has the tray. */
export function trackingPaintTool(selectedPenId: string | null | undefined): TrackingPaintTool {
  if (selectedPenId === ERASE) return "erase"
  if (selectedPenId === SCISSORS) return "scissors"
  return "draw"
}

export function showPenTray(tool: TrackingPaintTool): boolean {
  return tool === "draw"
}

export function rememberDrawPenId(id: string | null | undefined): void {
  if (id && !isTrackingPaintSentinel(id)) lastDrawPenId = id
}

export function lastRememberedDrawPenId(): string | null {
  return lastDrawPenId
}

/** Pick the sentinel or restore the last real pen for Draw. */
export function nextPaintPenId(
  tool: TrackingPaintTool,
  currentId: string | null,
  fallbackPenId: string | null,
): string | null {
  rememberDrawPenId(currentId)
  if (tool === "erase") return ERASE
  if (tool === "scissors") return SCISSORS
  if (currentId && !isTrackingPaintSentinel(currentId)) return currentId
  return lastDrawPenId ?? fallbackPenId
}

/** Tests: forget the last Draw pen after a store reset. */
export function resetTrackingPaintToolMemory(): void {
  lastDrawPenId = null
}
