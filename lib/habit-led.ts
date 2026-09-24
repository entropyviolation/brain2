/**
 * lib/habit-led.ts — Habits instrument-light helpers
 *
 * Cell lamps and percent readouts share one tint. Percent math stays in the
 * grid; this file only formats and sanitizes display prefs. The hex is also
 * pinned at `brain2-habit-led-tint` so a hub merge cannot restore an old purple.
 * A tint picked this page is also remembered on `brain2-led-pick` (sessionStorage)
 * so Fast Refresh / a late hub rehydrate cannot roll the lamps back.
 */

import { persistKey, readAliasedLocal, writeAliasedLocal } from "@/lib/storage-keys"

export const DEFAULT_PERCENT_LED_TINT = "#7e14ff"

/** Tiny pin next to the habits blob — refresh / hub merge read this first. */
export const PERCENT_LED_TINT_STORAGE_KEY = persistKey("habit-led-tint")

/** This tab's last LED pick. Survives Fast Refresh; boot script clears it on a real load. */
export const PERCENT_LED_SESSION_KEY = "brain2-led-pick"

const HEX6 = /^#[0-9a-fA-F]{6}$/

export function sanitizePercentLedTint(value: unknown): string {
  if (typeof value === "string" && HEX6.test(value.trim())) {
    return value.trim().toLowerCase()
  }
  return DEFAULT_PERCENT_LED_TINT
}

export function readStoredPercentLedTint(): string | null {
  if (typeof localStorage === "undefined") return null
  try {
    const raw = readAliasedLocal(PERCENT_LED_TINT_STORAGE_KEY)
    return typeof raw === "string" && HEX6.test(raw.trim()) ? raw.trim().toLowerCase() : null
  } catch {
    return null
  }
}

export function readSessionPercentLedTint(): string | null {
  if (typeof sessionStorage === "undefined") return null
  try {
    const raw = sessionStorage.getItem(PERCENT_LED_SESSION_KEY)
    return typeof raw === "string" && HEX6.test(raw.trim()) ? raw.trim().toLowerCase() : null
  } catch {
    return null
  }
}

function rememberSessionPercentLedTint(hex: string) {
  if (typeof sessionStorage === "undefined") return
  try {
    sessionStorage.setItem(PERCENT_LED_SESSION_KEY, hex)
  } catch {
    /* session pick is best-effort */
  }
}

export function writeStoredPercentLedTint(value: unknown, opts?: { session?: boolean }): string {
  const hex = sanitizePercentLedTint(value)
  if (opts?.session !== false) rememberSessionPercentLedTint(hex)
  if (typeof localStorage === "undefined") return hex
  try {
    writeAliasedLocal(PERCENT_LED_TINT_STORAGE_KEY, hex)
  } catch {
    /* pin is best-effort; habits persist is the other copy */
  }
  return hex
}

/** Same rounding the old pastel bars used (`toFixed(0)`). */
export function percentLedText(percentage: number): string {
  const n = Math.round(Number.isFinite(percentage) ? percentage : 0)
  return `${n}%`
}

const BAR_LAMPS = 10

/** How many of the 10 loading-bar lamps are lit. 50% → 5 on, 5 off. */
export function percentBarLitCount(percentage: number): number {
  const n = Math.round(Number.isFinite(percentage) ? percentage : 0)
  if (n <= 0) return 0
  if (n >= 100) return BAR_LAMPS
  return Math.round(n / 10)
}

export type HabitLampState = "off" | "on" | "partial"

export function booleanLampState(completed: boolean | undefined, ratio?: number): HabitLampState {
  if (completed) return "on"
  if (typeof ratio === "number" && ratio > 0 && ratio < 1) return "partial"
  return "off"
}
