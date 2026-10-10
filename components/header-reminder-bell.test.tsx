import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { addReminder } from "@/lib/reminders"
import { useTaskStore } from "@/lib/task-store"
import { HeaderReminderBell } from "./header-reminder-bell"

const PAST = new Date(2020, 0, 1, 9, 0)

describe("HeaderReminderBell", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("keeps the bell and hides the count when nothing is current", () => {
    render(<HeaderReminderBell onTaskSelect={() => {}} />)
    expect(screen.getByTestId("reminder-bell")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reminders" })).toBeInTheDocument()
    expect(screen.queryByTestId("reminder-bell-count")).not.toBeInTheDocument()
  })

  it("counts persistent current reminders and opens details or dismiss", async () => {
    const user = userEvent.setup()
    const onTaskSelect = vi.fn()
    const nag = addReminder("Call mom", PAST, "once")
    addReminder("Quiet", PAST, "once", { persistent: false })

    render(<HeaderReminderBell onTaskSelect={onTaskSelect} />)

    expect(screen.getByTestId("reminder-bell-count")).toHaveTextContent("1")
    expect(screen.getByRole("button", { name: "Reminders, 1 current" })).toBeInTheDocument()

    await user.click(screen.getByTestId("reminder-bell"))
    expect(screen.getByRole("heading", { name: "Reminders" })).toBeInTheDocument()
    expect(screen.getByText("Call mom")).toBeInTheDocument()
    expect(screen.getByText("Jan 1 · 9:00 AM")).toBeInTheDocument()
    expect(screen.getByText("Source · Reminders")).toBeInTheDocument()
    expect(screen.queryByText("Quiet")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Details" }))
    expect(onTaskSelect).toHaveBeenCalledWith(nag)

    await user.click(screen.getByTestId("reminder-bell"))
    await user.click(screen.getByRole("button", { name: "Dismiss" }))
    expect(screen.getByText("No current reminders.")).toBeInTheDocument()
    expect(screen.queryByTestId("reminder-bell-count")).not.toBeInTheDocument()
    expect(useTaskStore.getState().tasks.some((task) => task.id === nag)).toBe(true)
  })
})
