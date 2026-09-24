import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { formatLocalDateKey } from "@/lib/date-utils"
import { usePlannedActionStore } from "@/lib/planned-action-store"
import { PlannedActionDialog } from "./planned-action-dialog"

describe("PlannedActionDialog", () => {
  const date = new Date(2026, 8, 21, 12)

  beforeEach(() => {
    resetAllStores()
  })

  it("adds a free planned action from Add Plan", async () => {
    const user = userEvent.setup()
    render(<PlannedActionDialog open onOpenChange={() => {}} action={null} createDate={date} />)

    expect(screen.getByRole("heading", { name: "Add plan" })).toBeInTheDocument()
    await user.type(screen.getByLabelText("Title"), "Deep work")
    await user.type(screen.getByLabelText("Notes"), "no phone")
    await user.click(screen.getByRole("button", { name: "Add" }))

    const created = usePlannedActionStore.getState().actions[0]
    expect(created).toMatchObject({
      date: formatLocalDateKey(date),
      startTime: "09:00",
      endTime: "09:30",
      title: "Deep work",
      notes: "no phone",
      source: "free",
    })
  })
})
