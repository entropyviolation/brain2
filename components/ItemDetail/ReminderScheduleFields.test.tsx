import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ReminderScheduleFields } from "./ReminderScheduleFields"
import type { Task } from "@/lib/types"

function reminder(partial?: Partial<NonNullable<Task["reminder"]>>): Task {
  return {
    id: "r1",
    description: "Call mom",
    title: "Call mom",
    createdAt: new Date(2026, 9, 9),
    completed: false,
    lists: ["reminders"],
    scheduledDate: new Date(2026, 9, 9),
    scheduledTime: "15:00",
    reminder: { repeat: "once", deliveredKey: "2026-10-09T15:00", ...partial },
  } as Task
}

describe("ReminderScheduleFields", () => {
  it("defaults Text me and Persistent on when the flags are omitted", () => {
    render(<ReminderScheduleFields task={reminder()} onChange={() => {}} />)
    expect(screen.getByRole("switch", { name: "Text me" })).toBeChecked()
    expect(screen.getByRole("switch", { name: "Persistent" })).toBeChecked()
  })

  it("writes Text me off without clearing the sent mark", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ReminderScheduleFields task={reminder()} onChange={onChange} />)
    await user.click(screen.getByRole("switch", { name: "Text me" }))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        reminder: expect.objectContaining({
          textMe: false,
          persistent: true,
          deliveredKey: "2026-10-09T15:00",
          repeat: "once",
        }),
      }),
    )
  })

  it("writes Persistent off", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ReminderScheduleFields task={reminder({ textMe: false })} onChange={onChange} />)
    await user.click(screen.getByRole("switch", { name: "Persistent" }))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        reminder: expect.objectContaining({
          persistent: false,
          textMe: false,
          deliveredKey: "2026-10-09T15:00",
        }),
      }),
    )
  })
})
