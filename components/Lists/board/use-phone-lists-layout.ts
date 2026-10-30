"use client"

/**
 * components/Lists/board/use-phone-lists-layout.ts
 *
 * True in the iOS shell, and when the Lists window is at the phone width
 * the file manager already uses (767px). A wide desktop window stays false,
 * so the phone title, keycaps, and folder toggle never mount there.
 */
import { useSyncExternalStore } from "react"
import { useInMobileShell } from "@/components/Mobile/use-in-mobile-shell"

const PHONE_LISTS_QUERY = "(max-width: 767px)"

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => {}
  const mq = window.matchMedia(PHONE_LISTS_QUERY)
  mq.addEventListener("change", onChange)
  return () => mq.removeEventListener("change", onChange)
}

function narrow() {
  if (typeof window.matchMedia !== "function") return false
  return window.matchMedia(PHONE_LISTS_QUERY).matches
}

export function usePhoneListsLayout(): boolean {
  const shell = useInMobileShell()
  const compact = useSyncExternalStore(subscribe, narrow, () => false)
  return shell || compact
}
