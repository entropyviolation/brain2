/** components/Home/Habits/phone/use-habits-phone.ts */
"use client"

import { useLayoutEffect, useState } from "react"

/**
 * Phone page gate. At 767px and under, Habits mounts the phone page.
 * At 768px and up it mounts the desktop console. Older 720px rules in
 * `habit-chrome.css` stay on the desktop stylesheet and do not choose the page.
 */
export const HABITS_PHONE_MEDIA = "(max-width: 767px)"

/**
 * Starts from the media query, not `false`. Home only mounts on the client, so
 * the first render can read it. Starting false built the whole desktop page
 * on every phone visit, then threw it away for the phone page.
 */
export function useHabitsPhone(): boolean {
  const [phone, setPhone] = useState(
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(HABITS_PHONE_MEDIA).matches,
  )
  useLayoutEffect(() => {
    const media = window.matchMedia(HABITS_PHONE_MEDIA)
    const apply = () => setPhone(media.matches)
    apply()
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [])
  return phone
}
