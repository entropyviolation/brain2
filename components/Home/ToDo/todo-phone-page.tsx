/**
 * components/Home/ToDo/todo-phone-page.tsx — Phone To Do page
 *
 * Its own screen. The desktop fascia in `todo-panel.tsx` is not mounted here.
 * Same stores and the same task writes. The list, gestures, and sheets are
 * `todo-mobile.tsx`. The reads, verbs, and overlays live in `phone/`.
 * `phone/phone-desk-remnant.tsx` is the old desk sheet, built and not called.
 */
"use client"

import { PhoneScreen } from "./phone/phone-screen"
import { usePhonePageModel } from "./phone/use-phone-page"
import "./todo-chrome.css"

export function TodoPhonePage({
  currentDate,
  setCurrentDate,
}: {
  currentDate?: Date
  setCurrentDate?: (date: Date) => void
} = {}) {
  const model = usePhonePageModel({ currentDate, setCurrentDate })
  return <PhoneScreen model={model} />
}
