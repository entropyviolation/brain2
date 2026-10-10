/**
 * Draft vs done, yesterday's unfinished rows, and the Est. flag.
 */
import { fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { usePointsStore } from "@/lib/points-store"
import { useReviewsStore } from "@/lib/reviews-store"
import { getWeekString } from "@/lib/date-utils"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import { ReviewDialog } from "./reviews"

function task(partial: Partial<Task> & { id: string }): Task {
  return {
    description: partial.description ?? partial.id,
    stage: "scheduled",
    createdAt: new Date(2026, 9, 1, 12, 0, 0),
    completed: false,
    lists: [],
    ...partial,
  }
}

describe("ReviewDialog drafts and date scope", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 9, 5, 20, 0, 0))
    resetAllStores()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("saves a draft on close and does not award points or mark the night done", () => {
    const onClose = vi.fn()
    const view = render(<ReviewDialog open period="day" periodKey="2026-10-04" onClose={onClose} />)
    fireEvent.change(screen.getByPlaceholderText("A short recap…"), { target: { value: "kept the draft" } })
    fireEvent.click(within(document.querySelector(".hpp-actions")!).getByRole("button", { name: "Close" }))
    const saved = useReviewsStore.getState().getReview("day", "2026-10-04")
    expect(saved?.summary).toBe("kept the draft")
    expect(saved?.endCompleted).toBe(false)
    expect(usePointsStore.getState().pointsHistory).toEqual([])
    expect(onClose).toHaveBeenCalled()
    view.unmount()

    render(<ReviewDialog open period="day" periodKey="2026-10-04" onClose={() => {}} />)
    expect(screen.getByPlaceholderText("A short recap…")).toHaveValue("kept the draft")
  })

  it("awards section points only when the night is submitted", () => {
    render(<ReviewDialog open period="day" periodKey="2026-10-04" onClose={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText("A short recap…"), { target: { value: "done for the night" } })
    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }))
    const saved = useReviewsStore.getState().getReview("day", "2026-10-04")
    expect(saved?.endCompleted).toBe(true)
    const row = usePointsStore.getState().pointsHistory.find((entry) => entry.taskId === "ritual:day:2026-10-04")
    expect(row?.points).toBeGreaterThanOrEqual(30)
  })

  it("lists unfinished work for the ritual day after it has rolled onto today", () => {
    useTaskStore.getState().addTask(
      task({
        id: "rolled",
        description: "Letter still open",
        scheduledDate: new Date(2026, 9, 5, 9, 0, 0),
        schedulePlacements: [{ period: "day", value: "2026-10-04" }],
      }),
    )
    render(<ReviewDialog open period="day" periodKey="2026-10-04" onClose={() => {}} />)
    expect(screen.getByText(/Unfinished, scheduled items \(1\)/)).toBeInTheDocument()
    expect(screen.queryByText(/Nothing left unfinished/)).not.toBeInTheDocument()
  })

  it("persists the Est. flag on an assumed time", () => {
    useTaskStore.getState().addTask(
      task({
        id: "assumed",
        description: "Water",
        completed: true,
        completedDate: new Date(2026, 9, 4, 18, 0, 0),
        actualDuration: 20,
        estimates: [
          {
            field: "actualDuration",
            kind: "anchor",
            basis: "assumed length",
            generatedAt: "2026-10-04T18:00:00.000Z",
          },
        ],
      }),
    )
    const view = render(<ReviewDialog open period="day" periodKey="2026-10-04" onClose={() => {}} />)
    fireEvent.click(screen.getByRole("checkbox", { name: "Est. Water" }))
    expect(useTaskStore.getState().tasks.find((row) => row.id === "assumed")?.timeRough).toBe(true)
    view.unmount()
    render(<ReviewDialog open period="day" periodKey="2026-10-04" onClose={() => {}} />)
    expect(screen.getByRole("checkbox", { name: "Est. Water" })).toBeChecked()
  })

  it("stores Other text and drops a pushed task from the week being reviewed", () => {
    const week = getWeekString(new Date(2026, 8, 28))
    useTaskStore.getState().addTask(
      task({ id: "clothes", description: "sort my clothes", scheduledWeek: week }),
    )
    const view = render(<ReviewDialog open period="week" periodKey={week} onClose={() => {}} />)
    fireEvent.click(screen.getByRole("combobox", { name: "Why blocked? unfinished items" }))
    fireEvent.click(screen.getByRole("option", { name: "Other" }))
    fireEvent.change(screen.getByLabelText("Other reason for unfinished items"), {
      target: { value: "the rain" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Push to next week" }))
    expect(screen.queryByText("sort my clothes")).not.toBeInTheDocument()
    const moved = useTaskStore.getState().tasks.find((row) => row.id === "clothes")
    expect(moved?.scheduledWeek).toBe(getWeekString(new Date(2026, 9, 5)))
    fireEvent.click(within(document.querySelector(".hpp-actions")!).getByRole("button", { name: "Close" }))
    const saved = useReviewsStore.getState().getReview("week", week)
    expect(saved?.blockedReasons?.clothes).toEqual({ reason: "other", note: "the rain" })
    expect(saved?.pushedTaskIds).toContain("clothes")
    expect(saved?.endCompleted).toBe(false)
    expect(usePointsStore.getState().pointsHistory).toEqual([])
    view.unmount()
  })

  it("restores a reflection draft and only counts it when the ritual is submitted", () => {
    const week = getWeekString(new Date(2026, 8, 28))
    const view = render(<ReviewDialog open period="week" periodKey={week} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/best thing that happened this past week/i), {
      target: { value: "the letter" },
    })
    fireEvent.click(within(document.querySelector(".hpp-actions")!).getByRole("button", { name: "Close" }))
    expect(useReviewsStore.getState().getReview("week", week)?.arc?.wins).toBe("the letter")
    expect(usePointsStore.getState().pointsHistory).toEqual([])
    view.unmount()
    render(<ReviewDialog open period="week" periodKey={week} onClose={() => {}} />)
    expect(screen.getByLabelText(/best thing that happened this past week/i)).toHaveValue("the letter")
    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }))
    const awarded = usePointsStore.getState().pointsHistory
    expect(awarded).toHaveLength(1)
    expect(awarded[0]?.points).toBeGreaterThanOrEqual(40)
  })
})
