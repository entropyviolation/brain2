/**
 * Habits period cursor — first paint ignores storage; restore after mount.
 */
import { act, render, screen } from "@testing-library/react"
import { hydrateRoot, type Root } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { useLayoutEffect, useState } from "react"
import { beforeEach, describe, expect, it } from "vitest"
import { APP_NAV_KEYS, readStoredDate, writeStoredDate } from "@/lib/app-navigation"
import { formatDateRange } from "@/lib/date-utils"
import { pinHomeCursor } from "@/lib/use-current-date"
import { resetLocalStorage } from "@/tests/test-utils"
import {
  habitsLensFromStored,
  habitsViewedWeekStart,
  retainHabitsCursorDate,
} from "./habits-period-cursor"
import { WeekNavigation } from "./week-navigation"

/** Minimal stand-in for the tracker’s week cursor (same init + layout restore rule). */
function HabitsWeekCursorProbe({ asOf }: { asOf: Date }) {
  const [weekLens, setWeekLens] = useState<Date | null>(null)
  useLayoutEffect(() => {
    setWeekLens(habitsLensFromStored(asOf, readStoredDate(APP_NAV_KEYS.homeHabitsWeek), "week"))
  }, [asOf])
  const weekStart = weekLens ?? habitsViewedWeekStart(asOf)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const isCurrent = habitsViewedWeekStart(asOf).getTime() === weekStart.getTime()
  return (
    <WeekNavigation
      currentWeekStart={weekStart}
      weekEndDate={weekEnd}
      isCurrentPeriod={isCurrent}
      onPreviousWeek={() => {}}
      onNextWeek={() => {}}
      onCurrentWeek={() => setWeekLens(null)}
    />
  )
}

describe("Habits week cursor hydration", () => {
  const asOf = new Date(2026, 8, 27) // Sunday — current week Mon Sep 21
  const priorWeek = new Date(2026, 8, 14)

  beforeEach(() => {
    resetLocalStorage()
    pinHomeCursor(asOf, false)
  })

  it("SSR HTML uses the Home-day week even when a prior week is stored", () => {
    writeStoredDate(APP_NAV_KEYS.homeHabitsWeek, priorWeek)
    const html = renderToString(<HabitsWeekCursorProbe asOf={asOf} />)
    expect(html).toContain("Sep 21 - Sep 27, 2026")
    expect(html).not.toContain("Sep 14 - Sep 20, 2026")
    expect(html).toContain('aria-pressed="true"')
  })

  it("hydrates without mismatch, then restores the persisted prior week lens", async () => {
    writeStoredDate(APP_NAV_KEYS.homeHabitsWeek, priorWeek)
    const html = renderToString(<HabitsWeekCursorProbe asOf={asOf} />)
    const container = document.createElement("div")
    container.innerHTML = html
    document.body.appendChild(container)

    let root: Root
    await act(async () => {
      root = hydrateRoot(container, <HabitsWeekCursorProbe asOf={asOf} />)
    })

    // After layout restore: prior week lens, Today not pressed
    expect(screen.getByText("Sep 14 - Sep 20, 2026")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Today/ })).toHaveAttribute("aria-pressed", "false")

    await act(async () => {
      root!.unmount()
    })
    container.remove()
  })

  it("keeps Home-day week when nothing is stored", () => {
    render(<HabitsWeekCursorProbe asOf={asOf} />)
    expect(screen.getByText(formatDateRange(habitsViewedWeekStart(asOf), new Date(2026, 8, 27)))).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Today/ })).toHaveAttribute("aria-pressed", "true")
  })

  it("does not keep a stored lens when it is the same week as Home day", () => {
    writeStoredDate(APP_NAV_KEYS.homeHabitsWeek, habitsViewedWeekStart(asOf))
    const lens = habitsLensFromStored(asOf, readStoredDate(APP_NAV_KEYS.homeHabitsWeek), "week")
    expect(lens).toBeNull()
    expect(retainHabitsCursorDate(asOf, asOf)).toBe(asOf)
  })
})
