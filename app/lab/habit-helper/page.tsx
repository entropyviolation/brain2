/**
 * app/lab/habit-helper/page.tsx — Design and test the Habits BIMBY's flow
 *
 * A standalone route, like `/lab/tracking-helper`. The Habits BIMBY's chat has a door here. The bench edits
 * and runs the flow; the tests under it replay, read by rules, or re-ask it. Runs write nothing.
 * See `components/Lab/HabitHelper/README.md`.
 */
"use client"

import { HabitsBimbyLab } from "@/components/Lab/HabitHelper/HabitsBimbyLab"
import { HabitsBimbyTests } from "@/components/Lab/HabitHelper/habit-helper-tests"

export default function HabitsBimbyLabPage() {
  return (
    <>
      <HabitsBimbyLab />
      <HabitsBimbyTests />
    </>
  )
}
