import { render, screen, fireEvent } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useHabitsStore } from "@/lib/habits-store"
import { useReviewsStore } from "@/lib/reviews-store"
import { TaskType } from "@/lib/types"
import { useSleepStore } from "@/lib/sleep-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useTaskStore } from "@/lib/task-store"
import { MorningReviewDialog } from "./MorningReview"

/** Thursday 17 September 2026. */
const TODAY = new Date(2026, 8, 17, 9, 0, 0)
const MORNING = "2026-09-17"
const EVENING = "2026-09-16"

const bedtimeField = () => screen.getByLabelText("Fell asleep") as HTMLInputElement
const wakeField = () => screen.getByLabelText("Wake time") as HTMLInputElement

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(TODAY)
  resetAllStores()
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("MorningReviewDialog", () => {
  it("shows last night's wake-up reminder and what matters most", () => {
    useReviewsStore.setState({
      reviews: [
        {
          id: "day:2026-09-16",
          period: "day",
          periodKey: "2026-09-16",
          completedAt: new Date(2026, 8, 16, 22, 0, 0),
          summary: "",
          gratitude: [],
          nextPlans: "",
          reflections: {},
          resolvedTaskIds: [],
          pushedTaskIds: [],
          wakeReminder: "water the fern",
          tomorrowMatters: "the letter",
        },
      ],
    })
    render(<MorningReviewDialog open onClose={() => {}} date={TODAY} />)
    expect(screen.getByText("water the fern")).toBeInTheDocument()
    expect(screen.getByText("the letter")).toBeInTheDocument()
  })

  it("shows the night already logged elsewhere", () => {
    useSleepStore.setState({ nights: { [MORNING]: { date: MORNING, sleptMin: -45, wokeMin: 420 } } })
    render(<MorningReviewDialog open onClose={() => {}} date={TODAY} />)

    expect(bedtimeField().value).toBe("23:15")
    expect(wakeField().value).toBe("07:00")
  })

  it("picks up a night logged after it was mounted", () => {
    // The dialog is mounted closed at app load, so reading the store once at
    // construction would leave it permanently blank.
    const { rerender } = render(<MorningReviewDialog open={false} onClose={() => {}} date={TODAY} />)
    useSleepStore.setState({ nights: { [MORNING]: { date: MORNING, sleptMin: -45, wokeMin: 420 } } })
    rerender(<MorningReviewDialog open onClose={() => {}} date={TODAY} />)

    expect(bedtimeField().value).toBe("23:15")
  })

  it("opens pre-filled from sleep painted on the grid", () => {
    useTimeTrackingStore.setState({
      entries: [
        { id: "e1", date: EVENING, scopeId: "activity", penId: "act-sleep", startMin: 1350, endMin: 1440 },
        { id: "e2", date: MORNING, scopeId: "activity", penId: "act-sleep", startMin: 0, endMin: 435 },
      ],
    })
    render(<MorningReviewDialog open onClose={() => {}} date={TODAY} />)

    expect(bedtimeField().value).toBe("22:30")
    expect(wakeField().value).toBe("07:15")
  })

  it("writes the night through to the sleep log on save", () => {
    render(<MorningReviewDialog open onClose={() => {}} date={TODAY} />)

    fireEvent.change(bedtimeField(), { target: { value: "23:30" } })
    fireEvent.change(wakeField(), { target: { value: "07:00" } })
    fireEvent.click(screen.getByRole("button", { name: /Save Morning Review/ }))

    expect(useSleepStore.getState().nights[MORNING]).toMatchObject({ sleptMin: -30, wokeMin: 420 })
  })

  it("lets a stated time override what the grid shows", () => {
    useTimeTrackingStore.setState({
      entries: [{ id: "e1", date: EVENING, scopeId: "activity", penId: "act-sleep", startMin: 1350, endMin: 1440 }],
    })
    render(<MorningReviewDialog open onClose={() => {}} date={TODAY} />)

    fireEvent.change(bedtimeField(), { target: { value: "00:30" } })
    fireEvent.change(wakeField(), { target: { value: "07:00" } })
    fireEvent.click(screen.getByRole("button", { name: /Save Morning Review/ }))

    expect(useSleepStore.getState().nights[MORNING]?.sleptMin).toBe(30)
  })

  it("saves one answer and leaves the dialog open", () => {
    const onClose = vi.fn()
    render(<MorningReviewDialog open onClose={onClose} date={TODAY} />)

    fireEvent.change(screen.getByPlaceholderText("Anything you remember…"), {
      target: { value: "a long hallway" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save progress" }))

    expect(onClose).not.toHaveBeenCalled()
    const morning = useReviewsStore.getState().getMorningReview(MORNING)
    expect(morning?.dream).toBe("a long hallway")
    expect(morning?.completed).toBe(false)
    expect(morning?.bestDayWhy).toBeUndefined()
    expect(morning?.gratitude).toBeUndefined()
    expect(screen.getByText(/Unanswered questions stay open/)).toBeTruthy()
  })

  it("a ritual toggle logs Selected from day ritual", () => {
    useHabitsStore.getState().setTasks([
      { id: "water", name: "Drink water", type: TaskType.BOOLEAN, frequency: "daily", rewardValue: 10 },
    ])
    render(<MorningReviewDialog open onClose={() => {}} date={TODAY} />)
    fireEvent.click(screen.getByRole("button", { name: /Go to Daily habit priorities/ }))
    fireEvent.click(screen.getByRole("checkbox", { name: "Drink water" }))
    const habit = useHabitsStore.getState().tasks.find((task) => task.id === "water")
    expect(habit?.priorityLog?.[0]).toContain("Selected from day ritual")
    expect(habit?.priorityLog?.[0]).toContain("Sep 17")
  })

  it("opens another day and shows that day's saved review", () => {
    useReviewsStore.getState().replaceMorningReview("2026-09-16", {
      dream: "yesterday's river",
      completed: true,
      source: "desktop",
    })
    render(<MorningReviewDialog open onClose={() => {}} date={TODAY} />)

    fireEvent.click(screen.getByRole("button", { name: "Previous day" }))

    expect(screen.getByText(/September 16/)).toBeTruthy()
    expect(screen.getByDisplayValue("yesterday's river")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Next day" })).not.toBeDisabled()
  })

  it("walks one question at a time and remembers the step", () => {
    const { unmount } = render(<MorningReviewDialog open onClose={() => {}} date={TODAY} />)
    expect(screen.getByRole("heading", { name: "Last night" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(screen.getByRole("heading", { name: "Affirmations" })).toBeTruthy()
    expect(screen.queryByPlaceholderText("Anything you remember…")).toBeNull()
    unmount()
    render(<MorningReviewDialog open onClose={() => {}} date={TODAY} />)
    expect(screen.getByRole("heading", { name: "Affirmations" })).toBeTruthy()
  })

  it("Enter in gratitude moves to the next line and keeps its text", () => {
    render(<MorningReviewDialog open onClose={() => {}} date={TODAY} />)
    fireEvent.click(screen.getByRole("button", { name: /Go to Gratitude/ }))
    const fields = screen.getAllByPlaceholderText("Grateful for…") as HTMLInputElement[]
    fireEvent.change(fields[0], { target: { value: "coffee" } })
    fireEvent.change(fields[1], { target: { value: "rain" } })
    fields[0].focus()
    fireEvent.keyDown(fields[0], { key: "Enter" })
    const after = screen.getAllByPlaceholderText("Grateful for…") as HTMLInputElement[]
    expect(after[0].value).toBe("coffee")
    expect(after[1].value).toBe("rain")
    expect(document.activeElement).toBe(after[1])
  })
})

describe("MorningReviewDialog look ahead", () => {
  const add = (extra: Record<string, unknown>) =>
    useTaskStore.getState().addTask({
      description: "x",
      stage: "scheduled",
      createdAt: TODAY,
      completed: false,
      lists: [],
      ...extra,
    } as never)

  it("lists week and month work by importance and moves one onto today", () => {
    add({ id: "m1", description: "Book the dentist", scheduledMonth: "2026-09", importance: 2 })
    add({ id: "m2", description: "File taxes", scheduledMonth: "2026-09", importance: 5 })
    render(<MorningReviewDialog open onClose={() => {}} date={TODAY} />)
    fireEvent.click(screen.getByRole("button", { name: /^Go to Week and month/ }))
    const titles = screen.getAllByText(/Book the dentist|File taxes/).map((n) => n.textContent)
    expect(titles).toEqual(["File taxes", "Book the dentist"])
    fireEvent.click(screen.getAllByRole("button", { name: "Do today" })[0])
    const moved = useTaskStore.getState().tasks.find((t) => t.id === "m2")!
    expect(new Date(moved.scheduledDate!).getDate()).toBe(17)
    expect(screen.getByText("On today")).toBeInTheDocument()
  })

  it("shows what is due within a week with a countdown, and what is overdue", () => {
    add({ id: "d1", description: "Send invoice", deadline: new Date(2026, 8, 19, 9) })
    add({ id: "o1", description: "Return library book", deadline: new Date(2026, 8, 14, 9) })
    render(<MorningReviewDialog open onClose={() => {}} date={TODAY} />)
    fireEvent.click(screen.getByRole("button", { name: /^Go to Due within a week/ }))
    expect(screen.getByText("Send invoice")).toBeInTheDocument()
    expect(screen.getByText("2d")).toBeInTheDocument()
    expect(screen.queryByText("Return library book")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /^Go to Overdue/ }))
    expect(screen.getByText("Return library book")).toBeInTheDocument()
    expect(screen.getByText("3d late")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Missed" }))
    expect(useTaskStore.getState().tasks.find((t) => t.id === "o1")?.status).toBe("missed")
  })
})
