import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ListsHelperKey } from "./ListsHelperKey"

describe("ListsHelperKey", () => {
  it("opens the helper over the window and closes on Escape", () => {
    render(<ListsHelperKey />)
    expect(screen.queryByRole("dialog")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "BIMBY" }))
    expect(screen.getByRole("dialog", { name: "Lists helper" })).toBeTruthy()
    fireEvent.keyDown(window, { key: "Escape" })
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})
