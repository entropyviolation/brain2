/**
 * lib/use-persisted-tab.ts — Remember which tab was open
 *
 * `live` (default) reads storage during the first render. Panels behind a
 * lazy boundary are not in the static HTML, so that read cannot mismatch
 * hydration: Habits, Plan, To Do, and Analytics open on the saved view.
 *
 * `hydrate` is only for the app shell, which *is* in the static HTML. The
 * first render stays on the fallback so Radix hydrates the server trigger,
 * then a layout effect applies the stored tab before the browser paints.
 * The shell mounts no panel until that effect has run, so a refresh on
 * Lists never downloads Home.
 *
 * Writes go through the setter so Strict Mode cannot persist the fallback
 * before restore. Screen history (`cogs-nav-restore`) re-reads the pins.
 */
"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react"
import { readStoredTab, writeStoredTab } from "@/lib/app-navigation"
import { subscribeNavRestore } from "@/lib/screen-location"

export type PersistedTabMode = "live" | "hydrate"

export function usePersistedTab<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
  mode: PersistedTabMode = "live",
): [T, Dispatch<SetStateAction<T>>] {
  const [tab, setTabState] = useState<T>(() =>
    mode === "hydrate" ? fallback : readStoredTab(key, allowed, fallback),
  )
  const allowedRef = useRef(allowed)
  const fallbackRef = useRef(fallback)
  allowedRef.current = allowed
  fallbackRef.current = fallback

  useLayoutEffect(() => {
    if (mode !== "hydrate") return
    setTabState(readStoredTab(key, allowedRef.current, fallbackRef.current))
  }, [key, mode])

  useEffect(() => {
    return subscribeNavRestore(() => {
      setTabState(readStoredTab(key, allowedRef.current, fallbackRef.current))
    })
  }, [key])

  const setTab = useCallback<Dispatch<SetStateAction<T>>>(
    (value) => {
      setTabState((prev) => {
        const next = typeof value === "function" ? value(prev) : value
        writeStoredTab(key, next)
        return next
      })
    },
    [key],
  )

  return [tab, setTab]
}
