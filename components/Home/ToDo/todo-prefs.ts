/**
 * components/Home/ToDo/todo-prefs.ts — To Do view prefs
 *
 * Available-now filter (default off), the soft WIP cap (default 3), and which
 * open-lid sections are collapsed (flags / time / steps, default all open).
 * Same localStorage snapshot pattern as Tracking view prefs. Not a second store.
 */
"use client"

import { useSyncExternalStore } from "react"

import { persistKey, readAliasedLocal, writeAliasedLocal } from "@/lib/storage-keys"
import { DEFAULT_ESTIMATE_MIN } from "@/lib/todo-steps"

export const TODO_PREFS_KEY = persistKey("todo-prefs")

export const DEFAULT_WIP_LIMIT = 3
export const MIN_WIP_LIMIT = 1
export const MAX_WIP_LIMIT = 99

export const MAX_DEFAULT_ESTIMATE_MIN = 600

export function clampDefaultEstimate(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value)
  if (value === undefined || value === null || value === "" || !Number.isFinite(n)) return DEFAULT_ESTIMATE_MIN
  return Math.min(MAX_DEFAULT_ESTIMATE_MIN, Math.max(0, Math.round(n)))
}

export const LID_SECTIONS = ["flags", "time", "steps"] as const
export type TodoLidSection = (typeof LID_SECTIONS)[number]

export type TodoPrefs = {
  availableNow: boolean
  wipLimit: number
  /** True when that open-lid section is folded. Missing keys stay open. */
  lidCollapsed: Record<TodoLidSection, boolean>
  /** Hide Night ritual before sunset and an unstarted Morning ritual after it, on today's day lens. */
  ritesFollowSun: boolean
  /** Minutes counted for a task with no estimate and no steps; shown as `~30`. 0 = none. Never written to the task. */
  defaultEstimateMin: number
  /** Pace overrides by `paceKey` (`lib/estimate-pace.ts`). A missing key reads your own median. */
  paceOverrides: Record<string, number>
  /** The dim "usually ×2.4 for you" ghost beside estimates. */
  paceGhosts: boolean
  /** Session fit gauge → Padded for you: lines read at your own pace (`sessionPaceFactor`). Off shows raw estimates. */
  sessionPadded: boolean
  /** Hide steps and rows waiting on an open prerequisite (`lib/prereqs.ts`). Never hides for being incomplete. */
  hideLocked: boolean
  /** A branch shows only its next step and "+ N more" until opened. */
  showNextOnly: boolean
}

export const DEFAULT_LID_COLLAPSED: Record<TodoLidSection, boolean> = {
  flags: false,
  time: false,
  steps: false,
}

export const DEFAULT_TODO_PREFS: TodoPrefs = {
  availableNow: false,
  wipLimit: DEFAULT_WIP_LIMIT,
  lidCollapsed: { ...DEFAULT_LID_COLLAPSED },
  ritesFollowSun: true,
  defaultEstimateMin: DEFAULT_ESTIMATE_MIN,
  paceOverrides: {},
  paceGhosts: true,
  sessionPadded: true,
  hideLocked: false,
  showNextOnly: false,
}

/** Keeps only positive finite overrides, clamped to 0.5–4. */
export function normalizePaceOverrides(value: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (!value || typeof value !== "object") return out
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const n = typeof raw === "number" ? raw : Number(raw)
    if (Number.isFinite(n) && n > 0) out[key] = Math.min(4, Math.max(0.5, n))
  }
  return out
}

export function normalizeLidCollapsed(value: unknown): Record<TodoLidSection, boolean> {
  const raw = value && typeof value === "object" ? (value as Partial<Record<TodoLidSection, boolean>>) : {}
  return {
    flags: raw.flags === true,
    time: raw.time === true,
    steps: raw.steps === true,
  }
}

const listeners = new Set<() => void>()
let snapshot: TodoPrefs = load()

export function clampWipLimit(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_WIP_LIMIT
  return Math.min(MAX_WIP_LIMIT, Math.max(MIN_WIP_LIMIT, Math.round(n)))
}

