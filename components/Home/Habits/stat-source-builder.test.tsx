import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { defaultSimpleBinding, StatSourceBuilder, type StatHabitOption } from "./stat-source-builder"
import type { HabitStatBinding } from "@/lib/habit-stat-pipeline"

const habits: StatHabitOption[] = [
  { id: "pages", name: "Pages" },
  { id: "stretch", name: "Stretch" },
]

describe("StatSourceBuilder", () => {
  it("renders one module as source, then period, then output", () => {
    const binding = defaultSimpleBinding()
    render(<StatSourceBuilder binding={binding} onChange={vi.fn()} habitsForSource={() => habits} />)
    expect(screen.getByLabelText("Pipeline name")).toHaveValue("Week grade")
    expect(screen.getByLabelText("Output variable")).toHaveValue("weekGrade")
    expect(screen.getByRole("button", { name: "Source" })).toHaveTextContent("Daily habits")
    expect(screen.getByRole("button", { name: "Period" })).toHaveTextContent("This week")
    expect(screen.getByRole("button", { name: "Output" })).toHaveTextContent("Week grade")
    expect(screen.getByLabelText("Live output")).toHaveTextContent("—")
    expect(screen.queryByLabelText("Statement")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Habit")).not.toBeInTheDocument()
  })

  it("reveals habit fields only for specific habit", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(
      <StatSourceBuilder binding={defaultSimpleBinding()} onChange={onChange} habitsForSource={() => habits} />,
    )
    await user.click(screen.getByRole("button", { name: "Output" }))
    await user.click(screen.getByRole("option", { name: "Specific habit" }))
    const next = onChange.mock.calls.at(-1)?.[0] as HabitStatBinding
    expect(next.pipelines[0].outputId).toBe("specificHabit")
    rerender(<StatSourceBuilder binding={next} onChange={onChange} habitsForSource={() => habits} />)
    expect(screen.getByRole("button", { name: "Habit" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Habit value" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Output" }))
    await user.click(screen.getByRole("option", { name: "Week grade" }))
    const back = onChange.mock.calls.at(-1)?.[0] as HabitStatBinding
    rerender(<StatSourceBuilder binding={back} onChange={onChange} habitsForSource={() => habits} />)
    expect(screen.queryByRole("button", { name: "Habit" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Habit value" })).not.toBeInTheDocument()
  })

  it("duplicates a module under the original with the same source, period, and output", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<StatSourceBuilder binding={defaultSimpleBinding()} onChange={onChange} habitsForSource={() => habits} />)
    await user.click(screen.getByRole("button", { name: "Duplicate" }))
    const next = onChange.mock.calls.at(-1)?.[0] as HabitStatBinding
    expect(next.mode).toBe("statement")
    expect(next.pipelines).toHaveLength(2)
    expect(next.pipelines[1]).toEqual(
      expect.objectContaining({
        sourceId: "daily",
        periodId: "thisWeek",
        outputId: "weekGrade",
      }),
    )
    expect(next.pipelines[1].id).not.toBe(next.pipelines[0].id)
    expect(next.pipelines[1].outputName).not.toBe(next.pipelines[0].outputName)
    expect(screen.queryByLabelText("Statement")).not.toBeInTheDocument()
  })

  it("offers raw or curved only for week grade and perfect output", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(
      <StatSourceBuilder binding={defaultSimpleBinding()} onChange={onChange} habitsForSource={() => habits} />,
    )
    expect(screen.getByRole("button", { name: "Raw or curved" })).toHaveTextContent("Curved")
    await user.click(screen.getByRole("button", { name: "Raw or curved" }))
    await user.click(screen.getByRole("option", { name: "Raw" }))
    const raw = onChange.mock.calls.at(-1)?.[0] as HabitStatBinding
    expect(raw.pipelines[0].scale).toBe("raw")
    rerender(<StatSourceBuilder binding={raw} onChange={onChange} habitsForSource={() => habits} />)

    await user.click(screen.getByRole("button", { name: "Output" }))
    await user.click(screen.getByRole("option", { name: "Good days" }))
    const days = onChange.mock.calls.at(-1)?.[0] as HabitStatBinding
    rerender(<StatSourceBuilder binding={days} onChange={onChange} habitsForSource={() => habits} />)
    expect(screen.queryByRole("button", { name: "Raw or curved" })).not.toBeInTheDocument()
    expect(days.pipelines[0].scale).toBeUndefined()
  })

  it("names a pages habit’s logged amount Page total and keeps week percent", async () => {
    const user = userEvent.setup()
    const pages: StatHabitOption[] = [
      { id: "read", name: "Read at least 5 pages per day", unit: "pages", type: "GOAL" },
      { id: "water", name: "Water", type: "BOOLEAN" },
      { id: "sit", name: "Sit", unit: "minutes", type: "GOAL" },
    ]
    const binding: HabitStatBinding = {
      mode: "simple",
      pipelineId: "pages",
      pipelines: [
        {
          id: "pages",
          name: "Weekly pages",
          outputName: "weeklyPages",
          sourceId: "daily",
          periodId: "thisWeek",
          outputId: "specificHabit",
          habitId: "read",
          valueId: "loggedAmount",
        },
      ],
    }
    const { rerender } = render(
      <StatSourceBuilder binding={binding} onChange={vi.fn()} habitsForSource={() => pages} />,
    )
    expect(screen.getByRole("button", { name: "Habit value" })).toHaveTextContent("Page total")
    expect(screen.queryByRole("button", { name: "Raw or curved" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Habit value" }))
    expect(screen.getByRole("option", { name: "Week percent" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Page total" })).toBeInTheDocument()
    await user.keyboard("{Escape}")

    rerender(
      <StatSourceBuilder
        binding={{ ...binding, pipelines: [{ ...binding.pipelines[0], habitId: "water", valueId: "weekPercent" }] }}
        onChange={vi.fn()}
        habitsForSource={() => pages}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Habit value" }))
    expect(screen.getByRole("option", { name: "Week percent" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "Page total" })).not.toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "Logged amount" })).not.toBeInTheDocument()

    rerender(
      <StatSourceBuilder
        binding={{ ...binding, pipelines: [{ ...binding.pipelines[0], habitId: "sit", valueId: "loggedAmount" }] }}
        onChange={vi.fn()}
        habitsForSource={() => pages}
      />,
    )
    expect(screen.getByRole("button", { name: "Habit value" })).toHaveTextContent("Minute total")
  })
})
