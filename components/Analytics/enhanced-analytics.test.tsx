/**
 * EnhancedAnalytics — smoke, shared range, grouped rail, honesty.
 */
import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { usePointsStore } from "@/lib/points-store"
import { useHabitsStore } from "@/lib/habits-store"
import { useReviewsStore } from "@/lib/reviews-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { formatLocalDateKey } from "@/lib/date-utils"
import { EnhancedAnalytics } from "./enhanced-analytics"
import { ANALYTICS_RANGE_STORAGE_KEY, DEFAULT_ANALYTICS_RANGE } from "./analytics-range"
import { useAnalyticsRangeStore } from "./analytics-range-store"

vi.mock("@/lib/screentime/prefs", () => ({
  DEFAULT_SCREENTIME_PREFS: {
    url: "http://127.0.0.1:5600",
    lookbackDays: 14,
    minDurationSec: 15,
    storeWindowTitles: false,
  },
  loadScreenTimePrefs: () => ({
    url: "http://127.0.0.1:5600",
    lookbackDays: 14,
    minDurationSec: 15,
    storeWindowTitles: false,
  }),
  saveScreenTimePrefs: () => {},
}))
vi.mock("@/lib/screentime/sync", () => ({
  fetchScreenTime: async () => ({ ok: false }),
  syncScreenTime: async () => ({ ok: true, days: 0, blocks: 0 }),
}))

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
  ScatterChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Scatter: () => null,
  ZAxis: () => null,
  ComposedChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Legend: () => null,
}))

