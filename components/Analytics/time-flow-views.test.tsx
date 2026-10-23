/**
 * Transitions, Context switch, Text events / spans, Log, Operations — render
 * with real switches so the new plates mount. Math is in time-flow-stats.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useTaskStore } from "@/lib/task-store"
import { useAnalyticsRangeStore } from "./analytics-range-store"
import { TransitionsView } from "./TransitionsView"
import { ContextSwitchHeatmap } from "./ContextSwitchHeatmap"
import { TextEventsView, TextSpansView } from "./TextPipelineView"
import { LogEventsView } from "./LogEventsView"
import { OperationsAnalytics } from "./OperationsAnalytics"

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ScatterChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  Scatter: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
}))

const pens = ["a", "b", "c"].map((id) => ({ id, name: `Pen ${id}`, color: "#0f766e" }))

function seed() {
  const entries = []
  for (let d = 0; d < 9; d++) {
    const date = formatLocalDateKey(new Date(Date.now() - d * 86400000))
    const seq = ["a", "b", "a", "c", "b", "a"]
    seq.forEach((penId, i) =>
      entries.push({ id: `${date}-${i}`, date, scopeId: "s", penId, startMin: 540 + i * 60, endMin: 590 + i * 60 }),
    )
    entries.push({
      id: `${date}-t`,
      date,
      scopeId: "s",
      penId: "c",
      startMin: 1200,
      endMin: 1260,
      generatedBy: { kind: "text", id: "sms" },
    })
    entries.push({
      id: `${date}-ti`,
      date,
      scopeId: "s",
      penId: "a",
      kind: "instant",
      title: "switch to reading",
      startMin: 1300,
      endMin: 1300,
      generatedBy: { kind: "text", id: "sms" },
    })
  }
  useTimeTrackingStore.setState((s) => ({ ...s, scopes: [{ ...(s.scopes[0] ?? {}), id: "s", name: "Main", pens }], entries }) as never)
}

describe("time-flow views", () => {
  beforeEach(() => {
    useAnalyticsRangeStore.setState({ days: 30, hydrated: true })
    useTaskStore.setState({ tasks: [], lists: [], folders: [] })
    seed()
  })

  it("Transitions shows landing/leaving and return loops", () => {
    render(<TransitionsView />)
    expect(screen.getByText("Where you land, where you leave")).toBeInTheDocument()
    expect(screen.getByText("Return loops")).toBeInTheDocument()
    expect(screen.getAllByText(/Pen a ⇄ Pen b/).length).toBeGreaterThan(0)
  })

  it("Context switch shows the rate clock", () => {
    render(<ContextSwitchHeatmap />)
    expect(screen.getByLabelText("Switches per hour, 24-hour clock")).toBeInTheDocument()
    expect(screen.getByText("Per waking hour")).toBeInTheDocument()
  })

  it("Text events and spans mount the unit grid and era bars", () => {
    render(<TextEventsView />)
    expect(screen.getByText("Every event, one square")).toBeInTheDocument()
    render(<TextSpansView />)
    expect(screen.getByText("Spans on the clock")).toBeInTheDocument()
  })

  it("Log and Operations stay honest when empty", () => {
    render(<LogEventsView />)
    expect(screen.getByTestId("log-events-view")).toBeInTheDocument()
    render(<OperationsAnalytics />)
    expect(screen.getByText(/No operations yet/)).toBeInTheDocument()
  })
})
