/**
 * Behavior views — the new plates render with seeded data.
 */
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { useReviewsStore } from "@/lib/reviews-store"
import { formatLocalDateKey } from "@/lib/date-utils"
import type { PeriodReview, Task } from "@/lib/types"
import { useAnalyticsRangeStore } from "./analytics-range-store"
import { ReflectionView } from "./ReflectionView"
import { TodoPulseView } from "./TodoPulseView"
import { ReviewsView } from "./ReviewsView"
import { SeasonsView } from "./SeasonsView"
import { OvercommitmentView } from "./OvercommitmentView"
import { median, topWords } from "./behavior-kit"

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

function daysAgo(n: number): Date {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - n)
  return d
}

function task(i: number, extra: Partial<Task> = {}): Task {
  return {
    id: `t${i}`,
    description: `Task ${i}`,
    stage: "scheduled",
    createdAt: daysAgo(20),
    completed: false,
    lists: ["list-1"],
    ...extra,
  }
}

describe("Behavior views", () => {
  beforeEach(() => {
    resetLocalStorage()
    useAnalyticsRangeStore.setState({ days: 30, hydrated: true })
    const today = formatLocalDateKey(daysAgo(1))
    const tasks: Task[] = [1, 2, 3, 4].map((i) =>
      task(i, {
        completed: true,
        completionReview: {
          taskId: `t${i}`,
          completedAt: daysAgo(i),
          satisfaction: 4 + i,
          resistance: 8 - i,
          expectedDifficulty: 5,
          actualDifficulty: 3 + i,
          actualDuration: 20 * i,
        } as Task["completionReview"],
      }),
    )
    tasks.push(
      task(5, {
        daysPushed: 6,
        resistanceReadings: [{ value: 7, at: daysAgo(2).toISOString() }] as Task["resistanceReadings"],
        dayRatings: { [today]: { importance: 8, excitement: 3 } },
      }),
    )
    useTaskStore.setState({ tasks, lists: [], folders: [] })
    const review = {
      id: `day:${today}`,
      period: "day",
      periodKey: today,
      completedAt: daysAgo(1),
      summary: "",
      gratitude: ["Sunny walk with friends", "friends again"],
      nextPlans: "",
      morning: { completed: true, gratitude: ["coffee"] },
    } as unknown as PeriodReview
    useReviewsStore.setState({ reviews: [review] })
  })

  it("Reflection shows score spread, bubbles and the mirror", () => {
    render(<ReflectionView />)
    expect(screen.getByTestId("reflection-spread")).toBeInTheDocument()
    expect(screen.getByTestId("reflection-bubbles")).toBeInTheDocument()
    expect(screen.getByTestId("reflection-mirror")).toBeInTheDocument()
    expect(screen.getByText(/Pearson r =/)).toBeInTheDocument()
  })

  it("To-do pulse shows the quadrant", () => {
    render(<TodoPulseView />)
    expect(screen.getByTestId("pulse-quadrant")).toBeInTheDocument()
    expect(screen.getByText(/dread 1/)).toBeInTheDocument()
  })

  it("Reviews shows the ritual strip and gratitude words", () => {
    render(<ReviewsView />)
    expect(screen.getByTestId("ritual-strip")).toBeInTheDocument()
    expect(screen.getByTestId("gratitude-words")).toHaveTextContent("friends")
  })

  it("Seasons shows mirror, wheel and pace", () => {
    render(<SeasonsView />)
    expect(screen.getByTestId("seasons-mirror")).toBeInTheDocument()
    expect(screen.getByTestId("seasons-wheel")).toBeInTheDocument()
    expect(screen.getByTestId("seasons-pace")).toBeInTheDocument()
  })

  it("Overcommit shows sliding items", () => {
    render(<OvercommitmentView />)
    expect(screen.getByTestId("overcommit-squares")).toHaveTextContent("Task 5")
  })

  it("helpers", () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(2.5)
    expect(topWords(["the friends", "Friends!"])[0]).toEqual({ word: "friends", count: 2 })
  })
})