function load(): TodoPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_TODO_PREFS }
  try {
    const raw = readAliasedLocal(TODO_PREFS_KEY)
    if (!raw) return { ...DEFAULT_TODO_PREFS }
    const parsed = JSON.parse(raw) as Partial<TodoPrefs>
    return {
      availableNow: parsed.availableNow === true,
      wipLimit: clampWipLimit(parsed.wipLimit),
      lidCollapsed: normalizeLidCollapsed(parsed.lidCollapsed),
      ritesFollowSun: parsed.ritesFollowSun !== false,
      defaultEstimateMin: clampDefaultEstimate(parsed.defaultEstimateMin),
      paceOverrides: normalizePaceOverrides(parsed.paceOverrides),
      paceGhosts: parsed.paceGhosts !== false,
      sessionPadded: parsed.sessionPadded !== false,
      hideLocked: parsed.hideLocked === true,
      showNextOnly: parsed.showNextOnly === true,
    }
  } catch {
    return { ...DEFAULT_TODO_PREFS }
  }
}

function emit() {
  for (const listener of listeners) listener()
}

export function getTodoPrefs(): TodoPrefs {
  if (typeof window !== "undefined" && !readAliasedLocal(TODO_PREFS_KEY)) {
    const same =
      snapshot.availableNow === DEFAULT_TODO_PREFS.availableNow &&
      snapshot.wipLimit === DEFAULT_TODO_PREFS.wipLimit &&
      snapshot.lidCollapsed.flags === false &&
      snapshot.lidCollapsed.time === false &&
      snapshot.lidCollapsed.steps === false &&
      snapshot.ritesFollowSun === DEFAULT_TODO_PREFS.ritesFollowSun &&
      snapshot.defaultEstimateMin === DEFAULT_TODO_PREFS.defaultEstimateMin &&
      Object.keys(snapshot.paceOverrides).length === 0 &&
      snapshot.paceGhosts === DEFAULT_TODO_PREFS.paceGhosts &&
      snapshot.sessionPadded === DEFAULT_TODO_PREFS.sessionPadded &&
      snapshot.hideLocked === DEFAULT_TODO_PREFS.hideLocked &&
      snapshot.showNextOnly === DEFAULT_TODO_PREFS.showNextOnly
    if (!same) snapshot = { ...DEFAULT_TODO_PREFS }
  }
  return snapshot
}

export function setTodoPrefs(
  patch: Partial<Omit<TodoPrefs, "lidCollapsed">> & {
    lidCollapsed?: Partial<TodoPrefs["lidCollapsed"]>
  },
): void {
  snapshot = {
    availableNow: patch.availableNow ?? snapshot.availableNow,
    wipLimit: patch.wipLimit !== undefined ? clampWipLimit(patch.wipLimit) : snapshot.wipLimit,
    lidCollapsed: normalizeLidCollapsed({
      ...snapshot.lidCollapsed,
      ...(patch.lidCollapsed ?? {}),
    }),
    ritesFollowSun: patch.ritesFollowSun ?? snapshot.ritesFollowSun,
    defaultEstimateMin:
      patch.defaultEstimateMin !== undefined ? clampDefaultEstimate(patch.defaultEstimateMin) : snapshot.defaultEstimateMin,
    paceOverrides:
      patch.paceOverrides !== undefined ? normalizePaceOverrides(patch.paceOverrides) : snapshot.paceOverrides,
    paceGhosts: patch.paceGhosts ?? snapshot.paceGhosts,
    sessionPadded: patch.sessionPadded ?? snapshot.sessionPadded,
    hideLocked: patch.hideLocked ?? snapshot.hideLocked,
    showNextOnly: patch.showNextOnly ?? snapshot.showNextOnly,
  }
  try {
    writeAliasedLocal(TODO_PREFS_KEY, JSON.stringify(snapshot))
  } catch {
    /* private mode — prefs still apply for this session */
  }
  emit()
}

export function subscribeTodoPrefs(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTodoPrefs(): TodoPrefs {
  return useSyncExternalStore(subscribeTodoPrefs, getTodoPrefs, () => DEFAULT_TODO_PREFS)
}

/** Tests: re-read after `localStorage.clear()`. */
export function resetTodoPrefsForTests(): void {
  snapshot = load()
  emit()
}
