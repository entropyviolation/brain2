"use client"

import { useLayoutEffect, useState } from "react"

/** Phone layout. 768px and wider stays the desktop controls. */
export const COMPACT_MEDIA = "(max-width: 767px)"

export type SafeInsets = { top: number; right: number; bottom: number; left: number }

const ZERO: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 }

/**
 * One probe per viewport size. Every Select, Dropdown, and Tooltip asks on
 * mount, and each probe forced a style and layout pass, so a screen of
 * tooltips did that dozens of times while it opened.
 */
let cached: { key: string; insets: SafeInsets } | null = null

export function readSafeInsets(): SafeInsets {
  if (typeof document === "undefined") return ZERO
  const key = `${window.innerWidth}x${window.innerHeight}`
  if (cached?.key === key) return cached.insets
  cached = { key, insets: probeSafeInsets() }
  return cached.insets
}

function probeSafeInsets(): SafeInsets {
  const probe = document.createElement("div")
  probe.style.cssText =
    "position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);"
  document.body.appendChild(probe)
  const cs = getComputedStyle(probe)
  const n = (value: string) => {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  const insets = {
    top: n(cs.paddingTop),
    right: n(cs.paddingRight),
    bottom: n(cs.paddingBottom),
    left: n(cs.paddingLeft),
  }
  probe.remove()
  return insets
}

export type CollisionPadding = number | { top: number; right: number; bottom: number; left: number }

/** Desktop menus keep a 0 inset. On a phone, keep the menu inside the safe area. */
export function useCompactCollisionPadding(): CollisionPadding {
  const [pad, setPad] = useState<CollisionPadding>(0)
  useLayoutEffect(() => {
    if (typeof window.matchMedia !== "function") return
    const mq = window.matchMedia(COMPACT_MEDIA)
    const apply = () => {
      if (!mq.matches) {
        setPad((current) => (current === 0 ? current : 0))
        return
      }
      const safe = readSafeInsets()
      setPad({
        top: Math.max(8, safe.top),
        right: Math.max(8, safe.right),
        bottom: Math.max(8, safe.bottom),
        left: Math.max(8, safe.left),
      })
    }
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])
  return pad
}
