/**
 * components/Home/ToDo/desk/use-todo-desk-lens.ts — Tab and lens dates
 *
 * Day follows Home's shared day. Week, month, and season keep a local offset
 * that a later shared-day change does not overwrite. `setFocusedDate` is a new
 * function every render.
 */
"use client"

import { useState } from "react"
import { APP_NAV_KEYS } from "@/lib/app-navigation"
import { usePersistedTab } from "@/lib/use-persisted-tab"
import { TODO_TABS, type TodoTab } from "./todo-desk-constants"

export function useTodoDeskLens(
  controlledDate: Date | undefined,
  setControlledDate: ((date: Date) => void) | undefined,
) {
  const [activeTodoTab, setActiveTodoTab] = usePersistedTab(APP_NAV_KEYS.homeTodoTab, TODO_TABS, "day")
  // Other (custom ranges) has its own sheet; the period machinery below keeps reading a period.
  const periodTab: Exclude<TodoTab, "other"> = activeTodoTab === "other" ? "day" : activeTodoTab
  // Uncontrolled fallback for unit tests. The day sheet reads the prop itself
  // when Home passes one, so midnight catch-up is not a copy taken at mount.
  const [internalDate, setInternalDate] = useState(new Date())
  const currentDate = controlledDate ?? internalDate
  const setCurrentDate = setControlledDate ?? setInternalDate
  // Unset until that nameplate is used. A later shared-day change must not
  // overwrite a week, month, or season the user has already paged.
  const [weekDate, setWeekDate] = useState<Date | null>(null)
  const [monthDate, setMonthDate] = useState<Date | null>(null)
  const [seasonDate, setSeasonDate] = useState<Date | null>(null)
  const focusedDate =
    periodTab === "week"
      ? (weekDate ?? currentDate)
      : periodTab === "month"
        ? (monthDate ?? currentDate)
        : periodTab === "quarter"
          ? (seasonDate ?? currentDate)
          : currentDate
  const setFocusedDate = (date: Date) => {
    if (periodTab === "week") setWeekDate(date)
    else if (periodTab === "month") setMonthDate(date)
    else if (periodTab === "quarter") setSeasonDate(date)
    else setCurrentDate(date)
  }
  return { activeTodoTab, setActiveTodoTab, periodTab, focusedDate, setFocusedDate }
}
