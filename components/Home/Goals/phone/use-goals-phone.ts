/**
 * components/Home/Goals/phone/use-goals-phone.ts — phone gate for Home → Goals
 *
 * The room already restyles a few wells at 720px (`goals-chrome.css`). The
 * phone tree uses that same query so the mill and the phone UI never both
 * mount. Above 720px this hook is false and `GoalsTracker` keeps the fascia.
 */
"use client"

import { useSyncExternalStore } from "react"

/** Matches `@media (max-width: 720px)` in `goals-chrome.css`. */
export const GOALS_PHONE_QUERY = "(max-width: 720px)"

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)"

function subscribe(query: string, onChange: () => void) {
  const media = window.matchMedia(query)
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => subscribe(query, onChange),
    () => window.matchMedia(query).matches,
    () => false,
  )
}

export function useGoalsPhone() {
  return useMediaQuery(GOALS_PHONE_QUERY)
}

export function useGoalsReducedMotion() {
  return useMediaQuery(REDUCED_QUERY)
}
