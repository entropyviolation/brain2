/**
 * components/Home/Tracking/pause-reason-dialog.test.tsx
 *
 * Cancel and an empty answer leave the clock running. A reason pauses it.
 */
import { useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { startPenColorSession } from "@/lib/pen-color-session"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"
import { usePauseReason } from "./pause-reason-dialog"

function Harness() {
  const pause = usePauseReason()
  const [landed, setLanded] = useState("waiting")
  return (
    <>
      <button
        type="button"
        onClick={() =>
          void pause.ask().then((reason) => {
            setLanded(reason ?? "cancelled")
          })
        }
      >
        Ask
      </button>
      <output>{landed}</output>
      {pause.dialog}
    </>
  )
}

describe("PauseReasonDialog", () => {
  beforeEach(() => {
    resetAllStores()
    startPenColorSession("act-exercise", new Date(2026, 8, 21, 19, 36, 0))
  })

  it("cancel and an empty answer do not pause", async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole("button", { name: "Ask" }))
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.getByText("cancelled")).toBeInTheDocument()
    expect(usePenColorSessionStore.getState().session?.pausedAt).toBeUndefined()

    await user.click(screen.getByRole("button", { name: "Ask" }))
    const dialog = screen.getByTestId("pause-reason-dialog")
    await user.click(dialog.querySelector("button.todo-cap.is-primary") as HTMLButtonElement)
    expect(screen.getByText("cancelled")).toBeInTheDocument()
    expect(usePenColorSessionStore.getState().session?.pausedAt).toBeUndefined()
    expect(screen.queryByTestId("pause-reason-dialog")).not.toBeInTheDocument()
  })
})
