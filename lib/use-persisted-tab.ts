/**
 * lib/use-persisted-tab.ts — Restore a tab after hydration
 *
 * Reading localStorage in useState() returns the fallback during SSR (no
 * window) and the stored tab on the client, so Radix hydrates with Home
 * active and never clears that `data-state`. First render always uses the
 * fallback; a layout effect then applies the stored tab so Radix sees a
 * normal value change. Writes go through the setter so Strict Mode cannot
 * persist the fallback before restore.
 */
"use client"

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react"
import { readStoredTab, writeStoredTab } from "@/lib/app-navigation"

export function usePersistedTab<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [tab, setTabState] = useState<T>(fallback)
  const allowedRef = useRef(allowed)
  const fallbackRef = useRef(fallback)
  allowedRef.current = allowed
  fallbackRef.current = fallback

  useLayoutEffect(() => {
    setTabState(readStoredTab(key, allowedRef.current, fallbackRef.current))
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
