/**
 * hooks/use-chrome-history-inbox.ts — Accept the Chrome extension's daily export.
 *
 * Mounted once from `app/page.tsx`. Polls the local inbox, and takes a push
 * when this tab is the Chrome that has the extension. Quiet when neither is there.
 */
"use client"

import { useEffect } from "react"
import {
  CHROME_HISTORY_POLL,
  CHROME_HISTORY_PUSH,
  CHROME_HISTORY_READY,
  ingestChromeHistoryInbox,
  ingestPushedChromeHistory,
} from "@/lib/chrome-history-inbox"

const POLL_MS = 60 * 1000

export function useChromeHistoryInbox(): void {
  useEffect(() => {
    let cancelled = false
    let pulling = false
    const pull = () => {
      if (cancelled || pulling) return
      pulling = true
      void (async () => {
        try {
          // The inbox hands over a few days at a time. Keep going until it is empty.
          for (let i = 0; i < 40 && !cancelled; i++) {
            const n = await ingestChromeHistoryInbox()
            if (!n) return
          }
        } finally {
          pulling = false
        }
      })()
    }
    const onPush = (event: Event) => {
      if (!cancelled) void ingestPushedChromeHistory((event as CustomEvent).detail)
    }
    pull()
    const timer = window.setInterval(pull, POLL_MS)
    window.addEventListener(CHROME_HISTORY_PUSH, onPush)
    window.addEventListener(CHROME_HISTORY_POLL, pull)
    window.dispatchEvent(new Event(CHROME_HISTORY_READY))
    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener(CHROME_HISTORY_PUSH, onPush)
      window.removeEventListener(CHROME_HISTORY_POLL, pull)
    }
  }, [])
}
