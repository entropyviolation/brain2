import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { COMPLETION_SOURCE_HINTS } from "@/lib/habit-completion-trust"
import { GEM_PATHS } from "@/lib/gems-manifest"
import { defaultHabitGem } from "@/lib/habit-gems"
import { useHabitsStore } from "@/lib/habits-store"
import { TaskType } from "@/lib/types"
import { TaskForm } from "./daily-task-form"

describe("TaskForm", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders the habit form fields", () => {
    render(<TaskForm onSubmit={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByLabelText("Habit Name")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add Habit" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add Habit" })).toBeDisabled()
  })

  it("keeps the submit label readable as a default Win95 button", () => {
    render(<TaskForm onSubmit={vi.fn()} onCancel={vi.fn()} />)
    const submit = screen.getByRole("button", { name: "Add Habit" })
    expect(submit).toHaveClass("habit95-btn", "habit95-btn-default")
    expect(submit.className).not.toMatch(/gradient-primary|text-primary-foreground/)
  })

  it("submits a new habit when name is provided", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<TaskForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await user.type(screen.getByLabelText("Habit Name"), "Stretch daily")
    await user.click(screen.getByRole("button", { name: "Add Habit" }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: "Stretch daily" }))
  })

  it("persists a random catalog gem on create without a user pick", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.01)
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<TaskForm onSubmit={onSubmit} onCancel={vi.fn()} />)
    await user.type(screen.getByLabelText("Habit Name"), "Language A")
    await user.click(screen.getByRole("button", { name: "Add Habit" }))
    const submitted = onSubmit.mock.calls[0][0]
    expect(GEM_PATHS).toContain(submitted.gem)
    expect(submitted.gem).not.toBe(defaultHabitGem("boolean"))
    expect(submitted.gem).toBe(GEM_PATHS[Math.floor(0.01 * GEM_PATHS.length)])
  })

  it("keeps the assigned gem when the habit type changes", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<TaskForm onSubmit={onSubmit} onCancel={vi.fn()} />)
    await user.type(screen.getByLabelText("Habit Name"), "Language B")
    const before = document.querySelector(".hab-gem-slot-swatch")?.getAttribute("src")
    await user.click(screen.getByRole("radio", { name: /Goal/ }))
    expect(document.querySelector(".hab-gem-slot-swatch")?.getAttribute("src")).toBe(before)
    await user.type(screen.getByLabelText("Amount"), "10")
    await user.click(screen.getByRole("button", { name: "Add Habit" }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: "Language B", gem: before, type: TaskType.GOAL }))
  })

  it("can pin a habit as prioritized", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<TaskForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await user.type(screen.getByLabelText("Habit Name"), "Water")
    await user.click(screen.getByLabelText("Prioritize this habit"))
    await user.click(screen.getByRole("button", { name: "Add Habit" }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: "Water", priorityPinned: true }))
  })

  it("reveals a numeric target when Goal type is selected", async () => {
    const user = userEvent.setup()
    render(<TaskForm onSubmit={vi.fn()} onCancel={vi.fn()} />)

    await user.click(screen.getByRole("radio", { name: /Goal/ }))
    expect(screen.getByLabelText("Amount")).toBeInTheDocument()
    expect(screen.getByLabelText("Unit (optional)")).toBeInTheDocument()
  })

  it("reveals climb cadence fields when Climb type is selected", async () => {
    const user = userEvent.setup()
    render(<TaskForm onSubmit={vi.fn()} onCancel={vi.fn()} />)

    await user.click(screen.getByRole("radio", { name: /Climb/ }))
    expect(screen.getByRole("radio", { name: /Weekly \+/ })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: /Daily \+/ })).toBeInTheDocument()
    expect(screen.getByLabelText("Starting value")).toBeInTheDocument()
    expect(screen.getByLabelText("Weekly increment")).toBeInTheDocument()
  })

  it("submits a weekly climb habit", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<TaskForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await user.type(screen.getByLabelText("Habit Name"), "Meditate")
    await user.click(screen.getByRole("radio", { name: /Climb/ }))
    await user.click(screen.getByRole("button", { name: "Add Habit" }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Meditate",
        incrementalData: expect.objectContaining({ cadence: "weekly", startValue: 2, increment: 1 }),
      }),
    )
  })

  it("persists a catalog gem on submit", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<TaskForm onSubmit={onSubmit} onCancel={vi.fn()} />)
    await user.type(screen.getByLabelText("Habit Name"), "Jewel walk")
    await user.click(screen.getAllByRole("button", { name: /Change gem/i })[0])
    const option = screen.getAllByRole("option")[0]
    const src = option.querySelector("img")?.getAttribute("src")
    await user.click(option)
    await user.click(screen.getByRole("button", { name: "Add Habit" }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: "Jewel walk", gem: src }))
  })

  it("offers delete only while editing", async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    vi.spyOn(window, "confirm").mockReturnValue(true)
    const { rerender } = render(<TaskForm onSubmit={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.queryByRole("button", { name: "Delete habit" })).not.toBeInTheDocument()
    rerender(
      <TaskForm
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        onDelete={onDelete}
        initialTask={{ id: "h1", name: "Stretch", type: TaskType.BOOLEAN, rewardValue: 10 }}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Delete habit" }))
    expect(onDelete).toHaveBeenCalledWith("h1")
  })

  it("shows tracking auto-fill only while Tracking tags is checked", async () => {
    const user = userEvent.setup()
    render(<TaskForm onSubmit={vi.fn()} onCancel={vi.fn()} defaultFrequency="weekly" />)

    await user.click(screen.getByRole("radio", { name: /Goal/ }))
    expect(screen.queryByText("Auto-fill from Tracking")).not.toBeInTheDocument()
    expect(screen.getByText("Text keywords (phone)")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Completion sources" }))
    await user.click(screen.getByRole("checkbox", { name: /^Tracking tags/ }))
    expect(screen.getByText("Auto-fill from Tracking")).toBeInTheDocument()
    expect(screen.getByText(/counts toward this habit that week/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Create tag" })).toBeInTheDocument()

    await user.click(screen.getByRole("checkbox", { name: /^Tracking tags/ }))
    expect(screen.queryByText("Auto-fill from Tracking")).not.toBeInTheDocument()
    expect(screen.getByText("Text keywords (phone)")).toBeInTheDocument()
  })

  it("keeps saved tracking tags when that section is hidden and shown again", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <TaskForm
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        initialTask={{
          id: "dishes",
          name: "Dishes",
          type: TaskType.BOOLEAN,
          rewardValue: 10,
          frequency: "daily",
          trackingLink: { tagIds: ["tag-dishes"], enabled: true },
          completionSources: ["manual", "tags"],
        }}
      />,
    )
    expect(screen.getByText("Auto-fill from Tracking")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Completion sources" }))
    await user.click(screen.getByRole("checkbox", { name: /^Tracking tags/ }))
    expect(screen.queryByText("Auto-fill from Tracking")).not.toBeInTheDocument()
    await user.click(screen.getByRole("checkbox", { name: /^Tracking tags/ }))
    expect(screen.getByText("Auto-fill from Tracking")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Update Habit" }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        trackingLink: expect.objectContaining({ tagIds: ["tag-dishes"] }),
      }),
    )
  })

  it("clears the time estimate when N/A is checked and restores the field when it is not", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <TaskForm
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        initialTask={{
          id: "water",
          name: "Drink water",
          type: TaskType.BOOLEAN,
          rewardValue: 10,
          timeEstimate: { minutes: 20 },
        }}
      />,
    )
    expect(screen.getByLabelText("Minutes per completion")).toHaveValue(20)
    await user.click(screen.getByRole("checkbox", { name: "N/A" }))
    expect(screen.queryByLabelText("Minutes per completion")).not.toBeInTheDocument()
    await user.click(screen.getByRole("checkbox", { name: "N/A" }))
    expect(screen.getByLabelText("Minutes per completion")).toHaveValue(20)
    await user.click(screen.getByRole("checkbox", { name: "N/A" }))
    await user.click(screen.getByRole("button", { name: "Update Habit" }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ timeEstimate: undefined, timeEstimateNA: true }),
    )
  })

  it("keeps done-task wording collapsed until it is opened", () => {
    render(
      <TaskForm
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        initialTask={{ id: "water", name: "Drink water", type: TaskType.BOOLEAN, rewardValue: 10 }}
      />,
    )
    const details = screen.getByText("Done task wording").closest("details")
    expect(details).not.toBeNull()
    expect(details).not.toHaveAttribute("open")
    expect(screen.queryByLabelText("Phrase")).not.toBeVisible()
  })

  it("round-trips completion points and coverage threshold through submit", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <TaskForm
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        initialTask={{
          id: "cov",
          name: "Log 75% of the week",
          type: TaskType.GOAL,
          goal: 75,
          unit: "%",
          rewardValue: 35,
          frequency: "weekly",
          coverageLink: { threshold: 75, enabled: true },
        }}
      />,
    )
    expect(screen.getByLabelText("Completion points")).toHaveValue(35)
    expect(screen.getByLabelText("Bonus formula")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Completion sources" })).toHaveTextContent("Activity occupancy")
    const threshold = screen.getByLabelText("Coverage threshold percent")
    fireEvent.change(threshold, { target: { value: "80" } })
    fireEvent.change(screen.getByLabelText("Completion points"), { target: { value: "40" } })
    await user.click(screen.getByRole("button", { name: "Update Habit" }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        rewardValue: 40,
        goal: 80,
        coverageLink: expect.objectContaining({ threshold: 80, enabled: true }),
      }),
    )
  })

  it("keeps coverageLink in sync when Amount is edited", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <TaskForm
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        initialTask={{
          id: "cov2",
          name: "Log 75% of the day",
          type: TaskType.GOAL,
          goal: 75,
          unit: "%",
          rewardValue: 25,
          frequency: "daily",
          coverageLink: { threshold: 75, enabled: true },
        }}
      />,
    )
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "50" } })
    expect(screen.getByLabelText("Coverage threshold percent")).toHaveValue(50)
    await user.click(screen.getByRole("button", { name: "Update Habit" }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        goal: 50,
        coverageLink: expect.objectContaining({ threshold: 50, enabled: true }),
      }),
    )
  })

  it("puts the first-ranked daily habit total on the first checked source row", async () => {
    const user = userEvent.setup()
    render(
      <TaskForm
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        initialTask={{
          id: "week-pages",
          name: "Pages this week",
          type: TaskType.GOAL,
          goal: 20,
          rewardValue: 10,
          frequency: "weekly",
          completionSources: ["habitValue", "manual", "keywords"],
        }}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Completion sources" }))
    const checkedRows = () =>
      [...document.querySelectorAll(".habit95-source-row")].filter((row) => row.querySelector("input:checked"))
    expect(checkedRows()[0]).toHaveTextContent(/Daily habit total\s*1/)
    await user.click(screen.getByRole("button", { name: "Trust Daily habit total less" }))
    expect(checkedRows()[0]).toHaveTextContent(/By hand\s*1/)
    expect(checkedRows()[1]).toHaveTextContent(/Daily habit total\s*2/)
  })

  it("filters the daily habit picker by typed text", async () => {
    const previous = useHabitsStore.getState().tasks
    useHabitsStore.getState().setTasks([
      {
        id: "read",
        name: "Read at least 5 pages per day",
        type: TaskType.BOOLEAN,
        rewardValue: 10,
        frequency: "daily",
      },
      { id: "water", name: "Drink water", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "daily" },
      { id: "journal", name: "Read my journal", type: TaskType.TEXT, rewardValue: 10, frequency: "daily" },
      {
        id: "week-pages",
        name: "Pages this week",
        type: TaskType.GOAL,
        goal: 20,
        rewardValue: 10,
        frequency: "weekly",
        completionSources: ["habitValue"],
      },
    ])
    try {
      const user = userEvent.setup()
      render(
        <TaskForm
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
          initialTask={{
            id: "week-pages",
            name: "Pages this week",
            type: TaskType.GOAL,
            goal: 20,
            rewardValue: 10,
            frequency: "weekly",
            completionSources: ["habitValue"],
          }}
        />,
      )
      await user.click(screen.getByRole("button", { name: "Daily habit to add up" }))
      await user.type(screen.getByLabelText("Search daily habits"), "read")
      expect(screen.getByRole("option", { name: "Read at least 5 pages per day" })).toBeInTheDocument()
      expect(screen.queryByRole("option", { name: "Drink water" })).not.toBeInTheDocument()
      expect(screen.queryByRole("option", { name: "Read my journal" })).not.toBeInTheDocument()
    } finally {
      useHabitsStore.getState().setTasks(previous)
    }
  })

  it("shows the tagged-task field only while that source is checked", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <TaskForm
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        initialTask={{
          id: "cook-week",
          name: "Cook",
          type: TaskType.GOAL,
          goal: 2,
          unit: "times",
          rewardValue: 10,
          frequency: "weekly",
          completionSources: ["manual"],
        }}
      />,
    )
    expect(screen.queryByLabelText("Tagged task tag")).not.toBeInTheDocument()
    expect(screen.queryByText("Auto-fill from Tracking")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Completion sources" }))
    await user.click(screen.getByRole("checkbox", { name: /^Tagged tasks/ }))
    expect(
      screen.getByText(
        "Done tasks and tracked activities with this tag each count as 1. The goal is how many complete the period.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Tagged task tag")).toBeInTheDocument()
    expect(screen.queryByText("Auto-fill from Tracking")).not.toBeInTheDocument()

    await user.click(screen.getByRole("checkbox", { name: /^Tagged tasks/ }))
    expect(screen.queryByLabelText("Tagged task tag")).not.toBeInTheDocument()
    await user.click(screen.getByRole("checkbox", { name: /^Tagged tasks/ }))

    await user.type(screen.getByLabelText("Tagged task tag"), "cooking")
    await user.click(screen.getByRole("button", { name: "Update Habit" }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        taggedTaskTag: "cooking",
        completionSources: ["manual", "taggedTasks"],
      }),
    )
  })

  it("shows the daily completion average hint and saves that source with no tag", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <TaskForm
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        initialTask={{
          id: "perfect-week",
          name: "50% Perfect output for daily tasks",
          type: TaskType.GOAL,
          goal: 50,
          unit: "%",
          rewardValue: 10,
          frequency: "weekly",
          completionSources: ["manual"],
        }}
      />,
    )
    expect(screen.queryByText(COMPLETION_SOURCE_HINTS.dailyCompletionAverage)).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Completion sources" }))
    await user.click(screen.getByRole("checkbox", { name: /^Daily completion average/ }))
    expect(screen.getAllByText(COMPLETION_SOURCE_HINTS.dailyCompletionAverage).length).toBeGreaterThan(0)
    expect(screen.queryByLabelText("Tagged task tag")).not.toBeInTheDocument()
    expect(screen.queryByText("Auto-fill from Tracking")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Update Habit" }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        completionSources: ["manual", "dailyCompletionAverage"],
        taggedTaskTag: undefined,
      }),
    )
  })
})
