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

export const TODO_PREFS_KEY = persistKey("todo-prefs")

export const DEFAULT_WIP_LIMIT = 3
export const MIN_WIP_LIMIT = 1
export const MAX_WIP_LIMIT = 99

export const LID_SECTIONS = ["flags", "time", "steps"] as const
export type TodoLidSection = (typeof LID_SECTIONS)[number]

export type TodoPrefs = {
  availableNow: boolean
  wipLimit: number
  /** True when that open-lid section is folded. Missing keys stay open. */
  lidCollapsed: Record<TodoLidSection, boolean>
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
      snapshot.lidCollapsed.steps === false
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
