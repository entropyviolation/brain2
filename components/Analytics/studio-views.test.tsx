/**
 * Studio views — empty / thin honesty for the new rooms.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useHabitsStore } from "@/lib/habits-store"
import { usePointsStore } from "@/lib/points-store"
import { EnhancedAnalytics } from "./enhanced-analytics"
import { CircadianView } from "./CircadianView"
import { PlacesView } from "./PlacesView"
import { MoodFieldView } from "./MoodFieldView"
import { VelocityView } from "./VelocityView"
import { CycleView } from "./CycleView"
import { GoalsAnalytics } from "./GoalsAnalytics"
import { OperationsAnalytics } from "./OperationsAnalytics"
import { ListsAreasView } from "./ListsAreasView"
import { AttributesView } from "./AttributesView"
import { TagsView, StagesView, WeightView } from "./LibraryCuts"
import { Observatory } from "./Observatory"
import { CorrelationExplorer } from "./CorrelationExplorer"
import { DiversityView } from "./DiversityView"
import { TransitionsView } from "./TransitionsView"
import { SpectrumView } from "./SpectrumView"
import { useAnalyticsRangeStore } from "./analytics-range-store"
import { SAMPLE_FLOORS } from "./analytics-range"
import { ViolinHistogram, RidgelineChart } from "./studio-plots"
import { correlate } from "@/lib/metrics"

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div data-testid="chart">{children}</div>,
  BarChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  LineChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Line: () => null,
  ScatterChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Scatter: () => null,
  XAxis: () => null,
  YAxis: () => null,
  ZAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
  ComposedChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: ReactNode }) => <div data-testid="pie">{children}</div>,
  Pie: () => null,
  Cell: () => null,
  Legend: () => null,
}))

describe("studio empty rooms", () => {
  beforeEach(() => {
    resetLocalStorage()
    useAnalyticsRangeStore.setState({ days: 30, hydrated: true })
    useTaskStore.setState({ tasks: [], lists: [], folders: [] })
    useTimeTrackingStore.setState((s) => ({ ...s, entries: [] }))
    useHabitsStore.setState({ tasks: [], weeklyData: {}, categories: [] })
    usePointsStore.setState({ pointsHistory: [] })
  })

  it("Circadian keeps the frame when nothing is painted", () => {
    render(<CircadianView />)
    expect(screen.getByTestId("circadian-view")).toBeInTheDocument()
    expect(screen.getByText(/Nothing painted/)).toBeInTheDocument()
  })

  it("Places stays empty without Location paint", () => {
    render(<PlacesView />)
    expect(screen.getByTestId("places-view")).toBeInTheDocument()
    expect(screen.getByText(/Nothing painted in Location|No Location scope yet/)).toBeInTheDocument()
  })

  it("Mood field stays empty without Mood paint", () => {
    render(<MoodFieldView />)
    expect(screen.getByTestId("mood-field")).toBeInTheDocument()
    expect(screen.getByText(/Nothing painted in Mood|No Mood scope yet/)).toBeInTheDocument()
  })

  it("Velocity, Cycle, Goals, Operations, Lists, Attributes stay honest when empty", () => {
    render(<VelocityView />)
    expect(screen.getByText(/No completions or points/)).toBeInTheDocument()
    render(<CycleView />)
    expect(screen.getByText(/No items yet to measure stall/)).toBeInTheDocument()
    render(<GoalsAnalytics />)
    expect(screen.getByTestId("goals-analytics")).toBeInTheDocument()
    render(<OperationsAnalytics />)
    expect(screen.getByText(/No operations yet/)).toBeInTheDocument()
    render(<ListsAreasView />)
    expect(screen.getByText(/No lists with items yet/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Size by items" })).toBeInTheDocument()
    render(<AttributesView />)
    expect(screen.getByTestId("attributes-view")).toBeInTheDocument()
    render(<TagsView />)
    expect(screen.getByText(/No tags on items yet/)).toBeInTheDocument()
    render(<StagesView />)
    expect(screen.getByTestId("stages-view")).toBeInTheDocument()
    render(<WeightView />)
    expect(screen.getByText(/No importance, cognitive load, or entropy/)).toBeInTheDocument()
    render(<DiversityView />)
    expect(screen.getByTestId("diversity-view")).toBeInTheDocument()
    expect(screen.getByText(/Nothing painted|No tracking scopes yet/)).toBeInTheDocument()
    render(<TransitionsView />)
    expect(screen.getByTestId("transitions-view")).toBeInTheDocument()
    expect(screen.getByText(/No pen changes|No tracking scopes yet/)).toBeInTheDocument()
    render(<SpectrumView />)
    expect(screen.getByTestId("spectrum-view")).toBeInTheDocument()
    expect(screen.getByText(/No habits yet/)).toBeInTheDocument()
  })

  it("Observatory withholds a finding when overlap is thin", () => {
    render(<Observatory />)
    expect(screen.getByTestId("observatory")).toBeInTheDocument()
    expect(screen.getByText(/Nothing recorded in the last 30 days to connect yet/)).toBeInTheDocument()
    expect(screen.queryByText(/r = /)).not.toBeInTheDocument()
  })
})

describe("studio shell navigates new rooms", () => {
  beforeEach(() => {
    resetLocalStorage()
    useAnalyticsRangeStore.setState({ days: 30, hydrated: true })
  })

  it("opens Observatory under Meta and Velocity under Behavior", async () => {
    const user = userEvent.setup()
    render(<EnhancedAnalytics />)
    await user.click(screen.getByRole("tab", { name: "Meta" }))
    expect(screen.getByRole("tab", { name: "Observatory" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByTestId("observatory")).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Behavior" }))
    await user.click(screen.getByRole("tab", { name: "Velocity" }))
    expect(screen.getByTestId("velocity-view")).toBeInTheDocument()
  })
})

describe("new canvases stay honest when empty", () => {
  it("violin and ridgeline keep the frame", () => {
    render(<ViolinHistogram values={[]} title="Block length" help="duration distribution" />)
    expect(screen.getByText(/No blocks with duration/)).toBeInTheDocument()
    render(
      <RidgelineChart
        ridges={[{ label: "Sun", values: [] }]}
        title="Duration by weekday"
        help="KDE by weekday"
      />,
    )
    expect(screen.getByText(/Nothing to ridge yet/)).toBeInTheDocument()
  })
})

describe("correlation matrix floor", () => {
  it("does not treat n below the floor as a printed r", () => {
    const a = [
      { date: "2026-09-01", value: 1 },
      { date: "2026-09-02", value: 2 },
    ]
    const b = [
      { date: "2026-09-01", value: 2 },
      { date: "2026-09-02", value: 4 },
    ]
    const r = correlate(a, b)
    expect(r.n).toBeLessThan(SAMPLE_FLOORS.correlation)
    render(<CorrelationExplorer />)
    expect(screen.getByText("Correlation")).toBeInTheDocument()
  })
})
