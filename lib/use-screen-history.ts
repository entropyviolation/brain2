/**
 * lib/use-screen-history.ts — React binding for header Back / Forward
 */
"use client"

import { useCallback, useEffect, useState } from "react"
import {
  getScreenHistorySnapshot,
  screenHistoryBack,
  screenHistoryForward,
  seedScreenHistoryIfNeeded,
  subscribeScreenHistory,
} from "@/lib/screen-history-controller"
import type { ScreenHistorySnapshot } from "@/lib/screen-history"

export function useScreenHistory(): {
  canBack: boolean
  canForward: boolean
  back: () => void
  forward: () => void
} {
  const [snap, setSnap] = useState<ScreenHistorySnapshot>(() => getScreenHistorySnapshot())

  useEffect(() => {
    seedScreenHistoryIfNeeded()
    setSnap(getScreenHistorySnapshot())
    return subscribeScreenHistory(() => setSnap(getScreenHistorySnapshot()))
  }, [])

  const back = useCallback(() => {
    screenHistoryBack()
  }, [])

  const forward = useCallback(() => {
    screenHistoryForward()
  }, [])

  return {
    canBack: snap.canBack,
    canForward: snap.canForward,
    back,
    forward,
  }
}
