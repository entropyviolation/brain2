/**
 * components/header-now-box.test.tsx — header "now" well for live timers
 */
import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { OPERATION_ATTR, OPERATION_TYPE_ID } from "@/lib/operation-types"
import {
  startWorkingOnOperation,
  stopWorkingOnOperation,
} from "@/lib/operation-work-session"
import { startPenColorSession } from "@/lib/pen-color-session"
import { HeaderNowBox } from "./header-now-box"

function seedOperation(id = "op_1", name = "Foxtide rebuild"): void {
  useTaskStore.getState().addTask({
    id,
    description: name,
    type: OPERATION_TYPE_ID,
    stage: "clarified",
    createdAt: new Date("2026-01-01"),
    completed: false,
    lists: [],
    attributes: { [OPERATION_ATTR.stage]: "active" },
    links: [],
  })
}

describe("HeaderNowBox", () => {
  beforeEach(() => {
    resetAllStores()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 5, 20, 14, 30, 0))
    seedOperation()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("is absent when no timer is running", () => {
    const { container } = render(<HeaderNowBox />)
    expect(screen.queryByTestId("header-now-box")).not.toBeInTheDocument()
    expect(container).toBeEmptyDOMElement()
  })

  it("shows an operations session with elapsed, Stop, and Pause; pause holds; stop clears", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    startWorkingOnOperation("op_1")

    render(<HeaderNowBox />)

    const box = screen.getByTestId("header-now-box")
    expect(box).toBeInTheDocument()
    expect(screen.getByRole("group", { name: /now/i })).toBe(box)
    expect(screen.getByText("Foxtide rebuild")).toBeInTheDocument()
    expect(screen.getByText("0:00")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Stop Foxtide rebuild/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Pause Foxtide rebuild/i })).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(5_000)
    })
    expect(screen.getByText("0:05")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Pause Foxtide rebuild/i }))
    expect(screen.getByRole("button", { name: /Resume Foxtide rebuild/i })).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(10_000)
    })
    expect(screen.getByText("0:05")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Resume Foxtide rebuild/i }))
    expect(screen.getByRole("button", { name: /Pause Foxtide rebuild/i })).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(3_000)
    })
    expect(screen.getByText("0:08")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Stop Foxtide rebuild/i }))
    expect(screen.queryByTestId("header-now-box")).not.toBeInTheDocument()
  })

  it("shows both live sessions in one now well", async () => {
    startWorkingOnOperation("op_1")
    startPenColorSession("act-exercise")

    render(<HeaderNowBox />)

    expect(screen.getByTestId("header-now-box")).toBeInTheDocument()
    expect(screen.getByText("Foxtide rebuild")).toBeInTheDocument()
    expect(screen.getByText("Exercise")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /^Stop /i })).toHaveLength(2)
    expect(screen.getAllByRole("button", { name: /^Pause /i })).toHaveLength(2)

    await act(async () => {
      stopWorkingOnOperation()
    })
    expect(screen.getByText("Exercise")).toBeInTheDocument()
    expect(screen.queryByText("Foxtide rebuild")).not.toBeInTheDocument()
  })
})
