import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useMetricsStore } from "@/lib/metrics-store"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useAnalyticsRangeStore } from "./analytics-range-store"
import { Observatory } from "./Observatory"
import { MetricsTrends } from "./MetricsTrends"
import { CorrelationExplorer } from "./CorrelationExplorer"
import { SpectrumView } from "./SpectrumView"
import { ResearchReportView } from "./ResearchReportView"

vi.mock("recharts", () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>
  const Nil = () => null
  return {
    ResponsiveContainer: Box,
    ComposedChart: Box,
    ScatterChart: Box,
    LineChart: Box,
    BarChart: Box,
    Line: Nil,
    Bar: Nil,
    Scatter: Nil,
    XAxis: Nil,
    YAxis: Nil,
    ZAxis: Nil,
    Tooltip: Nil,
    CartesianGrid: Nil,
    ReferenceDot: Nil,
    ReferenceLine: Nil,
    Cell: Nil,
  }
})

function seedMetrics(days: number) {
  const today = new Date()
  const datapoints = Array.from({ length: days }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    const v = 50 + 30 * Math.sin(i / 2)
    return { id: `m${i}`, at: `${formatLocalDateKey(d)}T09:00`, createdAt: d, values: { joy: v, suffering: 100 - v, alignment: v / 2 + 20 } }
  })
  useMetricsStore.setState({ datapoints })
}

describe("Meta views", () => {
  beforeEach(() => {
    resetLocalStorage()
    useAnalyticsRangeStore.setState({ days: 30, hydrated: true })
    seedMetrics(20)
  })

  it("Metrics shows five small multiples and stats", () => {
    render(<MetricsTrends />)
    expect(screen.getByTestId("metric-multiples")).toBeTruthy()
    expect(screen.getByTestId("metric-stats").textContent).toMatch(/mean/)
  })

  it("Correlation joins metric days and offers the lag plate", () => {
    render(<CorrelationExplorer />)
    expect(screen.getByTestId("correlation-lag")).toBeTruthy()
    fireEvent.change(screen.getByLabelText("Lag in days"), { target: { value: "1" } })
    expect(screen.getByText(/over 19 days/)).toBeTruthy()
  })

  it("Observatory, Spectrum and Research report render without data", () => {
    render(<Observatory />)
    render(<SpectrumView />)
    render(<ResearchReportView />)
    expect(screen.getByTestId("spectrum-rhythm")).toBeTruthy()
    expect(screen.getByTestId("cross-section-tools")).toBeTruthy()
  })
})
