/**
 * Scroll pin for the idea list.
 * Holds `scrollTop` across Transfer to log, including the later log write.
 * The caret `scrollIntoView` effect stays in the view so it still runs after the selection effect.
 */
"use client"

import { useLayoutEffect, useRef } from "react"

export function useInboxRowsScroll() {
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const rowsScrollRef = useRef<HTMLDivElement>(null)
  /** Scroll offset held across Transfer to log, including the later log write. */
  const pinnedRowsScroll = useRef<number | null>(null)
  const restoringRowsScroll = useRef(false)
  const caretScrollSuppressed = useRef<string | null>(null)

  const restorePinnedRowsScroll = () => {
    const el = rowsScrollRef.current
    const top = pinnedRowsScroll.current
    if (!el || top == null || el.scrollTop === top) return
    restoringRowsScroll.current = true
    el.scrollTop = top
    restoringRowsScroll.current = false
  }

  const releaseRowsScrollPin = () => {
    pinnedRowsScroll.current = null
  }

  useLayoutEffect(() => {
    restorePinnedRowsScroll()
  })

  return {
    rowRefs,
    rowsScrollRef,
    pinnedRowsScroll,
    restoringRowsScroll,
    caretScrollSuppressed,
    restorePinnedRowsScroll,
    releaseRowsScrollPin,
  }
}
