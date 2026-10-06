import { act, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useGlobalSearchHotkey } from "./useGlobalSearchHotkey"

function Harness() {
  const { open, setOpen } = useGlobalSearchHotkey()
  return (
    <div>
      <span data-testid="search-open">{open ? "open" : "closed"}</span>
      <button type="button" onClick={() => setOpen(false)}>
        Close search
      </button>
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

describe("useGlobalSearchHotkey", () => {
  it("toggles on Cmd-K and Ctrl-K", () => {
    render(<Harness />)
    expect(screen.getByTestId("search-open")).toHaveTextContent("closed")

    const meta = press({ key: "k", metaKey: true })
    expect(meta.defaultPrevented).toBe(true)
    expect(screen.getByTestId("search-open")).toHaveTextContent("open")

    press({ key: "K", ctrlKey: true })
    expect(screen.getByTestId("search-open")).toHaveTextContent("closed")
  })

  it("leaves Cmd-Shift-K and Cmd-Alt-K alone", () => {
    render(<Harness />)
    const shifted = press({ key: "k", metaKey: true, shiftKey: true })
    const alt = press({ key: "k", ctrlKey: true, altKey: true })
    expect(shifted.defaultPrevented).toBe(false)
    expect(alt.defaultPrevented).toBe(false)
    expect(screen.getByTestId("search-open")).toHaveTextContent("closed")
  })

  it("ignores key repeat", () => {
    render(<Harness />)
    press({ key: "k", metaKey: true, repeat: true })
    expect(screen.getByTestId("search-open")).toHaveTextContent("closed")
    press({ key: "k", metaKey: true })
    expect(screen.getByTestId("search-open")).toHaveTextContent("open")
    press({ key: "k", metaKey: true, repeat: true })
    expect(screen.getByTestId("search-open")).toHaveTextContent("open")
  })
})
