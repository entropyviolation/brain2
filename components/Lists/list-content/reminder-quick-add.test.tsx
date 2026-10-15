import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { findRemindersList } from "@/lib/reminders"
import { ReminderQuickAdd, nextHalfHourWhenInput } from "./reminder-quick-add"

describe("ReminderQuickAdd", () => {
  beforeEach(() => resetAllStores())

  it("files a timed reminder on the Reminders list", () => {
    const onCancel = () => {}
    render(<ReminderQuickAdd onCancel={onCancel} />)
    fireEvent.change(screen.getByLabelText("New reminder"), { target: { value: "Call mom" } })
    fireEvent.change(screen.getByLabelText("Reminder time"), { target: { value: "2026-10-09T15:30" } })
    fireEvent.change(screen.getByLabelText("Repeat"), { target: { value: "daily" } })
    fireEvent.click(screen.getByRole("button", { name: "Add reminder" }))

    const list = findRemindersList(useTaskStore.getState().lists)
    const reminder = useTaskStore.getState().tasks.find((task) => task.reminder)
    expect(list?.name).toBe("Reminders")
    expect(reminder?.description).toBe("Call mom")
    expect(reminder?.lists).toContain(list?.id)
    expect(reminder?.scheduledTime).toBe("15:30")
    expect(reminder?.reminder?.repeat).toBe("daily")
    expect(reminder?.reminder?.textMe).toBe(true)
    expect(reminder?.reminder?.persistent).toBe(true)
    expect(reminder?.scheduledDate?.getFullYear()).toBe(2026)
    expect(reminder?.scheduledDate?.getMonth()).toBe(9)
    expect(reminder?.scheduledDate?.getDate()).toBe(9)
  })

  it("stores Text me off when that box is cleared", () => {
    render(<ReminderQuickAdd onCancel={() => {}} />)
    expect(screen.getByRole("checkbox", { name: "Text me" })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: "Persistent" })).toBeChecked()
    fireEvent.click(screen.getByRole("checkbox", { name: "Text me" }))
    fireEvent.change(screen.getByLabelText("New reminder"), { target: { value: "Call mom" } })
    fireEvent.change(screen.getByLabelText("Reminder time"), { target: { value: "2026-10-09T15:30" } })
    fireEvent.click(screen.getByRole("button", { name: "Add reminder" }))

    const reminder = useTaskStore.getState().tasks.find((task) => task.reminder)
    expect(reminder?.reminder?.textMe).toBe(false)
    expect(reminder?.reminder?.persistent).toBe(true)
  })

  it("asks for a name and a time", () => {
    render(<ReminderQuickAdd onCancel={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: "Add reminder" }))
    expect(screen.getByText("Name and time are both required.")).toBeInTheDocument()
    expect(useTaskStore.getState().tasks.some((task) => task.reminder)).toBe(false)
  })

  it("stays open and clears after add when stayOpen", () => {
    const onCancel = vi.fn()
    render(
      <ReminderQuickAdd
        chrome="shell"
        stayOpen
        defaultWhen="2026-10-10T16:00"
        onCancel={onCancel}
      />,
    )
    fireEvent.change(screen.getByLabelText("New reminder"), { target: { value: "Stretch" } })
    fireEvent.change(screen.getByLabelText("Reminder time"), { target: { value: "2026-10-10T16:00" } })
    fireEvent.click(screen.getByRole("button", { name: "Add reminder" }))
    expect(useTaskStore.getState().tasks.some((task) => task.description === "Stretch")).toBe(true)
    expect(screen.getByLabelText("New reminder")).toHaveValue("")
    expect(screen.getByLabelText("Reminder time")).toHaveValue("2026-10-10T16:00")
    expect(onCancel).not.toHaveBeenCalled()
  })

  it("rounds default when up to the next half hour", () => {
    expect(nextHalfHourWhenInput(new Date(2026, 9, 10, 10, 0, 12))).toBe("2026-10-10T10:30")
    expect(nextHalfHourWhenInput(new Date(2026, 9, 10, 10, 30, 0))).toBe("2026-10-10T11:00")
    expect(nextHalfHourWhenInput(new Date(2026, 9, 10, 10, 45, 0))).toBe("2026-10-10T11:00")
  })

  it("offers quick times and the wider repeat menu in the shell compose", () => {
    render(<ReminderQuickAdd chrome="shell" stayOpen defaultWhen="2026-10-10T16:00" />)
    expect(screen.getByRole("button", { name: "In 1 hour" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Tonight 6pm" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Tomorrow 9am" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Next Monday" })).toBeInTheDocument()
    const repeat = screen.getByLabelText("Repeat")
    expect(repeat).toHaveDisplayValue("Once")
    fireEvent.change(repeat, { target: { value: "weekdays" } })
    expect(repeat).toHaveDisplayValue("Weekdays")
    fireEvent.change(repeat, { target: { value: "monthly" } })
    expect(repeat).toHaveDisplayValue("Every month")
    fireEvent.change(repeat, { target: { value: "yearly" } })
    expect(repeat).toHaveDisplayValue("Every year")
  })
})
