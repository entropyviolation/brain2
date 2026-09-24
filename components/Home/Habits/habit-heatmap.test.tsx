import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { TaskType } from "@/lib/types"
import { formatLocalDateKey } from "@/lib/date-utils"
import { HabitHeatmap } from "./habit-heatmap"

describe("HabitHeatmap", () => {
  it("renders a named row of completion squares", () => {
    const date = new Date(2026, 8, 16)
    render(
      <HabitHeatmap
        tasks={[{ id: "stretch", name: "Stretch", type: TaskType.BOOLEAN, frequency: "daily" }]}
        data={{ [formatLocalDateKey(date)]: { stretch: { completed: true } } }}
        asOf={date}
        frequency="daily"
        onEditTask={() => {}}
      />,
    )
    expect(screen.getByRole("button", { name: /Stretch/ })).toBeInTheDocument()
    const heat = screen.getByLabelText("Habit heatmap")
    expect(heat).toBeInTheDocument()
    expect(heat.className).toContain("habit-heat")
    expect(heat.querySelector(".habit-heat-cell")).toBeTruthy()
    expect(heat.querySelector(".habit-heat-cell.is-full")).toBeTruthy()
    const grid = heat.querySelector(".habit-heat-grid") as HTMLElement
    expect(grid.style.gridTemplateColumns).toMatch(/10rem/)
    expect(grid.style.gridTemplateColumns).toMatch(/20px/)
  })
})
