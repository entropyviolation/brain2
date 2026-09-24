import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ToolbarSearch } from "./ToolbarSearch"

describe("ToolbarSearch", () => {
  it("keeps every typed character in the field", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ToolbarSearch resetKey={0} onChange={onChange} />)
    const input = screen.getByPlaceholderText("Search folders, lists, items…")
    await user.type(input, "my message")
    expect(input).toHaveValue("my message")
  })

  it("wipes the field when resetKey changes", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<ToolbarSearch resetKey={0} onChange={vi.fn()} />)
    const input = screen.getByPlaceholderText("Search folders, lists, items…")
    await user.type(input, "hello")
    rerender(<ToolbarSearch resetKey={1} onChange={vi.fn()} />)
    expect(input).toHaveValue("")
  })
})
