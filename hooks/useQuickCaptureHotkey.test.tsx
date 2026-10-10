/**
 * Cmd/Ctrl-Shift-A opens Quick Add and can prefill a selection.
 * The chord does not fire while focus is inside the Quick Add dialog.
 */
import { act, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useQuickCaptureHotkey } from "./useQuickCaptureHotkey"

function Harness() {
  const { open, seed } = useQuickCaptureHotkey()
  return (
    <div>
      <span data-testid="capture-open">{open ? "open" : "closed"}</span>
      <span data-testid="capture-seed">{seed}</span>
      <textarea data-testid="page-note" defaultValue="alpha beta gamma" />
      {open ? (
        <div data-ui-name="Quick Add">
          <input data-testid="idea" defaultValue="draft" />
        </div>
      ) : null}
    </div>
  )
}

function press(init: KeyboardEventInit) {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init })
  act(() => {
    window.dispatchEvent(event)
  })
  return event
}

describe("useQuickCaptureHotkey", () => {
  it("opens on Cmd-Shift-A and Ctrl-Shift-A, and ignores the old Shift-K chord", () => {
    render(<Harness />)
    expect(screen.getByTestId("capture-open")).toHaveTextContent("closed")

    const shiftedK = press({ key: "k", code: "KeyK", metaKey: true, shiftKey: true })
    expect(shiftedK.defaultPrevented).toBe(false)
    expect(screen.getByTestId("capture-open")).toHaveTextContent("closed")

    const meta = press({ key: "A", code: "KeyA", metaKey: true, shiftKey: true })
    expect(meta.defaultPrevented).toBe(true)
    expect(screen.getByTestId("capture-open")).toHaveTextContent("open")

    press({ key: "a", code: "KeyA", ctrlKey: true, shiftKey: true })
    expect(screen.getByTestId("capture-open")).toHaveTextContent("closed")
  })

  it("prefills the highlighted field text and leaves the dialog alone while it is focused", () => {
    render(<Harness />)
    const note = screen.getByTestId("page-note") as HTMLTextAreaElement
    note.focus()
    note.setSelectionRange(0, 5)

    press({ key: "A", code: "KeyA", metaKey: true, shiftKey: true })
    expect(screen.getByTestId("capture-open")).toHaveTextContent("open")
    expect(screen.getByTestId("capture-seed")).toHaveTextContent("alpha")

    const idea = screen.getByTestId("idea")
    idea.focus()
    const inside = press({ key: "A", code: "KeyA", metaKey: true, shiftKey: true })
    expect(inside.defaultPrevented).toBe(false)
    expect(screen.getByTestId("capture-open")).toHaveTextContent("open")
    expect(screen.getByTestId("capture-seed")).toHaveTextContent("alpha")
  })

  it("ignores key repeat", () => {
    render(<Harness />)
    press({ key: "A", code: "KeyA", metaKey: true, shiftKey: true, repeat: true })
    expect(screen.getByTestId("capture-open")).toHaveTextContent("closed")
  })
})
