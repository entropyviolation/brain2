import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { HabitFrequency } from "@/lib/types"
import { HabitSortControl, habitCompletionSortLabel } from "./habit-sort-control"

describe("HabitSortControl", () => {
  it("labels the plate Sort Habits and lists every mode as inset keys", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onDirection = vi.fn()
    render(
      <HabitSortControl
        value="default"
        direction={null}
        onChange={onChange}
        onDirection={onDirection}
        frequency="daily"
      />,
    )
    expect(screen.getByText("Sort Habits")).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Alphabetical" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Date created" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Priority" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Weekly completion %" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Ascending" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Descending" })).toBeInTheDocument()
    await user.click(screen.getByRole("radio", { name: "Priority" }))
    expect(onChange).toHaveBeenCalledWith("priority")
    await user.click(screen.getByRole("radio", { name: "Ascending" }))
    expect(onDirection).toHaveBeenCalledWith("asc")
  })

  it("names weekly completion for daily habits and period completion for the other sheets", () => {
    // Day View is the same daily sheet, so it keeps the week-percent label.
    expect(habitCompletionSortLabel("daily")).toBe("Weekly completion %")
    const daily = render(
      <HabitSortControl value="default" direction={null} onChange={vi.fn()} onDirection={vi.fn()} frequency="daily" />,
    )
    expect(screen.getByRole("radio", { name: "Weekly completion %" })).toBeInTheDocument()
    daily.unmount()

    const periodSheets = ["weekly", "monthly", "quarterly"] as const satisfies readonly HabitFrequency[]
    for (const frequency of periodSheets) {
      expect(habitCompletionSortLabel(frequency)).toBe("Period completion %")
      const view = render(
        <HabitSortControl
          value="default"
          direction={null}
          onChange={vi.fn()}
          onDirection={vi.fn()}
          frequency={frequency}
          completionLabel={frequency === "monthly" ? "Monthly completion %" : "Season completion %"}
        />,
      )
      expect(screen.getByRole("radio", { name: "Period completion %" })).toBeInTheDocument()
      expect(screen.queryByRole("radio", { name: "Monthly completion %" })).not.toBeInTheDocument()
      expect(screen.queryByRole("radio", { name: "Season completion %" })).not.toBeInTheDocument()
      view.unmount()
    }
  })
})
