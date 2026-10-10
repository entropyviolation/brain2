import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SettingsIndex } from "./settings-nav"

describe("SettingsIndex", () => {
  it("lists every group when the query is empty", () => {
    render(<SettingsIndex query="" activeId="settings-friend" onJump={vi.fn()} onFocusFind={vi.fn()} />)
    expect(screen.getByRole("button", { name: "You" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Library" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Automatic point allocation" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Baby animal friend" })).toHaveAttribute("aria-current", "location")
  })

  it("hides groups that do not match", () => {
    render(<SettingsIndex query="birthday" activeId="settings-birthday" onJump={vi.fn()} onFocusFind={vi.fn()} />)
    expect(screen.getByRole("button", { name: "Birthday" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "You" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Desktop" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Appearance" })).not.toBeInTheDocument()
  })

  it("moves with the arrow keys and returns to find", () => {
    const onJump = vi.fn()
    const onFocusFind = vi.fn()
    render(<SettingsIndex query="birthday" activeId="settings-birthday" onJump={onJump} onFocusFind={onFocusFind} />)
    const you = screen.getByRole("button", { name: "You" })
    you.focus()
    fireEvent.keyDown(you, { key: "ArrowDown" })
    expect(onJump).toHaveBeenCalledWith("settings-birthday")
    const birthday = screen.getByRole("button", { name: "Birthday" })
    birthday.focus()
    fireEvent.keyDown(birthday, { key: "ArrowUp" })
    expect(onJump).toHaveBeenCalledWith(expect.stringContaining("settings-group-you"))
    fireEvent.keyDown(you, { key: "ArrowUp" })
    expect(onFocusFind).toHaveBeenCalled()
  })
})
