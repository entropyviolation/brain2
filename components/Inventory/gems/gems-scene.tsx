/**
 * components/Inventory/gems/gems-scene.tsx — Gems and Trinkets inventory
 *
 * Reads the habit store and the task store. The bag is the same grid on the
 * desk and on the phone; only the paint changes.
 */
"use client"

import { useMemo } from "react"
import { useHabitsStore } from "@/lib/habits-store"
import { useTaskStore } from "@/lib/task-store"
import { earnedLootStacks } from "./earned-stacks"
import { GemsBag } from "./gems-bag"
import "./gems.css"

export function GemsScene({ surface }: { surface: "desk" | "phone" }) {
  const habits = useHabitsStore((state) => state.tasks)
  const weeklyData = useHabitsStore((state) => state.weeklyData)
  const tasks = useTaskStore((state) => state.tasks)
  const stacks = useMemo(
    () => earnedLootStacks({ habits, weeklyData, tasks }),
    [habits, weeklyData, tasks],
  )
  const phone = surface === "phone"
  return (
    <GemsBag
      stacks={stacks}
      columns={phone ? 4 : 8}
      minSlots={phone ? 12 : 24}
      surface={surface}
    />
  )
}
