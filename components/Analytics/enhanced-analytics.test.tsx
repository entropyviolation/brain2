/**
 * EnhancedAnalytics — smoke + tab navigation tests.
 */
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { usePointsStore } from "@/lib/points-store"
import { useHabitsStore } from "@/lib/habits-store"
import { useReviewsStore } from "@/lib/reviews-store"
import { useTimeTrackingStore, SLOT_MINUTES, SLOTS_PER_DAY } from "@/lib/time-tracking-store"
import { formatDateKey } from "@/lib/date-utils"
import { EnhancedAnalytics } from "./enhanced-analytics"

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div data-testid="chart">{children}</div>,
  BarChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  LineChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Line: () => null,
  PieChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Pie: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
}))

describe("EnhancedAnalytics", () => {
  beforeEach(() => {
    resetLocalStorage()
    useTaskStore.setState({ tasks: [], lists: [], folders: [] })
    usePointsStore.setState({ pointsHistory: [] })
    useHabitsStore.setState({ tasks: [], weeklyData: {}, categories: [] })
    useReviewsStore.setState({ reviews: [] })
    useTimeTrackingStore.setState((state) => ({
      ...state,
      scopes: state.scopes.length ? state.scopes : [{ id: "activity", name: "Activity", pens: [] }],
      data: {},
    }))
  })

  it("renders headline metrics", () => {
    render(<EnhancedAnalytics />)

    expect(screen.getByRole("heading", { name: "Analytics & Insights" })).toBeInTheDocument()
    expect(screen.getByText("Total points")).toBeInTheDocument()
    expect(screen.getByText("Tasks completed")).toBeInTheDocument()
    expect(screen.getByText("Completion rate")).toBeInTheDocument()
    expect(screen.getByText("Active habits")).toBeInTheDocument()
    expect(screen.getByText("Daily habit completion heatmap")).toBeInTheDocument()
  })

  it("switches to the Points tab and shows points sections", async () => {
    const user = userEvent.setup()
    render(<EnhancedAnalytics />)

    await user.click(screen.getByRole("tab", { name: "Points" }))

    expect(screen.getByText("Points (last 14 days)")).toBeInTheDocument()
    expect(screen.getByText("Cumulative points")).toBeInTheDocument()
    expect(screen.getByText("Top point earners")).toBeInTheDocument()
    expect(screen.getByText("Complete tasks to earn points.")).toBeInTheDocument()
  })

  it("switches to the Item Types tab and lists types", async () => {
    const user = userEvent.setup()
    render(<EnhancedAnalytics />)

    await user.click(screen.getByRole("tab", { name: "Item Types" }))

    expect(screen.getByRole("heading", { name: "Item Types" })).toBeInTheDocument()
    expect(screen.getByText("Task")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /New type/i })).toBeInTheDocument()
  })

  it("excludes uncategorized time from tracking pie by default", async () => {
    const user = userEvent.setup()
    const todayKey = formatDateKey(new Date())
    const slots = new Array(SLOTS_PER_DAY).fill(null)
    slots[0] = "act-work"
    slots[1] = "act-work"

    useTimeTrackingStore.setState({
      scopes: [
        {
          id: "activity",
          name: "Activity",
          pens: [{ id: "act-work", name: "Work", color: "#2563eb" }],
        },
      ],
      data: { [todayKey]: { activity: slots } },
    })

    const workMinutes = SLOT_MINUTES * 2

    render(<EnhancedAnalytics />)
    await user.click(screen.getByRole("tab", { name: "Tracking" }))

    expect(screen.getByText("Work")).toBeInTheDocument()
    expect(screen.getByText(`${Math.floor(workMinutes / 60)}h ${workMinutes % 60}m`)).toBeInTheDocument()
    expect(screen.queryByText("Unknown")).not.toBeInTheDocument()
  })

  it("includes uncategorized time when toggle is enabled", async () => {
    const user = userEvent.setup()
    const todayKey = formatDateKey(new Date())
    const slots = new Array(SLOTS_PER_DAY).fill(null)
    slots[0] = "act-work"
    slots[1] = "act-work"
    const unknownMinutes = (SLOTS_PER_DAY - 2) * SLOT_MINUTES

    useTimeTrackingStore.setState({
      scopes: [
        {
          id: "activity",
          name: "Activity",
          pens: [{ id: "act-work", name: "Work", color: "#2563eb" }],
        },
      ],
      data: { [todayKey]: { activity: slots } },
    })

    render(<EnhancedAnalytics />)
    await user.click(screen.getByRole("tab", { name: "Tracking" }))
    await user.click(screen.getByLabelText("Show uncategorized time"))

    expect(screen.getByText("Work")).toBeInTheDocument()
    expect(screen.getByText("Unknown")).toBeInTheDocument()
    expect(
      screen.getByText(`${Math.floor(unknownMinutes / 60)}h ${unknownMinutes % 60}m`),
    ).toBeInTheDocument()
  })
})
