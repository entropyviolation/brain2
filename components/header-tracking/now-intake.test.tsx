import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { NowIntake } from "./now-intake"

const DAY = "2026-10-25"

describe("NowIntake uncategorized", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("lists the day's bare intake and sorts one into a class", async () => {
    const user = userEvent.setup()
    const store = useTimeTrackingStore.getState()
    store.paintMinutes(DAY, "activity", 600, 600, "act-work", undefined, undefined, undefined, {
      kind: "instant",
      title: "gummy",
      eventKind: "intake",
    })
    store.paintMinutes(DAY, "activity", 620, 620, "act-work", undefined, undefined, undefined, {
      kind: "instant",
      title: "toast",
      eventKind: "intake.food",
      intakeClass: "food",
    })
    render(<NowIntake dayKey={DAY} />)

    const list = screen.getByRole("list", { name: "Uncategorized intake" })
    expect(list).toHaveTextContent("gummy")
    expect(list).not.toHaveTextContent("toast")

    await user.click(within(screen.getByRole("group", { name: "Sort gummy" })).getByRole("button", { name: "Drink" }))
    expect(screen.queryByRole("list", { name: "Uncategorized intake" })).not.toBeInTheDocument()
    const gummy = useTimeTrackingStore.getState().entries.find((entry) => entry.title === "gummy")
    expect(gummy).toMatchObject({ intakeClass: "drink", eventKind: "intake.drink" })
    const toast = useTimeTrackingStore.getState().entries.find((entry) => entry.title === "toast")
    expect(toast?.intakeClass).toBe("food")
  })
})