/**
 * components/Home/Plan/phone/use-plan-phone.ts — Phone gate for Plan
 *
 * Phone layout mounts only when this matches. The desktop tree stays mounted
 * otherwise, including on the server (snapshot is false). 767px is the phone
 * width: Home stacks some labs at 720px, and the shell’s narrow title bar is
 * 520px, so neither is the phone cut for Plan.
 */
"use client"

import { useSyncExternalStore } from "react"

export const PLAN_PHONE_QUERY = "(max-width: 767px)"
const REDUCE_QUERY = "(prefers-reduced-motion: reduce)"

function subscribeQuery(query: string, onChange: () => void) {
  const mq = window.matchMedia(query)
  mq.addEventListener("change", onChange)
  return () => mq.removeEventListener("change", onChange)
}

export function usePlanPhone(): boolean {
  return useSyncExternalStore(
    (onChange) => subscribeQuery(PLAN_PHONE_QUERY, onChange),
    () => window.matchMedia(PLAN_PHONE_QUERY).matches,
    () => false,
  )
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => subscribeQuery(REDUCE_QUERY, onChange),
    () => window.matchMedia(REDUCE_QUERY).matches,
    () => false,
  )
}
