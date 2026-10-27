import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import { CalibrationView } from "./CalibrationView"
import { SAMPLE_FLOORS } from "./analytics-range"
import { useAnalyticsRangeStore } from "./analytics-range-store"

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div data-testid="chart">{children}</div>,
  ScatterChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Scatter: () => null,
  LineChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Line: () => null,
  BarChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  ZAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
  Cell: () => null,
}))

function task(overrides: Partial<Task>): Task {
  return {
    id: "t1",
    description: "Task",
    stage: "completed",
    createdAt: new Date(),
    completed: true,
    lists: ["list-1"],
    estimatedDuration: 60,
    actualDuration: 90,
    completedDate: new Date(),
    ...overrides,
  }
}

describe("CalibrationView", () => {
  beforeEach(() => {
    resetLocalStorage()
    useAnalyticsRangeStore.setState({ days: 30, hydrated: true })
    useTaskStore.setState({ tasks: [], lists: [], folders: [] })
  })

  it("keeps the chart frame and puts one sentence inside when there is no series", () => {
    render(<CalibrationView />)
    expect(screen.getByText(/No calibrated tasks in the last 30 days/)).toBeInTheDocument()
    expect(screen.queryByText(/typically underestimate/)).not.toBeInTheDocument()
  })

  it("watermarks a thin sample instead of presenting it as a finding", () => {
    useTaskStore.setState({
      tasks: [
        task({ id: "a", description: "One" }),
        task({ id: "b", description: "Two", estimatedDuration: 30, actualDuration: 30 }),
      ],
    })
    render(<CalibrationView />)
    expect(
      screen.getByText(`n = 2 in the last 30 days — too thin to treat as a finding (need ${SAMPLE_FLOORS.calibration}).`),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Well calibrated|underestimate|overestimate/)).not.toBeInTheDocument()
  })

  it("shows a sentence, n, and a caveat once the sample clears the floor", () => {
    useTaskStore.setState({
      tasks: Array.from({ length: SAMPLE_FLOORS.calibration }, (_, i) =>
        task({
          id: `t${i}`,
          description: `Task ${i}`,
          estimatedDuration: 60,
          actualDuration: 90,
        }),
      ),
    })
    render(<CalibrationView />)
    expect(screen.getByText(/typically underestimate/)).toBeInTheDocument()
    expect(screen.getByText(/n = 8 tasks/)).toBeInTheDocument()
    expect(screen.getByText(/Only tasks with both an estimated duration/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Open 8 item\(s\) in Lists/ })).toBeInTheDocument()
  })
})
