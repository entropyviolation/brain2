/**
 * lib/habits-control-panel.ts — Home Dashboard Habits Tab Control Panel size
 *
 * The right-hand Habits column (grades, streaks, rockers, New habit,
 * Willpower gems at the foot). Width is the compact default; Physics
 * enlarges the Willpower gems display. Clamp/scale helpers remain so
 * leftover persist blobs stay finite.
 */

export const HABITS_CONTROL_PANEL_NAME = "Home Dashboard Habits Tab Control Panel"
export const HABITS_CONTROL_PANEL_SHORT_NAME = "control panel"

/** Compact shipped width (px). Physics, not a seam, enlarges the gems. */
export const HABITS_CONTROL_PANEL_DEFAULT_WIDTH = 196
export const HABITS_CONTROL_PANEL_MIN_WIDTH = 164
export const HABITS_CONTROL_PANEL_MAX_WIDTH = 440
/** Scale = width / this. The panel always paints at scale 1. */
export const HABITS_CONTROL_PANEL_BASE_WIDTH = 196

export function clampHabitsControlPanelWidth(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : HABITS_CONTROL_PANEL_DEFAULT_WIDTH
  return Math.min(HABITS_CONTROL_PANEL_MAX_WIDTH, Math.max(HABITS_CONTROL_PANEL_MIN_WIDTH, Math.round(n)))
}

/** Uniform scale for Willpower gems furniture. 1 = default compact plate. */
export function willpowerGemsScale(panelWidth: number): number {
  return clampHabitsControlPanelWidth(panelWidth) / HABITS_CONTROL_PANEL_BASE_WIDTH
}
