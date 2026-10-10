import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { useTaskStore } from "@/lib/task-store"
import { TaskType, type WeeklyTask } from "@/lib/types"
import { HabitCompletionCell } from "./habit-completion-cell"
import { HabitSourceDetail } from "./habit-source-detail"

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

const finishedWeek = new Date(2026, 8, 28, 12)
const afterThatWeek = new Date(2026, 9, 9, 12)

function listItem(title: string, extra: { sentAt?: string; completedDate?: string } = {}) {
  return {
    id: title,
    title,
    description: title,
    type: "item" as const,
    stage: "list" as const,
    lists: ["texts"],
    createdAt: "2026-09-01T12:00:00",
    completed: Boolean(extra.completedDate),
    completedDate: extra.completedDate,
    sentAtByList: extra.sentAt ? { texts: extra.sentAt } : undefined,
    tags: [],
    links: [],
  }
}

function numberBeside(label: string): string {
  const row = screen.getByText(label).closest("li")
  return row?.querySelector(".habit95-span-facts-num")?.textContent ?? ""
}

describe("list span detail", () => {
  function openTexts(items: ReturnType<typeof listItem>[], listName = "texts") {
    const previous = { lists: useTaskStore.getState().lists, tasks: useTaskStore.getState().tasks }
    useTaskStore.setState({
      lists: [...previous.lists.filter((list) => list.id !== "texts"), { id: "texts", name: listName, color: "#224466", createdAt: new Date("2026-09-01T12:00:00") }],
      tasks: [...previous.tasks.filter((item) => !(item.lists ?? []).includes("texts")), ...items],
    })
    const habit: WeeklyTask = {
      id: "texts-habit",
      name: "respond to all missing texts",
      type: TaskType.GOAL,
      goal: 5,
      frequency: "weekly",
      completionSources: ["listSent"],
      listSentLink: { listId: "texts", grace: 100, measure: "sent", target: "listLength" },
    }
    const view = render(
      <HabitSourceDetail
        open
        onOpenChange={vi.fn()}
        task={habit}
        periodLabel="9/28"
        date={finishedWeek}
        completion={undefined}
        now={afterThatWeek}
      />,
    )
    return () => {
      view.unmount()
      useTaskStore.setState(previous)
    }
  }

  it("shows list length, sent this week, and left to send for a finished week", () => {
    const restore = openTexts([
      listItem("one"),
      listItem("two"),
      listItem("three"),
      listItem("four"),
      listItem("five", { sentAt: "2026-09-30T15:00:00" }),
    ])
    try {
      const dialog = screen.getByRole("dialog")
      expect(dialog).toHaveTextContent("9/28")
      expect(screen.getByText("List length")).toBeInTheDocument()
      expect(screen.getByText("texts sent this week")).toBeInTheDocument()
      expect(screen.getByText("texts left to send")).toBeInTheDocument()
      expect(numberBeside("List length")).toBe("5")
      expect(numberBeside("texts sent this week")).toBe("1")
      expect(numberBeside("texts left to send")).toBe("4")
      const length = screen.getByText("List length").closest("li")
      expect(length).toHaveAttribute("data-frozen", "true")
      expect(length?.querySelector("input")).toBeNull()
      expect(screen.queryByText("No reading")).not.toBeInTheDocument()
      expect(screen.queryByText("—")).not.toBeInTheDocument()
    } finally {
      restore()
    }
  })

  it("opens the three lines from a goal that also has By hand", async () => {
    const user = userEvent.setup()
    const previous = { lists: useTaskStore.getState().lists, tasks: useTaskStore.getState().tasks }
    useTaskStore.setState({
      lists: [...previous.lists.filter((list) => list.id !== "texts"), { id: "texts", name: "texts to send", color: "#224466", createdAt: new Date("2026-09-01T12:00:00") }],
      tasks: [
        ...previous.tasks.filter((item) => !(item.lists ?? []).includes("texts")),
        listItem("one"),
        listItem("two"),
        listItem("three"),
        listItem("four"),
        listItem("five", { sentAt: "2026-09-30T15:00:00" }),
      ],
    })
    const view = render(
      <HabitCompletionCell
        task={task(["manual", "listSent"], {
          id: "texts-habit",
          name: "respond to all missing texts",
          listSentLink: { listId: "texts", grace: 100, measure: "sent", target: "listLength" },
        })}
        date={finishedWeek}
        periodKey="2026-09-28_2026-10-04"
        periodLabel="9/28"
        completion={undefined}
        weeklyData={{}}
        variant="period"
        frequency="weekly"
        exemptionNoun="week"
        onBooleanChange={vi.fn()}
        onGoalChange={vi.fn()}
        onTextChange={vi.fn()}
        onIncrementalChange={vi.fn()}
      />,
    )
    try {
      await user.dblClick(screen.getByLabelText("respond to all missing texts 9/28"))
      expect(screen.getByRole("dialog")).toHaveTextContent("texts sent this week")
      expect(numberBeside("List length")).toBe("5")
      expect(numberBeside("texts sent this week")).toBe("1")
      expect(numberBeside("texts left to send")).toBe("4")
      expect(screen.queryByText("No reading")).not.toBeInTheDocument()
    } finally {
      view.unmount()
      useTaskStore.setState(previous)
    }
  })

  it("prints 0 when nothing was sent in that week", () => {
    const restore = openTexts([listItem("one"), listItem("two"), listItem("three"), listItem("four"), listItem("five")])
    try {
      expect(numberBeside("texts sent this week")).toBe("0")
      expect(screen.queryByText("No reading")).not.toBeInTheDocument()
      expect(screen.queryByText("—")).not.toBeInTheDocument()
    } finally {
      restore()
    }
  })

  it("names another list and another period without the word texts", () => {
    const previous = { lists: useTaskStore.getState().lists, tasks: useTaskStore.getState().tasks }
    useTaskStore.setState({
      lists: [...previous.lists, { id: "chores", name: "chores", color: "#224466", createdAt: new Date("2026-08-01T12:00:00") }],
      tasks: [
        ...previous.tasks,
        {
          id: "chore-open",
          title: "open",
          description: "open",
          type: "item" as const,
          stage: "list" as const,
          lists: ["chores"],
          createdAt: "2026-08-01T12:00:00",
          completed: false,
          tags: [],
          links: [],
        },
        {
          id: "chore-done",
          title: "done",
          description: "done",
          type: "item" as const,
          stage: "list" as const,
          lists: ["chores"],
          createdAt: "2026-08-01T12:00:00",
          completed: true,
          completedDate: "2026-09-10T12:00:00",
          tags: [],
          links: [],
        },
      ],
    })
    const habit: WeeklyTask = {
      id: "chores-habit",
      name: "finish the chores",
      type: TaskType.GOAL,
      goal: 2,
      frequency: "monthly",
      completionSources: ["listSent"],
      listSentLink: { listId: "chores", grace: 100, measure: "completed", target: "listLength" },
    }
    const view = render(
      <HabitSourceDetail
        open
        onOpenChange={vi.fn()}
        task={habit}
        periodLabel="Sep"
        date={new Date(2026, 8, 15, 12)}
        completion={undefined}
        now={afterThatWeek}
      />,
    )
    try {
      expect(screen.getByText("chores completed this month")).toBeInTheDocument()
      expect(screen.getByText("chores left to complete")).toBeInTheDocument()
      expect(numberBeside("List length")).toBe("2")
      expect(numberBeside("chores completed this month")).toBe("1")
      expect(numberBeside("chores left to complete")).toBe("1")
      expect(screen.queryByText(/texts/)).not.toBeInTheDocument()
    } finally {
      view.unmount()
      useTaskStore.setState(previous)
    }
  })
})
