/**
 * components/Home/Plan/plan-theme.ts — Plan-only dark chrome latch
 *
 * Optional persistable look for the Plan calendar window. Default is gray
 * Win95 (`false`). Does not theme the rest of BRAIN2 or portaled dialogs.
 */
"use client"

import { useCallback, useLayoutEffect, useState } from "react"
import { persistKey, readAliasedLocal, writeAliasedLocal } from "@/lib/storage-keys"

export const PLAN_DARK_STORAGE_KEY = persistKey("plan-dark")

export function readPlanDarkMode(): boolean {
  const raw = readAliasedLocal(PLAN_DARK_STORAGE_KEY)
  return raw === "1" || raw === "true"
}

export function writePlanDarkMode(on: boolean): void {
  writeAliasedLocal(PLAN_DARK_STORAGE_KEY, on ? "1" : "0")
}

export function usePlanDarkMode(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(false)

  useLayoutEffect(() => {
    setOn(readPlanDarkMode())
  }, [])

  const setDark = useCallback((next: boolean) => {
    writePlanDarkMode(next)
    setOn(next)
  }, [])

  return [on, setDark]
}
