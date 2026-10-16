/**
 * components/steps/step-folds.ts — Which step branches are folded
 *
 * A fold is remembered per step id, across hosts and reloads, in
 * `brain2-step-folds` (a plain id list). View state only: it is not in backups
 * and never touches the task.
 */
"use client"

import { useSyncExternalStore } from "react"
import { persistKey } from "@/lib/storage-keys"

const KEY = persistKey("step-folds")
const listeners = new Set<() => void>()
let folds: ReadonlySet<string> = load()

function load(): ReadonlySet<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = window.localStorage.getItem(KEY)
    const ids = raw ? (JSON.parse(raw) as unknown) : []
    return new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [])
  } catch {
    return new Set()
  }
}

export function toggleStepFold(id: string, fold?: boolean): void {
  const next = new Set(folds)
  const on = fold ?? !next.has(id)
  if (on) next.add(id)
  else next.delete(id)
  folds = next
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...next]))
  } catch {
    /* private mode — the fold still holds for this session */
  }
  for (const listener of listeners) listener()
}

const EMPTY: ReadonlySet<string> = new Set()

export function useStepFolds(): ReadonlySet<string> {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => folds,
    () => EMPTY,
  )
}

/** Tests: re-read after `localStorage.clear()`. */
export function resetStepFoldsForTests(): void {
  folds = load()
  for (const listener of listeners) listener()
}
