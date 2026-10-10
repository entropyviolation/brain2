import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { TaskType, type WeeklyTask } from "@/lib/types"
import { HabitCompletionCell } from "./habit-completion-cell"

const date = new Date(2026, 9, 5)

function task(sources: WeeklyTask["completionSources"], extra: Partial<WeeklyTask> = {}): WeeklyTask {
  return {
    id: "stretch",
    name: "Stretch",
    type: TaskType.GOAL,
    goal: 10,
    frequency: "weekly",
    completionSources: sources,
    ...extra,
  }
}

function renderCell(habit: WeeklyTask, onGoalChange = vi.fn()) {
  render(
    <HabitCompletionCell
      task={habit}
      date={date}
      periodKey="2026-10-05_2026-10-11"
      periodLabel="Oct 5"
      completion={{ value: 3 }}
      weeklyData={{}}
      variant="period"
      frequency="weekly"
      exemptionNoun="week"
      onBooleanChange={vi.fn()}
      onGoalChange={onGoalChange}
      onTextChange={vi.fn()}
      onIncrementalChange={vi.fn()}
    />,
  )
  return onGoalChange
}

describe("habit source detail", () => {
  it("does not open the detail for a habit that includes By hand", async () => {
    const user = userEvent.setup()
    const onGoalChange = renderCell(task(["manual"]))
    await user.dblClick(screen.getByLabelText("Stretch Oct 5"))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(onGoalChange).not.toHaveBeenCalled()
  })

  it("opens a read-only detail for a habit without By hand and closes without writing", async () => {
    const user = userEvent.setup()
    const onGoalChange = renderCell(
      task(["coverage"], {
        coverageLink: { threshold: 75, enabled: true },
        completionPipelines: [
          {
            id: "pipe-habits",
            kind: "habitsStats",
            sources: [],
            stats: {
              set: "daily",
              points: [{ kind: "dailyCompletionAverage" }, { kind: "weekGrade" }, { kind: "perfectOutput" }],
              comparePrevious: true,
              mustBeHigher: 2,
            },
          },
        ],
      }),
    )
    await user.dblClick(screen.getByLabelText("Details for Stretch Oct 5"))
    const dialog = screen.getByRole("dialog")
    expect(dialog).toHaveTextContent("Stretch")
    expect(dialog).toHaveTextContent("Oct 5")
    expect(dialog).toHaveTextContent("Week grade")
    expect(dialog).toHaveTextContent("Perfect output")
    expect(dialog).toHaveTextContent("Daily completion average")
    expect(dialog).toHaveTextContent(/of 3/)
    await user.click(screen.getByRole("button", { name: "Close source detail" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(onGoalChange).not.toHaveBeenCalled()
  })
})
