/**
 * components/Home/Habits/habit-tracker.tsx — Phone or desktop switch.
 *
 * `WeeklyTaskTracker` is the public door. Under 767px it mounts
 * `HabitsPhonePage`. At 768px and up it mounts the desktop page.
 * The three habit skins load with this module. The two trees never mount together.
 */
"use client"

import { useHabitsPhone } from "@/components/Home/Habits/phone/use-habits-phone"
import { HabitsPhonePage } from "@/components/Home/Habits/phone/habits-phone-page"
import { HabitsDesktopPage } from "@/components/Home/Habits/tracker/habits-desktop-page"
import "./habit-grid.css"
import "./habit-chrome.css"
import "./noble-gas-tube.css"

/** Phone page or desktop console. The two trees never mount together. */
export function WeeklyTaskTracker({ currentDate = new Date() }: { currentDate?: Date }) {
  const phone = useHabitsPhone()
  if (phone) return <HabitsPhonePage currentDate={currentDate} />
  return <HabitsDesktopPage currentDate={currentDate} />
}

export default WeeklyTaskTracker
