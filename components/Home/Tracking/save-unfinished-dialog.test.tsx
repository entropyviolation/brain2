/**
 * components/Home/Tracking/save-unfinished-dialog.test.tsx
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { useUnfinishedStop } from "./save-unfinished-dialog"

function Harness({ onStop }: { onStop: (park: boolean) => void }) {
  const stop = useUnfinishedStop(5, onStop)
  return (
    <div>
      <button type="button" onClick={stop.request}>
        Stop
      </button>
      {stop.dialog}
    </div>
  )
}

describe("save unfinished objectives", () => {
  it("Cancel and Escape leave the clock running", async () => {
    const user = userEvent.setup()
    const onStop = vi.fn()
    render(<Harness onStop={onStop} />)
    await user.click(screen.getByRole("button", { name: "Stop" }))
    expect(screen.getByTestId("save-unfinished-dialog")).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onStop).not.toHaveBeenCalled()
    expect(screen.queryByTestId("save-unfinished-dialog")).toBeNull()

    await user.click(screen.getByRole("button", { name: "Stop" }))
    await user.keyboard("{Escape}")
    expect(onStop).not.toHaveBeenCalled()
    expect(screen.queryByTestId("save-unfinished-dialog")).toBeNull()
  })

  it("Yes parks and No closes without parking", async () => {
    const user = userEvent.setup()
    const onStop = vi.fn()
    render(<Harness onStop={onStop} />)
    await user.click(screen.getByRole("button", { name: "Stop" }))
    await user.click(screen.getByRole("button", { name: "Yes" }))
    expect(onStop).toHaveBeenCalledWith(true)

    await user.click(screen.getByRole("button", { name: "Stop" }))
    await user.click(screen.getByRole("button", { name: "No" }))
    expect(onStop).toHaveBeenCalledWith(false)
  })
})
