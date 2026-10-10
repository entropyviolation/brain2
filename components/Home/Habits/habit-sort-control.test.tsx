import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { HabitFrequency } from "@/lib/types"
import { HabitSortControl, habitCompletionSortLabel, habitSortDirectionLabels } from "./habit-sort-control"

describe("HabitSortControl", () => {
  it("is a milled select of every mode plus one direction key", async () => {
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
    const face = screen.getByRole("button", { name: "Sort" })
    expect(face).toHaveClass("habit95-select")
    expect(face.tagName).not.toBe("SELECT")
    expect(face).toHaveTextContent("Default")
    await user.click(face)
    expect(screen.getByRole("option", { name: "Alphabetical" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Date created" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Priority" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Weekly completion %" })).toBeInTheDocument()
    await user.click(screen.getByRole("option", { name: "Priority" }))
    expect(onChange).toHaveBeenCalledWith("priority")
    await user.click(screen.getByRole("button", { name: "Sort ascending" }))
    expect(onDirection).toHaveBeenCalledWith("desc")
  })

  it("marks the active asc or desc direction", async () => {
    const user = userEvent.setup()
    const onDirection = vi.fn()
    expect(habitSortDirectionLabels("weeklyCompletion")).toEqual({ asc: "Low first", desc: "High first" })
    expect(habitSortDirectionLabels("priority")).toEqual({ asc: "Low first", desc: "High first" })
    expect(habitSortDirectionLabels("alphabetical")).toEqual({ asc: "A → Z", desc: "Z → A" })
    expect(habitSortDirectionLabels("created")).toEqual({ asc: "Oldest first", desc: "Newest first" })
    expect(habitSortDirectionLabels("default")).toEqual({ asc: "As stored", desc: "Reversed" })

    const view = render(
      <HabitSortControl
        value="weeklyCompletion"
        direction={null}
        onChange={vi.fn()}
        onDirection={onDirection}
        frequency="weekly"
      />,
    )
    expect(screen.getByRole("button", { name: "Sort descending" })).toHaveTextContent("↓")
    await user.click(screen.getByRole("button", { name: "Sort descending" }))
    expect(onDirection).toHaveBeenCalledWith("asc")
    view.rerender(
      <HabitSortControl
        value="alphabetical"
        direction="asc"
        onChange={vi.fn()}
        onDirection={onDirection}
        frequency="weekly"
      />,
    )
    expect(screen.getByRole("button", { name: "Sort ascending" })).toHaveTextContent("↑")
    view.rerender(
      <HabitSortControl
        value="default"
        direction="desc"
        onChange={vi.fn()}
        onDirection={onDirection}
        frequency="daily"
      />,
    )
    expect(screen.getByRole("button", { name: "Sort descending" })).toHaveAttribute("title", "Reversed")
  })

  it("names weekly completion for daily habits and period completion for the other sheets", async () => {
    const user = userEvent.setup()
    expect(habitCompletionSortLabel("daily")).toBe("Weekly completion %")
    const daily = render(
      <HabitSortControl value="default" direction={null} onChange={vi.fn()} onDirection={vi.fn()} frequency="daily" />,
    )
    await user.click(screen.getByRole("button", { name: "Sort" }))
    expect(screen.getByRole("option", { name: "Weekly completion %" })).toBeInTheDocument()
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
      await user.click(screen.getByRole("button", { name: "Sort" }))
      expect(screen.getByRole("option", { name: "Period completion %" })).toBeInTheDocument()
      expect(screen.queryByRole("option", { name: "Monthly completion %" })).not.toBeInTheDocument()
      expect(screen.queryByRole("option", { name: "Season completion %" })).not.toBeInTheDocument()
      view.unmount()
    }
  })
})
