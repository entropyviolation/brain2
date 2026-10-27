/** components/Home/Habits/phone/use-habits-phone.ts */
"use client"

import { useLayoutEffect, useState } from "react"

/**
 * Phone page gate. At 767px and under, Habits mounts the phone page.
 * At 768px and up it mounts the desktop console. Older 720px rules in
 * `habit-chrome.css` stay on the desktop stylesheet and do not choose the page.
 */
export const HABITS_PHONE_MEDIA = "(max-width: 767px)"

export function useHabitsPhone(): boolean {
  const [phone, setPhone] = useState(false)
  useLayoutEffect(() => {
    const media = window.matchMedia(HABITS_PHONE_MEDIA)
    const apply = () => setPhone(media.matches)
    apply()
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [])
  return phone
}
