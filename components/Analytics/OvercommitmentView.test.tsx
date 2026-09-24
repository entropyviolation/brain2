/**
 * Overcommit view — sentence + n, Wave 1 honesty, Lists jump.
 */
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { formatLocalDateKey } from "@/lib/date-utils"
import { OVERCOMMITMENT_SAMPLE_FLOOR } from "@/lib/overcommitment"
import type { Task } from "@/lib/types"
import { OvercommitmentView } from "./OvercommitmentView"
import { SAMPLE_FLOORS } from "./analytics-range"
import { useAnalyticsRangeStore } from "./analytics-range-store"

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div data-testid="chart">{children}</div>,
  ComposedChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
}))

function task(overrides: Partial<Task>): Task {
  return {
    id: "t1",
    description: "Task",
    stage: "active",
    createdAt: new Date(),
    completed: false,
    lists: ["list-1"],
    ...overrides,
  }
}

function recentKeys(n: number): string[] {
  const keys: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    keys.push(formatLocalDateKey(d))
  }
  return keys
}

describe("OvercommitmentView", () => {
  beforeEach(() => {
    resetLocalStorage()
    useAnalyticsRangeStore.setState({ days: 30, hydrated: true })
    useTaskStore.setState({ tasks: [], lists: [], folders: [] })
  })

  it("keeps the chart frame and one sentence when there is no series", () => {
    render(<OvercommitmentView />)
    expect(screen.getByText(/No day-pushes or logged minutes in the last 30 days/)).toBeInTheDocument()
    expect(screen.queryByText(/overcommitment early warning/)).not.toBeInTheDocument()
  })

  it("watermarks a thin sample instead of presenting it as a finding", () => {
    const keys = recentKeys(2)
    useTaskStore.setState({
      tasks: [
        task({
          id: "thin",
          timeLogs: keys.map((date, i) => ({ id: `l${i}`, date, durationMinutes: 40 + i * 20 })),
        }),
      ],
    })
    render(<OvercommitmentView />)
    expect(
      screen.getByText(
        `n = 2 in the last 30 days — too thin to treat as a finding (need ${SAMPLE_FLOORS.overcommitment}).`,
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(/overcommitment early warning|No overcommitment signal/)).not.toBeInTheDocument()
  })

  it("shows a sentence, n, and Open in Lists once the sample clears the floor", () => {
    const keys = recentKeys(OVERCOMMITMENT_SAMPLE_FLOOR + 1)
    useTaskStore.setState({
      tasks: [
        task({
          id: "load",
          description: "Heavy",
          daysPushed: keys.length,
          scheduledDate: new Date(),
          timeLogs: keys.map((date, i) => ({
            id: `l${i}`,
            date,
            durationMinutes: 20 + i * 12,
          })),
        }),
      ],
    })
    render(<OvercommitmentView />)
    expect(screen.getByText(/overcommitment early warning|No overcommitment signal/)).toBeInTheDocument()
    expect(screen.getByText(/n = \d+ days with pushes or logs/)).toBeInTheDocument()
    expect(screen.getByText(/This does not move your day/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Open 1 item\(s\) in Lists/ })).toBeInTheDocument()
  })
})
