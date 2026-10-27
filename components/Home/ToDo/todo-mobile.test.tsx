import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { resetTodoPrefsForTests } from "./todo-prefs"
import { TodoPanel } from "./todo-panel"

describe("TodoPanel phone", () => {
  const today = new Date("2026-06-20T12:00:00")

  beforeEach(() => {
    vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
      matches: /max-width:\s*767px/.test(query) || /prefers-reduced-motion:\s*reduce/.test(query),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }))
    vi.useFakeTimers()
    vi.setSystemTime(today)
    resetAllStores()
    resetTodoPrefsForTests()
    useTaskStore.getState().setTasks([
      {
        id: "todo-1",
        description: "Finish slides",
        stage: "scheduled",
        createdAt: today,
        completed: false,
        scheduledDate: today,
        lists: [],
        urgency: 5,
        importance: 5,
        estimatedDuration: 60,
        cognitiveLoad: 3,
        dependencies: [],
        context: "@work",
        entropy: 0.5,
        rewardValue: 10,
        allowPartialCompletion: false,
        minimumChunkSize: 15,
      },
    ])
  })

  afterEach(() => {
    resetTodoPrefsForTests()
    vi.useRealTimers()
  })

  it("mounts the phone list and leaves the fascia off", () => {
    const { container } = render(<TodoPanel />)
    expect(container.querySelector(".todo-ios")).toHaveAttribute("data-todo-layout", "phone")
    expect(container.querySelector(".todo-window")).toBeNull()
    expect(container.querySelector(".todo-fascia")).toBeNull()
    expect(container.querySelector(".todo-desk-plate")).toBeNull()
    expect(screen.getByRole("tab", { name: "Day" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByText("Finish slides")).toBeInTheDocument()
    expect(container.querySelector("[data-ui-name='Assigned composer']")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Push Finish slides" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Missed Finish slides" })).toBeInTheDocument()
  })

  it("completes from the row circle and adds from the composer", () => {
    render(<TodoPanel />)
    fireEvent.click(screen.getByRole("button", { name: "Done, Finish slides" }))
    expect(useTaskStore.getState().tasks.find((task) => task.id === "todo-1")?.completed).toBe(true)

    fireEvent.change(screen.getByLabelText("Add a task"), { target: { value: "Call the studio" } })
    fireEvent.click(screen.getByRole("button", { name: "Add" }))
    expect(useTaskStore.getState().tasks.some((task) => task.description === "Call the studio")).toBe(true)
  })

  it("opens the drawer sheet without becoming item detail", () => {
    render(<TodoPanel />)
    fireEvent.click(screen.getByRole("button", { name: "Finish slides" }))
    const sheet = screen.getByRole("dialog", { name: "Finish slides" })
    expect(sheet).toHaveTextContent("Working now")
    expect(sheet).toHaveTextContent("Needs…")
    expect(screen.queryByRole("dialog", { name: "Item" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(screen.queryByRole("dialog", { name: "Finish slides" })).toBeNull()
  })

  it("steps the day from the nameplate", () => {
    render(<TodoPanel />)
    fireEvent.click(screen.getByRole("button", { name: "Next day" }))
    expect(screen.getByLabelText(/Swipe sideways for the next period/)).toHaveTextContent("Jun 21")
  })
})
