/**
 * DayReviewTomorrowSection — plan tomorrow during day review.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { saveStoredPlanText } from "@/lib/plan-text"
import { DayReviewTomorrowSection } from "./DayReviewTomorrowSection"

function seedTask(description: string, overrides: Record<string, unknown> = {}) {
  useTaskStore.getState().addTask({
    id: `task-${description}`,
    description,
    stage: "clarified",
    createdAt: new Date(),
    completed: false,
    lists: [],
    scheduleable: true,
    urgency: 3,
    importance: 3,
    estimatedDuration: 30,
    cognitiveLoad: 2,
    dependencies: [],
    context: "@general",
    entropy: 0.5,
    rewardValue: 5,
    allowPartialCompletion: false,
    minimumChunkSize: 15,
    ...overrides,
  } as never)
}

describe("DayReviewTomorrowSection", () => {
  beforeEach(() => {
    resetLocalStorage()
    useTaskStore.setState({ tasks: [] })
  })

  it("shows tomorrow's plan text and allows editing", async () => {
    const user = userEvent.setup()
    saveStoredPlanText("day", "2026-06-26", "Morning deep work")

    render(<DayReviewTomorrowSection reviewedDayKey="2026-06-25" />)

    const plan = screen.getByTestId("tomorrow-plan-text")
    expect(plan).toHaveValue("Morning deep work")

    await user.clear(plan)
    await user.type(plan, "Ship feature")
    expect(plan).toHaveValue("Ship feature")
  })

  it("lists tasks scheduled for tomorrow and supports search-to-add", async () => {
    const user = userEvent.setup()
    seedTask("Already tomorrow", { scheduledDate: new Date("2026-06-26T00:00:00") })
    seedTask("From backlog")

    render(<DayReviewTomorrowSection reviewedDayKey="2026-06-25" />)

    expect(screen.getByText("Already tomorrow")).toBeInTheDocument()
    expect(screen.queryByText("From backlog")).not.toBeInTheDocument()

    await user.type(screen.getByTestId("tomorrow-task-search"), "backlog")
    const result = await screen.findByText("From backlog")
    await user.click(result)

    expect(screen.getByText("From backlog")).toBeInTheDocument()
  })

  it("creates a new task scheduled for tomorrow", async () => {
    const user = userEvent.setup()
    render(<DayReviewTomorrowSection reviewedDayKey="2026-06-25" />)

    await user.click(screen.getByTestId("tomorrow-new-task-toggle"))
    await user.type(screen.getByTestId("tomorrow-new-task-description"), "Write tests")
    await user.click(screen.getByRole("button", { name: /^Add$/i }))

    expect(screen.getByText("Write tests")).toBeInTheDocument()
    const created = useTaskStore.getState().tasks.find((t) => t.description === "Write tests")
    expect(created?.scheduledDate).toBeTruthy()
  })
})
