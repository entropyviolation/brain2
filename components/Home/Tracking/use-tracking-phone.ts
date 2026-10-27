/**
 * components/Home/Tracking/use-tracking-phone.ts — Phone gate for Home Tracking
 *
 * The house has no single phone width: To do uses 720, this desk's stack
 * query is 760, Home chrome uses 640. Tracking's phone tree starts at 767,
 * so 768 and wider keeps the desk. The first paint is the desk; the effect
 * switches once `matchMedia` answers, which avoids a server/client mismatch.
 */
"use client"

import { useEffect, useState } from "react"

export const TRACKING_PHONE_QUERY = "(max-width: 767px)"

export function useTrackingPhone(): boolean {
  const [phone, setPhone] = useState(false)

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return
    const mq = window.matchMedia(TRACKING_PHONE_QUERY)
    const apply = () => setPhone(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  return phone
}
