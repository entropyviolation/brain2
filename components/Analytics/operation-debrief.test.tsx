import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import type { OperationReview } from "@/lib/reviews-store"
import { useReviewsStore } from "@/lib/reviews-store"
import { useTaskStore } from "@/lib/task-store"
import { resetLocalStorage } from "@/tests/test-utils"
import { OperationsAnalytics } from "./OperationsAnalytics"
import { useAnalyticsRangeStore } from "./analytics-range-store"
import { formatDebriefHours, summarizeOperationDebriefs } from "./operation-debrief"

function review(overrides: Partial<OperationReview> & Pick<OperationReview, "id" | "operationId">): OperationReview {
  return {
    completedAt: new Date(2026, 5, 10, 12),
    summary: "",
    ...overrides,
  }
}

describe("summarizeOperationDebriefs", () => {
  const inJune2026 = (date: Date | string | undefined | null) => {
    const d = date instanceof Date ? date : new Date(date ?? "")
    return d.getFullYear() === 2026 && d.getMonth() === 5
  }

  it("means in-window 1–10 scores and sums stored hours without treating gaps as zero", () => {
    const summary = summarizeOperationDebriefs({
      reviews: [
        review({
          id: "operation:a",
          operationId: "a",
          completedAt: new Date(2026, 5, 10, 12),
          summary: "Went well",
          whatWorked: "Small ships",
          whatFailed: "Late start",
          lessons: ["Book focus", ""],
          ratings: { execution: 8, planning: 6, morale: 9 },
          hoursLogged: 4.5,
        }),
        review({
          id: "operation:b",
          operationId: "b",
          completedAt: new Date(2026, 5, 12, 12),
          summary: "",
          ratings: { execution: 4, planning: 0, morale: 7.5 },
          hoursLogged: 1.5,
        }),
        review({
          id: "operation:c",
          operationId: "c",
          completedAt: new Date(2026, 0, 1, 12),
          summary: "Old",
          ratings: { execution: 10, planning: 10, morale: 10 },
          hoursLogged: 100,
        }),
        review({
          id: "operation:d",
          operationId: "d",
          completedAt: new Date(2026, 5, 11, 12),
          summary: "No hours",
          ratings: {},
          hoursLogged: -3,
        }),
      ],
      inWindow: inJune2026,
      titleOf: (id) => `Op ${id}`,
    })

    expect(summary.reviewCount).toBe(3)
    expect(summary.ratings.find((row) => row.key === "execution")).toMatchObject({ n: 2, mean: 6 })
    expect(summary.ratings.find((row) => row.key === "planning")).toMatchObject({ n: 1, mean: 6 })
    expect(summary.ratings.find((row) => row.key === "morale")).toMatchObject({ n: 1, mean: 9 })
    expect(summary.hoursSum).toBe(6)
    expect(summary.hoursCount).toBe(2)
    expect(summary.hoursMean).toBe(3)
    expect(formatDebriefHours(summary.hoursSum)).toBe("6 h")
    expect(formatDebriefHours(4.5)).toBe("4.5 h")
    expect(summary.texts.map((text) => text.operationId)).toEqual(["d", "a"])
    expect(summary.texts[1]).toMatchObject({
      title: "Op a",
      summary: "Went well",
      whatWorked: "Small ships",
      whatFailed: "Late start",
      lessons: ["Book focus"],
    })
    expect(summary.texts.some((text) => text.summary === "Old")).toBe(false)
  })

  it("stays empty when no report falls in the window", () => {
    const summary = summarizeOperationDebriefs({
      reviews: [review({ id: "operation:a", operationId: "a", summary: "Later", hoursLogged: 2 })],
      inWindow: () => false,
      titleOf: () => "Op",
    })
    expect(summary.reviewCount).toBe(0)
    expect(summary.ratings).toEqual([])
    expect(summary.hoursSum).toBe(0)
    expect(summary.hoursCount).toBe(0)
    expect(summary.hoursMean).toBeUndefined()
    expect(summary.texts).toEqual([])
  })
})

describe("Operations after-action plate", () => {
  beforeEach(() => {
    resetLocalStorage()
    useAnalyticsRangeStore.setState({
      mode: "preset",
      days: 30,
      fromKey: null,
      toKey: null,
      stepUnit: null,
      hydrated: true,
    })
    useTaskStore.setState({ tasks: [], lists: [], folders: [] })
    useReviewsStore.setState({ reviews: [], operationReviews: [] })
  })

  it("keeps an empty sentence when operations exist and no report is in the window", () => {
    useTaskStore.setState({
      tasks: [
        {
          id: "op",
          type: "operation",
          title: "Launch",
          description: "Launch",
          stage: "inbox",
          createdAt: new Date(),
          completed: false,
          lists: [],
        },
      ],
      lists: [],
      folders: [],
    })
    render(<OperationsAnalytics />)
    expect(screen.getByTestId("operations-debrief")).toBeInTheDocument()
    expect(screen.getByText(/No after-action reports/)).toBeInTheDocument()
  })

  it("shows means and the written debrief for a report in the window", () => {
    const today = new Date()
    today.setHours(12, 0, 0, 0)
    useTaskStore.setState({
      tasks: [
        {
          id: "op",
          type: "operation",
          title: "Launch",
          description: "Launch",
          stage: "inbox",
          createdAt: new Date(),
          completed: false,
          lists: [],
        },
      ],
      lists: [],
      folders: [],
    })
    useReviewsStore.setState({
      reviews: [],
      operationReviews: [
        {
          id: "operation:op",
          operationId: "op",
          completedAt: today,
          summary: "The launch held.",
          whatWorked: "Short phases",
          whatFailed: "Late parts",
          lessons: ["File the report the same day"],
          ratings: { execution: 8, planning: 6, morale: 9 },
          hoursLogged: 4.5,
        },
      ],
    })
    render(<OperationsAnalytics />)
    expect(screen.getByTestId("operations-debrief")).toHaveTextContent("8.0")
    expect(screen.getByTestId("operations-debrief")).toHaveTextContent("6.0")
    expect(screen.getByTestId("operations-debrief")).toHaveTextContent("9.0")
    expect(screen.getByTestId("operations-debrief")).toHaveTextContent("4.5 h")
    expect(screen.getByText("The launch held.")).toBeInTheDocument()
    expect(screen.getByText(/Short phases/)).toBeInTheDocument()
    expect(screen.getByText(/Late parts/)).toBeInTheDocument()
    expect(screen.getByText("File the report the same day")).toBeInTheDocument()
  })
})
