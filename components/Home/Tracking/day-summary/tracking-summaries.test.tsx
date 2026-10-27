/**
 * components/Home/Tracking/day-summary/tracking-summaries.test.tsx
 */
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { WeekSummaryNest } from "./tracking-summaries"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"

describe("WeekSummaryNest", () => {
  beforeEach(() => resetAllStores())

  it("can show every day summary while the week summary stays open", () => {
    useTimeTrackingStore.getState().setDayNotes("2026-06-15", "Monday as it was")
    render(<WeekSummaryNest anchor={new Date(2026, 5, 17)} />)
    expect(screen.getByRole("textbox", { name: /Week summary/ })).toBeInTheDocument()
    expect(screen.queryByDisplayValue("Monday as it was")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "All day summaries" }))
    expect(screen.getAllByRole("textbox", { name: /Day summary/ })).toHaveLength(7)
    expect(screen.getByDisplayValue("Monday as it was")).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: /Week summary/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Hide day summaries" }))
    expect(screen.queryByDisplayValue("Monday as it was")).not.toBeInTheDocument()
  })
})
