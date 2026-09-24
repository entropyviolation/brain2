/**
 * lib/use-persisted-scroll.ts — Restore a scroller after remount / refresh
 *
 * Radix tab panels hide (`hidden` / `data-state="inactive"`) then unmount, which
 * collapses `scrollTop` to 0. Writes skip that collapse so a later remount can
 * put the reader back where they were (`APP_NAV_KEYS.uiScroll`).
 */
"use client"

import { useLayoutEffect, type RefObject } from "react"
import { readScrollOffset, writeScrollOffset } from "@/lib/app-navigation"

export function isInactiveScroller(el: HTMLElement): boolean {
  if (el.hidden) return true
  if (el.closest("[hidden], [data-state='inactive']")) return true
  if (typeof window === "undefined") return false
  const style = window.getComputedStyle(el)
  return style.display === "none" || style.visibility === "hidden"
}

export function canPersistScroller(el: HTMLElement): boolean {
  if (isInactiveScroller(el)) return false
  return el.clientHeight >= 8
}

export function usePersistedScroll(
  slot: string | null,
  ref: RefObject<HTMLElement | null>,
): void {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !slot) return
    const target = readScrollOffset(slot)
    let restoring = false
    let last = target
    let zeroTimer: ReturnType<typeof setTimeout> | null = null
    const restore = () => {
      restoring = true
      el.scrollTop = target
      requestAnimationFrame(() => {
        el.scrollTop = target
        restoring = false
      })
    }
    restore()
    const persistVisible = (top: number) => {
      last = top
      writeScrollOffset(slot, top)
    }
    const persist = () => {
      if (!canPersistScroller(el) || (el.scrollTop === 0 && last > 0)) {
        if (last > 0) writeScrollOffset(slot, last)
        return
      }
      persistVisible(el.scrollTop)
    }
    const onScroll = () => {
      if (!canPersistScroller(el)) return
      if (restoring && Math.abs(el.scrollTop - last) < 2) return
      restoring = false
      const top = el.scrollTop
      if (top === 0 && last > 0) {
        if (zeroTimer) clearTimeout(zeroTimer)
        zeroTimer = setTimeout(() => {
          zeroTimer = null
          if (!canPersistScroller(el) || el.scrollTop !== 0) return
          persistVisible(0)
        }, 80)
        return
      }
      persistVisible(top)
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("pagehide", persist)
    document.addEventListener("visibilitychange", persist)
    return () => {
      if (zeroTimer) clearTimeout(zeroTimer)
      persist()
      el.removeEventListener("scroll", onScroll)
      window.removeEventListener("pagehide", persist)
      document.removeEventListener("visibilitychange", persist)
    }
  }, [slot, ref])
}
