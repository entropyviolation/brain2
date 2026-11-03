/**
 * components/Home/ToDo/task-card/task-card-unit.tsx — Hours or minutes on the task card
 *
 * One switch for every duration on the card. Minutes read `325m`. Hours use
 * `compactDuration`, including `0h45`. The choice is `brain2-task-card-time-unit`.
 */
"use client"

import { createContext, useContext, useState } from "react"
import type { ReactNode } from "react"
import { compactDuration } from "@/lib/time-entries"

const UNIT_KEY = "brain2-task-card-time-unit"
export type TaskCardTimeUnit = "h" | "m"

const TimeUnitContext = createContext<{ unit: TaskCardTimeUnit; setUnit: (unit: TaskCardTimeUnit) => void } | null>(null)

/** Hours or minutes for every duration on the card. Default minutes. */
export function TaskCardTimeUnit({ children }: { children: ReactNode }) {
  const [unit, setUnitState] = useState<TaskCardTimeUnit>(() => {
    if (typeof window === "undefined") return "m"
    return window.localStorage.getItem(UNIT_KEY) === "h" ? "h" : "m"
  })
  const setUnit = (next: TaskCardTimeUnit) => {
    setUnitState(next)
    try {
      window.localStorage.setItem(UNIT_KEY, next)
    } catch {
      /* private mode */
    }
  }
  return <TimeUnitContext.Provider value={{ unit, setUnit }}>{children}</TimeUnitContext.Provider>
}

export function useTaskCardTimeUnit(): TaskCardTimeUnit {
  return useContext(TimeUnitContext)?.unit ?? "m"
}

/** The switch, including `setUnit`. Null outside `TaskCardTimeUnit`. */
export function useTaskCardTimeControls() {
  return useContext(TimeUnitContext)
}

/** Minutes read `325m`. Hours use `compactDuration`, including `0h45`. */
export function formatStatMinutes(minutes: number, unit: TaskCardTimeUnit): string {
  const n = Math.max(0, Math.round(minutes))
  return unit === "h" ? compactDuration(n, true) : `${n}m`
}

/** A duration that follows the card's h/m switch. Renders inside `TaskCardTimeUnit`. */
export function CardMinutes({ minutes }: { minutes: number }) {
  return <>{formatStatMinutes(minutes, useTaskCardTimeUnit())}</>
}