describe("EnhancedAnalytics", () => {
  beforeEach(() => {
    resetLocalStorage()
    useAnalyticsRangeStore.setState({ days: DEFAULT_ANALYTICS_RANGE, hydrated: false })
    useTaskStore.setState({ tasks: [], lists: [], folders: [] })
    usePointsStore.setState({ pointsHistory: [] })
    useHabitsStore.setState({ tasks: [], weeklyData: {}, categories: [] })
    useReviewsStore.setState({ reviews: [] })
    useTimeTrackingStore.setState((state) => ({
      ...state,
      scopes: state.scopes.length ? state.scopes : [{ id: "activity", name: "Activity", pens: [] }],
      entries: [],
    }))
  })

  it("renders the window, group bar, view changer, and shared range once", () => {
    render(<EnhancedAnalytics />)

    expect(screen.getByText("Analytics")).toBeInTheDocument()
    expect(screen.getByLabelText("Analytics date range")).toHaveTextContent("last 30 days")
    const groups = screen.getByRole("tablist", { name: "Analytics groups" })
    expect(within(groups).getByRole("tab", { name: "Behavior" })).toHaveAttribute("aria-selected", "true")
    expect(within(groups).getByRole("tab", { name: "Time" })).toBeInTheDocument()
    expect(within(groups).getByRole("tab", { name: "Accuracy" })).toBeInTheDocument()
    expect(within(groups).getByRole("tab", { name: "Meta" })).toBeInTheDocument()
    expect(within(groups).getByRole("tab", { name: "Library" })).toBeInTheDocument()
    const views = screen.getByRole("tablist", { name: "Analytics views" })
    expect(within(views).getByRole("tab", { name: "Habits" })).toHaveAttribute("aria-selected", "true")
    expect(within(views).getByRole("tab", { name: "Streaks" })).toBeInTheDocument()
    expect(screen.queryByText("Item Types live in Settings")).not.toBeInTheDocument()
    expect(screen.getByText(/Nothing in the last 30 days to total yet/)).toBeInTheDocument()
    expect(screen.getByText("Daily habit completion heatmap")).toBeInTheDocument()
  })

  it("restores Item Types as a Library view", async () => {
    const user = userEvent.setup()
    render(<EnhancedAnalytics />)

    await user.click(screen.getByRole("tab", { name: "Library" }))
    expect(screen.getByRole("tab", { name: "Item Types" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByTestId("item-types-library")).toBeInTheDocument()
    expect(screen.getAllByText(/Settings still edits schemas/).length).toBeGreaterThan(0)
  })

  it("opens Overcommit under Behavior with an honest empty canvas", async () => {
    const user = userEvent.setup()
    render(<EnhancedAnalytics />)

    await user.click(screen.getByRole("tab", { name: "Overcommit" }))
    expect(screen.getByTestId("overcommit-view")).toBeInTheDocument()
    expect(screen.getByText(/No day-pushes or logged minutes in the last 30 days/)).toBeInTheDocument()
  })

  it("opens Cross-section under Meta with an honest empty canvas", async () => {
    const user = userEvent.setup()
    render(<EnhancedAnalytics />)

    await user.click(screen.getByRole("tab", { name: "Meta" }))
    await user.click(screen.getByRole("tab", { name: "Cross-section" }))
    expect(screen.getByTestId("cross-section")).toBeInTheDocument()
    expect(screen.getByText(/Nothing recorded in the last 30 days to align yet/)).toBeInTheDocument()
  })

  it("remembers the shared date range across tabs", async () => {
    const user = userEvent.setup()
    render(<EnhancedAnalytics />)

    await user.click(screen.getByRole("button", { name: "7 days" }))
    expect(screen.getByLabelText("Analytics date range")).toHaveTextContent("last 7 days")
    expect(localStorage.getItem(ANALYTICS_RANGE_STORAGE_KEY)).toBe("7")

    await user.click(screen.getByRole("tab", { name: "Time" }))
    await user.click(screen.getByRole("tab", { name: "Sleep" }))
    expect(screen.getByLabelText("Analytics date range")).toHaveTextContent("last 7 days")
    expect(screen.getByText(/1 of 7 nights tracked|0 of 7 nights tracked/)).toBeInTheDocument()
  })

  it("opens a custom inclusive window and labels it as the dates", async () => {
    const user = userEvent.setup()
    render(<EnhancedAnalytics />)
    await user.click(screen.getByRole("button", { name: "Custom" }))
    const from = screen.getByLabelText("From date")
    const to = screen.getByLabelText("To date")
    fireEvent.change(from, { target: { value: "2026-08-01" } })
    fireEvent.change(to, { target: { value: "2026-09-21" } })
    expect(screen.getByLabelText("Analytics date range")).toHaveTextContent("2026-08-01 – 2026-09-21")
  })

  it("switches to the Points tab and keeps empty charts honest", async () => {
    const user = userEvent.setup()
    render(<EnhancedAnalytics />)

    await user.click(screen.getByRole("tab", { name: "Points" }))

    expect(screen.getByText("Points (last 30 days)")).toBeInTheDocument()
    expect(screen.getByText("Cumulative points")).toBeInTheDocument()
    expect(screen.getByText("Top point earners")).toBeInTheDocument()
    expect(screen.getByText("Complete tasks to earn points.")).toBeInTheDocument()
    expect(screen.getByText("No points in the last 30 days.")).toBeInTheDocument()
  })

  it("shows the tracking distribution and hides untracked time by default", async () => {
    const user = userEvent.setup()
    const todayKey = formatLocalDateKey(new Date())

    useTimeTrackingStore.setState({
      scopes: [
        {
          id: "activity",
          name: "Activity",
          pens: [{ id: "act-work", name: "Work", color: "#2563eb" }],
        },
      ],
      entries: [{ id: "e1", date: todayKey, scopeId: "activity", penId: "act-work", startMin: 540, endMin: 570 }],
    })

    render(<EnhancedAnalytics />)
    await user.click(screen.getByRole("tab", { name: "Time" }))
    await user.click(screen.getByRole("tab", { name: "Tracking" }))

    expect(screen.getAllByText("Work").length).toBeGreaterThan(0)
    expect(screen.getAllByText("30m").length).toBeGreaterThan(0)
    expect(screen.queryByText("Untracked")).not.toBeInTheDocument()
  })

  it("includes untracked time when the toggle is enabled", async () => {
    const user = userEvent.setup()
    const todayKey = formatLocalDateKey(new Date())

    useTimeTrackingStore.setState({
      scopes: [
        {
          id: "activity",
          name: "Activity",
          pens: [{ id: "act-work", name: "Work", color: "#2563eb" }],
        },
      ],
      entries: [{ id: "e1", date: todayKey, scopeId: "activity", penId: "act-work", startMin: 540, endMin: 570 }],
    })

    render(<EnhancedAnalytics />)
    await user.click(screen.getByRole("tab", { name: "Time" }))
    await user.click(screen.getByRole("tab", { name: "Tracking" }))
    await user.click(screen.getByLabelText("Show untracked"))

    expect(screen.getAllByText("Untracked").length).toBeGreaterThan(0)
  })

  it("breaks a pen down by its variants when a row is clicked", async () => {
    const user = userEvent.setup()
    const todayKey = formatLocalDateKey(new Date())

    useTimeTrackingStore.setState({
      scopes: [
        {
          id: "activity",
          name: "Activity",
          pens: [
            {
              id: "act-social",
              name: "Hanging out",
              color: "#ec4899",
              variantLabel: "Who with?",
              variants: [
                { id: "v-elijah", name: "Elijah", color: "#2563eb" },
                { id: "v-rebecca", name: "Rebecca", color: "#10b981" },
              ],
            },
          ],
        },
      ],
      entries: [
        {
          id: "e1",
          date: todayKey,
          scopeId: "activity",
          penId: "act-social",
          startMin: 540,
          endMin: 600,
          variantIds: ["v-elijah"],
        },
        {
          id: "e2",
          date: todayKey,
          scopeId: "activity",
          penId: "act-social",
          startMin: 600,
          endMin: 660,
          variantIds: ["v-elijah", "v-rebecca"],
        },
      ],
    })

    render(<EnhancedAnalytics />)
    await user.click(screen.getByRole("tab", { name: "Time" }))
    await user.click(screen.getByRole("tab", { name: "Tracking" }))
    await user.click(screen.getAllByRole("button", { name: /^Break down Hanging out/ })[0])

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getAllByText("Elijah").length).toBeGreaterThan(0)
    expect(within(dialog).getAllByText("Elijah + Rebecca").length).toBeGreaterThan(0)
    expect(within(dialog).getByText(/Blocks in/)).toBeInTheDocument()
    expect(dialog.className).toMatch(/sm:max-w-3xl/)

    await user.click(within(dialog).getByRole("button", { name: "Reach" }))
    expect(within(dialog).getAllByText("100.0%").length).toBeGreaterThan(0)
    expect(within(dialog).getByText("50.0%")).toBeInTheDocument()
  })
})
