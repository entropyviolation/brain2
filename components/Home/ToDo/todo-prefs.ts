/**
 * components/Home/ToDo/todo-prefs.ts — To Do view prefs
 *
 * Available-now filter (default off) and the soft WIP cap (default 3). Same
 * localStorage snapshot pattern as Tracking view prefs. Not a second store.
 */
"use client"

import { useSyncExternalStore } from "react"

import { persistKey, readAliasedLocal, writeAliasedLocal } from "@/lib/storage-keys"

export const TODO_PREFS_KEY = persistKey("todo-prefs")

export const DEFAULT_WIP_LIMIT = 3
export const MIN_WIP_LIMIT = 1
export const MAX_WIP_LIMIT = 99

export type TodoPrefs = {
  availableNow: boolean
  wipLimit: number
}

export const DEFAULT_TODO_PREFS: TodoPrefs = {
  availableNow: false,
  wipLimit: DEFAULT_WIP_LIMIT,
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
      snapshot.wipLimit === DEFAULT_TODO_PREFS.wipLimit
    if (!same) snapshot = { ...DEFAULT_TODO_PREFS }
  }
  return snapshot
}

export function setTodoPrefs(patch: Partial<TodoPrefs>): void {
  snapshot = {
    availableNow: patch.availableNow ?? snapshot.availableNow,
    wipLimit: patch.wipLimit !== undefined ? clampWipLimit(patch.wipLimit) : snapshot.wipLimit,
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
