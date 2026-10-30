/**
 * tracker/view-toggles.ts — Rocker descriptors for the Habits control panel.
 *
 * Same ids and labels as the desktop page built inline. Not wrapped in
 * `useCallback`. The phone page keeps its own copy.
 */
import type { HabitControlToggle } from "@/components/Home/Habits/control-bar/habit-priority-bar"
import type { HabitFrequency } from "@/lib/types"

export type HabitViewToggleFlags = {
  highlightHabitPriorities: boolean
  setHighlightHabitPriorities: (value: boolean) => void
  showStreakMarks: boolean
  setShowStreakMarks: (value: boolean) => void
  groupHabitsByKind: boolean
  setGroupHabitsByKind: (value: boolean) => void
  habitViewMode: "grid" | "heatmap"
  setHabitViewMode: (mode: "grid" | "heatmap") => void
  habitDayView: boolean
  setHabitDayView: (value: boolean) => void
  habitWeekView: boolean
  setHabitWeekView: (value: boolean) => void
  habitMonthView: boolean
  setHabitMonthView: (value: boolean) => void
  habitSeasonView: boolean
  setHabitSeasonView: (value: boolean) => void
  hideCompletedToday: boolean
  setHideCompletedToday: (value: boolean) => void
  hideCompletedAndMissed: boolean
  setHideCompletedAndMissed: (value: boolean) => void
}

export function habitViewToggles(frequency: HabitFrequency, flags: HabitViewToggleFlags): HabitControlToggle[] {
  const suffix =
    frequency === "weekly"
      ? "-weekly"
      : frequency === "monthly"
        ? "-monthly"
        : frequency === "quarterly"
          ? "-season"
          : ""
  const toggles: HabitControlToggle[] = [
    {
      id: `highlight-priorities${suffix}`,
      label: "Highlight priorities",
      checked: flags.highlightHabitPriorities,
      onCheckedChange: flags.setHighlightHabitPriorities,
    },
    {
      id: `streak-marks${suffix}`,
      label: "Streaks and multipliers",
      checked: flags.showStreakMarks,
      onCheckedChange: flags.setShowStreakMarks,
    },
  ]
  if (frequency === "daily") {
    toggles.push(
      {
        id: "group-by-kind",
        label: "Group by category",
        checked: flags.groupHabitsByKind,
        onCheckedChange: flags.setGroupHabitsByKind,
      },
      {
        id: "heatmap-view",
        label: "Heatmap View",
        checked: flags.habitViewMode === "heatmap",
        onCheckedChange: (on) => flags.setHabitViewMode(on ? "heatmap" : "grid"),
      },
      {
        id: "day-view",
        label: "Day View",
        checked: flags.habitDayView,
        onCheckedChange: flags.setHabitDayView,
      },
    )
  } else if (frequency === "weekly") {
    toggles.push({
      id: "week-view",
      label: "Week View",
      checked: flags.habitWeekView,
      onCheckedChange: flags.setHabitWeekView,
    })
  } else if (frequency === "monthly") {
    toggles.push({
      id: "month-view",
      label: "Month View",
      checked: flags.habitMonthView,
      onCheckedChange: flags.setHabitMonthView,
    })
  } else {
    toggles.push({
      id: "season-view",
      label: "Season View",
      checked: flags.habitSeasonView,
      onCheckedChange: flags.setHabitSeasonView,
    })
  }
  toggles.push(
    {
      id: `hide-done${suffix}`,
      label: "Hide Done",
      checked: flags.hideCompletedToday,
      onCheckedChange: flags.setHideCompletedToday,
    },
    {
      id: `hide-completed-and-missed${suffix}`,
      label: "Mask done and missed",
      checked: flags.hideCompletedAndMissed,
      onCheckedChange: flags.setHideCompletedAndMissed,
    },
  )
  return toggles
}
