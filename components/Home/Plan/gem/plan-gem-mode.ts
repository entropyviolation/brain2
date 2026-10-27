/**
 * components/Home/Plan/plan-gem-mode.ts — Plan month gem-and-trinket latch
 *
 * Optional persistable look for past days in Month view. Default is off so
 * the current chip listing stays the normal view. Same `1`/`0` localStorage
 * pattern as `plan-theme.ts`.
 */
"use client"

import { useCallback, useLayoutEffect, useState } from "react"
import { persistKey, readAliasedLocal, writeAliasedLocal } from "@/lib/storage-keys"

export const PLAN_GEM_MODE_STORAGE_KEY = persistKey("plan-gem-mode")

export function readPlanGemMode(): boolean {
  const raw = readAliasedLocal(PLAN_GEM_MODE_STORAGE_KEY)
  return raw === "1" || raw === "true"
}

export function writePlanGemMode(on: boolean): void {
  writeAliasedLocal(PLAN_GEM_MODE_STORAGE_KEY, on ? "1" : "0")
}

export function usePlanGemMode(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(false)

  useLayoutEffect(() => {
    setOn(readPlanGemMode())
  }, [])

  const setGemMode = useCallback((next: boolean) => {
    writePlanGemMode(next)
    setOn(next)
  }, [])

  return [on, setGemMode]
}
