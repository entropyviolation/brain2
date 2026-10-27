import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useGoalsStore } from "@/lib/goals-store"
import { GoalsTracker } from "./goals-tracker"

function mockPhone(reduced = false) {
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches: query.includes("720") ? true : query.includes("reduce") ? reduced : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }))
}

describe("Goals phone", () => {
  beforeEach(() => {
    resetAllStores()
    mockPhone()
    useGoalsStore.setState({
      goals: [
        {
          id: "goal-test",
          title: "Read 3 books",
          type: "count",
          target: 3,
          current: 1,
          unit: "books",
          periodKind: "year",
          objectiveIds: ["obj-read-a-lot"],
          points: 25,
          completed: false,
          createdAt: new Date("2026-06-01"),
        },
      ],
    })
  })

  it("renders the phone tree and leaves the fascia unmounted", () => {
    const { container } = render(<GoalsTracker />)
    expect(container.querySelector("[data-goals-layout='phone']")).toBeTruthy()
    expect(container.querySelector(".gol-fascia")).toBeNull()
    expect(container.querySelector(".gol-desk-plate")).toBeNull()
    expect(screen.queryByText("Objectives & Goals")).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 1, name: "Goals" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 3, name: "Read 3 books" })).toBeInTheDocument()
  })

  it("increments goal progress from the row", async () => {
    const user = userEvent.setup()
    render(<GoalsTracker />)
    await user.click(screen.getByRole("button", { name: "+1" }))
    expect(screen.getByText(/2 \/ 3 books/)).toBeInTheDocument()
  })

  it("changes the objective period from the segmented control", async () => {
    const user = userEvent.setup()
    render(<GoalsTracker />)
    expect(screen.getByText("0/3 this week")).toBeInTheDocument()
    const periods = screen.getByRole("group", { name: "Objective period" })
    await user.click(within(periods).getByRole("button", { name: "Day" }))
    expect(screen.getByText("0/3 this day")).toBeInTheDocument()
  })

  it("swipes the objectives pager to the next period", async () => {
    render(<GoalsTracker />)
    const pager = screen.getByTestId("goals-phone-pager")
    fireEvent.pointerDown(pager, { pointerId: 1, button: 0, clientX: 220, clientY: 40 })
    fireEvent.pointerMove(pager, { pointerId: 1, clientX: 140, clientY: 42 })
    fireEvent.pointerUp(pager, { pointerId: 1, clientX: 140, clientY: 42 })
    await waitFor(() => expect(screen.getByText("0/3 this month")).toBeInTheDocument())
  })

  it("opens an objective in a sheet with archive and review", async () => {
    const user = userEvent.setup()
    render(<GoalsTracker />)
    await user.click(screen.getByRole("button", { name: /All objectives/ }))
    await user.click(screen.getByRole("button", { name: /Read a lot/ }))
    expect(screen.getByRole("dialog", { name: "Objective" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save review" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument()
  })

  it("opens the goal editor with delete", async () => {
    const user = userEvent.setup()
    render(<GoalsTracker />)
    await user.click(screen.getByRole("button", { name: "Edit" }))
    const dialog = screen.getByRole("dialog", { name: "Edit Goal" })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Delete Goal" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument()
  })

  it("marks reduced motion on the phone root", () => {
    mockPhone(true)
    const { container } = render(<GoalsTracker />)
    expect(container.querySelector(".gol-phone.is-reduced")).toBeTruthy()
  })
})
