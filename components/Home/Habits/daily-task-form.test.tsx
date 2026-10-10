import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { GEM_PATHS } from "@/lib/gems-manifest"
import { defaultHabitGem } from "@/lib/habit-gems"
import { useHabitsStore } from "@/lib/habits-store"
import { localDayKey, useReviewsStore } from "@/lib/reviews-store"
import { useTaskStore } from "@/lib/task-store"
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

  it("a second press logs Priority refreshed", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<TaskForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await user.type(screen.getByLabelText("Habit Name"), "Water")
    await user.click(screen.getByRole("button", { name: "Prioritize habit" }))
    await user.click(screen.getByRole("button", { name: "Prioritize habit" }))
    expect(screen.getByText(/Priority refreshed/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Add Habit" }))

    const log = onSubmit.mock.calls[0][0].priorityLog as string[]
    expect(log[0]).toMatch(/^Priority set /)
    expect(log[1]).toMatch(/^Priority refreshed /)
    expect(log).toHaveLength(2)
  })

  it("a ritual toggle logs Selected from day ritual", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <TaskForm
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        initialTask={{ id: "water", name: "Drink water", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "daily" }}
      />,
    )
    await user.click(screen.getByLabelText("Morning ritual"))
    expect(screen.getByText(/Selected from day ritual/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Update Habit" }))
    const log = onSubmit.mock.calls[0][0].priorityLog as string[]
    expect(log.some((line) => line.includes("Selected from day ritual"))).toBe(true)
    expect(useReviewsStore.getState().getMorningReview(localDayKey(new Date()))?.priorityHabitIds).toEqual(["water"])
  })

  it("shows the morning ritual mark and its multiplier when the habit is in today's review", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const day = localDayKey(new Date())
    useReviewsStore.getState().saveMorningReview(day, { priorityHabitIds: ["water"] })
    useHabitsStore.setState({ morningRitualPointMultiplier: 5 })
    render(
      <TaskForm
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        initialTask={{ id: "water", name: "Drink water", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "daily" }}
      />,
    )
    expect(screen.getByText("MORNING RITUAL")).toBeInTheDocument()
    expect(screen.getByText("×5")).toBeInTheDocument()
    expect(screen.getByLabelText("Morning ritual")).toBeChecked()
    await user.click(screen.getByLabelText("Morning ritual"))
    await user.click(screen.getByRole("button", { name: "Update Habit" }))
    expect(useReviewsStore.getState().getMorningReview(day)?.priorityHabitIds).toEqual([])
  })

  it("stores ignore-neglect so the habit is not auto-prioritized", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <TaskForm
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        initialTask={{ id: "stretch", name: "Stretch", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "daily" }}
      />,
    )
    const line = screen.getByText(/^neglected for past \d+ days$/)
    expect(document.querySelector(".habit95-fields")?.firstElementChild).toBe(line)
    await user.click(screen.getByLabelText("Ignore neglect"))
    expect(screen.queryByText(/^neglected for past \d+ days$/)).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Update Habit" }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ priorityMuted: true }))
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

    await user.click(screen.getByRole("button", { name: "Add source" }))
    await user.click(screen.getByRole("button", { name: "Tracking tags" }))
    expect(screen.getByText("Auto-fill from Tracking")).toBeInTheDocument()
    expect(screen.getByText(/counts toward this habit that week/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Create tag" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Remove Tracking tags" }))
    expect(screen.queryByText("Auto-fill from Tracking")).not.toBeInTheDocument()
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
    await user.click(screen.getByRole("button", { name: "Remove Tracking tags" }))
    expect(screen.queryByText("Auto-fill from Tracking")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Add source" }))
    await user.click(screen.getByRole("button", { name: "Tracking tags" }))
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
    expect(screen.getByRole("checkbox", { name: "Activity occupancy" })).toBeChecked()
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
    const rows = () => [...document.querySelectorAll(".habit95-pipeline-row")]
    expect(rows()[0]).toHaveAttribute("data-kind", "habitsStats")
    expect(rows()[0]).toHaveTextContent("1")
    await user.click(screen.getByRole("button", { name: "Move Habits stats down" }))
    expect(rows()[0]).toHaveAttribute("data-kind", "manual")
    expect(rows()[1]).toHaveAttribute("data-kind", "habitsStats")
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

    await user.click(screen.getByRole("button", { name: "Add source" }))
    await user.click(screen.getByRole("button", { name: "Tags", exact: true }))
    expect(screen.getByLabelText("Tagged task tag")).toBeInTheDocument()
    expect(screen.queryByText("Auto-fill from Tracking")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Remove Tags", exact: true }))
    expect(screen.queryByLabelText("Tagged task tag")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Add source" }))
    await user.click(screen.getByRole("button", { name: "Tags", exact: true }))

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
    expect(screen.queryByText(/uncurved mean of each active daily habit/)).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Add source" }))
    await user.click(screen.getByRole("button", { name: "Habits stats" }))
    await user.click(screen.getByRole("button", { name: "Output" }))
    await user.click(screen.getByRole("option", { name: "Daily completion average" }))
    expect(screen.getAllByText(/uncurved mean of each active daily habit/).length).toBeGreaterThan(0)
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

  it("adds a source row and keeps the texts list binding with grace", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const previousLists = useTaskStore.getState().lists
    const previousTasks = useTaskStore.getState().tasks
    useTaskStore.getState().addList({
      id: "1791346611510",
      name: "texts I need to send",
      color: "#224466",
      createdAt: new Date("2026-10-01T12:00:00"),
    })
    useTaskStore.getState().addTask({
      id: "text-ada",
      title: "ada",
      description: "ada",
      type: "item",
      stage: "list",
      lists: ["1791346611510"],
      createdAt: new Date("2026-10-01T12:00:00"),
      completed: false,
      tags: [],
      links: [],
    })
    try {
      render(
        <TaskForm
          onSubmit={onSubmit}
          onCancel={vi.fn()}
          initialTask={{
            id: "task-1790202730072",
            name: "respond to all missing texts",
            type: TaskType.GOAL,
            goal: 100,
            rewardValue: 10,
            frequency: "weekly",
            completionSources: ["manual", "listSent"],
            listSentLink: { listId: "1791346611510", grace: 100 },
          }}
        />,
      )
      expect(screen.getByLabelText("Grace")).toHaveValue(100)
      expect(screen.getByText(/Grace 100 leaves the raw percent/)).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "What is counted" })).toHaveTextContent("Sent")
      expect(screen.getByRole("button", { name: "What the target is" })).toHaveTextContent("This period's set")
      expect(screen.queryByRole("combobox", { name: "List mode" })).not.toBeInTheDocument()
      expect(screen.getByTestId("list-pipeline-preview")).toHaveTextContent(/0 of 1/)
      expect(screen.getByTestId("list-pipeline-preview")).toHaveTextContent("ada")
      expect(screen.getByRole("button", { name: "Open list" })).toBeInTheDocument()
      const before = document.querySelectorAll(".habit95-pipeline-row").length

      await user.click(screen.getByRole("button", { name: "Add source" }))
      await user.click(screen.getByRole("button", { name: "BIM Keywords" }))
      expect(document.querySelectorAll(".habit95-pipeline-row").length).toBe(before + 1)
      expect(screen.getByText("BIM Keywords")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "How the count is used" })).toHaveTextContent("True if received")

      await user.click(screen.getByRole("button", { name: "Update Habit" }))
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          listSentLink: expect.objectContaining({ listId: "1791346611510", grace: 100 }),
          completionSources: expect.arrayContaining(["listSent", "keywords"]),
        }),
      )
    } finally {
      useTaskStore.setState({ lists: previousLists, tasks: previousTasks })
    }
  })

  it("edits the three BIM keyword modes and a logged phrase on the source row", async () => {
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
          frequency: "daily",
          completionSources: ["manual", "keywords"],
          completionPipelines: [
            { id: "pipe-manual", kind: "manual", sources: ["manual"] },
            { id: "pipe-keywords", kind: "keywords", name: "drank water", sources: ["keywords"] },
          ],
          textTriggers: [{ id: "ht-water", keyword: "drank water", mode: "done" }],
        }}
      />,
    )
    const mode = screen.getByRole("button", { name: "How the count is used" })
    expect(mode).toHaveTextContent("True if received")
    await user.click(mode)
    expect(screen.getByRole("option", { name: "True if received" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "True after a set number" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Logged phrase" })).toBeInTheDocument()
    await user.click(screen.getByRole("option", { name: "Logged phrase" }))
    const pattern = screen.getByLabelText("Logged phrase pattern")
    fireEvent.change(pattern, { target: { value: "read {n} pages of {bookname}" } })
    await user.click(screen.getByRole("button", { name: "Update Habit" }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        textTriggers: [expect.objectContaining({ keyword: "drank water" })],
        completionPipelines: expect.arrayContaining([
          expect.objectContaining({
            kind: "keywords",
            name: "drank water",
            keyword: expect.objectContaining({ use: "logged", pattern: "read {n} pages of {bookname}" }),
          }),
        ]),
      }),
    )
  })

  it("submits a new list source with its list and grace", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const previousLists = useTaskStore.getState().lists
    useTaskStore.getState().addList({
      id: "list-pages",
      name: "pages to read",
      color: "#224466",
      createdAt: new Date("2026-10-01T12:00:00"),
    })
    try {
      render(
        <TaskForm
          onSubmit={onSubmit}
          onCancel={vi.fn()}
          initialTask={{
            id: "read-week",
            name: "Read the list",
            type: TaskType.GOAL,
            goal: 100,
            rewardValue: 10,
            frequency: "weekly",
            completionSources: ["manual"],
          }}
        />,
      )
      await user.click(screen.getByRole("button", { name: "Add source" }))
      await user.click(screen.getByRole("button", { name: "Lists" }))
      await user.click(screen.getByRole("button", { name: "List to read sent items from" }))
      await user.click(screen.getByRole("option", { name: "pages to read" }))
      await user.clear(screen.getByLabelText("Grace"))
      await user.type(screen.getByLabelText("Grace"), "80")
      await user.click(screen.getByRole("button", { name: "Update Habit" }))
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          completionSources: expect.arrayContaining(["manual", "listSent"]),
          listSentLink: expect.objectContaining({ listId: "list-pages", grace: 80 }),
          completionPipelines: expect.arrayContaining([
            expect.objectContaining({ kind: "lists", sources: expect.arrayContaining(["listSent"]) }),
          ]),
        }),
      )
      const previousHabits = useHabitsStore.getState().tasks
      useHabitsStore.getState().setTasks([
        {
          id: "read-week",
          name: "Read the list",
          type: TaskType.GOAL,
          goal: 100,
          rewardValue: 10,
          frequency: "weekly",
          completionSources: ["manual"],
        },
      ])
      useHabitsStore.getState().updateTask(onSubmit.mock.calls[0][0])
      const saved = useHabitsStore.getState().tasks.find((row) => row.id === "read-week")
      expect(saved?.completionSources).toEqual(expect.arrayContaining(["manual", "listSent"]))
      expect(saved?.listSentLink).toEqual(expect.objectContaining({ listId: "list-pages", grace: 80 }))
      expect(saved?.completionPipelines?.some((row) => row.kind === "lists" && row.sources.includes("listSent"))).toBe(
        true,
      )
      useHabitsStore.setState({ tasks: previousHabits })
    } finally {
      useTaskStore.setState({ lists: previousLists })
    }
  })

  it("puts completion sources above the target and saves list length as the amount", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const previousLists = useTaskStore.getState().lists
    const previousTasks = useTaskStore.getState().tasks
    const sentAt = new Date().toISOString()
    useTaskStore.getState().addList({
      id: "texts-send",
      name: "texts I need to send",
      color: "#224466",
      createdAt: new Date("2026-10-01T12:00:00"),
    })
    for (const [id, title, sent] of [
      ["t1", "Ruggles", true],
      ["t2", "Rebecca", false],
      ["t3", "Cammy", false],
      ["t4", "An", false],
      ["t5", "Fifth", false],
    ] as const) {
      useTaskStore.getState().addTask({
        id,
        title,
        description: title,
        type: "item",
        stage: "list",
        lists: ["texts-send"],
        createdAt: new Date("2026-10-01T12:00:00"),
        completed: false,
        tags: [],
        links: [],
        ...(sent ? { sentAtByList: { "texts-send": sentAt } } : {}),
      })
    }
    const initial = {
      id: "texts-habit",
      name: "respond to all missing texts",
      type: TaskType.GOAL,
      goal: 100,
      rewardValue: 10,
      frequency: "weekly" as const,
      completionSources: ["manual" as const, "listSent" as const],
      listSentLink: {
        listId: "texts-send",
        grace: 100,
        measure: "sent" as const,
        target: "listLength" as const,
      },
    }
    try {
      const { unmount } = render(<TaskForm onSubmit={onSubmit} onCancel={vi.fn()} initialTask={initial} />)
      const legends = [...document.querySelectorAll("legend")].map((el) => el.textContent)
      const typeAt = legends.indexOf("Habit Type")
      const sourcesAt = legends.indexOf("Completion sources")
      const targetAt = legends.indexOf("Target")
      expect(typeAt).toBeGreaterThanOrEqual(0)
      expect(typeAt).toBeLessThan(sourcesAt)
      expect(sourcesAt).toBeLessThan(targetAt)
      expect(screen.getByLabelText("Amount")).toHaveValue(5)
      expect(screen.getByLabelText("Grace")).toHaveValue(100)
      expect(screen.getByTestId("list-pipeline-preview")).toHaveTextContent("1 of 5")
      await user.click(screen.getByRole("button", { name: "Update Habit" }))
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ goal: 5 }))
      unmount()
      render(
        <TaskForm
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
          initialTask={{ ...onSubmit.mock.calls[0][0], goal: 5 }}
        />,
      )
      expect(screen.getByLabelText("Amount")).toHaveValue(5)
      expect(screen.getByRole("button", { name: "What the target is" })).toHaveTextContent("List length")
    } finally {
      useTaskStore.setState({ lists: previousLists, tasks: previousTasks })
    }
  })

  it("submits a better-than-last-week stats rule on the habits pipeline", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <TaskForm
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        initialTask={{
          id: "better-week",
          name: "better than last week",
          type: TaskType.BOOLEAN,
          rewardValue: 10,
          frequency: "weekly",
          completionSources: ["manual"],
        }}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Add source" }))
    await user.click(screen.getByRole("button", { name: "Habits stats" }))
    expect(screen.getByRole("button", { name: "Source" })).toHaveTextContent("Daily habits")
    expect(screen.getByRole("button", { name: "Period" })).toHaveTextContent("This week")
    expect(screen.getByRole("button", { name: "Output" })).toHaveTextContent("Week grade")
    expect(screen.queryByLabelText("Statement")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Update Habit" }))
    const submitted = onSubmit.mock.calls[0][0]
    const statsRow = submitted.completionPipelines?.find((row: { kind: string }) => row.kind === "habitsStats")
    expect(statsRow?.statBinding).toEqual(
      expect.objectContaining({
        mode: "simple",
        pipelines: [
          expect.objectContaining({ sourceId: "daily", periodId: "thisWeek", outputId: "weekGrade" }),
        ],
      }),
    )
    const previousHabits = useHabitsStore.getState().tasks
    useHabitsStore.getState().setTasks([
      {
        id: "better-week",
        name: "better than last week",
        type: TaskType.BOOLEAN,
        rewardValue: 10,
        frequency: "weekly",
        completionSources: ["manual"],
      },
    ])
    useHabitsStore.getState().updateTask(submitted)
    const saved = useHabitsStore.getState().tasks.find((row) => row.id === "better-week")
    expect(saved?.completionPipelines?.find((row) => row.kind === "habitsStats")?.statBinding).toEqual(
      expect.objectContaining({ mode: "simple" }),
    )
    useHabitsStore.setState({ tasks: previousHabits })
  })

  it("keeps a stored stats pipeline when Update is clicked without further edits", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const pipelines = [
      { id: "pipe-manual-0", kind: "manual" as const, sources: ["manual" as const] },
      {
        id: "pipe-stats-1",
        kind: "habitsStats" as const,
        sources: [] as const,
        stats: {
          set: "daily" as const,
          points: [
            { kind: "dailyCompletionAverage" as const },
            { kind: "weekGrade" as const },
            { kind: "perfectOutput" as const },
          ],
          comparePrevious: true,
          mustBeHigher: 2,
        },
      },
    ]
    render(
      <TaskForm
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        initialTask={{
          id: "better-week",
          name: "better than last week",
          type: TaskType.BOOLEAN,
          rewardValue: 10,
          frequency: "weekly",
          completionSources: ["manual"],
          completionPipelines: pipelines,
        }}
      />,
    )
    expect(screen.getByLabelText("How many must be higher")).toHaveValue(2)
    expect(screen.getByRole("button", { name: "Source" })).toBeInTheDocument()
    expect(screen.queryByLabelText("Statement")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Update Habit" }))
    const submitted = onSubmit.mock.calls[0][0]
    expect(submitted.completionPipelines?.[1]?.stats).toEqual(pipelines[1].stats)
    expect(submitted.completionPipelines?.[1]?.statBinding?.mode).toBe("simple")
    expect(submitted.completionPipelines?.[1]?.statBinding?.pipelines?.[0]).toEqual(
      expect.objectContaining({ sourceId: "daily", outputId: "dailyCompletionAverage" }),
    )
    expect(submitted.completionSources).toEqual(["manual"])
  })
})
