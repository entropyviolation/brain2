/**
 * app/lab/habit-helper/page.tsx — Design and test the Daily Habit Helper's flow
 *
 * A standalone route, like `/lab/tracking-helper`. The Habit Helper's chat has a door here. The bench edits
 * and runs the flow; the tests under it replay, read by rules, or re-ask it. Runs write nothing.
 * See `components/Lab/HabitHelper/README.md`.
 */
"use client"

import { HabitHelperLab } from "@/components/Lab/HabitHelper/HabitHelperLab"
import { HabitHelperTests } from "@/components/Lab/HabitHelper/habit-helper-tests"

export default function HabitHelperLabPage() {
  return (
    <>
      <HabitHelperLab />
      <HabitHelperTests />
    </>
  )
}
