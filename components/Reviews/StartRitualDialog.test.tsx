/**
 * components/Reviews/StartRitualDialog.test.tsx — the start rite walks one step at a time.
 */
import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useReviewsStore } from "@/lib/reviews-store"
import { useTaskStore } from "@/lib/task-store"
import { getWeekString } from "@/lib/date-utils"
import { StartRitualDialog } from "./StartRitualDialog"

describe("StartRitualDialog steps", () => {
  beforeEach(() => {
    resetAllStores()
    localStorage.clear()
  })

  it("opens on the undone step and saves progress when moving on", () => {
    render(<StartRitualDialog open period="month" periodKey="2026-10" onClose={() => {}} />)
    expect(screen.getByRole("heading", { name: "Undone from last month" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /^Go to Priorities/ }))
    expect(screen.getByRole("heading", { name: "Priorities" })).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText(/What matters most/), { target: { value: "the book" } })
    fireEvent.click(screen.getByRole("button", { name: /^Next/ }))
    const saved = useReviewsStore.getState().getStartRitual("month", "2026-10")
    expect(saved?.priorities).toBe("the book")
    expect(saved?.completed).toBe(false)
  })

  it("Finish on the last step submits the start ritual", () => {
    const onClose = vi.fn()
    render(<StartRitualDialog open period="week" periodKey="2026-10-12_2026-10-18" onClose={onClose} />)
    fireEvent.click(screen.getByRole("button", { name: /^Go to Gratitude/ }))
    fireEvent.change(screen.getByPlaceholderText("I'm grateful for…"), { target: { value: "rain" } })
    fireEvent.click(screen.getByRole("button", { name: "Finish" }))
    expect(useReviewsStore.getState().getStartRitual("week", "2026-10-12_2026-10-18")?.completed).toBe(true)
    expect(onClose).toHaveBeenCalled()
  })
})

describe("StartRitualDialog look ahead", () => {
  beforeEach(() => {
    resetAllStores()
    localStorage.clear()
  })

  it("week start pulls month work onto the week and lists overdue work", () => {
    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const week = getWeekString(now)
    const add = (extra: Record<string, unknown>) =>
      useTaskStore.getState().addTask({ stage: "scheduled", createdAt: now, completed: false, lists: [], ...extra } as never)
    add({ id: "m", description: "Plan the trip", scheduledMonth: month, importance: 4 })
    add({ id: "o", description: "Renew passport", deadline: new Date(now.getTime() - 3 * 86_400_000) })
    render(<StartRitualDialog open period="week" periodKey={week} onClose={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: /^Go to This month/ }))
    const row = screen.getByText("Plan the trip").closest("li")!
    fireEvent.click(within(row).getByRole("button", { name: "Do this week" }))
    expect(useTaskStore.getState().tasks.find((t) => t.id === "m")?.scheduledWeek).toBe(week)
    fireEvent.click(screen.getByRole("button", { name: /^Go to Overdue/ }))
    expect(screen.getByText("Renew passport")).toBeInTheDocument()
  })
})
