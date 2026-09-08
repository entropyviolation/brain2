import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { IsolatedInput, IsolatedTextarea } from "./isolated-text-field"

describe("IsolatedInput", () => {
  it("keeps typing local until blur, then commits", () => {
    const onCommit = vi.fn()
    const onLiveChange = vi.fn()
    render(<IsolatedInput value="Hello" onCommit={onCommit} onLiveChange={onLiveChange} />)
    const input = screen.getByDisplayValue("Hello")
    fireEvent.change(input, { target: { value: "Hello world" } })
    expect(input).toHaveValue("Hello world")
    expect(onCommit).not.toHaveBeenCalled()
    expect(onLiveChange).toHaveBeenCalledWith("Hello world")
    fireEvent.blur(input)
    expect(onCommit).toHaveBeenCalledWith("Hello world")
  })
})

describe("IsolatedTextarea", () => {
  it("does not re-commit identical values on blur", () => {
    const onCommit = vi.fn()
    render(<IsolatedTextarea value="notes" onCommit={onCommit} />)
    fireEvent.blur(screen.getByDisplayValue("notes"))
    expect(onCommit).not.toHaveBeenCalled()
  })
})
